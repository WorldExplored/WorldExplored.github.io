import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { world } from '../../content/world';

export type Island = (typeof world.islands)[number];

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function shoreRadius(angle: number, seed: number) {
  return 1 + Math.sin(angle * 3 + seed) * 0.06 + Math.cos(angle * 5 - seed) * 0.035;
}

export function terrainHeight(radius: number, height: number) {
  return height * (1 - Math.pow(radius, 3.6)) + 0.09;
}

export function islandGeometry(island: Island, seed: number, segments = 48) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const rings = 14;
  const green = new Color(world.colors.grass);
  const lime = new Color(world.colors.grassLight);
  const sand = new Color(world.colors.sand);
  const stone = new Color(world.colors.stone);
  const color = new Color();
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings * 1.06;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const r = radius * shoreRadius(angle, seed);
      positions.push(Math.cos(angle) * r * island.radius[0], terrainHeight(radius, island.height), Math.sin(angle) * r * island.radius[1]);
      const variation = (Math.sin(angle * 4 + radius * 12 + seed) + 1) * 0.15;
      if (radius < 0.87) color.copy(green).lerp(lime, variation + 0.15);
      else color.copy(sand).lerp(stone, Math.max(0, radius - 0.92) * 4);
      colors.push(color.r, color.g, color.b);
      if (ring < rings && segment < segments) {
        const a = ring * (segments + 1) + segment;
        const b = a + 1;
        const c = a + segments + 1;
        indices.push(a, b, c, b, c + 1, c);
      }
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
