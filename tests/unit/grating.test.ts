import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createGrating} from '../../src/jspsych/grating';
import type {GratingStimSpec} from '../../src/core/types';
import PsyflowStagePlugin from '../../src/jspsych/PsyflowStagePlugin';
import {runPsyflowExperiment} from '../../src/jspsych/runtime';
import {StimBank} from '../../src/core/StimBank';
import {TrialBuilder} from '../../src/core/TrialBuilder';
import {PSYFLOW_ABORT_EVENT} from '../../src/jspsych/sessionEvents';

const spec:GratingStimSpec={type:'grating',units:'pix',tex:'sin',mask:'gauss',size:[256,256],sf:1/32,phase:[.25,.37],contrast:.4,maskParams:{sd:5}};
const drawn:Uint8ClampedArray[]=[];
beforeEach(()=>{
  drawn.length=0;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>({
    createImageData:(w:number,h:number)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
    putImageData:(im:ImageData)=>drawn.push(im.data.slice()),
  }) as never);
});
afterEach(()=>{vi.restoreAllMocks();document.body.innerHTML='';});

describe('pixel Gabor stimulus',()=>{
  it.each([0,.25,.5,.75])('matches independent carrier and Gaussian at phase%f',phase=>{
    const surface=createGrating(document.createElement('canvas'),{...spec,phase});
    const pixels=drawn.at(-1)!;
    for(const [x,y] of [[0,0],[127,127],[152,127],[64,64],[255,255]]){
      const dx=x+.5-128,dy=y+.5-128;const i=(y*256+x)*4;
      expect(pixels[i]).toBe(Math.round(127.5*(1+.4*Math.cos(2*Math.PI*(dx/32-phase)))));
      expect(pixels[i+3]).toBe(Math.round(255*Math.exp(-(dx*dx+dy*dy)/(2*25.6**2))));
    }
    expect(surface.phase).toEqual([phase,0]);
  });
  it('changes carrier phase without changing mask and preserves y phase',()=>{
    const surface=createGrating(document.createElement('canvas'),spec);surface.draw([.5,.37]);
    expect(surface.phase).toEqual([.5,.37]);
    expect(drawn[0].filter((_,i)=>i%4===3)).toEqual(drawn[1].filter((_,i)=>i%4===3));
  });
  it('rejects unsupported geometry and nonfinite phase',()=>{
    expect(()=>createGrating(document.createElement('canvas'),{...spec,sf:NaN})).toThrow();
    expect(()=>createGrating(document.createElement('canvas'),{...spec,ori:90})).toThrow();
    expect(()=>createGrating(document.createElement('canvas'),{...spec,ori:NaN})).toThrow();
    expect(()=>createGrating(document.createElement('canvas'),{...spec,phase:Infinity})).toThrow();
    for(const phase of [[],[0],[0,0,0]]) {
      expect(()=>createGrating(document.createElement('canvas'),{...spec,phase} as GratingStimSpec)).toThrow();
    }
  });
  it('updates all gratings from a common stage clock and preserves partial abort evidence',async()=>{
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    let callback:FrameRequestCallback|undefined;
    vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{callback=cb;return 1;});
    const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
    const display=document.createElement('div');document.body.appendChild(display);
    const plugin=new PsyflowStagePlugin({} as never);
    const pending=plugin.trial(display,{stage:{unit_label:'adapt',op:'show',phase_drift_hz:-4},resolve_stage:()=>({
      context:{},duration:30,min_wait:0,stimuli:[{stim_id:'a',spec},{stim_id:'b',spec:{...spec,pos:[128,0]}}]
    })} as never);
    clock=1030;callback!(clock);clock=1070;callback!(clock);
    clock=1100;
    display.dispatchEvent(new CustomEvent(PSYFLOW_ABORT_EVENT,{detail:{reason:'test'}}));
    const result=await pending;const evidence=result.drift_evidence!;
    expect(evidence.drift_phase_shifts_cycles).toEqual([0,-.12,-.28]);
    expect(evidence.drift_final_phases).toEqual([[-.030000000000000027,.37],[-.030000000000000027,.37]]);
    expect(evidence.drift_frame_count).toBe(3);expect(cancel).toHaveBeenCalled();
    expect(evidence.drift_stage_close_elapsed_s).toBeCloseTo(.1);
    expect(evidence.drift_last_sample_to_close_s).toBeCloseTo(.03);
  });
  it('exports drift samples in real raw/reduced plumbing and default show remains static',async()=>{
    const display=document.createElement('div');document.body.appendChild(display);
    const trial=new TrialBuilder({trial_id:1,block_id:'gabor',trial_index:0,condition:'right'});
    const bank=new StimBank({gabor:spec});
    trial.unit('adapt').addStim(bank.get('gabor')).show({duration:.045,phase_drift_hz:4}).to_dict();
    trial.unit('static').addStim(bank.get('gabor')).show({duration:.01}).to_dict();
    const result=await runPsyflowExperiment({display_element:display,stimBank:bank,trials:[trial.build()]});
    expect(result.reduced_rows[0].adapt_drift_frame_count).toBeGreaterThan(1);
    expect(result.reduced_rows[0].static_drift_frame_count).toBeUndefined();
    const raw=JSON.parse(result.raw_jsonl.split('\n')[0]);
    expect(raw.extra_data.drift_frequency_hz).toBe(4);
  });
  it('forceQuit retains completed rows and an incomplete stage stub, cancelling animation',async()=>{
    const display=document.createElement('div');document.body.appendChild(display);
    const trial=new TrialBuilder({trial_id:1,block_id:'gabor',trial_index:0,condition:'right'});
    const bank=new StimBank({gabor:spec});
    const completed=new TrialBuilder({trial_id:0,block_id:'gabor',trial_index:0,condition:'completed'});
    completed.unit('baseline').addStim(bank.get('gabor')).show({duration:.005}).to_dict();
    trial.unit('adapt').addStim(bank.get('gabor')).show({duration:30,phase_drift_hz:4}).to_dict();
    trial.unit('never_reached').addStim(bank.get('gabor')).show({duration:1}).to_dict();
    const result=await runPsyflowExperiment({display_element:display,stimBank:bank,trials:[completed.build(),trial.build()],
      onSessionStart:session=>window.setTimeout(()=>session.forceQuit('test_abort'),120)});
    expect(result.aborted).toBe(true);expect(result.abort_reason).toBe('test_abort');
    expect(result.raw_rows).toHaveLength(2);
    expect(result.reduced_rows).toHaveLength(1);
    expect(result.reduced_rows[0].trial_id).toBe(0);
    const partial=JSON.parse(result.raw_jsonl.trim().split('\n')[1]);
    expect(partial.unit_label).toBe('adapt');
    // Existing jsPsych forceQuit records a stub, not the pending plugin's
    // full timing result. Do not interpret an aborted stage as valid motion.
    expect(partial.extra_data.drift_frame_count).toBeUndefined();
    expect(result.raw_rows.map(row=>row.unit_label)).toEqual(['baseline','adapt']);
    const drawCount=drawn.length;
    await new Promise(resolve=>window.setTimeout(resolve,40));
    expect(drawn.length).toBe(drawCount);
  });
});
