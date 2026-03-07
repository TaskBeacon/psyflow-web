import type { SubInfoField } from "./types";

function coerceFieldValue(field: SubInfoField, raw: string): string | number {
  if (field.type === "int") {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`${field.name} must be a number.`);
    }
    return value;
  }
  return raw;
}

export class SubInfo {
  private readonly fields: SubInfoField[];
  private readonly mapping: Record<string, string>;

  constructor(config: { subinfo_fields: Array<Record<string, unknown>>; subinfo_mapping: Record<string, string> }) {
    this.fields = config.subinfo_fields.map((field) => ({
      name: String(field.name),
      type: (field.type as SubInfoField["type"]) ?? "string",
      constraints: (field.constraints as Record<string, unknown>) ?? undefined,
      choices: (field.choices as string[]) ?? undefined
    }));
    this.mapping = config.subinfo_mapping;
  }

  collect(container: HTMLElement): Promise<Record<string, string | number>> {
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "psyflow-subinfo";
    const title = document.createElement("h1");
    title.textContent = "Participant Info";
    wrapper.appendChild(title);

    const form = document.createElement("form");
    form.className = "psyflow-subinfo-form";

    const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
    for (const field of this.fields) {
      const label = document.createElement("label");
      label.className = "psyflow-subinfo-field";
      label.textContent = this.mapping[field.name] ?? field.name;
      let input: HTMLInputElement | HTMLSelectElement;
      if (field.type === "choice") {
        const select = document.createElement("select");
        for (const choice of field.choices ?? []) {
          const option = document.createElement("option");
          option.value = choice;
          option.textContent = this.mapping[choice] ?? choice;
          select.appendChild(option);
        }
        input = select;
      } else {
        const textInput = document.createElement("input");
        textInput.type = field.type === "int" ? "number" : "text";
        input = textInput;
      }
      input.name = field.name;
      label.appendChild(input);
      form.appendChild(label);
      inputs.set(field.name, input);
    }

    const errorBox = document.createElement("div");
    errorBox.className = "psyflow-subinfo-error";
    form.appendChild(errorBox);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Start Task";
    form.appendChild(submit);
    wrapper.appendChild(form);
    container.appendChild(wrapper);

    return new Promise((resolve) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        errorBox.textContent = "";
        try {
          const result: Record<string, string | number> = {};
          for (const field of this.fields) {
            const input = inputs.get(field.name);
            if (!input) {
              continue;
            }
            const raw = input.value.trim();
            if (!raw) {
              throw new Error(`${field.name} is required.`);
            }
            result[field.name] = coerceFieldValue(field, raw);
          }
          resolve(result);
        } catch (error) {
          errorBox.textContent = error instanceof Error ? error.message : "Invalid input.";
        }
      });
    });
  }
}
