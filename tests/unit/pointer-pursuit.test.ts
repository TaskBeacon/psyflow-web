import {describe,it,expect,vi,afterEach} from "vitest";
import {PSYFLOW_ABORT_EVENT} from "../../src/jspsych/sessionEvents";
import {evaluatePointerPursuit,pursuitPosition,type PursuitSample} from "../../src/core/pointerPursuit";
import PsyflowStagePlugin from "../../src/jspsych/PsyflowStagePlugin";
import {startPointerPursuit} from "../../src/jspsych/pointerPursuitSurface";
const sample=(t:number,error=0,valid=true,epoch=0):PursuitSample=>({t,target_command_time:t,cursor_sample_time:t,target:[0,0],cursor:valid?[error,0]:null,valid,reason:valid?null:"blur",epoch});
describe('time-weighted pursuit',()=>{
  it('weights unequal intervals, not sample mean',()=>{const r=evaluatePointerPursuit([sample(0),sample(.01,20),sample(.1)],.1,5);expect(r.on_target_proportion).toBeCloseTo(.1);expect(r.rms_error).toBeCloseTo(Math.sqrt(360));});
  it('marks long gaps missing and preserves two denominators',()=>{const r=evaluatePointerPursuit([sample(0),sample(.01),sample(.5),sample(.51)],1,5);expect(r.coverage).toBeCloseTo(.02);expect(r.observed_on_target_proportion).toBe(1);});
  it('requires both valid endpoints and same epoch',()=>{expect(evaluatePointerPursuit([sample(0),sample(.01,0,true,1),sample(.02,0,true,1)],.02,5).coverage).toBeCloseTo(.5);});
  it('does not invent initial/terminal observation',()=>{expect(evaluatePointerPursuit([sample(.02),sample(.07),sample(.12)],.1,5).coverage).toBeCloseTo(.8);expect(evaluatePointerPursuit([],1,5).rms_error).toBeNull();});
  it('rejects duplicate times and overflow',()=>{expect(()=>evaluatePointerPursuit([sample(0),sample(0)],1,5)).toThrow();expect(()=>evaluatePointerPursuit([{...sample(0),cursor:[1e308,0],target:[-1e308,0]},sample(.1)],.1,5)).toThrow();});
  for(const hz of [30,60,120,144])it(`stationary pointer sampled at ${hz}Hz`,()=>{const samples=Array.from({length:hz+1},(_,i)=>({...sample(i/hz),target:pursuitPosition(i/hz,253,.13)}));const r=evaluatePointerPursuit(samples,1,25);expect(r.coverage).toBeCloseTo(1);expect(r.rms_error).toBeCloseTo(253);expect(r.on_target_proportion).toBe(0);});
});
function surface(){const root=document.createElement('div');document.body.appendChild(root);vi.spyOn(root,'getBoundingClientRect').mockReturnValue({width:1000,height:800,left:0,top:0,right:1000,bottom:800,x:0,y:0,toJSON(){return {};}});vi.spyOn(document,'hasFocus').mockReturnValue(true);return root;}
const geometry={orbit_radius:253,target_radius:25,rotations_per_second:.13,max_gap_s:.1};
afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});
function move(root:HTMLElement,x:number,y:number){const e=new MouseEvent('pointermove',{clientX:x,clientY:y,bubbles:true});Object.defineProperty(e,'pointerType',{value:'mouse'});root.dispatchEvent(e);}
describe('actual DOM pursuit surface',()=>{
  it('restores styles, removes only its own SVG and stop is idempotent',async()=>{
    const root=surface();root.style.cursor='crosshair';root.style.touchAction='pan-x';const own=document.createElement('span');root.appendChild(own);
    const capture=startPointerPursuit(root,geometry,1,performance.now(),()=>{});move(root,500,400);await new Promise(r=>setTimeout(r,25));
    const result=capture.stop();expect(capture.stop()).toBe(result);expect(root.style.cursor).toBe('crosshair');expect(root.style.touchAction).toBe('pan-x');expect(root.querySelector('svg')).toBeNull();expect(root.contains(own)).toBe(true);
  });
  it('abort event returns partial observations, no false completion and removes listeners',async()=>{
    const display=surface();vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(display.getBoundingClientRect());
    const remove=vi.spyOn(display,'removeEventListener');const plugin=new PsyflowStagePlugin({} as never);
    const promise=plugin.trial(display,{stage:{unit_label:'tracking',op:'capture_pointer_pursuit'},resolve_stage:()=>({context:{trial_id:1},duration:1,min_wait:0,stimuli:[],pointer_pursuit_cfg:geometry})} as never);
    const stage=display.querySelector<HTMLElement>('.psyflow-stage')!;move(stage,500,400);await new Promise(r=>setTimeout(r,35));display.dispatchEvent(new CustomEvent(PSYFLOW_ABORT_EVENT));
    const r=await promise;expect(r.pursuit?.completed).toBe(false);expect(r.pursuit?.aborted).toBe(true);expect(r.pursuit?.sample_count).toBeGreaterThan(1);expect(r.pursuit?.actual_elapsed).toBeLessThan(1);expect(r.pursuit?.coverage).toBeLessThan(.5);expect(stage.querySelector('svg')).toBeNull();expect(remove.mock.calls.some(c=>c[0]===PSYFLOW_ABORT_EVENT)).toBe(true);
  });
  it('plugin geometry rejection cleans its abort listener',async()=>{
    const display=document.createElement('div');document.body.appendChild(display);const remove=vi.spyOn(display,'removeEventListener');const plugin=new PsyflowStagePlugin({} as never);
    await expect(plugin.trial(display,{stage:{unit_label:'tracking',op:'capture_pointer_pursuit'},resolve_stage:()=>({context:{trial_id:1},duration:1,min_wait:0,stimuli:[],pointer_pursuit_cfg:geometry})} as never)).rejects.toThrow(/small/);
    expect(remove.mock.calls.some(c=>c[0]===PSYFLOW_ABORT_EVENT)).toBe(true);expect(display.querySelector('svg')).toBeNull();
  });
  it('samples stationary mouse and retains invalidation epochs, then cleans up',async()=>{const root=surface();const capture=startPointerPursuit(root,geometry,.15,performance.now(),()=>{});move(root,500,400);await new Promise(r=>setTimeout(r,40));window.dispatchEvent(new Event('blur'));move(root,500,400);await new Promise(r=>setTimeout(r,45));const result=capture.stop();expect(result.sample_count).toBeGreaterThan(2);expect(result.on_target_proportion).toBe(0);expect(result.pursuit_events[0].reason).toBe('blur');expect(result.pursuit_samples.some(s=>s.epoch===1)).toBe(true);const count=result.pursuit_samples.length;move(root,500,147);await new Promise(r=>setTimeout(r,25));expect(result.pursuit_samples.length).toBe(count);root.remove();});
  it('does not accept touch as mouse or fabricate unknown cursor',async()=>{const root=surface();const capture=startPointerPursuit(root,geometry,.1,performance.now(),()=>{});root.dispatchEvent(new MouseEvent('pointermove',{bubbles:true}));await new Promise(r=>setTimeout(r,25));const r=capture.stop();expect(r.coverage).toBe(0);expect(r.rms_error).toBeNull();root.remove();});
  it('fails closed for insufficient geometry',()=>{const root=document.createElement('div');expect(()=>startPointerPursuit(root,geometry,1,performance.now(),()=>{})).toThrow(/small/);});
  it('runs real plugin pointer operation and emits samples',async()=>{const display=surface();const rect=display.getBoundingClientRect();const spy=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(rect);const plugin=new PsyflowStagePlugin({} as never);const promise=plugin.trial(display,{stage:{unit_label:'tracking',op:'capture_pointer_pursuit'},resolve_stage:()=>({context:{trial_id:1},duration:.08,min_wait:0,stimuli:[],pointer_pursuit_cfg:geometry})} as never);const stage=display.querySelector<HTMLElement>('.psyflow-stage')!;move(stage,500,400);const result=await promise;expect(result.pursuit?.sample_count).toBeGreaterThan(2);expect(result.pursuit?.rms_error).toBeCloseTo(253);spy.mockRestore();display.remove();});
});
