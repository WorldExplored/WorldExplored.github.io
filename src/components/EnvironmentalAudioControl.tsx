'use client';

import { useEffect, useRef, useState } from 'react';
import type { SectionId } from '../content/profile';
import { cityFerryDistance, createCityFerryRoute } from './world/cityInfrastructure';

const STORAGE='portfolio-ambience-v1';
interface Preferences{volume:number;muted:boolean}
interface AmbienceEngine{context:AudioContext;master:GainNode;city:GainNode;fountain:GainNode;sources:AudioScheduledSourceNode[];gullTimer:number|undefined;stop:()=>void}

function periodicNoise(context:AudioContext,seconds=8){
  const length=Math.floor(context.sampleRate*seconds),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
  const harmonics=[7,11,17,29,47,71,109,163];
  for(let i=0;i<length;i++){const t=i/length;let sample=0;for(let h=0;h<harmonics.length;h++)sample+=Math.sin(Math.PI*2*(harmonics[h]*t+h*.173))/(2+h*.42);data[i]=sample*.22;}
  return buffer;
}

function ferryMovementEnvelope(context:AudioContext){
  const route=createCityFerryRoute(),sampleRate=8000,length=Math.ceil(route.duration*sampleRate),buffer=context.createBuffer(1,length,sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const time=i/sampleRate,a=cityFerryDistance(route,time),b=cityFerryDistance(route,time+.05),speed=((b-a+route.length)%route.length)/.05;data[i]=Math.min(1,speed/route.speed)*.012;}
  return buffer;
}

function createEngine(preferences:Preferences):AmbienceEngine{
  const Context=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const context=new Context();
  const master=context.createGain();master.gain.value=preferences.muted?0:preferences.volume;master.connect(context.destination);
  const buffer=periodicNoise(context),sources:AudioScheduledSourceNode[]=[];
  const layer=(frequency:number,gainValue:number)=>{const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=gainValue;source.connect(filter).connect(gain).connect(master);source.start();sources.push(source);return gain;};
  const wind=layer(820,.11),waves=layer(430,.15),fountain=layer(1200,.035);
  const windLfo=context.createOscillator(),windAmount=context.createGain();windLfo.frequency.value=.035;windAmount.gain.value=.026;windLfo.connect(windAmount).connect(wind.gain);windLfo.start();sources.push(windLfo);
  const waveLfo=context.createOscillator(),waveAmount=context.createGain();waveLfo.frequency.value=.085;waveAmount.gain.value=.06;waveLfo.connect(waveAmount).connect(waves.gain);waveLfo.start();sources.push(waveLfo);
  const machinery=context.createOscillator(),city=context.createGain();machinery.type='sine';machinery.frequency.value=92;city.gain.value=.006;machinery.connect(city).connect(master);machinery.start();sources.push(machinery);
  const motor=context.createOscillator(),ferry=context.createGain(),ferryEnvelope=context.createBufferSource();motor.type='sine';motor.frequency.value=68;ferry.gain.value=0;ferryEnvelope.buffer=ferryMovementEnvelope(context);ferryEnvelope.loop=true;motor.connect(ferry).connect(master);ferryEnvelope.connect(ferry.gain);motor.start();ferryEnvelope.start();sources.push(motor,ferryEnvelope);
  let stopped=false,gullTimer:number|undefined;
  const gull=()=>{if(stopped)return;const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type='sine';osc.frequency.setValueAtTime(760,now);osc.frequency.exponentialRampToValueAtTime(1140,now+.34);osc.frequency.exponentialRampToValueAtTime(690,now+.9);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.012,now+.09);gain.gain.exponentialRampToValueAtTime(.0001,now+1.05);osc.connect(gain).connect(master);osc.start(now);osc.stop(now+1.1);gullTimer=window.setTimeout(gull,28000+Math.floor((now*997)%17000));};
  gullTimer=window.setTimeout(gull,18000);
  return{context,master,city,fountain,sources,gullTimer,stop(){stopped=true;if(gullTimer!==undefined)clearTimeout(gullTimer);for(const source of sources)try{source.stop();}catch{}void context.close();}};
}

export function EnvironmentalAudioControl({destination}:{destination:SectionId|''}){
  const engine=useRef<AmbienceEngine|null>(null);const [active,setActive]=useState(false);const [preferences,setPreferences]=useState<Preferences>(()=>{try{if(typeof window==='undefined')return{volume:.34,muted:false};const saved=localStorage.getItem(STORAGE);if(saved){const value=JSON.parse(saved) as Partial<Preferences>,volume=Number(value.volume);return{volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.34,muted:Boolean(value.muted)};}}catch{}return{volume:.34,muted:false};});
  useEffect(()=>()=>engine.current?.stop(),[]);
  useEffect(()=>{const audio=engine.current;if(!audio)return;const now=audio.context.currentTime;audio.city.gain.cancelScheduledValues(now);audio.city.gain.linearRampToValueAtTime(destination==='history' ? .026 : .008,now+.8);audio.fountain.gain.cancelScheduledValues(now);audio.fountain.gain.linearRampToValueAtTime(destination==='history' ? .085 : .035,now+.8);},[destination]);
  const persist=(next:Preferences)=>{setPreferences(next);try{localStorage.setItem(STORAGE,JSON.stringify(next));}catch{}const audio=engine.current;if(audio)audio.master.gain.setTargetAtTime(next.muted?0:next.volume,audio.context.currentTime,.05);};
  const toggle=async()=>{if(!engine.current){engine.current=createEngine(preferences);await engine.current.context.resume();setActive(true);return;}if(active){await engine.current.context.suspend();setActive(false);}else{await engine.current.context.resume();setActive(true);}};
  return <div className="ambience-control" role="group" aria-label="Environmental ambience">
    <button type="button" className="audio-control__button" onClick={toggle} aria-pressed={active}><span aria-hidden="true">≈</span><span>{active?'Pause ambience':'Start ambience'}</span></button>
    {active&&<><button type="button" className="audio-control__button audio-control__button--square" aria-label={preferences.muted?'Unmute ambience':'Mute ambience'} aria-pressed={preferences.muted} onClick={()=>persist({...preferences,muted:!preferences.muted})}>{preferences.muted?'×':'◖'}</button><label className="ambience-control__volume"><span>Ambience volume</span><input aria-label="Ambience volume" type="range" min="0" max="1" step="0.01" value={preferences.volume} onChange={event=>persist({...preferences,volume:Number(event.target.value)})}/></label></>}
  </div>;
}
