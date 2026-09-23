import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, TubeGeometry, Vector3, Group, InstancedMesh, MeshStandardMaterial, Object3D, DodecahedronGeometry, SphereGeometry, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distanceToSegment, landDistance, seededRandom, terrainMeshHeight, terrainSlope, ISLANDS, islandContour, type LandscapePlan } from './terrain';

/** Mineral pockets, shells and wrack follow irregular strandlines on every island. */
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
  const pebble=(form:number)=>{
    const geometry=new DodecahedronGeometry(1,0),vertices=geometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),wear=1+.1*Math.sin(x*7+z*11+form*3);
      vertices.setXYZ(i,x*wear*(form===1?1.4:1),Math.max(0,(y+1)*.30)*(form===2?1.3:1),z*wear*(form===2?.65:1));
    }
    geometry.computeVertexNormals();return geometry;
  };
  const shell=new SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI/2),shellPoints=shell.attributes.position;
  for(let i=0;i<shellPoints.count;i++){
    const x=shellPoints.getX(i),z=shellPoints.getZ(i),rib=1+.065*Math.cos(Math.atan2(z,x)*12);
    shellPoints.setXYZ(i,x*rib,shellPoints.getY(i)*.31,z*rib*.75);
  }
  shell.computeVertexNormals();
  const kinds:Array<[string,BufferGeometry,string,number]>=[['beach-pebbles',pebble(0),'#a6a08d',640],['beach-slate-chips',pebble(1),'#69756e',350],['beach-warm-stones',pebble(2),'#b69c75',290],['beach-small-shells',shell,'#e1d8bf',160],['beached-driftwood',drift,'#a59474',28],['beached-kelp',weed,'#626845',115]];
  const patches=ISLANDS.flatMap((island,islandIndex)=>Array.from({length:18},()=>{
    const a=random()*Math.PI*2,contour=islandContour(island,a),inset=.6+random()*1.8;
    return {x:island.x+Math.cos(a)*(island.rx*contour-inset),z:island.z+Math.sin(a)*(island.rz*contour-inset),radius:.3+random()*.85,islandIndex};
  }));
  const tint=new Color();
  for(const [name,geometry,color,count] of kinds){
    const material=new MeshStandardMaterial({color,roughness:.98,side:2});const mesh=new InstancedMesh(geometry,material,count);mesh.name=name;mesh.raycast=()=>{};let placed=0;
    for(let attempt=0;attempt<12000&&placed<count;attempt++){
      const islandIndex=placed%ISLANDS.length,regional=patches.filter(patch=>patch.islandIndex===islandIndex),patch=regional[Math.floor(random()*regional.length)];
      const a=random()*Math.PI*2,r=Math.pow(random(),.7)*patch.radius*(attempt%7===0?2.1:1),x=patch.x+Math.cos(a)*r,z=patch.z+Math.sin(a)*r,d=landDistance(x,z);if(d<.35||d>2.8||terrainSlope(x,z)>.6)continue;
      if([...plan.structures,...plan.rocks].some(v=>Math.hypot(x-v.x,z-v.z)<v.radius+.7))continue;
      if(plan.paths.some(p=>p.points.slice(1).some((b,i)=>distanceToSegment(x,z,p.points[i],b)<p.width/2+.7)))continue;
      const mineral=name.startsWith('beach-');
      const size=mineral?.035+Math.pow(random(),2)*(name==='beach-small-shells'?.18:.28):.45+random()*.75;
      transform.position.set(x,terrainMeshHeight(x,z)+(name==='beached-driftwood'?.04:.005),z);transform.rotation.set(0,random()*Math.PI*2,0);transform.scale.setScalar(size);transform.updateMatrix();mesh.setMatrixAt(placed,transform.matrix);
      mesh.setColorAt(placed,tint.setHSL(.10+random()*.05,.06+random()*.08,.74+random()*.23));placed++;
    }
    mesh.count=placed;mesh.computeBoundingSphere();root.add(mesh);
  }
  return {root,dispose(){root.children.forEach(child=>{const mesh=child as InstancedMesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();});}};
}
