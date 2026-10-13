import * as T from 'three/webgpu';
import type {filmFrame} from './film-lighting.ts';

/** Perspective with an explicitly fitted flight corridor. The near edge keeps
 * both wings inside the viewport, including on the shortest supported phone. */
export function fitCinemaCamera(camera:T.PerspectiveCamera,width:number,height:number){
 camera.aspect=width/Math.max(1,height);
 const vertical=Math.max(48,27/camera.aspect);
 camera.fov=T.MathUtils.radToDeg(2*Math.atan(vertical/(2*Math.hypot(23,55))));
 camera.updateProjectionMatrix();
}
export function poseCinemaCamera(camera:T.PerspectiveCamera,film:ReturnType<typeof filmFrame>,roll:number,zoom:number,warp=0){
 camera.position.set(film.lensSide,-23+film.lensLift,56-film.lensPush*28-warp*3);
 camera.up.set(-Math.sin(roll),Math.cos(roll),0);
 camera.zoom=zoom;
 camera.lookAt(film.lensSide*.12,film.lensLift*.10,1);
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
