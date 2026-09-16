import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { landDistance } from '../src/components/world/terrain';
import { coastExposure } from '../src/components/world/waves';

// Deterministic coast data belongs in the static export, not the startup task.
const width = 640;
const pixels = Buffer.alloc((width * 4 + 1) * width);
for (let row = 0; row < width; row++) for (let col = 0; col < width; col++) {
  const x = -100 + col / (width - 1) * 180;
  const z = -120 + row / (width - 1) * 180;
  const distance = landDistance(x, z);
  const value = Math.round(Math.max(0, Math.min(1, (distance + 32) / 64)) * 255);
  const offset = row * (width * 4 + 1) + 1 + col * 4;
  pixels.set([value, Math.round(coastExposure(x, z, distance) * 255), value, 255], offset);
}
function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width); header.writeUInt32BE(width, 4); header[8] = 8; header[9] = 6;
writeFileSync('public/coast-field.png', Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
