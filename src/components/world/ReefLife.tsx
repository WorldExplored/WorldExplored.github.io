'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Sphere, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createReefFishState, interactWithReefFish, REEF_FISH_COUNTS, stepReefFish } from './reefFishState';

function merge(parts: BufferGeometry[]) {
  parts.forEach(part => part.deleteAttribute('uv'));
  const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return result;
}
function oval(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  return new SphereGeometry(1, 8, 6).scale(sx, sy, sz).translate(x, y, z);
}
function fin(points: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3)); geometry.setIndex([0, 1, 2]); geometry.computeVertexNormals(); return geometry;
}
/** Shared body, individually hinged tail, eyes and markings stay within four visible draws. */
export function createReefLife() {
  const root = new Group(); root.name = 'living-reef-fish';
  const states = Array.from({ length: REEF_FISH_COUNTS.high }, (_, index) => createReefFishState(index));
  const bodyGeometry = merge([
    oval(.015, 0, 0, .083, .053, .024),
    fin([-.045,.028,0, -.036,.084,0, .034,.047,0]),
    fin([-.039,-.025,0, -.025,-.063,0, .025,-.03,0]),
  ]);
  const tailGeometry = fin([0,0,0, -.061,.048,0, -.057,-.048,0]);
  const detailGeometry = merge([
    oval(.063,.015,.019,.007,.008,.005), oval(.063,.015,-.019,.007,.008,.005),
    oval(.017,0,.024,.009,.044,.002), oval(.017,0,-.024,.009,.044,.002),
    oval(-.018,0,.023,.006,.041,.002), oval(-.018,0,-.023,.006,.041,.002),
  ]);
  const bellyGeometry = merge([
    oval(.02,-.03,0,.053,.012,.018),
    fin([.026,-.011,.013,-.014,-.032,.055,-.029,-.009,.02]),
    fin([.026,-.011,-.013,-.029,-.009,-.02,-.014,-.032,-.055]),
  ]);
  const skin = new MeshStandardMaterial({ color: '#ffffff', roughness: .43, metalness: .07, side: DoubleSide });
  const ink = new MeshStandardMaterial({ color: '#143b41', roughness: .55 });
  const pearl = new MeshStandardMaterial({ color: '#fff2b9', roughness: .48, side: DoubleSide });
  const proxyGeometry = new SphereGeometry(.38, 6, 4), proxyMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const bodies = new InstancedMesh(bodyGeometry, skin, states.length), tails = new InstancedMesh(tailGeometry, skin, states.length);
  const details = new InstancedMesh(detailGeometry, ink, states.length), bellies = new InstancedMesh(bellyGeometry, pearl, states.length);
  const proxies = new InstancedMesh(proxyGeometry, proxyMaterial, states.length);
  bodies.name = 'channel-reef-schools'; tails.name = 'articulated-reef-fish-tails'; details.name = 'reef-fish-eyes-and-bars'; bellies.name = 'reef-fish-pectoral-fins'; proxies.name = 'reef-fish-touch-targets';
  // Raycasting caches this sphere independently of frustumCulled. Keep moving fish pickable
  // throughout the full habitat rather than retaining the first frame's instance bounds.
  proxies.boundingSphere = new Sphere(new Vector3(-25, -4, -42), 63);
  const meshes = [bodies, tails, details, bellies, proxies];
  meshes.forEach(mesh => { mesh.frustumCulled = false; root.add(mesh); });
  // Only the touch targets are raycast; their IDs map directly to the moving fish.
  [bodies, tails, details, bellies].forEach(mesh => { mesh.raycast = () => {}; });
  const color = new Color(), transform = new Object3D(), tail = new Object3D();
  for (let i = 0; i < states.length; i++) {
    color.set(['#ffd04f', '#68dbe6', '#ff9872', '#b699f3', '#f2f5cd'][i % 5]);
    bodies.setColorAt(i, color); tails.setColorAt(i, color);
  }
  function writeMatrices() {
    for (let i = 0; i < bodies.count; i++) {
      const fish = states[i], size = .83 + (i % 5) * .047;
      transform.position.copy(fish.position); transform.rotation.set(0, fish.heading, 0); transform.rotateZ(fish.pitch);
      transform.scale.setScalar(size); transform.updateMatrix();
      bodies.setMatrixAt(i, transform.matrix); details.setMatrixAt(i, transform.matrix); bellies.setMatrixAt(i, transform.matrix); proxies.setMatrixAt(i, transform.matrix);
      tail.position.set(-.058, 0, 0); tail.rotation.set(0, fish.tail, 0); tail.scale.setScalar(1); tail.updateMatrix();
      tail.matrix.premultiply(transform.matrix); tails.setMatrixAt(i, tail.matrix);
    }
    meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  }
  function update(delta: number, paused = false) { if (!paused) { stepReefFish(states, delta, false, bodies.count); writeMatrices(); } }
  function setQuality(tier: EnvironmentProps['quality']) { meshes.forEach(mesh => { mesh.count = REEF_FISH_COUNTS[tier]; }); writeMatrices(); }
  function interact(index: number) { return interactWithReefFish(states.slice(0, bodies.count), index); }
  writeMatrices();
  let timer: ReturnType<typeof setTimeout>;
  function dispose() { [bodyGeometry, tailGeometry, detailGeometry, bellyGeometry, proxyGeometry].forEach(value => value.dispose()); [skin, ink, pearl, proxyMaterial].forEach(value => value.dispose()); meshes.forEach(mesh => mesh.dispose()); }
  return { root, states, update, setQuality, interact, dispose, retain() { clearTimeout(timer); return () => { timer = setTimeout(dispose, 0); }; } };
}

export function ReefLife({ paused, quality }: EnvironmentProps) {
  const life = useMemo(() => createReefLife(), []);
  const canvas = useThree(state => state.gl.domElement);
  const interactions = useRef(0);
  const previousCursor = useRef<string | null>(null);
  useEffect(() => life.retain(), [life]);
  useEffect(() => { life.setQuality(quality); }, [life, quality]);
  useFrame((_, delta) => life.update(delta, paused));
  function onFishClick(event: ThreeEvent<MouseEvent>) {
    // Orbit drags pass through unchanged; only a stationary tap startles nearby fish.
    if (event.delta > 4 || event.instanceId === undefined) return;
    if (life.interact(event.instanceId)) canvas.setAttribute('data-reef-interactions', String(++interactions.current));
  }
  function leaveFish() {
    canvas.removeAttribute('data-reef-hovered');
    if (previousCursor.current !== null) {
      if (canvas.style.cursor === 'pointer') canvas.style.setProperty('cursor', previousCursor.current);
      previousCursor.current = null;
    }
  }
  function enterFish(event: ThreeEvent<PointerEvent>) {
    if (event.instanceId === undefined || event.buttons) return;
    canvas.setAttribute('data-reef-hovered', String(event.instanceId));
    if (event.pointerType !== 'touch') {
      if (previousCursor.current === null) previousCursor.current = canvas.style.cursor;
      canvas.style.setProperty('cursor', 'pointer');
    }
  }
  return <primitive object={life.root} onClick={onFishClick} onPointerOver={enterFish} onPointerMove={enterFish} onPointerOut={leaveFish} />;
}
