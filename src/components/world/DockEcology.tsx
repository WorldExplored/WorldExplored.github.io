'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityDocks, dockLandingLayout } from './cityInfrastructure';
import { LIGHTHOUSE_LANDING } from './LighthouseAccess';
import { seededRandom, terrainHeight, terrainMeshHeight } from './terrain';

export interface DockPole { id: string; x: number; z: number; radius: number; bottom: number }
export interface DockWeedSite { pole: string; x: number; y: number; z: number; height: number; rotation: number; variant: number; radius: number; seed:number }

/** Match the wet faces of the existing rail posts and lighthouse landing piles. */
export function dockEcologyPoles(): DockPole[] {
  const poles: DockPole[] = [];
  for (const dock of cityDocks) {
    const {stairEnd,landingEnd}=dockLandingLayout(dock);
    for (const side of [-1, 1]) for (const [index, z] of [stairEnd, landingEnd].entries()) {
      const x = dock.x + side * .59;
      // CityLife's post is tapered from .055 at the bottom to .035 above water.
      const bottom = Math.min(terrainHeight(x, z), .1);
      if (bottom < -.35) poles.push({ id: `${dock.id}-${side}-${index}`, x, z, radius: .048, bottom });
    }
  }
  for (const dx of [-.84, .84]) for (const dz of [-.87, .87]) {
    const x = LIGHTHOUSE_LANDING.x + dx, z = LIGHTHOUSE_LANDING.z + dz;
    poles.push({ id: `lighthouse-${dx}-${dz}`, x, z, radius: .095, bottom: terrainMeshHeight(x, z) - .25 });
  }
  return poles;
}

export function createDockWeedSites(poles = dockEcologyPoles()): DockWeedSite[] {
  const random = seededRandom(71826), sites: DockWeedSite[] = [];
  // Spiralling holdfasts occupy the full wet length rather than a tiny collar.
  for (const pole of poles) {
    const bottom = Math.max(pole.bottom + .10, -2.8), top = -.28;
    const rows = Math.max(3, Math.ceil((top-bottom)/(.14+random()*.035))),phase=random()*Math.PI*2,twist=.8+random()*1.3;
    for (let row=0;row<rows;row++) for(let side=0;side<3;side++) {
      const y = bottom+(top-bottom)*(row+random()*.4)/rows;
      const height = Math.min(.15+random()*.20,-.15-y);
      if(height<.10||random()<.12)continue;
      const rotation = phase+row*twist+side*Math.PI*2/3+random()*.65;
      sites.push({pole:pole.id,x:pole.x+Math.sin(rotation)*pole.radius,y,
        z:pole.z+Math.cos(rotation)*pole.radius,height,rotation,variant:Math.floor(random()*3),radius:pole.radius,seed:Math.floor(random()*2147483647)});
    }
  }
  return sites;
}

/** Short algae and encrusting barnacles follow the wet pile rather than branching like palms. */
export function createDockWeedGeometry(variant: number, seed=variant*139+51) {
  const random=seededRandom(seed),shape=random(),shellTilt=random()*Math.PI,frondLean=(random()-.5)*.08;
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const algae=new Color(['#485e39','#657343','#526441'][variant]).multiplyScalar(.86+random()*.28),shell=new Color(['#aea590','#939684','#bdad8e'][variant]).multiplyScalar(.8+random()*.28);
  const vertex=(x:number,y:number,z:number,color:Color,shade=1)=>{positions.push(x,y,z);colors.push(color.r*shade,color.g*shade,color.b*shade);};
  // A rough olive film ties the shells to a living patch instead of isolated beads.
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=(col/3-.5)*.13*(.68+.30*Math.sin(row*2.1+shape*6)),y=row/3;
    vertex(x,y,.008-x*x/.24,algae,.63+.12*Math.sin(row+col));
    if(row&&col){const n=row*4+col;indices.push(n,n-4,n-1,n-1,n-4,n-5);}
  }
  const fronds=2+Math.floor(random()*4);
  for(let frond=0;frond<fronds;frond++){
    const start=positions.length/3,length=.42+random()*.56,side=(random()-.5)*.11,wave=3+random()*5,curl=.02+random()*.065;
    for(let row=0;row<=5;row++)for(const rib of [-1,1]){
      const t=row/5,breadth=Math.sin(Math.PI*t)*(variant===1?.034:.006);
      // Narrow filaments cling along the pile, with a small curled free tip.
      vertex(side+Math.sin(t*wave+frond)*.023*t+frondLean*t+rib*breadth,t*length,.008+Math.pow(t,3)*curl,algae,.75+t*.23);
      if(row&&rib===1){const n=start+row*2+1;indices.push(n,n-2,n-1,n-1,n-2,n-3);}
    }
  }
  const barnacleCount=2+Math.floor(random()*3);
  for(let barnacle=0;barnacle<barnacleCount;barnacle++){
    const start=positions.length/3,cx=(random()-.5)*.115,cy=.10+random()*.78,r=.014+random()*.02,stretch=1.4+random()*1.25,lip=.021+random()*.025;
    for(const [radius,z]of [[r,.002],[r*.72,lip],[r*.30,lip*.72]])for(let side=0;side<7;side++){
      const angle=side/7*Math.PI*2+shellTilt;
      vertex(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius*stretch,z,shell,side%2?.8:1);
    }
    for(let ring=0;ring<2;ring++)for(let side=0;side<7;side++){
      const a=start+ring*7+side,b=start+ring*7+(side+1)%7;
      indices.push(a,b,a+7,b,b+7,a+7);
    }
  }
  const mussel=new Color(variant===1?'#425d6d':'#364755'),oyster=new Color('#c0b5a0');
  const shellCount=2+Math.floor(random()*4);
  for(let shellIndex=0;shellIndex<shellCount;shellIndex++){
    const start=positions.length/3,cx=(random()-.5)*.11,cy=.12+random()*.74,angleOffset=(random()-.5)*.85;
    const width=.012+random()*.020,height=.055+random()*.09;
    const isOyster=random()<.35,paint=(isOyster?oyster:mussel).clone().multiplyScalar(.85+random()*.3);
    for(let ring=0;ring<3;ring++)for(let side=0;side<8;side++){
      const angle=side*Math.PI/4,r=ring===0?1:ring===1?.80:.16;
      const ripple=isOyster?1+.16*Math.sin(side*2.7+shape*6):1,dx=Math.cos(angle)*width*r*ripple,dy=Math.sin(angle)*height*r;
      vertex(cx+dx*Math.cos(angleOffset)-dy*Math.sin(angleOffset),cy+dx*Math.sin(angleOffset)+dy*Math.cos(angleOffset),ring===1?.038:ring===2?.041:.001,paint,.72+side*.032+ring*.07);
    }
    for(let ring=0;ring<2;ring++)for(let side=0;side<8;side++){const a=start+ring*8+side,b=start+ring*8+(side+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}
  }
  // Bend each integrated patch around a pile face. It hugs the shaft as it rises.
  for(let i=0;i<positions.length;i+=3){const x=positions[i];positions[i]=Math.sin(x/.12)*.12;positions[i+2]+=Math.cos(x/.12)*.12-.12;}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

/** Every colony gets its own seeded morphology; static geometry still uses one draw. */
export function createDockGrowthGeometry(sites:readonly {x:number;y:number;z:number;rotation:number;height:number;radius:number;variant:number;seed:number}[]) {
  const placement=new Object3D(),parts=sites.map(site=>{
    const geometry=createDockWeedGeometry(site.variant,site.seed);
    placement.position.set(site.x,site.y,site.z);placement.rotation.set(0,site.rotation,0);placement.scale.set(site.radius/.12,site.height,site.radius/.12);placement.updateMatrix();geometry.applyMatrix4(placement.matrix);return geometry;
  });
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());geometry.computeBoundingSphere();return geometry;
}

export function DockEcology() {
  const scene = useMemo(() => {
    const sites=createDockWeedSites(),geometry=createDockGrowthGeometry(sites);
    const material=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.94,metalness:0});
    const mesh=new Mesh(geometry,material);mesh.name='dock-pole-attached-algae';mesh.userData.dockGrowth=true;mesh.raycast=()=>{};
    return {mesh,geometry,material,timer:undefined as ReturnType<typeof setTimeout>|undefined};
  }, []);
  useEffect(() => {
    clearTimeout(scene.timer);
    return () => {scene.timer=setTimeout(()=>{scene.geometry.dispose();scene.material.dispose();},0);};
  }, [scene]);
  return <group name="dock-ecology" dispose={null}><primitive object={scene.mesh}/></group>;
}
