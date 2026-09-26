'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, ShaderMaterial, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { nightLightingLevel } from './lighthouseControl';
import { world } from '../../content/world';

export const roomNightUniform = {value:0};
const roomMaterials=new WeakSet<MeshStandardMaterial>();
/** Baked diffuse fill belongs to opaque room surfaces, never glazing or the outer facade. */
export function applyBakedRoomLighting<T extends MeshStandardMaterial>(material:T, masked=false):T {
  if(roomMaterials.has(material))return material;
  roomMaterials.add(material);
  material.userData.bakedRoomLighting=true;
  const compile=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);shader.uniforms.roomNight=roomNightUniform;
    shader.fragmentShader=`uniform float roomNight;${masked?'varying float roomFill;':''}\n${shader.fragmentShader}`;
    if(masked)shader.vertexShader=`attribute float aRoomFill;varying float roomFill;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nroomFill=aRoomFill;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.92,.63,.34) * roomNight * ${masked?'roomFill':'1.'};
    `);
  };
  material.customProgramCacheKey=()=>`${cache()}-room-fill-${masked?'masked':'interior'}-v1`;
  return material;
}

export interface RoomLamp { x: number; z: number; floor: number; ceiling: number; width: number; depth: number; yaw: number }
export function createRoomLighting(rooms: readonly RoomLamp[]) {
  const root = new Group(); root.name = 'interior-light-fixtures'; root.userData.rooms=rooms;
  const housings: BufferGeometry[] = [], diffusers: BufferGeometry[] = [], pools: BufferGeometry[] = [];
  const positions: Vector3[] = [];
  rooms.forEach((room, i) => {
    const {x,z,floor,ceiling,width,depth,yaw}=room;
    const length=Math.min(.8,width*.45), color=new Color(i%3===0?'#d5f4ed':'#ffe2ac');
    const place=(geometry:BufferGeometry,y:number)=>geometry.rotateY(yaw).translate(x,y,z);
    housings.push(place(new BoxGeometry(length+.08,.065,.20),ceiling-.0325));
    const lamp=place(new BoxGeometry(length,.018,.145),ceiling-.074);
    const colors=new Float32Array(lamp.attributes.position.count*3);
    for(let n=0;n<colors.length;n+=3)colors.set([color.r,color.g,color.b],n);
    lamp.setAttribute('color',new Float32BufferAttribute(colors,3)); diffusers.push(lamp);
    pools.push(place(new PlaneGeometry(Math.min(width*.76,2.2),Math.min(depth*.82,2.4)).rotateX(-Math.PI/2),floor+.003));
    positions.push(new Vector3(x,ceiling-.15,z));
  });
  const join=(parts:BufferGeometry[])=>{const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geometry;};
  const fixture=new Mesh(join(housings),new MeshStandardMaterial({color:'#e5ede7',roughness:.42,metalness:.28}));
  const glow=new Mesh(join(diffusers),new MeshBasicMaterial({color:'#ffffff',vertexColors:true,toneMapped:false}));
  const wash=new Mesh(join(pools),new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{night:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float night;void main(){float radius=length((vUv-.5)*2.);float soft=pow(max(0.,1.-radius),1.5);gl_FragColor=vec4(.85,.53,.22,soft*night*.30);}' }));
  wash.visible=false;
  fixture.name='ceiling-light-housings';glow.name='warm-ceiling-diffusers';wash.name='interior-floor-light-pools';
  for(const mesh of [fixture,glow,wash]){mesh.raycast=()=>{};root.add(mesh);}
  // One actual local light per district follows the nearest room; distant rooms use baked pools.
  const local=new PointLight('#ffe1ab',0,5,2); local.name='nearest-room-light';root.add(local);
  let selected=0,nextSelection=0;const previousCamera=new Vector3(Infinity,Infinity,Infinity);
  const update=(night:number,camera:Vector3,time:number)=>{
    roomNightUniform.value=night;glow.material.color.setScalar(.18+night*1.65); wash.material.uniforms.night.value=night;wash.visible=night>.01;
    if(time>=nextSelection||previousCamera.distanceToSquared(camera)>1){nextSelection=time+.6;previousCamera.copy(camera);let best=Infinity;positions.forEach((p,i)=>{const distance=p.distanceToSquared(camera);if(distance<best){best=distance;selected=i;}});local.position.copy(positions[selected]);}
    local.intensity=night*9;
  };
  const dispose=()=>{for(const mesh of [fixture,glow,wash]){mesh.geometry.dispose();mesh.material.dispose();}};
  let timer:ReturnType<typeof setTimeout>;
  return {root,positions,update,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function RoomLighting({rooms,runtime}:Pick<EnvironmentProps,'runtime'> & {rooms:readonly RoomLamp[]}) {
  const lighting=useMemo(()=>createRoomLighting(rooms),[rooms]);
  useEffect(()=>lighting.retain(),[lighting]);
  useFrame(({camera})=>lighting.update(nightLightingLevel(runtime.current.weather),camera.position,runtime.current.elapsed));
  return <primitive object={lighting.root} dispose={null}/>;
}

// Ceiling heights are the actual slab undersides or sampled roof triangles at each fixture.
export const mainRooms: ReadonlyArray<readonly [string,number,number,number,number,number,number]> = [
  ['work',-2.85,0,1.144,3.06,2.2,3.8],['work',2.85,0,1.144,3.06,2.2,3.8],['work',-2.85,0,3.224,4.86,2.2,3.8],['work',2.85,0,3.224,4.86,2.2,3.8],
  ['experience',-2,0,1.075,4.857788,2.8,4],['experience',2,0,1.075,4.857788,2.8,4],
  ['research',-1.8,-.7,1.075,3.645,3,4],['research',-1.8,-.7,3.825,6.4,3,4],
  ['purdue',0,0,1.03,4.422954,3.7,2.6],['purdue',0,-2.1,1.03,4.303182,4.7,1.5],
  ['history',-2,0,1.075,6.883586,3.4,5],['history',2,0,1.075,6.883586,3.4,5],
  ['about',-.48,-2.075,1.078,4.03,5.5,1.25],['about',-2.42,0,1.078,4.393916,1.7,2.4],
  ['contact',0,0,1.086,3.35,2.2,2.2],['contact',2.58,-.91,1.086,3.375,2.1,2.7],
  ['arcade',-1,0,1.075,4.195,2.2,3.5],['arcade',1.5,0,1.075,4.195,2.2,3.5],
];
export const mainRoomLamps:readonly RoomLamp[]=mainRooms.map(([id,x,z,floor,ceiling,width,depth])=>{
  const site=world.landmarks.find(p=>p.id===id)!,yaw=site.rotationY??0;
  return{x:site.position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),z:site.position[2]-x*Math.sin(yaw)+z*Math.cos(yaw),floor:floor+site.position[1],ceiling:ceiling+site.position[1],width,depth,yaw};
});
