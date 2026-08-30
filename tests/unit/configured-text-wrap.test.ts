import {expect,it} from 'vitest';
import PsyflowStagePlugin from '../../src/jspsych/PsyflowStagePlugin';

it('honors configured text wrap without half-stage shrink-fit and keeps explicit textbox width',async()=>{
  const display=document.createElement('div');display.className='psyflow-runtime-root';display.dataset.psyflowDefaultUnits='pix';document.body.appendChild(display);
  const plugin=new PsyflowStagePlugin({} as never);
  const pending=plugin.trial(display,{
    stage:{unit_label:'instruction',op:'show',phase:'instruction'},
    resolve_stage:()=>({context:{trial_id:'wrap',phase:'instruction'},duration:0.01,min_wait:0,stimuli:[
      {stim_id:'long_text',spec:{type:'text',text:'Long configured instruction',wrapWidth:1080,height:26}},
      {stim_id:'box',spec:{type:'textbox',text:'Explicit size',wrapWidth:1080,size:[500,80],letterHeight:26}},
      {stim_id:'left',spec:{type:'text',text:'Left option',wrapWidth:200,height:26,pos:[-200,0]}},
      {stim_id:'right',spec:{type:'text',text:'Right option',wrapWidth:200,height:26,pos:[200,0]}}
    ]})
  } as never);
  const text=display.querySelector<HTMLElement>('.psyflow-stage-text');
  const box=display.querySelector<HTMLElement>('.psyflow-stage-textbox');
  expect(text?.style.width).toBe('max-content');
  expect(text?.style.maxWidth).toBe('min(1080px, 90%)');
  expect(box?.style.width).toBe('500px');
  const labels=display.querySelectorAll<HTMLElement>('.psyflow-stage-text');
  expect(labels[1].style.left).toBe('calc(50% - 200px)');
  expect(labels[2].style.left).toBe('calc(50% + 200px)');
  expect(labels[1].style.maxWidth).toBe('min(200px, 90%)');
  await pending;display.remove();
});
