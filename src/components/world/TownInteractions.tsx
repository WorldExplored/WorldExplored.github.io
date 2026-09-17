'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { cityBuildings, cityLocalToWorld, cityRoofMounts, type CityPoint } from './city';
import { cityTurbines } from './cityInfrastructure';
import { terrainHeight } from './terrain';
import { COASTAL_BELL_EVENT } from './coastalAudio';
import { FOUNTAIN_SITE } from './GardenFountain';
import type { TownAction, TownInteractionState } from './townInteractionState';

export interface TownInteractionSite { id: TownAction; label: string; position: CityPoint; size: CityPoint; yaw?: number }
export const TOWN_BUOY_SITE = { x: -10, z: -57.4 } as const;
export const GREENHOUSE_VENT_LOCAL: CityPoint = [-1.4, 1.93, 1.96];
export function townInteractionSites(): readonly TownInteractionSite[] {
  const greenhouse = cityBuildings.find(building => building.id === 'winter-garden')!;
  const solar = cityRoofMounts[0]; const turbine = cityTurbines[0];
  const solarReach = Math.hypot(solar.width, solar.depth) + .3;
  return [
    { id: 'fountain', label: 'Cycle fountain jets', position: [FOUNTAIN_SITE.x, terrainHeight(FOUNTAIN_SITE.x, FOUNTAIN_SITE.z) + .75, FOUNTAIN_SITE.z], size: [2.6, 1.6, 2.6] },
    { id: 'station', label: 'Illuminate transit route', position: [-5, 5.05, -66.87], size: [2.2, .75, .65] },
    { id: 'solar', label: 'Align solar panels', position: [solar.world[0], solar.world[1] + .2, solar.world[2]], size: [solarReach, .85, solarReach], yaw: solar.yaw },
    { id: 'greenhouse', label: 'Open greenhouse vents', position: cityLocalToWorld(greenhouse, GREENHOUSE_VENT_LOCAL), size: [1.5, 1, .75], yaw: greenhouse.rotation },
    { id: 'buoy', label: 'Ring harbor buoy', position: [TOWN_BUOY_SITE.x, .6, TOWN_BUOY_SITE.z], size: [1.5, 1.8, 1.5] },
    { id: 'wind', label: 'Turn wind turbine into breeze', position: [turbine.x, terrainHeight(turbine.x, turbine.z) + turbine.height, turbine.z + .23], size: [5, 5, 2] },
  ];
}

export function TownActionButton({ label, active, onActivate, onFocusChange }: { label: string; active: boolean; onActivate: () => void; onFocusChange?: (focused: boolean) => void }) {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={event => { event.stopPropagation(); onActivate(); }}
    onFocus={event => { event.currentTarget.style.opacity = '1'; event.currentTarget.style.pointerEvents = 'auto'; onFocusChange?.(true); }}
    onBlur={event => { event.currentTarget.style.opacity = '0'; event.currentTarget.style.pointerEvents = 'none'; onFocusChange?.(false); }}
    style={{ opacity: 0, pointerEvents: 'none', whiteSpace: 'nowrap', color: '#173d37', background: '#f4fff2', border: '1px solid #428e80', borderRadius: '1rem', padding: '.45rem .7rem', fontSize: '.75rem', minHeight: '44px', minWidth: '44px', outline: '2px solid #70e4d5', outlineOffset: '3px' }}>{label}</button>;
}

function createTargetResources() {
  return {
    geometry: new BoxGeometry(1, 1, 1),
    hit: new MeshBasicMaterial({ visible: false, transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
    focus: new MeshBasicMaterial({ color: '#87e6cb', wireframe: true, transparent: true, opacity: .35, depthWrite: false }),
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  };
}

function TownHitTarget({ site, controls, resources }: { site: TownInteractionSite; controls: TownInteractionState; resources: ReturnType<typeof createTargetResources> }) {
  useSyncExternalStore(controls.subscribe, controls.snapshot, controls.snapshot);
  const [focused, setFocused] = useState(false);
  const element = useThree(state => state.gl.domElement);
  const portal = useMemo(() => ({ current: element.parentElement as HTMLElement }), [element]);
  const hovering = useRef(false);
  useEffect(() => () => { if (hovering.current && element.style) element.style.removeProperty('cursor'); }, [element]);
  const activate = () => { controls.activate(site.id); if (site.id === 'buoy' && typeof window !== 'undefined') window.dispatchEvent(new Event(COASTAL_BELL_EVENT)); };
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.button === 0 && event.delta <= 8) activate(); };
  return <group name={`town-control-${site.id}`} position={site.position as [number, number, number]} rotation-y={site.yaw ?? 0}>
    <mesh name={`town-hitbox-${site.id}`} geometry={resources.geometry} material={resources.hit} scale={site.size as [number, number, number]} userData={{ cameraInteraction: true, townAction: site.id }} onClick={click} onPointerOver={event => { event.stopPropagation(); hovering.current = true; if (element.style) element.style.setProperty('cursor', 'pointer'); }} onPointerOut={event => { event.stopPropagation(); hovering.current = false; if (element.style) element.style.removeProperty('cursor'); }} onPointerMove={event => event.stopPropagation()} />
    <mesh name={`town-focus-${site.id}`} geometry={resources.geometry} material={resources.focus} scale={site.size as [number, number, number]} visible={focused} raycast={() => {}} />
    {typeof document !== 'undefined' && portal.current && <Html portal={portal} center position={[0, site.size[1] / 2 + .2, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <TownActionButton label={site.label} active={controls.states[site.id].active} onActivate={activate} onFocusChange={setFocused} />
    </Html>}
  </group>;
}

export function TownInteractions({ controls }: { controls: TownInteractionState }) {
  const [sites] = useState(townInteractionSites);
  const [resources] = useState(createTargetResources);
  useEffect(() => {
    clearTimeout(resources.timer);
    return () => { resources.timer = setTimeout(() => { resources.geometry.dispose(); resources.hit.dispose(); resources.focus.dispose(); }, 0); };
  }, [resources]);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const unsubscribe = controls.subscribe(invalidate); const release = controls.retain();
    return () => { unsubscribe(); release(); };
  }, [controls, invalidate]);
  return <group name="town-interaction-targets" dispose={null}>{sites.map(site => <TownHitTarget key={site.id} site={site} controls={controls} resources={resources} />)}</group>;
}
