import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three';

export type SurfaceName = 'mineral' | 'sand' | 'forest' | 'cedar' | 'grass';
export const surfacePalette = {
  porcelain: '#edf6ef', cobalt: '#1262c4', aqua: '#06abc1', glazing: '#124b62',
  lime: '#83b92b', foliage: '#287843', youngLeaf: '#58a432', cedar: '#986345',
  sand: '#cfb785', promenade: '#ccd7d1', shadow: '#163b51',
} as const;
export const SURFACES_READY = 'portfolio:surfaces-ready';
export const SURFACE_LOAD_TIMEOUT_MS = 8000;
type SurfaceChannel = 'color' | 'normal' | 'arm';
const textures = new Map<string, Texture>();
const sources = new Map<string, Texture>();
const fallbacks = new Map<SurfaceChannel, HTMLCanvasElement>();
let pending = 0;
export function surfaceLoadsPending() { return pending; }

function fallbackImage(channel: SurfaceChannel) {
  let image = fallbacks.get(channel);
  if (!image) {
    image = document.createElement('canvas'); image.width = image.height = 1;
    const context = image.getContext('2d');
    if (context) { context.fillStyle = channel === 'normal' ? '#8080ff' : '#ffffff'; context.fillRect(0, 0, 1, 1); }
    fallbacks.set(channel, image);
  }
  return image;
}

/** Start only the channels used by the scene, alongside its layout download. */
export function preloadSurfaceTextures() {
  for (const surface of ['mineral', 'cedar', 'grass'] as const) {
    for (const channel of ['color', 'normal', 'arm'] as const) surfaceTexture(surface, channel);
  }
  surfaceTexture('sand', 'color'); surfaceTexture('forest', 'color');
}

/** Shared, bounded texture cache. No browser I/O during server rendering or tests. */
export function surfaceTexture(surface: SurfaceName, channel: SurfaceChannel, repeat = 1) {
  if (typeof document === 'undefined') return null;
  const key = `${surface}/${channel}/${repeat}`;
  const found = textures.get(key);
  if (found) return found;
  const sourceKey = `${surface}/${channel}`;
  let source = sources.get(sourceKey);
  if (!source) {
    pending++;
    let complete = false;
    const settled = (failed = false) => {
      if (failed && source && !source.image) source.image = fallbackImage(channel);
      if (!complete) { complete = true; pending--; clearTimeout(deadline); }
      // A late successful image replaces the neutral fallback without another
      // decrement or material/shader rebuild. Variants share this source.
      for (const [variant, texture] of textures) if (variant.startsWith(`${sourceKey}/`)) texture.needsUpdate = true;
      window.dispatchEvent(new Event(SURFACES_READY));
    };
    const deadline = setTimeout(() => settled(true), SURFACE_LOAD_TIMEOUT_MS);
    source = new TextureLoader().load(`/materials/${surface}-${channel}.webp`, () => settled(), undefined, () => settled(true));
    sources.set(sourceKey, source);
  }
  // Repeat transforms differ; decoded image data and GPU texture source do not.
  const texture = source.clone();
  if (!source.image) texture.version = 0;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  if (channel === 'color') texture.colorSpace = SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

/** Color + OpenGL normal + packed AO/roughness maps, all at 512px with mipmaps. */
export function applySurface<T extends MeshStandardMaterial>(material: T, surface: SurfaceName, repeat = 1): T {
  material.map = surfaceTexture(surface, 'color', repeat);
  if (surface === 'cedar') material.color.set('#fff1d9');
  material.normalMap = surfaceTexture(surface, 'normal', repeat);
  material.normalScale = new Vector2(surface === 'cedar' ? .24 : .42, surface === 'cedar' ? .24 : .42);
  material.aoMap = material.roughnessMap = surfaceTexture(surface, 'arm', repeat);
  material.aoMapIntensity = .48;
  material.roughness = .94;
  material.needsUpdate = true;
  return material;
}
