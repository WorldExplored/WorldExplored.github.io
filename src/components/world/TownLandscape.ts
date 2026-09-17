import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundRouteAt, terrainMeshHeight, type LandscapePlan } from './terrain';

/** Local drainage and flush wayfinding leave the garden edge open and permeable. */
export function createTownLandscape(plan: LandscapePlan) {
  const root = new Group(); root.name = 'town-landscape-edging';
  const grates: BoxGeometry[] = [], housings: BoxGeometry[] = [], lenses: BoxGeometry[] = [];
  const placed: {x:number;z:number}[] = [];
  for(let z=-88;z<-62;z+=1.2)for(let x=-30;x<15;x+=1.2) {
    const distance=groundRouteAt(x,z).distance;
    if(distance<-.45 || distance>-.18 || plan.structures.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+.4))continue;
    if(placed.some(p=>Math.hypot(x-p.x,z-p.z)<7))continue;
    placed.push({x,z});
    const nx=groundRouteAt(x+.1,z).distance-groundRouteAt(x-.1,z).distance;
    const nz=groundRouteAt(x,z+.1).distance-groundRouteAt(x,z-.1).distance;
    const yaw=Math.atan2(nx,nz),y=terrainMeshHeight(x,z);
    // A drain belongs to the low point, not to a continuous artificial route outline.
    for(let slat=0;slat<6;slat++)grates.push(new BoxGeometry(.022,.018,.25).translate((slat-2.5)*.055,0,0).rotateY(yaw).translate(x,y+.018,z));
    housings.push(new BoxGeometry(.14,.055,.30).rotateY(yaw).translate(x+.43*Math.cos(yaw),y+.025,z-.43*Math.sin(yaw)));
    lenses.push(new BoxGeometry(.075,.012,.20).rotateY(yaw).translate(x+.43*Math.cos(yaw),y+.058,z-.43*Math.sin(yaw)));
  }
  const materials=[new MeshStandardMaterial({color:'#284e5b',roughness:.77,metalness:.35}),new MeshStandardMaterial({color:'#356473',roughness:.65,metalness:.4}),new MeshStandardMaterial({color:'#20c1d1',emissive:'#0da4ba',emissiveIntensity:.28,roughness:.18})];
  const geometries=[grates,housings,lenses].map((parts,index)=>{
    const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());
    const mesh=new Mesh(geometry,materials[index]);mesh.name=['town-flush-drainage-grates','town-wayfinding-housings','town-wayfinding-lenses'][index];
    mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);return geometry;
  });
  return {root,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
