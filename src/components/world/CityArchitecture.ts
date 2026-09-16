import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, ExtrudeGeometry, Shape, SphereGeometry, TorusGeometry } from 'three';
import { cityEntrances, type CityBuilding, type CityPoint } from './city';

export type CityFinish = 'porcelain' | 'glass' | 'aqua' | 'garden' | 'window' | 'stone' | 'wood' | 'fabric' | 'metal';
export type CityAdd = (geometry: BufferGeometry, finish: CityFinish, x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number, rotation?: number) => void;
export interface CityRoomView { building: string; window: CityPoint; target: CityPoint; floor: number; width: number; height: number; depth: number }

export function cityRoundedBox(width: number, height: number, depth: number, corner = .16) {
  const r = Math.min(corner, width / 2, depth / 2); const x = width / 2; const z = depth / 2;
  const shape = new Shape();
  shape.moveTo(-x + r, -z); shape.lineTo(x - r, -z); shape.quadraticCurveTo(x, -z, x, -z + r);
  shape.lineTo(x, z - r); shape.quadraticCurveTo(x, z, x - r, z); shape.lineTo(-x + r, z); shape.quadraticCurveTo(-x, z, -x, z - r);
  shape.lineTo(-x, -z + r); shape.quadraticCurveTo(-x, -z, -x + r, -z);
  return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 5 }).rotateX(-Math.PI / 2);
}

export function buildCityArchitecture(building: Readonly<CityBuilding>, add: CityAdd) {
  const roomViews: CityRoomView[] = [];
  const { width: w, depth: d, height: h, family } = building;
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, finish: CityFinish = 'porcelain', yaw = 0) => add(new BoxGeometry(width, height, depth), finish, x, y, z, 1, 1, 1, yaw);
  const slab = (x: number, y: number, z: number, width: number, depth: number, finish: CityFinish = 'stone', corner = .12) => add(cityRoundedBox(width, .13, depth, corner), finish, x, y, z);
  const plant = (x: number, y: number, z: number, scale = 1) => {
    add(new CylinderGeometry(.14, .1, .24, 8), 'stone', x, y + .12 * scale, z, scale, scale, scale);
    add(new SphereGeometry(.23, 7, 5), 'garden', x, y + .42 * scale, z, scale * .7, scale * 1.3, scale * .7);
  };
  const chair = (x: number, y: number, z: number, yaw = 0) => {
    box(x, y + .3, z, .36, .10, .34, 'fabric', yaw);
    box(x - Math.sin(yaw) * .14, y + .5, z - Math.cos(yaw) * .14, .36, .31, .055, 'wood', yaw);
    for (const dx of [-.12, .12]) for (const dz of [-.11, .11]) box(x + dx, y + .14, z + dz, .035, .28, .035, 'metal');
  };
  const furnishing = (x: number, y: number, z: number, width: number, depth: number, variant: number, height = 1.8) => {
    // A clear central view reaches the table, rear shelving and planted corner.
    box(x - width * .18, y + .47, z, Math.min(.73, width * .42), .065, .48, 'wood');
    for (const dx of [-.22, .22]) box(x - width * .18 + dx, y + .22, z, .035, .45, .35, 'metal');
    chair(x - width * .18, y, z + .49);
    if (width > 1.7) chair(x + width * .28, y, z + .1, Math.PI / 2);
    const back = z - depth * .34;
    for (let shelf = 0; shelf < 3; shelf++) box(x + width * .22, y + .35 + shelf * .35, back, width * .35, .055, .22, 'wood');
    for (let book = 0; book < 4; book++) box(x + width * (.1 + book * .065), y + .5, back, .055, .24 + book % 2 * .04, .14, book % 2 ? 'fabric' : 'aqua');
    plant(x - width * .35, y, back, .8);
    box(x, y + height - .25, z, .34, .06, .22, 'porcelain');
    // Selected curtains interrupt the window rhythm without hiding every room.
    if (variant % 3 === 1) box(x + width * .36, y + (height - .2) / 2, z + depth * .36, width * .2, height - .2, .04, 'fabric');
  };
  const room = (x: number, y: number, z: number, width: number, depth: number, height: number, variant: number, furnish = true, balcony = false) => {
    slab(x, y, z, width, depth, 'wood');
    // Each facade is a thin wall or glazing plane. There is no filled opaque body behind the window.
    box(x, y + height / 2, z - depth / 2 + .06, width, height, .12, variant % 2 ? 'aqua' : 'stone');
    for (const side of [-1, 1]) {
      box(x + side * (width / 2 - .06), y + height / 2, z, .12, height, depth, 'porcelain');
      box(x + side * (width / 2 - .11), y + height / 2, z + depth / 2, .075, height, .075, 'metal');
    }
    box(x, y + height - .1, z + depth / 2, width, .2, .12, 'porcelain');
    if (y > .21 || (Math.abs(x) > .5 && family !== 'public-station')) box(x, y + .26, z + depth / 2, width, .25, .11, 'porcelain');
    box(x, y + height / 2 + .09, z + depth / 2, width - .22, height - .45, .015, 'window');
    if (width > 2.3) box(x + width * .12, y + height / 2, z + depth / 2 + .012, .055, height, .06, 'metal');
    if (furnish) {
      furnishing(x, y + .14, z, width - .24, depth - .24, variant, height - .14);
      roomViews.push({ building: building.id, window: [x - width * (family === 'arched-apartments' ? .1 : .15), y + .86, z + depth / 2 + .015], target: [x - width * (family === 'arched-apartments' ? .1 : .15), y + .7, z], floor: y + .13, width: width - .24, height, depth: depth - .24 });
    } else box(x + width * .18, y + height / 2, z + depth / 2 - .14, width * .44, height - .25, .035, 'fabric');
    if (balcony) {
      slab(x, y + .02, z + depth / 2 + .16, width + .1, .55, 'porcelain');
      box(x, y + .62, z + depth / 2 + .42, width, .055, .055, 'metal');
      for (const side of [-1, 1]) box(x + side * width * .45, y + .35, z + depth / 2 + .42, .035, .55, .035, 'metal');
      plant(x + width * .34, y + .15, z + depth / 2 + .15, .55);
    }
  };
  const roof = (x: number, y: number, z: number, width: number, depth: number, planted = false) => {
    slab(x, y, z, width + .08, depth + .08, 'porcelain');
    if (planted) for (const side of [-1, 1]) { box(x + side * width * .33, y + .2, z - depth * .2, width * .22, .2, depth * .5, 'stone'); plant(x + side * width * .33, y + .3, z - depth * .2, .85); }
  };
  const gable = (x: number, y: number, z: number, width: number, depth: number, rise: number, glass = false) => {
    if (glass) for (const side of [-1, 1]) {
      const cap = new BufferGeometry(); cap.setAttribute('position', new Float32BufferAttribute([-width / 2, 0, 0, width / 2, 0, 0, 0, rise, 0], 3)); cap.computeVertexNormals();
      add(cap, 'window', x, y, z + side * depth / 2);
    }
    box(x, y + rise, z, .075, .08, depth + .08, 'metal');
    for (const side of [-1, 1]) {
      const geometry = new BoxGeometry(Math.hypot(width / 2, rise), .075, depth + .1).rotateZ(side * Math.atan2(rise, width / 2));
      add(geometry, glass ? 'window' : 'wood', x - side * width / 4, y + rise / 2, z);
      for (const dz of [-depth / 2, 0, depth / 2]) add(new BoxGeometry(Math.hypot(width / 2, rise), .09, .08).rotateZ(side * Math.atan2(rise, width / 2)), 'metal', x - side * width / 4, y + rise / 2 + .05, z + dz);
    }
  };
  slab(0, 0, 0, w + .32, d + .24, 'stone', .25);
  if (family === 'terraced-apartments') {
    const pitch = (h - .55) / 5;
    for (let n = 0; n < 5; n++) { const width = w - n * .38; const x = -n * .105; room(x, .2 + n * pitch, -.18, width, d - .55, pitch, n, n < 2, true); roof(x, .2 + (n + 1) * pitch - .05, -.18, width, d - .55); }
    roof(-.42, h - .35, -.18, w - 1.52, d - .55);
  } else if (family === 'narrow-mixed-use') {
    const width = w * .54; const pitch = (h - .55) / 6;
    room(0, .2, 0, w - .2, d - .3, pitch, 0, true);
    for (let n = 1; n < 6; n++) room(0, .2 + n * pitch, -.15, width, d - .5, pitch, n, n === 1, n % 2 === 0);
    roof(0, h - .35, -.15, width + .15, d - .45);
    for (const side of [-1, 1]) box(side * (width / 2 + .06), h / 2, -.65, .13, h - .6, .23, 'aqua');
    roof(0, pitch + .25, 0, w - .1, d - .25, true);
  } else if (family === 'split-wings') {
    for (const side of [-1, 1]) { const count = side < 0 ? 5 : 4; const pitch = (h - .5) / 5; for (let n = 0; n < count; n++) room(side * w * .265, .2 + n * pitch, side < 0 ? -.2 : .1, w * .44, d - .6, pitch, n + (side > 0 ? 1 : 0), n < 2); roof(side * w * .265, .2 + count * pitch, side < 0 ? -.2 : .1, w * .45, d - .6); }
    for (let n = 1; n < 4; n++) box(0, .3 + n * 1.9, -.5, w * .2, .12, .7, 'metal');
  } else if (family === 'rounded-housing') {
    const pitch = (h - .6) / 4;
    for (let n = 0; n < 4; n++) {
      const y = .2 + n * pitch; const rx = w / 2 - n * .08; const rz = d / 2 - .23;
      add(new CylinderGeometry(1, 1, .14, 32), 'porcelain', 0, y + .07, 0, rx, 1, rz);
      add(new CylinderGeometry(1, 1, pitch - .16, 32, 1, true), 'window', 0, y + pitch / 2 + .1, 0, rx - .1, 1, rz - .1);
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; box(Math.cos(a) * (rx - .08), y + pitch / 2, Math.sin(a) * (rz - .08), .065, pitch, .065, 'metal'); }
      box(0, y + pitch / 2, -.35, .11, pitch, d * .46, 'wood');
      box(-.62, y + pitch * .46, -.55, 1.45, pitch * .85, .12, 'aqua');
      if (n < 2) { furnishing(-.62, y + .15, .06, 1.35, 1.3, n); roomViews.push({ building: building.id, window: [-.92, y + .9, rz - .1], target: [-.92, y + .7, .1], floor: y + .14, width: 1.35, height: pitch, depth: 1.3 }); }
    }
    add(new CylinderGeometry(1, 1, .15, 32), 'porcelain', 0, h - .25, 0, w / 2 - .24, 1, d / 2 - .22);
    for (const x of [-.9, .9]) plant(x, h - .23, -.25, .28);
  } else if (family === 'courtyard-block') {
    const pitch = (h - .55) / 3;
    for (let n = 0; n < 3; n++) { for (const side of [-1, 1]) room(side * w * .34, .2 + n * pitch, 0, w * .3, d - .25, pitch, n, n < 2); room(0, .2 + n * pitch, -d * .28, w * .38, d * .38, pitch, n, n === 0); }
    roof(0, h - .35, -.35, w - .1, d * .7); plant(0, .15, d * .1, 1.4);
  } else if (family === 'arched-apartments') {
    const pitch = (h - .8) / 3;
    for (let n = 0; n < 3; n++) { room(0, .2 + n * pitch, -.2, w - .2, d - .65, pitch, n, n < 2, true); for (const x of [-w * .29, 0, w * .29]) { const arc = new TorusGeometry(w * .135, .07, 6, 16, Math.PI); add(arc, 'stone', x, .2 + n * pitch + pitch * .59, d / 2 - .05); for (const side of [-1, 1]) box(x + side * w * .135, .2 + n * pitch + pitch * .29, d / 2 - .05, .12, pitch * .6, .14, 'stone'); } }
    gable(0, h - .65, -.2, w, d - .55, .5);
  } else if (family === 'greenhouse-residences') {
    const pitch = (h - 2) / 3;
    for (let n = 0; n < 3; n++) room(0, .2 + n * pitch, 0, w - .25, d - .4, pitch, n, n < 2);
    const y = .2 + pitch * 3; room(0, y, 0, w - .55, d - .55, 1.0, 0, false); gable(0, y + 1, 0, w - .55, d - .55, .58, true);
    for (const x of [-1.4, -.7, .7, 1.4]) plant(x, y + .13, .15, 1.4);
  } else if (family === 'split-level-homes') {
    for (const side of [-1, 1]) { const pitch = side < 0 ? 1.55 : 1.85; for (let n = 0; n < 3; n++) room(side * w * .24, .2 + n * pitch, side < 0 ? .2 : -.2, w * .44, d - .8, pitch, n, n < 2, n === 1); gable(side * w * .24, .2 + 3 * pitch, side < 0 ? .2 : -.2, w * .45, d - .8, .3); }
  } else if (family === 'waterfront-rowhouses') {
    for (let n = 0; n < 3; n++) { const x = (n - 1) * w * .32; room(x, .2, n % 2 ? -.2 : 0, w * .3, d - .55, 2.15, n, true); gable(x, 2.4, n % 2 ? -.2 : 0, w * .31, d - .55, .65 + (n % 2) * .18); }
  } else if (family === 'winter-glasshouse') {
    room(0, .2, 0, w - .35, d - .35, 2.15, 0, true);
    gable(0, 2.35, 0, w - .2, d - .15, .95, true);
    for (const x of [-2, -1, 1, 2]) plant(x, .34, -.6, 1.8);
    for (const x of [-w * .33, 0, w * .33]) box(x, 1.25, d / 2 - .15, .07, 2.3, .07, 'metal');
  } else if (family === 'civic-gallery') {
    room(0, .2, -.22, w - .2, d - .55, 2.55, 0, true);
    // Broad cantilever with a raised clerestory stripe makes a low public silhouette.
    roof(0, 2.8, 0, w + .2, d + .1);
    box(-w * .22, 3.05, -.25, w * .44, .25, d * .54, 'window'); slab(-w * .22, 3.16, -.25, w * .49, d * .6, 'porcelain');
    for (const side of [-1, 1]) box(side * w * .42, 1.4, d / 2 - .05, .18, 2.6, .18, 'stone');
  } else if (family === 'stacked-maisonettes') {
    room(-.28, .2, 0, w - .6, d - .5, 1.5, 0, true);
    room(.25, 1.7, -.25, w - .7, d - .8, 1.45, 1, true, true);
    roof(.25, 3.17, -.25, w - .65, d - .75);
  } else {
    // Ground lobby is a furnished open-front room; the upper boarding path remains clear.
    room(-.82, .2, 0, 1.25, d - .35, 1.78, 0, true);
    slab(-.82, .2, d / 2 - .27, 1.05, .6, 'stone');
    for (const side of [-1, 1]) box(-.82 + side * .45, 1.04, d / 2 - .175, .055, 1.4, .08, 'metal');
    box(-.7, .93, d / 2 - .12, .025, .2, .035, 'metal');
    add(cityRoundedBox(w, .18, d, .25), 'stone', 0, 2.14, 0);
    for (const z of [-d * .43, d * .43]) for (const side of [-1, 1]) box(side * w * .44, 3.32, z, .12, 2.1, .12, 'metal');
    // Barrel canopy opens both rail ends and the pedestrian side entrance.
    const shape = new Shape(); shape.moveTo(-w / 2, 0); shape.quadraticCurveTo(0, .74, w / 2, 0); shape.lineTo(w / 2, -.08); shape.quadraticCurveTo(0, .65, -w / 2, -.08); shape.closePath();
    add(new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 14 }), 'porcelain', 0, 4.34, -d / 2);
    box(-w * .42, 2.83, 0, .28, .25, 1.05, 'wood');
    for (const z of [-.48, .48]) box(-w * .42, 2.57, z, .08, .43, .08, 'metal');
    // Top landing is kept open around local [1.6, 2.32, 0].
    for (const z of [-d / 2 + .05, d / 2 - .05]) box(w * .38, 2.72, z, w * .18, .065, .065, 'metal');
  }
  if (family !== 'public-station') {
    const entrance = cityEntrances.find(item => item.building === building.id)!.local;
    const doorZ = d / 2 + .08;
    slab(0, .11, doorZ - .35, 1.03, 1.0, 'stone');
    for (const side of [-1, 1]) { box(side * .46, .97, doorZ, .065, 1.5, .08, 'metal'); box(side * .1, .86, doorZ + .04, .025, .2, .03, 'metal'); }
    box(0, 1.74, doorZ, 1, .08, .09, 'porcelain');
    box(0, .97, doorZ, .85, 1.43, .015, 'window');
    slab(0, 1.85, doorZ - .08, 1.15, .5, 'porcelain');
    // The approach metadata includes the open-air porch in front of the inset facade.
    if (entrance[1] !== .24) throw new Error('Unexpected city threshold height');
  }
  return roomViews;
}
