import { Color, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, distanceToSegment, landDistance, seededRandom } from './terrain';
import { coastalCaveClearance } from './coastalCaveLayout';
import { getReefHabitat, marineFloorHeight, reefHabitatContains, type ReefHabitatPlan } from './reefHabitat';
import { meadowGeometry } from './MeadowGeometry';

export interface SeabedMeadowSite {x:number;y:number;z:number;width:number;height:number;rotation:number;region:number}
export function createSeabedMeadowSites(habitat:ReefHabitatPlan=getReefHabitat()):SeabedMeadowSite[]{
  const sites:SeabedMeadowSite[]=[],random=seededRandom(731115),plan=createLandscapePlan();
  const obstacles=[...habitat.rocks,...habitat.colonies],cells=new Map<string,typeof obstacles>();
  for(const item of obstacles)for(let x=Math.floor((item.x-item.radius-.8)/8);x<=Math.floor((item.x+item.radius+.8)/8);x++)for(let z=Math.floor((item.z-item.radius-.8)/8);z<=Math.floor((item.z+item.radius+.8)/8);z++){
    const key=`${x},${z}`,cell=cells.get(key)??[];cell.push(item);cells.set(key,cell);
  }
  for(let x=-102;x<51;x+=1.06)for(let z=-118;z<42;z+=1.06){
    const px=x+(random()-.5)*.7,pz=z+(random()-.5)*.7,distance=landDistance(px,pz);
    if(distance> -1.9||distance< -20&&!reefHabitatContains(px,pz))continue;
    const patch=Math.sin(px*.17+Math.sin(pz*.14)*1.9)+Math.cos(pz*.22-px*.09);
    if(patch<-.75&&random()>.18)continue;
    const y=marineFloorHeight(px,pz)-.03;
    if(y>-.72||y< -9.5||coastalCaveClearance(px,pz,.65)<=0)continue;
    if((cells.get(`${Math.floor(px/8)},${Math.floor(pz/8)}`)??[]).some(item=>Math.hypot(px-item.x,pz-item.z)<item.radius+.40))continue;
    if(plan.paths.some(path=>path.bridge&&path.points.slice(1).some((p,i)=>distanceToSegment(px,pz,path.points[i],p)<path.width/2+.8)))continue;
    if(plan.structures.some(item=>Math.hypot(px-item.x,pz-item.z)<item.radius+.65))continue;
    const width=.96+random()*.30,height=Math.min(.30+random()*.70,-.36-y);
    // Sixteen bounded patches can be culled separately from the opposite coast.
    const region=Math.min(3,Math.max(0,Math.floor((px+102)/38.5)))+Math.min(3,Math.max(0,Math.floor((pz+118)/40)))*4;
    sites.push({x:px,y,z:pz,width,height,rotation:random()*Math.PI*2,region});
  }
  return sites;
}

export function createSeabedMeadows(habitat:ReefHabitatPlan=getReefHabitat()){
  const sites=createSeabedMeadowSites(habitat),near=meadowGeometry(true),far=meadowGeometry(true,'far'),root=new Group(),time={value:0};
  root.name='continuous-seabed-meadows';
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.96,side:DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.seabedMeadowTime=time;
    shader.vertexShader=`uniform float seabedMeadowTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*.38+instanceMatrix[3].z*.67;
      transformed.x+=sin(seabedMeadowTime*.47+phase)*position.y*position.y*.065;
      transformed.z+=cos(seabedMeadowTime*.29-phase)*position.y*position.y*.045;
    `);
  };
  material.customProgramCacheKey=()=> 'continuous-seabed-meadow-v1';
  const transform=new Object3D(),color=new Color();
  const batches=Array.from({length:16},(_,region)=>{
    const entries=sites.filter(site=>site.region===region),mesh=new InstancedMesh(near,material,entries.length);mesh.name=`seabed-meadow-region-${region}`;mesh.raycast=()=>{};
    entries.forEach((site,i)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,site.rotation,0);transform.scale.set(site.width,site.height,site.width);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,color.setHSL(.16+(i%13)*.007,.15,.72+(i%7)*.035));});
    mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.3;root.add(mesh);return mesh;
  });
  return {root,sites,batches,update(elapsed:number){time.value=elapsed;},setQuality(quality:string){batches.forEach(mesh=>{mesh.geometry=quality==='high'?near:far;});},dispose(){near.dispose();far.dispose();material.dispose();batches.forEach(mesh=>mesh.dispose());}};
}
