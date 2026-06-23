import { describe, expect, it } from "vitest";

import { summarizeRows } from "../../../H000054-delayed-recall-task/src/utils";

describe("H000054 delayed recall summaries", () => {
  it("aggregates sequence-level reduced rows", () => {
    const summary = summarizeRows([
      {
        block_id: "block_0",
        encoding_accuracy: 0.75,
        same_order_accuracy: 0.5,
        boundary_order_accuracy: 0.25,
        source_accuracy: 1,
        mean_rt_s: 1.2,
        total_timeouts: 2
      },
      {
        block_id: "block_1",
        encoding_accuracy: 0.25,
        same_order_accuracy: 1,
        boundary_order_accuracy: 0.75,
        source_accuracy: 0,
        mean_rt_s: 0.8,
        total_timeouts: 1
      }
    ]);

    expect(summary.encoding_accuracy).toBe("50.0%");
    expect(summary.same_order_accuracy).toBe("75.0%");
    expect(summary.boundary_order_accuracy).toBe("50.0%");
    expect(summary.source_accuracy).toBe("50.0%");
    expect(summary.mean_rt_ms).toBe("1000.0 ms");
    expect(summary.total_timeouts).toBe(3);
    expect(summary.total_sequences).toBe(2);
  });
});
