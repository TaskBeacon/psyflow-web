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

export function demoParticipantData(fields: SubInfoField[]): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const field of fields) {
    if (field.type === "choice") result[field.name] = field.choices?.[0] ?? "Demo";
    else if (field.type === "int") {
      const minimum = Number(field.constraints?.min ?? 1);
      const maximum = Number(field.constraints?.max ?? 999);
      const preferred = field.name === "age" ? 25 : 999;
      result[field.name] = Math.max(minimum, Math.min(maximum, preferred));
    } else result[field.name] = "Demo";
  }
  result.preview_mode = "demo";
  return result;
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

  collect(container: HTMLElement, options: { allowDemo?: boolean } = {}): Promise<Record<string, string | number>> {
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "psyflow-subinfo";
    const title = document.createElement("h1");
    title.textContent = options.allowDemo ? "Try this task" : "Participant Info";
    wrapper.appendChild(title);
    const demo = document.createElement("button");
    demo.type = "button";
    demo.className = "psyflow-task-button";
    demo.textContent = "Try with demo details";
    if (options.allowDemo) {
      const note = document.createElement("p");
      note.textContent = "Use fictional participant details for a walkthrough. Responses are still recorded during the task and can be downloaded afterwards. Demo runs are labelled in the results.";
      wrapper.append(note, demo);
    }

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
    errorBox.setAttribute("role", "alert");
    form.appendChild(errorBox);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Start Task";
    form.appendChild(submit);
    if (options.allowDemo) {
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = "Enter participant details instead";
      details.style.marginTop = "24px";
      summary.style.cursor = "pointer";
      details.append(summary, form);
      wrapper.appendChild(details);
    } else wrapper.appendChild(form);
    container.appendChild(wrapper);

    return new Promise((resolve) => {
      if (options.allowDemo) demo.addEventListener("click", () => {
        demo.disabled = true;
        resolve(demoParticipantData(this.fields));
      }, { once: true });
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
