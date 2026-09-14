'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { profile, type SectionId } from '@/content/profile';
import { motionPolicy } from '@/content/world';
import { readNavigation, serverNavigation, subscribeNavigation, pushDestination, clearDestination } from './world/navigation';
import { readPreferences, serverPreferences, subscribePreferences } from './world/preferences';
import { HabitatIcon } from './HabitatIcon';
import { SectionContent } from './SectionContent';
import { ContactLinks } from './ContactLinks';
import { AudioControl } from './AudioControl';

const WorldCanvas = dynamic(() => import('./world/WorldCanvas').then(module => module.WorldCanvas), { ssr: false });

export function Habitat() {
  const navigation = useSyncExternalStore(subscribeNavigation, readNavigation, serverNavigation);
  const preferences = useSyncExternalStore(subscribePreferences, readPreferences, serverPreferences);
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
    const frame = requestAnimationFrame(() => { setStarted(true); setDiagnostics(new URLSearchParams(window.location.search).has('diagnostics')); });
    return () => cancelAnimationFrame(frame);
  }, []);
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
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && readNavigation().id) { event.preventDefault(); overview(); } }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [overview]);
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
      {useWorld && <WorldCanvas destination={active} flight={navigation.serial} paused={preferences.hidden || !policy.ambient} panelOpen={surfaceOpen} mobile={preferences.mobile} rotationCommand={rotation ? { serial: rotation, yaw: Math.PI / 4 } : undefined} onNavigate={choose} onArrive={onArrive} onReady={onReady} onFailure={onFailure} />}
      <nav className="landmarks" aria-label={profile.ui.landscapeNavigation}>{profile.sections.map(section => <a key={section.id} data-landmark={section.id} data-destination={section.id} href={`#${section.id}`} className={`landmark landmark-${section.id}`} onClick={event => navigate(event, section.id)} aria-label={section.label}><span>{section.label}</span></a>)}</nav>
      <button className="sculpture-control" data-sculpture-control aria-label={profile.ui.rotate} onClick={() => setRotation(value => value + 1)}>↻</button>
      <svg className="surface-attachment" aria-hidden="true"><path data-surface-line /><circle data-surface-dot r="5" /></svg>
    </div>
    <header className="site-header"><a className="brand" href="#" onClick={event => { event.preventDefault(); overview(); }} aria-label={profile.ui.home}><span>{profile.initials}</span></a><ContactLinks compact /></header>
    <main>
      <div className="identity"><p className="education-line">{profile.university} · {profile.degree} · {profile.graduation}</p><h1>{profile.name}</h1><p className="hero-evidence">{profile.heroContribution}</p><a className="research-credential" data-destination="research" href="#research" onClick={event => navigate(event, 'research')}>{profile.ui.researchEvidence}</a></div>
      <div className="content-stage">{profile.sections.map(section => <section id={section.id} key={section.id} className={`scene-section section-${section.id}`} data-active={surfaceOpen && active === section.id} aria-labelledby={`heading-${section.id}`} tabIndex={-1}>
        <div className="surface"><div className="surface-rim"><HabitatIcon kind={section.id} /><button className="surface-close" onClick={overview} aria-label={profile.ui.close}><span aria-hidden="true">×</span><span>{profile.ui.close}</span></button></div><div className="surface-paper"><h2 id={`heading-${section.id}`}>{section.title}</h2><SectionContent id={section.id} /></div><div className="surface-foot" aria-hidden="true" /></div>
      </section>)}</div>
    </main>
    <nav className="dock" aria-label={profile.ui.mainNavigation}>{dock.map(section => <a href={`#${section.id}`} data-destination={section.id} key={section.id} onClick={event => navigate(event, section.id)} aria-current={active === section.id ? 'location' : undefined}><HabitatIcon kind={section.id} /><span>{section.label}</span></a>)}</nav>
    <AudioControl className="audio-control--above" />
    <div className="travel-status" role="status" aria-live="polite">{active && !surfaceOpen ? `${profile.ui.travel} ${profile.sections.find(section => section.id === active)?.label}` : ''}</div>
    {diagnostics && <output className="scene-diagnostics" data-scene-diagnostics aria-label="Scene performance diagnostics" />}
  </div>;
}
