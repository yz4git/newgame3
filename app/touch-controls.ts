export type TouchPoint={x:number;y:number};

/** Reproject both ends with the same camera. A bank between pointer events
 * must not turn a stationary finger into a movement command. */
export function pointerDragDelta(previous:TouchPoint,current:TouchPoint,project:(x:number,y:number)=>TouchPoint){
 const a=project(previous.x,previous.y),b=project(current.x,current.y);
 return {x:b.x-a.x,y:b.y-a.y};
}
