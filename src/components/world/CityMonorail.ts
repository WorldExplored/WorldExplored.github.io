import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Mesh, type MeshPhysicalMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityRoundedBox, type CityFinish } from './CityArchitecture';

/** Two compact passenger cars share seven finish batches, including running and guide wheels. */
export function makeCityCarriage(materials: Record<CityFinish, MeshPhysicalMaterial>) {
  const root = new Group();
  const buckets = new Map<CityFinish, BufferGeometry[]>();
  const collisionBounds: Array<{ min: number[]; max: number[] }> = [];
  const add = (finish: CityFinish, geometry: BufferGeometry) => {
    geometry.computeBoundingBox();
    collisionBounds.push({ min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray() });
    const parts = buckets.get(finish) ?? []; parts.push(geometry); buckets.set(finish, parts);
  };
  const box = (finish: CityFinish, w: number, h: number, d: number, x: number, y: number, z: number) => add(finish, new BoxGeometry(w, h, d).translate(x, y, z));
  // A narrow chassis passes between platforms; the floor lip clears their tops by 2cm.
  add('metal', cityRoundedBox(.54, .1, 1.2, .15).translate(0, .02, 0));
  add('porcelain', cityRoundedBox(.88, .02, 1.65, .18).translate(0, .14, 0));
  add('porcelain', cityRoundedBox(.88, .075, 1.65, .18).translate(0, .87, 0));
  add('aqua', cityRoundedBox(.83, .045, 1.59, .16).translate(0, .945, 0));
  for (const side of [-1, 1]) {
    // Actual glazed bays are between independent pillars, sill and roof.
    box('aqua', .045, .2, 1.25, side * .42, .22, 0);
    box('porcelain', .045, .06, 1.3, side * .42, .84, 0);
    for (const z of [-.64, -.24, .24, .64]) box('porcelain', .055, .52, .035, side * .42, .58, z);
    for (const z of [-.44, .44]) box('window', .018, .46, .345, side * .42, .575, z);
    // Glazed paired doors have independent leaf frames, lower panels, seams and handles.
    for (const z of [-.11, .11]) {
      box('porcelain', .05, .65, .018, side * .432, .455, z + Math.sign(z) * .09);
      box('aqua', .04, .2, .20, side * .435, .22, z);
      box('window', .022, .43, .18, side * .435, .575, z);
      box('metal', .022, .13, .018, side * .459, .47, z * .3);
    }
    box('metal', .07, .035, .47, side * .445, .14, 0);
    for (const z of [-.42, .42]) {
      box('wood', .17, .055, .29, side * .265, .26, z);
      box('fabric', .05, .22, .29, side * .35, .36, z);
    }
    // Cab windscreens, reinforced nose and low mounted lamps at both ends.
    box('porcelain', .68, .2, .04, 0, .22, side * .75);
    box('window', .62, .47, .025, 0, .585, side * .755);
    for (const x of [-.33, .33]) box('porcelain', .035, .57, .05, x, .57, side * .745);
    for (const x of [-.245, .245]) {
      box('metal', .115, .075, .035, x, .26, side * .78);
      box('porcelain', .08, .035, .012, x, .268, side * .801);
    }
    box('metal', .18, .055, .11, 0, .18, side * .79);
  }
  for (const z of [-.5, .5]) {
    box('metal', .36, .08, .27, 0, .005, z);
    // Running tyres contact the single beam top; horizontal rollers embrace its sides.
    for (const side of [-1, 1]) {
      add('metal', new CylinderGeometry(.07, .07, .08, 12).rotateZ(Math.PI / 2).translate(side * .18, -.08, z));
      add('metal', new CylinderGeometry(.065, .065, .10, 12).translate(side * .36, -.16, z));
      box('metal', .035, .10, .06, side * .37, -.125, z);
      box('metal', .16, .035, .06, side * .30, -.09, z);
      box('metal', .035, .15, .06, side * .24, -.04, z);
    }
  }
  box('metal', .22, .07, .43, 0, .997, -.15);
  for (let i = 0; i < 6; i++) box('porcelain', .18, .012, .018, 0, 1.038, -.31 + i * .063);
  for (const [finish, parts] of buckets) {
    const plain = parts.map(part => part.index ? part.toNonIndexed() : part);
    const geometry = mergeGeometries(plain)!;
    for (let i = 0; i < parts.length; i++) { if (plain[i] !== parts[i]) plain[i].dispose(); parts[i].dispose(); }
    const mesh = new Mesh(geometry, materials[finish]); mesh.name = `monorail-${finish}`;
    mesh.castShadow = !materials[finish].transparent; mesh.receiveShadow = true; root.add(mesh);
  }
  root.userData.collisionBounds = collisionBounds;
  root.userData.boardingFloor = .16;
  root.userData.halfWidth = .48;
  root.userData.halfLength = .85;
  return root;
}
