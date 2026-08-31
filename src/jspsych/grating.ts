import type { GratingStimSpec } from '../core/types';

export interface GratingSurface {
  initialPhase: [number, number];
  phase: [number, number];
  draw(phase: [number, number]): void;
}

/** Pixel-only vertical sinusoidal Gabor. Phase increases toward screen right.
 * Native comparison: GratingStim(tex='sin', mask='gauss', ori=0).
 * Alpha blend uses digital gray; this is not a photometric calibration. */
export function createGrating(canvas: HTMLCanvasElement, spec: GratingStimSpec): GratingSurface {
  const [width, height] = spec.size;
  const sd = spec.maskParams.sd;
  if (spec.units !== 'pix' || (spec.ori !== undefined && spec.ori !== 0) || spec.tex !== 'sin' || spec.mask !== 'gauss') {
    throw new Error('Grating currently requires pix units, vertical sin carrier and gauss mask.');
  }
  if (![width,height,sd,spec.sf,spec.contrast].every(Number.isFinite) ||
      width <= 0 || height <= 0 || width > 1024 || height > 1024 || sd <= 0 || spec.sf <= 0 ||
      spec.contrast < 0 || spec.contrast > 1) throw new Error('Invalid grating geometry/contrast.');
  const validPhase = Array.isArray(spec.phase)
    ? spec.phase.length === 2 && spec.phase.every(Number.isFinite)
    : typeof spec.phase === 'number' && Number.isFinite(spec.phase);
  if (!validPhase) throw new Error('Grating phase must be a finite scalar or pair.');
  const initialPhase: [number, number] = Array.isArray(spec.phase) ? [...spec.phase] : [spec.phase, 0];
  canvas.width = Math.round(width); canvas.height = Math.round(height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Grating requires Canvas2D.');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const cosX = new Float64Array(canvas.width);
  const sinX = new Float64Array(canvas.width);
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let col=0;col<canvas.width;col++) {
    const x=(col+.5)/canvas.width*width-width/2;
    cosX[col]=Math.cos(2*Math.PI*spec.sf*x); sinX[col]=Math.sin(2*Math.PI*spec.sf*x);
    for(let row=0;row<canvas.height;row++) {
      const y=(row+.5)/canvas.height*height-height/2;
      alpha[row*canvas.width+col]=Math.round(255*Math.exp(-.5*((x/(width/2/sd))**2+(y/(height/2/sd))**2)));
    }
  }
  const surface: GratingSurface = {initialPhase, phase:[...initialPhase], draw(phase) {
    if(phase.length !== 2 || !phase.every(Number.isFinite)) throw new Error('Grating phase must be a finite pair.');
    surface.phase=[...phase];
    const cosP=Math.cos(2*Math.PI*phase[0]); const sinP=Math.sin(2*Math.PI*phase[0]);
    const gray=new Uint8Array(canvas.width);
    for(let col=0;col<canvas.width;col++) gray[col]=Math.round(127.5*(1+spec.contrast*(cosX[col]*cosP+sinX[col]*sinP)));
    for(let row=0;row<canvas.height;row++) for(let col=0;col<canvas.width;col++) {
      const i=row*canvas.width+col; const offset=i*4;
      pixels.data[offset]=pixels.data[offset+1]=pixels.data[offset+2]=gray[col]; pixels.data[offset+3]=alpha[i];
    }
    context.putImageData(pixels,0,0); canvas.dataset.psyflowGratingPhase=String(phase[0]);
  }};
  surface.draw(initialPhase); return surface;
}
