// Reproducible CC0 surface preparation; original downloads remain in ignored .tmp.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const surfaces = { sand: 'coast_sand_rocks_02', forest: 'forrest_ground_01', cedar: 'wood_floor_deck', mineral: 'concrete_wall_006' };
await mkdir('public/materials', { recursive: true });
await mkdir('.tmp/assets', { recursive: true });
const manifest = [];
for (const [name, asset] of Object.entries(surfaces)) {
  const response = await fetch(`https://api.polyhaven.com/files/${asset}`);
  if (!response.ok) throw new Error(`Asset metadata failed: ${asset}`);
  const metadata = await response.json();
  for (const [channel, key] of [['color', 'Diffuse'], ['normal', 'nor_gl'], ['arm', 'arm']]) {
    const source = metadata[key]['1k'].jpg;
    const download = await fetch(source.url);
    if (!download.ok) throw new Error(`Asset download failed: ${source.url}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    await writeFile(`.tmp/assets/${name}-${channel}.jpg`, bytes);
    const output = `public/materials/${name}-${channel}.webp`;
    let prepared = sharp(bytes).resize(512,512);
    if (channel === 'color' && name === 'mineral') prepared = prepared.modulate({ saturation: .12 }).linear(.60, 130);
    if (channel === 'color' && name === 'cedar') prepared = prepared.modulate({ brightness: 1.45, saturation: .72 });
    await prepared.webp({ quality: channel === 'normal' ? 88 : 82, effort: 6 }).toFile(output);
    manifest.push({ file: output, asset, source: source.url, license: 'CC0-1.0', size: (await sharp(output).metadata()).size });
  }
}
await writeFile('public/materials/sources.json', JSON.stringify({license:'https://polyhaven.com/license', processing:'1K JPEG sources resized to 512×512 WebP; mineral albedo neutralized/lightened for pearlescent aggregate; timber albedo brightened/desaturated; color sRGB, OpenGL normals and packed AO/roughness/metal linear.', files:manifest},null,2)+'\n');
console.log(manifest);
