import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distanceToSegment, landDistance, seededRandom, terrainMeshHeight, terrainSlope, type LandscapePlan } from './terrain';
import { coastalRockGeometry } from './coastalRocks';

/** Sparse high-water debris sits on the same mesh sampled by vegetation and access routes. */
export function createShoreDetails(plan:LandscapePlan) {
  const root=new Group();root.name='coastal-strandline';
  const random=seededRandom(572),transform=new Object3D();
  const driftParts=[new CylinderGeometry(.05,.08,1.1,7).rotateZ(Math.PI/2),new CylinderGeometry(.025,.043,.42,6).rotateZ(.85).translate(.19,.04,.02)];
  const drift=mergeGeometries(driftParts)!;driftParts.forEach(g=>g.dispose());
  const weedParts=Array.from({length:5},(_,i)=>new BoxGeometry(.032,.014,.28+i*.04).rotateY(i*.65).translate(Math.sin(i)*.12,0,Math.cos(i)*.09));
  const weed=mergeGeometries(weedParts)!;weedParts.forEach(g=>g.dispose());
  const kinds:Array<[string,BufferGeometry,string,number]>=[['beach-pebbles',coastalRockGeometry(2),'#899080',110],['beached-driftwood',drift,'#a59474',14],['beached-kelp',weed,'#626845',18]];
  for(const [name,geometry,color,count] of kinds){
    const material=new MeshStandardMaterial({color,roughness:.98});const mesh=new InstancedMesh(geometry,material,count);mesh.name=name;mesh.raycast=()=>{};let placed=0;
    for(let attempt=0;attempt<12000&&placed<count;attempt++){
      const x=-33+random()*71,z=-96+random()*132,d=landDistance(x,z);if(d<.55||d>2.5||terrainSlope(x,z)>.6)continue;
      if([...plan.structures,...plan.rocks].some(v=>Math.hypot(x-v.x,z-v.z)<v.radius+.7))continue;
      if(plan.paths.some(p=>p.points.slice(1).some((b,i)=>distanceToSegment(x,z,p.points[i],b)<p.width/2+.7)))continue;
      const size=name==='beach-pebbles'?.08+random()*.10:.65+random()*.45;
      transform.position.set(x,terrainMeshHeight(x,z)+(name==='beached-driftwood'?.04:.005),z);transform.rotation.set(0,random()*Math.PI*2,0);transform.scale.setScalar(size);transform.updateMatrix();mesh.setMatrixAt(placed++,transform.matrix);
    }
    mesh.count=placed;mesh.computeBoundingSphere();root.add(mesh);
  }
  return {root,dispose(){root.children.forEach(child=>{const mesh=child as InstancedMesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();});}};
}
