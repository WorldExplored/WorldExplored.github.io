import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { combine, strut, surface } from './BuildingKit';

export const architecturalBox = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z);
export type ShellParts = { walls: BufferGeometry[]; glass: BufferGeometry[]; frames: BufferGeometry[] };

/** A wall bay has an actual opening between the sill, lintel and load-bearing jambs. */
export function windowBay(parts: ShellParts, x: number, z: number, width: number, bottom: number, top: number, yaw = 0, sill = .48) {
  const transform = (g: BufferGeometry) => g.rotateY(yaw).translate(x, 0, z);
  const box = (w: number, h: number, d: number, px: number, y: number) => transform(architecturalBox(w, h, d, px, y, 0));
  const lintel = .22, openingBottom = bottom + sill, openingTop = top - lintel;
  parts.walls.push(box(width, sill, .2, 0, bottom + sill / 2), box(width, lintel, .2, 0, top - lintel / 2));
  for (const sign of [-1, 1]) parts.walls.push(box(.14, top - bottom - sill - lintel, .2, sign * (width / 2 - .07), (openingTop + openingBottom) / 2));
  parts.glass.push(box(width - .3, openingTop - openingBottom - .06, .055, 0, (openingTop + openingBottom) / 2));
  for (const sign of [-1, 1]) parts.frames.push(box(.045, openingTop - openingBottom, .105, sign * (width / 2 - .155), (openingTop + openingBottom) / 2));
  for (const y of [openingBottom + .025, openingTop - .025]) parts.frames.push(box(width - .27, .05, .11, 0, y));
  parts.frames.push(box(.035, openingTop - openingBottom, .09, 0, (openingTop + openingBottom) / 2));
}

export function doorway(parts: ShellParts, x: number, z: number, width: number, floor: number, ceiling: number) {
  const doorTop = Math.min(floor + 2.18, ceiling - .15);
  for (const sign of [-1, 1]) parts.walls.push(architecturalBox(.16, ceiling - floor, .24, x + sign * (width / 2 + .08), (ceiling + floor) / 2, z));
  parts.walls.push(architecturalBox(width, ceiling - doorTop, .2, x, (ceiling + doorTop) / 2, z));
  for (const sign of [-1, 1]) {
    parts.glass.push(architecturalBox(width / 2 - .055, doorTop - floor - .07, .06, x + sign * width / 4, (floor + doorTop) / 2, z + .035));
    parts.frames.push(architecturalBox(.045, doorTop - floor, .1, x + sign * width / 2, (floor + doorTop) / 2, z + .04));
    parts.frames.push(architecturalBox(.025, .3, .07, x + sign * .075, floor + .99, z + .13));
  }
  parts.frames.push(architecturalBox(width + .06, .055, .11, x, doorTop, z + .04), architecturalBox(.035, doorTop - floor, .09, x, (doorTop + floor) / 2, z + .06));
}

/** A complete flight, including closed risers, stringers and continuous handrails. */
export function stairFlight(x: number, startZ: number, width: number, lower: number, upper: number, count: number, tread: number) {
  const steps: BufferGeometry[] = [], rails: BufferGeometry[] = [];
  const rise = (upper - lower) / count;
  for (let i = 0; i < count; i++) {
    const height = (i + 1) * rise;
    steps.push(architecturalBox(width, height, tread + .012, x, lower + height / 2, startZ - i * tread));
  }
  for (const sign of [-1, 1]) {
    const edge = x + sign * (width / 2 - .035);
    const a = new Vector3(edge, lower + rise + .87, startZ + tread / 2);
    const b = new Vector3(edge, upper + .87, startZ - (count - 1) * tread - tread / 2);
    rails.push(strut(a, b, .035));
    for (let i = 0; i < count; i += 3) rails.push(architecturalBox(.035, .87, .035, edge, lower + (i + 1) * rise + .435, startZ - i * tread));
  }
  const geometry = combine(steps);
  geometry.userData.stair = { lower, upper, count, tread, width, x, startZ, endZ: startZ - (count - 1) * tread };
  return { steps: geometry, rails: combine(rails) };
}

export function guardRail(x0: number, z0: number, x1: number, z1: number, floor: number) {
  const parts: BufferGeometry[] = [], length = Math.hypot(x1 - x0, z1 - z0), count = Math.ceil(length / .8);
  for (let i = 0; i <= count; i++) parts.push(architecturalBox(.045, .95, .045, x0 + (x1 - x0) * i / count, floor + .475, z0 + (z1 - z0) * i / count));
  for (const h of [.46, .95]) parts.push(strut(new Vector3(x0, floor + h, z0), new Vector3(x1, floor + h, z1), .028));
  return combine(parts);
}

/** Preserve metric UVs when purpose-shaped panels are batched with standard solids. */
export function architecturalSurface(point: (u:number,v:number)=>Vector3, columns=48, rows=12, thickness=0) {
  const geometry=surface(point,columns,rows,thickness),position=geometry.getAttribute('position');
  geometry.computeBoundingBox();
  const size=geometry.boundingBox!.getSize(new Vector3());
  const axes=([['x',size.x],['y',size.y],['z',size.z]] as Array<['x'|'y'|'z',number]>).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([axis])=>axis);
  const uv:number[]=[];
  for(let i=0;i<position.count;i++){const p=new Vector3().fromBufferAttribute(position,i);uv.push(p[axes[0]],p[axes[1]]);}
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));return geometry;
}
