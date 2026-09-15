'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { addAfterEffect, createRoot, events, extend, type RootState } from '@react-three/fiber';
import * as THREE from 'three';
import { createSceneRuntime, world, type QualityTier, type WorldProps } from '@/content/world';
import { AeroWorld } from './AeroWorld';
import { auditing, renderAudit, sampleFrame } from './renderDiagnostics';

extend({ Mesh: THREE.Mesh, Group: THREE.Group, Object3D: THREE.Object3D,
  SphereGeometry: THREE.SphereGeometry, RingGeometry: THREE.RingGeometry, PlaneGeometry: THREE.PlaneGeometry,
  BoxGeometry: THREE.BoxGeometry, ShaderMaterial: THREE.ShaderMaterial, MeshBasicMaterial: THREE.MeshBasicMaterial,
  HemisphereLight: THREE.HemisphereLight, DirectionalLight: THREE.DirectionalLight, PointLight: THREE.PointLight,
  Fog: THREE.Fog, CubeCamera: THREE.CubeCamera });

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { renderAudit.sceneErrors++; this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function WorldCanvas(props: WorldProps) {
  const runtime = useRef(createSceneRuntime());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const stateRef = useRef<RootState | null>(null);
  const latest = useRef(props);
  const [tier, setTier] = useState<QualityTier>(props.mobile ? 'medium' : 'high');
  const [configured, setConfigured] = useState(false);
  useEffect(() => { latest.current = props; });

  useEffect(() => {
    // Delay allocation one frame so React's effect replay can cancel before creating a root.
    let dispose: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      try { dispose = initialize(); }
      catch { renderAudit.sceneErrors++; latest.current.onFailure(); }
    });
    function initialize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;
      let ready = false;
      let previousFrames = 0;
      let context: WebGL2RenderingContext | null = null;
      const unavailable = new URLSearchParams(window.location.search).get('scene') === 'unavailable';
      try { context = unavailable ? null : canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance' }); }
      catch { context = null; }
      if (!context) { latest.current.onFailure(); return; }
      const measure = () => canvas.parentElement!.getBoundingClientRect();
      const bounds = measure();
      const size = { width: bounds.width, height: bounds.height, top: bounds.top, left: bounds.left };
      const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
      renderer.setClearColor(world.lighting.horizon, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .96;
      renderAudit.rendererCreations++;
      const root = createRoot(canvas);
      rootRef.current = root;
      const overview = latest.current.mobile ? world.mobileOverview : world.overview;
      // Configure exactly once. Partial configure calls reset DPR, shadows and frameloop.
      renderAudit.configurations++;
      void root.configure({ events, gl: renderer, size,
        scene: { background: new THREE.Color(world.lighting.horizon) },
        camera: { position: overview.position, fov: 43, near: .1, far: 500 },
        dpr: Math.min(window.devicePixelRatio, latest.current.mobile ? 1.25 : 1.75),
        shadows: true, frameloop: 'always',
        onCreated: state => { stateRef.current = state; state.camera.lookAt(...overview.target); },
      }).then(() => { if (!cancelled) setConfigured(true); }).catch(() => { if (!cancelled) latest.current.onFailure(); });
      const observer = new ResizeObserver(() => {
        const state = stateRef.current?.get();
        if (!state || cancelled) return;
        const next = measure();
        if (next.width === state.size.width && next.height === state.size.height) return;
        renderAudit.resizes++;
        state.setSize(next.width, next.height, next.top, next.left);
        state.invalidate();
      });
      observer.observe(canvas.parentElement!);
      const stopSampling = addAfterEffect(() => {
        if (cancelled || runtime.current.frames === previousFrames) return;
        previousFrames = runtime.current.frames;
        if (!ready) { ready = true; latest.current.onReady(); }
        if (auditing()) sampleFrame(context!);
      });
      function lost(event: Event) { event.preventDefault(); renderAudit.contextLosses++; latest.current.onFailure(); }
      function restored() { renderAudit.contextRestorations++; stateRef.current?.invalidate(); }
      function error() { renderAudit.unhandledErrors++; }
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
      window.addEventListener('error', error);
      window.addEventListener('unhandledrejection', error);
      return () => {
        cancelled = true; observer.disconnect(); stopSampling();
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('webglcontextrestored', restored);
        window.removeEventListener('error', error);
        window.removeEventListener('unhandledrejection', error);
        root.unmount(); rootRef.current = null; stateRef.current = null;
      };
    }
    return () => { cancelAnimationFrame(frame); dispose?.(); };
  }, []);

  useEffect(() => {
    if (!configured) return;
    rootRef.current?.render(<SceneBoundary onFailure={props.onFailure}><AeroWorld {...props} runtime={runtime} tier={tier} onTier={setTier} /></SceneBoundary>);
  }, [configured, props, tier]);

  useEffect(() => {
    function move(event: PointerEvent) {
      const canvas = canvasRef.current;
      const blocking = (event.target as HTMLElement).closest('a,button,.surface,.audio-control');
      runtime.current.pointerActive = !blocking && !latest.current.paused && event.pointerType !== 'touch';
      if (!runtime.current.pointerActive || !canvas) return;
      const bounds = canvas.getBoundingClientRect();
      runtime.current.pointer[0] = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      runtime.current.pointer[1] = 1 - (event.clientY - bounds.top) / bounds.height * 2;
      stateRef.current?.invalidate();
    }
    function focus(event: Event) {
      const element = event.target instanceof Element ? event.target : null;
      const target = element?.closest<HTMLElement>('[data-destination]');
      if (target) runtime.current.hovered = world.landmarks.find(item => item.id === target.dataset.destination)?.id ?? null;
      if (element?.closest('a,button,.surface,.audio-control')) runtime.current.pointerActive = false;
    }
    function leave() { runtime.current.pointerActive = false; runtime.current.hovered = null; }
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', leave);
    document.addEventListener('pointerleave', leave);
    document.addEventListener('focusin', focus);
    document.addEventListener('pointerover', focus);
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('blur', leave);
      document.removeEventListener('pointerleave', leave); document.removeEventListener('focusin', focus); document.removeEventListener('pointerover', focus);
    };
  }, []);
  return <div className="canvas-host" aria-hidden="true" data-quality={tier} data-motion={props.paused ? 'stopped' : 'active'} style={{ background: world.lighting.horizon }}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} /></div>;
}
