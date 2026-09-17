'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainMeshHeight } from './terrain';
import { applySurface } from './surfaceMaterials';

export const LIGHTHOUSE_WALK = [[-69.6, -35.5], [-71.35, -33.35], [-73.1, -32.25], [-74.1, -34]] as const;
export function lighthouseAccessCurve() {
  const plan = new CatmullRomCurve3(LIGHTHOUSE_WALK.map(([x,z]) => new Vector3(x,0,z)),false,'centripetal');
  const count=48, points=plan.getSpacedPoints(count);
  const heights=points.map((p,i)=>{
    const tangent=plan.getTangentAt(i/count),side=new Vector3(tangent.z,0,-tangent.x).normalize();
    return Math.max(.84,...[-.76,0,.76].map(offset=>terrainMeshHeight(p.x+side.x*offset,p.z+side.z*offset)+.22));
  });
  // The minimal Lipschitz envelope clears the full tread width while limiting
  // each rise. Starts rising offshore, instead of cutting through the bank.
  for(let i=1;i<=count;i++)heights[i]=Math.max(heights[i],heights[i-1]-.115);
  for(let i=count-1;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-.115);
  points.forEach((p,i)=>{p.y=heights[i];});
  return new CatmullRomCurve3(points,false,'centripetal');
}
export function createLighthouseAccess() {
  const root = new Group(); root.name = 'lighthouse-coastal-stairway';
  const wood = applySurface(new MeshStandardMaterial({color:'#c4a477'}),'cedar');
  const structure = new MeshStandardMaterial({color:'#286c80',roughness:.38,metalness:.5});
  const light = new MeshStandardMaterial({color:'#a3f9e9',emissive:'#58dec7',emissiveIntensity:.45});
  const curve=lighthouseAccessCurve(),length=curve.getLength(),steps=Math.ceil(length/.22);
  const treads:BoxGeometry[]=[],posts:CylinderGeometry[]=[],lights:BoxGeometry[]=[];
  const rails:Vector3[][]=[[],[]];
  for(let i=0;i<=steps;i++) {
    const t=i/steps,p=curve.getPointAt(t),tangent=curve.getTangentAt(t),yaw=Math.atan2(tangent.x,tangent.z);
    const side=new Vector3(tangent.z,0,-tangent.x).normalize();
    treads.push(new BoxGeometry(1.35,.14,length/steps+.09).rotateY(yaw).translate(p.x,p.y-.07,p.z));
    for(const [j,sign] of [-1,1].entries()){
      const q=p.clone().addScaledVector(side,sign*.65);rails[j].push(q.clone().add(new Vector3(0,.95,0)));
      if(i%4===0||i===steps){const bottom=Math.min(p.y-.16,terrainMeshHeight(q.x,q.z)-.08),top=p.y+.95;posts.push(new CylinderGeometry(.035,.035,top-bottom,10).translate(q.x,(top+bottom)/2,q.z));}
    }
    if(i%5===0) lights.push(new BoxGeometry(.18,.025,.06).rotateY(yaw).translate(p.x,p.y+.015,p.z));
  }
  const add=(geometry:BoxGeometry|TubeGeometry|ReturnType<typeof mergeGeometries>,material:MeshStandardMaterial,name:string)=>{if(!geometry)return;const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);};
  add(mergeGeometries(treads),wood,'lighthouse-graded-treads');
  add(mergeGeometries(posts),structure,'lighthouse-bearing-piles-and-posts');
  add(mergeGeometries(lights),light,'lighthouse-tread-lights');
  for(const points of rails)add(new TubeGeometry(new CatmullRomCurve3(points),96,.035,8,false),structure,'lighthouse-continuous-handrail');
  add(new BoxGeometry(2.05,.18,2.1).translate(-69.6,curve.getPointAt(0).y-.09,-35.5),wood,'lighthouse-arrival-deck');
  [...treads,...posts,...lights].forEach(g=>g.dispose());
  let disposeTimer: ReturnType<typeof setTimeout> | undefined;
  const dispose=()=>{root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});wood.dispose();structure.dispose();light.dispose();};
  return {root,dispose,retain(){clearTimeout(disposeTimer);return()=>{disposeTimer=setTimeout(dispose,0);};}};
}
export function LighthouseAccess(){
  const access=useMemo(() => createLighthouseAccess(),[]);
  useEffect(()=>access.retain(),[access]);
  return <primitive object={access.root} dispose={null}/>;
}
