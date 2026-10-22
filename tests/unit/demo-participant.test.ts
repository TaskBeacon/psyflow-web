import { describe, it, expect } from "vitest";
import { SubInfo, demoParticipantData } from "../../src/core/SubInfo";

const fields = [
  { name: "subject_id", type: "int" as const, constraints: { min: 101, max: 999 } },
  { name: "age", type: "int" as const, constraints: { min: 5, max: 20 } },
  { name: "subname", type: "string" as const },
  { name: "gender", type: "choice" as const, choices: ["Male", "Female"] }
];
describe("preview demo participant details", () => {
  it("uses valid configured choices and bounds, and marks synthetic data", () => {
    expect(demoParticipantData(fields)).toEqual({ subject_id: 999, age: 20, subname: "Demo", gender: "Male", preview_mode: "demo" });
  });
  it("offers a demo without requiring personal form fields", async () => {
    const root = document.createElement("div");
    const info = new SubInfo({ subinfo_fields: fields, subinfo_mapping: {} });
    const collected = info.collect(root, { allowDemo: true });
    expect(root.querySelector("details")?.open).toBe(true);
    (root.querySelector("button") as HTMLButtonElement).click();
    expect(await collected).toEqual(demoParticipantData(fields));
  });
  it("retains the original participant workflow when demo is not enabled", async () => {
    const root = document.createElement("div");
    const info = new SubInfo({ subinfo_fields: fields, subinfo_mapping: {} });
    const collected = info.collect(root);
    expect(root.textContent).not.toContain("Try with demo details");
    for (const [name, value] of Object.entries({ subject_id: "123", age: "18", subname: "Test" })) {
      (root.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
    }
    root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(await collected).toEqual({ subject_id: 123, age: 18, subname: "Test", gender: "Male" });
  });
});
