import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000003-emodot/src/run_trial";
import {
  AssetPool,
  assign_stim_from_condition,
  generate_emodot_conditions,
  get_stim_list_from_assets,
  normalizeImportedAssets,
  resolve_canonical_block_seed,
  type EmodotTrialInfo
} from "../../../H000003-emodot/src/utils";

describe("emodot utils", () => {
  it("groups imported face assets into the expected emotion/gender pools", () => {
    const normalized = normalizeImportedAssets({
      "./assets/HF01.bmp": "/assets/HF01.bmp",
      "./assets/HM01.bmp": "/assets/HM01.bmp",
      "./assets/NEF01.bmp": "/assets/NEF01.bmp",
      "./assets/NEM01.bmp": "/assets/NEM01.bmp",
      "./assets/SAF01.bmp": "/assets/SAF01.bmp",
      "./assets/SAM01.bmp": "/assets/SAM01.bmp"
    });
    const stimList = get_stim_list_from_assets(normalized);

    expect(stimList.P_F.map((entry) => entry.name)).toEqual(["HF01.bmp"]);
    expect(stimList.P_M.map((entry) => entry.name)).toEqual(["HM01.bmp"]);
    expect(stimList.N_F.map((entry) => entry.name)).toEqual(["NEF01.bmp"]);
    expect(stimList.N_M.map((entry) => entry.name)).toEqual(["NEM01.bmp"]);
    expect(stimList.S_F.map((entry) => entry.name)).toEqual(["SAF01.bmp"]);
    expect(stimList.S_M.map((entry) => entry.name)).toEqual(["SAM01.bmp"]);
  });

  it("assigns face pairs and target side from condition tokens", () => {
    const pool = new AssetPool(
      {
        P_F: [
          { name: "HF01.BMP", url: "/assets/HF01.bmp" },
          { name: "HF02.BMP", url: "/assets/HF02.bmp" }
        ],
        P_M: [{ name: "HM01.BMP", url: "/assets/HM01.bmp" }],
        N_F: [
          { name: "NEF01.BMP", url: "/assets/NEF01.bmp" },
          { name: "NEF02.BMP", url: "/assets/NEF02.bmp" }
        ],
        N_M: [{ name: "NEM01.BMP", url: "/assets/NEM01.bmp" }],
        S_F: [{ name: "SAF01.BMP", url: "/assets/SAF01.bmp" }],
        S_M: [{ name: "SAM01.BMP", url: "/assets/SAM01.bmp" }]
      },
      2025
    );

    const positiveNeutral = assign_stim_from_condition("PN_F_L", pool);
    expect(positiveNeutral.left_stim.name.startsWith("HF")).toBe(true);
    expect(positiveNeutral.right_stim.name.startsWith("NEF")).toBe(true);
    expect(positiveNeutral.target_position).toBe("left");

    const sadNeutral = assign_stim_from_condition("NS_M_R", pool);
    expect(sadNeutral.left_stim.name.startsWith("NEM")).toBe(true);
    expect(sadNeutral.right_stim.name.startsWith("SAM")).toBe(true);
    expect(sadNeutral.target_position).toBe("right");
  });

  it("uses canonical psyflow block seeds for same_across_sub sessions", () => {
    expect([
      resolve_canonical_block_seed({ overall_seed: 2025, total_blocks: 3 }, 0),
      resolve_canonical_block_seed({ overall_seed: 2025, total_blocks: 3 }, 1),
      resolve_canonical_block_seed({ overall_seed: 2025, total_blocks: 3 }, 2)
    ]).toEqual([73105, 10839, 84652]);
  });

  it("matches the canonical Python randomized schedule and face draws", () => {
    const stimList = get_stim_list_from_assets(
      normalizeImportedAssets({
        "./assets/HF01.bmp": "/assets/HF01.bmp",
        "./assets/HF02.bmp": "/assets/HF02.bmp",
        "./assets/HM01.bmp": "/assets/HM01.bmp",
        "./assets/HM02.bmp": "/assets/HM02.bmp",
        "./assets/NEF01.bmp": "/assets/NEF01.bmp",
        "./assets/NEF02.bmp": "/assets/NEF02.bmp",
        "./assets/NEM01.bmp": "/assets/NEM01.bmp",
        "./assets/NEM02.bmp": "/assets/NEM02.bmp",
        "./assets/SAF01.bmp": "/assets/SAF01.bmp",
        "./assets/SAF02.bmp": "/assets/SAF02.bmp",
        "./assets/SAM01.bmp": "/assets/SAM01.bmp",
        "./assets/SAM02.bmp": "/assets/SAM02.bmp"
      })
    );

    const schedule = generate_emodot_conditions(12, CONDITIONS, {
      seed: 73105,
      stim_list: stimList
    });

    expect(
      schedule.slice(0, 10).map((trial) => [
        trial.condition,
        trial.left_stim.name,
        trial.right_stim.name,
        trial.target_position
      ])
    ).toEqual([
      ["SN_F_R", "SAF02.bmp", "NEF02.bmp", "right"],
      ["PN_F_R", "HF01.bmp", "NEF01.bmp", "right"],
      ["NP_M_L", "NEM01.bmp", "HM01.bmp", "left"],
      ["NP_M_R", "NEM02.bmp", "HM02.bmp", "right"],
      ["NS_F_R", "NEF02.bmp", "SAF01.bmp", "right"],
      ["PN_M_L", "HM01.bmp", "NEM02.bmp", "left"],
      ["PN_M_R", "HM02.bmp", "NEM01.bmp", "right"],
      ["NP_F_R", "NEF01.bmp", "HF02.bmp", "right"],
      ["PN_F_L", "HF02.bmp", "NEF02.bmp", "left"],
      ["NP_F_L", "NEF01.bmp", "HF01.bmp", "left"]
    ]);
  });

  it("preserves trial phase context and response triggers", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: CONDITIONS,
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      fixation_duration: [0.8, 1],
      cue_duration: 0.5,
      interval_duration: [0.4, 0.6],
      target_duration: 1
    });
    settings.triggers = {
      fixation_onset: 10,
      PN_F_R_cue_onset: 22,
      PN_F_R_target_onset: 23,
      key_press: 68,
      no_response: 69
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      left_stim: { type: "image", image: "assets/HF01.bmp" },
      right_stim: { type: "image", image: "assets/NEF01.bmp" },
      left_target: { type: "circle", radius: 1 },
      right_target: { type: "circle", radius: 1 }
    });
    const trialInfo: EmodotTrialInfo = {
      condition: "PN_F_R",
      left_stim: { name: "HF01.bmp", url: "/assets/HF01.bmp" },
      right_stim: { name: "NEF01.bmp", url: "/assets/NEF01.bmp" },
      target_position: "right"
    };
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: trialInfo.condition
    });

    run_trial(trial, trialInfo, {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_face_fixation",
      "face_pair_preview",
      "inter_stimulus_interval",
      "dot_probe_response"
    ]);
    expect(compiled.units[2].context?.task_factors).toMatchObject({
      target_position: "right"
    });
    expect(compiled.units[3].response_cfg).toMatchObject({
      response_trigger: 68,
      timeout_trigger: 69
    });
  });
});

const CONDITIONS = [
  "PN_F_L",
  "PN_F_R",
  "NP_F_L",
  "NP_F_R",
  "SN_F_L",
  "SN_F_R",
  "NS_F_L",
  "NS_F_R",
  "PN_M_L",
  "PN_M_R",
  "NP_M_L",
  "NP_M_R",
  "SN_M_L",
  "SN_M_R",
  "NS_M_L",
  "NS_M_R",
  "NN_F_L",
  "NN_F_R",
  "NN_M_L",
  "NN_M_R"
];
