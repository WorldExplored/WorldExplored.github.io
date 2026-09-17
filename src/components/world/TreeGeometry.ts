import { BufferGeometry, CatmullRomCurve3, Color, DataTexture, Float32BufferAttribute, RepeatWrapping, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function treeBranches(form: number) {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = index * 2.399 + form * .37;
    const level = .38 + index * .054;
    const spread = (form === 1 ? .19 : form === 2 ? .29 : .25) * (1 - index * .032);
    const tip = new Vector3(Math.cos(angle) * spread, level + .22, Math.sin(angle) * spread);
    return { angle, level, tip, size: form === 1 ? .16 : .15 };
  });
}

/** Taper each branch along its centreline; radial ribs give bark a broken silhouette. */
function branch(points: Vector3[], radius: number, endRadius: number) {
  const curve = new CatmullRomCurve3(points);
  const geometry = new TubeGeometry(curve, 12, 1, 9, false);
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const center = new Vector3(), vertex = new Vector3();
  for (let ring = 0; ring <= 12; ring++) {
    const t = ring / 12;
    curve.getPointAt(t, center);
    for (let side = 0; side <= 9; side++) {
      const i = ring * 10 + side;
      const taper = (radius * Math.pow(1 - t, .72) + endRadius * t) * (1 + Math.sin(side * 4.7 + t * 11) * .1);
      vertex.fromBufferAttribute(position, i).sub(center).multiplyScalar(taper).add(center);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
      const shade = .62 + .25 * (Math.sin(side * 4.7 + t * 7) * .5 + .5);
      const tint = new Color().setRGB(shade, shade * .91, shade * .79);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function treeWoodGeometry(form: number) {
  const wood: BufferGeometry[] = [];
  wood.push(branch([new Vector3(0, -.02, 0), new Vector3(.018, .28, -.015), new Vector3(-.025, .58, .012), new Vector3(.025, .98, 0)], .047, .005));
  for (let root = 0; root < 6; root++) {
    const a = root * Math.PI / 3 + .22;
    wood.push(branch([new Vector3(0, .13, 0), new Vector3(Math.cos(a) * .065, .018, Math.sin(a) * .065), new Vector3(Math.cos(a) * .14, -.012, Math.sin(a) * .14)], .023, .002));
  }
  for (const limb of treeBranches(form)) {
    const start = new Vector3(0, limb.level, 0), middle = limb.tip.clone().multiplyScalar(.6);
    middle.y = limb.level + .09;
    wood.push(branch([start, middle, limb.tip], .019, .003));
    for (const side of [-1, 1]) {
      const fork = limb.tip.clone().add(new Vector3(Math.cos(limb.angle + side * 1.1) * .09, .075, Math.sin(limb.angle + side * 1.1) * .09));
      wood.push(branch([middle, limb.tip.clone().lerp(fork, .6), fork], .008, .001));
    }
  }
  const merged = mergeGeometries(wood)!;
  wood.forEach(part => part.dispose());
  return merged;
}

export function barkTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const groove = Math.sin(x * .64 + Math.sin(y * .09) * .8) + .4 * Math.sin(x * 1.9 + y * .025);
    const value = Math.round(135 + groove * 47 + Math.sin(x * 31.17 + y * 17.41) * 12);
    const i = (y * size + x) * 4;
    pixels.set([value, value, value, 255], i);
  }
  const texture = new DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
