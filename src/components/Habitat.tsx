'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type KeyboardEvent } from 'react';
import { profile, type SectionId } from '@/content/profile';
import { Arrow, HabitatIcon } from './HabitatIcon';
import { SectionContent } from './SectionContent';

const sectionIds = new Set<string>(profile.sections.map(section => section.id));
function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener('popstate', callback);
  window.addEventListener('habitat:navigate', callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('popstate', callback);
    window.removeEventListener('habitat:navigate', callback);
  };
}
function readHash(): SectionId | '' {
  const hash = window.location.hash.slice(1);
  return sectionIds.has(hash) ? hash as SectionId : '';
}
function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia('(min-width: 900px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function readDesktop() { return window.matchMedia('(min-width: 900px)').matches; }
function serverHash() { return '' as const; }
function serverDesktop() { return false; }

export function Habitat() {
  const active = useSyncExternalStore(subscribeHash, readHash, serverHash);
  const desktop = useSyncExternalStore(subscribeDesktop, readDesktop, serverDesktop);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const activeSection = profile.sections.find(section => section.id === active);
  const dock = profile.sections.filter(section => section.dock);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && desktop) {
      if (!dialog.open) {
        if (!returnFocus.current) returnFocus.current = document.querySelector<HTMLElement>(`.dock a[href="#${active}"]`);
        dialog.showModal();
        closeRef.current?.focus();
      }
      document.body.classList.add('panel-open');
      const frame = requestAnimationFrame(() => {
        // Native fragment navigation can move focus after the dialog opens.
        if (!dialog.contains(document.activeElement)) closeRef.current?.focus();
        dialog.querySelector('.panel-paper')?.scrollTo(0, 0);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      if (dialog.open) {
        dialog.close();
        returnFocus.current?.focus({ preventScroll: true });
        returnFocus.current = null;
      }
      document.body.classList.remove('panel-open');
    }
  }, [active, desktop]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const updateMotion = () => {
      document.documentElement.classList.toggle('environment-still', document.hidden || media.matches || Boolean(connection?.saveData));
    };
    updateMotion();
    document.addEventListener('visibilitychange', updateMotion);
    media.addEventListener('change', updateMotion);
    return () => {
      document.removeEventListener('visibilitychange', updateMotion);
      media.removeEventListener('change', updateMotion);
      document.documentElement.classList.remove('environment-still');
      document.body.classList.remove('panel-open');
    };
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    if (!desktop || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!active) returnFocus.current = event.currentTarget;
    const url = `#${id}`;
    const previous = window.history.state;
    const depth = active && previous?.habitatDepth ? previous.habitatDepth + 1 : 1;
    const baseHash = active ? previous?.habitatBaseHash ?? window.location.hash : '';
    window.history.pushState({ ...previous, habitatDepth: depth, habitatBaseHash: baseHash }, '', url);
    window.dispatchEvent(new Event('habitat:navigate'));
  }

  function closePanel() {
    if (window.history.state?.habitatDepth && window.history.state.habitatBaseHash === '') window.history.go(-window.history.state.habitatDepth);
    else {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new Event('habitat:navigate'));
    }
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, summary')).filter(element => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function respondToPointer(event: MouseEvent<HTMLDivElement>) {
    if (paused || active || !desktop || document.documentElement.classList.contains('environment-still')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 6;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 4;
    worldRef.current?.style.setProperty('--drift-x', `${x}px`);
    worldRef.current?.style.setProperty('--drift-y', `${y}px`);
  }

  return <div className={paused ? 'portfolio is-paused' : 'portfolio'}>
    <a className="skip-link" href="#work">{profile.ui.skip}</a>
    <main>
      <section className="habitat" aria-label={profile.edition}>
        <header className="site-header"><a className="brand" href="#" aria-label={profile.ui.home}><span className="brand-orb">{profile.initials}</span><span>{profile.edition}</span></a><div className="header-links"><a href="#about" onClick={event => navigate(event, 'about')}>{profile.sections[3].label}</a><a href={profile.links.github} target="_blank" rel="noreferrer">{profile.ui.github}<Arrow /></a><a href={profile.links.linkedin} target="_blank" rel="noreferrer">{profile.ui.linkedin}<Arrow /></a></div></header>
        <div className="identity"><div><p className="eyebrow">{profile.education}</p><h1>{profile.name}</h1><p className="hero-focus">{profile.focus}</p><div className="evidence-links"><a href={profile.links.contributions} target="_blank" rel="noreferrer">{profile.ui.evidence}<Arrow /></a><a href={profile.links.paper} target="_blank" rel="noreferrer">{profile.ui.researchEvidence}<Arrow /></a></div></div><div className="hero-note"><span className="small-orbit" aria-hidden="true" /><p>{profile.intro}</p><a href="#work" onClick={event => navigate(event, 'work')}>{profile.ui.welcome}<Arrow /></a></div></div>
        <div className="world" ref={worldRef} onMouseMove={respondToPointer} onMouseLeave={() => { worldRef.current?.style.setProperty('--drift-x', '0px'); worldRef.current?.style.setProperty('--drift-y', '0px'); }}>
          <div className="world-art" aria-hidden="true"><Image src="/images/habitat.webp" alt="" fill priority sizes="100vw" className="landscape-image" /><div className="sky-wash" /><div className="water-glint" /><span className="bubble bubble-one" /><span className="bubble bubble-two" /></div>
          <nav className="landmarks" aria-label={profile.ui.landscapeNavigation}>{profile.sections.filter(section => section.landmark).map(section => <a key={section.id} href={`#${section.id}`} className={`landmark landmark-${section.id}`} onClick={event => navigate(event, section.id)} aria-label={`${section.title} — ${section.landmark}`}><span className="landmark-target" aria-hidden="true"><i /></span><span className="landmark-sign"><span className="landmark-number" aria-hidden="true">{section.number === '06' ? '04' : section.number}</span><span><strong>{section.id === 'work' ? section.title : section.label}</strong><small>{section.landmark}</small></span><Arrow /></span></a>)}</nav>
        <div className="world-caption"><span>{profile.ui.explore}</span><button className="motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? profile.ui.resume : profile.ui.pause}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>{profile.ui.motion}</button></div>
        </div>
      </section>

      <div className="field-guide" id="field-guide"><div className="guide-intro"><p className="eyebrow">{profile.ui.guide}</p><h2>{profile.ui.guideTitle}</h2><p>{profile.ui.guideIntro}</p></div>
        {profile.sections.map(section => <section id={section.id} key={section.id} className={`guide-section guide-${section.id}`} aria-labelledby={`heading-${section.id}`} tabIndex={-1}><div className="section-heading"><HabitatIcon kind={section.id} /><div><p className="eyebrow">{section.landmark || section.label}</p><h2 id={`heading-${section.id}`}>{section.title}</h2>{section.subtitle && <p>{section.subtitle}</p>}</div></div><div className="section-body"><SectionContent id={section.id} /></div></section>)}
      </div>
    </main>
    <footer className="site-footer"><span>{profile.name}</span><span>{profile.ui.footer}</span><a href="#">{profile.ui.home}<Arrow /></a></footer>
    <nav className="dock" aria-label={profile.ui.mainNavigation}>{dock.map(section => <a href={`#${section.id}`} key={section.id} onClick={event => navigate(event, section.id)} aria-current={active === section.id ? 'location' : undefined}><HabitatIcon kind={section.id} /><span>{section.label}</span></a>)}</nav>
    <dialog ref={dialogRef} className="content-panel" aria-labelledby="panel-title" onCancel={event => { event.preventDefault(); closePanel(); }} onKeyDown={trapFocus} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel(); }}>
      {activeSection && <><div className="panel-bar"><span>{activeSection.landmark || activeSection.label}</span><div><button onClick={closePanel} aria-label={profile.ui.minimize}>−</button><button ref={closeRef} onClick={closePanel} aria-label={profile.ui.close}>×</button></div></div><div className="panel-paper"><div className="panel-heading"><HabitatIcon kind={activeSection.id} /><div><h2 id="panel-title">{activeSection.title}</h2>{activeSection.subtitle && <p>{activeSection.subtitle}</p>}</div></div><SectionContent id={activeSection.id} /></div><nav className="panel-nav" aria-label={profile.ui.panelNavigation}>{dock.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={event => navigate(event, section.id)}>{section.label}</a>)}</nav></>}
    </dialog>
  </div>;
}
