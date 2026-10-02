'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Shape, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';

export const FLIGHT_INTERVAL = 2280;
export const FLIGHT_DURATION = 112;

export function solarFlightPose(time: number, hour: number) {
  const cycle = Math.floor(Math.max(0, time - 150) / FLIGHT_INTERVAL);
  const age = ((time - 150) % FLIGHT_INTERVAL + FLIGHT_INTERVAL) % FLIGHT_INTERVAL;
  const u = age / FLIGHT_DURATION, reverse = cycle % 2 ? -1 : 1;
  return {
    visible: time >= 150 && age < FLIGHT_DURATION && hour > 7 && hour < 19.5,
    x: reverse * (-360 + 720 * u), y: 58 + 2.4 * Math.sin(Math.PI * u),
    z: -96 + 36 * Math.sin(Math.PI * u), yaw: Math.atan2(reverse * 720, -36 * Math.PI * Math.cos(Math.PI * u)),
    roll: reverse * Math.sin(Math.PI * u) * .045,
  };
}

function wing(points: number[][], thickness: number) {
  const shape = new Shape(); points.forEach(([x,z],i) => i ? shape.lineTo(x,z) : shape.moveTo(x,z)); shape.closePath();
  return new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .055, bevelThickness: .035 }).rotateX(Math.PI / 2);
}

/** A solar electric glider with a blended wing, enclosed propulsion and a glazed cockpit. */
export function makeSolarGlider() {
  const group = new Group(); group.name = 'solar-glider';
  const parts: BufferGeometry[][] = [[],[],[],[]];
  const fuselage = new SphereGeometry(1, 20, 12).scale(.62,.57,4.5);
  parts[0].push(fuselage);
  for (const side of [-1,1]) {
    const shape = wing([[0,-1.5],[side*2.2,-1.1],[side*8.8,1.8],[side*9,2.35],[side*2.1,1.3],[0,1.5]], .1);
    parts[0].push(shape);
    parts[0].push(wing([[0,2.9],[side*2.8,3.7],[side*2.9,4.35],[0,3.9]],.07).translate(0,.28,0));
    parts[1].push(new SphereGeometry(1,12,8).scale(.07,.28,.65).rotateZ(-side*.35).translate(side*8.82,.18,2.02));
    // Flush photovoltaic cells follow the swept wing rather than sitting above it on struts.
    for(let i=0;i<9;i++) {
      const reach=1.3+i*.72,x=side*reach;
      const leading=reach<2.2?-1.5+reach*.4/2.2:-1.1+(reach-2.2)*2.9/6.6;
      const trailing=reach<2.1?1.5-reach*.2/2.1:1.3+(reach-2.1)*1.05/6.9;
      const z=(leading+trailing)/2;
      parts[2].push(new BoxGeometry(.58,.016,.69).rotateY(side*-.1).translate(x,.043,z));
      parts[1].push(new BoxGeometry(.012,.018,.7).translate(x,.050,z));
    }
  }
  parts[1].push(new SphereGeometry(1,12,8).scale(.065,1.05,.95).rotateX(.18).translate(0,.6,3.5));
  // The two electric ducts are fully enclosed; no exposed blades or exhaust trail.
  for(const side of [-1,1]) {
    parts[0].push(new SphereGeometry(1,12,8).scale(.24,.21,.74).translate(side*.76,-.12,1.8));
    parts[2].push(new SphereGeometry(1,12,6).scale(.145,.12,.025).translate(side*.76,-.12,2.51));
  }
  parts[3].push(new SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2).scale(.48,.39,1.12).translate(0,.35,-2.04));
  parts[1].push(new BoxGeometry(.035,.045,2.02).translate(0,.38,-2.03));
  const materials = ['#edf7ec','#2ba7b9','#164f70','#6fb1c7'].map((color,index)=>new MeshStandardMaterial({color,roughness:index===0?.3:.38,metalness:index===2?.25:.05}));
  for(let i=0;i<parts.length;i++) {
    const sources=parts[i].map(part=>part.index?part.toNonIndexed():part);
    const geometry=mergeGeometries(sources)!;
    // Slightly varied pearl panels keep the airframe readable against pale cloud banks.
    if(i===0){const c=new Color('#d3eee3'),p=geometry.attributes.position,colors=new Float32Array(p.count*3);for(let n=0;n<p.count;n++){const shade=.93+.07*Math.cos(p.getX(n)*.8);colors.set([c.r*shade,c.g*shade,c.b*shade],n*3);}geometry.setAttribute('color',new Float32BufferAttribute(colors,3));materials[i].vertexColors=true;}
    group.add(new Mesh(geometry,materials[i]));
    sources.forEach((source,n)=>{source.dispose();if(source!==parts[i][n])parts[i][n].dispose();});
  }
  group.visible=false;
  return group;
}

function updateGlider(glider:Group,pose:ReturnType<typeof solarFlightPose>,moving:boolean) {
  glider.visible=pose.visible;
  if(pose.visible&&moving){glider.position.set(pose.x,pose.y,pose.z);glider.rotation.set(0,-pose.yaw,pose.roll);}
}

export function SolarFlyover({runtime,paused}:EnvironmentProps) {
  const glider=useMemo(()=>makeSolarGlider(),[]),offset=useRef(0);
  useEffect(()=>{
    if(['localhost','127.0.0.1'].includes(window.location.hostname)){const query=new URLSearchParams(window.location.search).get('qaPlaneTime');if(query!==null&&Number.isFinite(Number(query)))offset.current=Number(query);}
    return ()=>glider.children.forEach(child=>{const mesh=child as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});
  },[glider]);
  useFrame(()=>{
    const pose=solarFlightPose(runtime.current.activeElapsed+offset.current,runtime.current.weather.hour);
    updateGlider(glider,pose,!paused||Boolean(offset.current));
  });
  return <primitive object={glider}/>;
}
