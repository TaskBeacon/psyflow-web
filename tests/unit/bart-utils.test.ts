import { describe, expect, it } from "vitest";

import { sampleExplosionPoint } from "../../../H000002-bart/src/utils";

describe("H000002 BART utilities", () => {
  it("matches the canonical T000002 without-replacement explosion sequence", () => {
    const settings: Record<string, unknown> = {
      explosion_sampling_mode: "without_replacement_cycle",
      overall_seed: 2025,
      block_seed: [2025, 2026, 2027]
    };

    expect(Array.from({ length: 6 }, () => sampleExplosionPoint(settings, "blue", 0, 24))).toEqual([
      19, 13, 23, 14, 18, 20
    ]);
    expect(Array.from({ length: 6 }, () => sampleExplosionPoint(settings, "yellow", 0, 12))).toEqual([
      5, 11, 4, 9, 1, 6
    ]);
    expect(Array.from({ length: 6 }, () => sampleExplosionPoint(settings, "orange", 0, 6))).toEqual([
      5, 2, 6, 4, 3, 1
    ]);
  });
});
