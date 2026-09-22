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

/** This floor extends under the island shelves, whose mesh stops 6.5 m offshore. */
export function reefFloorHeight(x: number, z: number) {
  const distance = landDistance(x, z);
  const waves = .16 * Math.sin(x * .31 + z * .17) + .09 * Math.cos(z * .43 - x * .13);
  const ripples = .026 * Math.sin(z * 5 + Math.sin(x * .41) * 2);
  return terrainBaseHeight(x, z) - .18 + smooth(6.9, 9, -distance) * (waves + ripples);
}

/** Broad connected channel habitat, with a naturally uneven outer edge. */
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

let cached: ReefHabitatPlan | undefined;
export function getReefHabitat(): ReefHabitatPlan {
  if (cached) return cached;
  const random = seededRandom(894121);
  const colonies: ReefObstacle[] = [], rocks: ReefObstacle[] = [], plants: ReefPlant[] = [];
  // Asymmetric outcrops leave branching sandy channels; no regular rows or individual ball pedestals.
  const patches = [
    [-26,-43,4.5], [-23,-31,3.4], [-25,-52,3.8], [-3,-53,4.5], [7,-52,4.7],
    [18,-50,4.2], [23,-40,4], [16,-33,4.3], [5,-31,3.6], [-1,-40,4.2], [9,-42,5.2],
  ];
  const sample = (patch: number, radius: number) => {
    const [cx, cz] = patches[patch], a = random() * Math.PI * 2, r = Math.sqrt(random()) * radius;
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
  };
  const available = (x: number, z: number, radius: number) => reefHabitatContains(x, z, radius)
    && reefFerryClearance(x, z) > 3.6 + radius;
  for (let round = 0; round < 9; round++) for (let patch = 0; patch < patches.length; patch++) {
    for (let attempt = 0; attempt < 70; attempt++) {
      const { x, z } = sample(patch, patches[patch][2]);
      const radius = .46 + random() * .8, height = .24 + random() * .55;
      if (!available(x, z, radius) || rocks.some(rock => Math.hypot(x-rock.x,z-rock.z) < (radius+rock.radius)*.7)) continue;
      rocks.push({ x, z, y: reefFloorHeight(x,z)-.06, radius, height, rotation: random()*Math.PI*2, form: (round+patch)%4, color: patch%3, patch });
      break;
    }
  }
  for (let round = 0; round < 25; round++) for (let patch = 0; patch < patches.length; patch++) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const { x, z } = sample(patch, patches[patch][2]*1.17), form = (round + patch * 3) % 5;
      const height = .42 + random()*.69, radius = form === 1 ? height*.79 : form === 2 ? height*.69 : height*.54;
      if (!available(x,z,radius) || colonies.some(coral => Math.hypot(x-coral.x,z-coral.z)<radius+coral.radius+.15)
        || rocks.some(rock => Math.hypot(x-rock.x,z-rock.z)<radius+rock.radius*.78)) continue;
      const y = reefFloorHeight(x,z)-.025;
      if (y + height > -1.8) continue;
      colonies.push({ x, z, y, radius, height, rotation: random()*Math.PI*2, form, color: (patch*2+(random()>.74?1:0))%8, patch });
      break;
    }
  }
  for (let round = 0; round < 39; round++) for (let patch = 0; patch < patches.length; patch++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const { x, z } = sample(patch, patches[patch][2]*1.5), height = .35+random()*.83, width=.52+random()*.4;
      if (!reefHabitatContains(x,z,.3) || reefFerryClearance(x,z)<2.7
        || colonies.some(coral => Math.hypot(x-coral.x,z-coral.z)<coral.radius+.3)
        || rocks.some(rock => Math.hypot(x-rock.x,z-rock.z)<rock.radius+.15)
        || plants.some(plant => Math.hypot(x-plant.x,z-plant.z)<.36)) continue;
      plants.push({x,z,y:reefFloorHeight(x,z)-.025,radius:.3,height,width,rotation:random()*Math.PI*2,form:round%3,color:0,patch});
      break;
    }
  }
  cached = { colonies, rocks, plants }; return cached;
}
