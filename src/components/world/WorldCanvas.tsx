'use client';

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { addAfterEffect, createRoot, events, extend, type RootState } from '@react-three/fiber';
import * as THREE from 'three';
import { createSceneRuntime, world, type QualityTier, type WorldProps } from '@/content/world';
import { AeroWorld } from './AeroWorld';
import { QA_VIEWS } from './qaViews';
import { auditing, renderAudit, sampleFrame, constructionTimes } from './renderDiagnostics';
import { prepareWorldLayout } from './worldLayout';
import { surfaceLoadsPending } from './surfaceMaterials';

extend({ Mesh: THREE.Mesh, Group: THREE.Group, Object3D: THREE.Object3D, Sprite: THREE.Sprite,
  CylinderGeometry: THREE.CylinderGeometry, SphereGeometry: THREE.SphereGeometry, RingGeometry: THREE.RingGeometry, PlaneGeometry: THREE.PlaneGeometry,
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
  const [preparing, setPreparing] = useState(true);
  const onPrepared = useCallback(() => { performance.mark('world:compiled'); setPreparing(false); }, []);

  const stage = 5;
  const [plantsReady, setPlantsReady] = useState(false);
  const captureState = useRef({ stage, plantsReady });
  useEffect(() => { captureState.current = { stage, plantsReady }; if (stateRef.current) { stateRef.current.gl.shadowMap.needsUpdate = true; stateRef.current.invalidate(); } }, [stage, plantsReady]);
  const onPlantsReady = useCallback(() => { performance.mark('world:plants-ready'); setPlantsReady(true); }, []);
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
      let ready = false, coreReady = false, completedFrames = 0;
      let previousFrames = 0;
      let context: WebGL2RenderingContext | null = null;
      const search = new URLSearchParams(window.location.search);
      const unavailable = search.get('scene') === 'unavailable';
      const captureName = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? search.get('qaCapture') : null;
      try { context = unavailable ? null : canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: Boolean(captureName) }); }
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
        camera: { position: overview.position, fov: 43, near: .1, far: 1500 },
        dpr: Math.min(window.devicePixelRatio, latest.current.mobile ? 1.25 : 1.75),
        shadows: true, frameloop: 'never',
        onCreated: state => { stateRef.current = state; state.camera.lookAt(...overview.target); },
      }).then(async () => { await prepareWorldLayout(); if (!cancelled) setConfigured(true); }).catch(() => { if (!cancelled) latest.current.onFailure(); });
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
      let captureSent = false, manualCapture = 0;
      const saveCapture = (name: string, batch = false) => {
        const state=stateRef.current?.get();
        const metadata={url:window.location.href,viewport:[window.innerWidth,window.innerHeight],camera:state?.camera.position.toArray(),target:(state?.controls as unknown as {target?:THREE.Vector3})?.target?.toArray(),runtime:structuredClone(runtime.current),audit:{...renderAudit},quality:canvas.parentElement?.dataset.quality,audio:document.querySelector('[data-audio-state]')?.outerHTML,controls:Array.from(document.querySelectorAll('button[aria-pressed]')).map(button=>({label:button.getAttribute('aria-label')??button.textContent,pressed:button.getAttribute('aria-pressed')})),render:state?.gl.info.render};
        canvas.toBlob(blob=>{if(blob)void Promise.all([
          fetch(`/__qa-capture?name=${encodeURIComponent(name)}`,{method:'POST',body:blob,headers:{'Content-Type':'image/png'}}),
          fetch(`/__qa-capture?name=${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify(metadata,null,2),headers:{'Content-Type':'application/json'}}),
        ]).then(responses=>{if(responses.every(response=>response.ok)){
          canvas.dataset.qaCaptured=name;
          const prefix=search.get('qaBatch'),names=Object.keys(QA_VIEWS),next=names[names.indexOf(search.get('qaView')??'')+1];
          // A QA reload reconstructs the renderer at the same deterministic pose.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          if(batch&&prefix&&next)window.location.assign(`/?qaView=${next}&qaCapture=${prefix}/${next}&qaStill=1&qaBatch=${prefix}&diagnostics=1`);
        }});},'image/png');
      };
      const captureKey=(event:KeyboardEvent)=>{if(captureName&&event.altKey&&event.shiftKey&&event.code==='KeyP'){event.preventDefault();saveCapture(`${captureName}-${String(++manualCapture).padStart(2,'0')}`);}};
      if(captureName)window.addEventListener('keydown',captureKey);
      const stopSampling = addAfterEffect(() => {
        if (cancelled || runtime.current.frames === previousFrames) return;
        previousFrames = runtime.current.frames;
        if (!coreReady) { coreReady = true; performance.mark('world:core-frame'); }
        if (!ready && captureState.current.stage === 5 && captureState.current.plantsReady && surfaceLoadsPending() === 0) {
          // Present two complete frames, including uploaded textures, before entry.
          if (++completedFrames >= 2) { ready = true; performance.mark('world:ready'); latest.current.onReady(); }
          else requestAnimationFrame(() => stateRef.current?.invalidate());
        }
        if (auditing()) canvas.dataset.startup = JSON.stringify({ ready, frames: runtime.current.frames, pendingTextures: surfaceLoadsPending(), stage: captureState.current.stage, plants: captureState.current.plantsReady, construction: constructionTimes, readyMs: Math.round(performance.getEntriesByName('world:ready')[0]?.startTime ?? 0) });
        // Explicit captures may read pixels; performance diagnostics never stall the GPU.
        if (auditing() && search.has('pixelAudit')) sampleFrame(context!);
        if (ready && !captureSent && captureName && (search.has('qaStill') || runtime.current.frames > 150) && captureState.current.stage === 5 && captureState.current.plantsReady) {
          captureSent = true;
          saveCapture(captureName, true);
        }
      });
      function lost(event: Event) { event.preventDefault(); renderAudit.contextLosses++; latest.current.onFailure(); }
      function restored() { renderAudit.contextRestorations++; stateRef.current?.invalidate(); }
      function error() { renderAudit.unhandledErrors++; }
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
      window.addEventListener('error', error);
      window.addEventListener('unhandledrejection', error);
      return () => {
        cancelled = true; observer.disconnect(); stopSampling(); window.removeEventListener('keydown',captureKey);
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
    const qaStill = ['localhost', '127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).has('qaStill');
    rootRef.current?.render(<SceneBoundary onFailure={props.onFailure}><AeroWorld {...props} preparing={preparing} onPrepared={onPrepared} paused={props.paused || qaStill} onPlantsReady={onPlantsReady} stage={stage} runtime={runtime} tier={tier} onTier={setTier} /></SceneBoundary>);
  }, [configured, props, tier, stage, onPlantsReady, preparing, onPrepared]);

  useEffect(() => {
    function move(event: PointerEvent) {
      const canvas = canvasRef.current;
      const blocking = (event.target as HTMLElement).closest('a,button,input,select,fieldset,.surface,.audio-control,.ambience-control');
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
      if (element?.closest('a,button,input,select,fieldset,.surface,.audio-control,.ambience-control')) runtime.current.pointerActive = false;
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
  return <div className="canvas-host" data-quality={tier} data-environment={!preparing && plantsReady ? 'complete' : 'initializing'} data-motion={props.paused ? 'stopped' : 'active'} style={{ background: world.lighting.horizon }}><canvas aria-hidden="true" ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} /></div>;
}
