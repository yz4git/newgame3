import * as T from 'three/webgpu';
import type {filmFrame} from './film-lighting.ts';
import type {FlightFrame} from './flight-route.ts';

const corner=new T.Vector3();

/** Perspective with an explicitly fitted flight corridor. The near edge keeps
 * both wings inside the viewport, including on the shortest supported phone. */
export function fitCinemaCamera(camera:T.PerspectiveCamera,width:number,height:number){
 camera.aspect=width/Math.max(1,height);
 const vertical=Math.max(48,27/camera.aspect);
 camera.userData.flightHeight=vertical;
 camera.fov=T.MathUtils.radToDeg(2*Math.atan(vertical/(2*Math.hypot(23,55))));
 camera.updateProjectionMatrix();
}
export function poseCinemaCamera(camera:T.PerspectiveCamera,film:ReturnType<typeof filmFrame>,roll:number,zoom:number,warp=0,flight?:FlightFrame){
 camera.position.set(film.lensSide+(flight?.eyeX??0),-23+film.lensLift+(flight?.eyeY??0),56-film.lensPush*28-warp*3+(flight?.eyeZ??0));
 camera.up.set(-Math.sin(roll),Math.cos(roll),0);
 camera.zoom=zoom;
 const x=film.lensSide*.12+(flight?.lookX??0),y=film.lensLift*.10+(flight?.lookY??0);
 camera.lookAt(x,y,1);
 if(flight){
  const distance=camera.position.distanceTo(corner.set(x,y,1));
  const height=camera.userData.flightHeight??Math.max(48,27/camera.aspect);
  camera.fov=T.MathUtils.radToDeg(2*Math.atan(height/(2*distance)));
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  // Fit actual perspective corners, including wing thickness, after every
  // orbit/dive. The camera can move strongly without clipping a flight edge.
  let expansion=1;
  for(const xx of[-11.2,11.2])for(const yy of[-16,16])for(const zz of[.3,3.2]){
   corner.set(xx,yy,zz).project(camera);
   expansion=Math.max(expansion,Math.abs(corner.x)/.89,Math.abs(corner.y)/.91);
  }
  camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov)/2)*expansion));
 }
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
