import { parse } from "yaml";

import type { ParsedConfig, StimSpec } from "./types";

function isRelativeAssetPath(value: string): boolean {
  return !/^(?:[a-z]+:|\/|data:)/i.test(value);
}

function resolveStimSpecAssets(spec: StimSpec, moduleUrl?: string): StimSpec {
  if (!moduleUrl) {
    return spec;
  }
  if (spec.type === "image" && isRelativeAssetPath(spec.image)) {
    return {
      ...spec,
      image: new URL(spec.image, moduleUrl).href
    };
  }
  if (spec.type === "movie" && isRelativeAssetPath(spec.filename)) {
    return {
      ...spec,
      filename: new URL(spec.filename, moduleUrl).href
    };
  }
  if (spec.type === "sound" && isRelativeAssetPath(spec.file)) {
    return {
      ...spec,
      file: new URL(spec.file, moduleUrl).href
    };
  }
  return spec;
}

export function parsePsyflowConfig(yamlText: string, moduleUrl?: string): ParsedConfig {
  const raw = parse(yamlText) as Record<string, unknown>;
  const taskSections = ["window", "task", "timing"];
  const task_config: Record<string, unknown> = {};
  for (const section of taskSections) {
    const data = raw[section];
    if (data && typeof data === "object") {
      Object.assign(task_config, data as Record<string, unknown>);
    }
  }
  return {
    raw,
    task_config,
    stim_config: Object.fromEntries(
      Object.entries(((raw.stimuli as Record<string, StimSpec>) ?? {}) as Record<string, StimSpec>).map(
        ([key, spec]) => [key, resolveStimSpecAssets(spec, moduleUrl)]
      )
    ),
    subform_config: {
      subinfo_fields: (raw.subinfo_fields as Array<Record<string, unknown>>) ?? [],
      subinfo_mapping: (raw.subinfo_mapping as Record<string, string>) ?? {}
    },
    trigger_config:
      ((raw.triggers as { map?: Record<string, unknown> })?.map ?? raw.triggers ?? {}) as Record<
        string,
        unknown
      >,
    controller_config: (raw.controller as Record<string, unknown>) ?? {}
  };
}
