'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, MathUtils, Mesh, MeshPhysicalMaterial, Quaternion, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type LandmarkId, type SceneRuntime } from '@/content/world';

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
    // Roof-mounted exchangers and solar wheels serve the enclosed compute floors.
    root.position.y = 1.9;
    const supports: BufferGeometry[] = [];
    for (const [index, x] of [-1.35, 1.35].entries()) {
      const mount = armature(`work-ring-mount-${index}`, [x, 6.55, -.15], index ? -.48 : .48);
      mount.rotation.z = index ? -.13 : .13;
      const wheel = new Group(); wheel.name = `work-compute-wheel-${index}`; mount.add(wheel);
      const radius = index ? 2.12 : 2.7;
      mesh(wheel, `work-wheel-frame-${index}`, join([circle(radius, .105), circle(radius - .38, .045)]), 'white');
      mesh(wheel, `work-wheel-hub-${index}`, new CylinderGeometry(.22,.22,.32,20).rotateX(Math.PI/2), 'solar');
      mesh(wheel, `work-wheel-spokes-${index}`, join([0,1,2].map(spoke=>{const angle=spoke*TAU/3;return bar(new Vector3(Math.cos(angle)*.18,Math.sin(angle)*.18,0),new Vector3(Math.cos(angle)*(radius-.37),Math.sin(angle)*(radius-.37),0),.045);})), 'white');
      const panels: BufferGeometry[] = []; const seams: BufferGeometry[] = [];
      for (let segment = 0; segment < 12; segment++) {
        const angle = segment * TAU / 12;
        panels.push(new TorusGeometry(radius - .19, .16, 4, 5, TAU / 12 * .79).scale(1, 1, .5).rotateZ(angle));
        const r = radius - .2;
        seams.push(bar(new Vector3(Math.cos(angle) * (r - .15), Math.sin(angle) * (r - .15), .025), new Vector3(Math.cos(angle) * (r + .15), Math.sin(angle) * (r + .15), .025), .024));
      }
      mesh(wheel, `work-segmented-solar-ring-${index}`, join(panels), 'solar');
      mesh(wheel, `work-ring-data-seams-${index}`, join(seams), 'aqua');
      motion.push((time, response) => { wheel.rotation.z = (index ? -.12 : .085) * time + index * .8; mount.rotation.y = (index ? -.48 : .48) + Math.sin(time * .13 + index) * .06 + response * (index ? -.1 : .1); });
      supports.push(bar(new Vector3(x, 3.3, -.6), new Vector3(x, 6.55, -.15), .15));
    }
    mesh(root, 'work-compute-supports', join(supports), 'white');
    mesh(root, 'work-exchanger-roof-mount', new CylinderGeometry(.52,.68,.7,24).translate(.25,3.55,-.15), 'white');
    const exchanger = armature('work-heat-exchanger', [.25, 5.25, -.15]);
    mesh(exchanger, 'work-exchanger-core', new CylinderGeometry(.44, .56, 2.7, 24), 'solar');
    mesh(exchanger, 'work-exchanger-fins', join(Array.from({ length: 9 }, (_, index) => new CylinderGeometry(.8, .8, .055, 32).translate(0, -1.1 + index * .28, 0))), 'white');
    motion.push(time => { exchanger.rotation.y = time * .19; });
    const loops = [-1, 1].map(side => new CatmullRomCurve3(Array.from({ length: 12 }, (_, index) => { const angle = index / 12 * TAU; return new Vector3(side * (4.8 + Math.cos(angle) * .05), 3.8 + Math.sin(angle) * 1.2, Math.cos(angle) * .65); }), true));
    mesh(root, 'work-cooling-service-couplings', join([-1,1].flatMap(side=>[-.5,.5].map(z=>bar(new Vector3(side*4.3,3.2,z),new Vector3(side*4.8,3.2,z),.09)))), 'white');
    mesh(root, 'work-transparent-cooling-conduits', join(loops.map(curve => new TubeGeometry(curve, 80, .12, 10, true))), 'glass');
    const capsules: Mesh[] = [];
    for (let index = 0; index < 4; index++) {
      const capsule = mesh(root, `work-coolant-capsule-${index}`, pod(.3, .105), 'aqua'); capsules.push(capsule);
    }
    const tangent = new Vector3(); const up = new Vector3(0, 1, 0);
    motion.push(time => capsules.forEach((capsule, index) => { const curve = loops[index % 2]; const t = (time * .065 + Math.floor(index / 2) * .5) % 1; curve.getPointAt(t, capsule.position); curve.getTangentAt(t, tangent); capsule.quaternion.setFromUnitVectors(up, tangent); }));
    mesh(root, 'work-service-rail', pipe([new Vector3(-3.6, 2.38, 2.25), new Vector3(0, 2.38, 2.6), new Vector3(3.6, 2.38, 2.25)], .045), 'white');
    const carriage = mesh(root, 'work-service-carriage', pod(.72, .23).rotateZ(Math.PI / 2), 'aqua');
    motion.push(time => { carriage.position.set(Math.sin(time * .23) * 3.35, 2.64, 2.6 - Math.pow(Math.sin(time * .23), 2) * .3); });
  }

  if (id === 'research') {
    mesh(root,'research-observatory-mast',new CylinderGeometry(.11,.2,.8,16).translate(-1.3,3.26,-.7),'white');
    const scanner=armature('research-observation-instrument',[-1.3,3.78,-.7]);
    mesh(scanner,'research-instrument-gimbal',circle(.36,.045),'white');
    mesh(scanner,'research-scanner-barrel',pod(.77,.2).rotateX(Math.PI/2),'solar');
    mesh(scanner,'research-scanner-lens',new SphereGeometry(.17,16,10).scale(1,1,.2).translate(0,0,.4),'aqua');
    motion.push((time,response)=>{scanner.rotation.y=time*.16;scanner.rotation.x=Math.sin(time*.11)*.14-response*.16;});
    for(let index=0;index<2;index++){
      const panel=armature(`research-tracking-solar-panel-${index}`,[-2.05+index*1.3,3.09,.75]);
      mesh(panel,`research-panel-frame-${index}`,new BoxGeometry(1.04,.07,.69),'white');
      mesh(panel,`research-panel-cells-${index}`,new BoxGeometry(.94,.025,.59).translate(0,.05,0),'solar');
      mesh(root,`research-panel-mount-${index}`,new CylinderGeometry(.06,.09,.24,10).translate(-2.05+index*1.3,2.97,.75),'white');
      motion.push(time=>{panel.rotation.x=-.2+Math.sin(time*.1+index)*.08;});
    }
  }

  if (id === 'contact') {
    mesh(root, 'contact-signal-pedestal', join([new CylinderGeometry(.22, .4, 1.25, 20).translate(0, 3.95, -.18), circle(.4, .08).rotateX(Math.PI / 2).translate(0, 4.58, -.18)]), 'white');
    for (let index = 0; index < 3; index++) {
      const petal = armature(`contact-articulated-signal-petal-${index}`, [0, 4.45, -.18], index * TAU / 3 - .35);
      mesh(petal, `contact-white-signal-petal-${index}`, leaf(2.55, 1.06, .13), 'white');
      mesh(petal, `contact-aqua-signal-face-${index}`, leaf(2.12, .72, .025).translate(.2, .105, 0), 'glass');
      motion.push((time, response) => { petal.rotation.z = .25 + Math.sin(time * .16 + index * 2.1) * .13 + response * .29; petal.rotation.y = index * TAU / 3 - .35 + Math.sin(time * .09) * .1; });
    }
    mesh(root, 'contact-signal-core', new SphereGeometry(.36, 24, 16).translate(0, 4.55, -.18), 'aqua');
    const pulse = mesh(root, 'contact-outward-signal-pulse', circle(.55, .025).rotateX(Math.PI / 2), 'glass');
    motion.push((time, response) => { const wave = (Math.sin(time * 1.45) + 1) / 2; pulse.position.set(0, 4.73 + wave * .55, -.18); pulse.scale.setScalar(1 + wave * (.5 + response * .65)); });
    mesh(root, 'contact-arrival-landing', join([new BoxGeometry(1.45, .08, .65).translate(.4, 1.02, 2.24), bar(new Vector3(-.3, 1.06, 2.44), new Vector3(-.3, 1.55, 2.44), .035), bar(new Vector3(1.1, 1.06, 2.44), new Vector3(1.1, 1.55, 2.44), .035)]), 'white');
  }

  if (id === 'building') {
    const fresnel = armature('lighthouse-rotating-fresnel-lens', [0, 6, 0]);
    mesh(fresnel, 'lighthouse-fresnel-ridges', join(Array.from({ length: 9 }, (_, index) => { const y = (index - 4) * .065; const radius = .31 - Math.abs(index - 4) * .026; return new CylinderGeometry(radius, radius + .018, .06, 12).translate(0, y, 0); })), 'glass');
    mesh(fresnel, 'lighthouse-lens-prism', new BoxGeometry(.12, .43, .23), 'aqua');
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
  return { root, update, dispose() { geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); } };
}

export function LandmarkMechanisms({ id, active, paused, runtime }: { id: LandmarkId; active: boolean; paused: boolean; runtime: MutableRefObject<SceneRuntime> }) {
  const [assembly] = useState(() => createLandmarkMechanism(id));
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; assembly.dispose(); }; }, [assembly]);
  useFrame((_, delta) => {
    if (paused || !mounted.current) return;
    assembly.update(runtime.current.elapsed, active ? 1 : runtime.current.hovered === id ? .5 : 0, delta);
  });
  return <primitive object={assembly.root} dispose={null} />;
}
