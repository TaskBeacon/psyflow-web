import {expect,it} from 'vitest';
import PsyflowStagePlugin from '../../src/jspsych/PsyflowStagePlugin';

it('keeps image contain default and permits independently calibrated fill axes',async()=>{
  const display=document.createElement('div');display.className='psyflow-runtime-root';
  display.dataset.psyflowDefaultUnits='pix';document.body.appendChild(display);
  const plugin=new PsyflowStagePlugin({} as never);
  const pending=plugin.trial(display,{
    stage:{unit_label:'images',op:'show',phase:'array'},
    resolve_stage:()=>({context:{trial_id:'image-fit',phase:'array'},duration:.01,min_wait:0,stimuli:[
      {stim_id:'default',spec:{type:'image',image:'data:image/png;base64,',size:[120,80]}},
      {stim_id:'calibrated',spec:{type:'image',image:'data:image/png;base64,',size:[120,80],objectFit:'fill',pos:[90,0]}},
      {stim_id:'explicit',spec:{type:'image',image:'data:image/png;base64,',size:[120,80],objectFit:'contain'}}
    ]})
  } as never);
  const images=display.querySelectorAll<HTMLImageElement>('img');
  expect(images).toHaveLength(3);
  expect(images[0].style.objectFit).toBe('');
  expect(getComputedStyle(images[0]).objectFit).toBe('contain');
  expect(images[1].style.objectFit).toBe('fill');
  expect(images[2].style.objectFit).toBe('contain');
  for(const image of images){expect(image.style.width).toBe('120px');expect(image.style.height).toBe('80px');}
  expect(images[1].style.left).toBe('calc(50% + 90px)');
  await pending;display.remove();
});
