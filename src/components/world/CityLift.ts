import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityLiftPlan } from './CityArchitecture';

export function cityLiftPose(floors: readonly number[], elapsed: number) {
  if (floors.length < 2) return { floor: floors[0] ?? 0, open: 1 };
  const stops = [...floors, ...floors.slice(1, -1).reverse()];
  const phase = Math.max(0, elapsed) % (stops.length * 8), index = Math.floor(phase / 8), within = phase % 8;
  const t = Math.max(0, Math.min(1, (within - 3) / 5));
  const smooth = t * t * t * (t * (t * 6 - 15) + 10);
  return { floor: Math.max(floors[0], Math.min(floors[floors.length - 1], stops[index] + (stops[(index + 1) % stops.length] - stops[index]) * smooth)), open: within < 2 ? Math.min(1, within * 3) : Math.max(0, 3 - within) };
}

export function createCityLift(plan: CityLiftPlan) {
  const cabin = new Group(); cabin.name = `${plan.building}-lift-cabin`;
  const metal = new MeshPhysicalMaterial({ color: '#426e72', roughness: .45, metalness: .55 });
  const stone = new MeshPhysicalMaterial({ color: '#d6cfb4', roughness: .78 });
  const glass = new MeshPhysicalMaterial({ color: '#81cbd2', transparent: true, opacity: .17, depthWrite: false, roughness: .15 });
  const bars = [];
  for (const x of [-.33, .33]) for (const z of [-.34, .34]) bars.push(new BoxGeometry(.035, 1.24, .035).translate(x, .62, z));
  for (const y of [-.035, 1.24]) bars.push(new BoxGeometry(.72, .07, .76).translate(0, y, 0));
  for (const side of [-1, 1]) bars.push(new BoxGeometry(.04, .04, .65).translate(side * .3, .69, 0));
  const structure = mergeGeometries(bars)!; bars.forEach(part => part.dispose());
  const frame = new Mesh(structure, metal); frame.castShadow = true; cabin.add(frame);
  const floor = new Mesh(new BoxGeometry(.65, .06, .67).translate(0, -.03, 0), stone); floor.name='lift-finished-floor'; cabin.add(floor);
  const panes = [-1, 1].map(side => new BoxGeometry(.015, 1.12, .65).translate(side * .32, .63, 0));
  panes.push(new BoxGeometry(.65, 1.12, .015).translate(0, .63, -.33));
  const paneGeometry = mergeGeometries(panes)!; panes.forEach(part => part.dispose()); cabin.add(new Mesh(paneGeometry, glass));
  const doorGeometry = new BoxGeometry(.30, 1.1, .018);
  const doors = [-1, 1].map(side => { const door = new Mesh(doorGeometry, glass); door.position.set(side * .15, .63, .345); cabin.add(door); return door; });
  return { cabin, update(time: number) {
    const pose = cityLiftPose(plan.floors, time); cabin.position.set(plan.x, pose.floor, plan.z);
    doors.forEach((door, index) => { door.position.x = (index ? 1 : -1) * (.15 + pose.open * .13); });
  }, dispose() { structure.dispose(); floor.geometry.dispose(); paneGeometry.dispose(); doorGeometry.dispose(); metal.dispose(); stone.dispose(); glass.dispose(); } };
}
