import type { Resolvable, RuntimeView, StimRef, StimSpec, TrialSnapshot } from "./types";

function formatNumber(value: unknown, precision: string | undefined): string {
  if (precision && typeof value === "number") {
    const digits = Number(precision.replace(".",""));
    if (Number.isFinite(digits)) {
      return value.toFixed(digits);
    }
  }
  return String(value ?? "");
}

function formatTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)(?::(\.\d+f))?\}/g, (_, key: string, precision?: string) => {
    return formatNumber(vars[key], precision);
  });
}

export class StimBank {
  private readonly config: Record<string, StimSpec>;

  constructor(config: Record<string, StimSpec>) {
    this.config = config;
  }

  get(key: string): StimRef {
    if (!this.config[key]) {
      throw new Error(`Stimulus '${key}' not found.`);
    }
    return { kind: "stim_ref", key };
  }

  resolve(ref: StimRef | string): StimSpec {
    const key = typeof ref === "string" ? ref : ref.key;
    const spec = this.config[key];
    if (!spec) {
      throw new Error(`Stimulus '${key}' not found.`);
    }
    return structuredClone(spec);
  }

  format(name: string, vars: Record<string, unknown>): StimSpec {
    const spec = this.resolve(name);
    if ("text" in spec && typeof spec.text === "string") {
      return { ...spec, text: formatTemplate(spec.text, vars) } as StimSpec;
    }
    return spec;
  }

  rebuild(name: string, overrides: Partial<StimSpec> = {}): StimSpec {
    const spec = this.resolve(name);
    return {
      ...spec,
      ...structuredClone(overrides)
    } as StimSpec;
  }

  get_and_format(name: string, vars: Record<string, unknown>): StimSpec {
    return this.format(name, vars);
  }

  convert_to_voice(
    keys: string[] | string,
    options: {
      voice?: string;
      lang?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
    } = {}
  ): this {
    const labels = Array.isArray(keys) ? keys : [keys];
    for (const label of labels) {
      const spec = this.resolve(label);
      if (!("text" in spec) || typeof spec.text !== "string") {
        throw new Error(`Stimulus '${label}' cannot be converted to voice because it has no text.`);
      }
      const lang =
        options.lang ??
        (typeof options.voice === "string" && /^[a-z]{2}-[A-Z]{2}/.test(options.voice)
          ? options.voice.slice(0, 5)
          : undefined);
      this.config[`${label}_voice`] = {
        type: "speech",
        text: spec.text,
        voice: options.voice,
        lang,
        rate: options.rate,
        pitch: options.pitch,
        volume: options.volume
      };
    }
    return this;
  }

  add_voice(
    label: string,
    text: string,
    options: {
      voice?: string;
      lang?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
    } = {}
  ): this {
    this.config[label] = {
      type: "speech",
      text,
      voice: options.voice,
      lang: options.lang,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume
    };
    return this;
  }
}

export function resolveStimInput(
  input: Resolvable<StimRef | StimSpec | null>,
  snapshot: TrialSnapshot,
  runtime: RuntimeView,
  bank: StimBank
): StimSpec | null {
  const value =
    typeof input === "function"
      ? input(snapshot, runtime)
      : input && typeof input === "object" && "kind" in input && input.kind === "state_ref"
        ? (snapshot.units[input.unit_label]?.[input.key] as StimRef | StimSpec | null | undefined) ?? null
        : input;

  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return bank.resolve(value);
  }
  if (typeof value === "object" && "kind" in value && value.kind === "stim_ref") {
    return bank.resolve(value);
  }
  return structuredClone(value as StimSpec);
}
