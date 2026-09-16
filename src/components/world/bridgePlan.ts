import { CatmullRomCurve3, Vector3 } from 'three';

export interface BridgeSample { point: Vector3; normal: Vector3; distance: number }
export interface BridgeLanding { x: number; z: number; top: number; radius: number }
export interface BridgePlan { id: string; width: number; thickness: number; railHeight: number; samples: BridgeSample[]; landings: BridgeLanding[] }

function plan(id: string, points: [number, number][], ends: [number, number], width: number): BridgePlan {
  const horizontal = new CatmullRomCurve3(points.map(([x,z]) => new Vector3(x,0,z)), false, 'centripetal');
  const centers = horizontal.getSpacedPoints(96);
  let length = 0;
  const distances = centers.map((p,i) => { if (i) length += p.distanceTo(centers[i-1]); return length; });
  const samples = centers.map((point, i) => {
    const u = distances[i] / length;
    const tangent = centers[Math.min(i+1,96)].clone().sub(centers[Math.max(i-1,0)]).normalize();
    return { point: new Vector3(point.x, ends[0] + (ends[1]-ends[0]) * (u*u*(3-2*u)) + Math.sin(Math.PI*u)**2 * 1.4, point.z), normal: new Vector3(-tangent.z,0,tangent.x), distance: distances[i] };
  });
  const landings = [samples[0], samples[96]].map(({point}) => ({ x: point.x, z: point.z, top: point.y, radius: 1.35 }));
  return { id, width, thickness: .18, railHeight: .78, samples, landings };
}

// These sampled centerlines are the sole source for deck, rails, foundations and clearance.
export const BRIDGES: readonly BridgePlan[] = [
  plan('garden', [[-6,7],[-5.8,12],[-6,18]], [.95,1.4], 1.45),
  plan('purdue', [[12,-7],[16.6,-7.5],[21.7,-7]], [.95,.95], 1.35),
];
export const BRIDGE_LANDINGS = BRIDGES.flatMap(bridge => bridge.landings);
export function bridgeHeightAt(bridge: BridgePlan, x: number, z: number) {
  let best = Infinity, height = bridge.samples[0].point.y;
  for (let i=1;i<bridge.samples.length;i++) {
    const a=bridge.samples[i-1].point,b=bridge.samples[i].point,dx=b.x-a.x,dz=b.z-a.z;
    const u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    const distance=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;
    if(distance<best){best=distance;height=a.y+(b.y-a.y)*u;}
  }
  return height;
}
