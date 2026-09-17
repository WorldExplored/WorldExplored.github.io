'use client';

// Frame callbacks update retained Three.js resources outside React rendering.
/* eslint-disable react-hooks/immutability */

import { surfaceTexture } from './surfaceMaterials';
import { measureConstruction } from './renderDiagnostics';
import { rockImpactPosition } from './ShoreImpacts';
import { coastalSoundScene } from './coastalAudio';
import { barkTexture, leafVeinTexture, treeFoliageGeometry, treeBranches, treeWoodGeometry } from './TreeGeometry';

import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Group, Color, DataTexture, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, Object3D, Points, PointsMaterial, Raycaster, RepeatWrapping, ShaderMaterial, SRGBColorSpace, SphereGeometry, Vector2, Vector3 } from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { createLandscapePlan, generatePlantPositions, generatePlantPositionsAsync, archipelagoGeometry, seededRandom, vegetationSuitability, landDistance, terrainMeshHeight, terrainSlope, type LandscapePlan, type PlantPosition } from './terrain';
import { createTownLandscape } from './TownLandscape';
import { createShoreDetails } from './ShoreDetails';
import { createCoastalRocks } from './coastalRocks';
import { updateCloudResponses } from './clouds';
import { shorelineWaveGLSL } from './waves';
import { makeClouds, writeCloudMatrices } from './CloudSurface';
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
    vLight = .64 + min(position.y,1.) * .5;
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
    const height = .25 + (blade % 3) * .10;
    const width = .024;
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

function makePlants(plan: LandscapePlan, flowers: boolean, prepared?: PlantPosition[]) {
  const maximum = flowers ? 260 : world.quality.high.grass;
  const positions = prepared ?? generatePlantPositions(maximum, plan, flowers ? 83 : 41);
  const geometry = flowers ? daisyGeometry() : tuftGeometry();
  const material = new ShaderMaterial({ vertexShader: flowers ? plantVertex.replace('vTint = aTint;', 'vTint = aTint * color;') : plantVertex, fragmentShader: plantFragment, vertexColors: flowers, side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPointerStrength: { value: 0 }, uPointerWorld: { value: new Vector3() }, uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) } } });
  const mesh = new InstancedMesh(geometry, material, maximum);
  mesh.name = flowers ? 'environment-flowers' : 'environment-grass';
  const phases = new Float32Array(maximum);
  const colors = new Float32Array(maximum * 3);
  const transform = new Object3D();
  const tint = new Color();
  const dark = new Color('#286a35');
  const light = new Color('#70a847');
  const random = seededRandom(flowers ? 713 : 914);
  const occupied = new Uint16Array(160 * 160);
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
    const x = Math.floor((plant.x + 120) / 1.5);
    const z = Math.floor((plant.z + 120) / 1.5);
    occupied[z * 160 + x] ||= index + 1;
  }
  geometry.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('aTint', new InstancedBufferAttribute(colors, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, geometry, material, positions, occupied };
}

function mineralTexture() {
  const size = 512;
  const pixels = new Uint8Array(size * size * 4);
  const random = seededRandom(1723);
  function pixel(x: number, y: number, value: number) {
    const offset = (((y % size + size) % size) * size + (x % size + size) % size) * 4;
    pixels[offset] = Math.min(255, value); pixels[offset + 1] = Math.min(255, value); pixels[offset + 2] = Math.min(255, value); pixels[offset + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixel(x, y, 176 + random() * 38);
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

function makeLandscape(plan: LandscapePlan) {
  const ground = archipelagoGeometry();
  const diagnostics = process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('vegetation');
  if (diagnostics) {
    const positions = ground.getAttribute('position'); const colors = ground.getAttribute('color'); const tint = new Color();
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index); const z = positions.getZ(index); const suitable = vegetationSuitability(x, z, .95, plan);
      tint.set(landDistance(x, z) < 1.1 ? '#199ed4' : suitable <= 0 ? '#ec7354' : suitable < .95 ? '#ffdb52' : '#38ff62'); colors.setXYZ(index,tint.r,tint.g,tint.b);
    }
  }
  const texture = mineralTexture();
  const material = new MeshPhysicalMaterial({ color: '#ffffff', specularIntensity: .32, vertexColors: true, map: texture, roughness: .94, clearcoat: 0, envMapIntensity: .2 });
  const shoreTime = { value: 0 };
  const sandColor = surfaceTexture('sand', 'color') ?? texture;
  const forestColor = surfaceTexture('forest', 'color') ?? texture;
  const groundNormal = surfaceTexture('sand', 'normal') ?? texture;
  material.normalMap = groundNormal; material.normalScale.set(.14, .14);
  material.roughnessMap = surfaceTexture('sand', 'arm');
  material.aoMap = material.roughnessMap; material.aoMapIntensity = .3;
  material.onBeforeCompile = shader => {
    shader.uniforms.uShoreTime = shoreTime;
    shader.uniforms.uSandColor = { value: sandColor };
    shader.uniforms.uForestColor = { value: forestColor };
    if (diagnostics) return;
    shader.vertexShader = `attribute vec3 aTerrain; attribute vec3 aEcology; attribute float aPaving; varying vec3 ecology; varying float paving; attribute float aExposure; varying float shoreExposure; varying vec3 vTerrain; varying vec2 groundXZ;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTerrain = aTerrain; ecology=aEcology; paving=aPaving; shoreExposure = aExposure; groundXZ = position.xz;');
    shader.fragmentShader = `uniform sampler2D uSandColor; uniform sampler2D uForestColor; uniform float uShoreTime; varying vec3 ecology; varying float paving; varying float shoreExposure; varying vec3 vTerrain; varying vec2 groundXZ;
      ${shorelineWaveGLSL}
      float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float groundNoise(vec2 p) { vec2 c=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(groundHash(c),groundHash(c+vec2(1.,0.)),f.x),mix(groundHash(c+vec2(0.,1.)),groundHash(c+1.),f.x),f.y); }
      ${shader.fragmentShader}`.replace('#include <map_fragment>', `
      float coast = vTerrain.x;
      float elevation = vTerrain.y;
      float slope = vTerrain.z;
      float grain = groundNoise(groundXZ*39.);
      float broad = groundNoise(groundXZ*.62);
      float grass = ecology.x * (1.-smoothstep(.48,.86,slope));
      float pathAA=max(fwidth(paving)*1.6,.018);
      float pathMask=1.-smoothstep(-pathAA,pathAA*2.2,paving);
      float wet = 1.-smoothstep(.09,.40,elevation);
      float depth = max(0.,-elevation);
      float stone = smoothstep(.65,1.3,slope) * smoothstep(.5,1.2,elevation);
      vec3 sandScan = texture2D(uSandColor,groundXZ*.27).rgb;
      vec3 forestScan = texture2D(uForestColor,mat2(.8,-.6,.6,.8)*groundXZ*.22).rgb;
      float sandRelief = dot(sandScan,vec3(.333));
      vec3 drySand = mix(vec3(.52,.39,.21),vec3(.74,.62,.38),sandRelief) * (.94 + grain*.10);
      vec3 wetSand = vec3(.19,.19,.14) * (.96 + grain*.05);
      vec3 sand = mix(drySand,wetSand,wet*.9);
      float ripple = sin(groundXZ.x*13. + groundXZ.y*7. + sin(groundXZ.y*2.3)*2.7)*.0025;
      sand += ripple*(1.-grass);
      vec3 seabed = mix(vec3(.55,.74,.60),vec3(.16,.43,.38),smoothstep(.4,3.5,depth));
      sand = mix(sand,seabed,smoothstep(0.,.6,depth));
      float wash = shoreWave(coast,groundXZ,uShoreTime,shoreExposure).y;
      sand = mix(sand,vec3(.73,.84,.80),wash*.22);
      vec3 soil = mix(vec3(.22,.16,.095),vec3(.33,.25,.14),broad);
      vec3 groundcover=mix(vec3(.018,.115,.035),vec3(.07,.29,.065),broad) * (.7+dot(forestScan,vec3(.333))*1.2);
      vec3 inland=mix(soil,groundcover,grass);
      vec3 townGravel=mix(vec3(.055,.12,.068),vec3(.15,.22,.095),broad)*(.91+grain*.12);
      inland=mix(inland,mix(townGravel,groundcover,grass),ecology.z);
      vec3 surface=mix(sand,inland,ecology.y);
      surface=mix(surface,vec3(.23,.26,.22)*(.9+broad*.2),stone);
      vec3 pavingColor=mix(vec3(.43,.48,.43),vec3(.37,.50,.49),ecology.z);
      // Mineral aggregate has no world-aligned road grid. Joints belong to built decks only.
      pavingColor*=.92+grain*.12+sandRelief*.12;
      surface=mix(surface,pavingColor,pathMask);
      diffuseColor.rgb *= surface;
      `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(.94,.32,wet*(1.-grass)*(1.-smoothstep(.2,1.,depth)));');
  };
  material.customProgramCacheKey = () => 'coastal-pbr-promenade-v4';
  const rockResources=createCoastalRocks(plan.rocks),rocks=rockResources.root;
  const shoreDetails=createShoreDetails(plan),townLandscape=createTownLandscape(plan);
  const transform=new Object3D();
  const shellGeometry = new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const shellVertices = shellGeometry.getAttribute('position');
  for (let i = 0; i < shellVertices.count; i++) {
    const x = shellVertices.getX(i), z = shellVertices.getZ(i);
    shellVertices.setY(i, shellVertices.getY(i) * (.24 + .025 * Math.cos(Math.atan2(z,x)*12)));
  }
  shellGeometry.computeVertexNormals();
  const shellMaterial = new MeshPhysicalMaterial({ color: '#ede0c3', roughness: .68 });
  const shells = new InstancedMesh(shellGeometry, shellMaterial, 36);
  shells.name = 'scattered-beach-shells'; shells.raycast = () => {};
  const shellRandom = seededRandom(8874); let shellCount = 0;
  for (let attempt = 0; attempt < 5000 && shellCount < 36; attempt++) {
    const x = -28 + shellRandom()*64, z = -27 + shellRandom()*63, distance = landDistance(x,z);
    if (distance < .45 || distance > 1.35 || terrainSlope(x,z) > .5) continue;
    if ([...plan.structures,...plan.rocks].some(item => Math.hypot(x-item.x,z-item.z) < item.radius+.4)) continue;
    const size = .055+shellRandom()*.045;
    transform.position.set(x,terrainMeshHeight(x,z)+.012,z); transform.rotation.set(0,shellRandom()*Math.PI*2,0); transform.scale.set(size,size,size*.8); transform.updateMatrix(); shells.setMatrixAt(shellCount++,transform.matrix);
  }
  shells.count = shellCount; shells.computeBoundingSphere();
  const trunkGeometries = [0, 1, 2].map(treeWoodGeometry);
  const bark = barkTexture();
  const crownGeometry = treeFoliageGeometry();
  const leafVeins = leafVeinTexture();
  const trunkMaterial = new MeshPhysicalMaterial({ color: '#8c7055', vertexColors: true, bumpMap: bark, bumpScale: .028, roughness: .93, envMapIntensity: .13 });
  const crownMaterial = new MeshPhysicalMaterial({ color: '#438d36', bumpMap: leafVeins, bumpScale: .007, roughnessMap: leafVeins, vertexColors: true, side: DoubleSide, roughness: .73, clearcoat: .08, clearcoatRoughness: .4, envMapIntensity: .15 });
  const canopyWind = { time: { value: 0 }, strength: { value: 1 }, pointer: { value: new Vector3(10000,0,10000) }, pointerStrength: { value: 0 } };
  crownMaterial.userData.canopyWind = canopyWind;
  crownMaterial.onBeforeCompile = shader => {
    shader.uniforms.uCanopyTime = canopyWind.time;
    shader.uniforms.uCanopyStrength = canopyWind.strength;
    shader.uniforms.uCanopyPointer = canopyWind.pointer;
    shader.uniforms.uCanopyPointerStrength = canopyWind.pointerStrength;
    shader.vertexShader = `uniform float uCanopyTime; uniform float uCanopyStrength; uniform vec3 uCanopyPointer; uniform float uCanopyPointerStrength;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      float canopyPhase = instanceMatrix[3].x * .21 + instanceMatrix[3].z * .13;
      float canopyWeight = smoothstep(-.7, .9, position.y) * uCanopyStrength;
      transformed.x += sin(uCanopyTime * .3 + canopyPhase) * canopyWeight * .035;
      transformed.z += sin(uCanopyTime * .47 + canopyPhase * 1.7) * canopyWeight * .025;
      vec2 canopyAway=instanceMatrix[3].xz-uCanopyPointer.xz;
      float canopyNear=(1.-smoothstep(.3,3.4,length(canopyAway)))*uCanopyPointerStrength*smoothstep(-.7,.9,position.y);
      transformed.xz += canopyAway/max(length(canopyAway),.2)*canopyNear*.32;`);
  };
  crownMaterial.customProgramCacheKey = () => 'grove-canopy-wind';
  const trunks = new Group();
  const woodMeshes = trunkGeometries.map((geometry, form) => {
    const mesh = new InstancedMesh(geometry, trunkMaterial, plan.trees.length);
    mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `tree-wood-${form}`; mesh.userData.treeIndices = []; trunks.add(mesh); return mesh;
  });
  const crowns = new InstancedMesh(crownGeometry, crownMaterial, plan.trees.length * 9);
  trunks.name = 'grove-trunks';
  crowns.name = 'grove-foliage';

  crowns.castShadow = true;
  crowns.receiveShadow = true;
  const leaf = new Object3D();
  const tree = new Object3D();
  const random = seededRandom(643);
  const tint = new Color();
  plan.trees.forEach((item, index) => {
    tree.position.set(item.x, item.y, item.z); tree.scale.setScalar(item.height); tree.rotation.set(0, item.rotation, 0); tree.updateMatrix(); const wood = woodMeshes[index % 3]; wood.userData.treeIndices.push(index); wood.setMatrixAt(wood.count++, tree.matrix);
    for (let cluster = 0; cluster < 9; cluster++) {
      const limb = treeBranches(index % 3)[cluster];
      const angle = limb.angle;
      const size = limb.size + random() * .025;
      leaf.position.copy(limb.tip);
      leaf.scale.set(size * (1.05 + random() * .3), size * (1 + random() * .5), size);
      leaf.rotation.set(random() * .3, angle, (random() - .5) * .4);
      leaf.updateMatrix(); transform.matrix.multiplyMatrices(tree.matrix, leaf.matrix); crowns.setMatrixAt(index * 9 + cluster, transform.matrix);
      tint.setRGB(.78 + random() * .22, .88 + random() * .12, .68 + random() * .22); crowns.setColorAt(index * 9 + cluster, tint);
    }
  });
  woodMeshes.forEach(mesh => mesh.computeBoundingSphere()); crowns.computeBoundingSphere();
  return { ground, material, rocks, trunks, crowns, shells, shoreDetails, townLandscape, canopyWind, shoreTime, plan, dispose() {
    [ground, ...trunkGeometries, crownGeometry, shellGeometry].forEach(geometry => geometry.dispose());
    [material, trunkMaterial, crownMaterial, shellMaterial].forEach(value => value.dispose());
    bark.dispose(); leafVeins.dispose(); texture.dispose(); shoreDetails.dispose(); townLandscape.dispose(); shells.dispose(); rockResources.dispose(); woodMeshes.forEach(mesh => mesh.dispose()); crowns.dispose();
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

function nearPlants(point: SceneRuntime['pointerWorld'], positions: readonly PlantPosition[], occupied: Uint16Array, count: number) {
  const cellX = Math.floor((point[0] + 120) / 1.5);
  const cellZ = Math.floor((point[2] + 120) / 1.5);
  for (let z = Math.max(0, cellZ - 2); z <= Math.min(159, cellZ + 2); z++) for (let x = Math.max(0, cellX - 2); x <= Math.min(159, cellX + 2); x++) {
    const index = occupied[z * 160 + x] - 1;
    if (index >= 0 && index < count && Math.hypot(positions[index].x - point[0], positions[index].z - point[2]) < 1.8) return true;
  }
  return false;
}

function updatePlantUniforms(plants: ReturnType<typeof makePlants>, state: SceneRuntime, strength: number) {
  plants.material.uniforms.uTime.value = state.elapsed * world.environment.windSpeed;
  plants.material.uniforms.uPointerStrength.value = strength;
  if (state.pointerActive) plants.material.uniforms.uPointerWorld.value.fromArray(state.pointerWorld);
}


const disposalTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
function retain(resource: object, dispose: () => void) {
  clearTimeout(disposalTimers.get(resource));
  return () => { disposalTimers.set(resource, setTimeout(dispose, 0)); };
}
function TerrainSystem({ runtime, paused, quality }: EnvironmentProps) {
  const invalidate = useThree(state => state.invalidate);
  const landscape = useMemo(() => measureConstruction('terrain-trees', () => makeLandscape(createLandscapePlan())), []);
  useEffect(() => retain(landscape, () => landscape.dispose()), [landscape]);
  useFrame(() => { const state=runtime.current;coastalSoundScene.foliageDistance = Math.min(...landscape.plan.trees.map(tree => Math.hypot(tree.x-coastalSoundScene.listener[0], tree.z-coastalSoundScene.listener[2])));landscape.canopyWind.pointer.value.fromArray(state.pointerWorld);landscape.canopyWind.pointerStrength.value=state.pointerActive ? (paused ? .22 : 1) : 0;const treeAge=state.elapsed-state.nature.time;if(state.nature.kind==='tree'&&treeAge>=0&&treeAge<2){landscape.canopyWind.pointer.value.set(state.nature.x+.25,state.nature.y,state.nature.z);landscape.canopyWind.pointerStrength.value=paused?.22:Math.sin(Math.min(1,treeAge/.18)*Math.PI/2)*Math.exp(-treeAge*1.5);}if (!paused) { landscape.canopyWind.time.value = state.elapsed; landscape.shoreTime.value = state.elapsed * world.environment.waterSpeed; } });
  useEffect(() => { landscape.canopyWind.strength.value = quality === 'low' ? 0 : 1; }, [landscape, quality]);
  const nature=(kind:'tree'|'rock',x:number,y:number,z:number)=>{const state=runtime.current;state.nature={x,y,z,kind,time:state.elapsed,serial:state.nature.serial+1};if(kind==='rock')state.ripple={x,z,time:state.elapsed,serial:state.ripple.serial+1};invalidate();};
  const treeClick=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(event.delta>6||runtime.current.dragging||event.instanceId===undefined)return;const index = event.object.name === 'grove-foliage' ? Math.floor(event.instanceId / 9) : event.object.userData.treeIndices?.[event.instanceId]; const tree=landscape.plan.trees[index];if(tree)nature('tree',tree.x,tree.y+tree.height*.72,tree.z);};
  const rockClick=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(event.delta>6||runtime.current.dragging||event.instanceId===undefined)return;const entries=event.object.userData.entries as LandscapePlan['rocks']|undefined;const rock=entries?.[event.instanceId];if(rock){const impact=rockImpactPosition(rock,runtime.current.elapsed);nature('rock',impact.x,impact.y,impact.z);}};
  return <group dispose={null}>
    <mesh geometry={landscape.ground} material={landscape.material} receiveShadow name="archipelago-land" />
    <primitive object={landscape.shells} /><primitive object={landscape.shoreDetails.root} /><primitive object={landscape.townLandscape.root} /><primitive object={landscape.rocks} onClick={rockClick}/><primitive object={landscape.trunks} onClick={treeClick}/><primitive object={landscape.crowns} onClick={treeClick} />
  </group>;
}
function PlantSystem({ runtime, paused, quality, positions, onReady }: EnvironmentProps & { positions?: PlantPosition[]; onReady?: () => void }) {
  const plants = useMemo(() => {
    const plan = createLandscapePlan();
    return { grass: measureConstruction('grass', () => makePlants(plan, false, positions)), flowers: measureConstruction('flowers', () => makePlants(plan, true)), strength: 0, near: false };
  }, [positions]);
  useEffect(() => { onReady?.(); }, [onReady]);
  useEffect(() => retain(plants, () => { for (const resource of [plants.grass, plants.flowers]) { resource.geometry.dispose(); resource.material.dispose(); resource.mesh.dispose(); } }), [plants]);
  useEffect(() => { plants.grass.mesh.count = world.quality[quality].grass; plants.flowers.mesh.count = Math.round(260 * world.quality[quality].grass / world.quality.high.grass); }, [plants, quality]);
  useFrame((_, delta) => {
    if (paused) return;
    const state = runtime.current;
    plants.strength += ((state.pointerActive ? 1 : 0) - plants.strength) * (1 - Math.exp(-8 * Math.min(.05, delta)));
    updatePlantUniforms(plants.grass, state, plants.strength); updatePlantUniforms(plants.flowers, state, plants.strength);
    const near = state.pointerActive && nearPlants(state.pointerWorld, plants.grass.positions, plants.grass.occupied, plants.grass.mesh.count);
    if (near && !plants.near) state.plantInteraction++;
    plants.near = near;
  });
  return <group dispose={null}><primitive object={plants.grass.mesh}/><primitive object={plants.flowers.mesh}/></group>;
}
function CloudSystem({ runtime, paused, quality }: EnvironmentProps) {
  const clouds = useMemo(() => measureConstruction('clouds', () => makeClouds(false)), []);
  const pointer = useMemo(() => ({ raycaster: new Raycaster(), screen: new Vector2() }), []);
  useEffect(() => retain(clouds, () => clouds.dispose()), [clouds]);
  useEffect(() => { clouds.activeCount = world.quality[quality].clouds; writeCloudMatrices(clouds, runtime.current.elapsed); }, [clouds, quality, runtime]);
  useFrame(({ camera }, delta) => {
    if (paused) return;
    const state = runtime.current;
    if (state.pointerActive) { pointer.screen.set(...state.pointer); pointer.raycaster.setFromCamera(pointer.screen, camera); }
    state.cloudInteraction += updateCloudResponses(clouds.clusters, state.pointerActive ? pointer.raycaster.ray : null, state.elapsed, delta, clouds.activeCount, false);
    writeCloudMatrices(clouds, state.elapsed);
  });
  return <primitive object={clouds.mesh} dispose={null}/>;
}
function MoteSystem({ runtime, paused, quality }: EnvironmentProps) {
  const motes = useMemo(() => makeMotes(), []);
  useEffect(() => retain(motes, () => { motes.geometry.dispose(); motes.material.dispose(); motes.mesh.dispose(); motes.pointsGeometry.dispose(); motes.pointsMaterial.dispose(); }), [motes]);
  useEffect(() => { motes.mesh.count = world.quality[quality].bubbles; motes.pointsGeometry.setDrawRange(0, Math.min(16, Math.ceil(world.quality[quality].particles / 5))); }, [motes, quality]);
  useFrame(() => { if (!paused) { motes.points.rotation.y = Math.sin(runtime.current.elapsed * .025) * .08; motes.points.position.y = Math.sin(runtime.current.elapsed * .15) * .12; } });
  return <group dispose={null}><primitive object={motes.mesh}/><primitive object={motes.points}/></group>;
}
function ProgressivePlants(props: EnvironmentProps & { onReady?: () => void }) {
  const [positions, setPositions] = useState<PlantPosition[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void generatePlantPositionsAsync(world.quality.high.grass, createLandscapePlan(), controller.signal).then(result => { if (result) setPositions(result); });
    return () => controller.abort();
  }, []);
  return positions ? <PlantSystem {...props} positions={positions}/> : null;
}
export function AmbientSystem(props: EnvironmentProps & { stage?: number; onPlantsReady?: () => void }) {
  const stage = props.stage ?? 5;
  return <group name="coastal-archipelago"><TerrainSystem {...props}/>{stage >= 1 && <CloudSystem {...props}/>} {stage >= 2 && (props.stage === undefined ? <PlantSystem {...props}/> : <ProgressivePlants {...props} onReady={props.onPlantsReady}/>)} {stage >= 5 && <MoteSystem {...props}/>}</group>;
}
