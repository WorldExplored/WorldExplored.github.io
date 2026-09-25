'use client';

import { useEffect, useState } from 'react';
import { easternHour, setTimeOverride, timeOverride, WEATHER_CHANGE } from './weatherState';

function clockLabel(hour: number) {
  const minutes = Math.round(hour * 60) % 1440;
  return `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${minutes < 720 ? 'AM' : 'PM'}`;
}

export function TimeOfDayControl() {
  const [hour, setHour] = useState(12);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    const update = () => { const value = timeOverride(); setManual(value !== null); setHour(value ?? easternHour()); };
    update();
    const timer = window.setInterval(update, 30000);
    window.addEventListener(WEATHER_CHANGE, update);
    return () => { window.clearInterval(timer); window.removeEventListener(WEATHER_CHANGE, update); };
  }, []);
  return <fieldset className="world-clock">
    <legend>Time of day</legend>
    <label htmlFor="world-time">{clockLabel(hour)} <span>{manual ? 'Preview' : 'Eastern time'}</span></label>
    <input id="world-time" type="range" min="0" max="23.99" step=".05" value={hour} aria-valuetext={`${clockLabel(hour)}${manual ? ', preview' : ', Eastern time'}`} onChange={event => setTimeOverride(Number(event.currentTarget.value))}/>
    <div className="world-clock-ticks" aria-hidden="true"><span>Midnight</span><span>Noon</span><span>Midnight</span></div>
    {manual && <button type="button" onClick={() => setTimeOverride(null)}>Use Eastern time</button>}
  </fieldset>;
}
