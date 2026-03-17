import { describe, expect, it } from "vitest";

import { parsePsyflowConfig } from "../../src/core/config";

const yaml = `
subinfo_fields:
  - name: subject_id
    type: string
subinfo_mapping:
  subject_id: Subject ID
window:
  size: [1280, 720]
  bg_color: gray
task:
  total_blocks: 2
  total_trials: 8
timing:
  cue_duration: 0.3
stimuli:
  fixation:
    type: text
    text: +
triggers:
  map:
    exp_onset: 98
controller:
  initial_duration: 0.2
`;

describe("parsePsyflowConfig", () => {
  it("flattens task sections and preserves psyflow section names", () => {
    const parsed = parsePsyflowConfig(yaml);
    expect(parsed.task_config.size).toEqual([1280, 720]);
    expect(parsed.task_config.total_blocks).toBe(2);
    expect(parsed.task_config.cue_duration).toBe(0.3);
    expect(parsed.stim_config.fixation.type).toBe("text");
    expect(parsed.subform_config.subinfo_mapping.subject_id).toBe("Subject ID");
    expect(parsed.trigger_config.exp_onset).toBe(98);
    expect(parsed.controller_config.initial_duration).toBe(0.2);
  });

  it("resolves relative movie and sound asset paths when moduleUrl is provided", () => {
    const parsed = parsePsyflowConfig(
      `
stimuli:
  clip:
    type: movie
    filename: assets/demo.mp4
  tone:
    type: sound
    file: assets/tone.mp3
`,
      "https://example.com/tasks/H000007/main.ts"
    );
    expect(parsed.stim_config.clip).toMatchObject({
      type: "movie",
      filename: "https://example.com/tasks/H000007/assets/demo.mp4"
    });
    expect(parsed.stim_config.tone).toMatchObject({
      type: "sound",
      file: "https://example.com/tasks/H000007/assets/tone.mp3"
    });
  });
});
