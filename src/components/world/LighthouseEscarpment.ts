import { createCoastalRocks, coastalRockGeometry } from './coastalRocks';
import { createLandscapePlan, distanceToSegment, ISLANDS, islandContour, landDistance, seededRandom, terrainMeshHeight, type LandscapeRock } from './terrain';

let sites: LandscapeRock[] | undefined;
/** Fractured ledges follow the beacon's steep coast, leaving the arrival walk open. */
export function lighthouseEscarpmentSites() {
  if (sites) return sites;
  sites = [];
  const island = ISLANDS.find(item => item.id === 'beacon')!;
  const plan = createLandscapePlan(), random = seededRandom(59481);
  const geometries = Array.from({length:6},(_,index)=>coastalRockGeometry(index));
  for (let index=0;index<210;index++) {
    const angle=index*2.399+(random()-.5)*.12,edge=islandContour(island,angle),offset=-1.7+random()*2.2;
    const x=island.x+Math.cos(angle)*(island.rx*edge+offset),z=island.z+Math.sin(angle)*(island.rz*edge+offset);
    const size=.42+random()*.57,radius=size*1.55;
    if (landDistance(x,z)>2.5||landDistance(x,z)<-1.2)continue;
    if (plan.structures.some(item=>Math.hypot(item.x-x,item.z-z)<item.radius+radius+.2))continue;
    if (plan.paths.some(path=>path.points.slice(1).some((point,i)=>distanceToSegment(x,z,path.points[i],point)<path.width/2+radius+.28)))continue;
    if (sites.some(item=>Math.hypot(item.x-x,item.z-z)<(item.radius+radius)*.42))continue;
    const rotation=angle+random()*.7,scale:[number,number,number]=[size*1.24,size*(1.5+random()*.7),size];
    // Every base perimeter vertex embeds in the visible triangular shore, including steep banks.
    const geometry=geometries[sites.length%6],vertices=geometry.getAttribute('position');let base=terrainMeshHeight(x,z);
    for(let i=0;i<vertices.count;i++)if(vertices.getY(i)<.0001){
      const lx=vertices.getX(i)*scale[0],lz=vertices.getZ(i)*scale[2];
      base=Math.min(base,terrainMeshHeight(x+lx*Math.cos(rotation)+lz*Math.sin(rotation),z-lx*Math.sin(rotation)+lz*Math.cos(rotation)));
    }
    sites.push({id:`beacon-ledges-${sites.length}`,x,z,y:base+.12,radius,scale,rotation});
  }
  geometries.forEach(geometry=>geometry.dispose());
  return sites;
}
export function createLighthouseEscarpment() {
  const rocks=createCoastalRocks(lighthouseEscarpmentSites());
  rocks.root.name='lighthouse-fractured-escarpment';
  rocks.root.traverse(object=>{object.raycast=()=>{};});
  return rocks;
}
