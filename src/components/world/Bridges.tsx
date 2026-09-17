'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, Curve, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BRIDGES, type BridgePlan } from './bridgePlan';
import { terrainHeight } from './terrain';

class RailCurve extends Curve<Vector3> {
  constructor(private points: Vector3[]) { super(); }
  getPoint(t: number, target = new Vector3()) {
    const index = Math.min(this.points.length-2,Math.floor(t*(this.points.length-1)));
    return target.copy(this.points[index]).lerp(this.points[index+1],t*(this.points.length-1)-index);
  }
}
export function bridgeDeckGeometry(bridge: BridgePlan) {
  const positions:number[]=[],indices:number[]=[];
  for (const {point,normal} of bridge.samples) {
    for (const [side,below] of [[-1,0],[1,0],[-1,1],[1,1]]) {
      positions.push(point.x+normal.x*side*bridge.width/2,point.y-below*bridge.thickness,point.z+normal.z*side*bridge.width/2);
    }
  }
  for(let i=0;i<bridge.samples.length-1;i++) {
    const a=i*4,b=a+4;
    indices.push(a,a+1,b,a+1,b+1,b, a+2,b+2,a+3,a+3,b+2,b+3, a,b,a+2,a+2,b,b+2, a+1,a+3,b+1,a+3,b+3,b+1);
  }
  const last=(bridge.samples.length-1)*4;
  indices.push(0,2,1,1,2,3,last,last+1,last+2,last+1,last+3,last+2);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createBridges() {
  const root=new Group();root.name='coastal-bridges';
  const shell=new MeshPhysicalMaterial({color:'#eef8f2',roughness:.32,clearcoat:.55});
  const rail=new MeshPhysicalMaterial({color:'#fcfffa',roughness:.24,metalness:.12,clearcoat:.7});
  const base=new MeshPhysicalMaterial({color:'#aabcbc',roughness:.8});
  const add=(geometry:BufferGeometry,material:MeshPhysicalMaterial,name:string)=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);return mesh;};
  for(const bridge of BRIDGES) {
    const posts: BufferGeometry[] = [];
    add(bridgeDeckGeometry(bridge),shell,`bridge-${bridge.id}-deck`);
    for(const side of [-1,1]) {
      const points=bridge.samples.map(({point,normal})=>point.clone().addScaledVector(normal,side*bridge.width/2).add(new Vector3(0,bridge.railHeight,0)));
      add(new TubeGeometry(new RailCurve(points),96,.04,8,false),rail,`bridge-${bridge.id}-rail-${side}`);
      for(let i=0;i<bridge.samples.length;i+=6){const p=points[i];posts.push(new CylinderGeometry(.035,.035,bridge.railHeight,8).translate(p.x,p.y-bridge.railHeight/2,p.z));}
    }
    add(mergeGeometries(posts)!,rail,`bridge-${bridge.id}-posts`);posts.forEach(geometry=>geometry.dispose());
    for(let i=12;i<bridge.samples.length-12;i+=18) {
      const {point,normal}=bridge.samples[i];
      for(const side of [-1,1]) {
        const p=point.clone().addScaledVector(normal,side*bridge.width*.35);
        const bottom=terrainHeight(p.x,p.z)-.08,top=p.y-bridge.thickness;
        add(new CylinderGeometry(.105,.17,top-bottom,10).translate(p.x,(top+bottom)/2,p.z),base,`bridge-${bridge.id}-support-${i}-${side}`);
      }
    }
    // The terrain owns the approach surface. Abutments sit entirely below the
    // deck, so there is no second horizontal cap competing with its pixels.
    bridge.landings.forEach((landing, i) => {
      const sample = bridge.samples[i ? bridge.samples.length - 1 : 0];
      const geometry = new BoxGeometry(bridge.width + .22, .38, .26);
      geometry.rotateY(Math.atan2(sample.normal.z, -sample.normal.x));
      geometry.translate(landing.x, landing.top - bridge.thickness - .2, landing.z);
      add(geometry, base, `bridge-${bridge.id}-abutment-${i}`);
    });
  }
  return {root,dispose(){root.traverse(object=>{if(object instanceof Mesh)object.geometry.dispose();});shell.dispose();rail.dispose();base.dispose();}};
}
export function Bridges() {
  const bridges=useMemo(()=>createBridges(),[]);
  useEffect(()=>{const retained=bridges as typeof bridges & {timer?:ReturnType<typeof setTimeout>};clearTimeout(retained.timer);return()=>{retained.timer=setTimeout(()=>bridges.dispose(),0);};},[bridges]);
  return <primitive object={bridges.root} dispose={null}/>;
}
