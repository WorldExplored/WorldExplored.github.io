import { REEF_BASINS, reefFloorHeight } from './seafloor';
import { createCityFerryRoute } from './cityInfrastructure';
import { landDistance, seededRandom, terrainMeshHeight, ISLANDS, islandContour } from './terrain';

export interface ReefObstacle {
  x: number; y: number; z: number; radius: number; height: number;
  rotation: number; form: number; color: number; patch: number;
}
export interface ReefPlant extends ReefObstacle { width: number }
export interface ReefHabitatPlan {
  colonies: ReefObstacle[]; rocks: ReefObstacle[]; plants: ReefPlant[]; kelp: ReefPlant[];
}

export { REEF_BASINS, reefFloorHeight, reefFloorVertexHeight } from './seafloor';
export const KELP_POCKET = {x:-33,z:-30,rx:7.2,rz:5.8};
export const KELP_TOP = -2.45;

/** The island shelf is the visible upper surface until its existing mesh ends. */
export function marineFloorHeight(x:number,z:number){return landDistance(x,z)>=-6.5?terrainMeshHeight(x,z):reefFloorHeight(x,z);}

export function reefHabitatContains(x: number, z: number, margin = 0) {
  const inside = REEF_BASINS.some(basin => {
    const dx = x - basin.x, dz = z - basin.z;
    const angle = Math.atan2(dz / basin.rz, dx / basin.rx);
    const edge = 1 + .08 * Math.sin(angle * 3 + .7) + .035 * Math.cos(angle * 5);
    return Math.hypot(dx / (basin.rx - margin), dz / (basin.rz - margin)) < edge;
  });
  return inside && landDistance(x, z) < -4.8 - margin && reefFloorHeight(x, z) < -2.7;
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
  const colonies: ReefObstacle[] = [], rocks: ReefObstacle[] = [], plants: ReefPlant[] = [], kelp: ReefPlant[] = [];
  // Overlapping ridges form continuous reef walls around branching sand canyons.
  const ridges = [
    [[-26,-46],[-22,-43],[-18,-40],[-14,-38],[-11,-34]],
    [[-23,-53],[-18,-51],[-13,-49],[-8,-47],[-4,-43],[0,-41]],
    [[-5,-55],[0,-53],[6,-51],[11,-49],[15,-45],[18,-41],[23,-38]],
    [[-8,-36],[-3,-35],[2,-33],[7,-31]],
    [[3,-44],[7,-42],[10,-38],[13,-35],[17,-32]],
    [[20,-51],[23,-47],[25,-43]],
    // Branching limestone belts connect the lighthouse shelf to both island shores.
    [[-66,-48],[-61,-51],[-56,-54],[-50,-57],[-44,-57],[-38,-55],[-31,-53]],
    [[-66,-39],[-61,-41],[-55,-44],[-49,-46],[-43,-45],[-37,-44],[-31,-43]],
    [[-65,-29],[-60,-27],[-55,-25],[-50,-23],[-45,-20]],
    [[-56,-35],[-51,-34],[-46,-32],[-41,-29],[-37,-26]],
    [[-49,-52],[-47,-48],[-45,-43],[-42,-39],[-36,-37],[-30,-35]],
    [[-74,-49],[-69,-49],[-65,-47],[-61,-44]],
    [[-71,-23],[-66,-23],[-62,-26],[-61,-31],[-60,-36]],
  ];
  ridges.forEach((ridge, patch) => ridge.forEach(([cx, cz], segment) => {
    const form = (segment + patch) % 4;
    const radius = ([3.2,2.7,3.4,2.7][form] + random() * [1.3,1.1,1.2,1][form]) * (patch < 6 ? 1 : 1.32);
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
  // Talus gathers around ridge feet and in irregular shoal pockets across all islands.
  const mineralRandom=seededRandom(40291),ridgeHosts=rocks.slice();
  for(let i=0;i<350;i++)for(let attempt=0;attempt<28;attempt++){
    let x:number,z:number;
    if(i%3===0){
      const island=ISLANDS[i%ISLANDS.length],a=mineralRandom()*Math.PI*2,edge=islandContour(island,a),offset=4.4+mineralRandom()*3.1;
      x=island.x+Math.cos(a)*(island.rx*edge+offset);z=island.z+Math.sin(a)*(island.rz*edge+offset);
    }else{
      const host=ridgeHosts[Math.floor(mineralRandom()*ridgeHosts.length)],a=mineralRandom()*Math.PI*2,r=host.radius*(.8+mineralRandom()*.9);
      x=host.x+Math.cos(a)*r;z=host.z+Math.sin(a)*r;
    }
    const distance=landDistance(x,z);if(distance> -4.8||distance< -23)continue;
    const floor=marineFloorHeight(x,z),boulder=i%11===0;
    const radius=boulder?.65+mineralRandom()*.65:.17+Math.pow(mineralRandom(),1.6)*.52;
    const height=Math.min(boulder?.45+mineralRandom()*.60:.07+mineralRandom()*.20,-1.84-floor);
    if(height<.06||rocks.some(rock=>Math.hypot(x-rock.x,z-rock.z)<(rock.radius+radius)*.72))continue;
    rocks.push({x,z,y:floor-.055,radius,height,rotation:mineralRandom()*Math.PI*2,form:boulder?3:i%2?0:2,color:i%6,patch:200+i%ISLANDS.length});break;
  }
  // Sink every perimeter vertex into the sampled floor, extending the rock downward
  // instead of letting a flat base hover over the sloping canyon floor.
  for (const rock of rocks) {
    const { positions } = reefRockMesh(rock.form), c = Math.cos(rock.rotation), s = Math.sin(rock.rotation);
    let base = rock.y;
    for (let i = 0; i < positions.length; i += 3) if (positions[i + 1] === 0) {
      const x = rock.x + rock.radius * (c * positions[i] + s * positions[i + 2]);
      const z = rock.z + rock.radius * (-s * positions[i] + c * positions[i + 2]);
      base = Math.min(base, (rock.patch>=200 ? marineFloorHeight(x,z) : reefFloorHeight(x, z)) - .08);
    }
    rock.height += rock.y - base;
    rock.y = base;
  }
  for (const host of rocks) {
    if(host.patch>=200)continue;
    const count = Math.ceil(host.radius * host.radius * (host.patch < 6 ? 1.5 : .82));
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
  for (let i = 0; i < 1100; i++) for (let attempt = 0; attempt < 25; attempt++) {
    const host = ridgeHosts[Math.floor(random() * ridgeHosts.length)], a = random() * Math.PI * 2, r = host.radius * (.8 + random() * .75);
    const x = host.x + Math.cos(a) * r, z = host.z + Math.sin(a) * r;
    if (!reefHabitatContains(x, z, .25) || rocks.some(rock => reefRockSurfaceHeight(rock,x,z) > reefFloorHeight(x,z) + .15) || plants.some(plant => Math.hypot(x-plant.x,z-plant.z)<.23)) continue;
    const height = .3 + random() * .85, width = .36 + random() * .65;
    plants.push({ x, z, y: reefFloorHeight(x,z)-.035, radius:width*.55, height, width, rotation: random()*Math.PI*2, form:Math.floor(random()*3), color:0, patch:host.patch });
    break;
  }
  // Short grass fans colonize the open sand as asymmetric pockets, with sparse outliers.
  const meadows=REEF_BASINS.flatMap((basin,patch)=>Array.from({length:7},()=>({x:basin.x+(random()-.5)*basin.rx*1.45,z:basin.z+(random()-.5)*basin.rz*1.4,radius:1.4+random()*2.6,patch})));
  for(let i=0;i<600;i++)for(let attempt=0;attempt<35;attempt++){
    const meadow=meadows[i%meadows.length],angle=random()*Math.PI*2,radius=Math.pow(random(),.7)*meadow.radius*(i%7===0?2.4:1);
    const x=meadow.x+Math.cos(angle)*radius,z=meadow.z+Math.sin(angle)*radius;
    if(!reefHabitatContains(x,z,.35))continue;
    const floor=reefFloorHeight(x,z),width=.32+random()*.45;
    if(rocks.some(rock=>Math.hypot(x-rock.x,z-rock.z)<rock.radius+width*.3&&reefRockSurfaceHeight(rock,x,z)>floor+.1)||colonies.some(coral=>Math.hypot(x-coral.x,z-coral.z)<coral.radius+width*.35)||plants.some(plant=>Math.hypot(x-plant.x,z-plant.z)<.22))continue;
    plants.push({x,z,y:floor-.035,radius:width*.55,height:.20+random()*.45,width,rotation:random()*Math.PI*2,form:i%2,color:0,patch:100+meadow.patch});break;
  }
  const forestRandom=seededRandom(56903);
  const groves=Array.from({length:7},()=>({x:KELP_POCKET.x+(forestRandom()-.5)*KELP_POCKET.rx*1.1,z:KELP_POCKET.z+(forestRandom()-.5)*KELP_POCKET.rz*1.1}));
  for(let i=0;i<170;i++)for(let attempt=0;attempt<70;attempt++){
    const grove=groves[i%groves.length],a=forestRandom()*Math.PI*2,r=Math.pow(forestRandom(),.65)*3.2;
    const x=grove.x+Math.cos(a)*r,z=grove.z+Math.sin(a)*r;
    if(Math.hypot((x-KELP_POCKET.x)/KELP_POCKET.rx,(z-KELP_POCKET.z)/KELP_POCKET.rz)>1||!reefHabitatContains(x,z,.4))continue;
    const y=reefFloorHeight(x,z)-.025,width=.74+forestRandom()*.55,height=Math.min(3+forestRandom()*2.7,KELP_TOP-y);
    if(height<2.7||rocks.some(rock=>Math.hypot(x-rock.x,z-rock.z)<rock.radius+.25&&reefRockSurfaceHeight(rock,x,z)>y+.14)||kelp.some(plant=>Math.hypot(x-plant.x,z-plant.z)<.47))continue;
    kelp.push({x,y,z,width,height,radius:width*.5,rotation:forestRandom()*Math.PI*2,form:i%2,color:i%5,patch:i%groves.length});break;
  }
  // Prefix-based quality tiers retain growth across every ridge, not just the first few.
  for (const entries of [colonies, plants]) for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  cached = { colonies, rocks, plants, kelp }; return cached;
}
