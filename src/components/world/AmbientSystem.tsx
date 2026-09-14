'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute,
  InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial, MeshStandardMaterial,
  Object3D, Points, PointsMaterial, ShaderMaterial, SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { islandGeometry, seededRandom, shoreRadius, terrainHeight, type Island } from './terrain';
import type { EnvironmentProps } from './Water';

const plantVertex = /* glsl */ `
  uniform float uTime;
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
    vec4 mv = modelViewMatrix * local;
    vTint = aTint;
    vLight = .77 + position.y * .23;
    vDistance = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const plantFragment = /* glsl */ `
  uniform vec3 uFog;
  varying vec3 vTint;
  varying float vLight;
  varying float vDistance;
  void main() {
    vec3 color = vTint * vLight;
    color = mix(color, uFog, smoothstep(38., 105., vDistance));
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
    uniforms: { uTime: { value: 0 }, uFog: { value: new Color(world.colors.horizon) } },
  });
  const mesh = new InstancedMesh(geometry, material, count);
  const transform = new Object3D();
  const tint = new Color();
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
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
      island.center[1] + terrainHeight(radius, island.height) - .015,
      island.center[2] + Math.sin(angle) * r * island.radius[1],
    );
    const size = .24 + random() * (islandIndex > 2 ? 1.2 : .50);
    transform.scale.set(.7 + random() * .9, size, 1);
    transform.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .15);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
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
  return { mesh, geometry, material };
}

function makeClouds(count: number) {
  const random = seededRandom(19);
  const geometry = new SphereGeometry(1, 12, 8);
  const material = new MeshLambertMaterial({ color: '#ffffff', emissive: '#d7f1ff', emissiveIntensity: .3 });
  const time = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime; attribute float aSpeed;\n${shader.vertexShader}`.replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.);
      mvPosition.x = mod(mvPosition.x + uTime * aSpeed + 85., 170.) - 85.;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  material.customProgramCacheKey = () => 'habitat-cloud-drift';
  const mesh = new InstancedMesh(geometry, material, count * 5);
  const transform = new Object3D();
  const speeds = new Float32Array(count * 5);
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
    }
  }
  geometry.setAttribute('aSpeed', new InstancedBufferAttribute(speeds, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, geometry, material, time };
}

const bubbleVertex = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  attribute float aPhase;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec4 p = instanceMatrix * vec4(position, 1.);
    p.y += sin(uTime * .34 + aPhase) * .45;
    p.x += sin(uTime * .17 + aPhase) * .32;
    vec2 field = p.xy - vec2(uPointer.x * 16., 5. + uPointer.y * 6.);
    float influence = exp(-dot(field, field) * .10);
    p.xy += normalize(field + vec2(.001)) * influence * 1.2;
    vec4 wp = modelMatrix * p;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vView = cameraPosition - wp.xyz;
    vDistance = length(vView);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const bubbleFragment = /* glsl */ `
  uniform vec3 uFog;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec3 n = normalize(vNormal);
    float rim = pow(1. - abs(dot(n, normalize(vView))), 2.3);
    float highlight = pow(max(dot(n, normalize(vec3(-.5, .8, .5))), 0.), 38.);
    vec3 color = mix(vec3(.48,.91,.99), vec3(.98,1.,.91), rim * .8 + highlight * .4);
    color = mix(color, uFog, smoothstep(38., 105., vDistance));
    gl_FragColor = vec4(color, .055 + rim * .50 + highlight * .55);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeBubbles(count: number) {
  const random = seededRandom(44);
  const geometry = new SphereGeometry(1, 16, 10);
  const material = new ShaderMaterial({
    vertexShader: bubbleVertex, fragmentShader: bubbleFragment, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPointer: { value: [0, 0] }, uFog: { value: new Color(world.colors.horizon) } },
  });
  const mesh = new InstancedMesh(geometry, material, count);
  const phases = new Float32Array(count);
  const transform = new Object3D();
  for (let index = 0; index < count; index++) {
    transform.position.set((random() - .5) * 38, 1.8 + random() * 8, -16 + random() * 35);
    transform.scale.setScalar(.15 + random() * .55);
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
  for (let index = 0; index < count; index++) positions.set([(random() - .5) * 32, 1 + random() * 9, (random() - .5) * 32], index * 3);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: '#ffffcf', size: .055, transparent: true, opacity: .5, depthWrite: false, sizeAttenuation: true });
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

function makeLandscape() {
  const geometries: BufferGeometry[] = [];
  const islands = world.islands.map((island, index) => {
    const geometry = islandGeometry(island, index);
    geometries.push(geometry);
    return { geometry, position: island.center };
  });
  const farIslands: Island[] = [
    { center: [-26, -.6, -43], radius: [9, 4], height: 1.1 },
    { center: [20, -.7, -49], radius: [12, 4.5], height: 1.6 },
    { center: [-12, -.6, -60], radius: [7, 3], height: 1.0 },
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
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, 32);
  const random = seededRandom(27);
  const transform = new Object3D();
  for (let index = 0; index < 32; index++) {
    const islandIndex = index % world.islands.length;
    const island = world.islands[islandIndex];
    const angle = random() * Math.PI * 2;
    const radius = .85 + random() * .08;
    const r = radius * shoreRadius(angle, islandIndex);
    transform.position.set(island.center[0] + Math.cos(angle) * r * island.radius[0], island.center[1] + terrainHeight(radius, island.height) + .015, island.center[2] + Math.sin(angle) * r * island.radius[1]);
    const size = .13 + random() * .22;
    transform.scale.set(size * 1.8, size * .72, size);
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

function animateEnvironment(state: SceneRuntime, plants: ReturnType<typeof plantInstances>, flowers: ReturnType<typeof plantInstances>, clouds: ReturnType<typeof makeClouds>, bubbles: ReturnType<typeof makeBubbles>, particles: ReturnType<typeof makeParticles>) {
  plants.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  flowers.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  clouds.time.value = state.elapsed;
  bubbles.material.uniforms.uTime.value = state.elapsed;
  bubbles.material.uniforms.uPointer.value = state.pointer;
  particles.mesh.rotation.y = Math.sin(state.elapsed * .025) * .13;
  particles.mesh.position.y = Math.sin(state.elapsed * .14) * .2;
  particles.material.opacity = state.hovered ? .70 : .45;
}

export function AmbientSystem({ runtime, paused, quality }: EnvironmentProps) {
  const landscape = useMemo(() => makeLandscape(), []);
  const settings = world.quality[quality];
  const plants = useMemo(() => plantInstances(settings.grass, false), [settings.grass]);
  const flowers = useMemo(() => plantInstances(Math.round(settings.grass / 9), true), [settings.grass]);
  const clouds = useMemo(() => makeClouds(settings.clouds), [settings.clouds]);
  const bubbles = useMemo(() => makeBubbles(settings.bubbles), [settings.bubbles]);
  const particles = useMemo(() => makeParticles(settings.particles), [settings.particles]);
  useEffect(() => () => landscape.dispose(), [landscape]);
  useEffect(() => () => {
    [plants, flowers, clouds, bubbles, particles].forEach(resource => { resource.geometry.dispose(); resource.material.dispose(); });
  }, [plants, flowers, clouds, bubbles, particles]);
  useFrame(() => {
    if (paused) return;
    animateEnvironment(runtime.current, plants, flowers, clouds, bubbles, particles);
  });
  return <group>
    {landscape.islands.map((island, index) => <mesh key={index} geometry={island.geometry} material={landscape.material} position={island.position} receiveShadow />)}
    {landscape.bridges.map((bridge, index) => <group key={index}>
      <mesh geometry={bridge.deck} material={landscape.porcelain} receiveShadow />
      {bridge.rails.map((geometry, rail) => <mesh key={rail} geometry={geometry} material={landscape.rail} />)}
    </group>)}
    <primitive object={landscape.rocks} />
    <primitive object={plants.mesh} />
    <primitive object={flowers.mesh} />
    <primitive object={clouds.mesh} />
    <primitive object={bubbles.mesh} />
    <primitive object={particles.mesh} />
  </group>;
}
