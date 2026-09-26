import { Color, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, distanceToSegment, landDistance, seededRandom } from './terrain';
import { coastalCaveClearance } from './coastalCaveLayout';
import { getReefHabitat, marineFloorHeight, reefHabitatContains, type ReefHabitatPlan } from './reefHabitat';
import { meadowGeometry } from './MeadowGeometry';

export interface SeabedMeadowSite {x:number;y:number;z:number;width:number;height:number;rotation:number;region:number;form:number;tint:number;cluster:number}
export const SEABED_FORMS = ['ribbon eelgrass', 'broad ruffled blades', 'paired fern algae', 'low spreading red fans'] as const;
export function createSeabedMeadowSites(habitat:ReefHabitatPlan=getReefHabitat()):SeabedMeadowSite[]{
  const sites:SeabedMeadowSite[]=[],random=seededRandom(731115),plan=createLandscapePlan();
  const obstacles=[...habitat.rocks,...habitat.colonies],cells=new Map<string,typeof obstacles>();
  for(const item of obstacles)for(let x=Math.floor((item.x-item.radius-1)/8);x<=Math.floor((item.x+item.radius+1)/8);x++)for(let z=Math.floor((item.z-item.radius-1)/8);z<=Math.floor((item.z+item.radius+1)/8);z++){
    const key=`${x},${z}`,cell=cells.get(key)??[];cell.push(item);cells.set(key,cell);
  }
  const floorAt=(x:number,z:number)=>{
    const distance=landDistance(x,z);
    if(distance> -1.9||distance< -20&&!reefHabitatContains(x,z))return undefined;
    const y=marineFloorHeight(x,z)-.03;
    return y<=-.72&&y>=-9.5?y:undefined;
  };
  // Random parent patches have unequal radii, eccentricity and orientation. Each
  // contains close siblings, young edge growth and a few detached outliers.
  const patches:{x:number;z:number;radius:number;aspect:number;yaw:number;form:number;tint:number}[]=[];
  for(let attempt=0;attempt<7000&&patches.length<420;attempt++){
    const x=-102+random()*153,z=-118+random()*160;
    if(floorAt(x,z)===undefined)continue;
    patches.push({x,z,radius:2+random()*5.2,aspect:.30+random()*.65,yaw:random()*Math.PI*2,form:Math.floor(random()*4),tint:random()});
  }
  const roots=new Map<string,SeabedMeadowSite[]>();
  for(let attempt=0;attempt<65000&&sites.length<6400;attempt++){
    const cluster=Math.floor(random()*patches.length),patch=patches[cluster],scattered=attempt%7===0;
    const angle=random()*Math.PI*2,radial=Math.pow(random(),1.1),r=radial*patch.radius;
    const dx=Math.cos(angle)*r,dz=Math.sin(angle)*r*patch.aspect+Math.sin(dx*.7)*patch.radius*.08;
    const px=scattered?-102+random()*153:patch.x+Math.cos(patch.yaw)*dx-Math.sin(patch.yaw)*dz;
    const pz=scattered?-118+random()*160:patch.z+Math.sin(patch.yaw)*dx+Math.cos(patch.yaw)*dz;
    const y=floorAt(px,pz);if(y===undefined||coastalCaveClearance(px,pz,.8)<=0)continue;
    if((cells.get(`${Math.floor(px/8)},${Math.floor(pz/8)}`)??[]).some(item=>Math.hypot(px-item.x,pz-item.z)<item.radius+.65))continue;
    if(plan.paths.some(path=>path.bridge&&path.points.slice(1).some((p,i)=>distanceToSegment(px,pz,path.points[i],p)<path.width/2+.9)))continue;
    if(plan.structures.some(item=>Math.hypot(px-item.x,pz-item.z)<item.radius+.8))continue;
    const cellX=Math.floor(px),cellZ=Math.floor(pz),spacing=.12+random()*.19;
    let crowded=false;
    for(let x=cellX-1;x<=cellX+1&&!crowded;x++)for(let z=cellZ-1;z<=cellZ+1&&!crowded;z++)
      crowded=(roots.get(`${x},${z}`)??[]).some(site=>Math.hypot(px-site.x,pz-site.z)<spacing);
    if(crowded)continue;
    const form=random()<.52&&!scattered?patch.form:Math.floor(random()*4);
    const maturity=(scattered?.25:.45+(1-radial)*.55)*(.5+random()*.9);
    const width=.42+random()*.68,height=Math.min(.16+maturity*[1.20,1.65,.98,.58][form],-.4-y);
    const region=Math.min(3,Math.max(0,Math.floor((px+102)/38.5)))+Math.min(3,Math.max(0,Math.floor((pz+118)/40)))*4;
    const site={x:px,y,z:pz,width,height,rotation:random()*Math.PI*2,region,form,tint:patch.tint*.45+random()*.55,cluster:scattered?-1:cluster};
    sites.push(site);const key=`${cellX},${cellZ}`,cell=roots.get(key)??[];cell.push(site);roots.set(key,cell);
  }
  return sites;
}

export function createSeabedMeadows(habitat:ReefHabitatPlan=getReefHabitat()){
  const sites=createSeabedMeadowSites(habitat),near=SEABED_FORMS.map((_,form)=>meadowGeometry(true,'near',form)),far=SEABED_FORMS.map((_,form)=>meadowGeometry(true,'far',form)),root=new Group(),time={value:0};
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
  const batches=Array.from({length:32},(_,batch)=>{
    const region=Math.floor(batch/4),form=batch%4,entries=sites.filter(site=>site.region%4+Math.floor(site.region/8)*4===region&&site.form===form),mesh=new InstancedMesh(near[form],material,entries.length);mesh.name=`seabed-meadow-region-${region}-form-${form}`;mesh.userData.form=form;mesh.raycast=()=>{};
    entries.forEach((site,i)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,site.rotation,0);transform.scale.set(site.width,site.height,site.width);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,color.setHSL(.12+site.tint*.15,.13+site.tint*.18,.60+site.tint*.32));});
    mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.3;root.add(mesh);return mesh;
  });
  return {root,sites,batches,update(elapsed:number){time.value=elapsed;},setQuality(quality:string,distant=false){batches.forEach(mesh=>{mesh.geometry=quality==='high'&&!distant?near[mesh.userData.form]:far[mesh.userData.form];});},dispose(){[...near,...far].forEach(geometry=>geometry.dispose());material.dispose();batches.forEach(mesh=>mesh.dispose());}};
}
