'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createCoralSites, createMarineState, MARINE_COUNTS, stepMarine, writeReefFish, type MarinePose } from './marineState';
import { harborWaterHeight } from './waterSurface';

function merge(parts: BufferGeometry[]) {
  parts.forEach(part => part.deleteAttribute('uv'));
  const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return geometry;
}
function sphere(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  return new SphereGeometry(1, 10, 6).scale(sx, sy, sz).translate(x, y, z);
}
function branch(a: Vector3, b: Vector3, radius: number) {
  const axis = b.clone().sub(a), transform = new Object3D();
  transform.position.copy(a).add(b).multiplyScalar(.5);
  transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.clone().normalize()); transform.updateMatrix();
  return new CylinderGeometry(radius * .57, radius, axis.length(), 7).applyMatrix4(transform.matrix);
}
/** Swept, tapered fin membrane with a raised central ridge. Coordinates are x/y in the fin plane. */
function fin(points: readonly [number, number][], thickness = .026) {
  const vertices: number[] = [], indices: number[] = [];
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  for (const side of [-1, 1]) {
    const start = vertices.length / 3; vertices.push(cx, cy, thickness * side);
    points.forEach(([x, y]) => vertices.push(x, y, 0));
    for (let i = 0; i < points.length; i++) {
      const a = start, b = start + i + 1, c = start + (i + 1) % points.length + 1;
      if (side > 0) indices.push(a, b, c); else indices.push(a, c, b);
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function marineBodyGeometry(shark = false) {
  const positions: number[] = [], indices: number[] = [];
  // Nose points right; the narrowing caudal peduncle joins the separately articulated tail.
  const profiles = shark ? [[-1.55,.10,.09],[-1.1,.22,.2],[-.5,.36,.35],[.15,.39,.38],[.8,.29,.32],[1.3,.15,.20],[1.7,.005,.01]] : [[-1.3,.08,.09],[-.85,.19,.19],[-.3,.34,.33],[.35,.39,.35],[.78,.31,.29],[1.02,.18,.21],[1.13,.06,.12]];
  profiles.forEach(([x, ry, rz], row) => {
    for (let side = 0; side <= 24; side++) {
      const angle = side / 24 * Math.PI * 2;
      positions.push(x, Math.cos(angle) * ry, Math.sin(angle) * rz);
      if (row && side) { const i = row * 25 + side; indices.push(i, i - 1, i - 25, i - 1, i - 26, i - 25); }
    }
  });
  for (const end of [0, profiles.length - 1]) {
    const center = positions.length / 3; positions.push(profiles[end][0], 0, 0);
    for (let side = 0; side < 24; side++) { const a = end * 25 + side, b = a + 1; if (end === 0) indices.push(center, b, a); else indices.push(center, a, b); }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function coralGeometry(form: number) {
  const parts: BufferGeometry[] = [];
  if (form === 0) {
    parts.push(branch(new Vector3(), new Vector3(0, .68, 0), .095));
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4, base = new Vector3(0, .18 + i * .057, 0), tip = new Vector3(Math.cos(angle) * .36, .63 + i * .047, Math.sin(angle) * .36);
      parts.push(branch(base, tip, .05));
      for (let twig = 0; twig < 3; twig++) {
        const p = base.clone().lerp(tip, .35 + twig * .2);
        parts.push(branch(p, p.clone().add(new Vector3(Math.cos(angle + .5) * .13, .22, Math.sin(angle + .5) * .13)), .022));
      }
    }
  } else if (form === 1) {
    parts.push(branch(new Vector3(), new Vector3(0, .55, 0), .09));
    for (let level = 0; level < 3; level++) {
      const radius = .52 - level * .08;
      const table = new CylinderGeometry(radius, radius * .82, .075, 24, 1).translate(level * .06, .32 + level * .2, 0);
      const attribute = table.getAttribute('position');
      for (let i = 0; i < attribute.count; i++) { const x = attribute.getX(i), z = attribute.getZ(i); attribute.setY(i, attribute.getY(i) + .035 * Math.sin(Math.atan2(z, x) * 7)); }
      table.computeVertexNormals(); parts.push(table);
      for (let polyp = 0; polyp < 14; polyp++) { const angle = polyp * 2.4, r = Math.sqrt((polyp + 1) / 15) * radius; parts.push(new SphereGeometry(1, 6, 4).scale(.033, .043, .033).translate(Math.cos(angle) * r + level * .06, .38 + level * .2, Math.sin(angle) * r)); }
    }
  } else {
    parts.push(branch(new Vector3(), new Vector3(0, .35, 0), .05));
    for (let i = 0; i < 11; i++) {
      const angle = -.95 + i * .19, tip = new Vector3(Math.sin(angle) * .6, .3 + Math.cos(angle) * .72, .035 * Math.sin(i));
      parts.push(branch(new Vector3(0, .2, 0), tip, .018));
      for (let j = 1; j < 5 && i < 10; j++) {
        const nextAngle = angle + .19, t = j / 5;
        parts.push(branch(new Vector3(tip.x * t, .2 + (tip.y - .2) * t, tip.z * t), new Vector3(Math.sin(nextAngle) * .6 * t, .2 + (.1 + Math.cos(nextAngle) * .72) * t, .035 * Math.sin(i + 1) * t), .009));
      }
    }
  }
  const geometry = merge(parts), positions = geometry.getAttribute('position'), colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const shade = .72 + Math.min(1, y) * .25 + .08 * Math.sin(x * 73 + z * 59 + y * 47);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.userData.form = ['staghorn', 'table', 'sea-fan'][form]; return geometry;
}

export function createReefLife() {
  const root = new Group(); root.name = 'living-coral-channel';
  const resources = new Set<BufferGeometry>();
  const material = (color: string, roughness = .65) => new MeshStandardMaterial({ color, roughness, side: DoubleSide });
  const materials = [material('#6f98a1', .33), material('#dce9db', .47), material('#102c31'), material('#526d79', .46), material('#b4b696', .92), material('#ffffff', .38)];
  const coralMaterial = material('#ffffff', .85); coralMaterial.vertexColors = true; materials.push(coralMaterial);
  const mesh = (parent: Group, name: string, geometry: BufferGeometry, mat: MeshStandardMaterial) => {
    resources.add(geometry); const object = new Mesh(geometry, mat); object.name = name; object.raycast = () => {}; parent.add(object); return object;
  };
  const sites = createCoralSites(), coralMeshes: InstancedMesh[] = [];
  const dummy = new Object3D(), color = new Color();
  const palette = ['#f17e69', '#985cbe', '#f4c157', '#42aa9c', '#d8608d', '#648ecc'];
  for (let form = 0; form < 3; form++) {
    const selected = sites.filter(site => site.form === form), geometry = coralGeometry(form); resources.add(geometry);
    const instances = new InstancedMesh(geometry, coralMaterial, selected.length); instances.name = `reef-${geometry.userData.form}`;
    selected.forEach((site, i) => { dummy.position.set(site.x, site.floor + 1.16, site.z); dummy.rotation.set(0, site.rotation, 0); dummy.scale.setScalar(site.scale); dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix); instances.setColorAt(i, color.set(palette[site.color])); });
    instances.instanceMatrix.needsUpdate = true; instances.raycast = () => {}; root.add(instances); coralMeshes.push(instances);
  }
  // Each colony rises from a substantial limestone mound seated into the existing seabed.
  const moundGeometry = merge([sphere(0, .35, 0, .85, .83, .8), sphere(.46, .16, .22, .45, .6, .55), sphere(-.42, .06, -.2, .5, .5, .45)]); resources.add(moundGeometry);
  const mounds = new InstancedMesh(moundGeometry, materials[4], sites.length); mounds.name = 'reef-limestone-foundations';
  sites.forEach((site, i) => { dummy.position.set(site.x, site.floor, site.z); dummy.rotation.set(0, site.rotation, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mounds.setMatrixAt(i, dummy.matrix); });
  mounds.instanceMatrix.needsUpdate = true; mounds.raycast = () => {}; root.add(mounds);

  const states = [createMarineState(0), createMarineState(1), createMarineState(0, true), createMarineState(1, true)];
  const creatures = states.map(state => {
    const animal = new Group(); animal.name = state.shark ? 'offshore-shark' : 'bottlenose-dolphin'; root.add(animal);
    const skin = materials[state.shark ? 3 : 0];
    mesh(animal, 'continuous-fusiform-body', marineBodyGeometry(state.shark), skin);
    mesh(animal, 'pale-countershaded-belly', sphere(.1, -.18, 0, state.shark ? 1.2 : .85, .17, .27), materials[1]);
    mesh(animal, 'swept-dorsal-fin', fin([[-.43,.28],[-.38,.72],[-.26,.9],[-.10,.66],[.20,.32]]), skin);
    if (!state.shark) {
      mesh(animal, 'long-bottlenose-rostrum', sphere(1.16, -.05, 0, .38, .10, .115), skin);
      mesh(animal, 'lower-jaw', sphere(1.18, -.11, 0, .35, .023, .087), materials[1]);
      mesh(animal, 'blowhole', sphere(.62, .347, 0, .07, .006, .041), materials[2]);
    }
    const eyeX = state.shark ? 1.2 : .88, eyeZ = state.shark ? .22 : .247;
    const eyes = merge([sphere(eyeX, .08, eyeZ, .034, .032, .018), sphere(eyeX, .08, -eyeZ, .034, .032, .018)]); mesh(animal, 'paired-eyes', eyes, materials[2]);
    for (const side of [-1, 1]) {
      const flipper = fin([[-.38,0],[-.76,.47],[-.70,.67],[-.51,.62],[.10,0]], .025).rotateX(side * Math.PI / 2).translate(.27, -.15, side * .22);
      mesh(animal, 'paired-pectoral-flipper', flipper, skin);
      if (state.shark) {
        const gills: BufferGeometry[] = [];
        for (let i = 0; i < 5; i++) gills.push(branch(new Vector3(.45 - i * .095, -.11, side * .365), new Vector3(.48 - i * .095, .13, side * .365), .009));
        mesh(animal, 'five-gill-slits', merge(gills), materials[2]);
      }
    }
    const tail = new Group(); tail.name = state.shark ? 'vertical-caudal-fin' : 'horizontal-tail-flukes'; tail.position.x = state.shark ? -1.55 : -1.3; animal.add(tail);
    const tailGeometry = fin(state.shark ? [[.08,0],[-.38,.39],[-.8,.95],[-.68,.38],[-.42,.02],[-.69,-.45],[-.35,-.27]] : [[.10,0],[-.33,.37],[-.71,.65],[-.61,.28],[-.39,0],[-.61,-.28],[-.71,-.65],[-.33,-.37]], .033);
    if (!state.shark) tailGeometry.rotateX(Math.PI / 2);
    mesh(tail, 'swept-tail-surface', tailGeometry, skin);
    return { animal, tail };
  });
  const fishGeometry = merge([sphere(0, 0, 0, .22, .13, .055), fin([[-.18,0],[-.36,.12],[-.32,0],[-.36,-.12]], .008)]); resources.add(fishGeometry);
  const fishMaterial = material('#ffffff', .5); materials.push(fishMaterial);
  const fish = new InstancedMesh(fishGeometry, fishMaterial, MARINE_COUNTS.high); fish.name = 'channel-reef-schools'; fish.frustumCulled = false; fish.raycast = () => {}; root.add(fish);
  for (let i = 0; i < MARINE_COUNTS.high; i++) fish.setColorAt(i, color.set(['#ffc84a', '#65cdec', '#ff9b66'][i % 3]));
  const stripeGeometry = merge([sphere(.025, .01, .055, .025, .113, .007), sphere(.025, .01, -.055, .025, .113, .007), sphere(.105, .038, .053, .018, .02, .009), sphere(.105, .038, -.053, .018, .02, .009)]); resources.add(stripeGeometry);
  const stripes = new InstancedMesh(stripeGeometry, materials[2], MARINE_COUNTS.high); stripes.name = 'reef-fish-bars-and-eyes'; stripes.frustumCulled = false; stripes.raycast = () => {}; root.add(stripes);
  const splashMaterial = material('#e5ffff', .27); splashMaterial.transparent = true; splashMaterial.depthWrite = false; materials.push(splashMaterial);
  const ringGeometry = new TorusGeometry(1, .026, 5, 40).rotateX(Math.PI / 2), dropGeometry = new SphereGeometry(1, 6, 4); resources.add(ringGeometry); resources.add(dropGeometry);
  const splashes = states.slice(0, 2).map(() => {
    const ring = new Mesh(ringGeometry, splashMaterial.clone()); materials.push(ring.material); ring.renderOrder = 4; root.add(ring);
    const drops = new InstancedMesh(dropGeometry, ring.material, 12); drops.renderOrder = 4; drops.frustumCulled = false; drops.raycast = () => {}; root.add(drops); return { ring, drops };
  });
  let time = 0, quality: EnvironmentProps['quality'] = 'high';
  const fishPose: MarinePose = { position: new Vector3(), heading: 0, pitch: 0, tail: 0, breach: false };
  function update(delta: number, paused = false, onContact?: (point: Vector3) => void, waterTime?: number) {
    if (paused) return;
    time += Math.min(.05, Math.max(0, delta));
    states.forEach((state, i) => {
      if (stepMarine(state, delta, false, waterTime)) onContact?.(state.splash);
      const { animal, tail } = creatures[i];
      animal.position.copy(state.position); animal.rotation.set(0, state.heading, 0); animal.rotateZ(state.pitch);
      if (state.shark) tail.rotation.y = state.tail; else tail.rotation.z = state.tail;
      animal.visible = !state.shark || quality !== 'low';
      if (i > 1) return;
      const splash = splashes[i], age = state.splashAge; splash.ring.visible = splash.drops.visible = age < 1.8;
      if (age >= 1.8) return;
      splash.ring.position.set(state.splash.x, harborWaterHeight(state.splash.x, state.splash.z, waterTime ?? state.time) + .03, state.splash.z);
      splash.ring.scale.setScalar(.35 + age * 1.7); splash.ring.material.opacity = .72 * (1 - age / 1.8);
      for (let drop = 0; drop < 12; drop++) {
        const angle = drop / 12 * Math.PI * 2, spread = age * (1 + (drop % 3) * .15);
        dummy.position.set(state.splash.x + Math.cos(angle) * spread, state.splash.y + Math.max(0, age * (2.5 + drop % 3 * .22) - age * age * 4.9), state.splash.z + Math.sin(angle) * spread);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(.035, .065, .035).multiplyScalar(age < .65 ? 1 : 0); dummy.updateMatrix(); splash.drops.setMatrixAt(drop, dummy.matrix);
      }
      splash.drops.instanceMatrix.needsUpdate = true;
    });
    for (let i = 0; i < fish.count; i++) {
      writeReefFish(i, time, fishPose); dummy.position.copy(fishPose.position); dummy.rotation.set(0, fishPose.heading + fishPose.tail * .11, 0); dummy.scale.setScalar(.8 + (i % 4) * .09); dummy.updateMatrix(); fish.setMatrixAt(i, dummy.matrix); stripes.setMatrixAt(i, dummy.matrix);
    }
    fish.instanceMatrix.needsUpdate = true; stripes.instanceMatrix.needsUpdate = true;
  }
  function setQuality(tier: EnvironmentProps['quality']) { quality = tier; creatures.forEach((creature, index) => { creature.animal.visible = index < 2 || tier !== 'low'; }); fish.count = stripes.count = MARINE_COUNTS[tier]; coralMeshes.forEach(mesh => { mesh.count = tier === 'low' ? Math.ceil(mesh.instanceMatrix.count * .6) : mesh.instanceMatrix.count; }); }
  update(0);
  let timer: ReturnType<typeof setTimeout>;
  function dispose() { resources.forEach(resource => resource.dispose()); materials.forEach(value => value.dispose()); root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); }
  return { root, update, setQuality, dispose, retain() { clearTimeout(timer); return () => { timer = setTimeout(dispose, 0); }; } };
}

export function ReefLife({ runtime, paused, quality }: EnvironmentProps) {
  const life = useMemo(() => createReefLife(), []);
  useEffect(() => life.retain(), [life]);
  useEffect(() => { life.setQuality(quality); }, [life, quality]);
  useFrame((_, delta) => life.update(delta, paused, point => {
    const state = runtime.current;
    state.ripple.x = point.x; state.ripple.z = point.z;
    state.ripple.time = state.elapsed; state.ripple.serial++;
  }, runtime.current.elapsed));
  return <primitive object={life.root} />;
}
