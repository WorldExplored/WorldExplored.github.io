'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute,
  InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial, MeshStandardMaterial,
  Object3D, Points, PointsMaterial, Raycaster, ShaderMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3, type Camera,
} from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { islandGeometry, seededRandom, shoreRadius, terrainHeight, type Island } from './terrain';
import type { EnvironmentProps } from './Water';

const plantVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPointerStrength;
  uniform vec3 uPointerWorld;
  attribute float aPhase;
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vLight;
  varying float vDistance;
  void main() {
    vec3 p = position;
    p.x += sin(uTime + aPhase + p.y * .9) * p.y * p.y * .18;
    p.z += cos(uTime * .7 + aPhase) * p.y * .06;
    vec4 local = instanceMatrix * vec4(p, 1.);
    vec2 away = instanceMatrix[3].xz - uPointerWorld.xz;
    float proximity = 1. - smoothstep(.10, 1.8, length(away));
    float bend = uPointerStrength * proximity * position.y * position.y;
    local.xz += away / max(length(away), .15) * bend * .46;
    local.y -= bend * .055;
    vec4 mv = modelViewMatrix * local;
    vTint = aTint;
    vLight = .77 + position.y * .23;
    vDistance = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const plantFragment = /* glsl */ `
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec3 vTint;
  varying float vLight;
  varying float vDistance;
  void main() {
    vec3 color = vTint * vLight;
    color = mix(color, uFog, smoothstep(uFogRange.x, uFogRange.y, vDistance));
    gl_FragColor = vec4(color, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function bladeGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.06, 0, 0, .06, 0, 0, -.045, .48, .015, .045, .48, .015, -.015, .83, .07, .02, .83, .07, .035, 1, .10,
  ], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  geometry.computeVertexNormals();
  return geometry;
}

function blossomGeometry() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  for (let petal = 0; petal < 5; petal++) {
    const angle = petal / 5 * Math.PI * 2;
    positions.push(0, .8, 0, Math.cos(angle - .45) * .15, .83, Math.sin(angle - .45) * .15, Math.cos(angle + .45) * .15, .83, Math.sin(angle + .45) * .15);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function plantInstances(count: number, flowers: boolean) {
  const random = seededRandom(flowers ? 83 : 41);
  const geometry = flowers ? blossomGeometry() : bladeGeometry();
  const material = new ShaderMaterial({
    vertexShader: plantVertex, fragmentShader: plantFragment, side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPointerStrength: { value: 0 }, uPointerWorld: { value: new Vector3() }, uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) } },
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = flowers ? 'environment-flowers' : 'environment-grass';
  const transform = new Object3D();
  const tint = new Color();
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  // Proximity diagnostics query nearby cells instead of scanning every blade.
  const occupied = new Uint16Array(64 * 64);
  for (let index = 0; index < count; index++) {
    const islandIndex = index % world.islands.length;
    const island = world.islands[islandIndex];
    const angle = random() * Math.PI * 2;
    const shore = shoreRadius(angle, islandIndex);
    const directionalRadius = Math.hypot(Math.cos(angle) * island.radius[0], Math.sin(angle) * island.radius[1]) * shore;
    const minimumRadius = (islandIndex < 2 ? 3.5 : 1.6) / directionalRadius;
    const radius = islandIndex < 3 ? minimumRadius + random() * (.88 - minimumRadius) : Math.sqrt(random()) * .86;
    const r = radius * shoreRadius(angle, islandIndex);
    transform.position.set(
      island.center[0] + Math.cos(angle) * r * island.radius[0],
      island.center[1] + terrainHeight(radius, island.height, angle, islandIndex) - .015,
      island.center[2] + Math.sin(angle) * r * island.radius[1],
    );
    const size = .18 + random() * (islandIndex > 2 ? .85 : .38);
    transform.scale.set(.7 + random() * .9, size, 1);
    transform.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .15);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    positions.set([transform.position.x, transform.position.y, transform.position.z], index * 3);
    const cellX = Math.floor((transform.position.x + 48) / 1.5);
    const cellZ = Math.floor((transform.position.z + 48) / 1.5);
    if (cellX >= 0 && cellX < 64 && cellZ >= 0 && cellZ < 64) occupied[cellZ * 64 + cellX] ||= index + 1;
    phases[index] = random() * Math.PI * 2;
    tint.set(flowers ? world.colors.porcelain : world.colors.grassDark);
    if (!flowers) tint.lerp(new Color(world.colors.grassLight), random() * .8);
    colors.set([tint.r, tint.g, tint.b], index * 3);
  }
  geometry.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('aTint', new InstancedBufferAttribute(colors, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  return { mesh, geometry, material, positions, occupied };
}

function makeClouds(count: number) {
  const random = seededRandom(19);
  const geometry = new SphereGeometry(1, 12, 8);
  const material = new MeshLambertMaterial({ color: world.lighting.cloudColor, emissive: world.lighting.ambientSky, emissiveIntensity: .14 });
  const time = { value: 0 };
  const strength = { value: 0 };
  const rayOrigin = { value: new Vector3() };
  const rayDirection = { value: new Vector3(0, 0, -1) };
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.uniforms.uPointerStrength = strength;
    shader.uniforms.uRayOrigin = rayOrigin;
    shader.uniforms.uRayDirection = rayDirection;
    shader.vertexShader = `uniform float uTime; uniform float uPointerStrength; uniform vec3 uRayOrigin; uniform vec3 uRayDirection; attribute float aSpeed; attribute vec3 aCenter;\n${shader.vertexShader}`.replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.);
      vec3 center = aCenter;
      center.x = mod(aCenter.x + uTime * aSpeed + 85., 170.) - 85.;
      mvPosition.x += center.x - aCenter.x;
      float along = dot(center - uRayOrigin, uRayDirection);
      vec3 away = center - (uRayOrigin + uRayDirection * max(along, 0.));
      float response = (1. - smoothstep(.6, 4.5, length(away))) * uPointerStrength * step(0., along);
      mvPosition.xyz = center + (mvPosition.xyz - center) * vec3(1. + response * .07, 1. - response * .11, 1.);
      mvPosition.xyz += away / max(length(away), .8) * response * .85;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  material.customProgramCacheKey = () => 'habitat-cloud-proximity';
  const mesh = new InstancedMesh(geometry, material, count * 5);
  mesh.name = 'environment-clouds';
  const transform = new Object3D();
  const speeds = new Float32Array(count * 5);
  const centers = new Float32Array(count * 5 * 3);
  for (let cloud = 0; cloud < count; cloud++) {
    const x = (random() - .5) * 130;
    const y = 11 + random() * 11;
    const z = -15 - random() * 50;
    const size = 1.1 + random() * 1.5;
    const speed = world.environment.cloudSpeed * (.25 + random() * .75);
    for (let puff = 0; puff < 5; puff++) {
      const center = puff === 2;
      transform.position.set(x + (puff - 2) * size * 1.1, y + (center ? size * .35 : random() * size * .2), z + (random() - .5) * size);
      transform.scale.set(size * (center ? 1.55 : 1.15), size * (center ? .80 : .53), size * .8);
      transform.updateMatrix();
      mesh.setMatrixAt(cloud * 5 + puff, transform.matrix);
      speeds[cloud * 5 + puff] = speed;
      centers.set([x, y, z], (cloud * 5 + puff) * 3);
    }
  }
  geometry.setAttribute('aSpeed', new InstancedBufferAttribute(speeds, 1));
  geometry.setAttribute('aCenter', new InstancedBufferAttribute(centers, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, geometry, material, time, strength, rayOrigin, rayDirection, centers, speeds };
}

const bubbleVertex = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec4 p = instanceMatrix * vec4(position, 1.);
    p.y += sin(uTime * .21 + aPhase) * .22;
    p.x += sin(uTime * .13 + aPhase) * .18;
    vec4 wp = modelMatrix * p;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vView = cameraPosition - wp.xyz;
    vDistance = length(vView);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const bubbleFragment = /* glsl */ `
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  uniform vec3 uTint;
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec3 n = normalize(vNormal);
    float rim = pow(1. - abs(dot(n, normalize(vView))), 1.5);
    float highlight = pow(max(dot(n, uSunDirection), 0.), 38.);
    vec3 color = mix(uFog, uTint, rim * .8 + highlight * .4);
    color = mix(color, uFog, smoothstep(uFogRange.x, uFogRange.y, vDistance));
    gl_FragColor = vec4(color, .015 + rim * .15 + highlight * .10);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeBubbles(count: number) {
  const random = seededRandom(44);
  const geometry = new SphereGeometry(1, 16, 10);
  const material = new ShaderMaterial({
    vertexShader: bubbleVertex, fragmentShader: bubbleFragment, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) }, uTint: { value: new Color(world.lighting.cloudColor) }, uSunDirection: { value: new Vector3(...world.lighting.sunPosition).normalize() } },
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = 'environment-distant-motes';
  const phases = new Float32Array(count);
  const transform = new Object3D();
  for (let index = 0; index < count; index++) {
    transform.position.set((random() - .5) * 48, 10 + random() * 9, -27 - random() * 33);
    transform.scale.setScalar(.08 + random() * .14);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    phases[index] = random() * Math.PI * 2;
  }
  geometry.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, geometry, material };
}

function makeParticles(count: number) {
  const random = seededRandom(62);
  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) positions.set([(random() - .5) * 45, 7 + random() * 12, -25 - random() * 30], index * 3);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: world.lighting.sunColor, size: .045, transparent: true, opacity: .25, depthWrite: false, sizeAttenuation: true });
  const mesh = new Points(geometry, material);
  return { mesh, geometry, material };
}

function bridgeGeometry(start: Vector3, end: Vector3, offset: number, height: number, radius: number) {
  const direction = end.clone().sub(start).normalize();
  const side = new Vector3(-direction.z, 0, direction.x).multiplyScalar(offset);
  const points = [start.clone(), start.clone().lerp(end, .25), start.clone().lerp(end, .5), start.clone().lerp(end, .75), end.clone()];
  points.forEach((point, index) => { point.add(side); point.y += Math.sin(index / 4 * Math.PI) * .8 + height; });
  return new TubeGeometry(new CatmullRomCurve3(points), 28, radius, 6, false);
}

function makeGrove() {
  const count = 26;
  const random = seededRandom(106);
  const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(.025, .25, 0), new Vector3(-.025, .48, .015), new Vector3(.025, .78, 0)]);
  const trunkGeometry = new TubeGeometry(curve, 8, .035, 6, false);
  const foliageGeometry = new SphereGeometry(1, 12, 8);
  const trunkMaterial = new MeshStandardMaterial({ color: '#78865a', roughness: .86 });
  const foliageMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: .85 });
  const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, count);
  const crowns = new InstancedMesh(foliageGeometry, foliageMaterial, count * 3);
  const transform = new Object3D();
  const tree = new Object3D();
  const leaf = new Object3D();
  const color = new Color();
  const dark = new Color('#286743');
  const light = new Color('#73a442');
  for (let index = 0; index < count; index++) {
    const islandIndex = index < 8 ? 0 : index < 15 ? 1 : index < 17 ? 2 : index < 22 ? 3 : 4;
    const island = world.islands[islandIndex];
    // Rear groves frame the architecture; foreground trees hug the outer banks.
    const angle = islandIndex < 3 ? Math.PI + random() * Math.PI : islandIndex === 3 ? Math.PI * (.68 + random() * .64) : (random() - .5) * Math.PI * .72;
    const directionalRadius = Math.hypot(Math.cos(angle) * island.radius[0], Math.sin(angle) * island.radius[1]) * shoreRadius(angle, islandIndex);
    const minimumRadius = islandIndex < 3 ? (islandIndex < 2 ? 3.65 : 1.7) / directionalRadius : .73;
    const radius = minimumRadius + random() * (.90 - minimumRadius);
    const r = radius * shoreRadius(angle, islandIndex);
    const size = (islandIndex > 2 ? 2 + random() * 1.2 : islandIndex === 2 ? 1.2 + random() * .5 : 1.5 + random() * 1.25) / 1.1;
    tree.position.set(island.center[0] + Math.cos(angle) * r * island.radius[0], island.center[1] + terrainHeight(radius, island.height, angle, islandIndex) - .02, island.center[2] + Math.sin(angle) * r * island.radius[1]);
    tree.scale.setScalar(size);
    tree.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .06);
    tree.updateMatrix();
    trunks.setMatrixAt(index, tree.matrix);
    for (let level = 0; level < 3; level++) {
      leaf.position.set(level === 0 ? -.10 : level === 1 ? .11 : .015, [.58, .78, .92][level], (level - 1) * .025);
      leaf.scale.set([.34, .30, .23][level], [.26, .25, .18][level], [.28, .27, .21][level]);
      leaf.rotation.set(0, random() * Math.PI, (random() - .5) * .18);
      leaf.updateMatrix();
      transform.matrix.multiplyMatrices(tree.matrix, leaf.matrix);
      crowns.setMatrixAt(index * 3 + level, transform.matrix);
      color.copy(dark).lerp(light, .10 + random() * .65 + level * .08);
      crowns.setColorAt(index * 3 + level, color);
    }
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  return { trunks, crowns, dispose() { trunkGeometry.dispose(); foliageGeometry.dispose(); trunkMaterial.dispose(); foliageMaterial.dispose(); } };
}

function makeLandscape() {
  const geometries: BufferGeometry[] = [];
  const islands = world.islands.map((island, index) => {
    const geometry = islandGeometry(island, index);
    geometries.push(geometry);
    return { geometry, position: island.center };
  });
  const farIslands: Island[] = [
    { center: [-25, -.6, -43], radius: [10, 5.5], height: 3.8 },
    { center: [21, -.7, -51], radius: [13, 6.5], height: 4.5 },
  ];
  farIslands.forEach((island, index) => {
    const geometry = islandGeometry(island, index + 8, 32);
    geometries.push(geometry);
    islands.push({ geometry, position: island.center });
  });
  const paths = [[new Vector3(-3, 1, 2), new Vector3(-1, .7, 5)], [new Vector3(2, .7, 5), new Vector3(5, 1, 0)]];
  const bridges = paths.map(([start, end]) => {
    const deck = bridgeGeometry(start, end, 0, 0, .49);
    // Flatten the tube cross-section into an uninterrupted rounded walking deck.
    const vertices = deck.getAttribute('position');
    for (let index = 0; index < vertices.count; index++) {
      const progress = Math.floor(index / 7) / 28;
      const base = start.y + (end.y - start.y) * progress + Math.sin(progress * Math.PI) * .8;
      vertices.setY(index, base + (vertices.getY(index) - base) * .16);
    }
    deck.computeVertexNormals();
    const rails = [-.47, .47].map(offset => bridgeGeometry(start, end, offset, .58, .035));
    geometries.push(deck, ...rails);
    return { deck, rails };
  });
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .88 });
  const porcelain = new MeshStandardMaterial({ color: world.colors.porcelain, roughness: .3, metalness: .12 });
  const rail = new MeshStandardMaterial({ color: world.colors.cyan, roughness: .18, metalness: .26 });
  const rockGeometry = new SphereGeometry(1, 10, 7);
  const rockMaterial = new MeshStandardMaterial({ color: world.colors.stone, roughness: .78 });
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, 44);
  const random = seededRandom(27);
  const transform = new Object3D();
  for (let index = 0; index < 44; index++) {
    const islandIndex = index % world.islands.length;
    const island = world.islands[islandIndex];
    const angle = random() * Math.PI * 2;
    const radius = .85 + random() * .08;
    const r = radius * shoreRadius(angle, islandIndex);
    transform.position.set(island.center[0] + Math.cos(angle) * r * island.radius[0], island.center[1] + terrainHeight(radius, island.height, angle, islandIndex) + .015, island.center[2] + Math.sin(angle) * r * island.radius[1]);
    const size = .13 + random() * (index > 31 ? .52 : .22);
    transform.scale.set(size * 1.8, size * (index > 31 ? 1.0 : .72), size);
    transform.rotation.set(random(), random() * Math.PI, random() * .2);
    transform.updateMatrix();
    rocks.setMatrixAt(index, transform.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  return { islands, bridges, material, porcelain, rail, rocks, dispose() {
    geometries.forEach(geometry => geometry.dispose());
    material.dispose(); porcelain.dispose(); rail.dispose(); rockGeometry.dispose(); rockMaterial.dispose();
  } };
}

function createPointerField() {
  return { raycaster: new Raycaster(), screen: new Vector2(), center: new Vector3(), strength: 0, nearCloud: false, nearPlant: false };
}

function nearPlants(point: SceneRuntime['pointerWorld'], plants: ReturnType<typeof plantInstances>) {
  const cellX = Math.floor((point[0] + 48) / 1.5);
  const cellZ = Math.floor((point[2] + 48) / 1.5);
  for (let z = Math.max(0, cellZ - 2); z <= Math.min(63, cellZ + 2); z++) {
    for (let x = Math.max(0, cellX - 2); x <= Math.min(63, cellX + 2); x++) {
      const index = plants.occupied[z * 64 + x] - 1;
      if (index >= 0 && Math.hypot(plants.positions[index * 3] - point[0], plants.positions[index * 3 + 2] - point[2]) < 1.8) return true;
    }
  }
  return false;
}

function updatePointerField(state: SceneRuntime, camera: Camera, delta: number, field: ReturnType<typeof createPointerField>, plants: ReturnType<typeof plantInstances>, flowers: ReturnType<typeof plantInstances>, clouds: ReturnType<typeof makeClouds>) {
  field.strength += ((state.pointerActive ? 1 : 0) - field.strength) * (1 - Math.exp(-8 * Math.min(delta, .05)));
  if (state.pointerActive) {
    field.screen.set(state.pointer[0], state.pointer[1]);
    field.raycaster.setFromCamera(field.screen, camera);
    clouds.rayOrigin.value.copy(field.raycaster.ray.origin);
    clouds.rayDirection.value.copy(field.raycaster.ray.direction);
    plants.material.uniforms.uPointerWorld.value.fromArray(state.pointerWorld);
    flowers.material.uniforms.uPointerWorld.value.fromArray(state.pointerWorld);
  }
  clouds.strength.value = field.strength;
  plants.material.uniforms.uPointerStrength.value = field.strength;
  flowers.material.uniforms.uPointerStrength.value = field.strength;
  let nearCloud = false;
  if (state.pointerActive) {
    for (let index = 0; index < clouds.centers.length; index += 15) {
      const x = (clouds.centers[index] + state.elapsed * clouds.speeds[index / 3] + 85) % 170 - 85;
      field.center.set(x, clouds.centers[index + 1], clouds.centers[index + 2]);
      if (field.raycaster.ray.distanceSqToPoint(field.center) < 4.5 * 4.5) { nearCloud = true; break; }
    }
  }
  const nearPlant = state.pointerActive && nearPlants(state.pointerWorld, plants);
  if (nearCloud && !field.nearCloud) state.cloudInteraction++;
  if (nearPlant && !field.nearPlant) state.plantInteraction++;
  field.nearCloud = nearCloud;
  field.nearPlant = nearPlant;
}

function animateEnvironment(state: SceneRuntime, plants: ReturnType<typeof plantInstances>, flowers: ReturnType<typeof plantInstances>, clouds: ReturnType<typeof makeClouds>, bubbles: ReturnType<typeof makeBubbles>, particles: ReturnType<typeof makeParticles>) {
  plants.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  flowers.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  clouds.time.value = state.elapsed;
  bubbles.material.uniforms.uTime.value = state.elapsed;
  particles.mesh.rotation.y = Math.sin(state.elapsed * .025) * .13;
  particles.mesh.position.y = Math.sin(state.elapsed * .14) * .2;
}

export function AmbientSystem({ runtime, paused, quality }: EnvironmentProps) {
  const landscape = useMemo(() => makeLandscape(), []);
  const grove = useMemo(() => makeGrove(), []);
  const pointerField = useMemo(() => createPointerField(), []);
  const settings = world.quality[quality];
  const plants = useMemo(() => plantInstances(settings.grass, false), [settings.grass]);
  const flowers = useMemo(() => plantInstances(Math.round(settings.grass / 9), true), [settings.grass]);
  const clouds = useMemo(() => makeClouds(settings.clouds), [settings.clouds]);
  const bubbles = useMemo(() => makeBubbles(Math.max(3, Math.round(settings.bubbles / 5))), [settings.bubbles]);
  const particles = useMemo(() => makeParticles(Math.min(16, Math.ceil(settings.particles / 5))), [settings.particles]);
  useEffect(() => () => landscape.dispose(), [landscape]);
  useEffect(() => () => grove.dispose(), [grove]);
  useEffect(() => () => {
    [plants, flowers, clouds, bubbles, particles].forEach(resource => { resource.geometry.dispose(); resource.material.dispose(); });
  }, [plants, flowers, clouds, bubbles, particles]);
  useFrame(({ camera }, delta) => {
    if (paused) return;
    updatePointerField(runtime.current, camera, delta, pointerField, plants, flowers, clouds);
    animateEnvironment(runtime.current, plants, flowers, clouds, bubbles, particles);
  });
  return <group>
    {landscape.islands.map((island, index) => <mesh key={index} geometry={island.geometry} material={landscape.material} position={island.position} receiveShadow />)}
    {landscape.bridges.map((bridge, index) => <group key={index}>
      <mesh geometry={bridge.deck} material={landscape.porcelain} receiveShadow />
      {bridge.rails.map((geometry, rail) => <mesh key={rail} geometry={geometry} material={landscape.rail} />)}
    </group>)}
    <primitive object={landscape.rocks} />
    <primitive object={grove.trunks} />
    <primitive object={grove.crowns} />
    <primitive object={plants.mesh} />
    <primitive object={flowers.mesh} />
    <primitive object={clouds.mesh} />
    <primitive object={bubbles.mesh} />
    <primitive object={particles.mesh} />
  </group>;
}
