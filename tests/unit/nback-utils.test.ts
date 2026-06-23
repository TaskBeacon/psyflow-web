import { describe, expect, it } from "vitest";

import { generate_nback_conditions } from "../../../H000008-nback/src/utils";

describe("H000008 n-back utils", () => {
  it("matches canonical Python 1-back sequence generation", () => {
    expect(generate_nback_conditions(20, ["match", "nomatch"], 1, 73105)).toEqual([
      "nomatch_7",
      "nomatch_5",
      "nomatch_3",
      "match_3",
      "nomatch_2",
      "nomatch_7",
      "nomatch_1",
      "nomatch_7",
      "nomatch_5",
      "match_5",
      "nomatch_1",
      "match_1",
      "nomatch_8",
      "nomatch_2",
      "nomatch_4",
      "nomatch_5",
      "nomatch_7",
      "nomatch_5",
      "nomatch_8",
      "nomatch_3"
    ]);
  });

  it("matches canonical Python 2-back sequence generation", () => {
    expect(generate_nback_conditions(20, ["match", "nomatch"], 2, 10839)).toEqual([
      "nomatch_3",
      "nomatch_7",
      "nomatch_4",
      "nomatch_4",
      "nomatch_2",
      "match_4",
      "nomatch_9",
      "match_4",
      "nomatch_6",
      "match_4",
      "nomatch_7",
      "nomatch_5",
      "nomatch_8",
      "nomatch_2",
      "match_8",
      "nomatch_8",
      "nomatch_7",
      "match_8",
      "nomatch_2",
      "match_8"
    ]);
  });
});
