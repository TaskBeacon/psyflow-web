function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return "";
  }
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  }
  return lines.join("\n");
}
