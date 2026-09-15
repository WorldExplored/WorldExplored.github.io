'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, MeshPhysicalMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { world, type QualityTier } from '../../content/world';
import { ISLANDS, islandContour, landDistance, seededRandom } from './terrain';
import { coastExposure, coastNormal, shoreAlong, shoreBreakup } from './waves';
import type { EnvironmentProps } from './Water';

export interface ShoreImpactSite { island: string; x: number; z: number; nx: number; nz: number; exposure: number; start: number; period: number }
export interface ShoreDrop { site: number; delay: number; lift: number; outward: number; sideways: number; size: number }
const DROPS_PER_SITE = 7;
const GRAVITY = 9;

export function createShoreImpactSites() {
  const sites: ShoreImpactSite[] = [];
  // The first four sites survive medium quality, including the offshore beacon.
  const islands = ['beacon', 'main', 'garden', 'city', 'beacon', 'purdue', 'main', 'city'];
  for (const id of islands) {
    const island = ISLANDS.find(item => item.id === id)!;
    let best: { x: number; z: number; nx: number; nz: number; exposure: number; score: number } | null = null;
    for (let step = 0; step < 96; step++) {
      const angle = step / 96 * Math.PI * 2; const contour = islandContour(island, angle);
      if (contour < 1.025 && id !== 'beacon') continue;
      let x = island.x + Math.cos(angle) * island.rx * contour; let z = island.z + Math.sin(angle) * island.rz * contour;
      const normal = coastNormal(x, z);
      x += normal.x * .5; z += normal.z * .5;
      const exposure = coastExposure(x, z);
      if (exposure < .35 || landDistance(x, z) > -.25 || sites.some(site => Math.hypot(site.x - x, site.z - z) < 4)) continue;
      const score = exposure * (.8 + contour * .2);
      if (!best || score > best.score) best = { x, z, nx: normal.x, nz: normal.z, exposure, score };
    }
    if (!best) continue;
    const wavePeriod = Math.PI * 2 / (1.45 * world.environment.waterSpeed);
    const period = wavePeriod * (sites.length % 2 ? 3 : 2);
    const arrival = (-shoreAlong(best.x, best.z) + landDistance(best.x, best.z) * 1.32 + .22) / (1.45 * world.environment.waterSpeed);
    const start = (arrival % wavePeriod + wavePeriod) % wavePeriod + (sites.length % 3 === 1 ? wavePeriod : 0);
    sites.push({ island: id, x: best.x, z: best.z, nx: best.nx, nz: best.nz, exposure: best.exposure, start, period });
  }
  return sites;
}

export function createShoreDrops(sites: readonly ShoreImpactSite[]) {
  const random = seededRandom(7241);
  return Array.from({ length: sites.length * DROPS_PER_SITE }, (_, index): ShoreDrop => ({
    site: Math.floor(index / DROPS_PER_SITE), delay: (index % DROPS_PER_SITE) * .025,
    lift: 2.5 + random() * 1.5, outward: .35 + random() * .6, sideways: (random() - .5) * 1.5, size: .045 + random() * .045,
  }));
}

/** Drops rise briefly, arc back into the sea, then remain hidden until the next set. */
export function shoreDropPose(site: ShoreImpactSite, drop: ShoreDrop, age: number, position: Vector3) {
  const life = drop.lift * 2 / GRAVITY + .07;
  if (age < 0 || age > life) { position.set(site.x, -.3, site.z); return 0; }
  position.set(site.x + site.nx * drop.outward * age - site.nz * drop.sideways * age, .055 + drop.lift * age - .5 * GRAVITY * age * age, site.z + site.nz * drop.outward * age + site.nx * drop.sideways * age);
  const fade = Math.min(1, age / .065) * (1 - Math.max(0, (age - life + .14) / .14));
  return drop.size * fade;
}

export function createShoreImpactSystem() {
  const sites = createShoreImpactSites(); const drops = createShoreDrops(sites);
  const geometry = new SphereGeometry(1, 7, 5);
  const material = new MeshPhysicalMaterial({ color: '#d8ffff', roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .86, depthWrite: false });
  const mesh = new InstancedMesh(geometry, material, drops.length);
  mesh.name = 'breaking-shore-droplets'; mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.raycast = () => undefined;
  const system = { sites, drops, geometry, material, mesh, elapsed: 0, transform: new Object3D(), position: new Vector3(), disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
  updateShoreImpacts(system, 0, 'high');
  return system;
}

export function updateShoreImpacts(system: ReturnType<typeof createShoreImpactSystem>, elapsed: number, quality: QualityTier, paused = false) {
  system.mesh.count = quality === 'low' ? 0 : quality === 'medium' ? Math.min(4 * DROPS_PER_SITE, system.drops.length) : system.drops.length;
  if (paused) return;
  system.elapsed = elapsed;
  for (let index = 0; index < system.mesh.count; index++) {
    const drop = system.drops[index]; const site = system.sites[drop.site];
    const eventAge = ((elapsed - site.start) % site.period + site.period) % site.period;
    const eventTime = elapsed - eventAge;
    const patch = shoreBreakup(site.x, site.z, eventTime * world.environment.waterSpeed);
    const size = patch > .2 ? shoreDropPose(site, drop, eventAge - drop.delay, system.position) : 0;
    system.transform.position.copy(system.position);
    system.transform.scale.set(size, size * 1.65, size);
    system.transform.rotation.set(.1, 0, -site.nx * .25);
    system.transform.updateMatrix(); system.mesh.setMatrixAt(index, system.transform.matrix);
  }
  system.mesh.instanceMatrix.needsUpdate = true;
}

export function ShoreImpacts({ runtime, paused, quality }: EnvironmentProps) {
  const system = useMemo(() => createShoreImpactSystem(), []);
  useEffect(() => { clearTimeout(system.disposeTimer); return () => { system.disposeTimer = setTimeout(() => system.dispose(), 0); }; }, [system]);
  useEffect(() => { updateShoreImpacts(system, system.elapsed, quality, true); }, [system, quality]);
  useFrame(() => { updateShoreImpacts(system, runtime.current.elapsed, quality, paused); });
  return <primitive object={system.mesh} dispose={null} />;
}
