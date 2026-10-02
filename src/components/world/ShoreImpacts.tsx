'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { world, type QualityTier } from '../../content/world';
import { createLandscapePlan, islandAt, landDistance, seededRandom, type LandscapeRock } from './terrain';
import { coastExposure, coastNormal, shoreBreakup, shorelineCrestTime } from './waves';
import { harborWaterHeight } from './waterSurface';
import type { EnvironmentProps } from './Water';

export interface ShoreImpactSite { island: string; rock: string; x: number; z: number; nx: number; nz: number; exposure: number; energy: number; start: number; period: number }
export interface ShoreDrop { x: number; z: number; site: number; delay: number; lift: number; outward: number; sideways: number; size: number }
export const SHORE_DROPS_PER_SITE = 36;
const FOAM_PER_SITE = 3;
const GRAVITY = 9;
const BREAKER_COLUMNS = 25, BREAKER_ROWS = 11, BREAKER_RUNUP = 5.0;

export function breakerShorePoint(site: ShoreImpactSite, across: number, output: Vector3) {
  let outward = 0;
  const x = site.x - site.nz * across, z = site.z + site.nx * across;
  while (landDistance(x + site.nx * outward, z + site.nz * outward) > -.62 && outward < 3) outward += .10;
  return output.set(x + site.nx * outward, 0, z + site.nz * outward);
}

/** A broad crest reaches the rock first; its overturning lip then produces spray. */
export function breakerPose(site: ShoreImpactSite, elapsed: number) {
  const phase = shoreImpactPhase(site, elapsed);
  const before = phase.age > site.period - BREAKER_RUNUP;
  const age = before ? phase.age - site.period : phase.age;
  const arrival = before ? phase.eventTime + site.period : phase.eventTime;
  const patch = shoreBreakup(site.x, site.z, arrival * world.environment.waterSpeed);
  const strength = patch > .10 ? .68 + patch * .32 : 0;
  const visibility = Math.max(0, Math.min(1, (age + BREAKER_RUNUP) / .9)) * Math.max(0, 1 - Math.max(0, age - .38) / .65) * strength;
  const approach = Math.max(0, Math.min(1, (age + BREAKER_RUNUP) / BREAKER_RUNUP));
  return { age, visibility, offshore: Math.max(0, -age) * .96,
    height: (.16 + approach * approach * .70) * Math.max(0, 1 - Math.max(0, age) * .78),
    curl: Math.max(0, Math.min(1, (age + 1.25) / 1.25)) * .66 };
}

export function createTravellingBreakers(sites: readonly ShoreImpactSite[]) {
  const positions: number[] = [], colors: number[] = [], visibility: number[] = [], indices: number[] = [];
  const bases: Vector3[][] = [], sea = new Color('#51c5cd'), crest = new Color('#edffff');
  sites.forEach((site, island) => {
    const columns: Vector3[] = [];
    for (let column = 0; column < BREAKER_COLUMNS; column++) {
      columns.push(breakerShorePoint(site, (column / (BREAKER_COLUMNS - 1) - .5) * 5.2, new Vector3()));
      for (let row = 0; row < BREAKER_ROWS; row++) {
        positions.push(0, 0, 0); visibility.push(0);
        const u = row / (BREAKER_ROWS - 1), color = sea.clone().lerp(crest, Math.exp(-(((u - .57) / .18) ** 2)) * .83);
        colors.push(color.r, color.g, color.b);
        if (column < BREAKER_COLUMNS - 1 && row < BREAKER_ROWS - 1) {
          const a = (island * BREAKER_COLUMNS + column) * BREAKER_ROWS + row, b = a + BREAKER_ROWS;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    bases.push(columns);
  });
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.setAttribute('aBreakerFade', new Float32BufferAttribute(visibility, 1)); geometry.setIndex(indices);
  const material = new MeshPhysicalMaterial({ color: '#e8ffff', vertexColors: true, roughness: .3, metalness: 0, clearcoat: .55, transparent: true, opacity: .86, depthWrite: false, side: DoubleSide });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float aBreakerFade; varying float vBreakerFade;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBreakerFade=aBreakerFade;');
    shader.fragmentShader = `varying float vBreakerFade;\n${shader.fragmentShader}`.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vBreakerFade;');
  };
  material.customProgramCacheKey = () => 'travelling-overturning-rock-breakers';
  const mesh = new Mesh(geometry, material); mesh.name = 'travelling-lighthouse-wave-crests'; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.raycast = () => undefined;
  const lipGeometry = new BufferGeometry(), lipCount = sites.length * BREAKER_COLUMNS * 2, lipIndices: number[] = [];
  lipGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(lipCount * 3), 3));
  lipGeometry.setAttribute('aBreakerFade', new Float32BufferAttribute(new Float32Array(lipCount), 1));
  for (let site = 0; site < sites.length; site++) for (let column = 0; column < BREAKER_COLUMNS - 1; column++) {
    const a = (site * BREAKER_COLUMNS + column) * 2; lipIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  lipGeometry.setIndex(lipIndices);
  const lipMaterial = new MeshStandardMaterial({ color: '#f1fffa', roughness: .92, transparent: true, opacity: .92, side: DoubleSide, depthWrite: false });
  lipMaterial.onBeforeCompile = material.onBeforeCompile;
  lipMaterial.customProgramCacheKey = () => 'breaking-crest-foam-ribbon';
  const lip = new Mesh(lipGeometry, lipMaterial); lip.name = 'travelling-lighthouse-breaking-foam'; lip.frustumCulled = false; lip.renderOrder = 5; lip.raycast = () => undefined;
  return { geometry, material, mesh, bases, lip, lipGeometry, lipMaterial };
}

export function updateTravellingBreakers(breakers: ReturnType<typeof createTravellingBreakers>, sites: readonly ShoreImpactSite[], elapsed: number, siteCount: number) {
  const positions = breakers.geometry.getAttribute('position'), fades = breakers.geometry.getAttribute('aBreakerFade');
  for (let index = 0; index < sites.length; index++) {
    const site = sites[index], pose = breakerPose(site, elapsed);
    for (let column = 0; column < BREAKER_COLUMNS; column++) {
      const across = column / (BREAKER_COLUMNS - 1), taper = Math.sin(across * Math.PI) ** .55;
      const base = breakers.bases[index][column], skew = Math.sin(across * Math.PI * 2 + index) * .18;
      for (let row = 0; row < BREAKER_ROWS; row++) {
        const u = row / (BREAKER_ROWS - 1), curl = Math.sin(Math.max(0, (u - .45) / .55) * Math.PI) * pose.curl;
        const radial = pose.offshore + (.5 - u) * 1.28 - curl + skew;
        const x = base.x + site.nx * radial, z = base.z + site.nz * radial;
        const vertex = (index * BREAKER_COLUMNS + column) * BREAKER_ROWS + row;
        positions.setXYZ(vertex, x, harborWaterHeight(x, z, elapsed) + Math.sin(u * Math.PI) * pose.height * taper + .018, z);
        fades.setX(vertex, index < siteCount ? pose.visibility * taper * Math.sin(u * Math.PI) ** .45 : 0);
      }
    }
  }
  positions.needsUpdate = true; fades.needsUpdate = true; breakers.geometry.computeVertexNormals();
  const lipPositions = breakers.lipGeometry.getAttribute('position'), lipFades = breakers.lipGeometry.getAttribute('aBreakerFade');
  for (let site = 0; site < sites.length; site++) {
    const pose = breakerPose(sites[site], elapsed);
    for (let column = 0; column < BREAKER_COLUMNS; column++) for (let edge = 0; edge < 2; edge++) {
      const source = (site * BREAKER_COLUMNS + column) * BREAKER_ROWS + 5, target = (site * BREAKER_COLUMNS + column) * 2 + edge;
      const width = .13 + .05 * Math.sin(column * 2.31 + site), t = edge ? .91 - width : width;
      lipPositions.setXYZ(target, positions.getX(source) * (1 - t) + positions.getX(source + 1) * t,
        positions.getY(source) * (1 - t) + positions.getY(source + 1) * t + .009,
        positions.getZ(source) * (1 - t) + positions.getZ(source + 1) * t);
      lipFades.setX(target, fades.getX(source) * Math.min(1, pose.height / .7) * (.77 + .23 * Math.sin(column * 1.9 + site) ** 2));
    }
  }
  lipPositions.needsUpdate = true; lipFades.needsUpdate = true; breakers.lipGeometry.computeVertexNormals();
}

/** A clicked shore rock disturbs water beside its exposed face. */
export function rockImpactPosition(rock: LandscapeRock, elapsed: number) {
  const normal = coastNormal(rock.x, rock.z);
  let reach = rock.radius + .12;
  while (landDistance(rock.x + normal.x * reach, rock.z + normal.z * reach) > -.12 && reach < rock.radius + 2) reach += .1;
  const x = rock.x + normal.x * reach, z = rock.z + normal.z * reach;
  return { x, y: harborWaterHeight(x, z, elapsed) + .06, z };
}

export function createShoreImpactSites() {
  const sites: ShoreImpactSite[] = [], wavePeriod = Math.PI * 2 / (1.45 * world.environment.waterSpeed);
  // Separate rock faces around the exposed cliff remain legible from the main island.
  for (const [index, angle] of [.95, 1.65, 2.45, 3.25].entries()) {
    let radius = 3;
    while (landDistance(-76 + Math.cos(angle) * radius, -36 + Math.sin(angle) * radius) > -.7 && radius < 10) radius += .08;
    const x = -76 + Math.cos(angle) * radius, z = -36 + Math.sin(angle) * radius;
    const normal = coastNormal(x, z), exposure = coastExposure(x, z);
    const arrival = shorelineCrestTime(landDistance(x, z), x, z, 0) / world.environment.waterSpeed;
    sites.push({ island: 'beacon', rock: `beacon-cliff-face-${index}`, x, z, nx: normal.x, nz: normal.z,
      exposure, energy: 1.62 + index * .08, start: (arrival % wavePeriod + wavePeriod) % wavePeriod, period: wavePeriod * (index === 3 ? 2 : 1) });
  }
  const rocks = createLandscapePlan().rocks.toSorted((a, b) => b.radius - a.radius);
  for (const rock of rocks) {
    const island = islandAt(rock.x, rock.z).island.id;
    if (island === 'beacon') continue;
    const normal = coastNormal(rock.x, rock.z), nx = normal.x, nz = normal.z;
    const x = rock.x + nx * (rock.radius + .12), z = rock.z + nz * (rock.radius + .12), exposure = coastExposure(x, z);
    if (exposure < .28 || landDistance(x, z) > -.3 || sites.some(site => Math.hypot(site.x - x, site.z - z) < .58)) continue;
    const arrival = shorelineCrestTime(landDistance(x, z), x, z, 0) / world.environment.waterSpeed;
    sites.push({ island, rock: rock.id, x, z, nx, nz, exposure, energy: .85 + rock.radius * .20,
      start: (arrival % wavePeriod + wavePeriod) % wavePeriod, period: wavePeriod * (2 + sites.length % 2) });
    if (sites.length === 8) return sites;
  }
  if (sites.length < 4) throw new Error(`Insufficient exposed shoreline rocks (${sites.length})`);
  return sites;
}

export function createShoreDrops(sites: readonly ShoreImpactSite[]) {
  const random = seededRandom(7241);
  return Array.from({ length: sites.length * SHORE_DROPS_PER_SITE }, (_, index): ShoreDrop => {
    const site = Math.floor(index / SHORE_DROPS_PER_SITE), beacon = sites[site].island === 'beacon';
    const launch = breakerShorePoint(sites[site], (random() - .5) * 4.2, new Vector3());
    return { site, x: launch.x, z: launch.z, delay: .10 + (index % SHORE_DROPS_PER_SITE) * .010 + random() * .045,
      lift: (beacon ? 2.4 : 2.7) + random() * (beacon ? 1.25 : 1.8), outward: 1.1 + random() * 1.25,
      sideways: (random() - .5) * 1.1, size: (beacon ? .022 : .016) + random() ** 2 * (beacon ? .045 : .042) };
  });
}

/** Ballistic droplets fall back into the sea; their lift and launch delay make an uneven spray fan. */
export function shoreDropPose(site: ShoreImpactSite, drop: ShoreDrop, age: number, position: Vector3) {
  const life = drop.lift * 2 / GRAVITY;
  if (age < 0 || age > life) { position.set(site.x, -.3, site.z); return 0; }
  position.set(drop.x + site.nx * drop.outward * age - site.nz * drop.sideways * age, .055 + drop.lift * age - .5 * GRAVITY * age * age, drop.z + site.nz * drop.outward * age + site.nx * drop.sideways * age);
  const fade = Math.min(1, age / .045) * Math.min(1, (life - age) / .16);
  return drop.size * site.energy * fade;
}

export function shoreImpactPhase(site: ShoreImpactSite, elapsed: number) {
  const age = ((elapsed - site.start) % site.period + site.period) % site.period, eventTime = elapsed - age;
  const patch = shoreBreakup(site.x, site.z, eventTime * world.environment.waterSpeed);
  return { age, eventTime, strength: patch > .10 ? .68 + patch * .32 : 0 };
}

export function createShoreImpactSystem() {
  const sites = createShoreImpactSites(), drops = createShoreDrops(sites), root = new Group();root.name = 'breaking-shore-impacts';
  const geometry = new SphereGeometry(1, 7, 5);
  const material = new MeshPhysicalMaterial({ color: '#d8ffff', roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .70, depthWrite: false });
  const mesh = new InstancedMesh(geometry, material, drops.length);
  mesh.name = 'breaking-shore-droplets'; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.raycast = () => undefined;root.add(mesh);
  drops.forEach((_, index) => mesh.setColorAt(index, new Color(index % 4 === 0 ? '#c1f0f3' : '#ffffff')));
  const foamGeometry = new RingGeometry(.78, 1, 18, 1, -.70, 1.40).rotateX(-Math.PI / 2);
  const foamMaterial = new MeshStandardMaterial({ color: '#e0ffff', roughness: .7, transparent: true, opacity: .64, depthWrite: false, side: DoubleSide });
  const foamFades = new InstancedBufferAttribute(new Float32Array(sites.length * FOAM_PER_SITE), 1);foamGeometry.setAttribute('aFoamFade', foamFades);
  foamMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float aFoamFade; varying float vFoamFade;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoamFade=aFoamFade;');
    shader.fragmentShader = `varying float vFoamFade;\n${shader.fragmentShader}`.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vFoamFade;');
  };foamMaterial.customProgramCacheKey = () => 'shore-impact-foam-fans-v1';
  const foam = new InstancedMesh(foamGeometry, foamMaterial, sites.length * FOAM_PER_SITE);foam.name = 'rock-impact-foam-fans';foam.raycast = () => undefined;foam.frustumCulled = false;foam.renderOrder = 4;root.add(foam);
  const breakers = createTravellingBreakers(sites); root.add(breakers.mesh, breakers.lip);
  const system = { breakers, root, sites, drops, geometry, material, mesh, foam, foamGeometry, foamMaterial, foamFades, phases: sites.map(site => shoreImpactPhase(site, 0)), elapsed: 0, transform: new Object3D(), position: new Vector3(), velocity: new Vector3(), up: new Vector3(0, 1, 0), disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { breakers.geometry.dispose(); breakers.material.dispose(); breakers.lipGeometry.dispose(); breakers.lipMaterial.dispose(); geometry.dispose(); material.dispose(); mesh.dispose(); foamGeometry.dispose(); foamMaterial.dispose(); foam.dispose(); },
  };
  updateShoreImpacts(system, 0, 'high');
  return system;
}

export function updateShoreImpacts(system: ReturnType<typeof createShoreImpactSystem>, elapsed: number, quality: QualityTier, paused = false) {
  const siteCount = quality === 'low' ? 0 : quality === 'medium' ? Math.min(4, system.sites.length) : system.sites.length;
  system.mesh.count = siteCount * SHORE_DROPS_PER_SITE;system.foam.count = siteCount * FOAM_PER_SITE;
  if (paused) return;
  system.elapsed = elapsed;
  updateTravellingBreakers(system.breakers, system.sites, elapsed, quality === 'low' ? 4 : siteCount);
  for (let site = 0; site < siteCount; site++) system.phases[site] = shoreImpactPhase(system.sites[site], elapsed);
  for (let index = 0; index < system.mesh.count; index++) {
    const drop = system.drops[index], site = system.sites[drop.site], phase = system.phases[drop.site], age = phase.age - drop.delay;
    const size = phase.strength * shoreDropPose(site, drop, age, system.position);
    system.position.y += harborWaterHeight(site.x, site.z, phase.eventTime);
    system.transform.position.copy(system.position);
    system.velocity.set(site.nx * drop.outward - site.nz * drop.sideways, drop.lift - GRAVITY * age, site.nz * drop.outward + site.nx * drop.sideways).normalize();
    system.transform.quaternion.setFromUnitVectors(system.up, system.velocity);
    system.transform.scale.set(size, size * (1.25 + Math.min(1.2, Math.abs(drop.lift - GRAVITY * age) * .20)), size);
    system.transform.updateMatrix();system.mesh.setMatrixAt(index, system.transform.matrix);
  }
  for (let index = 0; index < system.foam.count; index++) {
    const site = system.sites[Math.floor(index / FOAM_PER_SITE)], arc = index % FOAM_PER_SITE, phase = system.phases[Math.floor(index / FOAM_PER_SITE)], age = phase.age - .15 - arc * .16;
    const active = age > 0 && age < 2.6 && phase.strength > 0, radius = .30 + Math.max(0, age) * (.60 + arc * .10);
    system.transform.position.set(site.x + site.nx * .58, harborWaterHeight(site.x, site.z, elapsed) + .035 + arc * .007, site.z + site.nz * .58);
    system.transform.rotation.set(0, Math.atan2(-site.nz, site.nx) + (arc - 1) * .08, 0);
    system.transform.scale.set(radius, 1, 1.55 + Math.max(0, age) * (.34 + arc * .12));system.transform.updateMatrix();system.foam.setMatrixAt(index, system.transform.matrix);
    system.foamFades.setX(index, active ? Math.min(1, age * 5) * (1 - age / 2.6) * phase.strength : 0);
  }
  system.mesh.instanceMatrix.needsUpdate = true;system.foam.instanceMatrix.needsUpdate = true;system.foamFades.needsUpdate = true;
}

export function ShoreImpacts({ runtime, paused, quality }: EnvironmentProps) {
  const system = useMemo(() => createShoreImpactSystem(), []);
  useEffect(() => { clearTimeout(system.disposeTimer); return () => { system.disposeTimer = setTimeout(() => system.dispose(), 0); }; }, [system]);
  useEffect(() => { updateShoreImpacts(system, system.elapsed, quality, true); }, [system, quality]);
  const inspection = useMemo(() => {
    if (typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
    const value = new URLSearchParams(window.location.search).get('qaSurfTime');
    return value !== null && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
  }, []);
  useFrame(() => { updateShoreImpacts(system, inspection ?? runtime.current.elapsed, quality, inspection === null && paused); });
  return <primitive object={system.root} dispose={null} />;
}
