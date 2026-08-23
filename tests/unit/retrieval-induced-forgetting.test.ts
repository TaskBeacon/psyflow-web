import { describe, expect, it } from "vitest";
import { StimBank, TrialBuilder } from "../../src";
import { runTrial } from "../../../H000090-retrieval-induced-forgetting/src/run_trial";
import {
  generateRifSessionPlan,
  type SettingsView
} from "../../../H000090-retrieval-induced-forgetting/src/utils";

const settings = {
  overall_seed: 90090,
  category_count: 4,
  items_per_category: 4,
  practiced_category_count: 2,
  practiced_items_per_category: 2,
  practice_repetitions: 3,
  distractor_trials: 4,
  distractor_keys: { odd: "f", even: "j" },
  submit_key: "return",
  study_duration_s: 5,
  practice_response_window_s: 10,
  distractor_trial_duration_s: 10,
  final_test_response_window_s: 7,
  triggers: { final_rp_minus_onset: 42, text_submit: 51, response_timeout: 59 },
  category_bank: {
    水果: ["苹果", "香蕉", "橙子", "葡萄"],
    动物: ["老虎", "狮子", "大象", "猴子"],
    乐器: ["钢琴", "小提琴", "吉他", "长笛"],
    颜色: ["红色", "蓝色", "绿色", "黄色"]
  }
} as unknown as SettingsView;

describe("H000090 retrieval-induced forgetting", () => {
  it("preserves balanced cross-phase identities and critical-first final output", () => {
    const plan = generateRifSessionPlan(settings, "participant-090");
    expect(plan.study).toHaveLength(16);
    expect(plan.retrieval_practice).toHaveLength(12);
    expect(plan.distractor).toHaveLength(4);
    expect(plan.final_test).toHaveLength(16);
    expect(plan.final_test.filter((item) => item.item_status === "rp_plus")).toHaveLength(4);
    expect(plan.final_test.filter((item) => item.item_status === "rp_minus")).toHaveLength(4);
    expect(plan.final_test.filter((item) => item.item_status === "nrp")).toHaveLength(8);
    const firstRpPlus = plan.final_test.findIndex((item) => item.item_status === "rp_plus");
    expect(firstRpPlus).toBe(12);
    expect(plan.final_test.slice(firstRpPlus).every((item) => item.item_status === "rp_plus")).toBe(true);
  });

  it("compiles final recall as an editable-textbox Enter response stage", () => {
    const plan = generateRifSessionPlan(settings, "participant-090").final_test[0];
    const stimBank = new StimBank({
      final_test_phase_label: { type: "text", text: "最终回忆" },
      cue_category_text: { type: "text", text: "类别：{category}" },
      cue_stem_text: { type: "text", text: "词语线索：{cue}" },
      response_entry: { type: "textbox", text: "", editable: true },
      submit_hint_text: { type: "text", text: "输入完成后按回车提交" }
    });
    const trial = new TrialBuilder({ trial_id: 1, block_id: "final_test", trial_index: 0,
      condition: plan.condition_id });
    runTrial(trial, plan, { settings, stimBank, block_id: "final_test", block_idx: 3 });
    const compiled = trial.build();
    expect(compiled.units[0]).toMatchObject({ unit_label: "final_test_cue", op: "capture_response",
      duration: 7, response_cfg: { keys: ["return"], terminate_on_response: true } });
  });
});
