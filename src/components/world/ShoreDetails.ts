import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, TubeGeometry, Vector3, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distanceToSegment, landDistance, seededRandom, terrainMeshHeight, terrainSlope, type LandscapePlan } from './terrain';
import { coastalRockGeometry } from './coastalRocks';

/** Sparse high-water debris sits on the same mesh sampled by vegetation and access routes. */
export function createShoreDetails(plan:LandscapePlan) {
  const root=new Group();root.name='coastal-strandline';
  const random=seededRandom(572),transform=new Object3D();
  const driftCurve=new CatmullRomCurve3([new Vector3(-.55,.01,-.025),new Vector3(-.2,.02,.015),new Vector3(.17,.035,0),new Vector3(.52,.015,-.04)]);
  const driftParts=[new TubeGeometry(driftCurve,16,.052,10,false),new TubeGeometry(new CatmullRomCurve3([new Vector3(.04,.035,0),new Vector3(.16,.09,.08),new Vector3(.30,.08,.13)]),10,.022,8,false)];
  const drift=mergeGeometries(driftParts)!;driftParts.forEach(g=>g.dispose());
  const positions:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(let blade=0;blade<4;blade++)for(let row=0;row<=16;row++)for(const side of [-1,1]){
    const t=row/16,a=blade*2.399,start=positions.length/3;
    const width=.024*Math.sin(Math.PI*t)*(1+.16*Math.sin(t*39));
    const along=t*(.30+blade*.035),across=side*width+Math.sin(t*8+blade)*.018*t;
    positions.push(Math.cos(a)*along-Math.sin(a)*across,.015+.015*Math.sin(t*11+blade)**2,Math.sin(a)*along+Math.cos(a)*across);uvs.push(t,(side+1)/2);
    if(row<16&&side===-1)indices.push(start,start+1,start+2,start+1,start+3,start+2);
  }
  const weed=new BufferGeometry();weed.setAttribute('position',new Float32BufferAttribute(positions,3));weed.setAttribute('uv',new Float32BufferAttribute(uvs,2));weed.setIndex(indices);weed.computeVertexNormals();
  const kinds:Array<[string,BufferGeometry,string,number]>=[['beach-pebbles',coastalRockGeometry(2),'#899080',110],['beached-driftwood',drift,'#a59474',14],['beached-kelp',weed,'#626845',18]];
  for(const [name,geometry,color,count] of kinds){
    const material=new MeshStandardMaterial({color,roughness:.98,side:2});const mesh=new InstancedMesh(geometry,material,count);mesh.name=name;mesh.raycast=()=>{};let placed=0;
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
