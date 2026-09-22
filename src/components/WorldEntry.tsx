'use client';

import { useEffect, useRef, useState } from 'react';
import { profile } from '@/content/profile';
import { HabitatIcon } from './HabitatIcon';

export function WorldEntry({ onEnter }: { onEnter: (sound: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sound, setSound] = useState(true);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>('.world-entry__go')?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="world-entry" aria-labelledby="world-entry-title" aria-describedby="world-entry-description" onCancel={event => event.preventDefault()}>
    <div className="world-entry__bar"><span className="world-entry__status" />{profile.name}<span aria-hidden="true">✧</span></div>
    <div className="world-entry__body">
      <div className="world-entry__orb" aria-hidden="true"><HabitatIcon kind="about" /></div>
      <p className="world-entry__eyebrow">{profile.entry.eyebrow}</p>
      <h2 id="world-entry-title">{profile.entry.title}</h2>
      <p id="world-entry-description">{profile.entry.description}</p>
      <label className="world-entry__sound"><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)} />{profile.entry.sound}</label>
      <button autoFocus type="button" className="world-entry__go" onClick={() => { dialog.current?.close(); onEnter(sound); }}>{profile.entry.enter}<span aria-hidden="true">↗</span></button>
      <p className="world-entry__hint">{profile.entry.hint}</p>
    </div>
  </dialog>;
}
