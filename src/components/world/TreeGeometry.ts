import { BufferGeometry, CatmullRomCurve3, Color, DataTexture, Float32BufferAttribute, Object3D, RepeatWrapping, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function treeBranches(form: number) {
  // Broad coastal oak, ascending alder, and wind-shaped multi-leader tree.
  return Array.from({ length: 9 }, (_, index) => {
    const angle = index * 2.399 + form * .37;
    const tier = Math.floor(index / 3);
    const level = (form === 1 ? .29 : .32) + tier * .16 + index % 3 * .035;
    const spread = (form === 0 ? .31 - tier * .055 : form === 1 ? .19 - tier * .025 : .27 - tier * .045);
    const tip = new Vector3(Math.cos(angle) * spread + (form === 2 ? .065 : 0), level + .18 + (form === 1 ? .075 : 0), Math.sin(angle) * spread);
    return { angle, level, tip, size: form === 0 ? .205 : form === 1 ? .17 : .19 };
  });
}

/** Cupped leaves with a raised midrib, alternating venation and a connected twig skeleton. */
export function treeFoliageGeometry() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], uvs: number[] = [];
  const transform = new Object3D(), point = new Vector3();
  for (let index = 0; index < 64; index++) {
    const t = (index + .5) / 64, a = index * 2.399;
    const r = Math.sqrt(1 - (t * 2 - 1) ** 2);
    transform.position.set(Math.cos(a) * r * .9, (t * 2 - 1) * .68, Math.sin(a) * r * .85);
    transform.rotation.set(Math.sin(a * 1.7) * .5, a, Math.cos(a) * .45); transform.updateMatrix();
    const length = .25 + .08 * Math.sin(index * 17.3), breadth = .105 + .025 * Math.cos(index * 3.7);
    const start = positions.length / 3;
    for (let row = 0; row <= 4; row++) for (let col = 0; col <= 2; col++) {
      const u = row / 4, v = col - 1;
      const width = Math.pow(Math.sin(Math.PI * u), .8) * breadth * (1 + .055 * Math.sin(u * 35));
      point.set(v * width, Math.sin(Math.PI * u) * (.027 * (1 - Math.abs(v)) - .02 * v * v), (u - .2) * length).applyMatrix4(transform.matrix);
      positions.push(point.x, point.y, point.z);uvs.push((v+1)/2,u);
      const vein = col === 1 || Math.abs(Math.sin(u * 25 - Math.abs(v) * 3)) < .24;
      const shade = .73 + .22 * t + (vein ? .12 : 0);
      colors.push(shade * .77, shade, shade * .62);
      if (row && col) { const at = start + row * 3 + col; indices.push(at, at - 3, at - 1, at - 1, at - 3, at - 4); }
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
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
  wood.push(branch([new Vector3(0, -.02, 0), new Vector3(.018, .28, -.015), new Vector3(-.025, .58, .012), new Vector3(form === 2 ? .09 : .025, form === 1 ? 1.04 : .9, 0)], .047, .005));
  for (let root = 0; root < 6; root++) {
    const a = root * Math.PI / 3 + .22;
    wood.push(branch([new Vector3(0, .10, 0), new Vector3(Math.cos(a) * .045, .014, Math.sin(a) * .045), new Vector3(Math.cos(a) * .10, -.018, Math.sin(a) * .10)], .023, .002));
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

/** Shared linear bump/roughness map follows the geometry UV midrib and paired secondary veins. */
export function leafVeinTexture() {
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/(size-1)*2-1,v=y/(size-1);
    const midrib=Math.exp(-u*u*850);
    const phase=v*9-Math.abs(u)*1.6;
    const secondary=Math.exp(-(Math.sin(phase*Math.PI)**2)*95)*(1-Math.abs(u))*.48;
    const grain=Math.sin(x*13.41+y*17.71)*.025;
    const value=Math.round(130+88*(midrib+secondary)+grain*255);
    const at=(y*size+x)*4;pixels.set([Math.min(255,value),Math.min(255,value),Math.min(255,value),255],at);
  }
  const texture=new DataTexture(pixels,size,size);texture.needsUpdate=true;return texture;
}
