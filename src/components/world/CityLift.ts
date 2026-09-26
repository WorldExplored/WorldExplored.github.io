import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityLiftPlan } from './CityArchitecture';
import { applyBakedRoomLighting, applyNightSource } from './RoomLighting';

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
  const metal = new MeshPhysicalMaterial({ color: '#244f64', roughness: .45, metalness: .55 });
  const stone = applyBakedRoomLighting(new MeshPhysicalMaterial({ color: '#83c2c6', roughness: .78 }));
  const glass = new MeshPhysicalMaterial({ color: '#19aebf', transparent: true, opacity: .17, depthWrite: false, roughness: .15 });
  const bars = [];
  for (const x of [-.33, .33]) for (const z of [-.34, .34]) bars.push(new BoxGeometry(.035, 1.24, .035).translate(x, .62, z));
  bars.push(new BoxGeometry(.72, .05, .76).translate(0, -.085, 0));
  bars.push(new BoxGeometry(.72, .07, .76).translate(0, 1.24, 0));
  for (const side of [-1, 1]) bars.push(new BoxGeometry(.04, .04, .65).translate(side * .3, .69, 0));
  const structure = mergeGeometries(bars)!; bars.forEach(part => part.dispose());
  const frame = new Mesh(structure, metal); frame.castShadow = true; cabin.add(frame);
  const diffuserMaterial = applyNightSource(new MeshPhysicalMaterial({ color: '#e7f7ee', roughness: .42 }), 1.15);
  const diffuser = new Mesh(new BoxGeometry(.42, .018, .28).translate(0, 1.196, 0), diffuserMaterial);
  diffuser.name = 'lift-ceiling-diffuser'; cabin.add(diffuser);
  const floor = new Mesh(new BoxGeometry(.65, .06, .67).translate(0, -.03, 0), stone); floor.name='lift-finished-floor'; cabin.add(floor);
  const panes = [-1, 1].map(side => new BoxGeometry(.015, 1.12, .65).translate(side * .32, .63, 0));
  panes.push(new BoxGeometry(.65, 1.12, .015).translate(0, .63, -.33));
  const paneGeometry = mergeGeometries(panes)!; panes.forEach(part => part.dispose()); cabin.add(new Mesh(paneGeometry, glass));
  const doorGeometry = new BoxGeometry(.30, 1.1, .018);
  const handleGeometry = new BoxGeometry(.018, .16, .035);
  const doors = [-1, 1].map(side => {
    const pivot = new Group(); pivot.position.set(side*.30,.63,.345);
    const door = new Mesh(doorGeometry, glass); door.position.x=-side*.15;
    const handle=new Mesh(handleGeometry,metal);handle.position.set(-side*.245,0,.035);
    pivot.add(door,handle);cabin.add(pivot);return pivot;
  });
  let previouslyOpen=false;
  return { cabin, update(time: number) {
    const pose = cityLiftPose(plan.floors, time); cabin.position.set(plan.x, pose.floor, plan.z);
    doors.forEach((door,index)=>{door.rotation.y=(index?1:-1)*pose.open*Math.PI/2;});
    const open=pose.open>.5,arrived=open && !previouslyOpen;previouslyOpen=open;return {arrived};
  }, dispose() { structure.dispose(); floor.geometry.dispose(); paneGeometry.dispose(); doorGeometry.dispose(); handleGeometry.dispose(); metal.dispose(); stone.dispose(); glass.dispose(); diffuser.geometry.dispose(); diffuserMaterial.dispose(); } };
}
