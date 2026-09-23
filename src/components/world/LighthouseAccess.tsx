'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainMeshHeight } from './terrain';
import { applySurface } from './surfaceMaterials';

export const LIGHTHOUSE_LANDING = { x: -68.0, z: -35.5, top: .52, width: 2.05, depth: 2.1 } as const;
export const LIGHTHOUSE_WALK = [[-68.0, -35.5], [-70.2, -35.5], [-71.35, -33.35], [-73.1, -32.25], [-74.1, -34]] as const;
export function lighthouseAccessCurve() {
  const plan = new CatmullRomCurve3(LIGHTHOUSE_WALK.map(([x,z]) => new Vector3(x,0,z)),false,'centripetal');
  const count=64, points=plan.getSpacedPoints(count);
  const heights=points.map((p,i)=>{
    const tangent=plan.getTangentAt(i/count),side=new Vector3(tangent.z,0,-tangent.x).normalize();
    return Math.max(LIGHTHOUSE_LANDING.top,...[-.76,0,.76].map(offset=>terrainMeshHeight(p.x+side.x*offset,p.z+side.z*offset)+.22));
  });
  // The minimal Lipschitz envelope clears the full tread width while limiting
  // each rise. Starts rising offshore, instead of cutting through the bank.
  for(let i=1;i<=count;i++)heights[i]=Math.max(heights[i],heights[i-1]-.085);
  for(let i=count-1;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-.085);
  points.forEach((p,i)=>{p.y=heights[i];});
  return new CatmullRomCurve3(points,false,'centripetal');
}
export function createLighthouseAccess() {
  const root = new Group(); root.name = 'lighthouse-coastal-stairway';
  const wood = applySurface(new MeshStandardMaterial({color:'#c4a477'}),'cedar');
  const structure = new MeshStandardMaterial({color:'#286c80',roughness:.38,metalness:.5});
  const light = new MeshStandardMaterial({color:'#a3f9e9',emissive:'#58dec7',emissiveIntensity:.45});
  const curve=lighthouseAccessCurve(),length=curve.getLength(),steps=Math.ceil(length/.22);
  const treads:BoxGeometry[]=[],posts:CylinderGeometry[]=[],lights:BoxGeometry[]=[],details:BufferGeometry[]=[],braces:BufferGeometry[]=[],fenders:BufferGeometry[]=[];
  const rails:Vector3[][]=[[],[]];
  const beam=(a:Vector3,b:Vector3,radius=.035)=>{const delta=b.clone().sub(a);return new CylinderGeometry(radius,radius,delta.length(),8).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());};
  for(let i=0;i<=steps;i++) {
    const t=i/steps,p=curve.getPointAt(t),tangent=curve.getTangentAt(t),yaw=Math.atan2(tangent.x,tangent.z);
    const side=new Vector3(tangent.z,0,-tangent.x).normalize();
    for(const offset of [-.453,0,.453]) treads.push(new BoxGeometry(.443,.14,length/steps+.20).translate(offset,0,0).rotateY(yaw).translate(p.x,p.y-.07,p.z));
    for(const [j,sign] of [-1,1].entries()){
      const q=p.clone().addScaledVector(side,sign*.65);rails[j].push(q.clone().add(new Vector3(0,.95,0)));
      if(i%4===0||i===steps){const bottom=Math.min(p.y-.16,terrainMeshHeight(q.x,q.z)-.08),top=p.y+.95;posts.push(new CylinderGeometry(.045,.045,top-bottom,10).translate(q.x,(top+bottom)/2,q.z));
        if(i>0){const prior=curve.getPointAt(Math.max(0,(i-4)/steps));braces.push(beam(new Vector3(q.x,p.y-.14,q.z),new Vector3(prior.x+side.x*sign*.65,Math.max(bottom+.1,prior.y-.9),prior.z+side.z*sign*.65),.045));}
      }
    }
    if(i%5===0) lights.push(new BoxGeometry(.18,.025,.06).rotateY(yaw).translate(p.x,p.y+.015,p.z));
  }
  const add=(geometry:BufferGeometry|null,material:MeshStandardMaterial,name:string)=>{if(!geometry)return;const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);};
  add(mergeGeometries(treads),wood,'lighthouse-graded-treads');
  add(mergeGeometries(posts),structure,'lighthouse-bearing-piles-and-posts');
  add(mergeGeometries(lights),light,'lighthouse-tread-lights');
  for(const points of rails){
    add(new TubeGeometry(new CatmullRomCurve3(points),112,.035,8,false),structure,'lighthouse-continuous-handrail');
    add(new TubeGeometry(new CatmullRomCurve3(points.map(p=>p.clone().add(new Vector3(0,-.47,0)))),112,.021,6,false),structure,'lighthouse-midrail');
    add(new TubeGeometry(new CatmullRomCurve3(points.map(p=>p.clone().add(new Vector3(0,-1.13,0)))),112,.065,6,false),wood,'lighthouse-stair-stringer');
  }
  const upper=curve.getPointAt(1),court:BufferGeometry[]=[];
  // Three shallow returns meet the existing stone court instead of ending in a tall drop.
  for(const [x,z,top] of [[-74.17,-33.97,upper.y],[-74.48,-33.95,2.90],[-74.79,-33.93,2.84]])court.push(new BoxGeometry(.39,.10,.90).translate(x,top-.05,z));
  add(mergeGeometries(court),wood,'lighthouse-upper-court-steps');
  court.forEach(geometry=>geometry.dispose());
  const landing=LIGHTHOUSE_LANDING,deck:BufferGeometry[]=[],piles:BufferGeometry[]=[];
  for(let board=0;board<10;board++)deck.push(new BoxGeometry(landing.width,.18,.202).translate(landing.x,landing.top-.09,landing.z-landing.depth/2+.105+board*.21));
  add(mergeGeometries(deck),wood,'lighthouse-arrival-deck');
  for(const dx of [-.84,.84])for(const dz of [-.87,.87]){
    const x=landing.x+dx,z=landing.z+dz,bottom=terrainMeshHeight(x,z)-.25,top=landing.top-.12;
    piles.push(new CylinderGeometry(.085,.105,top-bottom,12).translate(x,(bottom+top)/2,z));
    details.push(new CylinderGeometry(.11,.11,.12,12).translate(x,.03,z));
  }
  add(mergeGeometries(piles),wood,'lighthouse-landing-seabed-piles');
  for(const dz of [-.92,.92]){
    const z=landing.z+dz;
    details.push(beam(new Vector3(landing.x-.9,landing.top+.82,z),new Vector3(landing.x+.5,landing.top+.82,z)));
    for(const dx of [-.9,.5])details.push(beam(new Vector3(landing.x+dx,landing.top,z),new Vector3(landing.x+dx,landing.top+.82,z)));
    // Mooring cleats have broad feet, paired stems and a horizontal horn.
    details.push(new BoxGeometry(.26,.035,.13).translate(landing.x+.71,landing.top+.02,z),new CylinderGeometry(.026,.026,.11,8).translate(landing.x+.71,landing.top+.085,z),new CylinderGeometry(.024,.024,.31,8).rotateZ(Math.PI/2).translate(landing.x+.71,landing.top+.14,z));
    fenders.push(new CylinderGeometry(.10,.10,.55,12).translate(landing.x+1.10,.16,landing.z+dz*.77));
    details.push(new TorusGeometry(.082,.013,6,16).rotateY(Math.PI/2).translate(landing.x+1.06,.51,landing.z+dz*.77));
  }
  // Boarding ladder reaches below mean water level on the open offshore edge.
  for(const dz of [-.24,.24])details.push(beam(new Vector3(landing.x+1.03,-.75,landing.z+dz),new Vector3(landing.x+1.03,1.03,landing.z+dz),.027));
  for(let rung=0;rung<6;rung++)details.push(beam(new Vector3(landing.x+1.03,-.63+rung*.23,landing.z-.24),new Vector3(landing.x+1.03,-.63+rung*.23,landing.z+.24),.022));
  add(mergeGeometries(details),structure,'lighthouse-mooring-hardware-and-ladder');
  add(mergeGeometries(braces),structure,'lighthouse-under-stair-cross-braces');
  const rubber=new MeshStandardMaterial({color:'#243d42',roughness:.93});
  add(mergeGeometries(fenders),rubber,'lighthouse-boat-fenders');
  [...treads,...posts,...lights,...details,...braces,...fenders,...deck,...piles].forEach(g=>g.dispose());
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  const dispose=()=>{root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});wood.dispose();structure.dispose();light.dispose();rubber.dispose();};
  return {root,dispose,retain(){clearTimeout(disposeTimer);return()=>{disposeTimer=setTimeout(dispose,0);};}};
}
export function LighthouseAccess(){
  const access=useMemo(() => createLighthouseAccess(),[]);
  useEffect(()=>access.retain(),[access]);
  return <primitive object={access.root} dispose={null}/>;
}
