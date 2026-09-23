import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CityAdd, CityFinish } from './CityArchitecture';
import type { CityBuilding } from './city';

/** Nearby interiors share the city's existing finish batches and deferred lifetime. */
export function buildCityInterior(building: Readonly<CityBuilding>, add: CityAdd, x: number, y: number, z: number, width: number, depth: number, variant: number, height = 1.8) {
  // Rounded residences supply a broad rectangle; inset it to keep all four corners in the ellipse.
  const curved = building.family === 'rounded-housing', w = width * (curved ? .86 : 1), d = depth * (curved ? .86 : 1);
  const seed = [...building.id].reduce((sum, letter) => sum + letter.charCodeAt(0), variant * 13);
  const scheme = seed % 5, aisle = .32, zone = Math.max(.04, w / 2 - aisle - .045);
  const center = aisle + zone / 2, tall = Math.min(height - .13, 1.32);
  const accent: CityFinish = scheme % 2 ? 'fabric' : 'aqua';
  const textile = new Color(['#82647b', '#487e76', '#ae7957', '#6e839d', '#7f895a'][scheme]);
  const emit = (name: string, geometry: BufferGeometry, finish: CityFinish, px: number, py: number, pz: number) => {
    geometry.userData.furniture = { building: building.id, name, floor: y, scheme };
    if (finish === 'fabric') {
      const color = textile.clone();
      if (name.includes('border') || name.includes('throw')) color.lerp(new Color('#eee2c9'), .48);
      if (name === 'woven-rug') color.multiplyScalar(.66);
      const values = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < values.length; i += 3) { values[i] = color.r; values[i + 1] = color.g; values[i + 2] = color.b; }
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
    }
    add(geometry, finish, x + px, y + py, z + pz);
  };
  const box = (name: string, finish: CityFinish, px: number, py: number, pz: number, sw: number, sh: number, sd: number) => emit(name, new BoxGeometry(sw, sh, sd), finish, px, py, pz);
  const soft = (name: string, finish: CityFinish, px: number, py: number, pz: number, sw: number, sh: number, sd: number) => emit(name, name === 'conservatory-leaves' ? new SphereGeometry(1, 12, 7).scale(sw / 2, sh / 2, sd / 2) : new RoundedBoxGeometry(sw, sh, sd, name === 'mattress' || name === 'sofa-seat' ? 2 : 1, Math.min(sw, sh, sd) * .24), finish, px, py, pz);
  const cylinder = (name: string, finish: CityFinish, px: number, py: number, pz: number, radius: number, sh: number, top = radius) => emit(name, new CylinderGeometry(top, radius, sh, 12), finish, px, py, pz);
  const book = (px: number, py: number, pz: number, sw: number, sd: number, index: number) => {
    const sh = .045 + (index % 3) * .012;
    box('book-pages', 'porcelain', px, py + sh / 2, pz, sw * .94, sh * .75, sd * .95);
    for (const side of [-1, 1]) box('book-cover', index % 2 ? accent : 'wood', px, py + sh / 2 + side * sh * .47, pz, sw, .012, sd);
    box('book-spine', accent, px - sw / 2 + .005, py + sh / 2, pz, .012, sh, sd);
  };
  const lamp = (px: number, floor: number, pz: number, scale: number) => {
    cylinder('lamp-weighted-foot', 'metal', px, floor + .015, pz, scale * .43, .03);
    cylinder('lamp-stem', 'metal', px, floor + .17, pz, .012, .29);
    cylinder('lamp-shade', 'porcelain', px, floor + .31, pz, scale * .5, .14, scale * .29);
    cylinder('lamp-bulb', 'aqua', px, floor + .275, pz, scale * .18, .035);
  };
  const cabinet = (side: number, pz: number, sh: number, sd: number, kitchen = false) => {
    const sw = Math.min(.76, zone * .94), px = side * (w / 2 - .04 - sw / 2);
    if (kitchen) box('kitchen-cabinet', 'wood', px, sh / 2, pz, sw, sh, sd);
    else {
      // A framed cupboard has a genuine open top cubby above its inset doors.
      for (const side of [-1, 1]) box('wardrobe-carcass', 'wood', px + side * (sw / 2 - .013), sh / 2, pz, .026, sh, sd);
      box('wardrobe-back', 'wood', px, sh / 2, pz - sd / 2 + .012, sw, sh, .024);
      for (const level of [.025, sh * .78, sh - .018]) box('cabinet-shelf', 'wood', px, level, pz, sw, .027, sd);
      soft('folded-cabinet-linen', 'fabric', px, sh * .78 + .06, pz, sw * .72, .08, sd * .72);
    }
    box('recessed-cabinet-toe', 'metal', px, .025, pz + sd / 2 + .006, sw * .84, .05, .014);
    for (const door of [-1, 1]) {
      const dx = door * sw * .244;
      box('inset-cabinet-door', kitchen ? 'porcelain' : accent, px + dx, sh * (kitchen ? .53 : .43), pz + sd / 2 + .012, sw * .45, sh * (kitchen ? .84 : .65), .022);
      box('cabinet-pull', 'metal', px + dx - door * sw * .10, sh * .48, pz + sd / 2 + .03, .014, Math.min(.13, sh * .24), .022);
    }
    return { px, top: sh, sw, sd };
  };
  const sleeping = (side: number) => {
    const sw = Math.min(.78 + seed % 3 * .045, zone - .035), length = Math.min(1.55, d - .16);
    const px = side * (w / 2 - .04 - sw / 2);
    const wallRear = curved ? -depth / 1.5 * Math.sqrt(1 - ((Math.abs(px) + sw / 2) / (width / 1.65)) ** 2) : -d / 2;
    const pz = Math.max(-depth / 2, wallRear) + .04 + length / 2;
    for (const dx of [-.36, .36]) for (const dz of [-.38, .38]) box('bed-leg', 'wood', px + dx * sw, .065, pz + dz * length, Math.min(.045, sw * .14), .13, .045);
    box('bed-frame', 'wood', px, .15, pz, sw, .12, length);
    box('headboard', 'wood', px, .36, pz - length / 2 + .018, sw, .5, .035);
    box('headboard-light-bracket', 'metal', px + side * sw * .29, .57, pz - length / 2 + .06, .04, .04, .11);
    cylinder('headboard-reading-light', 'porcelain', px + side * sw * .29, .65, pz - length / 2 + .10, .055, .13, .035);
    soft('mattress', 'porcelain', px, .27, pz, sw * .96, .18, length * .98);
    // A shallow mesh drapes over the mattress with displaced folds and a turned top edge.
    const points: number[] = [], indices: number[] = [], cols = 8, rows = 10;
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
      const u = i / cols, v = j / rows;
      points.push((u - .5) * sw * .98, .335 + .014 * Math.sin(u * 17 + v * 9 + seed) - .04 * Math.pow(Math.abs(u - .5) * 2, 8) + (v < .11 ? .025 : 0), pz - length * .27 + v * length * .75);
      if (i < cols && j < rows) { const a = i * (rows + 1) + j; indices.push(a, a + 1, a + rows + 1, a + 1, a + rows + 2, a + rows + 1); }
    }
    const duvet = new BufferGeometry(); duvet.setAttribute('position', new Float32BufferAttribute(points, 3)); duvet.setIndex(indices); duvet.computeVertexNormals();
    emit('folded-duvet', duvet, 'fabric', px, 0, 0);
    for (const u of [.10, .90]) {
      const line = Array.from({ length: 11 }, (_, i) => {
        const v = .14 + i / 10 * .81;
        return new Vector3((u - .5) * sw * .98, .341 + .014 * Math.sin(u * 17 + v * 9 + seed) - .04 * Math.pow(Math.abs(u - .5) * 2, 8), pz - length * .27 + v * length * .75);
      });
      emit('duvet-stitched-seam', new TubeGeometry(new CatmullRomCurve3(line), 16, .0025, 3, false), 'porcelain', px, 0, 0);
    }
    const piping = Array.from({ length: 33 }, (_, i) => {
      const angle = i / 32 * Math.PI * 2;
      return new Vector3(Math.sign(Math.cos(angle)) * Math.pow(Math.abs(Math.cos(angle)), .25) * sw * .455, .27, pz + Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), .25) * length * .455);
    });
    emit('mattress-piping', new TubeGeometry(new CatmullRomCurve3(piping), 32, .004, 3, false), 'porcelain', px, 0, 0);
    soft('pillow', 'porcelain', px, .38, pz - length * .30, sw * .78, .105, Math.min(.24, length * .24));
    if (sw > .62) soft('second-pillow', 'fabric', px + sw * .22, .40, pz - length * .30, sw * .31, .10, .22);
    // A folded throw makes the foot of each sleeping arrangement visually distinct.
    box('folded-bed-throw', 'fabric', px, .365, pz + length * .31, sw * .97, .028, length * .16);
  };
  const lounge = (side: number) => {
    const sw = Math.min(.60, zone - .03), length = Math.min(.96, sw * 1.7), pz = d / 2 - .08 - length / 2;
    const px = side * (w / 2 - .04 - sw / 2);
    const rugWidth = Math.min(zone - .015, sw + .07), rugLength = Math.min(length + .08, d - .14);
    box('woven-rug', 'fabric', px, .008, pz, rugWidth, .015, rugLength);
    for (const side of [-1, 1]) {
      box('rug-woven-border', 'fabric', px + side * rugWidth * .445, .017, pz, rugWidth * .05, .006, rugLength * .94);
      box('rug-woven-border', 'fabric', px, .017, pz + side * rugLength * .45, rugWidth * .9, .006, rugLength * .04);
    }
    for (const dx of [-.34, .34]) for (const dz of [-.35, .35]) box('sofa-foot', 'wood', px + dx * sw, .09, pz + dz * length, .035, .18, .035);
    box('sofa-frame', 'wood', px, .22, pz, sw, .13, length);
    soft('sofa-seat', 'fabric', px, .31, pz, sw * .95, .18, length * .97);
    soft('sofa-back', 'fabric', px + side * sw * .39, .51, pz, sw * .22, .45, length);
    for (const end of [-1, 1]) soft('sofa-arm', 'fabric', px, .43, pz + end * length * .43, sw, .25, length * .15);
    soft('loose-sofa-cushion', 'porcelain', px + side * sw * .20, .46, pz - length * .23, sw * .42, .20, length * .25);
  };
  const dining = (side: number) => {
    const sw = Math.min(.72, zone * .86), px = side * (w / 2 - .04 - sw / 2), pz = d * .10, sd = Math.min(.46, d * .27);
    box('dining-tabletop', 'wood', px, .57, pz, sw, .05, sd);
    for (const dx of [-.35, .35]) for (const dz of [-.32, .32]) box('dining-leg', 'metal', px + dx * sw, .28, pz + dz * sd, .025, .56, .025);
    const seatZ = pz + sd * .5 + .13;
    box('dining-stool', 'fabric', px, .31, seatZ, sw * .74, .055, .18);
    for (const dx of [-.27, .27]) box('stool-support', 'wood', px + dx * sw, .15, seatZ, .024, .30, .15);
    cylinder('ceramic-mug', 'porcelain', px, .638, pz, Math.min(.045, sw * .18), .085);
    book(px, .595, pz - sd * .28, sw * .52, sd * .30, seed);
    return { px, pz, sw };
  };
  const kitchen = (side: number) => {
    const sd = Math.min(.35, d * .23), pz = -d / 2 + sd / 2 + .07;
    const c = cabinet(side, pz, .63, sd, true);
    box('kitchen-worktop', 'stone', c.px, .655, pz, c.sw, .045, sd + .025);
    const sinkX = c.px + c.sw * .21;
    box('inset-sink-rim', 'metal', sinkX, .683, pz, c.sw * .43, .012, sd * .66);
    box('sink-basin', 'window', sinkX, .69, pz, c.sw * .34, .014, sd * .47);
    box('ceramic-cooktop', 'metal', c.px - c.sw * .26, .685, pz, c.sw * .38, .012, sd * .70);
    for (const offset of [-.18, .18]) cylinder('hob-ring', 'stone', c.px - c.sw * .26, .695, pz + offset * sd, Math.min(.045, c.sw * .075), .008);
    box('oven-window', 'metal', c.px - c.sw * .25, .35, pz + sd / 2 + .027, c.sw * .38, .25, .019);
    box('oven-inner-glass', 'window', c.px - c.sw * .25, .35, pz + sd / 2 + .04, c.sw * .30, .18, .009);
    box('fridge-door', 'porcelain', c.px + c.sw * .25, .32, pz + sd / 2 + .031, c.sw * .41, .47, .014);
    box('fridge-freezer-seam', 'metal', c.px + c.sw * .25, .43, pz + sd / 2 + .040, c.sw * .38, .009, .007);
    box('fridge-pull', 'metal', c.px + c.sw * .12, .34, pz + sd / 2 + .05, .018, .14, .022);
    for (let vent = 0; vent < 3; vent++) box('fridge-base-vent', 'metal', c.px + c.sw * .25, .12 + vent * .024, pz + sd / 2 + .040, c.sw * .28, .009, .007);
    box('oven-handle', 'metal', c.px - c.sw * .25, .49, pz + sd / 2 + .05, c.sw * .28, .025, .023);
    for (const offset of [-.09, .09]) cylinder('oven-control', 'stone', c.px - c.sw * .25 + offset * c.sw, .54, pz + sd / 2 + .04, .016, .015);
    // A shallow microwave cabinet is physically fixed to the rear backsplash wall.
    const applianceZ = pz - sd * .16;
    box('microwave-cabinet', 'porcelain', c.px, 1.10, applianceZ, c.sw * .82, .25, sd * .65);
    box('microwave-window', 'metal', c.px - c.sw * .06, 1.10, applianceZ + sd * .33, c.sw * .52, .17, .015);
    box('microwave-control-panel', 'aqua', c.px + c.sw * .29, 1.10, applianceZ + sd * .34, c.sw * .11, .15, .017);
    for (const support of [-1, 1]) box('appliance-wall-bracket', 'metal', c.px + support * c.sw * .27, 1.07, pz - sd * .46, .025, .35, .08);
    const radius = Math.min(.065, c.sw * .16);
    emit('curved-faucet', new TorusGeometry(radius, .01, 5, 10, Math.PI).rotateY(Math.PI / 2), 'metal', sinkX, .72, pz - sd * .23);
    cylinder('faucet-base', 'metal', sinkX, .70, pz - sd * .23 - radius, .014, .07);
    box('kitchen-backsplash', 'porcelain', c.px, .83, pz - sd * .48, c.sw, .32, .025);
  };
  const shelf = (side: number, pz: number) => {
    const sw = Math.min(.65, zone * .88), px = side * (w / 2 - .04 - sw / 2), sd = Math.min(.22, d * .17), sh = Math.min(1.13, tall);
    for (const dx of [-.47, .47]) box('bookcase-upright', 'wood', px + dx * sw, sh / 2, pz, .025, sh, sd);
    for (let level = 0; level < 3; level++) {
      const floor = .06 + level * (sh - .14) / 3;
      box('bookcase-shelf', 'wood', px, floor, pz, sw, .025, sd);
      for (let n = 0; n < 3; n++) {
        const bh = .13 + (n + seed + level) % 3 * .025;
        box('upright-book-pages', 'porcelain', px + (n - 1) * sw * .26, floor + .025 + bh / 2, pz, sw * .18, bh, sd * .72);
        box('colored-book-spine', (n + level) % 2 ? accent : 'fabric', px + (n - 1) * sw * .26, floor + .025 + bh / 2, pz + sd * .38, sw * .19, bh, .014);
      }
    }
  };
  const workstation = (side: number) => {
    const sw = Math.min(.98, zone - .08), sd = .52;
    const px = side * (w / 2 - .065 - sw / 2), pz = -d / 2 + sd / 2 + .07;
    box('dining-tabletop', 'wood', px, .62, pz, sw, .055, sd);
    for (const dx of [-.43, .43]) for (const dz of [-.38, .38]) box('desk-leg', 'metal', px + dx * sw, .2975, pz + dz * sd, .035, .595, .035);
    box('workshop-monitor', 'metal', px, .91, pz - .08, sw * .57, .33, .045);
    box('monitor-screen', 'aqua', px, .91, pz - .053, sw * .51, .27, .012);
    box('monitor-stand', 'metal', px, .73, pz - .08, .036, .20, .05);
    box('monitor-foot', 'metal', px, .659, pz - .065, .17, .025, .12);
    box('keyboard-base', 'metal', px - sw * .05, .660, pz + .13, sw * .43, .020, .115);
    for (let row = 0; row < 3; row++) for (let key = 0; key < 7; key++) box('keyboard-key', 'porcelain', px - sw * .05 + (key - 3) * sw * .048, .674, pz + .10 + row * .030, sw * .038, .008, .021);
    soft('computer-mouse', 'porcelain', px + sw * .32, .675, pz + .13, .052, .035, .085);
    lamp(px - sw * .38, .6475, pz - .015, .16);
    const towerX = px + side * sw * .33;
    box('computer-tower', 'metal', towerX, .24, pz, .17, .48, .32);
    box('computer-front', 'porcelain', towerX, .24, pz + .166, .14, .43, .012);
    for (let vent = 0; vent < 5; vent++) box('computer-vent', 'metal', towerX, .15 + vent * .034, pz + .175, .09, .013, .008);
    box('computer-power-light', 'aqua', towerX, .40, pz + .176, .015, .018, .009);
    const chairZ = pz + .55;
    cylinder('chair-column', 'metal', px, .2035, chairZ, .026, .243);
    for (let leg = 0; leg < 5; leg++) {
      const angle = leg * Math.PI * 2 / 5;
      emit('chair-base-spoke', new BoxGeometry(.18, .026, .027).rotateY(-angle), 'metal', px + Math.cos(angle) * .085, .069, chairZ + Math.sin(angle) * .085);
      emit('chair-caster', new CylinderGeometry(.028, .028, .026, 8).rotateX(Math.PI / 2), 'metal', px + Math.cos(angle) * .16, .028, chairZ + Math.sin(angle) * .16);
    }
    soft('task-chair-seat', 'fabric', px, .37, chairZ, .40, .09, .39);
    box('chair-back-support', 'metal', px, .48, chairZ + .155, .035, .35, .035);
    soft('task-chair-back', 'fabric', px, .60, chairZ + .19, .37, .40, .075);
    for (const arm of [-1, 1]) {
      box('chair-arm-support', 'metal', px + arm * .19, .45, chairZ, .025, .18, .025);
      soft('chair-armrest', 'metal', px + arm * .19, .54, chairZ, .055, .035, .23);
    }
    box('office-pinboard-frame', 'wood', px, 1.29, -d / 2 + .035, sw * .88, .38, .036);
    box('office-pinboard', 'fabric', px, 1.29, -d / 2 + .057, sw * .81, .32, .014);
    for (let note = 0; note < 3; note++) box('pinned-note', note % 2 ? 'porcelain' : 'aqua', px + (note - 1) * sw * .20, 1.29 + (note % 2 ? .045 : -.025), -d / 2 + .069, .11, .14, .008);
  };
  const officeStorage = (side: number) => {
    const sw = Math.min(.48, zone * .35), px = side * (aisle + .08 + sw / 2), pz = -d / 2 + .20;
    box('file-cabinet', 'wood', px, .37, pz, sw, .74, .31);
    for (let drawer = 0; drawer < 3; drawer++) {
      const py = .14 + drawer * .225;
      box('file-drawer', 'porcelain', px, py, pz + .165, sw * .88, .20, .025);
      box('file-label', 'aqua', px, py + .035, pz + .18, sw * .31, .035, .008);
      box('file-drawer-pull', 'metal', px, py - .025, pz + .188, sw * .35, .018, .021);
    }
    book(px, .74, pz, sw * .74, .20, seed);
    // A tall shallow bookcase occupies the front end of the working wall.
    const sx = side * (w / 2 - .04 - .28), shelfZ = d / 2 - .17;
    for (const edge of [-1, 1]) box('office-bookshelf-side', 'wood', sx + edge * .27, .65, shelfZ, .026, 1.30, .23);
    for (let level = 0; level < 4; level++) {
      const floor = .04 + level * .30;
      box('office-bookshelf', 'wood', sx, floor, shelfZ, .56, .026, .23);
      for (let bookIndex = 0; bookIndex < 5; bookIndex++) {
        const bx = sx + (bookIndex - 2) * .095, bh = .17 + (bookIndex + seed) % 3 * .022;
        box('office-book', bookIndex % 2 ? 'fabric' : 'porcelain', bx, floor + .02 + bh / 2, shelfZ, .067, bh, .17);
      }
    }
  };
  const domestic = ['terraced-apartments', 'narrow-mixed-use', 'split-wings', 'rounded-housing', 'greenhouse-residences', 'split-level-homes', 'waterfront-rowhouses', 'stacked-maisonettes'].includes(building.family);
  const side = seed % 2 ? -1 : 1;
  if (domestic) {
    // Every dwelling is a furnished studio: the sleeping zone is always present,
    // with its headboard against the rear enclosure and a reading fixture attached.
    sleeping(side);
    const cabinetDepth = Math.min(.34, d * .20);
    if (scheme !== 2) {
      const wardrobe = cabinet(-side, -d / 2 + cabinetDepth / 2 + .04, tall, cabinetDepth);
      book(wardrobe.px, tall, -d / 2 + cabinetDepth / 2 + .04, wardrobe.sw * .50, cabinetDepth * .55, seed);
    }
    if (scheme === 1 || scheme === 4) {
      lounge(-side);
      // A small occasional table sits beside the bed's foot, outside the walking lane.
      if (d > 2.02) {
        const tableWidth = Math.min(.28, zone * .4), tableZ = d / 2 - .21;
        const px = side * (w / 2 - .04 - tableWidth / 2);
        box('bedside-table', 'wood', px, .21, tableZ, tableWidth, .42, .28);
        book(px, .42, tableZ, tableWidth * .80, .15, seed);
      }
    } else if (scheme === 2) {
      // This wall has enough run for a compact kitchenette and a front dining setting.
      kitchen(-side);
      dining(-side);
    } else {
      const tableWidth = Math.min(.52, zone * .80), tableZ = .02;
      const px = -side * (w / 2 - .04 - tableWidth / 2);
      box('bedside-table', 'wood', px, .22, tableZ, tableWidth, .44, .34);
      box('bedside-drawer', accent, px, .28, tableZ + .18, tableWidth * .82, .15, .022);
      lamp(px, .44, tableZ, .18);
      book(px, .44, tableZ - .10, tableWidth * .54, .15, seed);
      shelf(-side, d / 2 - .16);
    }
  } else if (building.family === 'civic-gallery') {
    for (const side of [-1, 1]) {
      const px = side * center;
      box('gallery-plinth', 'stone', px, .26, -d * .24, zone * .75, .52, Math.min(.42, d * .25));
      emit('gallery-sculpture', new TorusGeometry(Math.min(zone * .25, .17), .038, 6, 15).rotateY(side * .3), 'aqua', px, .76, -d * .24);
    }
    lounge(-1); dining(1);
    // A complete community gallery has framed work, physical exhibits and a reading table.
    for (const side of [-1, 1]) {
      const px = side * center, frameWidth = Math.min(.82, zone * .76), rear = -d / 2 + .035;
      box('gallery-art-frame', 'metal', px, 1.04, rear, frameWidth, .64, .045);
      box('gallery-art-mat', 'porcelain', px, 1.04, rear + .027, frameWidth * .91, .55, .015);
      box('gallery-art-print', 'fabric', px, 1.04, rear + .038, frameWidth * .73, .40, .012);
      for (let stripe = 0; stripe < 3; stripe++) box('gallery-print-relief', 'aqua', px + (stripe - 1) * frameWidth * .15, 1.04 + (stripe % 2 ? .045 : -.035), rear + .048, frameWidth * .065, .24 - stripe * .04, .012);
    }
    lamp(-center, 0, d * .28, .20);
  } else if (building.family === 'winter-glasshouse') {
    for (const side of [-1, 1]) {
      const px = side * center;
      box('raised-growing-bed', 'stone', px, .19, -d * .2, zone * .85, .38, d * .45);
      box('growing-soil', 'wood', px, .39, -d * .2, zone * .79, .02, d * .40);
      for (let n = 0; n < 4; n++) { const pz = -d * .38 + n * d * .12; cylinder('plant-stem', 'wood', px, .54, pz, .013, .30); soft('conservatory-leaves', 'garden', px, .64, pz, zone * .62, .30, d * .13); }
    }
    dining(1);
  } else if (building.family === 'public-station') {
    // The narrow station lobby gets wall-side perches, not a miniaturized domestic sofa.
    for (const side of [-1, 1]) {
      const px = side * center, length = Math.min(.7, d * .48);
      box('waiting-perch-base', 'wood', px, .20, 0, zone * .84, .40, length);
      soft('waiting-perch-seat', 'fabric', px, .43, 0, zone * .94, .08, length);
      box('waiting-perch-back', 'wood', px + side * zone * .42, .60, 0, zone * .10, .38, length);
    }
  } else {
    workstation(side);
    kitchen(-side);
    officeStorage(side);
    lounge(-side);
    // A small discussion table complements seating without claiming the door-to-lift lane.
    const meetingX = -side * (aisle + .31), meetingZ = d / 2 - .56;
    cylinder('meeting-table-foot', 'metal', meetingX, .025, meetingZ, .12, .05);
    cylinder('meeting-table-column', 'metal', meetingX, .24, meetingZ, .026, .43);
    cylinder('meeting-tabletop', 'wood', meetingX, .46, meetingZ, .23, .045);
    book(meetingX, .484, meetingZ, .18, .18, seed);
    cylinder('meeting-cup', 'porcelain', meetingX + .12, .525, meetingZ + .06, .033, .08);
  }
  // Flush ceiling fixture stays above headroom and does not introduce an aisle obstruction.
  box('ceiling-diffuser', 'porcelain', 0, height - .0175, 0, Math.min(.28, w * .3), .035, Math.min(.22, d * .24));
}
