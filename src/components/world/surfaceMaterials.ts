import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three';

export type SurfaceName = 'mineral' | 'sand' | 'forest' | 'cedar';
export const surfacePalette = {
  porcelain: '#edf6ef', cobalt: '#1262c4', aqua: '#06abc1', glazing: '#124b62',
  lime: '#83b92b', foliage: '#287843', youngLeaf: '#58a432', cedar: '#986345',
  sand: '#cfb785', promenade: '#ccd7d1', shadow: '#163b51',
} as const;
export const SURFACES_READY = 'portfolio:surfaces-ready';
const textures = new Map<string, Texture>();

/** Shared, bounded texture cache. No browser I/O during server rendering or tests. */
export function surfaceTexture(surface: SurfaceName, channel: 'color' | 'normal' | 'arm', repeat = 1) {
  if (typeof document === 'undefined') return null;
  const key = `${surface}/${channel}/${repeat}`;
  const found = textures.get(key);
  if (found) return found;
  const texture = new TextureLoader().load(`/materials/${surface}-${channel}.webp`, () => window.dispatchEvent(new Event(SURFACES_READY)));
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
