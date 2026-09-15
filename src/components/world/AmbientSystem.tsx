'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DataTexture, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, Points, PointsMaterial, Raycaster, RepeatWrapping, ShaderMaterial, SRGBColorSpace, SphereGeometry, TubeGeometry, Vector2, Vector3, type Camera } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type QualityTier, type SceneRuntime } from '../../content/world';
import { createLandscapePlan, generatePlantPositions, meadowGeometry, pathGeometry, seededRandom, terrainHeight, type LandscapePlan, type PlantPosition } from './terrain';
import { cloudPuffTransform, createCloudClusters, updateCloudResponses } from './clouds';
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
    p.x += sin(uTime + aPhase + p.y * .9) * p.y * p.y * .14;
    p.z += cos(uTime * .7 + aPhase) * p.y * .055;
    vec4 local = instanceMatrix * vec4(p, 1.);
    vec2 away = instanceMatrix[3].xz - uPointerWorld.xz;
    float proximity = 1. - smoothstep(.10, 1.8, length(away));
    float bend = uPointerStrength * proximity * position.y * position.y;
    local.xz += away / max(length(away), .15) * bend * .40;
    local.y -= bend * .045;
    vec4 mv = modelViewMatrix * local;
    vTint = aTint;
    vLight = .76 + position.y * .29;
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
    #include <colorspace_fragment>
  }
`;

function tuftGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade * 2.399;
    const cx = Math.cos(angle) * .25;
    const cz = Math.sin(angle) * .25;
    const height = .55 + (blade % 3) * .15;
    const width = .018;
    const start = positions.length / 3;
    for (const [x, y, z] of [[-width, 0, 0], [width, 0, 0], [-width * .8, height * .48, .025], [width * .8, height * .48, .025], [-width * .4, height * .83, .08], [width * .4, height * .83, .08], [.04, height, .14]]) {
      positions.push(cx + x * Math.cos(angle) - z * Math.sin(angle), y, cz + x * Math.sin(angle) + z * Math.cos(angle));
    }
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4, start + 3, start + 5, start + 4, start + 4, start + 5, start + 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function daisyGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const white = new Color('#ffffff');
  const gold = new Color('#f4c918');
  const green = new Color(world.colors.grassDark);
  function vertex(x: number, y: number, z: number, color: Color) { positions.push(x, y, z); colors.push(color.r, color.g, color.b); }
  for (let petal = 0; petal < 9; petal++) {
    const angle = petal / 9 * Math.PI * 2;
    const start = positions.length / 3;
    for (const [radius, lateral, y] of [[.035, 0, .81], [.13, -.052, .82], [.235, -.035, .87], [.26, 0, .88], [.235, .035, .87], [.13, .052, .82]]) {
      vertex(Math.cos(angle) * radius - Math.sin(angle) * lateral, y, Math.sin(angle) * radius + Math.cos(angle) * lateral, white);
    }
    for (let index = 1; index < 5; index++) indices.push(start, start + index, start + index + 1);
  }
  const center = positions.length / 3;
  vertex(0, .85, 0, gold);
  for (let segment = 0; segment <= 12; segment++) {
    const angle = segment / 12 * Math.PI * 2;
    vertex(Math.cos(angle) * .068, .825, Math.sin(angle) * .068, gold);
    if (segment < 12) indices.push(center, center + segment + 1, center + segment + 2);
  }
  const stem = positions.length / 3;
  vertex(-.016, 0, 0, green); vertex(.016, 0, 0, green); vertex(.016, .81, 0, green); vertex(-.016, .81, 0, green);
  indices.push(stem, stem + 1, stem + 2, stem, stem + 2, stem + 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePlants(plan: LandscapePlan, flowers: boolean) {
  const maximum = flowers ? 260 : world.quality.high.grass;
  const positions = generatePlantPositions(maximum, plan, flowers ? 83 : 41);
  const geometry = flowers ? daisyGeometry() : tuftGeometry();
  const material = new ShaderMaterial({ vertexShader: flowers ? plantVertex.replace('vTint = aTint;', 'vTint = aTint * color;') : plantVertex, fragmentShader: plantFragment, vertexColors: flowers, side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPointerStrength: { value: 0 }, uPointerWorld: { value: new Vector3() }, uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) } } });
  const mesh = new InstancedMesh(geometry, material, maximum);
  mesh.name = flowers ? 'environment-flowers' : 'environment-grass';
  const phases = new Float32Array(maximum);
  const colors = new Float32Array(maximum * 3);
  const transform = new Object3D();
  const tint = new Color();
  const dark = new Color(world.colors.grassDark);
  const light = new Color(world.colors.grassLight);
  const random = seededRandom(flowers ? 713 : 914);
  const occupied = new Uint16Array(80 * 80);
  for (let index = 0; index < maximum; index++) {
    const plant = positions[index];
    transform.position.set(plant.x, plant.y, plant.z);
    transform.scale.setScalar(plant.scale);
    transform.rotation.set(0, plant.rotation, 0);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    phases[index] = plant.phase;
    if (flowers) tint.set('#ffffff'); else tint.copy(dark).lerp(light, .25 + random() * .5);
    colors.set([tint.r, tint.g, tint.b], index * 3);
    const x = Math.floor((plant.x + 60) / 1.5);
    const z = Math.floor((plant.z + 60) / 1.5);
    occupied[z * 80 + x] ||= index + 1;
  }
  geometry.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('aTint', new InstancedBufferAttribute(colors, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, geometry, material, positions, occupied };
}

const cloudVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec4 point = modelMatrix * instanceMatrix * vec4(position, 1.);
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vView = cameraPosition - point.xyz;
    vDistance = length(vView);
    gl_Position = projectionMatrix * viewMatrix * point;
  }
`;
const cloudFragment = /* glsl */ `
  uniform vec3 uWhite;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDistance;
  void main() {
    vec3 n = normalize(vNormal);
    float light = smoothstep(-.85, .5, n.y);
    vec3 color = mix(vec3(.57,.76,.94), uWhite, light);
    float rim = pow(1. - max(dot(n, normalize(vView)), 0.), 3.);
    color += rim * .045;
    color = mix(color, uFog, smoothstep(uFogRange.x, uFogRange.y, vDistance));
    gl_FragColor = vec4(color, 1.);
    #include <colorspace_fragment>
  }
`;

function makeClouds(diagnostics: boolean) {
  const clusters = createCloudClusters();
  const geometry = new SphereGeometry(1, 16, 12);
  const material = new ShaderMaterial({ vertexShader: cloudVertex, fragmentShader: cloudFragment, uniforms: { uWhite: { value: new Color(world.lighting.cloudColor) }, uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) } } });
  const mesh = new InstancedMesh(geometry, material, clusters.length * 6);
  mesh.name = 'environment-clouds';
  mesh.frustumCulled = false;
  mesh.userData.clusters = clusters;
  const debugMaterial = diagnostics ? new MeshBasicMaterial({ color: '#117bff', wireframe: true, transparent: true, opacity: .36, depthWrite: false }) : null;
  const debug = debugMaterial ? new InstancedMesh(geometry, debugMaterial, clusters.length * 6) : null;
  if (debug) { debug.frustumCulled = false; debug.name = 'cloud-hit-volumes'; }
  return { clusters, mesh, geometry, material, debug, debugMaterial, transform: new Object3D(), puff: { position: new Vector3(), scale: new Vector3() } };
}

function writeCloudMatrices(clouds: ReturnType<typeof makeClouds>, elapsed: number) {
  const active = clouds.mesh.count / 6;
  for (let index = 0; index < active; index++) {
    const cluster = clouds.clusters[index];
    for (let puff = 0; puff < cluster.puffs.length; puff++) {
      cloudPuffTransform(cluster, cluster.puffs[puff], elapsed, cluster.response, clouds.puff);
      clouds.transform.position.copy(clouds.puff.position);
      clouds.transform.scale.copy(clouds.puff.scale);
      clouds.transform.updateMatrix();
      clouds.mesh.setMatrixAt(index * 6 + puff, clouds.transform.matrix);
      clouds.debug?.setMatrixAt(index * 6 + puff, clouds.transform.matrix);
    }
  }
  clouds.mesh.instanceMatrix.needsUpdate = true;
  if (clouds.debug) clouds.debug.instanceMatrix.needsUpdate = true;
}

function meadowTexture() {
  const size = 512;
  const pixels = new Uint8Array(size * size * 4);
  const random = seededRandom(1723);
  function pixel(x: number, y: number, value: number) {
    const offset = (((y % size + size) % size) * size + (x % size + size) % size) * 4;
    pixels[offset] = Math.min(255, value); pixels[offset + 1] = Math.min(255, value); pixels[offset + 2] = Math.min(255, value); pixels[offset + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixel(x, y, 176 + random() * 38);
  // Dense curved fibers give the ground the same fine scale as the foreground blades.
  for (let blade = 0; blade < 24000; blade++) {
    const x = Math.floor(random() * size); const y = Math.floor(random() * size);
    const length = 3 + Math.floor(random() * 9); const lean = (random() - .5) * 5;
    const shade = 145 + random() * 108;
    for (let step = 0; step < length; step++) pixel(x + Math.round(lean * (step / length) ** 2), y + step, shade + step / length * 8);
  }
  const texture = new DataTexture(pixels, size, size);
  // Pixel values describe display-referred fiber colors; Three decodes them before lighting.
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function foliageGeometry() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const random = seededRandom(1782);
  const leaf = new Object3D();
  const point = new Vector3();
  // Individual curved leaves make an open crown with a fine, irregular edge.
  for (let index = 0; index < 96; index++) {
    const azimuth = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const radius = .78 * Math.cbrt(random());
    const radial = Math.sqrt(1 - y * y) * radius;
    leaf.position.set(Math.cos(azimuth) * radial, y * radius, Math.sin(azimuth) * radial);
    leaf.rotation.set((random() - .5) * Math.PI, random() * Math.PI * 2, (random() - .5) * .7);
    leaf.updateMatrix();
    const length = .34 + random() * .20;
    const width = .12 + random() * .07;
    const shade = .66 + random() * .34;
    const start = positions.length / 3;
    const outline = [[0, 0, -.5], [-1, .03, -.16], [-.7, .065, .28], [0, .025, .5], [.7, .065, .28], [1, .03, -.16], [0, .10, 0]];
    for (const [x, height, z] of outline) {
      point.set(x * width, height, z * length).applyMatrix4(leaf.matrix);
      positions.push(point.x, point.y, point.z);
      colors.push(shade * .92, shade, shade * .88);
    }
    for (let edge = 0; edge < 6; edge++) indices.push(start + 6, start + edge, start + (edge + 1) % 6);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function treeGeometry() {
  const paths = [
    [[0, 0, 0], [.03, .3, 0], [-.025, .57, .015], [.02, .9, 0]],
    [[0, .36, 0], [-.08, .51, .025], [-.21, .64, .04]],
    [[0, .48, 0], [.09, .59, -.03], [.22, .73, -.10]],
  ];
  const tubes = paths.map((points, index) => new TubeGeometry(new CatmullRomCurve3(points.map(point => new Vector3(...point))), 8, index ? .012 : .026, 7, false));
  const geometry = mergeGeometries(tubes)!;
  tubes.forEach(tube => tube.dispose());
  return geometry;
}

function makeSkyline() {
  const geometry = new CylinderGeometry(1, 1, 1, 20);
  const frameGeometry = new BoxGeometry(1, 1, 1);
  const material = new MeshPhysicalMaterial({ color: '#62bacd', metalness: .42, roughness: .17, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.2 });
  const frameMaterial = new MeshPhysicalMaterial({ color: '#deeff7', metalness: .25, roughness: .25, clearcoat: .7 });
  const towers = new InstancedMesh(geometry, material, 16);
  const frames = new InstancedMesh(frameGeometry, frameMaterial, 16 * 4);
  towers.name = 'distant-glass-skyline';
  const transform = new Object3D();
  const random = seededRandom(992);
  for (let index = 0; index < 16; index++) {
    const x = -31 + index * 2;
    const z = -91 + random() * 6;
    const radius = .55 + random() * .38;
    const height = 3.2 + Math.sin(index / 15 * Math.PI) * 5 + random() * 2.3;
    const y = terrainHeight(x, z) + height / 2;
    transform.position.set(x, y, z); transform.scale.set(radius, height, radius * .8); transform.rotation.set(0, 0, 0); transform.updateMatrix(); towers.setMatrixAt(index, transform.matrix);
    for (let fin = 0; fin < 4; fin++) {
      const angle = fin * Math.PI / 2;
      transform.position.set(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius * .8);
      transform.scale.set(.045, height + .06, .045); transform.updateMatrix(); frames.setMatrixAt(index * 4 + fin, transform.matrix);
    }
  }
  towers.computeBoundingSphere(); frames.computeBoundingSphere();
  return { towers, frames, dispose() { towers.dispose(); frames.dispose(); geometry.dispose(); frameGeometry.dispose(); material.dispose(); frameMaterial.dispose(); } };
}

function makeLandscape(plan: LandscapePlan) {
  const ground = meadowGeometry();
  const path = pathGeometry(plan.paths);
  const texture = meadowTexture();
  const material = new MeshPhysicalMaterial({ color: '#d0edab', specularIntensity: 0, vertexColors: true, map: texture, bumpMap: texture, bumpScale: .012, roughness: .96, clearcoat: 0, envMapIntensity: .08 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 meadowPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n meadowPosition = position.xz;');
    shader.fragmentShader = `varying vec2 meadowPosition;
      float meadowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float meadowNoise(vec2 p) {
        vec2 cell = floor(p); vec2 f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(meadowHash(cell), meadowHash(cell + vec2(1.,0.)), f.x), mix(meadowHash(cell + vec2(0.,1.)), meadowHash(cell + 1.), f.x), f.y);
      }
      ${shader.fragmentShader}`.replace('#include <color_fragment>', '#include <color_fragment>\n float meadowTone = meadowNoise(meadowPosition * .68) * .20 + meadowNoise(meadowPosition * 2.7) * .10; diffuseColor.rgb *= .73 + meadowTone;');
  };
  material.customProgramCacheKey = () => 'layered-meadow-color';
  const pathMaterial = new MeshPhysicalMaterial({ color: '#e9fff1', roughness: .34, clearcoat: .65, clearcoatRoughness: .3 });
  const rockGeometry = new SphereGeometry(1, 16, 12);
  const rockMaterial = new MeshPhysicalMaterial({ color: '#effff2', roughness: .35, clearcoat: .75, clearcoatRoughness: .22 });
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, plan.rocks.length);
  rocks.name = 'shoreline-rocks';
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const transform = new Object3D();
  plan.rocks.forEach((rock, index) => { transform.position.set(rock.x, rock.y, rock.z); transform.scale.fromArray(rock.scale); transform.rotation.set(0, rock.rotation, .08); transform.updateMatrix(); rocks.setMatrixAt(index, transform.matrix); });
  rocks.computeBoundingSphere();
  const trunkGeometry = treeGeometry();
  const crownGeometry = foliageGeometry();
  const trunkMaterial = new MeshPhysicalMaterial({ color: '#627848', roughness: .94, envMapIntensity: .12 });
  const crownMaterial = new MeshPhysicalMaterial({ color: '#327d27', vertexColors: true, side: DoubleSide, roughness: .73, clearcoat: .08, clearcoatRoughness: .4, envMapIntensity: .15 });
  const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, plan.trees.length);
  const crowns = new InstancedMesh(crownGeometry, crownMaterial, plan.trees.length * 9);
  trunks.name = 'grove-trunks';
  crowns.name = 'grove-foliage';
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  const leaf = new Object3D();
  const tree = new Object3D();
  const random = seededRandom(643);
  const tint = new Color();
  plan.trees.forEach((item, index) => {
    tree.position.set(item.x, item.y, item.z); tree.scale.setScalar(item.height); tree.rotation.set(0, item.rotation, 0); tree.updateMatrix(); trunks.setMatrixAt(index, tree.matrix);
    for (let cluster = 0; cluster < 9; cluster++) {
      const angle = cluster * 2.399;
      const spread = cluster < 6 ? .19 : .10;
      const size = .13 + random() * .035;
      leaf.position.set(Math.cos(angle) * spread, .58 + cluster / 9 * .31 + (random() - .5) * .08, Math.sin(angle) * spread);
      leaf.scale.set(size * (1.05 + random() * .3), size * (1 + random() * .5), size);
      leaf.rotation.set(random() * .3, angle, (random() - .5) * .4);
      leaf.updateMatrix(); transform.matrix.multiplyMatrices(tree.matrix, leaf.matrix); crowns.setMatrixAt(index * 9 + cluster, transform.matrix);
      tint.setRGB(.78 + random() * .22, .88 + random() * .12, .68 + random() * .22); crowns.setColorAt(index * 9 + cluster, tint);
    }
  });
  trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
  const skyline = makeSkyline();
  return { ground, path, material, pathMaterial, rocks, trunks, crowns, skyline, dispose() {
    [ground, path, rockGeometry, trunkGeometry, crownGeometry].forEach(geometry => geometry.dispose());
    [material, pathMaterial, rockMaterial, trunkMaterial, crownMaterial].forEach(value => value.dispose());
    texture.dispose(); skyline.dispose(); rocks.dispose(); trunks.dispose(); crowns.dispose();
  } };
}

function makeMotes() {
  const geometry = new SphereGeometry(1, 12, 8);
  const material = new MeshPhysicalMaterial({ color: '#efffff', transparent: true, opacity: .17, depthWrite: false, roughness: .08, clearcoat: 1 });
  const mesh = new InstancedMesh(geometry, material, world.quality.high.bubbles);
  mesh.name = 'environment-distant-motes';
  const transform = new Object3D();
  const random = seededRandom(84);
  for (let index = 0; index < mesh.count; index++) { transform.position.set((random() - .5) * 70, 13 + random() * 10, -45 - random() * 50); transform.scale.setScalar(.10 + random() * .08); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix); }
  mesh.computeBoundingSphere();
  const pointsGeometry = new BufferGeometry();
  const pointsPosition = new Float32Array(16 * 3);
  for (let index = 0; index < 16; index++) pointsPosition.set([(random() - .5) * 40, 3 + random() * 13, -30 - random() * 30], index * 3);
  pointsGeometry.setAttribute('position', new Float32BufferAttribute(pointsPosition, 3));
  const pointsMaterial = new PointsMaterial({ color: world.lighting.sunColor, size: .04, transparent: true, opacity: .25, depthWrite: false });
  const points = new Points(pointsGeometry, pointsMaterial);
  return { mesh, geometry, material, points, pointsGeometry, pointsMaterial };
}

function makeEnvironment() {
  const plan = createLandscapePlan();
  const landscape = makeLandscape(plan);
  const grass = makePlants(plan, false);
  const flowers = makePlants(plan, true);
  const diagnostics = process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cloud-volumes');
  const clouds = makeClouds(diagnostics);
  writeCloudMatrices(clouds, 0);
  const motes = makeMotes();
  return { plan, landscape, grass, flowers, clouds, motes, elapsed: 0, disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    pointer: { raycaster: new Raycaster(), screen: new Vector2(), strength: 0, nearPlant: false },
    dispose() {
      landscape.dispose();
      [grass, flowers, clouds, motes].forEach(resource => { resource.geometry.dispose(); resource.material.dispose(); resource.mesh.dispose(); });
      clouds.debug?.dispose(); clouds.debugMaterial?.dispose(); motes.pointsGeometry.dispose(); motes.pointsMaterial.dispose();
    } };
}

function retainEnvironment(environment: ReturnType<typeof makeEnvironment>) {
  clearTimeout(environment.disposeTimer);
  // Strict Mode can replay an effect while retaining its mounted scene objects.
  return () => { environment.disposeTimer = setTimeout(() => environment.dispose(), 0); };
}

function setQuality(environment: ReturnType<typeof makeEnvironment>, quality: QualityTier) {
  const tier = world.quality[quality];
  environment.grass.mesh.count = tier.grass;
  environment.flowers.mesh.count = Math.round(260 * tier.grass / world.quality.high.grass);
  environment.clouds.mesh.count = tier.clouds * 6;
  if (environment.clouds.debug) environment.clouds.debug.count = tier.clouds * 6;
  writeCloudMatrices(environment.clouds, environment.elapsed);
  environment.motes.mesh.count = tier.bubbles;
  environment.motes.pointsGeometry.setDrawRange(0, Math.min(16, Math.ceil(tier.particles / 5)));
}

function nearPlants(point: SceneRuntime['pointerWorld'], positions: readonly PlantPosition[], occupied: Uint16Array, count: number) {
  const cellX = Math.floor((point[0] + 60) / 1.5);
  const cellZ = Math.floor((point[2] + 60) / 1.5);
  for (let z = Math.max(0, cellZ - 2); z <= Math.min(79, cellZ + 2); z++) for (let x = Math.max(0, cellX - 2); x <= Math.min(79, cellX + 2); x++) {
    const index = occupied[z * 80 + x] - 1;
    if (index >= 0 && index < count && Math.hypot(positions[index].x - point[0], positions[index].z - point[2]) < 1.8) return true;
  }
  return false;
}

function updatePlantUniforms(plants: ReturnType<typeof makePlants>, state: SceneRuntime, strength: number) {
  plants.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  plants.material.uniforms.uPointerStrength.value = strength;
  if (state.pointerActive) plants.material.uniforms.uPointerWorld.value.fromArray(state.pointerWorld);
}

function animateEnvironment(environment: ReturnType<typeof makeEnvironment>, state: SceneRuntime, camera: Camera, delta: number) {
  const { grass, flowers, clouds, motes, pointer } = environment;
  environment.elapsed = state.elapsed;
  pointer.strength += ((state.pointerActive ? 1 : 0) - pointer.strength) * (1 - Math.exp(-8 * Math.min(.05, delta)));
  if (state.pointerActive) { pointer.screen.set(...state.pointer); pointer.raycaster.setFromCamera(pointer.screen, camera); }
  updatePlantUniforms(grass, state, pointer.strength);
  updatePlantUniforms(flowers, state, pointer.strength);
  const nearPlant = state.pointerActive && nearPlants(state.pointerWorld, grass.positions, grass.occupied, grass.mesh.count);
  if (nearPlant && !pointer.nearPlant) state.plantInteraction++;
  pointer.nearPlant = nearPlant;
  state.cloudInteraction += updateCloudResponses(clouds.clusters, state.pointerActive ? pointer.raycaster.ray : null, state.elapsed, delta, clouds.mesh.count / 6, false);
  writeCloudMatrices(clouds, state.elapsed);
  motes.points.rotation.y = Math.sin(state.elapsed * .025) * .08;
  motes.points.position.y = Math.sin(state.elapsed * .15) * .12;
}

export function AmbientSystem({ runtime, paused, quality }: EnvironmentProps) {
  const environment = useMemo(() => makeEnvironment(), []);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => retainEnvironment(environment), [environment]);
  useEffect(() => { setQuality(environment, quality); invalidate(); }, [environment, quality, invalidate]);
  useFrame(({ camera }, delta) => { if (!paused) animateEnvironment(environment, runtime.current, camera, delta); });
  const { landscape, grass, flowers, clouds, motes } = environment;
  return <group dispose={null} name="continuous-environment">
    <mesh geometry={landscape.ground} material={landscape.material} receiveShadow name="continuous-meadow" />
    <mesh geometry={landscape.path} material={landscape.pathMaterial} receiveShadow name="meadow-paths" />
    <primitive object={landscape.skyline.towers} /><primitive object={landscape.skyline.frames} />
    <primitive object={landscape.rocks} /><primitive object={landscape.trunks} /><primitive object={landscape.crowns} />
    <primitive object={grass.mesh} /><primitive object={flowers.mesh} /><primitive object={clouds.mesh} />
    {clouds.debug && <primitive object={clouds.debug} />}
    <primitive object={motes.mesh} /><primitive object={motes.points} />
  </group>;
}
