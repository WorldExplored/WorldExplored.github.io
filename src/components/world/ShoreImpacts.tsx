'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { world, type QualityTier } from '../../content/world';
import { createLandscapePlan, islandAt, landDistance, seededRandom, type LandscapeRock } from './terrain';
import { coastExposure, coastNormal, shoreBreakup, shorelineCrestTime } from './waves';
import { harborWaterHeight } from './waterSurface';
import type { EnvironmentProps } from './Water';

export interface ShoreImpactSite { island: string; rock: string; x: number; z: number; nx: number; nz: number; exposure: number; energy: number; start: number; period: number }
export interface ShoreDrop { site: number; delay: number; lift: number; outward: number; sideways: number; size: number }
export const SHORE_DROPS_PER_SITE = 36;
const FOAM_PER_SITE = 3;
const GRAVITY = 9;

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
  const rocks = createLandscapePlan().rocks.toSorted((a, b) => {
    const beaconA = islandAt(a.x, a.z).island.id === 'beacon', beaconB = islandAt(b.x, b.z).island.id === 'beacon';
    return Number(beaconB) - Number(beaconA) || b.radius - a.radius;
  });
  for (const rock of rocks) {
    const island = islandAt(rock.x, rock.z).island.id, normal = coastNormal(rock.x, rock.z);
    // Spray rebounds from the seaward face, beyond the visible rock, instead of being hidden inside it.
    for (const angle of island === 'beacon' ? [-.48, 0, .48] : [0]) {
      if (island === 'beacon' && sites.filter(site => site.island === 'beacon').length >= 3) break;
      const nx = normal.x * Math.cos(angle) - normal.z * Math.sin(angle), nz = normal.z * Math.cos(angle) + normal.x * Math.sin(angle);
      const x = rock.x + nx * (rock.radius + .12), z = rock.z + nz * (rock.radius + .12), exposure = coastExposure(x, z);
      if (exposure < .28 || landDistance(x, z) > -.3 || sites.some(site => Math.hypot(site.x - x, site.z - z) < .58)) continue;
      const multiple = island === 'beacon' ? (sites.length === 2 ? 2 : 1) : 2 + sites.length % 2;
      const arrival = shorelineCrestTime(landDistance(x, z), x, z, 0) / world.environment.waterSpeed;
      const start = (arrival % wavePeriod + wavePeriod) % wavePeriod;
      sites.push({ island, rock: rock.id, x, z, nx, nz, exposure, energy: island === 'beacon' ? 1.45 + rock.radius * .17 : .85 + rock.radius * .20, start, period: wavePeriod * multiple });
      if (sites.length === 8) return sites;
    }
  }
  if (sites.length < 4) throw new Error(`Insufficient exposed shoreline rocks (${sites.length})`);
  return sites;
}

export function createShoreDrops(sites: readonly ShoreImpactSite[]) {
  const random = seededRandom(7241);
  return Array.from({ length: sites.length * SHORE_DROPS_PER_SITE }, (_, index): ShoreDrop => {
    const site = Math.floor(index / SHORE_DROPS_PER_SITE), beacon = sites[site].island === 'beacon';
    return { site, delay: (index % SHORE_DROPS_PER_SITE) * .010 + random() * .045,
      lift: (beacon ? 3.4 : 2.7) + random() * (beacon ? 2.9 : 1.8), outward: .65 + random() * 1.1,
      sideways: (random() - .5) * 2.1, size: .016 + random() ** 2 * .042 };
  });
}

/** Ballistic droplets fall back into the sea; their lift and launch delay make an uneven spray fan. */
export function shoreDropPose(site: ShoreImpactSite, drop: ShoreDrop, age: number, position: Vector3) {
  const life = drop.lift * 2 / GRAVITY;
  if (age < 0 || age > life) { position.set(site.x, -.3, site.z); return 0; }
  position.set(site.x + site.nx * drop.outward * age - site.nz * drop.sideways * age, .055 + drop.lift * age - .5 * GRAVITY * age * age, site.z + site.nz * drop.outward * age + site.nx * drop.sideways * age);
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
  mesh.name = 'breaking-shore-droplets'; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.raycast = () => undefined;root.add(mesh);
  drops.forEach((_, index) => mesh.setColorAt(index, new Color(index % 4 === 0 ? '#c1f0f3' : '#ffffff')));
  const foamGeometry = new RingGeometry(.78, 1, 18, 1, -.70, 1.40).rotateX(-Math.PI / 2);
  const foamMaterial = new MeshStandardMaterial({ color: '#e0ffff', roughness: .7, transparent: true, opacity: .64, depthWrite: false, side: DoubleSide });
  const foamFades = new InstancedBufferAttribute(new Float32Array(sites.length * FOAM_PER_SITE), 1);foamGeometry.setAttribute('aFoamFade', foamFades);
  foamMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float aFoamFade; varying float vFoamFade;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoamFade=aFoamFade;');
    shader.fragmentShader = `varying float vFoamFade;\n${shader.fragmentShader}`.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vFoamFade;');
  };foamMaterial.customProgramCacheKey = () => 'shore-impact-foam-fans-v1';
  const foam = new InstancedMesh(foamGeometry, foamMaterial, sites.length * FOAM_PER_SITE);foam.name = 'rock-impact-foam-fans';foam.raycast = () => undefined;foam.frustumCulled = false;foam.renderOrder = 1;root.add(foam);
  const system = { root, sites, drops, geometry, material, mesh, foam, foamGeometry, foamMaterial, foamFades, phases: sites.map(site => shoreImpactPhase(site, 0)), elapsed: 0, transform: new Object3D(), position: new Vector3(), velocity: new Vector3(), up: new Vector3(0, 1, 0), disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); foamGeometry.dispose(); foamMaterial.dispose(); foam.dispose(); },
  };
  updateShoreImpacts(system, 0, 'high');
  return system;
}

export function updateShoreImpacts(system: ReturnType<typeof createShoreImpactSystem>, elapsed: number, quality: QualityTier, paused = false) {
  const siteCount = quality === 'low' ? 0 : quality === 'medium' ? Math.min(4, system.sites.length) : system.sites.length;
  system.mesh.count = siteCount * SHORE_DROPS_PER_SITE;system.foam.count = siteCount * FOAM_PER_SITE;
  if (paused) return;
  system.elapsed = elapsed;
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
    const active = age > 0 && age < 2.6 && phase.strength > 0, radius = .38 + Math.max(0, age) * (1.1 + arc * .15);
    system.transform.position.set(site.x + site.nx * .18, harborWaterHeight(site.x, site.z, elapsed) + .035 + arc * .007, site.z + site.nz * .18);
    system.transform.rotation.set(0, Math.atan2(-site.nz, site.nx) + (arc - 1) * .08, 0);
    system.transform.scale.set(radius, 1, radius * (.85 + arc * .14));system.transform.updateMatrix();system.foam.setMatrixAt(index, system.transform.matrix);
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
