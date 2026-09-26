'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { cityDocks } from './cityInfrastructure';
import { LIGHTHOUSE_LANDING } from './LighthouseAccess';
import { seededRandom, terrainHeight, terrainMeshHeight } from './terrain';

export interface DockPole { id: string; x: number; z: number; radius: number; bottom: number }
export interface DockWeedSite { pole: string; x: number; y: number; z: number; height: number; rotation: number; variant: number; radius: number }

/** Match the wet faces of the existing rail posts and lighthouse landing piles. */
export function dockEcologyPoles(): DockPole[] {
  const poles: DockPole[] = [];
  for (const dock of cityDocks) {
    const stairEnd = dock.id === 'city' ? -60.7 : -23.2;
    const wetEnd = dock.id === 'city' ? dock.z + dock.length / 2 : dock.z - dock.length / 2;
    for (const side of [-1, 1]) for (const [index, z] of [stairEnd, wetEnd].entries()) {
      const x = dock.x + side * .59;
      // CityLife's post is tapered from .055 at the bottom to .035 above water.
      const bottom = Math.min(terrainHeight(x, z), .1);
      if (bottom < -.35) poles.push({ id: `${dock.id}-${side}-${index}`, x, z, radius: .048, bottom });
    }
  }
  for (const dx of [-.84, .84]) for (const dz of [-.87, .87]) {
    const x = LIGHTHOUSE_LANDING.x + dx, z = LIGHTHOUSE_LANDING.z + dz;
    poles.push({ id: `lighthouse-${dx}-${dz}`, x, z, radius: .095, bottom: terrainMeshHeight(x, z) - .25 });
  }
  return poles;
}

export function createDockWeedSites(poles = dockEcologyPoles()): DockWeedSite[] {
  const random = seededRandom(71826), sites: DockWeedSite[] = [];
  // Spiralling holdfasts occupy the full wet length rather than a tiny collar.
  for (const pole of poles) {
    const bottom = Math.max(pole.bottom + .10, -2.8), top = -.28;
    const rows = Math.max(3, Math.ceil((top-bottom)/.18));
    for (let row=0;row<rows;row++) for(let side=0;side<3;side++) {
      const y = bottom+(top-bottom)*row/rows;
      const height = Math.min(.36+random()*.48,-.15-y);
      if(height<.10)continue;
      const rotation = row*1.73+side*Math.PI*2/3+random()*.35;
      sites.push({pole:pole.id,x:pole.x+Math.sin(rotation)*pole.radius,y,
        z:pole.z+Math.cos(rotation)*pole.radius,height,rotation,variant:(row+side)%3,radius:pole.radius});
    }
  }
  return sites;
}

/** Local +Z points away from the timber face; every frond begins at the holdfast. */
export function createDockWeedGeometry(variant: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const color = new Color(['#577849', '#7b874a', '#748054'][variant]);
  for (let frond = 0; frond < (variant === 1 ? 7 : 5); frond++) {
    const start = positions.length / 3, side = frond - 1.2;
    for (let row = 0; row <= 3; row++) for (const rib of [-1, 0, 1]) {
      const t = row / 3, spread = t * t * (.17 + frond * .045);
      const breadth = Math.sin(Math.PI * t) * (variant === 1 ? .046 : .027) * (1 + .14 * Math.sin(t * 31 + frond));
      positions.push(side * .018 * t + rib * breadth, t + .035 * Math.sin(t * 5 + frond) * t,
        spread + (rib === 0 ? .009 * Math.sin(t * Math.PI) : 0));
      const shade = .72 + .22 * t + (rib === 0 ? .11 : 0);
      colors.push(color.r * shade, color.g * shade, color.b * shade);
      if (row && rib > -1) {
        const n = start + row * 3 + rib + 1;
        indices.push(n, n - 3, n - 1, n - 1, n - 3, n - 4);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function DockEcology() {
  const scene = useMemo(() => {
    const sites = createDockWeedSites(), transform = new Object3D();
    const batches = [0, 1, 2].map(variant => {
      const entries = sites.filter(site => site.variant === variant), geometry = createDockWeedGeometry(variant);
      const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .94, metalness: 0 });
      const mesh = new InstancedMesh(geometry, material, entries.length);
      mesh.name = `dock-pole-attached-algae-${variant}`; mesh.raycast = () => {};
      entries.forEach((site, index) => {
        transform.position.set(site.x, site.y, site.z);
        transform.rotation.set(0, site.rotation, 0);
        transform.scale.set(1, site.height, 1); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.computeBoundingSphere();
      return { mesh, geometry, material };
    });
    return { batches, timer: undefined as ReturnType<typeof setTimeout> | undefined };
  }, []);
  useEffect(() => {
    clearTimeout(scene.timer);
    return () => { scene.timer = setTimeout(() => scene.batches.forEach(batch => {
      batch.geometry.dispose(); batch.material.dispose(); batch.mesh.dispose();
    }), 0); };
  }, [scene]);
  return <group name="dock-ecology" dispose={null}>{scene.batches.map(batch => <primitive key={batch.mesh.name} object={batch.mesh} />)}</group>;
}
