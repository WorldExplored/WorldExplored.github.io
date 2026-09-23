import { BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { combine } from './BuildingKit';

export interface FacadeGardenOptions { width: number; height: number; seed: number }

/** Wall-mounted espalier: a rooted trunk, branched canopy, cupped grape leaves and fruit. */
export function createFacadeGarden({ width, height, seed }: FacadeGardenOptions) {
  const wood: BufferGeometry[] = [], foliage: BufferGeometry[] = [], light: BufferGeometry[] = [], fruit: BufferGeometry[] = [], trellis: BufferGeometry[] = [];
  const noise = (i: number) => { const value = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return value - Math.floor(value); };
  const tube = (points: Vector3[], radius: number) => new TubeGeometry(new CatmullRomCurve3(points), 10, radius, 5, false);
  // The planter bottom is the mounting floor; neither containers nor roots float.
  const planter = new BoxGeometry(width + .12, .24, .34).translate(0, .12, -.14);
  planter.userData.facadeGarden = { role: 'root-container', seed, floor: 0, width, height };
  wood.push(new BoxGeometry(width + .04, .025, .26).translate(0, .25, -.14));
  for (const side of [-1, 1]) trellis.push(new BoxGeometry(.035, height - .24, .035).translate(side * width * .44, (height + .24) / 2, .07));
  for (let y = .44; y < height; y += .4) trellis.push(new BoxGeometry(width, .023, .025).translate(0, y, .07));
  const trunk = (t: number) => new Vector3(Math.sin(t * 8 + seed) * width * .075, .25 + t * (height - .38), -.13 + Math.min(1, t * 5) * .23 + Math.sin(t * 9) * .025);
  wood.push(tube(Array.from({ length: 9 }, (_, i) => trunk(i / 8)), .021));
  const count = Math.max(5, Math.ceil(height / .36));
  for (let branch = 0; branch < count; branch++) {
    const side = branch % 2 ? 1 : -1;
    const start = trunk(.1 + branch / count * .78);
    const end = new Vector3(side * width * (.37 + noise(branch) * .08), Math.min(height - .12, start.y + .22 + noise(branch + 12) * .22), .14);
    const middle = start.clone().lerp(end, .45).add(new Vector3(0, .04, .045));
    const curve = new CatmullRomCurve3([start, middle, end]);
    wood.push(new TubeGeometry(curve, 7, .01, 4, false));
    for (let leaf = 0; leaf < 7; leaf++) {
      const index = branch * 7 + leaf, t = .15 + leaf / 7 * .85;
      const position = curve.getPoint(t);
      const size = (.18 + noise(index + 51) * .1) * Math.min(1, width / .65);
      // Five lobes surround a raised central vein; non-flat leaves catch different light.
      const outline = [[0, 0], [-.4, .14], [-.65, .42], [-.36, .44], [-.5, .76], [-.2, .68], [0, 1], [.2, .68], [.5, .76], [.36, .44], [.65, .42], [.4, .14]];
      const vertices = [0, size * .47, size * .18, ...outline.flatMap(([x, y]) => [x * size, y * size, 0])];
      const indices: number[] = [];
      for (let edge = 0; edge < outline.length; edge++) indices.push(0, edge + 1, (edge + 1) % outline.length + 1);
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new Float32BufferAttribute([.5, .47, ...outline.flatMap(([x, y]) => [x + .5, y])], 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      geometry.rotateZ((leaf % 2 ? -1 : 1) * (.8 + noise(index + 81) * 1.3)).rotateY((noise(index + 103) - .5) * 1.1).translate(position.x, position.y, position.z + .06);
      geometry.userData.facadeGarden = { role: 'leaf', seed };
      (index % 4 === 0 ? light : foliage).push(geometry);
    }
    if (branch % 3 === seed % 3) for (let grape = 0; grape < 9; grape++) {
      const row = Math.floor(grape / 3), angle = grape * 2.399, radius = .05 * (1 - row * .22);
      fruit.push(new SphereGeometry(.03, 6, 4).translate(end.x * .72 + Math.cos(angle) * radius, end.y - .06 - row * .05, .24 + Math.sin(angle) * radius));
    }
  }
  const tint = (parts: BufferGeometry[], hex: string) => {
    const geometry = combine(parts), color = new Color(hex), values = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) { values[i] = color.r; values[i + 1] = color.g; values[i + 2] = color.b; }
    geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
    return geometry;
  };
  return { planter, wood: combine(wood), trellis: combine(trellis), foliage: tint(foliage, '#3c922f'), light: tint(light, '#78ad3b'), fruit: tint(fruit, '#503663') };
}
