import { describe, expect, it } from "vitest";

import { parseCsvRows } from "../../src";

describe("parseCsvRows", () => {
  it("parses headers, quoted delimiters, embedded newlines, and blank records", () => {
    const rows = parseCsvRows<{ id: string; label: string }>("\uFEFFid,label\r\n1,alpha\r\n2,\"beta, gamma\"\r\n3,\"two\nlines\"\r\n\r\n");
    expect(rows).toEqual([
      { id: "1", label: "alpha" },
      { id: "2", label: "beta, gamma" },
      { id: "3", label: "two\nlines" }
    ]);
  });
});
