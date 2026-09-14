'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type KeyboardEvent } from 'react';
import { profile, type SectionId } from '@/content/profile';
import { motionPolicy } from '@/content/world';
import { readNavigation, serverNavigation, subscribeNavigation, pushDestination, clearDestination } from './world/navigation';
import { readPreferences, serverPreferences, subscribePreferences } from './world/preferences';
import { Arrow, HabitatIcon } from './HabitatIcon';
import { SectionContent } from './SectionContent';

const WorldCanvas = dynamic(() => import('./world/WorldCanvas').then(module => module.WorldCanvas), { ssr: false });

export function Habitat() {
  const navigation = useSyncExternalStore(subscribeNavigation, readNavigation, serverNavigation);
  const preferences = useSyncExternalStore(subscribePreferences, readPreferences, serverPreferences);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [staticView, setStaticView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [free, setFree] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [arrived, setArrived] = useState({ id: '' as SectionId | '', serial: -1 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [bodyHeights, setBodyHeights] = useState<Record<string, number>>({});
  const policy = motionPolicy(preferences.reduced, preferences.saveData, preferences.forced, staticView);
  const useWorld = started && policy.webgl && !failed;
  const active = navigation.id;
  const panelOpen = Boolean(active && (!useWorld || !ready || (arrived.id === active && arrived.serial === navigation.serial)));
  const activeSection = profile.sections.find(section => section.id === active);
  const dock = profile.sections.filter(section => section.dock);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStarted(true);
      setDiagnostics(new URLSearchParams(window.location.search).has('diagnostics'));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('environment-still', !policy.ambient || paused);
    return () => document.documentElement.classList.remove('environment-still');
  }, [policy.ambient, paused]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (panelOpen && active) {
      if (!returnFocus.current) returnFocus.current = document.querySelector<HTMLElement>(`.dock a[href="#${active}"]`);
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('panel-open');
      const frame = requestAnimationFrame(() => {
        closeRef.current?.focus();
        dialog.querySelector('.panel-paper')?.scrollTo(0, 0);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (dialog.open) dialog.close();
    document.body.classList.remove('panel-open');
    if (!active) {
      returnFocus.current?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [panelOpen, active]);

  useEffect(() => () => document.body.classList.remove('panel-open'), []);

  const onArrive = useCallback((id: SectionId | '', serial: number) => {
    const current = readNavigation();
    if (current.id === id && current.serial === serial) setArrived({ id, serial });
  }, []);
  const onReady = useCallback(() => {
    const current = readNavigation();
    if (current.id) setArrived({ id: current.id, serial: current.serial });
    setReady(true);
  }, []);
  const onFailure = useCallback(() => { setFailed(true); setReady(false); }, []);
  const choose = useCallback((id: SectionId) => {
    const body = document.querySelector<HTMLElement>(`#${id} .section-body`);
    if (body) { const height = body.getBoundingClientRect().height; setBodyHeights(current => ({ ...current, [id]: height })); }
    pushDestination(id);
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!active) returnFocus.current = event.currentTarget;
    choose(id);
  }
  function overview(event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    setFree(false);
    if (active) { window.scrollTo({ top: 0, behavior: 'instant' }); clearDestination(); }
    else window.scrollTo({ top: 0, behavior: policy.camera && !paused ? 'smooth' : 'instant' });
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, summary')).filter(element => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <div className={`portfolio ${useWorld && ready ? 'scene-ready' : 'scene-fallback'} ${paused ? 'is-paused' : ''}`} data-scene={useWorld ? ready ? 'ready' : 'loading' : 'static'}>
    <a className="skip-link" href="#work" onClick={event => navigate(event, 'work')}>{profile.ui.skip}</a>
    <main>
      <section className="habitat" aria-label={profile.edition}>
        <header className="site-header"><a className="brand" href="#" onClick={overview} aria-label={profile.ui.home}><span className="brand-orb">{profile.initials}</span><span>{profile.edition}</span></a><div className="header-links"><a href="#about" onClick={event => navigate(event, 'about')}>{profile.sections[3].label}</a><a href={profile.links.github} target="_blank" rel="noopener noreferrer">{profile.ui.github}<Arrow /></a><a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">{profile.ui.linkedin}<Arrow /></a></div></header>
        <div className="identity"><p className="eyebrow">{profile.university} · {profile.degree} · {profile.graduation}</p><h1>{profile.name}</h1><p className="hero-evidence">{profile.heroContribution}</p><div className="evidence-links"><a href="#work" onClick={event => navigate(event, 'work')}>{profile.ui.evidence}<Arrow /></a><a href="#research" onClick={event => navigate(event, 'research')}>{profile.ui.researchEvidence}<Arrow /></a></div></div>
        <div className="world-stage">
          <div className="world-fallback" aria-hidden="true"><Image src="/images/habitat.webp" alt="" fill priority sizes="100vw" className="landscape-image" /></div>
          {useWorld && <WorldCanvas destination={active} flight={navigation.serial} paused={paused || preferences.hidden} panelOpen={panelOpen} free={free} mobile={preferences.mobile} onNavigate={choose} onArrive={onArrive} onReady={onReady} onFailure={onFailure} />}
          <nav className="landmarks" aria-label={profile.ui.landscapeNavigation}>{profile.sections.filter(section => section.landmark).map(section => <a key={section.id} data-landmark={section.id} href={`#${section.id}`} className={`landmark landmark-${section.id}`} onClick={event => navigate(event, section.id)} aria-label={`${section.title} — ${section.landmark}`}><span className="landmark-sign"><span className="landmark-number" aria-hidden="true">{section.id === 'building' ? '04' : section.number}</span><span><strong>{section.landmark}</strong><small>{section.label}</small></span><Arrow /></span><span className="landmark-stem" aria-hidden="true" /></a>)}</nav>
        </div>
        <div className="world-caption"><a href="#field-guide" className="scroll-cue">{profile.ui.explore}<span aria-hidden="true">↓</span></a><div className="world-controls">{useWorld && <button className="motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? profile.ui.resume : profile.ui.pause}</button>}{useWorld && !preferences.mobile && <button className="motion-toggle free-toggle" onClick={() => setFree(value => !value)} aria-pressed={free}>{free ? profile.ui.guided : profile.ui.free}</button>}<button className="motion-toggle" onClick={() => { setStaticView(value => !value); setReady(false); }} aria-pressed={staticView} disabled={!policy.webgl && !staticView}>{staticView ? profile.ui.worldView : profile.ui.staticView}</button></div></div>
        <div className="scene-help">{free ? profile.ui.freeHelp : useWorld ? profile.ui.sceneHelp : profile.ui.staticHelp}</div>
        {free && <button className="overview-control" onClick={() => { setFree(false); overview(); }}>{profile.ui.home}</button>}
        <div className="travel-status" role="status" aria-live="polite">{active && !panelOpen ? `${profile.ui.travel} ${activeSection?.landmark || activeSection?.label}` : ''}</div>
      </section>
      <div className="field-guide" id="field-guide"><div className="guide-intro"><p className="eyebrow">{profile.ui.guide}</p><h2>{profile.ui.guideTitle}</h2><p>{profile.ui.guideIntro}</p></div>
        {profile.sections.map(section => <section id={section.id} key={section.id} className={`guide-section guide-${section.id}`} aria-labelledby={`heading-${section.id}`} tabIndex={-1}><div className="section-heading"><HabitatIcon kind={section.id} /><div><p className="eyebrow">{section.landmark || section.label}</p><h2 id={`heading-${section.id}`}>{section.title}</h2></div></div><div className="section-body">{panelOpen && active === section.id ? <div aria-hidden="true" style={{ height: bodyHeights[section.id] || 180 }} /> : <SectionContent id={section.id} />}</div></section>)}
      </div>
    </main>
    <footer className="site-footer"><span>{profile.name}</span><a href="#" onClick={overview}>{profile.ui.home}<Arrow /></a></footer>
    <nav className="dock" aria-label={profile.ui.mainNavigation}>{dock.map(section => <a href={`#${section.id}`} key={section.id} onClick={event => navigate(event, section.id)} aria-current={active === section.id ? 'location' : undefined}><HabitatIcon kind={section.id} /><span>{section.label}</span></a>)}</nav>
    <dialog ref={dialogRef} className="content-panel" aria-labelledby="panel-title" onCancel={event => { event.preventDefault(); clearDestination(); }} onKeyDown={trapFocus} onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) clearDestination(); }}>
      {panelOpen && activeSection && <><div className="panel-bar"><span>{activeSection.landmark || activeSection.label}</span><div><button onClick={() => clearDestination()} aria-label={profile.ui.minimize}>−</button><button ref={closeRef} onClick={() => clearDestination()} aria-label={profile.ui.close}>×</button></div></div><div className="panel-paper"><div className="panel-heading"><HabitatIcon kind={activeSection.id} /><h2 id="panel-title">{activeSection.title}</h2></div><SectionContent id={activeSection.id} /></div><nav className="panel-nav" aria-label={profile.ui.panelNavigation}><a href="#" onClick={overview}>{profile.ui.overview}</a>{dock.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={event => navigate(event, section.id)}>{section.label}</a>)}</nav></>}
    </dialog>
    {diagnostics && <output className="scene-diagnostics" data-scene-diagnostics aria-label="Scene performance diagnostics" />}
  </div>;
}
