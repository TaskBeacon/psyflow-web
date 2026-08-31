export type PursuitPoint = [number, number];
export interface PursuitSample {
  t: number; target_command_time: number; cursor_sample_time: number | null;
  target: PursuitPoint; cursor: PursuitPoint | null; valid: boolean;
  reason: string | null; epoch: number;
}
export interface PursuitGeometry {
  orbit_radius: number; target_radius: number; rotations_per_second: number; max_gap_s: number;
  target_color?: string; cursor_color?: string; cursor_radius?: number;
}
export function validatePursuit(config: PursuitGeometry, duration: number): void {
  if ([config.orbit_radius,config.target_radius,config.rotations_per_second,config.max_gap_s,duration]
    .some(x => !Number.isFinite(x) || x <= 0)) throw new Error("Pursuit geometry, duration and gap must be finite positive");
}
export function pursuitPosition(t: number, radius: number, speed: number): PursuitPoint {
  const angle=2*Math.PI*speed*t;
  return [radius*Math.sin(angle),radius*Math.cos(angle)];
}
export function evaluatePointerPursuit(samples: PursuitSample[], duration: number, targetRadius: number, maxGap=0.1) {
  validatePursuit({orbit_radius:1,target_radius:targetRadius,rotations_per_second:1,max_gap_s:maxGap},duration);
  let last=-1;
  const reasons: Record<string,number>={};
  for (const sample of samples) {
    if (!Number.isFinite(sample.t) || sample.t<0 || sample.t<=last) throw new Error("Pursuit sample times must be strictly increasing");
    last=sample.t;
    if (sample.valid) {
      if (!sample.cursor || [sample.cursor,sample.target].some(p=>p.length!==2 || p.some(x=>!Number.isFinite(x))))
        throw new Error("Valid pursuit sample needs finite coordinates");
    } else { const reason=sample.reason || "unknown"; reasons[reason]=(reasons[reason] || 0)+1; }
  }
  let observed=0,onTarget=0,squared=0,maxGapObserved=0;
  for(let i=1;i<samples.length;i++) {
    const a=samples[i-1],b=samples[i],gap=b.t-a.t;
    maxGapObserved=Math.max(maxGapObserved,gap);
    const dt=Math.max(0,Math.min(duration,b.t)-Math.min(duration,a.t));
    if(gap>maxGap+1e-10 || !a.valid || !b.valid || a.epoch!==b.epoch) continue;
    const error=Math.hypot(a.cursor![0]-a.target[0],a.cursor![1]-a.target[1]);
    if(!Number.isFinite(error) || !Number.isFinite(error*error*dt)) throw new Error("Pursuit weighted error overflow");
    observed+=dt;onTarget+=error<=targetRadius?dt:0;squared+=error*error*dt;
    if(!Number.isFinite(squared)) throw new Error("Pursuit weighted error accumulator overflow");
  }
  observed=Math.min(duration,observed);
  return {observed_duration:observed,missing_duration:Math.max(0,duration-observed),on_target_duration:onTarget,
    on_target_proportion:onTarget/duration,observed_on_target_proportion:observed>0?onTarget/observed:null,
    rms_error:observed>0?Math.sqrt(squared/observed):null,coverage:observed/duration,max_gap:maxGapObserved,
    sample_count:samples.length,invalid_sample_reasons:reasons,integration_method:"left_hold_valid_endpoints_v1"};
}
export type PursuitMetrics = ReturnType<typeof evaluatePointerPursuit>;
