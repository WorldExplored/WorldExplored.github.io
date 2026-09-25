import assert from 'node:assert/strict';
import test from 'node:test';
import { YouTubeTransport } from '../src/components/youtubeTransport';
import type { YouTubePlayer } from '../src/components/youtubePlayer';

function setup() {
  let now=0, position=0, code=5, open=false, plays=0, pauses=0;
  const loads: Array<string | {videoId:string;startSeconds:number}>=[];
  const player={playVideo(){plays++;},pauseVideo(){pauses++;},unMute(){},setVolume(){},setLoop(){},destroy(){},getIframe(){return {} as HTMLIFrameElement;},getCurrentTime(){return position;},getPlayerState(){return code;},loadVideoById(video){loads.push(video);code=3;}} satisfies YouTubePlayer;
  const transport=new YouTubeTransport({videos:['first','second'],now:()=>now,settingsOpen:()=>open,changed(){}});
  return {transport,player,loads,get plays(){return plays;},get pauses(){return pauses;},time(value:number){now=value;},position(value:number){position=value;},state(value:number){code=value;transport.onState(value);},open(value:boolean){open=value;}};
}
test('entry request waits for API readiness and interrupted hidden playback resumes without restarting',()=>{
  const x=setup();x.transport.start();assert.equal(x.plays,0);x.transport.ready(x.player);assert.equal(x.plays,1);
  x.state(1);x.position(80);x.transport.tick();x.state(2);x.time(1499);x.transport.tick();assert.equal(x.plays,1);
  x.time(1600);x.transport.tick();assert.equal(x.plays,2);assert.equal(x.loads.length,1);assert.equal(x.transport.state,'loading');
});
test('settings pause and browser autoplay refusal are never overridden by recovery',()=>{
  const x=setup();x.transport.ready(x.player);x.transport.start();x.state(1);x.open(true);x.state(2);x.time(60000);x.transport.tick();assert.equal(x.plays,1);assert.equal(x.transport.state,'paused');
  x.open(false);x.transport.start();x.transport.onBlocked();x.time(120000);x.transport.tick();assert.equal(x.plays,2);assert.equal(x.transport.state,'blocked');
  x.transport.start();assert.equal(x.plays,3);
});
test('completion loops across all songs and a failed song advances to an available one',()=>{
  const x=setup();x.transport.ready(x.player);x.transport.start();x.state(1);x.state(0);assert.deepEqual(x.loads.at(-1),{videoId:'second',startSeconds:0});
  x.state(1);x.state(0);assert.deepEqual(x.loads.at(-1),{videoId:'first',startSeconds:0});
  x.transport.onError(150);assert.deepEqual(x.loads.at(-1),{videoId:'second',startSeconds:0});
  x.transport.onError(100);assert.equal(x.transport.state,'unavailable');const count=x.loads.length;x.time(180000);x.transport.tick();assert.equal(x.loads.length,count);
});
test('stalled media resumes at the saved position with bounded retry frequency',()=>{
  const x=setup();x.transport.ready(x.player);x.transport.start();x.state(1);x.position(72);x.transport.tick();
  x.time(26000);x.transport.tick();assert.deepEqual(x.loads.at(-1),{videoId:'first',startSeconds:72});const count=x.loads.length;
  x.time(28000);x.transport.tick();assert.equal(x.loads.length,count);x.transport.pause();x.time(150000);x.transport.tick();assert.equal(x.loads.length,count);
});
test('selecting before API ready loads the requested song, and disposal stops recovery',()=>{
  const x=setup();x.transport.select(1);x.transport.ready(x.player);assert.deepEqual(x.loads.at(-1),{videoId:'second',startSeconds:0});
  x.state(1);x.state(2);x.transport.dispose();x.time(150000);x.transport.tick();assert.equal(x.plays,1);
});
