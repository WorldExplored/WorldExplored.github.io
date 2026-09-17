'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, MathUtils, Mesh, MeshPhysicalMaterial, Quaternion, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type LandmarkId, type SceneRuntime } from '@/content/world';
import { lighthouseSignal } from './lighthouseSignal';

const TAU = Math.PI * 2;
type Motion = (time: number, response: number) => void;
type Paint = 'white' | 'aqua' | 'glass' | 'solar' | 'gold' | 'black' | 'plant';

// Assemblies own their resources for the entire mount. Quality changes never rebuild machinery.
export function createLandmarkMechanism(id: LandmarkId) {
  const root = new Group(); root.name = `${id}-operating-assembly`;
  const motion: Motion[] = [];
  const geometries = new Set<BufferGeometry>();
  const materials = {
    white: new MeshPhysicalMaterial({ color: '#efffff', roughness: .24, metalness: .02, clearcoat: 1, clearcoatRoughness: .2 }),
    aqua: new MeshPhysicalMaterial({ color: '#10d4e1', emissive: '#20deef', emissiveIntensity: 0, roughness: .2, metalness: .02, clearcoat: 1, clearcoatRoughness: .12 }),
    glass: new MeshPhysicalMaterial({ color: '#68eff2', roughness: .08, metalness: 0, clearcoat: 1, transparent: true, opacity: .32, depthWrite: false, side: DoubleSide, forceSinglePass: true }),
    solar: new MeshPhysicalMaterial({ color: '#126b8b', roughness: .24, metalness: .08, clearcoat: 1, clearcoatRoughness: .2 }),
    gold: new MeshPhysicalMaterial({ color: '#dfbd62', roughness: .26, metalness: .12, clearcoat: 1, clearcoatRoughness: .2 }),
    black: new MeshPhysicalMaterial({ color: '#202523', roughness: .3, metalness: .035, clearcoat: 1 }),
    plant: new MeshPhysicalMaterial({ color: '#429a08', roughness: .72, metalness: 0, clearcoat: .12 }),
  };
  const mesh = (parent: Group, name: string, geometry: BufferGeometry, paint: Paint) => {
    geometries.add(geometry);
    const object = new Mesh(geometry, materials[paint]); object.name = name;
    object.castShadow = paint !== 'glass'; object.receiveShadow = paint !== 'glass';
    parent.add(object); return object;
  };
  const join = (parts: BufferGeometry[]) => {
    const sources = parts.map(part => part.index ? part.toNonIndexed() : part);
    const result = mergeGeometries(sources)!;
    new Set([...parts, ...sources]).forEach(part => part.dispose());
    return result;
  };
  const bar = (a: Vector3, b: Vector3, radius = .07) => {
    const difference = b.clone().sub(a);
    return new CylinderGeometry(radius, radius, difference.length(), 10).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), difference.normalize())).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const pipe = (points: Vector3[], radius: number, closed = false) => new TubeGeometry(new CatmullRomCurve3(points, closed), 72, radius, 8, closed);
  const circle = (radius: number, tube = .065, arc = TAU) => new TorusGeometry(radius, tube, 8, Math.ceil(48 * arc / TAU), arc);
  const pod = (length: number, radius: number) => new CapsuleGeometry(radius, length - radius * 2, 4, 12);
  const leaf = (length: number, width: number, thickness: number) => {
    const shape = new Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(length * .12, -width * .65, length * .87, -width * .55, length, 0);
    shape.bezierCurveTo(length * .87, width * .55, length * .12, width * .65, 0, 0);
    return new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, steps: 1, curveSegments: 12 }).rotateX(Math.PI / 2).translate(0, thickness / 2, 0);
  };
  const armature = (name: string, position: [number, number, number], yaw = 0) => {
    const group = new Group(); group.name = name; group.position.set(...position); group.rotation.y = yaw; root.add(group); return group;
  };

  if (id === 'work') {
    // Two packaged dry coolers stand on real roof sleepers. Fans rotate inside guards;
    // coolant supply/return pipes descend to the visible rear service equipment.
    for (const [index,x] of [-2.86,2.86].entries()) {
      mesh(root,`work-cooler-sleepers-${index}`,join([-.56,.56].map(dx=>new BoxGeometry(.16,.19,1.72).translate(x+dx,5.205,-1.14))),'white');
      mesh(root,`work-cooler-cabinet-${index}`,new BoxGeometry(1.57,.71,1.62).translate(x,5.61,-1.14),'solar');
      const frame: BufferGeometry[]=[];
      for(const dx of [-.82,.82])for(const z of [-1.98,-.3])frame.push(new BoxGeometry(.065,.82,.065).translate(x+dx,5.64,z));
      for(const y of [5.25,6.04])frame.push(new BoxGeometry(1.7,.065,1.74).translate(x,y,-1.14));
      mesh(root,`work-cooler-frame-${index}`,join(frame),'white');
      const louvers: BufferGeometry[]=[];
      for(let row=0;row<8;row++)for(const z of [-1.968,-.312])louvers.push(new BoxGeometry(1.46,.025,.045).translate(x,5.34+row*.083,z));
      mesh(root,`work-cooler-fins-${index}`,join(louvers),'black');
      mesh(root,`work-fan-ring-${index}`,circle(.57,.038).rotateX(Math.PI/2).translate(x,6.09,-1.14),'white');
      const rotor=armature(`work-cooling-fan-${index}`,[x,6.095,-1.14]);
      mesh(rotor,`work-fan-hub-${index}`,new CylinderGeometry(.11,.11,.085,16),'white');
      mesh(rotor,`work-fan-blades-${index}`,join([0,1,2,3,4].map(i=>leaf(.46,.15,.024).translate(.08,0,0).rotateY(i*TAU/5))),'black');
      const guard: BufferGeometry[]=[];
      for(let n=-4;n<=4;n++){const dx=n*.115,length=Math.sqrt(.54*.54-dx*dx)*2;guard.push(new BoxGeometry(.012,.012,length).translate(x+dx,6.16,-1.14));}
      mesh(root,`work-fan-safety-guard-${index}`,join(guard),'white');
      motion.push((time,response)=>{rotor.rotation.y=time*(2.1+index*.3)+response*.15;});
      for(const dx of [-.37,.37]) mesh(root,`work-coolant-return-${index}-${dx}`,pipe([new Vector3(x+dx,5.48,-1.75),new Vector3(x+dx,5.4,-2.62),new Vector3(x+dx,2.2,-2.62),new Vector3(x+dx,2.2,-2.39)],.072),'aqua');
    }
    mesh(root,'work-atrium-service-exhaust',join([new CylinderGeometry(.18,.18,.63,16).translate(.8,6.18,-1.78),new CylinderGeometry(.27,.27,.08,20).translate(.8,6.49,-1.78)]),'white');
  }

  if (id === 'research') {
    mesh(root,'research-observatory-mast',join([new CylinderGeometry(.12,.2,.69,16).translate(-1.6,6.92,-2.25),new BoxGeometry(.7,.12,.7).translate(-1.6,6.64,-2.25)]),'white');
    const scanner=armature('research-observation-instrument',[-1.6,7.37,-2.25]);
    mesh(scanner,'research-instrument-gimbal',circle(.3,.04),'white');
    mesh(scanner,'research-scanner-barrel',pod(.68,.17).rotateX(Math.PI/2),'solar');
    mesh(scanner,'research-scanner-lens',new SphereGeometry(.145,16,10).scale(1,1,.2).translate(0,0,.36),'aqua');
    motion.push((time,response)=>{scanner.rotation.y=time*.11;scanner.rotation.x=Math.sin(time*.11)*.1-response*.12;});
    for(let index=0;index<2;index++){
      const x=-2.8+index*1.45,panel=armature(`research-tracking-solar-panel-${index}`,[x,6.87,.45]);
      mesh(panel,`research-panel-frame-${index}`,new BoxGeometry(1.21,.07,1.06),'white');
      mesh(panel,`research-panel-cells-${index}`,new BoxGeometry(1.1,.025,.95).translate(0,.05,0),'solar');
      const seams:BufferGeometry[]=[];for(let i=-2;i<=2;i++)seams.push(new BoxGeometry(.014,.01,.95).translate(i*.19,.069,0));
      mesh(panel,`research-cell-divisions-${index}`,join(seams),'white');
      mesh(root,`research-panel-mount-${index}`,join([new CylinderGeometry(.055,.08,.3,10).translate(x,6.74,.45),new BoxGeometry(.53,.065,.67).translate(x,6.6,.45)]),'white');
      motion.push(time=>{panel.rotation.x=-.19+Math.sin(time*.1+index)*.035;});
    }
  }

  if (id === 'contact') {
    // A compact rooftop communications mast is bolted to the service wing, with
    // a bounded dish gimbal, feed horn and an actual cable route into the building.
    const x=2.6,z=-1.35;
    mesh(root,'contact-mast-base',join([new BoxGeometry(.85,.12,.85).translate(x,3.64,z),new CylinderGeometry(.1,.15,1.8,16).translate(x,4.57,z)]),'white');
    mesh(root,'contact-mast-braces',join([-.34,.34].map(dx=>bar(new Vector3(x+dx,3.7,z+.32),new Vector3(x,4.38,z),.035))),'black');
    const dish=armature('contact-tracking-dish',[x,5.25,z],-.5);
    mesh(dish,'contact-parabolic-reflector',new SphereGeometry(.73,32,20,0,TAU,0,.66).rotateX(-Math.PI/2).translate(0,0,.73),'white');
    mesh(dish,'contact-dish-rim',circle(Math.sin(.66)*.73,.025).translate(0,0,.153),'aqua');
    mesh(dish,'contact-feed-struts',join([0,1,2].map(i=>{const angle=i*TAU/3;return bar(new Vector3(Math.cos(angle)*.42,Math.sin(angle)*.42,.153),new Vector3(0,0,.59),.017);})), 'black');
    mesh(dish,'contact-feed-horn',new CylinderGeometry(.048,.075,.17,12).rotateX(Math.PI/2).translate(0,0,.58),'solar');
    motion.push((time,response)=>{dish.rotation.y=-.5+Math.sin(time*.095)*.19+response*.1;dish.rotation.x=-.32+Math.sin(time*.075)*.06;});
    mesh(root,'contact-signal-antenna',join([new CylinderGeometry(.023,.034,1.43,10).translate(3.46,4.28,-2.13),new BoxGeometry(.23,.72,.09).translate(3.46,4.53,-2.13)]),'white');
    mesh(root,'contact-mast-cable',pipe([new Vector3(x,5.15,z+.13),new Vector3(x+.16,4.55,z+.13),new Vector3(x+.16,3.58,z+.13),new Vector3(3.7,3.58,-2.4),new Vector3(3.7,2.5,-2.4)],.025),'black');
  }

  if (id === 'building') {
    materials.white.roughness = .55; materials.white.clearcoat = .1;
    materials.gold.metalness = .7; materials.gold.roughness = .4; materials.gold.clearcoat = .08;
    mesh(root, 'lighthouse-lamp-bearing', join([new CylinderGeometry(.32,.36,.11,24).translate(0,5.54,0),new CylinderGeometry(.065,.08,.31,16).translate(0,5.74,0)]), 'gold');
    mesh(root, 'lighthouse-lens-support-cage', join([bar(new Vector3(-.36,5.58,0),new Vector3(-.36,6.37,0),.025),bar(new Vector3(.36,5.58,0),new Vector3(.36,6.37,0),.025),bar(new Vector3(-.36,6.37,0),new Vector3(.36,6.37,0),.025)]), 'gold');
    const fresnel = armature('lighthouse-rotating-fresnel-lens', [0, 6, 0]);
    mesh(fresnel, 'lighthouse-fresnel-ridges', join(Array.from({ length: 15 }, (_, index) => { const y = (index - 7) * .038; const radius = .305 - Math.abs(index - 7) * .017; return new TorusGeometry(radius,.021,6,36).rotateX(Math.PI/2).translate(0,y,0); })), 'glass');
    mesh(fresnel, 'lighthouse-lens-prism', new SphereGeometry(.105,20,12), 'aqua');
    mesh(fresnel, 'lighthouse-lamp-reflector', new SphereGeometry(.24,24,16,0,TAU,0,Math.PI/2).rotateZ(-Math.PI/2).translate(.07,0,0), 'gold');
    mesh(fresnel, 'lighthouse-lamp-wiring', bar(new Vector3(0,-.25,0),new Vector3(0,-.08,0),.018), 'black');
    motion.push((time, response) => { fresnel.rotation.y = time * .52 + response * .25; });
    mesh(root, 'lighthouse-sensor-mast', new CylinderGeometry(.024, .03, .62, 10).translate(0, 7.28, 0), 'white');
    const vane = armature('lighthouse-weather-vane', [0, 7.51, 0]);
    mesh(vane, 'lighthouse-weather-sensor', join([bar(new Vector3(-.32, 0, 0), new Vector3(.32, 0, 0), .025), new SphereGeometry(.075, 12, 8).translate(-.32, 0, 0), leaf(.29, .17, .025).rotateX(Math.PI / 2).translate(.1, 0, 0)]), 'white');
    motion.push(time => { vane.rotation.y = Math.sin(time * .14) * .5 + time * .08; });
  }

  let response = 0;
  const update = (time: number, target: number, delta: number) => {
    response = MathUtils.damp(response, target, 5, Math.min(delta, .1));
    for (const apply of motion) apply(time, response);
    materials.aqua.emissiveIntensity = id === 'building' && !world.lighting.lampEnabled ? 0 : response * .28;
    root.userData.response = response;
  };
  update(0, 0, 0);
  return { root, update, setSignal(intensity: number) { if (id === 'building') materials.aqua.emissiveIntensity = world.lighting.lampEnabled ? .18 + Math.max(0, Math.min(1,intensity)) * 1.4 : 0; }, dispose() { geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); } };
}

export function LandmarkMechanisms({ id, active, paused, runtime }: { id: LandmarkId; active: boolean; paused: boolean; runtime: MutableRefObject<SceneRuntime> }) {
  const [assembly] = useState(() => createLandmarkMechanism(id));
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; assembly.dispose(); }; }, [assembly]);
  useFrame((_, delta) => {
    if (!mounted.current) return;
    if (!paused) assembly.update(runtime.current.elapsed, active ? 1 : runtime.current.hovered === id ? .5 : 0, delta);
    if (id === 'building') assembly.setSignal(lighthouseSignal(runtime.current).intensity);
  });
  return <primitive object={assembly.root} dispose={null} />;
}
