import {evaluatePointerPursuit,pursuitPosition,validatePursuit,type PursuitGeometry,type PursuitPoint,type PursuitSample,type PursuitMetrics} from "../core/pointerPursuit";

export interface PursuitSurfaceResult extends PursuitMetrics {
  pursuit_samples:PursuitSample[];pursuit_events:Array<{t:number;reason:string;epoch:number}>;
  actual_elapsed:number;synthetic_input:boolean;coordinate_units:string;
  surface_width:number;surface_height:number;sampling_policy:string;
}

/** Opt-in fixed-CSS-pixel pursuit surface. Uses real elapsed time, never frame index.
 * rAF/DOM command times are software presentation times, not photon timestamps. */
export function startPointerPursuit(root: HTMLElement,config: PursuitGeometry,duration: number,start: number,onComplete: ()=>void) {
  validatePursuit(config,duration);
  const bounds=root.getBoundingClientRect();
  const width=bounds.width,height=bounds.height;
  const extent=config.orbit_radius+config.target_radius+10;
  if(width<2*extent || height<2*extent) throw new Error("Pursuit surface too small for fixed pixel geometry");
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.dataset.psyflowPursuitSurface="true";
  svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
  Object.assign(svg.style,{position:"absolute",inset:"0",width:"100%",height:"100%",pointerEvents:"none"});
  function circle(name:string,radius:number,color:string) {
    const el=document.createElementNS(svg.namespaceURI,"circle");
    el.setAttribute("r",String(radius));el.setAttribute("fill",color);
    el.setAttribute("data-psyflow-pursuit-"+name,"true");svg.appendChild(el);return el;
  }
  const target=circle("target",config.target_radius,config.target_color ?? "#ef4444");
  const cursor=circle("cursor",config.cursor_radius ?? 3,config.cursor_color ?? "white");
  cursor.setAttribute("visibility","hidden");root.appendChild(svg);
  const originalCursor=root.style.cursor,originalTouch=root.style.touchAction;root.style.cursor="none";root.style.touchAction="none";
  let result:PursuitSurfaceResult|null=null;
  const samples:PursuitSample[]=[];
  const events:Array<{t:number;reason:string;epoch:number}>=[];
  let point:PursuitPoint|null=null,pointerTime:number|null=null,valid=false,reason:string|null="awaiting_mouse_motion",epoch=0;
  let resized=false,stopped=false,raf=0,commandTime=0;
  let commanded=pursuitPosition(0,config.orbit_radius,config.rotations_per_second);
  const now=()=>Math.max(0,(performance.now()-start)/1000);
  const setPosition=(el:Element,p:PursuitPoint)=>{el.setAttribute("cx",String(width/2+p[0]));el.setAttribute("cy",String(height/2-p[1]));};
  setPosition(target,commanded);
  function invalidate(why:string) { valid=false;reason=why;epoch++;events.push({t:now(),reason:why,epoch}); }
  function move(event:PointerEvent) {
    if(event.pointerType!=="mouse") {invalidate("non_mouse_pointer");return;}
    if(resized || document.hidden || !document.hasFocus())return;
    const b=root.getBoundingClientRect();
    if(b.width!==width || b.height!==height || b.left!==bounds.left || b.top!==bounds.top) {resize();return;}
    const x=event.clientX-b.left,y=event.clientY-b.top;
    if(x<0 || y<0 || x>width || y>height){invalidate("outside_surface");return;}
    point=[x-width/2,height/2-y];pointerTime=now();valid=true;reason=null;
  }
  const leave=()=>invalidate("pointerleave");
  const blur=()=>invalidate("blur");
  const visibility=()=>{if(document.hidden)invalidate("hidden");};
  function resize(){if(!resized){resized=true;invalidate("resize");}}
  function sample(t:number) {
    const b=root.getBoundingClientRect();
    if(b.width!==width || b.height!==height || b.left!==bounds.left || b.top!==bounds.top)resize();
    if(document.hidden && valid)invalidate("hidden");
    if(!document.hasFocus() && valid)invalidate("blur");
    if(!samples.length || t>samples[samples.length-1].t)
      samples.push({t,target_command_time:commandTime,cursor_sample_time:pointerTime,target:[...commanded],cursor:valid&&point?[...point]:null,valid,reason,epoch});
  }
  function frame(timestamp:number) {
    if(stopped)return;
    commandTime=Math.max(0,(timestamp-start)/1000);
    commanded=pursuitPosition(commandTime,config.orbit_radius,config.rotations_per_second);
    setPosition(target,commanded);
    if(valid&&point){setPosition(cursor,point);cursor.setAttribute("visibility","visible");}
    else cursor.setAttribute("visibility","hidden");
    sample(now());
    if(now()>=duration){onComplete();return;}
    raf=requestAnimationFrame(frame);
  }
  root.addEventListener("pointermove",move,true);root.addEventListener("pointerleave",leave,true);
  root.addEventListener("pointercancel",leave,true);window.addEventListener("blur",blur);
  document.addEventListener("visibilitychange",visibility);window.addEventListener("resize",resize);
  raf=requestAnimationFrame(frame);
  // Ensures a hidden/background tab still ends. Final sample observes the last
  // commanded display, not an invented catch-up motion or interpolated cursor.
  const timeout=window.setTimeout(onComplete,duration*1000);
  return {stop() {
    if(result)return result;
    if(!stopped)sample(now());
    stopped=true;cancelAnimationFrame(raf);window.clearTimeout(timeout);
    root.removeEventListener("pointermove",move,true);root.removeEventListener("pointerleave",leave,true);
    root.removeEventListener("pointercancel",leave,true);window.removeEventListener("blur",blur);
    document.removeEventListener("visibilitychange",visibility);window.removeEventListener("resize",resize);
    root.style.cursor=originalCursor;root.style.touchAction=originalTouch;svg.remove();
    result={ ...evaluatePointerPursuit(samples,duration,config.target_radius,config.max_gap_s),pursuit_samples:samples,
      pursuit_events:events,actual_elapsed:now(),synthetic_input:false,coordinate_units:"software_px",
      surface_width:width,surface_height:height,sampling_policy:"per_animation_update_elapsed_time"};
    return result;
  }};
}
