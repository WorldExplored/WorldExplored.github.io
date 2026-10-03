'use client';

import { HISTORY_SCALE, historyHeight } from './historyDimensions';
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SpotLight, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { nightLightingLevel } from './lighthouseControl';
import { world } from '../../content/world';

export const roomNightUniform = {value:0};
const roomMaterials=new WeakSet<MeshStandardMaterial>();
const sourceMaterials=new WeakSet<MeshStandardMaterial>();
/** Baked diffuse fill belongs to opaque room surfaces, never glazing or the outer facade. */
export function applyBakedRoomLighting<T extends MeshStandardMaterial>(material:T, masked=false):T {
  if(material.transparent || roomMaterials.has(material))return material;
  roomMaterials.add(material);
  material.userData.bakedRoomLighting=true;
  const compile=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);shader.uniforms.roomNight=roomNightUniform;
    shader.fragmentShader=`uniform float roomNight;${masked?'varying float roomFill;':''}\n${shader.fragmentShader}`;
    if(masked)shader.vertexShader=`attribute float aRoomFill;varying float roomFill;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nroomFill=aRoomFill;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.62,.72,.67) * roomNight * ${masked?'roomFill':'1.'};
    `);
  };
  material.customProgramCacheKey=()=>`${cache()}-room-fill-${masked?'masked':'interior'}-v4`;
  return material;
}

/** Light-producing surfaces share the weather uniform; no per-frame material updates. */
export function applyNightSource<T extends MeshStandardMaterial>(material: T, strength = .8, masked = false): T {
  if(sourceMaterials.has(material))return material;
  sourceMaterials.add(material);
  const compile = material.onBeforeCompile, cache = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.sourceNight = roomNightUniform;
    shader.fragmentShader = `uniform float sourceNight;${masked ? 'varying float sourceMask;' : ''}\n${shader.fragmentShader}`;
    if (masked) shader.vertexShader = `attribute float aNightSource;varying float sourceMask;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nsourceMask=aNightSource;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(.20,.66,.57) * sourceNight * ${strength.toFixed(3)} * ${masked ? 'sourceMask' : '1.'};`);
  };
  material.customProgramCacheKey = () => `${cache()}-night-source-${strength}-${masked}-v1`;
  return material;
}

export interface RoomLamp { x: number; z: number; floor: number; ceiling: number; width: number; depth: number; yaw: number }
export function createRoomLighting(rooms: readonly RoomLamp[]) {
  const root = new Group(); root.name = 'interior-light-fixtures'; root.userData.rooms=rooms;
  const housings: BufferGeometry[] = [], diffusers: BufferGeometry[] = [];
  const positions: Vector3[] = [];
  rooms.forEach((room, i) => {
    const {x,z,ceiling,width,yaw}=room;
    const length=Math.min(1.25,width*.52), color=new Color(['#e6f5ed','#d1f1ed','#dceef5'][i%3]);
    const place=(geometry:BufferGeometry,y:number)=>geometry.rotateY(yaw).translate(x,y,z);
    housings.push(place(new BoxGeometry(length+.08,.065,.20),ceiling-.0325));
    const lamp=place(new BoxGeometry(length,.018,.145),ceiling-.074);
    const colors=new Float32Array(lamp.attributes.position.count*3);
    for(let n=0;n<colors.length;n+=3)colors.set([color.r,color.g,color.b],n);
    lamp.setAttribute('color',new Float32BufferAttribute(colors,3)); diffusers.push(lamp);
    positions.push(new Vector3(x,ceiling-.15,z));
  });
  const join=(parts:BufferGeometry[])=>{const geometry=parts.length?mergeGeometries(parts)!:new BufferGeometry();parts.forEach(g=>g.dispose());return geometry;};
  const fixture=new Mesh(join(housings),new MeshStandardMaterial({color:'#e5ede7',roughness:.42,metalness:.28}));
  const glow=new Mesh(join(diffusers),new MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.45,emissive:'#d8f1e9',emissiveIntensity:0}));
  fixture.name='ceiling-light-housings';glow.name='pearl-ceiling-diffusers';
  for(const mesh of [fixture,glow]){mesh.raycast=()=>{};root.add(mesh);}
  // The floor receives the room material's diffuse fill directly: a near-coplanar
  // transparent light decal would flicker against distant apartment floors.
  // One downward light per district adds depth to nearby furniture. Its cone
  // stays inside the selected room; other fixtures use the masked diffuse room fill.
  const local = new SpotLight('#e0f6ed', 0, 4, .58, .75, 2);
  local.name = 'nearest-room-light'; local.castShadow = false;
  const target = new Group(); target.name = 'nearest-room-light-target';
  local.target = target; root.add(local, target);
  let selected = 0, nextSelection = 0;
  const previousCamera = new Vector3(Infinity, Infinity, Infinity);
  const update = (night: number, camera: Vector3, time: number) => {
    roomNightUniform.value = night;
    glow.material.emissiveIntensity = night * 2.1;
    if (time >= nextSelection || previousCamera.distanceToSquared(camera) > 1) {
      nextSelection = time + .6; previousCamera.copy(camera); let best = Infinity;
      for (let i = 0; i < positions.length; i++) {
        const distance = positions[i].distanceToSquared(camera);
        if (distance < best) { best = distance; selected = i; }
      }
      const room = rooms[selected];
      if (room) {
        local.position.copy(positions[selected]); target.position.set(room.x, room.floor, room.z);
        const height = Math.max(.5, room.ceiling - room.floor);
        local.angle = Math.atan(Math.min(room.width, room.depth) * .40 / height);
        local.distance = height + .65;
      }
    }
    local.intensity = rooms.length ? night * 9 : 0;
  };
  let disposed = false;
  const dispose=()=>{if(disposed)return;disposed=true;for(const mesh of [fixture,glow]){mesh.geometry.dispose();mesh.material.dispose();}};
  let timer:ReturnType<typeof setTimeout>;
  return {root,positions,update,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function RoomLighting({rooms,runtime}:Pick<EnvironmentProps,'runtime'> & {rooms:readonly RoomLamp[]}) {
  const lighting=useMemo(()=>createRoomLighting(rooms),[rooms]);
  useEffect(()=>lighting.retain(),[lighting]);
  useFrame(({camera})=>lighting.update(nightLightingLevel(runtime.current.weather),camera.position,runtime.current.elapsed));
  return <primitive object={lighting.root} dispose={null}/>;
}

// Match the museum's 48 roof segments rather than an idealized curved ceiling.
const museumCeiling=(x:number)=>{const step=11.25/48,left=Math.floor((x+5.625)/step)*step-5.625,t=(x-left)/step,arch=(p:number)=>5.84+1.42*Math.cos(p/11.25*Math.PI);return historyHeight(arch(left)*(1-t)+arch(left+step)*t-.16);};

// Ceiling heights are the actual slab undersides or sampled roof triangles at each fixture.
export const mainRooms: ReadonlyArray<readonly [string,number,number,number,number,number,number]> = [
  ['work',-2.85,0,1.144,3.06,2.2,3.8],['work',2.85,0,1.144,3.06,2.2,3.8],['work',-2.85,0,3.224,4.86,2.2,3.8],['work',2.85,0,3.224,4.86,2.2,3.8],
  ['experience',-2,0,1.075,4.857788,2.8,4],['experience',2,0,1.075,4.857788,2.8,4],
  ['research',-1.8,-.7,1.075,3.645,3,4],['research',-1.8,-.7,3.825,6.4,3,4],
  ['purdue',0,0,1.03,4.422954,3.7,2.6],['purdue',0,-2.1,1.03,4.303182,4.7,1.5],
  ['history',-2*HISTORY_SCALE,0,1.075,historyHeight(6.883586),3.4*HISTORY_SCALE,5*HISTORY_SCALE],['history',2*HISTORY_SCALE,0,1.075,historyHeight(6.883586),3.4*HISTORY_SCALE,5*HISTORY_SCALE],
  ['history',-4.42*HISTORY_SCALE,.7*HISTORY_SCALE,historyHeight(4.3),museumCeiling(-4.42),1.1*HISTORY_SCALE,4.8*HISTORY_SCALE],['history',4.42*HISTORY_SCALE,.7*HISTORY_SCALE,historyHeight(4.3),museumCeiling(4.42),1.1*HISTORY_SCALE,4.8*HISTORY_SCALE],
  ['about',-.48,-2.075,1.078,4.03,5.5,1.25],['about',-2.42,0,1.078,4.393916,1.7,2.4],
  ['contact',0,0,1.086,3.35,2.2,2.2],['contact',2.58,-.91,1.086,3.375,2.1,2.7],
  ['arcade',-1,0,1.075,3.645,2.2,3.5],['arcade',1.5,0,1.075,3.645,2.2,3.5],
];
export const mainRoomLamps:readonly RoomLamp[]=mainRooms.map(([id,x,z,floor,ceiling,width,depth])=>{
  const site=world.landmarks.find(p=>p.id===id)!,yaw=site.rotationY??0;
  return{x:site.position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),z:site.position[2]-x*Math.sin(yaw)+z*Math.cos(yaw),floor:floor+site.position[1],ceiling:ceiling+site.position[1],width,depth,yaw};
});
