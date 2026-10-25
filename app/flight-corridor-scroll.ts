/**
 * Corridor mode's wide world-space maneuvering and screen-edge camera.
 * Unlike all-range yaw rotation, the aircraft keeps flying forward through a
 * much wider corridor while the third-person camera pans with a dead zone.
 */
import {clamp,routeCenter,type V3} from './nova64-rules.ts';

export const RAIL_X_MAX=44;
export const RAIL_Y_MIN=-6.7;
export const RAIL_Y_MAX=11.5;
export const CAMERA_DEADZONE=6.5;
export const CAMERA_SCROLL_GAIN=.82;
export const EDGE_WARNING_START=RAIL_X_MAX-4.0;

/** Camera first leaves the ship free to move; beyond the dead zone it slides. */
export function railCameraPan(localX:number){
 const x=clamp(localX,-RAIL_X_MAX,RAIL_X_MAX);
 const outside=Math.max(0,Math.abs(x)-CAMERA_DEADZONE);
 return outside===0?0:Math.sign(x)*outside*CAMERA_SCROLL_GAIN;
}
export function railCameraPanY(localY:number){
 return (clamp(localY,RAIL_Y_MIN,RAIL_Y_MAX)-1.2)*.27;
}
/** Ship must not be pinned to camera center even at the horizontal edge. */
export function railViewportOffset(localX:number){
 return clamp(localX,-RAIL_X_MAX,RAIL_X_MAX)-railCameraPan(localX);
}
export function railEdgeWarning(localX:number){
 const a=Math.abs(localX);
 return a<=EDGE_WARNING_START?0:clamp((a-EDGE_WARNING_START)/(RAIL_X_MAX-EDGE_WARNING_START),0,1);
}
export function railMoveTarget(x:number,delta:number){
 return clamp(x+delta,-RAIL_X_MAX,RAIL_X_MAX);
}
/** World-space aim marker must move with the craft AND the moving panorama. */
export function railAimPoint(scene:number,z:number,laneX:number,laneY:number,ahead=145):V3 {
 const at=routeCenter(scene,z-ahead);
 return {x:at.x+clamp(laneX,-RAIL_X_MAX,RAIL_X_MAX)*.96,
         y:at.y+clamp(laneY,RAIL_Y_MIN,RAIL_Y_MAX)*.81,
         z:z-ahead};
}
