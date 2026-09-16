import { BoxGeometry, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundRouteAt, terrainMeshHeight, type LandscapePlan } from './terrain';
import { TOWN_BEDS } from './coastalBiome';

/** Low stone edging follows the graded mesh; gaps drain the town's permeable paving. */
export function createTownLandscape(plan:LandscapePlan) {
  const root=new Group();root.name='town-landscape-edging';
  const stone:BufferGeometry[]=[],metal:BufferGeometry[]=[];
  const clear=(x:number,z:number)=>!plan.structures.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+.08);
  function block(x:number,z:number,length:number,width:number,yaw:number,drain=false){
    const dx=Math.sin(yaw)*length/2,dz=Math.cos(yaw)*length/2;
    const start=terrainMeshHeight(x-dx,z-dz),end=terrainMeshHeight(x+dx,z+dz),rise=end-start;
    const geometry=new BoxGeometry(width,drain?.018:.07,Math.hypot(length,rise));
    geometry.rotateX(-Math.atan2(rise,length)).rotateY(yaw).translate(x,(start+end)/2+(drain?.013:.025),z);(drain?metal:stone).push(geometry);
  }
  for(const path of plan.paths.filter(p=>!p.elevated&&!p.bridge&&p.points[0].z<-60&&p.width>=.9)){
    for(let i=1;i<path.points.length;i++){
      const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.015)continue;
      for(const side of [-1,1]){
        const x=(a.x+b.x)/2+dz/len*(path.width/2+.10)*side,z=(a.z+b.z)/2-dx/len*(path.width/2+.10)*side;
        if(!clear(x,z)||groundRouteAt(x,z).distance<.045)continue;
        const drain=i%19===0;
        if(drain)for(let slit=0;slit<4;slit++)block(x+dx/len*(slit-1.5)*.055,z+dz/len*(slit-1.5)*.055,.025,.15,Math.atan2(dx,dz),true);
        else block(x,z,len+.012,.11,Math.atan2(dx,dz));
      }
    }
  }
  for(const [cx,cz,inner] of TOWN_BEDS){const radius=inner+.65;for(let i=0;i<48;i++){
    const angle=(i+.5)/48*Math.PI*2,x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
    if(clear(x,z)&&groundRouteAt(x,z).distance>.2)block(x,z,Math.PI*2*radius/48+.008,.09,-angle);
  }}
  for(const [parts,color,name] of [[stone,'#c3c8b5','town-stone-curbs'],[metal,'#637976','town-drain-slots']] as const){
    if(!parts.length)continue;const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const material=new MeshStandardMaterial({color,roughness:.93});const mesh=new Mesh(geometry,material);mesh.name=name;mesh.raycast=()=>{};root.add(mesh);
  }
  return{root,dispose(){root.children.forEach(object=>{const mesh=object as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});}};
}
