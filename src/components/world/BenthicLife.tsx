'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getReefHabitat, reefFloorHeight, reefRockSurfaceHeight } from './reefHabitat';
import { seededRandom } from './terrain';
import { crabCarapaceGeometry } from './Wildlife';
import { crabVariation } from './crabVariation';
import type { EnvironmentProps } from './Water';

export const BENTHIC_KINDS = ['starfish', 'ribbed-clam', 'barnacle-colony', 'reef-crab'] as const;
export interface BenthicSite { kind: number; x: number; y: number; z: number; normal: Vector3; yaw: number; scale: number; tint: number; host: number }

export function createBenthicLayout(): BenthicSite[] {
  const plan = getReefHabitat(), random = seededRandom(12947), sites: BenthicSite[] = [];
  const surface = (x: number, z: number) => Math.max(reefFloorHeight(x, z), ...plan.rocks.filter(rock => Math.hypot(x - rock.x, z - rock.z) < rock.radius).map(rock => reefRockSurfaceHeight(rock, x, z)));
  for (let host = 0; host < plan.rocks.length; host++) {
    const rock = plan.rocks[host];
    if(rock.patch>=200)continue; // Small talus cannot support a full ledge colony.
    for (const kind of [0, 1, 2, 2]) for (let attempt = 0; attempt < 18; attempt++) {
      const angle = random() * Math.PI * 2, radius = rock.radius * (.35 + random() * .55);
      const x = rock.x + Math.cos(angle) * radius, z = rock.z + Math.sin(angle) * radius;
      const y = reefRockSurfaceHeight(rock, x, z);
      if (!Number.isFinite(y) || y > -1.95 || Math.abs(y - surface(x, z)) > .06) continue;
      const reach = kind === 0 ? .38 : .25;
      const heights = [[-.12, 0], [.12, 0], [0, -.12], [0, .12]].map(([dx, dz]) => surface(x + dx, z + dz));
      if (heights.some(height => Math.abs(height - y) > .12)
        || plan.colonies.some(coral => Math.hypot(x - coral.x, z - coral.z) < coral.radius + reach && Math.abs(y - coral.y) < .5)
        || sites.some(site => Math.hypot(x - site.x, z - site.z) < .45 && Math.abs(y - site.y) < .4)) continue;
      const normal = new Vector3(heights[0] - heights[1], .24, heights[2] - heights[3]).normalize();
      sites.push({ kind, x, y: y + .012, z, normal, yaw: random() * Math.PI * 2, scale: .65 + random() * .3, tint: random(), host });
      break;
    }
  }
  // Small crabs occupy sand beside outcrops, never the coral canopy or the water surface.
  const ledges=plan.rocks.filter(rock=>rock.patch<200);
  for (let index = 0; index < 45; index++) for (let attempt = 0; attempt < 35; attempt++) {
    const rock = ledges[Math.floor(random() * ledges.length)], angle = random() * Math.PI * 2;
    const x = rock.x + Math.cos(angle) * (rock.radius + .95), z = rock.z + Math.sin(angle) * (rock.radius + .95);
    const y = reefFloorHeight(x, z);
    if (y > -2 || y < -12 || plan.rocks.some(other => Math.hypot(x - other.x, z - other.z) < other.radius + .65)
      || sites.some(site => Math.hypot(x - site.x, z - site.z) < 1.0)) continue;
    sites.push({ kind: 3, x, y: y + .095, z, normal: new Vector3(0, 1, 0), yaw: random() * Math.PI * 2, scale: .85 + random() * .3, tint: random(), host: -1 });
    break;
  }
  // Interleave habitats so reduced quality keeps animals throughout the archipelago.
  for (let i = sites.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [sites[i], sites[j]] = [sites[j], sites[i]];
  }
  return sites;
}

export function benthicGeometry(kind: number,variant=0) {
  const parts: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, color: string) => {
    geometry.deleteAttribute('uv'); const tint = new Color(color), count = geometry.attributes.position.count, colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) { const shade = .87 + .13 * Math.sin(index * 1.71) ** 2; colors.set([tint.r * shade, tint.g * shade, tint.b * shade], index * 3); }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); parts.push(geometry);
  };
  const bone = (a: Vector3, b: Vector3, radius: number, color: string) => {
    const axis = b.clone().sub(a), transform = new Object3D();
    transform.position.copy(a).add(b).multiplyScalar(.5); transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.clone().normalize()); transform.updateMatrix();
    add(new CylinderGeometry(radius * .65, radius, axis.length(), 6).applyMatrix4(transform.matrix), color);
  };
  if (kind === 0) {
    const positions = [0, .105, 0], indices: number[] = [], sides = 60;
    for (let row = 1; row <= 7; row++) for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2, t = row / 7;
      const radius = (.14 + .31 * Math.pow(.5 + .5 * Math.cos(angle * 5), 2.7)) * t;
      const height = .02 + .085 * Math.pow(1 - t * t, .8) + .007 * Math.sin(angle * 30 + row);
      positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      const i = 1 + (row - 1) * sides + side, next = 1 + (row - 1) * sides + (side + 1) % sides;
      if (row === 1) indices.push(0, next, i); else indices.push(i - sides, next, i, i - sides, next - sides, next);
    }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); add(geometry, '#ce7b43');
    for (let arm = 0; arm < 5; arm++) for (let n = 1; n < 5; n++) {
      const angle = arm * Math.PI * 2 / 5, r = n * .075;
      add(new SphereGeometry(.013, 5, 3).translate(Math.cos(angle) * r, .115 - n * .009, Math.sin(angle) * r), '#f2c995');
    }
  } else if (kind === 1) {
    for (const sign of [-1, 1]) {
      const positions: number[] = [], indices: number[] = [];
      for (let row = 0; row <= 8; row++) for (let rib = 0; rib <= 32; rib++) {
        const t = row / 8, a = (rib / 32 - .5) * Math.PI * .9, ridge = 1 + .05 * Math.cos(a * 24);
        positions.push(Math.sin(a) * t * .31 * ridge, .055 + sign * (.065 * Math.sin(t * Math.PI * .78) + .008 * t), Math.cos(a) * t * .40);
        if (row && rib) { const i = row * 33 + rib; indices.push(i, i - 1, i - 33, i - 1, i - 34, i - 33); }
      }
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); add(geometry, sign > 0 ? '#cda779' : '#987151');
    }
    add(new SphereGeometry(1, 12, 6).scale(.24, .02, .23).translate(0, .045, .20), '#485369');
  } else if (kind === 2) {
    for (let n = 0; n < 7; n++) {
      const angle = n * 2.399, radius = Math.sqrt(n / 7) * .19, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const height = .08 + n % 3 * .025;
      add(new CylinderGeometry(.035, .064, height, 7, 1, true).translate(x, height / 2, z), '#d9c7ae');
      add(new CylinderGeometry(.031, .031, .012, 7).translate(x, height * .65, z), '#565850');
    }
  } else {
    const traits=crabVariation(variant*4+2);
    add(crabCarapaceGeometry().scale(traits.width,1,traits.depth), traits.color);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const z = -.075 + leg * .05, a = new Vector3(side * .13*traits.width, .035, z), b = new Vector3(side * .25*traits.width, .05, z + .015), c = new Vector3(side * .32*traits.width, -.085, z + .045);
        bone(a, b, .016, '#b57a50'); bone(b, c, .011, '#c28c60');
      }
      const clawScale=side<0?traits.leftClaw:traits.rightClaw;
      bone(new Vector3(side * .10, .02, -.08), new Vector3(side * (.10+.09*clawScale), .075, -.08-.13*clawScale), .028*clawScale, traits.legColor);
      for (const claw of [-1, 1]) bone(new Vector3(side * (.10+.09*clawScale), .075, -.08-.13*clawScale), new Vector3(side * (.10+(.08+claw*.035)*clawScale), .085, -.08-.21*clawScale), .018*clawScale, '#deaa72');
      bone(new Vector3(side * .06, .05, -.09), new Vector3(side * .07, .15, -.11), .009, '#a17755');
      add(new SphereGeometry(.022, 7, 5).translate(side * .07, .15, -.11), '#182e30');
    }
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); geometry.computeBoundingSphere(); geometry.userData.species = BENTHIC_KINDS[kind]; return geometry;
}

export function createBenthicLife() {
  const root = new Group(), sites = createBenthicLayout(), transform = new Object3D(); root.name = 'reef-floor-invertebrates';
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: .86, side: DoubleSide });
  const batches = BENTHIC_KINDS.flatMap((kind,form)=>Array.from({length:form===3?3:1},(_,variant)=>({kind,form,variant}))).map(({kind,form,variant}) => {
    const entries = sites.filter(site => site.kind === form).filter((_,index)=>form!==3||index%3===variant), geometry = benthicGeometry(form,variant), mesh = new InstancedMesh(geometry, material, entries.length);
    mesh.name = kind; mesh.raycast = () => {}; mesh.receiveShadow = true;
    entries.forEach((site, index) => {
      transform.position.set(site.x, site.y, site.z); transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), site.normal); transform.rotateY(site.yaw); const size=form===3?site.scale*(.65+(index%5)*.14):site.scale;transform.scale.setScalar(size); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, form===3?new Color(crabVariation(index+variant*9).color).lerp(new Color('#ffffff'),.55):new Color().setHSL(.06 + site.tint * .06, .10, .76 + site.tint * .18));
    });
    mesh.computeBoundingSphere(); root.add(mesh); return { mesh, geometry, count: entries.length };
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { batches.forEach(({ mesh, geometry }) => { geometry.dispose(); mesh.dispose(); }); material.dispose(); };
  return { root, sites, batches, setQuality(quality: EnvironmentProps['quality']) { batches.forEach(batch => { batch.mesh.count = Math.ceil(batch.count * (quality === 'high' ? 1 : quality === 'medium' ? .75 : .5)); }); }, dispose, retain() { clearTimeout(timer); return () => { timer = setTimeout(dispose, 0); }; } };
}

export function BenthicLife({ quality }: Pick<EnvironmentProps, 'quality'>) {
  const life = useMemo(() => createBenthicLife(), []);
  useEffect(() => life.retain(), [life]);
  useEffect(() => life.setQuality(quality), [life, quality]);
  return <primitive object={life.root} dispose={null} />;
}
