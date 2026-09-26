// Opt-in development capture. No logging, network requests, or production controls.
export const renderAudit = {
  rendererCreations: 0, configurations: 0, resizes: 0, dprChanges: 0,
  qualityChanges: 0, frameLoopChanges: 0, contextLosses: 0, contextRestorations: 0,
  sceneErrors: 0, unhandledErrors: 0, samples: 0, blackFrames: 0,
  worstBlackFraction: 0, firstSample: 0, lastSample: 0,
};
export function auditing() { return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('diagnostics'); }
export function sampleFrame(context: WebGL2RenderingContext) {
  const now = performance.now();
  if (now - renderAudit.lastSample < 180 || context.isContextLost()) return;
  const width = context.drawingBufferWidth, height = context.drawingBufferHeight;
  if (!width || !height) return;
  const pixel = new Uint8Array(4);
  let black = 0;
  // Grid covers the actual drawing buffer, including its edges.
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
    context.readPixels(Math.floor((x + .5) * width / 12), Math.floor((y + .5) * height / 8), 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
    if (pixel[3] > 240 && pixel[0] < 15 && pixel[1] < 15 && pixel[2] < 15) black++;
  }
  const fraction = black / 96;
  renderAudit.samples++;
  renderAudit.firstSample ||= now;
  renderAudit.lastSample = now;
  renderAudit.worstBlackFraction = Math.max(renderAudit.worstBlackFraction, fraction);
  if (fraction > .8) renderAudit.blackFrames++;
}

export const constructionTimes: Record<string, number> = {};

/** Measure construction only when explicitly inspecting a local or published build. */
export function measureConstruction<T>(name: string, create: () => T): T {
  if (!auditing()) return create();
  const start = performance.now();
  try { return create(); }
  finally { const end = performance.now(); constructionTimes[name] = Math.round((constructionTimes[name] ?? 0) + end - start); performance.measure(`world:${name}`, { start, end }); }
}
