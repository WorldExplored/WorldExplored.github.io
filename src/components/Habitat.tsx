'use client';

import dynamic from 'next/dynamic';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { profile, type SectionId } from '@/content/profile';
import { motionPolicy } from '@/content/world';
import { readNavigation, serverNavigation, subscribeNavigation, pushDestination, clearDestination, subscribeOverviewRecovery } from './world/navigation';
import { readPreferences, serverPreferences, subscribePreferences } from './world/preferences';
import { DockShell, HabitatIcon } from './HabitatIcon';
import { SectionContent } from './SectionContent';
import { WorldEntry } from './WorldEntry';
import { WorldMusic, type WorldMusicHandle } from './WorldMusic';
import { EnvironmentalAudioControl, type EnvironmentalAudioHandle } from './EnvironmentalAudioControl';

const WorldCanvas = dynamic(() => import('./world/WorldCanvas').then(module => module.WorldCanvas), { ssr: false });

export function Habitat() {
  const navigation = useSyncExternalStore(subscribeNavigation, readNavigation, serverNavigation);
  const preferences = useSyncExternalStore(subscribePreferences, readPreferences, serverPreferences);
  const ambience = useRef<EnvironmentalAudioHandle>(null);
  const [entered, setEntered] = useState(false);
  const radio = useRef<WorldMusicHandle>(null);
  const [music, setMusic] = useState(true);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [arrived, setArrived] = useState({ id: '' as SectionId | '', serial: -1 });
  const returnFocus = useRef<HTMLElement | null>(null);
  const policy = motionPolicy(preferences.reduced, preferences.saveData, preferences.forced);
  const useWorld = started && policy.webgl && !failed;
  const active = navigation.id;
  const surfaceOpen = Boolean(active && (!useWorld || !ready || (arrived.id === active && arrived.serial === navigation.serial)));
  const dock = profile.sections.filter(section => section.dock);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setStarted(true); if (['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('qaView')) { setEntered(true); setMusic(false); } setDiagnostics(new URLSearchParams(window.location.search).has('diagnostics')); });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('world-active', useWorld);
    if (ready || (started && !useWorld)) delete document.documentElement.dataset.worldBoot;
    return () => document.documentElement.classList.remove('world-active');
  }, [useWorld, started, ready]);
  useEffect(() => {
    if (active && surfaceOpen) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!returnFocus.current) returnFocus.current = document.querySelector<HTMLElement>(`.dock a[href="#${active}"]`);
      document.querySelector<HTMLButtonElement>(`#${active} .surface-close`)?.focus({ preventScroll: true });
    } else if (!active && returnFocus.current) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [active, surfaceOpen]);
  const overview = useCallback(() => { window.scrollTo({ top: 0, behavior: 'instant' }); clearDestination(); }, []);
  useEffect(() => subscribeOverviewRecovery(overview), [overview]);
  const onArrive = useCallback((id: SectionId | '', serial: number) => {
    const current = readNavigation();
    if (current.id === id && current.serial === serial) setArrived({ id, serial });
  }, []);
  const onReady = useCallback(() => { const current = readNavigation(); if (current.id) { setArrived({ id: current.id, serial: current.serial }); window.scrollTo({ top: 0, behavior: 'instant' }); } setReady(true); }, []);
  const onFailure = useCallback(() => { setFailed(true); setReady(false); }, []);
  const choose = useCallback((id: SectionId) => { window.scrollTo({ top: 0, behavior: 'instant' }); pushDestination(id); }, []);
  function navigate(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!active) returnFocus.current = event.currentTarget;
    choose(id);
  }

  return <div className={`portfolio ${started ? 'is-enhanced' : ''} ${useWorld && ready ? 'scene-ready' : 'scene-fallback'} ${active ? 'has-destination' : ''}`} data-scene={useWorld ? ready ? 'ready' : 'loading' : 'fallback'} data-active={active || 'overview'} data-reduced-motion={preferences.reduced}>
    <a className="skip-link" href="#work" onClick={event => navigate(event, 'work')}>{profile.ui.skip}</a>
    <div className="world-stage">
      {useWorld && <WorldCanvas destination={active} flight={navigation.serial} paused={!entered || preferences.hidden || !policy.ambient} panelOpen={surfaceOpen} mobile={preferences.mobile} rotationCommand={rotation ? { serial: rotation, yaw: Math.PI / 4 } : undefined} onNavigate={choose} onArrive={onArrive} onReady={onReady} onFailure={onFailure} />}
      <nav className="landmarks" aria-label={profile.ui.landscapeNavigation}>{profile.sections.map(section => <a key={section.id} data-landmark={section.id} data-destination={section.id} href={`#${section.id}`} className={`landmark landmark-${section.id}`} onClick={event => navigate(event, section.id)} aria-label={section.label}><span>{section.label}</span></a>)}</nav>
      <button className="sculpture-control" data-sculpture-control aria-label={profile.ui.rotate} onClick={() => setRotation(value => value + 1)}>↻</button>
    </div>
    <main>
      <div className="identity" data-world-identity><h1 aria-label={profile.name}><button type="button" onClick={overview} aria-label="Return to overview" style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', textShadow: 'inherit', textAlign: 'inherit', pointerEvents: 'auto' }}>{profile.name}</button></h1><p className="hero-evidence">{profile.heroContribution}</p><p className="research-credential">{profile.ui.researchEvidence}</p></div>
      <div className="content-stage">{profile.sections.map(section => <section id={section.id} key={section.id} className={`scene-section section-${section.id}`} data-active={surfaceOpen && active === section.id} aria-labelledby={`heading-${section.id}`} tabIndex={-1}>
        <div className="surface"><div className="surface-rim"><HabitatIcon kind={section.id} /><button className="surface-close" onClick={overview} aria-label={`Close ${section.title}`}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div><div className="surface-paper" tabIndex={0} role="region" aria-labelledby={`heading-${section.id}`}><h2 id={`heading-${section.id}`}>{section.title}</h2><SectionContent id={section.id} /></div><div className="surface-foot" aria-hidden="true" /></div>
      </section>)}</div>
    </main>
    <nav className="dock" onPointerMove={event => {
      const target = (event.target as HTMLElement).closest('a');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--light-x', `${event.clientX - rect.left}px`);
      target.style.setProperty('--light-y', `${event.clientY - rect.top}px`);
    }} aria-label={profile.ui.mainNavigation}><DockShell />{dock.map(section => <a href={`#${section.id}`} data-destination={section.id} key={section.id} onClick={event => navigate(event, section.id)} aria-current={active === section.id ? 'location' : undefined}><HabitatIcon kind={section.id} /><span>{section.label}</span></a>)}</nav>
    <EnvironmentalAudioControl ref={ambience} visible={entered} />
    {entered && !music && <button className="world-music-open audio-control__button" onClick={() => setMusic(true)} aria-label="Play world radio">♫ <span>World radio</span></button>}
    {started && music && <div hidden={!entered}><WorldMusic ref={radio} autoStart={entered} onClose={() => setMusic(false)} /></div>}
    {started && !entered && <WorldEntry onEnter={sound => {
      flushSync(() => { setEntered(true); if (!sound) setMusic(false); });
      if (sound) { void ambience.current?.start(); radio.current?.play(); }
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.identity button')?.focus({ preventScroll: true }));
    }} />}
    <div className="travel-status" role="status" aria-live="polite">{active && !surfaceOpen ? `${profile.ui.travel} ${profile.sections.find(section => section.id === active)?.label}` : ''}</div>
    {diagnostics && <output className="scene-diagnostics" data-scene-diagnostics aria-label="Scene performance diagnostics" />}
  </div>;
}
