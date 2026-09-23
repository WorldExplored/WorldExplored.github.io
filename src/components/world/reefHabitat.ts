import { createCityFerryRoute } from './cityInfrastructure';
import { landDistance, seededRandom, smooth, terrainBaseHeight } from './terrain';

export interface ReefObstacle {
  x: number; y: number; z: number; radius: number; height: number;
  rotation: number; form: number; color: number; patch: number;
}
export interface ReefPlant extends ReefObstacle { width: number }
export interface ReefHabitatPlan {
  colonies: ReefObstacle[]; rocks: ReefObstacle[]; plants: ReefPlant[];
}

/** The deep sand basin exposes substantial ridge faces without crowding the surface traffic. */
export function reefFloorHeight(x: number, z: number) {
  const distance = landDistance(x, z);
  const waves = .16 * Math.sin(x * .31 + z * .17) + .09 * Math.cos(z * .43 - x * .13);
  const ripples = .026 * Math.sin(z * 5 + Math.sin(x * .41) * 2);
  const basin = (1 - smooth(.65, 1.35, Math.hypot((x + 2) / 34, (z + 42) / 24))) * smooth(7, 12, -distance);
  return terrainBaseHeight(x, z) - .18 + smooth(6.9, 9, -distance) * (waves + ripples) - basin * 1.9;
}

export function reefHabitatContains(x: number, z: number, margin = 0) {
  const dx = x + 2, dz = z + 42;
  const angle = Math.atan2(dz / 19, dx / 29);
  const edge = 1 + .08 * Math.sin(angle * 3 + .7) + .035 * Math.cos(angle * 5);
  return Math.hypot(dx / (29 - margin), dz / (19 - margin)) < edge
    && landDistance(x, z) < -4.8 - margin && reefFloorHeight(x, z) < -2.7;
}

const ferry = createCityFerryRoute();
const ferryPoints = Array.from({ length: 240 }, (_, i) => ferry.curve.getPointAt(i / 240));
export function reefFerryClearance(x: number, z: number) {
  let distance = Infinity;
  for (const point of ferryPoints) distance = Math.min(distance, Math.hypot(point.x - x, point.z - z));
  return distance;
}

const rockMeshes = new Map<number, { positions: number[]; indices: number[] }>();
/** Terraces, steep ledges and broken angular crowns; the same mesh seats coral growth. */
export function reefRockMesh(form: number) {
  const cached = rockMeshes.get(form); if (cached) return cached;
  // Each profile is a distinct geological silhouette, not a phase-shifted cone.
  const profiles = [
    { rings: [.22,.57,.70,.73,.87,.90,1], heights: [.98,.97,.94,.55,.53,.18,0], center: .98, width: .88 },
    { rings: [.18,.34,.48,.58,.72,.86,1], heights: [.75,1,.90,.77,.44,.26,0], center: .29, width: .83 },
    { rings: [.22,.49,.68,.74,.88,.93,1], heights: [.99,.90,.80,.61,.43,.22,0], center: 1, width: .43 },
    { rings: [.15,.29,.38,.51,.60,.79,1], heights: [1,.86,.93,.60,.66,.24,0], center: .66, width: .77 },
  ];
  const { rings, heights, center, width } = profiles[form];
  const positions: number[] = [0, center, 0], indices: number[] = [], sides = 20;
  for (let ring = 0; ring < rings.length; ring++) for (let side = 0; side < sides; side++) {
    const a = side / sides * Math.PI * 2;
    const angular = .84 + .09 * Math.sin(a * 3 + form * 1.2) + .07 * Math.cos(a * 5 - form);
    const r = rings[ring] * angular;
    let y = heights[ring];
    if (form === 0) y *= .98 + .02 * Math.cos(a * 3);
    // The transverse fracture creates two unequal crags and a deep central saddle.
    if (form === 1) y *= .29 + .69 * Math.pow(Math.abs(Math.cos(a)), .36) + .02 * Math.sin(a);
    if (form === 2) y *= .86 + .13 * Math.cos(a) + .01 * Math.cos(a * 4);
    if (form === 3) y *= .56 + .42 * Math.pow(.5 + .5 * Math.cos(a * 3 + .45), 3) + .02 * Math.sin(a * 7);
    const shift = form === 1 ? .085 * y : form === 3 ? -.06 * y : 0;
    const x = Math.cos(a) * r + shift, z = Math.sin(a) * r * width;
    positions.push(x, Math.max(0, Math.min(1,y)), z);
    const i = 1 + ring * sides + side, next = 1 + ring * sides + (side + 1) % sides;
    if (!ring) indices.push(0, next, i);
    else { const previous = i - sides, previousNext = next - sides; indices.push(previous, next, i, previous, previousNext, next); }
  }
  const result = { positions, indices }; rockMeshes.set(form, result); return result;
}

/** Barycentric sampling places every colony on the actual rock triangles, including tilted ledges. */
export function reefRockSurfaceHeight(rock: ReefObstacle, x: number, z: number) {
  const dx = (x - rock.x) / rock.radius, dz = (z - rock.z) / rock.radius;
  const c = Math.cos(rock.rotation), s = Math.sin(rock.rotation), px = c * dx - s * dz, pz = s * dx + c * dz;
  const { positions: p, indices } = reefRockMesh(rock.form);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, d = indices[i + 2] * 3;
    const denom = (p[b + 2] - p[d + 2]) * (p[a] - p[d]) + (p[d] - p[b]) * (p[a + 2] - p[d + 2]);
    const u = ((p[b + 2] - p[d + 2]) * (px - p[d]) + (p[d] - p[b]) * (pz - p[d + 2])) / denom;
    const v = ((p[d + 2] - p[a + 2]) * (px - p[d]) + (p[a] - p[d]) * (pz - p[d + 2])) / denom;
    if (u >= -.00001 && v >= -.00001 && u + v <= 1.00001) return rock.y + (u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[d + 1]) * rock.height;
  }
  return -Infinity;
}

let cached: ReefHabitatPlan | undefined;
export function getReefHabitat(): ReefHabitatPlan {
  if (cached) return cached;
  const random = seededRandom(894125);
  const colonies: ReefObstacle[] = [], rocks: ReefObstacle[] = [], plants: ReefPlant[] = [];
  // Overlapping ridges form continuous reef walls around branching sand canyons.
  const ridges = [
    [[-26,-46],[-22,-43],[-18,-40],[-14,-38],[-11,-34]],
    [[-23,-53],[-18,-51],[-13,-49],[-8,-47],[-4,-43],[0,-41]],
    [[-5,-55],[0,-53],[6,-51],[11,-49],[15,-45],[18,-41],[23,-38]],
    [[-8,-36],[-3,-35],[2,-33],[7,-31]],
    [[3,-44],[7,-42],[10,-38],[13,-35],[17,-32]],
    [[20,-51],[23,-47],[25,-43]],
  ];
  ridges.forEach((ridge, patch) => ridge.forEach(([cx, cz], segment) => {
    const form = (segment + patch) % 4;
    const radius = [3.2,2.7,3.4,2.7][form] + random() * [1.3,1.1,1.2,1][form];
    if (!reefHabitatContains(cx, cz, radius * .6)) return;
    const y = reefFloorHeight(cx, cz) - .24;
    const height = Math.min([1.3,2.6,1.0,3.1][form] + random() * [1.0,1.7,.9,1.5][form], -2.85 - y);
    const direction = ridge[Math.min(segment + 1,ridge.length - 1)], previous = ridge[Math.max(0,segment - 1)];
    const rotation = -Math.atan2(direction[1]-previous[1],direction[0]-previous[0]) + (random()-.5)*.8;
    rocks.push({ x: cx, z: cz, y, radius, height, rotation, form, color: 0, patch });
    // Smaller tilted buttresses continue the ridge into sand without identical beads.
    for (let j = 0; j < 2; j++) {
      const a = random() * Math.PI * 2, r = radius * (.65 + random() * .24), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const small = .85 + random() * 1.3;
      if (!reefHabitatContains(x, z, small * .6)) continue;
      const floor = reefFloorHeight(x, z) - .14;
      rocks.push({ x, z, y: floor, radius: small, height: Math.min(.55 + random() * 1.2, -3 - floor), rotation: random() * Math.PI * 2, form: Math.floor(random() * 4), color: 0, patch });
    }
  }));
  for (const host of rocks) {
    const count = Math.ceil(host.radius * host.radius * 1.5);
    for (let n = 0; n < count; n++) for (let attempt = 0; attempt < 35; attempt++) {
      const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * host.radius * .9;
      const x = host.x + Math.cos(angle) * distance, z = host.z + Math.sin(angle) * distance;
      let y = -Infinity;
      for (const rock of rocks) if (Math.hypot(x - rock.x, z - rock.z) < rock.radius) y = Math.max(y, reefRockSurfaceHeight(rock, x, z));
      if (!Number.isFinite(y)) continue;
      const form = Math.floor(random() * 8), encrusting = form === 5 || form === 7;
      const radius = encrusting ? .34 + random() * .58 : .19 + random() * .42;
      const height = encrusting ? .13 + random() * .25 : .28 + random() * .75;
      if (y + height > -1.82 || colonies.some(coral => Math.hypot(x - coral.x, z - coral.z) < (radius + coral.radius) * .68 && Math.abs(y - coral.y) < .5)) continue;
      colonies.push({ x, z, y: y - .055, radius, height, rotation: random() * Math.PI * 2, form, color: Math.floor(random() * 10), patch: host.patch });
      break;
    }
  }
  // Dense irregular meadows occupy canyon edges, with open sand through the middle.
  for (let i = 0; i < 600; i++) for (let attempt = 0; attempt < 25; attempt++) {
    const host = rocks[Math.floor(random() * rocks.length)], a = random() * Math.PI * 2, r = host.radius * (.8 + random() * .75);
    const x = host.x + Math.cos(a) * r, z = host.z + Math.sin(a) * r;
    if (!reefHabitatContains(x, z, .25) || rocks.some(rock => reefRockSurfaceHeight(rock,x,z) > reefFloorHeight(x,z) + .15) || plants.some(plant => Math.hypot(x-plant.x,z-plant.z)<.23)) continue;
    const height = .3 + random() * .85, width = .36 + random() * .65;
    plants.push({ x, z, y: reefFloorHeight(x,z)-.035, radius:width*.55, height, width, rotation: random()*Math.PI*2, form:Math.floor(random()*3), color:0, patch:host.patch });
    break;
  }
  // Prefix-based quality tiers retain growth across every ridge, not just the first few.
  for (const entries of [colonies, plants]) for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  cached = { colonies, rocks, plants }; return cached;
}
