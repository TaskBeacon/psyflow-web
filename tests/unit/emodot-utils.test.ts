import { describe, expect, it } from "vitest";

import {
  AssetPool,
  assign_stim_from_condition,
  get_stim_list_from_assets,
  normalizeImportedAssets
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

    expect(stimList.P_F.map((entry) => entry.name)).toEqual(["HF01.BMP"]);
    expect(stimList.P_M.map((entry) => entry.name)).toEqual(["HM01.BMP"]);
    expect(stimList.N_F.map((entry) => entry.name)).toEqual(["NEF01.BMP"]);
    expect(stimList.N_M.map((entry) => entry.name)).toEqual(["NEM01.BMP"]);
    expect(stimList.S_F.map((entry) => entry.name)).toEqual(["SAF01.BMP"]);
    expect(stimList.S_M.map((entry) => entry.name)).toEqual(["SAM01.BMP"]);
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
});
