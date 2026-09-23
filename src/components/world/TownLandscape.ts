import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { circulationPaths } from './circulation';
import { cityEdgeClear } from './CityPathEdges';
import { groundRouteAt, terrainMeshHeight, type LandscapePlan } from './terrain';

/** Catch basins follow the downhill curb, away from doors and street junctions. */
export function createTownDrainage(plan?: LandscapePlan) {
  const candidates: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  for (const path of circulationPaths().filter(path => path.id?.startsWith('town-') && path.id !== 'town-dock-walk')) {
    for (let i = 4; i < path.points.length - 4; i += 3) {
      const a = path.points[i - 1], b = path.points[i + 1], p = path.points[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < .001) continue;
      const nx = dz / length, nz = -dx / length;
      const side = terrainMeshHeight(p.x + nx * path.width, p.z + nz * path.width) < terrainMeshHeight(p.x - nx * path.width, p.z - nz * path.width) ? 1 : -1;
      const offset = side * (path.width / 2 - .15), x = p.x + nx * offset, z = p.z + nz * offset;
      const edge = groundRouteAt(x, z).distance;
      if (edge < -.2 || edge > -.09 || !cityEdgeClear(x, z) || plan?.structures.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + .25)) continue;
      candidates.push({ x, z, y: terrainMeshHeight(x, z), yaw: Math.atan2(dx, dz) });
    }
  }
  // Lowest eligible points serve each stretch of street; no arbitrary grid decals.
  const sites: typeof candidates = [];
  for (const site of candidates.sort((a, b) => a.y - b.y)) {
    if (sites.every(other => Math.hypot(site.x - other.x, site.z - other.z) > 8)) sites.push(site);
  }
  return sites;
}

export function createTownLandscape(plan: LandscapePlan) {
  const root = new Group(); root.name = 'town-landscape-edging';
  const grates: BoxGeometry[] = [], basins: BoxGeometry[] = [];
  for (const { x, y, z, yaw } of createTownDrainage(plan)) {
    basins.push(new BoxGeometry(.24, .012, .44).rotateY(yaw).translate(x, y + .012, z));
    for (let slat = 0; slat < 7; slat++) grates.push(new BoxGeometry(.21, .014, .024).translate(0, 0, (slat - 3) * .058).rotateY(yaw).translate(x, y + .024, z));
  }
  const materials = [new MeshStandardMaterial({ color: '#49616a', roughness: .72, metalness: .45 }), new MeshStandardMaterial({ color: '#18323b', roughness: .95 })];
  const geometries = [grates, basins].map((parts, index) => {
    const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
    const mesh = new Mesh(geometry, materials[index]); mesh.name = ['town-flush-drainage-grates', 'town-drain-catch-basins'][index];
    mesh.receiveShadow = true; mesh.raycast = () => {}; root.add(mesh); return geometry;
  });
  return { root, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
