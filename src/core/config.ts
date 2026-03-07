import { parse } from "yaml";

import type { ParsedConfig, StimSpec } from "./types";

export function parsePsyflowConfig(yamlText: string): ParsedConfig {
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
    stim_config: ((raw.stimuli as Record<string, StimSpec>) ?? {}) as Record<string, StimSpec>,
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
