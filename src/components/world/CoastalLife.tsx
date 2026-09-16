'use client';

import { measureConstruction } from './renderDiagnostics';

// Frame callbacks update persistent Three.js objects outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, Float32BufferAttribute, DoubleSide, InstancedMesh, MeshPhysicalMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createSchoolFish, FISH_PER_SCHOOL, SCHOOL_COUNT, stepSchoolFish } from './fishSchools';

export function createFishHomes(): [number, number][] { return createSchoolFish().map(fish => [fish.position.x, fish.position.z]); }

function finGeometry(vertices: number[]) {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geometry.setIndex(Array.from({ length: vertices.length / 3 }, (_, index) => index)); geometry.computeVertexNormals(); return geometry;
}
function fishBody(variant: number) {
  const lengths = [.29, .26, .35]; const heights = [.063, .105, .07]; const widths = [.075, .085, .065];
  const body = new SphereGeometry(1, 16, 10); const position = body.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index); const taper = .78 + .22 * (x + 1) / 2;
    position.setXYZ(index, x * lengths[variant], position.getY(index) * heights[variant] * taper, position.getZ(index) * widths[variant] * taper);
  }
  body.computeVertexNormals();
  const fins = finGeometry([-.15,.035,0, -.08,heights[variant]+.07,0, .10,.04,0, .015,-.015,.04, -.10,-.025,.16, -.13,-.015,.035, .015,-.015,-.04, -.13,-.015,-.035, -.10,-.025,-.16]);
  const geometry = mergeGeometries([body, fins])!; body.dispose(); fins.dispose(); return geometry;
}

function createCoastalLife() {
  const fishMaterial = new MeshPhysicalMaterial({ color: '#ffffff', roughness: .3, clearcoat: 1, clearcoatRoughness: .22, metalness: .10, side: DoubleSide });
  const states = createSchoolFish();
  const bodies = [0, 1, 2].map(variant => {
    const mesh = new InstancedMesh(fishBody(variant), fishMaterial, states.length / 3); mesh.name = variant === 0 ? 'shallow-water-fish' : `shallow-water-fish-${variant}`; mesh.frustumCulled = false; mesh.raycast = () => {}; return mesh;
  });
  const tailGeometry = finGeometry([0,0,0, -.16,0,-.10, -.105,0,0, 0,0,0, -.105,0,0, -.16,0,.10]);
  const tails = new InstancedMesh(tailGeometry, fishMaterial, states.length); tails.name = 'school-fish-tails'; tails.frustumCulled = false; tails.raycast = () => {};
  const eyeParts = [-1,1].map(side => new SphereGeometry(.013, 8, 6).translate(.20, .018, side * .055));
  const eyeGeometry = mergeGeometries(eyeParts)!; eyeParts.forEach(part => part.dispose());
  const eyeMaterial = new MeshPhysicalMaterial({ color: '#183d43', roughness: .7 });
  const eyes = new InstancedMesh(eyeGeometry, eyeMaterial, states.length); eyes.name = 'school-fish-eyes'; eyes.frustumCulled = false; eyes.raycast = () => {};
  const glintGeometry = new SphereGeometry(1, 10, 6).scale(.12, .012, .017);
  const glintMaterial = new MeshPhysicalMaterial({ color: '#d9ffff', emissive: '#81c9d4', emissiveIntensity: .16, transparent: true, opacity: .45, depthWrite: false });
  const glints = new InstancedMesh(glintGeometry, glintMaterial, states.length); glints.name = 'school-fish-glints'; glints.frustumCulled = false; glints.raycast = () => {};
  const color = new Color();
  states.forEach((fish, index) => {
    color.set(['#70b6b0', '#b8d8d7', '#bba460'][fish.variant]); color.multiplyScalar(.87 + fish.member % 3 * .065);
    bodies[fish.variant].setColorAt(fish.member * 3 + Math.floor(fish.schoolIndex / 3), color); tails.setColorAt(index, color);
  });
  const meshes = [...bodies, tails, eyes, glints];
  return { bodies, tails, eyes, glints, meshes, states, transform: new Object3D(), detail: new Object3D(), disturbance: { camera: new Vector3(), pointer: null as readonly number[] | null, ripple: { x: 0, z: 0, serial: 0 } }, timer: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.dispose(); }); fishMaterial.dispose(); eyeMaterial.dispose(); glintMaterial.dispose(); } };
}

export function CoastalLife({ runtime, paused, quality }: EnvironmentProps) {
  const life = useMemo(() => measureConstruction('fish-bridges', () => createCoastalLife()), []);
  useEffect(() => { clearTimeout(life.timer); return () => { life.timer = setTimeout(() => life.dispose(), 0); }; }, [life]);
  useFrame(({ camera }, delta) => {
    const state = runtime.current; const count = FISH_PER_SCHOOL[quality] * SCHOOL_COUNT;
    life.bodies.forEach(mesh => { mesh.count = count / 3; }); life.tails.count = life.eyes.count = life.glints.count = count;
    life.disturbance.camera.copy(camera.position); life.disturbance.pointer = state.pointerActive ? state.pointerWorld : null; life.disturbance.ripple = state.ripple;
    life.states.forEach((fish, index) => {
      stepSchoolFish(fish, delta, life.disturbance, quality, paused);
      const scale = .82 + fish.member % 4 * .11; const tailBeat = Math.sin(fish.time * (7 + fish.variant) + fish.member * 2.39) * (.11 + fish.scatterOut * .12);
      life.transform.position.copy(fish.position); life.transform.rotation.set(0, fish.heading, fish.jumpPitch + Math.sin(fish.time * .8 + fish.member) * .025); life.transform.scale.setScalar(scale); life.transform.updateMatrix();
      life.bodies[fish.variant].setMatrixAt(fish.member * 3 + Math.floor(fish.schoolIndex / 3), life.transform.matrix); life.eyes.setMatrixAt(index, life.transform.matrix);
      life.detail.position.set(-[.24, .22, .30][fish.variant], 0, 0); life.detail.rotation.set(0, tailBeat, 0); life.detail.scale.set(1, 1, 1); life.detail.updateMatrix(); life.detail.matrix.premultiply(life.transform.matrix); life.tails.setMatrixAt(index, life.detail.matrix);
      life.detail.position.set(0, [.065, .103, .07][fish.variant], 0); life.detail.rotation.set(0, 0, 0); life.detail.scale.setScalar(.02 + fish.glint * .70); life.detail.updateMatrix(); life.detail.matrix.premultiply(life.transform.matrix); life.glints.setMatrixAt(index, life.detail.matrix);
    });
    life.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  });
  return <group dispose={null} name="coastal-life">{life.meshes.map(mesh => <primitive key={mesh.name} object={mesh}/>)}</group>;
}
