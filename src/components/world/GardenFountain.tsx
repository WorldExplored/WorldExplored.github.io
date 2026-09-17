'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, LatheGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { QualityTier } from '../../content/world';
import type { EnvironmentProps } from './Water';
import { terrainHeight } from './terrain';
import type { FountainPattern, TownInteractionState } from './townInteractionState';

export const FOUNTAIN_SITE = { x: -16.2, z: -70, radius: 1.16, waterHeight: .32, innerRadius: .92 } as const;
const JETS = 6;
export function fountainStreamPoint(jet: number, progress: number, target = new Vector3(), pattern: FountainPattern = 0) {
  const angle = jet / JETS * Math.PI * 2;
  const radius = .24 + (pattern === 2 ? -.78 : pattern === 1 ? .42 : .47) * progress;
  const arch = pattern === 2 ? .94 : pattern === 1 ? .28 : .65;
  return target.set(Math.cos(angle) * radius, .37 * (1 - progress) + FOUNTAIN_SITE.waterHeight * progress + Math.sin(progress * Math.PI) * arch, Math.sin(angle) * radius);
}
function combine(parts: BufferGeometry[]) { const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return geometry; }

export function createGardenFountain() {
  const group = new Group(); group.name = 'garden-fountain'; group.position.set(FOUNTAIN_SITE.x, terrainHeight(FOUNTAIN_SITE.x, FOUNTAIN_SITE.z), FOUNTAIN_SITE.z);
  const time = { value: 0 };
  const stone = new MeshStandardMaterial({ color: '#babba7', roughness: .94, metalness: 0 });
  stone.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vStonePoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePoint=position;');
    shader.fragmentShader = 'varying vec3 vStonePoint;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat grain=fract(sin(dot(floor(vStonePoint*170.),vec3(12.9898,78.233,37.719)))*43758.5453); diffuseColor.rgb*=.92+grain*.13;');
  };
  const metal = new MeshStandardMaterial({ color: '#819091', roughness: .46, metalness: .74 });
  // Environment reflections and alpha preserve water depth without a second full-world render.
  const water = new MeshPhysicalMaterial({ color: '#c1dcd6', transparent: true, opacity: .62, transmission: 0, thickness: .12, ior: 1.333, roughness: .12, metalness: .08, clearcoat: .65, clearcoatRoughness: .13, depthWrite: false, side: DoubleSide });
  water.onBeforeCompile = shader => {
    shader.uniforms.fountainTime = time;
    shader.vertexShader = 'uniform float fountainTime; varying vec2 vFountainPoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFountainPoint=position.xz; transformed.y+=sin(length(position.xz)*45.-fountainTime*5.)*.0035+sin(position.x*21.+position.z*17.+fountainTime*2.)*.002;');
    shader.fragmentShader = 'uniform float fountainTime; varying vec2 vFountainPoint;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat rings=.5+.5*sin(length(vFountainPoint)*45.-fountainTime*5.); diffuseColor.rgb+=vec3(.055)*pow(rings,8.);');
  };
  const streamMaterial = new MeshPhysicalMaterial({ color: '#e7f5ef', transparent: true, opacity: .66, transmission: 0, thickness: .035, ior: 1.333, roughness: .09, metalness: .05, clearcoat: .7, depthWrite: false });
  streamMaterial.onBeforeCompile = shader => {
    shader.uniforms.fountainTime = time;
    shader.vertexShader = 'uniform float fountainTime; varying float vStreamAlong;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStreamAlong=uv.x; transformed+=normal*sin(uv.x*72.-fountainTime*12.)*.002;');
    shader.fragmentShader = 'uniform float fountainTime; varying float vStreamAlong;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat flow=.5+.5*sin(vStreamAlong*58.-fountainTime*11.); diffuseColor.a*=.62+.38*flow; diffuseColor.rgb+=vec3(.06)*pow(flow,6.);');
  };
  const dropMaterial = new MeshPhysicalMaterial({ color: '#f0faf4', transparent: true, opacity: .63, transmission: 0, roughness: .09, metalness: .08, clearcoat: .8, depthWrite: false });
  const rippleMaterial = new MeshPhysicalMaterial({ color: '#f1fbf3', transparent: true, opacity: .30, roughness: .12, metalness: .1, depthWrite: false });
  rippleMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float fountainOpacity; varying float vFountainOpacity;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFountainOpacity=fountainOpacity;');
    shader.fragmentShader = 'varying float vFountainOpacity;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vFountainOpacity;');
  };
  const meshes: (Mesh | InstancedMesh)[] = [];
  function add(geometry: BufferGeometry, material: MeshStandardMaterial, name: string) {
    const mesh = new Mesh(geometry, material); mesh.name = name; mesh.raycast = () => {}; group.add(mesh); meshes.push(mesh); return mesh;
  }
  function instances(geometry: BufferGeometry, material: MeshStandardMaterial, count: number, name: string) {
    const mesh = new InstancedMesh(geometry, material, count); mesh.name = name; mesh.frustumCulled = false; mesh.raycast = () => {}; group.add(mesh); meshes.push(mesh); return mesh;
  }
  const wall = new LatheGeometry([[.94,.02],[1.11,.02],[1.16,.40],[1.11,.47],[.97,.47],[.92,.36],[.92,.09],[.94,.02]].map(([x,y])=>new Vector2(x,y)),64);
  const bottom = new CylinderGeometry(.94,.94,.12,64).translate(0,.02,0);
  const basin = add(combine([wall,bottom]),stone,'fountain-open-stone-basin');
  basin.geometry.userData = { innerRadius: .92, rimHeight: .47, floorTop: .08, maximumRadius: 1.16 };
  const pipes: BufferGeometry[] = [new CylinderGeometry(.095,.14,.26,16).translate(0,.20,0),new TorusGeometry(.22,.032,8,32).rotateX(Math.PI/2).translate(0,.345,0)];
  for(let jet=0;jet<JETS;jet++) {
    const angle=jet/JETS*Math.PI*2;
    pipes.push(new CylinderGeometry(.025,.034,.10,8).rotateZ(-.3).rotateY(-angle).translate(Math.cos(angle)*.24,.33,Math.sin(angle)*.24));
  }
  add(combine(pipes),metal,'fountain-satin-source-plumbing');
  add(new RingGeometry(0,FOUNTAIN_SITE.innerRadius,64,12).rotateX(-Math.PI/2).translate(0,FOUNTAIN_SITE.waterHeight,0),water,'fountain-transparent-water-surface');
  const streamGeometries = ([0, 1, 2] as const).map(pattern => {
    const arcs = [];
    for (let jet = 0; jet < JETS; jet++) {
      const points = Array.from({ length: 25 }, (_, index) => fountainStreamPoint(jet, index / 24, new Vector3(), pattern));
      arcs.push(new TubeGeometry(new CatmullRomCurve3(points), 48, .016, 5, false));
    }
    const geometry = combine(arcs);
    geometry.userData = { jets: JETS, sourceRadius: .24, impactRadius: pattern === 2 ? .54 : pattern === 1 ? .66 : .71, pattern };
    return geometry;
  });
  const streamShape = streamGeometries[0].clone();
  streamShape.morphAttributes.position = streamGeometries.slice(1).map(geometry => geometry.getAttribute('position'));
  streamShape.morphAttributes.normal = streamGeometries.slice(1).map(geometry => geometry.getAttribute('normal'));
  const streams = add(streamShape, streamMaterial, 'fountain-six-returning-water-streams');
  streams.updateMorphTargets();
  const weights = [1, 0, 0], sample = new Vector3();
  const blendedPoint = (jet: number, progress: number, target: Vector3) => { target.set(0,0,0); for (const [i,weight] of weights.entries()) target.addScaledVector(fountainStreamPoint(jet,progress,sample,i as FountainPattern),weight); return target; };
  let pattern: FountainPattern = 0;
  const drops=instances(new SphereGeometry(1,6,4),dropMaterial,72,'fountain-flowing-droplets');
  const ripples=instances(new TorusGeometry(1,.018,4,24).rotateX(Math.PI/2),rippleMaterial,12,'fountain-impact-ripples');
  const opacity=new InstancedBufferAttribute(new Float32Array(12),1);ripples.geometry.setAttribute('fountainOpacity',opacity);
  const splashes=instances(new SphereGeometry(1,6,4),dropMaterial,24,'fountain-return-splashes');
  const transform=new Object3D(); const point=new Vector3(); const tint=new Color('#ecfff4');
  for(let i=0;i<72;i++)drops.setColorAt(i,tint);
  const materials=[stone,metal,water,streamMaterial,dropMaterial,rippleMaterial];
  let disposed=false;
  function step(delta:number,quality:QualityTier,paused=false) {
    if(!paused)time.value+=Math.min(.05,Math.max(0,delta));
    for (let i=0;i<3;i++) weights[i] += ((i===pattern?1:0)-weights[i])*(paused?1:1-Math.exp(-5*Math.min(.05,delta)));
    streams.morphTargetInfluences![0]=weights[1]; streams.morphTargetInfluences![1]=weights[2];
    const count={high:72,medium:48,low:24}[quality];drops.count=count;splashes.count=quality==='low'?12:24;
    for(let i=0;i<72;i++) {
      const progress=(time.value*.63+Math.floor(i/JETS)/12+i*.031)%1;
      blendedPoint(i%JETS,progress,point); transform.position.copy(point); transform.rotation.set(0,0,0);transform.scale.set(.018,.025,.018);transform.updateMatrix();drops.setMatrixAt(i,transform.matrix);
    }
    for(let i=0;i<12;i++) {
      const phase=(time.value*.85+Math.floor(i/JETS)*.5+i*.037)%1;
      blendedPoint(i%JETS,1,point);transform.position.set(point.x,FOUNTAIN_SITE.waterHeight+.006,point.z);transform.rotation.set(0,0,0);transform.scale.setScalar(.018+phase*.145);transform.updateMatrix();ripples.setMatrixAt(i,transform.matrix);opacity.setX(i,(1-phase)**2);
    }
    for(let i=0;i<24;i++) {
      const phase=(time.value*1.8+i*.193)%1;const angle=i*2.399;
      blendedPoint(i%JETS,1,point);transform.position.set(point.x+Math.cos(angle)*phase*.075,FOUNTAIN_SITE.waterHeight+.007+Math.sin(phase*Math.PI)*.075,point.z+Math.sin(angle)*phase*.075);transform.rotation.set(0,0,0);transform.scale.setScalar(.009*(1-phase*.6));transform.updateMatrix();splashes.setMatrixAt(i,transform.matrix);
    }
    drops.instanceMatrix.needsUpdate=true;ripples.instanceMatrix.needsUpdate=true;splashes.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;
  }
  step(0,'high',true);
  return { group, meshes, materials, time, step, setPattern(next: FountainPattern) { pattern = next; streams.geometry.userData.pattern = next; }, timer: undefined as ReturnType<typeof setTimeout>|undefined,
    dispose() { if(disposed)return;disposed=true;new Set([...meshes.map(mesh=>mesh.geometry), ...streamGeometries]).forEach(geometry=>geometry.dispose());meshes.forEach(mesh=>{if(mesh instanceof InstancedMesh)mesh.dispose();});materials.forEach(material=>material.dispose()); } };
}

export function GardenFountain({ paused, quality, controls }: EnvironmentProps & { controls?: TownInteractionState }) {
  const fountain=useMemo(()=>createGardenFountain(),[]);
  useEffect(()=>{clearTimeout(fountain.timer);return()=>{fountain.timer=setTimeout(()=>fountain.dispose(),0);};},[fountain]);
  useFrame((_,delta)=>{ if (controls) fountain.setPattern(controls.pattern); fountain.step(delta,quality,paused); });
  return <primitive object={fountain.group} dispose={null}/>;
}
