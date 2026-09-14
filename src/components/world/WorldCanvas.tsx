'use client';

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot, events, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { createSceneRuntime, world, type QualityTier, type WorldProps } from '@/content/world';
import { AeroWorld } from './AeroWorld';

extend({
  Mesh: THREE.Mesh, Group: THREE.Group, Object3D: THREE.Object3D,
  SphereGeometry: THREE.SphereGeometry, RingGeometry: THREE.RingGeometry,
  PlaneGeometry: THREE.PlaneGeometry, BoxGeometry: THREE.BoxGeometry,
  ShaderMaterial: THREE.ShaderMaterial, MeshBasicMaterial: THREE.MeshBasicMaterial,
  HemisphereLight: THREE.HemisphereLight, DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight, Fog: THREE.Fog, CubeCamera: THREE.CubeCamera,
});

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function WorldCanvas(props: WorldProps) {
  const runtime = useRef(createSceneRuntime());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const rendering = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(props);
  const [tier, setTier] = useState<QualityTier>(props.mobile ? 'medium' : 'high');
  const [visible, setVisible] = useState(true);
  const [configured, setConfigured] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let root: ReturnType<typeof createRoot> | null = null;
    let context: WebGL2RenderingContext | null = null;
    const unavailable = new URLSearchParams(window.location.search).get('scene') === 'unavailable';
    try { context = unavailable ? null : canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { context = null; }
    if (!context) { latest.current.onFailure(); return; }
    const size = () => { const rect = canvas.parentElement!.getBoundingClientRect(); return { width: rect.width, height: rect.height, top: rect.top, left: rect.left }; };
    async function initialize() {
      try {
        root = createRoot(canvas!);
        rootRef.current = root;
        const overview = latest.current.mobile ? world.mobileOverview : world.overview;
        await root.configure({
          events, size: size(),
          gl: { context: context!, antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 },
          camera: { position: overview.position, fov: 43, near: 0.1, far: 350 },
          performance: { min: 0.7, max: 1, debounce: 220 },
          dpr: Math.min(window.devicePixelRatio, latest.current.mobile ? 1.25 : 1.75),
          shadows: true,
          onCreated: ({ camera }) => camera.lookAt(...overview.target),
        });
        if (cancelled) return;
        setConfigured(true);
        latest.current.onReady();
      } catch {
        if (!cancelled) latest.current.onFailure();
      }
    }
    void initialize();
    const observer = new ResizeObserver(() => {
      if (root && !cancelled) void root.configure({ size: size() }).catch(() => latest.current.onFailure());
    });
    observer.observe(canvas.parentElement!);
    const intersect = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' });
    intersect.observe(canvas);
    function lost(event: Event) { event.preventDefault(); latest.current.onFailure(); }
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      cancelled = true;
      observer.disconnect();
      intersect.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      root?.unmount();
      rootRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !configured) return;
    const paused = props.paused || !visible;
    rendering.current = rendering.current.then(async () => {
      if (root !== rootRef.current) return;
      await root.configure({ shadows: world.quality[tier].shadows, frameloop: document.hidden || !visible ? 'never' : paused || props.panelOpen ? 'demand' : 'always' });
      if (root !== rootRef.current) return;
      root.render(<SceneBoundary onFailure={props.onFailure}><Suspense fallback={null}><AeroWorld {...props} paused={paused} runtime={runtime} tier={tier} onTier={setTier} /></Suspense></SceneBoundary>);
    }).catch(() => props.onFailure());
  }, [configured, props, tier, visible]);

  useEffect(() => {
    let stops: { y: number; progress: number }[] = [];
    function measure() {
      const progress = [0.10, 1 / 3, 2 / 3, 0.79, 0.88, 1];
      const ids = ['work', 'research', 'purdue', 'about', 'contact', 'building'];
      stops = [{ y: 0, progress: 0 }, ...ids.flatMap((id, index) => {
        const element = document.getElementById(id);
        return element ? [{ y: element.getBoundingClientRect().top + window.scrollY - 90, progress: progress[index] }] : [];
      })];
    }
    function scroll() {
      const y = Math.max(0, window.scrollY);
      let index = 0;
      while (index < stops.length - 2 && y > stops[index + 1].y) index++;
      const a = stops[index];
      const b = stops[index + 1];
      if (a && b) runtime.current.scroll = a.progress + (b.progress - a.progress) * Math.min(1, (y - a.y) / Math.max(1, b.y - a.y));
    }
    function move(event: PointerEvent) {
      if (latest.current.paused || latest.current.panelOpen || event.pointerType === 'touch') return;
      runtime.current.pointer[0] = event.clientX / window.innerWidth * 2 - 1;
      runtime.current.pointer[1] = 1 - event.clientY / window.innerHeight * 2;
    }
    function focus(event: Event) {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-landmark]');
      if (target || event.type === 'focusin' || event.target !== canvasRef.current) runtime.current.hovered = world.landmarks.find(item => item.id === target?.dataset.landmark)?.id ?? null;
    }
    function resize() { measure(); scroll(); }
    resize();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('focusin', focus);
    document.addEventListener('pointerover', focus);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('pointerover', focus);
    };
  }, []);
  return <div className="canvas-host" aria-hidden="true" data-quality={tier} data-motion={props.paused || props.panelOpen || !visible ? 'stopped' : 'active'}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'pan-y' }} /></div>;
}
