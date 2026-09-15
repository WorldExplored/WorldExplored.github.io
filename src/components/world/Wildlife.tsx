'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, ConeGeometry, CylinderGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createCrabStates, createGullStates, stepCrab, stepGull, WILDLIFE_COUNTS } from './wildlifeState';

function ellipsoid(x: number, y: number, z: number, sx: number, sy: number, sz: number, turn = 0) {
  return new SphereGeometry(1, 16, 10).scale(sx, sy, sz).rotateY(turn).translate(x, y, z);
}
function merge(parts: BufferGeometry[]) { const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return geometry; }
function bone(a: Vector3, b: Vector3, radius: number) {
  const axis = b.clone().sub(a); const geometry = new CylinderGeometry(radius, radius * .7, axis.length(), 7);
  const transform = new Object3D(); transform.position.copy(a).add(b).multiplyScalar(.5); transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()); transform.updateMatrix();
  return geometry.applyMatrix4(transform.matrix);
}

function mirrored(geometry: BufferGeometry) {
  const copy = geometry.clone().scale(-1, 1, 1);
  const index = copy.index!;
  for (let i = 0; i < index.count; i += 3) { const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a); }
  return copy;
}

function createWildlife() {
  const group = new Group(); group.name = 'coastal-wildlife';
  const materials = [new MeshStandardMaterial({ color: '#f8fbfa', roughness: .65 }), new MeshStandardMaterial({ color: '#b8c6cc', roughness: .7 }), new MeshStandardMaterial({ color: '#263640', roughness: .75 }), new MeshStandardMaterial({ color: '#eaba42', roughness: .58 }), new MeshStandardMaterial({ color: '#c85730', roughness: .48 }), new MeshStandardMaterial({ color: '#ed8a50', roughness: .65 })];
  const meshes: InstancedMesh[] = [];
  const instances = (name: string, geometry: BufferGeometry, material: number, count: number) => {
    const mesh = new InstancedMesh(geometry, materials[material], count); mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.raycast = () => {};
    group.add(mesh); meshes.push(mesh); return mesh;
  };
  const gullBody = instances('gull-bodies', merge([
    ellipsoid(0, 0, 0, .19, .18, .39), ellipsoid(0, .15, -.34, .135, .14, .16), ellipsoid(0, .09, -.21, .125, .14, .20),
    ...[-1, 0, 1].map(index => ellipsoid(index * .072, .015, .39, .065, .027, .23, index * .12)),
  ]), 0, 18);
  const gullEyes = instances('gull-eyes', merge([-1, 1].map(side => ellipsoid(side * .119, .185, -.395, .019, .023, .024))), 2, 18);
  const bill = new ConeGeometry(.059, .23, 12).rotateX(-Math.PI / 2).translate(0, .128, -.565);
  const gullBill = instances('gull-bills', bill, 3, 18);
  const wing = instances('gull-inner-wings', merge([
    ellipsoid(.39, .02, .035, .47, .062, .225, -.10),
    ...Array.from({ length: 7 }, (_, index) => ellipsoid(.20 + index * .095, -.004, .14 + index * .017, .14, .034, .18, -.12)),
  ]), 1, 18);
  const primaries = instances('gull-articulated-primaries', merge(Array.from({ length: 5 }, (_, index) => ellipsoid(.20 + index * .078, 0, .025 + index * .063, .33 - index * .028, .022, .052, -.20 - index * .095))), 2, 18);
  const leftWing = instances('gull-left-inner-wings', mirrored(wing.geometry), 1, 18);
  const leftPrimaries = instances('gull-left-primaries', mirrored(primaries.geometry), 2, 18);
  const gullLegs = instances('gull-perching-feet', merge([-1, 1].flatMap(side => [
    bone(new Vector3(side * .075, -.07, .07), new Vector3(side * .075, -.24, .10), .018),
    ...[-1, 0, 1].map(toe => bone(new Vector3(side * .075, -.24, .10), new Vector3(side * .075 + toe * .038, -.25, -.015), .012)),
  ])), 3, 18);
  const crabBody = instances('crab-shells', merge([ellipsoid(0, .015, 0, .17, .09, .125), ellipsoid(0, .045, -.012, .14, .065, .10)]), 4, 10);
  const crabEyes = instances('crab-eyes', merge([-1, 1].flatMap(side => [bone(new Vector3(side * .07, .045, -.07), new Vector3(side * .085, .14, -.11), .012), ellipsoid(side * .085, .14, -.11, .026, .027, .023)])), 2, 10);
  const crabLegs = instances('crab-jointed-legs', merge([bone(new Vector3(), new Vector3(.13, .055, .02), .017), bone(new Vector3(.13, .055, .02), new Vector3(.24, -.08, .06), .012)]), 5, 40);
  const crabClaws = instances('crab-claws', merge([
    bone(new Vector3(), new Vector3(.065, .055, -.10), .021), ellipsoid(.065, .06, -.14, .06, .04, .075),
    ellipsoid(.035, .065, -.218, .015, .02, .055, -.25), ellipsoid(.102, .065, -.208, .017, .025, .06, .25),
  ]), 4, 10);
  const leftCrabLegs = instances('crab-left-legs', mirrored(crabLegs.geometry), 5, 40);
  const leftCrabClaws = instances('crab-left-claws', mirrored(crabClaws.geometry), 4, 10);
  return { leftWing, leftPrimaries, leftCrabLegs, leftCrabClaws, group, meshes, materials, gullBody, gullEyes, gullBill, wing, primaries, gullLegs, crabBody, crabEyes, crabLegs, crabClaws, gulls: createGullStates(), crabs: createCrabStates(), root: new Object3D(), hinge: new Object3D(), tip: new Object3D(), local: new Object3D(), timer: undefined as ReturnType<typeof setTimeout> | undefined };
}

export function Wildlife({ runtime, paused, quality }: EnvironmentProps) {
  const life = useMemo(() => createWildlife(), []);
  useEffect(() => { clearTimeout(life.timer); return () => { life.timer = setTimeout(() => { life.meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.dispose(); }); life.materials.forEach(material => material.dispose()); }, 0); }; }, [life]);
  useFrame(({ camera }, delta) => {
    const counts = WILDLIFE_COUNTS[quality]; const pointer = runtime.current.pointerActive ? runtime.current.pointerWorld : null;
    const { root, hinge, tip, local } = life;
    for (const mesh of [life.gullBody, life.gullEyes, life.gullBill, life.gullLegs]) mesh.count = counts.gulls;
    life.wing.count = life.primaries.count = life.leftWing.count = life.leftPrimaries.count = counts.gulls;
    life.crabBody.count = life.crabEyes.count = counts.crabs; life.crabLegs.count = life.leftCrabLegs.count = counts.crabs * 4; life.crabClaws.count = life.leftCrabClaws.count = counts.crabs;
    life.gulls.forEach((bird, index) => {
      stepGull(bird, delta, camera.position, pointer, paused);
      const perched = bird.mode === 'perched';
      const pulse = Math.sin(bird.time * (6.8 + index % 3 * .4) + bird.phase);
      const glideAngle = .09 + Math.sin(bird.time * 1.1 + bird.phase) * .055;
      const wingAngle = (glideAngle * (1 - bird.flap) + pulse * .52 * bird.flap) * (1 - bird.fold) - 1.30 * bird.fold;
      const bank = perched ? 0 : Math.sin(bird.time * bird.speed + bird.phase) * .14;
      root.position.copy(bird.position); root.rotation.set(perched ? -.12 : -Math.atan2(bird.velocity.y, Math.max(.5, Math.hypot(bird.velocity.x, bird.velocity.z))) * .45, bird.heading, bank);
      root.scale.setScalar(.91 + index % 4 * .075); root.updateMatrix();
      for (const mesh of [life.gullBody, life.gullEyes, life.gullBill]) mesh.setMatrixAt(index, root.matrix);
      local.position.set(0, 0, 0); local.rotation.set(0, 0, 0); local.scale.set(1, perched || bird.mode === 'approach' ? 1 : .26, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix); life.gullLegs.setMatrixAt(index, local.matrix);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        hinge.position.set(side * .12, .06, .01); hinge.rotation.set(0, -side * .58 * bird.fold, side * wingAngle); hinge.scale.set(1, 1, 1); hinge.updateMatrix(); hinge.matrix.premultiply(root.matrix);
        (side < 0 ? life.leftWing : life.wing).setMatrixAt(index, hinge.matrix);
        tip.position.set(side * .73, 0, .06); tip.rotation.set(0, side * (-.12 - .38 * bird.fold), side * (.05 * (1 - bird.flap) - .14 * pulse * bird.flap)); tip.scale.set(1, 1, 1); tip.updateMatrix(); tip.matrix.premultiply(hinge.matrix);
        (side < 0 ? life.leftPrimaries : life.primaries).setMatrixAt(index, tip.matrix);
      }
    });
    life.crabs.forEach((crab, index) => {
      stepCrab(crab, delta, camera.position, pointer, paused);
      root.position.copy(crab.position); root.rotation.set(0, crab.heading, 0); root.scale.setScalar(1.15 + index % 3 * .12); root.updateMatrix();
      life.crabBody.setMatrixAt(index, root.matrix); life.crabEyes.setMatrixAt(index, root.matrix);
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        for (let leg = 0; leg < 4; leg++) {
          const phase = crab.gait + leg * Math.PI + sideIndex * Math.PI;
          local.position.set(side * .12, 0, (leg - 1.5) * .053); local.rotation.set(0, side * ((leg - 1.5) * -.36 + Math.sin(phase) * .15), side * Math.max(0, Math.cos(phase)) * .16); local.scale.set(1, 1, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix);
          (side < 0 ? life.leftCrabLegs : life.crabLegs).setMatrixAt(index * 4 + leg, local.matrix);
        }
        local.position.set(side * .10, 0, -.065); local.rotation.set(0, side * -.25, side * crab.scuttle * -.20); local.scale.set(1, 1, 1); local.updateMatrix(); local.matrix.premultiply(root.matrix); (side < 0 ? life.leftCrabClaws : life.crabClaws).setMatrixAt(index, local.matrix);
      }
    });
    life.meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  });
  return <primitive object={life.group} dispose={null} />;
}
