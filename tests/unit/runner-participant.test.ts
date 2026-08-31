import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {entry,load}=vi.hoisted(()=>{
 const load=vi.fn(async()=>({main:(root:HTMLElement)=>{root.textContent='Neutral line judgment';document.title='Line judgment';}}));
 return {load,entry:{directory:'H000136-inattentional-blindness-task',id:'H000136',slug:'inattentional-blindness-task',title:'Inattentional Blindness Task',importTask:load}};
});
vi.mock('../../src/generated/taskManifest',()=>({taskEntries:[entry],taskManifest:{[entry.directory]:entry}}));
beforeEach(()=>{vi.resetModules();document.body.innerHTML='<div id="app"></div>';load.mockClear();});
afterEach(()=>{window.history.replaceState({},'','/');});
describe('participant runner surface',()=>{
 it('keeps the default researcher launcher',async()=>{
  window.history.replaceState({},'','/?task=H000136');await import('../../src/runner');await vi.waitFor(()=>expect(load).toHaveBeenCalledOnce());
  expect(document.body.textContent).toContain('Inattentional Blindness Task');expect(document.querySelector('select[name=task]')).not.toBeNull();
 });
 it('hides researcher names for existing numeric ID alias',async()=>{
  window.history.replaceState({},'','/?task=H000136&participant=1');await import('../../src/runner');await vi.waitFor(()=>expect(document.body.textContent).toContain('Neutral line judgment'));
  expect(document.querySelector('select[name=task]')).toBeNull();expect(document.body.textContent).not.toContain('inattentional');expect(document.body.textContent).not.toContain('Blindness');
 });
 it('does not expose title while module is still loading',async()=>{
  let finish!:(value:{main:(root:HTMLElement)=>void})=>void;load.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  window.history.replaceState({},'','/?task=H000136&participant=1');await import('../../src/runner');
  expect(document.title).toBe('Task');expect(document.body.textContent).not.toContain('Blindness');
  finish({main:root=>{root.textContent='Finished loading';document.title='Neutral';}});await vi.waitFor(()=>expect(document.body.textContent).toContain('Finished loading'));
 });
 it('shows a neutral error without listing catalogue names for invalid selection',async()=>{
  window.history.replaceState({},'','/?task=missing&participant=1');await import('../../src/runner');
  expect(document.body.textContent).toContain('valid participant link');expect(document.body.textContent).not.toContain('Blindness');expect(load).not.toHaveBeenCalled();
 });
 it('does not opt in for other query values',async()=>{
  window.history.replaceState({},'','/?task=H000136&participant=0');await import('../../src/runner');expect(document.querySelector('select[name=task]')).not.toBeNull();
 });
 it('requires an explicit task even when catalogue contains only one entry',async()=>{
  window.history.replaceState({},'','/?participant=1');await import('../../src/runner');expect(document.body.textContent).toContain('valid participant link');expect(load).not.toHaveBeenCalled();
 });
 it('keeps loading errors readable without task-name disclosure',async()=>{
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});load.mockRejectedValueOnce(new Error('Inattentional secret source failed'));
  window.history.replaceState({},'','/?task=H000136&participant=1');await import('../../src/runner');await vi.waitFor(()=>expect(document.body.textContent).toContain('contact the researcher'));
  expect(document.body.textContent).not.toContain('Inattentional');spy.mockRestore();
 });
});
