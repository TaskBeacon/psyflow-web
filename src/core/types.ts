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
  | GratingStimSpec
  | AnaglyphGratingStimSpec
  | SoundStimSpec
  | SpeechStimSpec;

interface BaseStimSpec {
  type: string;
  pos?: [number, number];
  color?: string;
  units?: string;
  ori?: number;
}

export interface GratingStimSpec extends BaseStimSpec {
  type: 'grating'; units: 'pix'; tex: 'sin'; mask: 'gauss';
  size: [number, number]; sf: number; phase: number | [number, number];
  contrast: number; maskParams: {sd: number};
}

export interface TextStimSpec extends BaseStimSpec {
  type: "text";
  text: string;
  height?: number;
  font?: string;
  alignment?: "left" | "center" | "right";
  dynamic_text?: {
    mode: "elapsed_ms";
    digits?: number;
    suffix?: string;
  };
}

export interface TextBoxStimSpec extends BaseStimSpec {
  type: "textbox";
  text: string;
  editable?: boolean;
  /** Opt in to a wrapping textarea; editable textboxes remain single-line by default. */
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  size?: [number, number];
  letterHeight?: number;
  font?: string;
  alignment?: "left" | "center" | "right";
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface CircleStimSpec extends BaseStimSpec {
  type: "circle";
  radius: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
}

export interface RectStimSpec extends BaseStimSpec {
  type: "rect";
  width: number;
  height: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
}

export interface PolygonStimSpec extends BaseStimSpec {
  type: "polygon";
  edges: number;
  size: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
}

export interface ShapeStimSpec extends BaseStimSpec {
  type: "shape";
  vertices: Array<[number, number]>;
  size: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
}

export interface ImageStimSpec extends BaseStimSpec {
  type: "image";
  image: string;
  size?: [number, number];
  /** Preserve aspect ratio by default; fill honors separately calibrated axes. */
  objectFit?: "contain" | "fill";
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

export interface AnaglyphGratingStimSpec extends BaseStimSpec {
  type: "anaglyph_grating";
  red_orientation_deg: number;
  cyan_orientation_deg: number;
  aperture_diameter_deg: number;
  spatial_frequency_cpd: number;
  contrast: number;
  red_gain?: number;
  cyan_gain?: number;
  texture_resolution?: number;
  fusion_frame_span_deg: number;
  fusion_frame_width_deg: number;
  fixation_diameter_deg: number;
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
  correct_keys?: Resolvable<string[] | string | undefined>;
  terminate_on_response?: boolean;
  count_responses?: boolean;
  grace_s?: number;
  response_trigger?: Resolvable<number | Record<string, number> | null>;
  timeout_trigger?: Resolvable<number | null>;
}

export interface PointerSequenceConfig {
  targets: Record<string, Resolvable<StimRef | StimSpec>>;
  max_selections: number;
  selection_trigger?: Resolvable<number | Record<string, number> | null>;
  complete_trigger?: Resolvable<number | null>;
  timeout_trigger?: Resolvable<number | null>;
  highlight_color?: string;
  highlight_duration_s?: number;
}

export type PointerTraceTransform = "identity" | "mirror_x";

export interface PointerPursuitConfig {
  orbit_radius: number;
  target_radius: number;
  rotations_per_second: number;
  max_gap_s: number;
  target_color?: string;
  cursor_color?: string;
  cursor_radius?: number;
  offset_trigger?: number | null;
}

export interface PointerTraceConfig {
  path_points: Array<[number, number]>;
  corridor_width: number;
  transform: PointerTraceTransform;
  finish_radius: number;
  completion_progress: number;
  start_trigger?: Resolvable<number | null>;
  error_trigger?: Resolvable<number | null>;
  complete_trigger?: Resolvable<number | null>;
  timeout_trigger?: Resolvable<number | null>;
  trail_color?: string;
  trail_line_width?: number;
  cursor_color?: string;
  error_cursor_color?: string;
  cursor_radius?: number;
}

export interface PointerReachConfig {
  start: Resolvable<StimRef | StimSpec>;
  target: Resolvable<StimRef | StimSpec>;
  cursor: Resolvable<StimRef | StimSpec>;
  target_position: [number, number];
  target_distance: number;
  start_radius: number;
  target_radius: number;
  search_visibility_radius: number;
  start_hold_duration: number;
  movement_deadline: number;
  reaction_threshold: number;
  feedback_mode: "veridical" | "rotated" | "none";
  rotation_deg: number;
  endpoint_freeze_duration: number;
  hold_trigger?: Resolvable<number | null>;
  target_trigger?: Resolvable<number | null>;
  movement_trigger?: Resolvable<number | null>;
  complete_trigger?: Resolvable<number | null>;
  hit_trigger?: Resolvable<number | null>;
  timeout_trigger?: Resolvable<number | null>;
}

export interface TrialContextSpec {
  trial_id?: number | string;
  phase?: string;
  deadline_s?: number | number[] | null;
  valid_keys?: string[];
  block_id?: string | null;
  condition_id?: string | null;
  task_factors?: Record<string, unknown>;
  stim_id?: Resolvable<string | null>;
  stim_features?: Record<string, unknown> | null;
}

export interface CompiledStage {
  unit_label: string;
  op: "show" | "capture_response" | "capture_pointer_sequence" | "capture_pointer_trace" | "capture_pointer_reach" | "capture_pointer_pursuit" | "wait_and_continue";
  phase?: string | null;
  onset_trigger?: Resolvable<number | null>;
  when?: Resolvable<boolean>;
  stim_refs: Array<Resolvable<StimRef | StimSpec | null>>;
  duration?: Resolvable<number | number[] | null>;
  phase_drift_hz?: number;
  response_cfg?: ResponseConfig;
  pointer_cfg?: PointerSequenceConfig;
  pointer_trace_cfg?: PointerTraceConfig;
  pointer_reach_cfg?: PointerReachConfig;
  pointer_pursuit_cfg?: PointerPursuitConfig;
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
  omit_if_empty?: boolean;
  exclude_from_reduced?: boolean;
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
  /** Same-page performance clock seconds, absent from legacy/synthetic rows. */
  onset_time_monotonic_s?: number;
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
