export type Primitive = string | number | boolean | null;

export interface StimRef {
  kind: "stim_ref";
  key: string;
}

export interface StateRef<T = unknown> {
  kind: "state_ref";
  unit_label: string;
  key: string;
  __type?: T;
}

export interface TrialSnapshot {
  trial_id: number | string;
  block_id: string | null;
  trial_index: number;
  condition: string;
  units: Record<string, Record<string, unknown>>;
  trial_state: Record<string, unknown>;
}

export interface RuntimeView {
  getReducedRows(): ReducedTrialRow[];
  sumReducedField(field: string): number;
}

export type Resolver<T> = (snapshot: TrialSnapshot, runtime: RuntimeView) => T;
export type Resolvable<T> = T | StateRef<T> | Resolver<T>;

export type StimSpec =
  | TextStimSpec
  | TextBoxStimSpec
  | CircleStimSpec
  | RectStimSpec
  | PolygonStimSpec
  | ShapeStimSpec
  | ImageStimSpec
  | MovieStimSpec
  | SoundStimSpec
  | SpeechStimSpec;

interface BaseStimSpec {
  type: string;
  pos?: [number, number];
  color?: string;
  units?: string;
  ori?: number;
}

export interface TextStimSpec extends BaseStimSpec {
  type: "text";
  text: string;
  height?: number;
  font?: string;
  alignment?: "left" | "center" | "right";
}

export interface TextBoxStimSpec extends BaseStimSpec {
  type: "textbox";
  text: string;
  size?: [number, number];
  letterHeight?: number;
  font?: string;
  alignment?: "left" | "center" | "right";
}

export interface CircleStimSpec extends BaseStimSpec {
  type: "circle";
  radius: number;
  fillColor?: string;
  lineColor?: string;
}

export interface RectStimSpec extends BaseStimSpec {
  type: "rect";
  width: number;
  height: number;
  fillColor?: string;
  lineColor?: string;
}

export interface PolygonStimSpec extends BaseStimSpec {
  type: "polygon";
  edges: number;
  size: number;
  fillColor?: string;
  lineColor?: string;
}

export interface ShapeStimSpec extends BaseStimSpec {
  type: "shape";
  vertices: Array<[number, number]>;
  size: number;
  fillColor?: string;
  lineColor?: string;
}

export interface ImageStimSpec extends BaseStimSpec {
  type: "image";
  image: string;
  size?: [number, number];
}

export interface MovieStimSpec extends BaseStimSpec {
  type: "movie";
  filename: string;
  size?: [number, number];
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  volume?: number;
}

export interface SoundStimSpec extends BaseStimSpec {
  type: "sound";
  file: string;
  volume?: number;
}

export interface SpeechStimSpec extends BaseStimSpec {
  type: "speech";
  text: string;
  voice?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface ResponseConfig {
  keys: string[];
  correct_keys?: string[];
  terminate_on_response?: boolean;
  grace_s?: number;
  response_trigger?: number | Record<string, number> | null;
  timeout_trigger?: number | null;
}

export interface TrialContextSpec {
  trial_id?: number | string;
  phase?: string;
  deadline_s?: number | number[] | null;
  valid_keys?: string[];
  block_id?: string | null;
  condition_id?: string | null;
  task_factors?: Record<string, unknown>;
  stim_id?: string | null;
  stim_features?: Record<string, unknown> | null;
}

export interface CompiledStage {
  unit_label: string;
  op: "show" | "capture_response" | "wait_and_continue";
  phase?: string | null;
  when?: Resolvable<boolean>;
  stim_refs: Array<Resolvable<StimRef | StimSpec | null>>;
  duration?: Resolvable<number | number[] | null>;
  response_cfg?: ResponseConfig;
  context?: TrialContextSpec;
  state_patch?: Record<string, Resolvable<unknown>>;
  export_to_reduced: boolean;
  min_wait?: number;
}

export interface TrialFinalizeHelpers {
  setTrialState(key: string, value: unknown): void;
  getUnitState(unitLabel: string, key: string): unknown;
}

export type TrialFinalizer = (
  snapshot: TrialSnapshot,
  runtime: RuntimeView,
  helpers: TrialFinalizeHelpers
) => void;

export interface CompiledTrial {
  trial_id: number | string;
  block_id: string | null;
  trial_index: number;
  condition: string;
  units: CompiledStage[];
  trial_state: Record<string, unknown>;
  finalizers: TrialFinalizer[];
}

export interface RawStageRow {
  trial_id: number | string;
  block_id: string | null;
  trial_index: number;
  condition: string;
  condition_id: string | null;
  unit_label: string;
  phase: string | null;
  op: CompiledStage["op"];
  stim_id: string | null;
  deadline_s: number | null;
  valid_keys: string[] | null;
  onset_time: number;
  onset_time_global: number;
  close_time: number;
  close_time_global: number;
  duration: number;
  response: string | null;
  key_press: boolean;
  rt: number | null;
  response_time: number | null;
  response_time_global: number | null;
  hit: boolean | null;
  timeout_triggered: boolean;
  timeout_time: number | null;
  task_factors: Record<string, unknown> | null;
  extra_data: Record<string, unknown>;
}

export type ReducedTrialRow = Record<string, unknown>;

export interface ParsedConfig {
  raw: Record<string, unknown>;
  task_config: Record<string, unknown>;
  stim_config: Record<string, StimSpec>;
  subform_config: {
    subinfo_fields: Array<Record<string, unknown>>;
    subinfo_mapping: Record<string, string>;
  };
  trigger_config: Record<string, unknown>;
  controller_config: Record<string, unknown>;
}

export interface SubInfoField {
  name: string;
  type: "string" | "int" | "choice";
  constraints?: Record<string, unknown>;
  choices?: string[];
}
