'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Group, MathUtils, Vector3, type BufferGeometry } from 'three';
import { combine, roundedBox, usePalette, useResources, type ModelProps } from './BuildingKit';
import { createLandscapePlan, distanceToSegment, terrainMeshHeight, type LandscapePlan, type PathPoint } from './terrain';

export const ROVER_SPEED = .45;
export const ROVER_ACCELERATION = .24;
export const ROVER_TURN_SPEED = .85;
export const ROVER_HALF_WIDTH = .34;
export const ROVER_HALF_LENGTH = .47;
const WHEEL_RADIUS = .13;
const PATH_TOP = .055;
const ignoreRaycast = () => {};
export type RoverMode = 'Idle' | 'Travel' | 'Tend' | 'Return';
export interface RoverRoute { points: PathPoint[]; distances: number[]; length: number; width: number }
export interface RoverState { mode: RoverMode; elapsed: number; distance: number; speed: number; heading: number; wheelAngle: number; charge: number; cycles: number; turning: boolean; position: Vector3 }

export function createRoverRoute(plan = createLandscapePlan()): RoverRoute {
  const path = plan.paths.find(candidate => candidate.id === 'garden-spine');
  if (!path) throw new Error('The garden service path is missing.');
  const points = path.points.filter(point => point.x >= -3 && point.x <= 7).map(point => ({ ...point }));
  if (points.length < 2) throw new Error('The garden service path is too short.');
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const route = { points, distances, length: distances[distances.length - 1], width: path.width };
  // Reserve the complete swept body, including the endpoint turning circles.
  for (let distance = 0; distance <= route.length; distance += .1) {
    const point = sampleRoverRoute(route, distance);
    if (!roverClearance(point.x, point.z, plan)) throw new Error('The garden service path is obstructed.');
  }
  return route;
}

export function sampleRoverRoute(route: RoverRoute, distance: number, target = new Vector3()) {
  const value = MathUtils.clamp(distance, 0, route.length);
  let end = 1;
  while (end < route.distances.length - 1 && route.distances[end] < value) end++;
  const a = route.points[end - 1], b = route.points[end];
  const t = (value - route.distances[end - 1]) / (route.distances[end] - route.distances[end - 1]);
  const x = MathUtils.lerp(a.x, b.x, t), z = MathUtils.lerp(a.z, b.z, t);
  return target.set(x, terrainMeshHeight(x, z) + PATH_TOP, z);
}

export function roverClearance(x: number, z: number, plan: LandscapePlan) {
  const reach = Math.hypot(ROVER_HALF_WIDTH, ROVER_HALF_LENGTH);
  for (const item of [...plan.structures, ...plan.trees, ...plan.rocks]) if (Math.hypot(x - item.x, z - item.z) < item.radius + reach + .12) return false;
  for (const bridge of plan.paths.filter(path => path.bridge)) for (let i = 1; i < bridge.points.length; i++) if (distanceToSegment(x, z, bridge.points[i - 1], bridge.points[i]) < bridge.width / 2 + reach + .12) return false;
  const centre = terrainMeshHeight(x, z);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    if (Math.abs(terrainMeshHeight(x + Math.cos(angle) * reach, z + Math.sin(angle) * reach) - centre) > .18) return false;
  }
  return true;
}

function routeHeading(route: RoverRoute, distance: number) {
  const before = sampleRoverRoute(route, distance - .3), after = sampleRoverRoute(route, distance + .3);
  return Math.atan2(after.x - before.x, after.z - before.z);
}
const angleDifference = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

export function createRoverState(route: RoverRoute): RoverState {
  return { mode: 'Idle', elapsed: 0, distance: 0, speed: 0, heading: routeHeading(route, 0) + Math.PI, wheelAngle: 0, charge: 1, cycles: 0, turning: true, position: sampleRoverRoute(route, 0) };
}

export function stepRover(state: RoverState, route: RoverRoute, delta: number, paused = false) {
  if (paused) return;
  const dt = Math.min(.05, Math.max(0, delta));
  state.elapsed += dt;
  if (state.mode === 'Idle') {
    state.charge = MathUtils.damp(state.charge, state.elapsed < 5 ? 1 : 0, 8, dt);
    if (state.elapsed >= 7) { state.mode = 'Travel'; state.elapsed = 0; state.charge = 0; state.turning = true; }
    return;
  }
  if (state.mode === 'Tend') {
    if (state.elapsed >= 6) { state.mode = 'Return'; state.elapsed = 0; state.turning = true; }
    return;
  }
  const direction = state.mode === 'Travel' ? 1 : -1;
  const heading = routeHeading(route, state.distance) + (direction < 0 ? Math.PI : 0);
  const error = angleDifference(heading, state.heading);
  state.heading += MathUtils.clamp(error, -ROVER_TURN_SPEED * dt, ROVER_TURN_SPEED * dt);
  if (state.turning) {
    if (Math.abs(error) < 1e-5) state.turning = false;
    return;
  }
  const remaining = direction > 0 ? route.length - state.distance : state.distance;
  const brakingSpeed = Math.sqrt(ROVER_ACCELERATION ** 2 * dt ** 2 + 2 * ROVER_ACCELERATION * remaining) - ROVER_ACCELERATION * dt;
  const targetSpeed = Math.abs(error) > .12 ? 0 : Math.min(ROVER_SPEED, brakingSpeed);
  state.speed += MathUtils.clamp(targetSpeed - state.speed, -ROVER_ACCELERATION * dt, ROVER_ACCELERATION * dt);
  const travel = Math.min(remaining, state.speed * dt);
  state.distance += travel * direction;
  state.wheelAngle += travel / WHEEL_RADIUS;
  sampleRoverRoute(route, state.distance, state.position);
  if (remaining < 1e-7 && state.speed < 1e-7) {
    state.distance = direction > 0 ? route.length : 0;
    sampleRoverRoute(route, state.distance, state.position);
    state.speed = 0; state.elapsed = 0;
    state.mode = direction > 0 ? 'Tend' : 'Idle';
    if (direction < 0) state.cycles++;
  }
}

export function roverWheelPosition(state: RoverState, x: number, z: number, target = new Vector3()) {
  const wx = state.position.x + x * Math.cos(state.heading) + z * Math.sin(state.heading);
  const wz = state.position.z - x * Math.sin(state.heading) + z * Math.cos(state.heading);
  return target.set(wx, terrainMeshHeight(wx, wz) + PATH_TOP + WHEEL_RADIUS, wz);
}

const wheelSites = [[-.29, -.24], [.29, -.24], [-.29, .24], [.29, .24]] as const;

export function GardenRover(props: ModelProps) {
  const [route] = useState(createRoverRoute);
  const [state] = useState(() => createRoverState(route));
  const material = usePalette(props, 'about');
  const vehicle = useRef<Group>(null), chassis = useRef<Group>(null), chargeArm = useRef<Group>(null), nozzle = useRef<Group>(null), wheels = useRef<(Group | null)[]>([]);
  const [home] = useState(() => {
    const heading = routeHeading(route, 0), point = sampleRoverRoute(route, 0);
    return { point, heading, post: new Vector3(point.x - Math.sin(heading) * .79, 0, point.z - Math.cos(heading) * .79) };
  });
  const geometry = useResources(() => {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z);
    const trim: BufferGeometry[] = [roundedBox(.55, .07, .73, .035).translate(0, .23, 0), box(.28, .04, .06, 0, .33, .38), box(.055, .10, .055, .17, .37, .33)];
    const roof: BufferGeometry[] = [box(.44, .045, .48, 0, .53, -.03)];
    for (const x of [-.14, 0, .14]) trim.push(box(.008, .006, .46, x, .556, -.03));
    for (const z of [-.18, -.03, .12]) trim.push(box(.43, .006, .008, 0, .556, z));
    roof.push(box(.11, .045, .06, -.16, .37, .335), box(.11, .045, .06, .16, .37, .335));
    return {
      body: roundedBox(.54, .28, .65, .07).translate(0, .36, 0),
      trim: combine(trim), roof: combine(roof),
      wheel: new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, .09, 16).rotateZ(Math.PI / 2),
      hub: new CylinderGeometry(.065, .065, .096, 12).rotateZ(Math.PI / 2),
      nozzle: new CylinderGeometry(.025, .025, .14, 8).rotateX(Math.PI / 2).translate(0, 0, .07),
      dock: combine([box(.64, .035, .58, 0, -.02, 0), box(.045, .025, .55, -.29, .01, 0), box(.045, .025, .55, .29, .01, 0)]),
      post: combine([roundedBox(.2, .39, .18, .035).translate(0, .195, 0), box(.26, .04, .26, 0, .01, 0)]),
      arm: box(.10, .07, .43, 0, .355, .215),
      status: box(.09, .035, .012, 0, .32, .096),
    };
  });
  useFrame((_, delta) => {
    stepRover(state, route, delta, props.paused);
    if (!vehicle.current) return;
    vehicle.current.position.copy(state.position); vehicle.current.rotation.y = state.heading;
    let front = 0, back = 0, left = 0, right = 0;
    wheelSites.forEach(([x, z], index) => {
      const contact = roverWheelPosition(state, x, z);
      const wheel = wheels.current[index];
      if (wheel) { wheel.position.set(x, contact.y - state.position.y, z); wheel.rotation.x = state.wheelAngle; }
      if (z > 0) front += contact.y; else back += contact.y;
      if (x > 0) right += contact.y; else left += contact.y;
    });
    if (chassis.current) { chassis.current.rotation.x = -Math.atan2((front - back) / 2, .48); chassis.current.rotation.z = Math.atan2((right - left) / 2, .58); }
    if (nozzle.current) nozzle.current.rotation.x = state.mode === 'Tend' ? .5 * Math.sin(Math.PI * Math.min(1, state.elapsed / 6)) : 0;
    if (chargeArm.current) chargeArm.current.scale.z = Math.max(.01, state.charge);
  });
  const postY = terrainMeshHeight(home.post.x, home.post.z) + PATH_TOP;
  return <group name="garden-service-rover" dispose={null}>
    <group name="garden-rover-dock" position={home.point.toArray()} rotation-y={home.heading}>
      <mesh geometry={geometry.dock} material={material.edge} receiveShadow raycast={ignoreRaycast} />
    </group>
    <group name="garden-rover-charge-post" position={[home.post.x, postY, home.post.z]} rotation-y={home.heading}>
      <mesh geometry={geometry.post} material={material.porcelain} castShadow raycast={ignoreRaycast} />
      <mesh geometry={geometry.status} material={material.cyan} raycast={ignoreRaycast} />
      <group name="garden-rover-charge-arm" ref={chargeArm} position-y={home.point.y - postY}>
        <mesh geometry={geometry.arm} material={material.cyan} raycast={ignoreRaycast} />
      </group>
    </group>
    <group name="garden-rover-vehicle" ref={vehicle} position={state.position.toArray()} rotation-y={state.heading}>
      <group name="garden-rover-chassis" ref={chassis}>
        <mesh geometry={geometry.body} material={material.porcelain} castShadow raycast={ignoreRaycast} />
        <mesh geometry={geometry.trim} material={material.facade} castShadow raycast={ignoreRaycast} />
        <mesh geometry={geometry.roof} material={material.navy} raycast={ignoreRaycast} />
        <group ref={nozzle} position={[.17, .32, .32]}><mesh geometry={geometry.nozzle} material={material.edge} raycast={ignoreRaycast} /></group>
      </group>
      {wheelSites.map(([x, z], index) => <group key={index} ref={node => { wheels.current[index] = node; }} position={[x, WHEEL_RADIUS, z]}>
        <mesh name={`garden-rover-wheel-${index}`} geometry={geometry.wheel} material={material.black} castShadow raycast={ignoreRaycast} />
        <mesh geometry={geometry.hub} material={material.edge} raycast={ignoreRaycast} />
      </group>)}
    </group>
  </group>;
}
