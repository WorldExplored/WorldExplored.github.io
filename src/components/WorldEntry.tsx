'use client';

import { useEffect, useRef, useState } from 'react';
import { profile } from '@/content/profile';
import { HabitatIcon } from './HabitatIcon';

export function WorldEntry({ onEnter, ready = false }: { onEnter: (sound: boolean) => void; ready?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sound, setSound] = useState(true);
  const booting = !ready;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => { if (!booting) dialog.current?.querySelector<HTMLButtonElement>('.world-entry__go')?.focus(); }, [booting]);
  return <dialog ref={dialog} className="world-entry" data-booting={booting} aria-labelledby="world-entry-title" aria-describedby="world-entry-description" onCancel={event => event.preventDefault()}>
    <div className="world-entry__bar"><span className="world-entry__status" />{profile.entry.windowTitle}<span className="world-entry__window-controls" aria-hidden="true"><i>−</i><i>□</i><i>×</i></span></div>
    <div className="world-entry__body">
      <div className="world-entry__orb" aria-hidden="true"><HabitatIcon kind="about" /></div>
      <p className="world-entry__eyebrow">{profile.entry.eyebrow}</p>
      <h2 id="world-entry-title">{profile.entry.title}</h2>
      <p id="world-entry-description">{profile.entry.description}</p>
      <label className="world-entry__sound"><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)} />{profile.entry.sound}</label>
      <div className="world-entry__boot" role="status" aria-live="polite">{booting ? profile.entry.loading : <span aria-hidden="true">&nbsp;</span>}<span className="world-entry__progress" aria-hidden="true"><i /><i /><i /></span></div>
      <button autoFocus type="button" disabled={booting} className="world-entry__go" onClick={() => { dialog.current?.close(); onEnter(sound); }}>{profile.entry.enter}<span aria-hidden="true">↗</span></button>
      <p className="world-entry__hint">{profile.entry.hint}</p>
    </div>
  </dialog>;
}
