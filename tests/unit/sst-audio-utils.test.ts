import { describe, expect, it } from "vitest";

import { generate_sst_conditions } from "../../../H000013-sst-audio/src/utils";

describe("H000013 SST-Audio utils", () => {
  it("matches canonical Python SST-Audio constrained condition generation", () => {
    expect(generate_sst_conditions(24, ["go_left", "go_right", "stop_left", "stop_right"], 0.25, 4, 3, 73105)).toEqual([
      "go_right",
      "go_left",
      "go_left",
      "go_right",
      "go_right",
      "go_right",
      "go_right",
      "stop_left",
      "go_left",
      "stop_left",
      "stop_right",
      "go_right",
      "go_left",
      "go_left",
      "stop_right",
      "go_left",
      "go_left",
      "go_left",
      "stop_left",
      "go_left",
      "go_right",
      "go_right",
      "stop_right",
      "go_right"
    ]);
  });
});
