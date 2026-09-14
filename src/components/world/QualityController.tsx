'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { lowerQuality, world, type QualityTier, type SceneRuntime } from '@/content/world';

export function QualityController({ runtime, tier, onTier, paused, mobile }: { runtime: MutableRefObject<SceneRuntime>; tier: QualityTier; onTier: (tier: QualityTier) => void; paused: boolean; mobile: boolean }) {
  const last = useRef(0);
  const sample = useRef({ seconds: 0, frames: 0 });
  const output = useRef<HTMLElement | null>(null);
  const { gl, camera, scene, setDpr } = useThree();
  const performanceFactor = useThree(state => state.performance.current);
  useEffect(() => {
    setDpr(Math.max(0.75, Math.min(window.devicePixelRatio, world.quality[tier].dpr, mobile ? 1.25 : 1.75) * performanceFactor));
  }, [tier, mobile, performanceFactor, setDpr]);
  useEffect(() => {
    output.current = document.querySelector<HTMLElement>('[data-scene-diagnostics]');
  }, []);
  useFrame((_, delta) => {
    gl.render(scene, camera);
    sample.current.seconds += delta;
    sample.current.frames++;
    if (sample.current.seconds < 1 && !paused) return;
    const fps = paused ? 0 : Math.round(sample.current.frames / sample.current.seconds);
    const status = { tier, fps, calls: gl.info.render.calls, triangles: gl.info.render.triangles, dpr: Number(gl.getPixelRatio().toFixed(2)), frames: runtime.current.frames, elapsed: Number(runtime.current.elapsed.toFixed(2)), camera: camera.position.toArray().map(value => Number(value.toFixed(2))), ripple: runtime.current.ripple.serial, drags: runtime.current.dragCount, clouds: runtime.current.cloudInteraction, plants: runtime.current.plantInteraction, paused };
    if (output.current) {
      output.current.textContent = JSON.stringify(status);
      output.current.dataset.tier = tier;
    }
    sample.current = { seconds: 0, frames: 0 };
  }, 1);
  function downgrade() {
    if (paused || runtime.current.elapsed - last.current < 8) return;
    last.current = runtime.current.elapsed;
    onTier(lowerQuality(tier));
  }
  return <>{!paused && <PerformanceMonitor ms={500} iterations={6} bounds={() => [38, 58]} onDecline={downgrade} />}</>;
}
