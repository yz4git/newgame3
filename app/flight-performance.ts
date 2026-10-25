/** Hysteresis-based render resolution scaling for WebGL on demanding scenes.
 * Keep CSS size, touch coordinates and camera FOV unchanged; only adjust GPU pixels.
 */
export const MIN_RENDER_SCALE=.67;
export const MAX_RENDER_SCALE=1;
export function nextRenderScale(current:number,fps:number,belowSeconds:number,aboveSeconds:number){
 if(fps<28&&belowSeconds>=2.7)return Math.max(MIN_RENDER_SCALE,Math.round((current-.16)*100)/100);
 if(fps>53&&aboveSeconds>=7)return Math.min(MAX_RENDER_SCALE,Math.round((current+.1)*100)/100);
 return current;
}
export function adaptivePixelRatio(baseDpr:number,renderScale:number){
 return Math.max(.6,baseDpr*Math.max(MIN_RENDER_SCALE,Math.min(MAX_RENDER_SCALE,renderScale)));
}
