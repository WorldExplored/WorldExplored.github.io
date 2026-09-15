import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAudit, sampleFrame } from '../src/components/world/renderDiagnostics';

test('black-frame capture rejects opaque black but accepts the transparent sky fallback', t => {
  let now = 200;
  t.mock.method(performance, 'now', () => now);
  let rgba = [50, 155, 220, 255];
  let reads = 0;
  const context = { drawingBufferWidth: 1440, drawingBufferHeight: 900, RGBA: 6408, UNSIGNED_BYTE: 5121,
    isContextLost: () => false,
    readPixels(x: number, y: number, _w: number, _h: number, _format: number, _type: number, pixel: Uint8Array) {
      assert.ok(x >= 0 && x < 1440 && y >= 0 && y < 900); pixel.set(rgba); reads++;
    },
  } as unknown as WebGL2RenderingContext;
  sampleFrame(context);
  assert.equal(renderAudit.samples, 1); assert.equal(renderAudit.blackFrames, 0); assert.equal(reads, 96);
  now += 200; rgba = [0, 0, 0, 255]; sampleFrame(context);
  assert.equal(renderAudit.blackFrames, 1); assert.equal(renderAudit.worstBlackFraction, 1);
  now += 200; rgba = [0, 0, 0, 0]; sampleFrame(context);
  assert.equal(renderAudit.blackFrames, 1, 'Transparent pixels expose the CSS sky, not black.');
  sampleFrame(context); assert.equal(renderAudit.samples, 3, 'Sampling has a bounded cadence.');
});
