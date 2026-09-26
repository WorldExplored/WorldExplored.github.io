import { world, type LandmarkId } from '../../content/world';
import { cityBuildings } from './city';

interface PlantingObstacle {id:string;x:number;z:number;radius:number}
type Shape = {kind:'box';x:number;z:number;width:number;depth:number}|{kind:'circle';x:number;z:number;radius:number};
const box=(x:number,z:number,width:number,depth:number):Shape=>({kind:'box',x,z,width,depth});
const circle=(x:number,z:number,radius:number):Shape=>({kind:'circle',x,z,radius});
/** Ground bearing surfaces, measured from the model's foundation/threshold slabs. */
export const LANDMARK_PLANTING_SHAPES:Record<LandmarkId,readonly Shape[]>={
  work:[box(-2.875,0,2.87,4.72),box(2.875,0,2.87,4.72),box(0,.04,3.08,4.82),box(0,2.51,2.5,.5)],
  experience:[box(0,0,8.45,6.12),box(0,3.075,2.3,.63)],
  research:[box(0,-.87,7.58,5.36),box(-1.33,1.8125,1.46,.495)],
  purdue:[box(0,-.895,6.88,4.99),box(0,1.73,1.45,.43)],
  history:[box(0,0,11.2,7.7),box(0,3.82,3.58,.7),box(-1.96,4.42,.26,.26),box(1.96,4.42,.26,.26)],
  about:[box(-.48,-2.09,6.16,1.78),box(-2.44,.12,2.34,2.86),box(-1.95,1.64,1.14,.4),box(1.195,-1.14,.88,.3),circle(0,0,.55),box(2.08,.2,.7,1.5)],
  contact:[circle(0,0,1.71),box(2.55,-.9,2.83,3.58),box(0,1.95,1.28,.61)],
  // The clipped arcade corner is small; a rectangle also protects its entry steps.
  arcade:[box(0,-.30,6.55,5.16),box(0,2.42,1.4,.6)],
  building:[circle(0,0,1.16*1.18)],
};
const landmarks=new Map(world.landmarks.map(landmark=>[landmark.id,{...landmark,c:Math.cos(landmark.rotationY??0),s:Math.sin(landmark.rotationY??0)}]));
const buildings=new Map(cityBuildings.map(building=>[building.id,{...building,c:Math.cos(building.rotation),s:Math.sin(building.rotation)}]));
export function shapePlantingClearance(x:number,z:number,shape:Shape){
  if(shape.kind==='circle')return Math.hypot(x-shape.x,z-shape.z)-shape.radius;
  const dx=Math.abs(x-shape.x)-shape.width/2,dz=Math.abs(z-shape.z)-shape.depth/2;
  return Math.hypot(Math.max(0,dx),Math.max(0,dz))+Math.min(0,Math.max(dx,dz));
}
/** Signed horizontal clearance from foundations, not the camera's broad safety circles. */
export function structurePlantingClearance(x:number,z:number,obstacle:PlantingObstacle){
  const landmark=landmarks.get(obstacle.id as LandmarkId);
  if(landmark){
    const dx=x-obstacle.x,dz=z-obstacle.z,lx=dx*landmark.c-dz*landmark.s,lz=dx*landmark.s+dz*landmark.c;
    return Math.min(...LANDMARK_PLANTING_SHAPES[landmark.id].map(shape=>shapePlantingClearance(lx,lz,shape)));
  }
  const building=buildings.get(obstacle.id);
  if(building){
    const dx=x-obstacle.x,dz=z-obstacle.z,lx=dx*building.c-dz*building.s,lz=dx*building.s+dz*building.c;
    // Include balconies, lift landings and sill projections in the walking envelope.
    return shapePlantingClearance(lx,lz,box(0,0,building.width+.48,building.depth+.48));
  }
  if(obstacle.id.startsWith('turbine-'))return Math.hypot(x-obstacle.x,z-obstacle.z)-.64;
  if(obstacle.id.endsWith('-dock'))return shapePlantingClearance(x-obstacle.x,z-obstacle.z,box(0,0,1.7,obstacle.id==='city-dock'?10.6:6.4));
  return Math.hypot(x-obstacle.x,z-obstacle.z)-obstacle.radius;
}
