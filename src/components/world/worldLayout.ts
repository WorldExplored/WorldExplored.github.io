import { BufferAttribute, BufferGeometry } from 'three';
import type { PlantPosition } from './terrain';
import { preloadSurfaceTextures } from './surfaceMaterials';

interface LayoutHeader { attributes: { name: string; size: number; count: number }[]; indices: number; plants: number }
const plantKeys = ['x', 'y', 'z', 'scale', 'rotation', 'phase', 'reach'] as const;
let prepared: { ground: BufferGeometry; plants: PlantPosition[] } | undefined;
let loading: Promise<void> | undefined;

/** Compact deterministic terrain is built once at export, instead of on every visit. */
export function encodeWorldLayout(ground: BufferGeometry, plants: PlantPosition[]) {
  const attributes = Object.entries(ground.attributes).map(([name, attribute]) => ({ name, size: attribute.itemSize, count: attribute.count }));
  const header: LayoutHeader = { attributes, indices: ground.index!.count, plants: plants.length };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const offset = Math.ceil((json.length + 4) / 4) * 4;
  const length = attributes.reduce((sum, attribute) => sum + attribute.size * attribute.count, 0) + header.indices + plants.length * plantKeys.length;
  const buffer = new ArrayBuffer(offset + length * 4);
  new DataView(buffer).setUint32(0, json.length, true);
  new Uint8Array(buffer, 4, json.length).set(json);
  let cursor = offset;
  for (const { name, size, count } of attributes) {
    const target = new Float32Array(buffer, cursor, size * count), values = ground.getAttribute(name).array;
    for (let i = 0; i < target.length; i++) target[i] = Math.round(values[i] * 4096) / 4096;
    cursor += size * count * 4;
  }
  new Uint32Array(buffer, cursor, header.indices).set(ground.index!.array); cursor += header.indices * 4;
  const values = new Float32Array(buffer, cursor);
  for (let i = 0; i < plants.length; i++) for (let key = 0; key < plantKeys.length; key++) values[i * plantKeys.length + key] = plants[i][plantKeys[key]];
  return buffer;
}
export function decodeWorldLayout(buffer: ArrayBuffer) {
  const size = new DataView(buffer).getUint32(0, true);
  const header: LayoutHeader = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, size)));
  let cursor = Math.ceil((size + 4) / 4) * 4;
  const ground = new BufferGeometry();
  for (const attribute of header.attributes) {
    ground.setAttribute(attribute.name, new BufferAttribute(new Float32Array(buffer, cursor, attribute.size * attribute.count), attribute.size));
    cursor += attribute.size * attribute.count * 4;
  }
  ground.setIndex(new BufferAttribute(new Uint32Array(buffer, cursor, header.indices), 1)); cursor += header.indices * 4;
  const values = new Float32Array(buffer, cursor), plants: PlantPosition[] = [];
  for (let i = 0; i < header.plants; i++) {
    const plant = {} as PlantPosition;
    plantKeys.forEach((key, k) => { plant[key] = values[i * plantKeys.length + k]; }); plants.push(plant);
  }
  return { ground, plants };
}
export function prepareWorldLayout() {
  loading ??= (async () => {
    preloadSurfaceTextures();
    try {
      const response = await fetch('/world-layout.bin.gz', { signal: AbortSignal.timeout(8000) });
      if (!response.ok || !response.body) return;
      prepared = decodeWorldLayout(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    } catch { /* Local development and older browsers use the procedural fallback. */ }
  })();
  return loading;
}
export function preparedGround() { return prepared?.ground.clone(); }
export function preparedPlants() { return prepared?.plants; }
