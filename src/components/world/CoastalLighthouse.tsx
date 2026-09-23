'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, Float32BufferAttribute, FrontSide, LatheGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { world } from '../../content/world';
import { combine, roundedBox, stroke, strut, TAU, usePalette, useResources, type ModelProps } from './BuildingKit';
import { createLighthouseActivation, lighthouseSignal, LIGHTHOUSE_INTERACTION, stepLighthouseSignal } from './lighthouseSignal';

export const LIGHTHOUSE_OPENINGS = [
  { name: 'door', bottom: 1.02, top: 2.02, halfAngle: .30, recess: .075 },
  { name: 'lower-window', bottom: 2.96, top: 3.40, halfAngle: .19, recess: .045 },
  { name: 'upper-window', bottom: 4.10, top: 4.50, halfAngle: .19, recess: .045 },
] as const;
export function lighthouseRadius(y: number) { const t = (y - 1.02) / 4.24; return .87 - .44 * t + .045 * Math.sin(Math.PI * t); }
function masonryShell() {
  const ys = [...new Set([1.02,5.26,...LIGHTHOUSE_OPENINGS.flatMap(o=>[o.bottom,o.top]),...Array.from({length:17},(_,i)=>1.02+4.24*i/16)])].sort((a,b)=>a-b);
  const angles = [...new Set([-Math.PI,Math.PI,-.30,.30,-.19,.19,...Array.from({length:49},(_,i)=>-Math.PI+i/48*TAU)])].sort((a,b)=>a-b);
  const vertices:number[]=[],indices:number[]=[];
  function point(angle:number,y:number,inset=0){const r=lighthouseRadius(y)-inset;return [Math.sin(angle)*r,y,Math.cos(angle)*r];}
  function quad(a:number[],b:number[],c:number[],d:number[]){const n=vertices.length/3;vertices.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);}
  for(let row=1;row<ys.length;row++)for(let column=1;column<angles.length;column++){
    const bottom=ys[row-1],top=ys[row],a=angles[column-1],b=angles[column];
    if(LIGHTHOUSE_OPENINGS.some(o=>(bottom+top)/2>o.bottom&&(bottom+top)/2<o.top&&Math.abs((a+b)/2)<o.halfAngle))continue;
    quad(point(a,bottom),point(b,bottom),point(b,top),point(a,top));
    quad(point(b,bottom,.12),point(a,bottom,.12),point(a,top,.12),point(b,top,.12));
  }
  for(const opening of LIGHTHOUSE_OPENINGS){
    const a=-opening.halfAngle,b=opening.halfAngle;
    quad(point(a,opening.bottom),point(a,opening.top),point(a,opening.top,.12),point(a,opening.bottom,.12));
    quad(point(b,opening.top),point(b,opening.bottom),point(b,opening.bottom,.12),point(b,opening.top,.12));
    for(const y of [opening.bottom,opening.top])quad(point(a,y),point(b,y),point(b,y,.12),point(a,y,.12));
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.openings=LIGHTHOUSE_OPENINGS;return geometry;
}
export function createLighthouseGeometry(){
  const circle=(radius:number,y:number)=>(t:number)=>new Vector3(Math.sin(t*TAU)*radius,y,Math.cos(t*TAU)*radius);
  // Four-sided mortar strokes retain smooth courses without oversampling subpixel tube profiles.
  const mortarStroke=(point:(t:number)=>Vector3)=>new TubeGeometry(new CatmullRomCurve3(Array.from({length:65},(_,i)=>point(i/64))),64,.004,4,false);
  const seams:BufferGeometry[]=[];
  for(let course=0;course<13;course++){
    const y=1.18+course*.31;const gap=LIGHTHOUSE_OPENINGS.find(o=>y>o.bottom&&y<o.top)?.halfAngle??0;
    seams.push(mortarStroke(t=>{const a=gap+(TAU-gap*2)*t;return new Vector3(Math.sin(a)*(lighthouseRadius(y)+.002),y,Math.cos(a)*(lighthouseRadius(y)+.002));}));
    for(let joint=0;joint<10;joint++){
      const a=(joint+(course%2)*.5)*TAU/10;const signed=Math.atan2(Math.sin(a),Math.cos(a));
      if(LIGHTHOUSE_OPENINGS.some(o=>y+.15>o.bottom&&y-.15<o.top&&Math.abs(signed)<o.halfAngle+.03))continue;
      seams.push(strut(new Vector3(Math.sin(a)*(lighthouseRadius(y-.14)+.003),y-.14,Math.cos(a)*(lighthouseRadius(y-.14)+.003)),new Vector3(Math.sin(a)*(lighthouseRadius(y+.14)+.003),y+.14,Math.cos(a)*(lighthouseRadius(y+.14)+.003)),.006));
    }
  }
  const windowFrames:BufferGeometry[]=[],windowGlass:BufferGeometry[]=[],sills:BufferGeometry[]=[];
  for(const opening of LIGHTHOUSE_OPENINGS.slice(1)){
    const y=(opening.bottom+opening.top)/2,r=lighthouseRadius(y),width=Math.sin(opening.halfAngle)*r*2,height=opening.top-opening.bottom,z=Math.cos(opening.halfAngle)*r;
    windowGlass.push(new BoxGeometry(width-.025,height-.035,.018).translate(0,y,z-opening.recess));
    windowFrames.push(new BoxGeometry(.035,height+.06,.11).translate(-width/2,y,z-.018),new BoxGeometry(.035,height+.06,.11).translate(width/2,y,z-.018),new BoxGeometry(width+.065,.045,.12).translate(0,opening.top+.01,z-.005),new BoxGeometry(.018,height,.025).translate(0,y,z+.012));
    sills.push(new BoxGeometry(width+.10,.055,.20).translate(0,opening.bottom-.013,z+.025));
  }
  const brackets=Array.from({length:10},(_,i)=>{const a=i*TAU/10;return strut(new Vector3(Math.sin(a)*.51,4.76,Math.cos(a)*.51),new Vector3(Math.sin(a)*1.04,5.17,Math.cos(a)*1.04),.044);});
  const doorCenter=1.52,doorZ=.725;
  return {
    foundation:new CylinderGeometry(1.12,1.16,.22,72).translate(0,.91,0), shaft:masonryShell(),masonrySeams:combine(seams),
    balcony:new CylinderGeometry(1.13,1.13,.13,72).translate(0,5.235,0),balconyBrackets:combine(brackets),
    rails:combine([stroke(circle(1.09,5.83),.025,48),stroke(circle(1.09,5.48),.017,48),...Array.from({length:14},(_,i)=>{const a=i*TAU/14;return strut(new Vector3(Math.sin(a)*1.09,5.30,Math.cos(a)*1.09),new Vector3(Math.sin(a)*1.09,5.83,Math.cos(a)*1.09),.021);})]),
    lantern:new CylinderGeometry(.58,.58,1.04,72,1,true).translate(0,5.98,0),
    frames:combine([stroke(circle(.64,5.48),.038,72),stroke(circle(.64,6.49),.038,72),...Array.from({length:8},(_,i)=>{const a=i*TAU/8;return strut(new Vector3(Math.sin(a)*.63,5.47,Math.cos(a)*.63),new Vector3(Math.sin(a)*.63,6.50,Math.cos(a)*.63),.025);})]),
    cap:new LatheGeometry([[0,6.49],[.78,6.49],[.81,6.54],[.69,6.62],[.4,6.83],[.13,6.98],[0,7.035]].map(([r,y])=>new Vector2(r,y)),72),
    roofSeams:combine(Array.from({length:12},(_,i)=>{const a=i*TAU/12;return strut(new Vector3(Math.sin(a)*.72,6.60,Math.cos(a)*.72),new Vector3(Math.sin(a)*.14,6.985,Math.cos(a)*.14),.012);})),
    finial:new SphereGeometry(.07,16,10).translate(0,7.07,0),
    door:roundedBox(.43,.96,.045,.06).translate(0,doorCenter,doorZ),
    doorFrames:combine([new BoxGeometry(.055,1.06,.14).translate(-.263,doorCenter,.81),new BoxGeometry(.055,1.06,.14).translate(.263,doorCenter,.81),new BoxGeometry(.58,.08,.16).translate(0,2.025,.81)]),
    doorHardware:combine([new BoxGeometry(.02,.13,.018).translate(.135,1.48,.775),new SphereGeometry(.025,12,8).translate(.135,1.48,.79),new BoxGeometry(.19,.06,.02).translate(0,1.79,.777)]),
    windowFrames:combine(windowFrames),windowGlass:combine(windowGlass),sills:combine(sills),
    threshold:new BoxGeometry(.65,.08,.35).translate(0,1.02,1.02),
    drainage:combine([stroke(t=>{const y=1.27+t*3.86,r=lighthouseRadius(y)+.037;return new Vector3(-r*.94,y,-r*.34);},.025,40),...Array.from({length:5},(_,i)=>{const y=1.45+i*.75,r=lighthouseRadius(y)+.037;return new TorusGeometry(.029,.008,6,12).rotateX(Math.PI/2).translate(-r*.94,y,-r*.34);}),new CylinderGeometry(.032,.032,.20,10).rotateZ(.7).translate(-.85,1.20,-.29)]),
    maintenance:combine([new BoxGeometry(.22,.29,.07).translate(.30,5.75,-.55),...Array.from({length:4},(_,i)=>new BoxGeometry(.25,.02,.065).translate(.30,5.65+i*.065,-.605)),new CylinderGeometry(.04,.045,.20,12).translate(.45,6.77,-.16),new CylinderGeometry(.07,.07,.045,12).translate(.45,6.88,-.16)]),
    serviceLadder:combine([
      ...[-.16,.16].map(x=>strut(new Vector3(x,1.24,-.94),new Vector3(x,5.34,-.69),.018)),
      ...Array.from({length:17},(_,i)=>{const y=1.36+i*.235,z=-.94+(y-1.24)/4.1*.25;return strut(new Vector3(-.17,y,z),new Vector3(.17,y,z),.016);}),
      ...[1.45,2.5,3.55,4.6].flatMap(y=>[-.16,.16].map(x=>strut(new Vector3(x,y,-.94+(y-1.24)/4.1*.25),new Vector3(x,y,-lighthouseRadius(y)+.025),.017))),
    ]),
    doorPanels:combine([
      ...[1.29,1.73].map(y=>new BoxGeometry(.33,.28,.016).translate(0,y,.755)),
      ...[1.18,1.86].map(y=>new BoxGeometry(.075,.033,.033).translate(-.19,y,.768)),
      new BoxGeometry(.13,.018,.035).translate(.115,1.48,.80),
      new BoxGeometry(.51,.028,.21).translate(0,2.09,.83),
    ]),
    lanternVentRing:combine([
      stroke(circle(.65,5.43),.021,48),stroke(circle(.65,6.43),.021,48),
      ...Array.from({length:24},(_,i)=>{const a=i*TAU/24;return new BoxGeometry(.045,.065,.018).rotateY(a).translate(Math.sin(a)*.645,6.445,Math.cos(a)*.645);}),
      ...Array.from({length:8},(_,i)=>{const a=i*TAU/8;return new BoxGeometry(.072,.035,.052).rotateY(a).translate(Math.sin(a)*.64,5.49,Math.cos(a)*.64);}),
    ]),
    hitbox:new CylinderGeometry(.82,.82,1.24,24),
    beam:new CylinderGeometry(1.35,.08,10,32,1,true).rotateZ(Math.PI/2).translate(-5,0,0),
  };
}

function createLighthouseResources(){
  const parts=createLighthouseGeometry();
  return {...parts,
    stoneBatch:combine([parts.foundation,parts.sills,parts.threshold].map(part=>part.clone())),
    metalBatch:combine([parts.rails,parts.frames,parts.roofSeams,parts.finial,parts.windowFrames,parts.drainage,parts.serviceLadder,parts.lanternVentRing].map(part=>part.clone())),
    porcelainBatch:combine([parts.balcony,parts.cap,parts.doorFrames].map(part=>part.clone())),
    navyBatch:combine([parts.balconyBrackets,parts.door,parts.maintenance,parts.doorPanels].map(part=>part.clone())),
  };
}

export function LighthouseFocusButton({activate}:{activate:()=>void}){
  return <button type="button" className="lighthouse-focus-control" aria-label={LIGHTHOUSE_INTERACTION.label} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();activate();}} style={{width:44,height:44,padding:0,border:'2px solid transparent',borderRadius:'50%',outline:'none',background:'transparent',cursor:'pointer',pointerEvents:'auto'}}/>;
}
export function CoastalLighthouse(props:ModelProps){
  const invalidate=useThree(state=>state.invalidate);
  const canvas=useThree(state=>state.gl.domElement);
  const portal=useMemo(()=>canvas.parentElement?{current:canvas.parentElement}:null,[canvas]);
  const [activation]=useState(()=>createLighthouseActivation(props.runtime.current,invalidate));
  useEffect(()=>()=>activation.dispose(),[activation]);
  const palette=usePalette(props,'building'),geometry=useResources(createLighthouseResources),beam=useRef<Mesh<BufferGeometry,MeshPhysicalMaterial>>(null);
  const [materials]=useState(()=>{
    const beam=new MeshPhysicalMaterial({name:'soft-additive-lighthouse-beam',color:'#ddffff',emissive:'#c9ffff',emissiveIntensity:world.lighting.lampIntensity,transparent:true,opacity:.008,roughness:1,metalness:0,depthWrite:false,side:FrontSide,blending:AdditiveBlending,toneMapped:false});
    // The open frustum has no cap. Fade both ends in the material so its distant
    // rim cannot become a screen-space disc when the signal intensifies.
    beam.userData.softVolume=true;
    beam.onBeforeCompile=shader=>{
      shader.vertexShader=`varying float vBeamLength;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\n vBeamLength = clamp(-position.x / 10., 0., 1.);');
      shader.fragmentShader=`varying float vBeamLength;\n${shader.fragmentShader}`.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\n diffuseColor.a *= smoothstep(0., .16, vBeamLength) * (1. - smoothstep(.68, 1., vBeamLength));');
    };
    beam.customProgramCacheKey=()=> 'soft-open-beam-v1';
    return{hitbox:new MeshStandardMaterial({name:'lighthouse-interaction-proxy',visible:false,colorWrite:false,depthWrite:false}),masonry:new MeshStandardMaterial({name:'weathered-painted-masonry',color:'#e9e8da',roughness:.83,metalness:0,side:DoubleSide}),mortar:new MeshStandardMaterial({color:'#b0b8ac',roughness:1}),beam};
  });
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),rotation=useRef(0),dragCount=useRef(0);
  useEffect(()=>{clearTimeout(timer.current);return()=>{timer.current=setTimeout(()=>Object.values(materials).forEach(m=>m.dispose()),0);};},[materials]);
  useFrame((_,delta)=>{
    const signal=lighthouseSignal(props.runtime.current);stepLighthouseSignal(signal,delta,props.paused);
    if(!props.paused)rotation.current=Math.sin(props.runtime.current.elapsed*.12)*Math.PI*35/180;
    if(beam.current){beam.current.rotation.y=rotation.current;beam.current.material.opacity=world.lighting.lampEnabled ? (props.active ? .035 : props.runtime.current.hovered==='building' ? .025 : .008)+signal.intensity*.045 : 0;beam.current.material.emissiveIntensity=world.lighting.lampEnabled?world.lighting.lampIntensity+signal.intensity*1.4:0;}
  },-1);
  const activate=activation.activate;
  return <group dispose={null} name="detailed-coastal-lighthouse">
    <mesh name="lighthouse-circular-foundation" geometry={geometry.stoneBatch} material={palette.paving} receiveShadow castShadow/>
    <mesh name="lighthouse-taper" geometry={geometry.shaft} material={materials.masonry} castShadow receiveShadow/>
    <mesh name="lighthouse-masonry-joints" geometry={geometry.masonrySeams} material={materials.mortar}/>
    <mesh name="lighthouse-supported-balcony" geometry={geometry.porcelainBatch} material={palette.porcelain} castShadow/>
    <mesh name="lighthouse-balcony-brackets" geometry={geometry.navyBatch} material={palette.navy}/>
    <mesh name="lighthouse-balcony-rails" geometry={geometry.metalBatch} material={palette.edge}/>
    <mesh name="lighthouse-glazed-lantern" geometry={geometry.lantern} material={palette.glass}/>
    <mesh geometry={geometry.doorHardware} material={palette.gold}/>
    <mesh name="lighthouse-recessed-windows" geometry={geometry.windowGlass} material={palette.windowBacking}/>
    <mesh name="signal-light-sweep" ref={beam} geometry={geometry.beam} material={materials.beam} position-y={6} raycast={()=>{}}/>
    <mesh name="lighthouse-lantern-hit" geometry={geometry.hitbox} material={materials.hitbox} position={[0,6,0]} userData={{cameraInteraction:true}} onPointerDown={event=>{event.stopPropagation();dragCount.current=props.runtime.current.dragCount;}} onClick={event=>{event.stopPropagation();if(event.delta<6&&!props.runtime.current.dragging&&dragCount.current===props.runtime.current.dragCount)activate();}}/>
    {typeof document!=='undefined'&&portal&&<Html portal={portal} center position={[0,6,.76]} zIndexRange={[15,0]} style={{pointerEvents:'none'}}><LighthouseFocusButton activate={activate}/></Html>}
  </group>;
}
