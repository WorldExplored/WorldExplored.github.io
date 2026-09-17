'use client';

import { measureConstruction } from './renderDiagnostics';
// Frame callbacks update persistent Three.js objects outside React rendering.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, DoubleSide, InstancedMesh, MeshPhysicalMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createSchoolFish, FISH_SPECIES, stepSchoolFish } from './fishSchools';

export function createFishHomes(): [number, number][] { return createSchoolFish().map(fish => [fish.position.x, fish.position.z]); }

function finGeometry(vertices: number[], color: string) {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  const colors = []; const tint = new Color(color);
  for (let i = 0; i < vertices.length / 3; i++) colors.push(tint.r, tint.g, tint.b);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(Array.from({ length: vertices.length / 3 }, (_, index) => index)); geometry.computeVertexNormals(); return geometry;
}
// A ring is [longitudinal position, vertical radius, lateral radius, vertical offset].
// These profiles alter anatomy, rather than scaling one sphere into several colors.
const PROFILES: readonly (readonly number[][])[] = [
  [[-.21,.018,.025,0],[-.14,.092,.054,0],[-.025,.127,.077,.005],[.095,.103,.065,.012],[.18,.054,.041,0],[.205,.018,.021,-.014]],
  [[-.40,.018,.018,0],[-.25,.044,.040,0],[-.03,.068,.057,.009],[.23,.055,.047,.005],[.36,.027,.024,-.01],[.40,.009,.014,-.012]],
  [[-.26,.027,.022,0],[-.15,.155,.055,.006],[-.015,.218,.078,.01],[.12,.18,.069,.008],[.22,.076,.046,-.018],[.245,.018,.024,-.04]],
  [[-.29,.025,.038,0],[-.19,.040,.065,.005],[-.02,.065,.135,.008],[.16,.055,.16,.008],[.27,.030,.097,-.012],[.30,.012,.051,-.016]],
];
function bodyTint(variant: number, x: number, angle: number) {
  const dorsal = Math.cos(angle); const color = new Color();
  if (variant === 0) return color.set(dorsal < -.35 ? '#d9e2b5' : Math.abs(Math.sin((x + .2) * 27)) < .40 ? '#235c66' : '#55b4a2');
  if (variant === 1) return color.set(dorsal > .58 ? '#47727d' : dorsal < -.3 ? '#eef2df' : '#b8d9dd');
  if (variant === 2) return color.set(dorsal > .1 ? '#e99125' : '#f3ce51');
  const mottled = Math.sin(x * 79 + angle * 4) * Math.cos(angle * 7 - x * 42);
  return color.set(dorsal < -.25 ? '#858574' : mottled > .25 ? '#666d54' : '#354b48');
}
export function createFishBodyGeometry(variant: number) {
  const original = PROFILES[variant];
  const curve = new CatmullRomCurve3(original.map(([x, height, width]) => new Vector3(x, height, width)), false, 'catmullrom', .35);
  const profile = Array.from({length:25}, (_, i) => { const point = curve.getPoint(i / 24); const segment=Math.min(4,Math.floor(i/24*5)), t=i/24*5-segment; const offset=original[segment][3]*(1-t)+original[segment+1][3]*t; return [point.x, Math.max(.008,point.y), Math.max(.008,point.z), offset]; });
  const radial = 24; const vertices: number[] = []; const colors: number[] = []; const indices: number[] = [];
  profile.forEach(([x, height, width, offset], ring) => {
    for (let side = 0; side <= radial; side++) {
      const angle = side / radial * Math.PI * 2; const y = Math.cos(angle);
      // The bottom dweller has a broad head and a nearly flat ventral plane.
      vertices.push(x, (variant === 3 && y < 0 ? y * .32 : y) * height + offset, Math.sin(angle) * width);
      const tint = bodyTint(variant, x, angle); colors.push(tint.r, tint.g, tint.b);
      if (ring && side) { const a = ring * (radial + 1) + side; indices.push(a, a - 1, a - radial - 2, a, a - radial - 2, a - radial - 1); }
    }
  });
  // Close both small mouth and tail peduncle faces.
  for (let side = 1; side < radial - 1; side++) { indices.push(0, side + 1, side); const last = (profile.length - 1) * (radial + 1); indices.push(last, last + side, last + side + 1); }
  const body = new BufferGeometry(); body.setAttribute('position', new Float32BufferAttribute(vertices, 3)); body.setAttribute('color', new Float32BufferAttribute(colors, 3)); body.setIndex(indices); body.computeVertexNormals();
  const dorsalVertices = [
    [-.14,.06,0,-.10,.185,0,.055,.12,0, -.07,-.08,0,-.09,-.17,0,.07,-.08,0],
    [-.18,.045,0,-.11,.17,0,.055,.065,0, -.25,-.03,0,-.20,-.09,0,-.12,-.04,0],
    [-.20,.09,0,-.17,.29,0,.07,.19,0, -.19,-.08,0,-.15,-.27,0,.07,-.18,0],
    [-.21,.035,0,-.14,.13,0,.09,.065,0, -.10,.063,0,.03,.15,0,.16,.065,0],
  ][variant];
  const fin = finGeometry(dorsalVertices, ['#397c78','#537b88','#9e6636','#425753'][variant]);
  const geometry = mergeGeometries([body, fin])!; body.dispose(); fin.dispose();
  geometry.name = `fish-body-${FISH_SPECIES[variant].id}`;
  geometry.userData = { species: FISH_SPECIES[variant].id, profile: profile.map(ring => [...ring]), radialSegments: radial, pattern: FISH_SPECIES[variant].pattern, anatomy: ['rounded reef body and short triangular dorsal', 'long spindle and swept dorsal', 'deep disk with tall dorsal and anal sails', 'flat belly, broad head and paired dorsal fins'][variant] };
  geometry.computeBoundingBox(); return geometry;
}
export function createFishTailGeometry(variant: number) {
  const outlines = [
    [[0,0],[-.13,.095],[-.12,-.095]],
    [[0,0],[-.23,.145],[-.12,.024],[-.07,0],[-.12,-.024],[-.23,-.145]],
    [[0,0],[-.16,.14],[-.20,.07],[-.20,-.07],[-.16,-.14]],
    [[0,0],[-.10,.062],[-.20,.052],[-.225,0],[-.20,-.052],[-.10,-.062]],
  ][variant];
  const vertices: number[] = [];
  for (let i = 1; i < outlines.length - 1; i++) vertices.push(outlines[0][0],outlines[0][1],0,outlines[i][0],outlines[i][1],0,outlines[i+1][0],outlines[i+1][1],0);
  const geometry = finGeometry(vertices, ['#5aa78d','#577f8b','#a56724','#526450'][variant]);
  geometry.name = `fish-tail-${FISH_SPECIES[variant].id}`; geometry.userData = { outline: outlines, topology: ['triangular fan','deep fork','wide scalloped fan','rounded paddle'][variant] }; return geometry;
}
export function createFishPectoralGeometry(variant: number, side: number) {
  const shapes = [
    [0,0,0,-.10,-.045,side*.10,-.07,0,side*.025],
    [0,0,0,-.17,-.025,side*.13,-.12,0,side*.035],
    [0,0,0,-.11,-.09,side*.14,-.14,.01,side*.045],
    [0,0,0,-.18,-.025,side*.24,-.25,-.018,side*.17,0,0,0,-.25,-.018,side*.17,-.16,0,side*.025],
  ];
  const geometry = finGeometry(shapes[variant], ['#69b99c','#93afb4','#e5b442','#57694e'][variant]); geometry.name = `fish-pectoral-${FISH_SPECIES[variant].id}-${side}`; return geometry;
}
function createCoastalLife() {
  const states = createSchoolFish();
  const batches = FISH_SPECIES.map((kind, variant) => {
    const members = states.filter(fish => fish.variant === variant);
    const material = new MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: variant === 1 ? .29 : .56, metalness: variant === 1 ? .38 : .03, clearcoat: variant === 1 ? .32 : .08, side: DoubleSide });
    function mesh(geometry: BufferGeometry, name: string, mat = material) {
      const result = new InstancedMesh(geometry, mat, members.length); result.name = `fish-${kind.id}-${name}`; result.frustumCulled = false; result.raycast = () => {}; result.userData.species = kind.id; return result;
    }
    const body = mesh(createFishBodyGeometry(variant), 'body'); const tail = mesh(createFishTailGeometry(variant), 'tail');
    const fins = [-1, 1].map(side => mesh(createFishPectoralGeometry(variant, side), `pectoral-${side}`));
    const eyeX = [.15,.30,.175,.195][variant]; const eyeY = [.035,.025,.035,.052][variant]; const eyeZ = [.041,.030,.048,.09][variant];
    const eyeParts = [-1,1].map(side => new SphereGeometry(variant === 1 ? .010 : .013, 8, 6).translate(eyeX, eyeY, side * eyeZ));
    const eyeGeometry = mergeGeometries(eyeParts)!; eyeParts.forEach(part => part.dispose());
    const eyeMaterial = new MeshPhysicalMaterial({ color: '#122a2a', roughness: .6 }); const eyes = mesh(eyeGeometry, 'eyes', eyeMaterial);
    const glintMaterial = new MeshPhysicalMaterial({ color: '#d9ffff', emissive: '#81c9d4', emissiveIntensity: .10, transparent: true, opacity: .32, depthWrite: false });
    const glints = variant === 1 ? mesh(new SphereGeometry(1, 8, 6).scale(.17,.007,.02), 'glints', glintMaterial) : null;
    const meshes = [body, tail, ...fins, eyes, ...(glints ? [glints] : [])];
    return { kind, variant, members, body, tail, fins, eyes, glints, meshes, materials: [material, eyeMaterial, glintMaterial] };
  });
  const meshes = batches.flatMap(batch => batch.meshes);
  return { batches, meshes, transform: new Object3D(), detail: new Object3D(), disturbance: { camera: new Vector3(), pointer: null as readonly number[] | null, ripple: { x: 0, z: 0, serial: 0 } }, timer: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.dispose(); }); batches.forEach(batch => batch.materials.forEach(material => material.dispose())); } };
}

export function CoastalLife({ runtime, paused, quality }: EnvironmentProps) {
  const life = useMemo(() => measureConstruction('fish-bridges', createCoastalLife), []);
  useEffect(() => { clearTimeout(life.timer); return () => { life.timer = setTimeout(() => life.dispose(), 0); }; }, [life]);
  useFrame(({ camera }, delta) => {
    const state = runtime.current;
    life.disturbance.camera.copy(camera.position); life.disturbance.pointer = state.pointerActive ? state.pointerWorld : null; life.disturbance.ripple = state.ripple;
    for (const batch of life.batches) {
      let visible = 0; const { kind, variant } = batch;
      for (const fish of batch.members) {
        const reentered=stepSchoolFish(fish, delta, life.disturbance, quality, paused);
        if(reentered){
          state.ripple={x:fish.reentry.x,z:fish.reentry.z,time:state.elapsed,serial:state.ripple.serial+1};
          state.nature={x:fish.reentry.x,y:fish.reentry.y+.025,z:fish.reentry.z,kind:'fish',time:state.elapsed,serial:state.nature.serial+1};
        }
        if (fish.member >= kind.population[quality]) continue;
        const index = visible++; const scale = .86 + fish.member % 4 * .055;
        const beat = fish.time * (kind.tailRate + fish.scatterOut * 5) + fish.member * 2.39;
        const tailBeat = Math.sin(beat) * (.24 + fish.scatterOut * .16);
        const bodyYaw = Math.sin(beat - .6) * (variant === 3 ? .018 : .038);
        life.transform.position.copy(fish.position); life.transform.rotation.set(fish.bank, fish.heading + bodyYaw, fish.jumpPitch + Math.sin(fish.time * .8 + fish.member) * .016, 'YXZ'); life.transform.scale.setScalar(scale); life.transform.updateMatrix();
        batch.body.setMatrixAt(index, life.transform.matrix); batch.eyes.setMatrixAt(index, life.transform.matrix);
        life.detail.position.set(-kind.tailLength, 0, 0); life.detail.rotation.set(0, tailBeat, 0); life.detail.scale.setScalar(1); life.detail.updateMatrix(); life.detail.matrix.premultiply(life.transform.matrix); batch.tail.setMatrixAt(index, life.detail.matrix);
        batch.fins.forEach((fin, sideIndex) => {
          const side = sideIndex === 0 ? -1 : 1;
          life.detail.position.set([.08,.11,.07,.12][variant], variant === 3 ? .005 : -.015, side * [.047,.037,.052,.105][variant]);
          life.detail.rotation.set(side * (.18 + Math.sin(beat * .63) * .27), 0, 0); life.detail.scale.setScalar(1); life.detail.updateMatrix(); life.detail.matrix.premultiply(life.transform.matrix); fin.setMatrixAt(index, life.detail.matrix);
        });
        if (batch.glints) {
          life.detail.position.set(0, .061, 0); life.detail.rotation.set(0,0,0); life.detail.scale.setScalar(.02 + fish.glint * .7); life.detail.updateMatrix(); life.detail.matrix.premultiply(life.transform.matrix); batch.glints.setMatrixAt(index, life.detail.matrix);
        }
      }
      batch.meshes.forEach(mesh => { mesh.count = visible; mesh.instanceMatrix.needsUpdate = true; });
    }
  });
  return <group dispose={null} name="coastal-life">{life.meshes.map(mesh => <primitive key={mesh.name} object={mesh}/>)}</group>;
}
