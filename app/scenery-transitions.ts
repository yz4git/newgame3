/**
 * Visual-only smooth reveal for finite world scenery. No simulation clock,
 * randomness, hitboxes, or user-input state is modified.
 */
export const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
export function easeReveal(x:number){
 const t=clamp01(x);
 return t*t*(3-2*t);
}
/** 1 near the camera, 0 well outside the flight area; no hard clipping. */
export function distanceReveal(y:number,fullyVisible=25,fullyHidden=52){
 const d=Math.abs(y);
 return easeReveal((fullyHidden-d)/(fullyHidden-fullyVisible));
}
/** Deterministic rate limit: cannot teleport from absent to fully rendered. */
export function approachReveal(current:number,target:number,dt:number,seconds=.55){
 const step=clamp01(Math.max(0,dt)/seconds);
 const difference=clamp01(target)-clamp01(current);
 if(Math.abs(difference)<=step)return clamp01(target);
 return clamp01(current+Math.sign(difference)*step);
}
