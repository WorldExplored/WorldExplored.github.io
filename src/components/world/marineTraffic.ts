import { CatmullRomCurve3, Vector3 } from 'three';
import { createCityFerryRoute, writeCityFerryPose } from './cityInfrastructure';
import { landDistance } from './terrain';

export interface MarineOccupant { position: Vector3; radius: number; heading?:number; hullHalfSpan?:number; hullRadius?:number }
export const surfaceAnimals: MarineOccupant[] = [];
export const vesselOccupants: MarineOccupant[] = [];
export const VISITOR_BERTH = new Vector3(-27, 0, -43);
export const VISITOR_DWELL = 32;
export const VESSEL_ACCELERATION = .42;
const points = [
  [[-54, -19], [-46, 18], [-20, 49], [23, 47], [49, 10], [51, -25], [22, -29], [-18, -29]],
  [[-76, -14], [-91, -20], [-97, -42], [-85, -60], [-66, -58], [-59, -38], [-65, -19]],
  [[-360, -53], [-130, -53], [-76, -65], [-48, -44], [-37, -43], [-27, -43], [-17, -43], [-3, -40], [37, -40], [100, -50], [360, -49]],
];

export function createVesselRoute(index: number) {
  const curve = new CatmullRomCurve3(points[index].map(([x, z]) => new Vector3(x, 0, z)), index < 2, 'centripetal');
  curve.arcLengthDivisions = 1600;
  curve.updateArcLengths();
  const length = curve.getLength(), point = new Vector3();
  let berth = 0;
  if (index === 2) {
    // Refine the arc distance to the actual control point, rather than snapping
    // to a nearby sample and leaving a gap at the boarding platform.
    let low = 0, high = 1;
    for (let i = 0; i < 45; i++) {
      const a = low + (high - low) / 3, b = high - (high - low) / 3;
      const da = curve.getPointAt(a, point).distanceToSquared(VISITOR_BERTH);
      const db = curve.getPointAt(b, point).distanceToSquared(VISITOR_BERTH);
      if (da < db) high = b; else low = a;
    }
    berth = (low + high) * .5 * length;
  }
  return { curve, length, berth, speed: index === 2 ? 4.2 : index === 1 ? .75 : 1.05 };
}

export interface VesselState extends MarineOccupant {
  index: number;
  route: ReturnType<typeof createVesselRoute>;
  distance: number;
  dwell: number;
  departed: boolean;
  heading: number;
  opacity: number;
  speed: number;
  checkIn: number;
  yielding: boolean;
  crossing: boolean;
}

export function createVesselState(index: number): VesselState {
  const route = createVesselRoute(index);
  const state: VesselState = {
    index, route, position: new Vector3(), radius: index === 2 ? 8.1 : 1.8,
    hullHalfSpan:index===2?6.2:0,hullRadius:index===2?2.5:1.8,
    distance: index === 2 ? route.berth - 110 : index === 1 ? route.length * .4 : route.length * .13,
    dwell: 0, departed: false, heading: 0, opacity: 1, speed: 0, checkIn: 0, yielding: false, crossing: false,
  };
  writeVesselPose(state);
  return state;
}

const tangent = new Vector3(), candidate = new Vector3(), future = new Vector3(), otherFuture = new Vector3();
const ferryPosition = new Vector3(), ferryTangent = new Vector3();
const ferryRoute = createCityFerryRoute();
const ferryOccupant:MarineOccupant={position:ferryPosition,radius:1.5};
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
function routeProgress(state: VesselState, distance: number) {
  return state.index === 2 ? clamp01(distance / state.route.length) : ((distance % state.route.length) + state.route.length) % state.route.length / state.route.length;
}

export function writeVesselPose(state: VesselState) {
  const progress = routeProgress(state, state.distance);
  state.route.curve.getPointAt(progress, state.position);
  const offset = progress < .9999 ? .0001 : -.0001;
  state.route.curve.getPointAt(progress + offset, tangent);
  tangent.sub(state.position).multiplyScalar(Math.sign(offset));
  state.heading = Math.atan2(tangent.x, tangent.z);
  state.opacity = state.index === 2 ? Math.min(smooth(state.distance / 35), smooth((state.route.length - state.distance) / 45)) : 1;
}

function pointSegmentDistance(x:number,z:number,ax:number,az:number,bx:number,bz:number){
  const dx=bx-ax,dz=bz-az,t=clamp01(((x-ax)*dx+(z-az)*dz)/Math.max(.000001,dx*dx+dz*dz));
  return Math.hypot(x-ax-dx*t,z-az-dz*t);
}
/** The visitor's long, narrow hull has a conservative swept capsule, not an 8m-wide disc. */
export function vesselHullClearance(a:MarineOccupant,b:MarineOccupant,ap=a.position,bp=b.position,ah=a.heading??0,bh=b.heading??0){
  const as=a.hullHalfSpan??0,bs=b.hullHalfSpan??0,ax=Math.sin(ah)*as,az=Math.cos(ah)*as,bx=Math.sin(bh)*bs,bz=Math.cos(bh)*bs;
  const a0x=ap.x-ax,a0z=ap.z-az,a1x=ap.x+ax,a1z=ap.z+az,b0x=bp.x-bx,b0z=bp.z-bz,b1x=bp.x+bx,b1z=bp.z+bz;
  const ux=a1x-a0x,uz=a1z-a0z,vx=b1x-b0x,vz=b1z-b0z,den=ux*vz-uz*vx;
  let distance=Math.min(pointSegmentDistance(a0x,a0z,b0x,b0z,b1x,b1z),pointSegmentDistance(a1x,a1z,b0x,b0z,b1x,b1z),pointSegmentDistance(b0x,b0z,a0x,a0z,a1x,a1z),pointSegmentDistance(b1x,b1z,a0x,a0z,a1x,a1z));
  if(Math.abs(den)>.000001){const dx=b0x-a0x,dz=b0z-a0z,t=(dx*vz-dz*vx)/den,u=(dx*uz-dz*ux)/den;if(t>=0&&t<=1&&u>=0&&u<=1)distance=0;}
  return distance-(a.hullRadius??a.radius)-(b.hullRadius??b.radius);
}
export function vesselPointClearance(boat:MarineOccupant,x:number,z:number,radius=0){
  const half=boat.hullHalfSpan??0,heading=boat.heading??0,dx=Math.sin(heading)*half,dz=Math.cos(heading)*half;
  return pointSegmentDistance(x,z,boat.position.x-dx,boat.position.z-dz,boat.position.x+dx,boat.position.z+dz)-(boat.hullRadius??boat.radius)-radius;
}
export function vesselCoastClearance(boat:MarineOccupant,position=boat.position,heading=boat.heading??0){
  const half=boat.hullHalfSpan??0,radius=boat.hullRadius??boat.radius;
  if(!half)return -landDistance(position.x,position.z)-radius;
  let clearance=Infinity;const samples=8,dx=Math.sin(heading),dz=Math.cos(heading);
  for(let i=0;i<=samples;i++){const along=(i/samples*2-1)*half;clearance=Math.min(clearance,-landDistance(position.x+dx*along,position.z+dz*along));}
  // Half a sampling interval protects the unsampled span between centreline probes.
  return clearance-radius-half/samples;
}
export function vesselClearance(x: number, z: number, radius = 0) {
  let clear = Infinity;
  for (const boat of vesselOccupants) {
    if ('opacity' in boat && (boat as VesselState).opacity < .02) continue;
    clear = Math.min(clear, vesselPointClearance(boat,x,z,radius));
  }
  return clear;
}

function travelAt(speed: number, maximum: number, time: number) {
  const ramp = Math.min(time, Math.max(0, maximum - speed) / VESSEL_ACCELERATION);
  return speed * ramp + .5 * VESSEL_ACCELERATION * ramp * ramp + maximum * (time - ramp);
}
function cruiseSpeed(state: VesselState) {
  return state.index === 2 ? 1.7 + 2.5 * smooth((Math.abs(state.position.x + 12) - 48) / 45) : state.route.speed;
}
function futurePose(state: VesselState, seconds: number, output: Vector3) {
  const duration = Math.max(0, seconds - state.dwell);
  let distance = state.distance + travelAt(state.speed, cruiseSpeed(state), duration);
  if (state.index === 2 && !state.departed && state.dwell === 0) distance = Math.min(distance, state.route.berth);
  const progress=routeProgress(state,distance);state.route.curve.getPointAt(progress,output);state.route.curve.getTangentAt(progress,tangent);
  return Math.atan2(tangent.x,tangent.z);
}
function isVessel(other: MarineOccupant): other is VesselState { return 'route' in other; }

function crossingOccupied(state: VesselState, time: number, traffic: readonly MarineOccupant[], animals: readonly MarineOccupant[]) {
  // Forecast before entering the ferry lane. The scheduled ferry has priority;
  // the smaller launches also have priority over the visiting passenger boat.
  for (let seconds = 0; seconds <= (state.index===2?35:16); seconds += .75) {
    const heading=futurePose(state, seconds, future);
    writeCityFerryPose(ferryRoute, time + seconds, ferryPosition, ferryTangent);
    if (!state.crossing && vesselHullClearance(state,ferryOccupant,future,ferryPosition,heading)<1.3) return true;
    for (const other of traffic) {
      if (other === state || other.position.y < -.8) continue;
      if (isVessel(other) && other.index > state.index) continue;
      const otherHeading=isVessel(other)?futurePose(other,seconds,otherFuture):other.heading??0;
      const position=isVessel(other)?otherFuture:other.position;
      if(vesselHullClearance(state,other,future,position,heading,otherHeading)<1.1)return true;
    }
    // Animals are treated as stationary obstacles until their own navigation
    // moves them clear. Deep swimmers do not block a surface route.
    for (const animal of animals) {
      if (animal.position.y > -.8 && vesselHullClearance(state,animal,future,animal.position,heading)<1.2) return true;
    }
  }
  return false;
}

export function stepVessel(state: VesselState, delta: number, time: number, traffic: readonly MarineOccupant[] = vesselOccupants, animals: readonly MarineOccupant[] = surfaceAnimals) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  // The scene suspends updates while paused. Real active seconds are used for
  // the berth, independent of frame rate; movement is substepped after a stall.
  let remaining = Math.min(delta, 1);
  if (state.dwell > 0) {
    if (delta < state.dwell) { state.dwell -= delta; return; }
    remaining = Math.min(delta - state.dwell, 1);
    state.dwell = 0;
    state.departed = true;
    state.checkIn = 0;
  }
  const clock = Number.isFinite(time) ? time : 0;
  while (remaining > .000001) {
    const dt = Math.min(remaining, .05);
    state.checkIn -= dt;
    if (state.checkIn <= 0) {
      state.yielding = crossingOccupied(state, clock, traffic, animals);
      // Reserve the complete ferry crossing before leaving the visitor berth.
      // Once committed, clear that lane instead of braking in its middle.
      if(state.index===2&&state.departed&&!state.yielding&&state.position.x<5)state.crossing=true;
      if(state.position.x>5)state.crossing=false;
      state.checkIn = .25;
    }
    const toBerth = state.route.berth - state.distance;
    const braking = state.index === 2 && !state.departed ? Math.sqrt(Math.max(0, 1.3 * VESSEL_ACCELERATION * toBerth)) : state.route.speed;
    const harborSpeed = cruiseSpeed(state);
    const target = state.yielding ? 0 : Math.min(harborSpeed, braking);
    const nextSpeed = state.speed + Math.max(-VESSEL_ACCELERATION * dt, Math.min(VESSEL_ACCELERATION * dt, target - state.speed));
    let next = state.distance + (state.speed + nextSpeed) * .5 * dt;
    state.route.curve.getPointAt(routeProgress(state, next), candidate);
    state.route.curve.getTangentAt(routeProgress(state,next),tangent);const candidateHeading=Math.atan2(tangent.x,tangent.z);
    let blocked = vesselCoastClearance(state,candidate,candidateHeading)<.5;
    writeCityFerryPose(ferryRoute, clock, ferryPosition, ferryTangent);
    if (vesselHullClearance(state,ferryOccupant,candidate,ferryPosition,candidateHeading)<.65) blocked = true;
    for (const other of traffic) {
      if (other !== state && other.position.y > -.8 && vesselHullClearance(state,other,candidate,other.position,candidateHeading)<.65) blocked = true;
    }
    for (const animal of animals) {
      if (animal.position.y > -.8 && vesselHullClearance(state,animal,candidate,animal.position,candidateHeading)<.65) blocked = true;
    }
    state.speed = blocked ? 0 : nextSpeed;
    if (!blocked) {
      if (state.index === 2 && !state.departed && next >= state.route.berth) {
        state.distance = state.route.berth;
        state.dwell = VISITOR_DWELL;
        state.speed = 0;
        writeVesselPose(state);
        return;
      }
      if (next >= state.route.length) { next %= state.route.length; state.departed = false; state.crossing=false; }
      state.distance = next;
    }
    remaining -= dt;
    writeVesselPose(state);
  }
}
