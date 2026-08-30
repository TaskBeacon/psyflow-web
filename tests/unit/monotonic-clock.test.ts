import {describe,expect,it,vi} from 'vitest';
import PsyflowStagePlugin from '../../src/jspsych/PsyflowStagePlugin';
import {runPsyflowExperiment} from '../../src/jspsych/runtime';
import {TrialBuilder} from '../../src/core/TrialBuilder';
import {StimBank} from '../../src/core/StimBank';

describe('cross-stage monotonic onset',()=>{
  it('preserves the onset in public raw and reduced exports',async()=>{
    const display=document.createElement('div');document.body.appendChild(display);
    const trial=new TrialBuilder({trial_id:1,block_id:'clock',trial_index:0,condition:'clock'});
    trial.unit('sample').show({duration:.01}).to_dict();
    try {
      const result=await runPsyflowExperiment({display_element:display,stimBank:new StimBank({}),trials:[trial.build()]});
      const raw=JSON.parse(result.raw_jsonl.trim());
      const reduced=JSON.parse(result.reduced_json)[0];
      expect(raw.onset_time_monotonic_s).toBeGreaterThan(0);
      expect(reduced.sample_onset_time_monotonic_s).toBe(raw.onset_time_monotonic_s);
      expect(raw.onset_time_global).toBeGreaterThan(1000000000);
    } finally {display.remove();}
  });
  it('keeps response-to-response intervals stable when the wall clock jumps',async()=>{
    let clock=1000;
    const perf=vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const epoch=vi.spyOn(Date,'now').mockReturnValue(100000);
    const display=document.createElement('div');document.body.appendChild(display);
    const plugin=new PsyflowStagePlugin({} as never);
    const run=()=>plugin.trial(display,{
      stage:{unit_label:'response',op:'capture_response',phase:'response'},
      resolve_stage:()=>({context:{trial_id:1,phase:'response',valid_keys:['space'],deadline_s:2},duration:2,min_wait:0,
        response_cfg:{keys:['space'],terminate_on_response:true},stimuli:[]})
    } as never);
    try {
      const firstPromise=run();clock=1250;
      window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));
      const first=await firstPromise;
      clock=2000;epoch.mockReturnValue(10000000);
      const secondPromise=run();clock=2250;
      window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));
      const second=await secondPromise;
      expect(first.onset_time_monotonic_s).toBe(1);expect(second.onset_time_monotonic_s).toBe(2);
      expect(first.rt).toBe(.25);expect(second.rt).toBe(.25);
      expect((second.onset_time_monotonic_s!+second.rt!)-(first.onset_time_monotonic_s!+first.rt!)).toBe(1);
      expect(second.onset_time_global-first.onset_time_global).toBe(9900);
      expect(first.response).toBe('space');expect(first.timeout_triggered).toBe(false);
    } finally {perf.mockRestore();epoch.mockRestore();display.remove();}
  });
});
