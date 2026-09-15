'use client';

// Three.js renderer and material objects are imperative resources owned by Fiber.
/* eslint-disable react-hooks/immutability */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { lowerQuality, world, type QualityTier, type SceneRuntime } from '@/content/world';
import { auditing, renderAudit } from './renderDiagnostics';

export function QualityController({ runtime, tier, onTier, paused, mobile }: { runtime: MutableRefObject<SceneRuntime>; tier: QualityTier; onTier: (tier: QualityTier) => void; paused: boolean; mobile: boolean }) {
  const lastDowngrade = useRef(0);
  const stressStep = useRef(-1);
  const stress = useRef(false);
  const sample = useRef({ seconds: 0, frames: 0, slowWindows: 0 });
  const output = useRef<HTMLElement | null>(null);
  const { gl, camera, setDpr, setFrameloop, invalidate } = useThree();
  useEffect(() => {
    const update = () => {
      const dpr = Math.min(window.devicePixelRatio, world.quality[tier].dpr, mobile ? 1.25 : 1.75);
      if (gl.getPixelRatio() !== dpr) { renderAudit.dprChanges++; setDpr(dpr); invalidate(); }
    };
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [gl, tier, mobile, setDpr, invalidate]);
  useEffect(() => {
    renderAudit.qualityChanges++;
    gl.shadowMap.enabled = world.quality[tier].shadows;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, tier, invalidate]);
  useEffect(() => {
    const update = () => { renderAudit.frameLoopChanges++; setFrameloop(document.hidden ? 'never' : paused ? 'demand' : 'always'); if (!document.hidden) invalidate(); };
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [paused, setFrameloop, invalidate]);
  useEffect(() => { output.current = document.querySelector('[data-scene-diagnostics]'); stress.current = auditing() && new URLSearchParams(window.location.search).has('stress'); }, []);
  useFrame((_, delta) => {
    // Observe only. Fiber owns the sole screen render after all subscribers finish.
    if (stress.current) {
      const step = Math.min(6, Math.floor(runtime.current.elapsed / 12));
      if (stressStep.current !== step) { stressStep.current = step; onTier((['high','medium','low'] as const)[step % 3]); }
    }
    const state = sample.current;
    state.seconds += Math.min(delta, .1); state.frames++;
    if (state.seconds < 1) return;
    const fps = Math.round(state.frames / state.seconds);
    if (!paused && runtime.current.elapsed - lastDowngrade.current >= 8 && fps < 30) state.slowWindows++; else state.slowWindows = 0;
    if (state.slowWindows >= 6 && tier !== 'low') { state.slowWindows = 0; lastDowngrade.current = runtime.current.elapsed; onTier(lowerQuality(tier)); }
    if (output.current && auditing()) output.current.textContent = JSON.stringify({ tier, fps, calls: gl.info.render.calls, triangles: gl.info.render.triangles, dpr: gl.getPixelRatio(), frames: runtime.current.frames, elapsed: +runtime.current.elapsed.toFixed(2), camera: camera.position.toArray().map(n => +n.toFixed(2)), clouds: runtime.current.cloudInteraction, plants: runtime.current.plantInteraction, ripple: runtime.current.ripple.serial, paused, audit: renderAudit });
    state.seconds = 0; state.frames = 0;
  });
  return null;
}
