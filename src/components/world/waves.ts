import { islandAt, landDistance, smooth } from './terrain';

export function coastNormal(x: number, z: number) {
  const dx = landDistance(x + .7, z) - landDistance(x - .7, z);
  const dz = landDistance(x, z + .7) - landDistance(x, z - .7);
  const length = Math.max(.001, Math.hypot(dx, dz));
  return { x: -dx / length, z: -dz / length };
}

export function coastExposure(x: number, z: number, distance = landDistance(x, z)) {
  if (distance > 3 || distance < -14) return .12;
  const normal = coastNormal(x, z);
  // A coast facing the southwest only receives full swell if the approach is open water.
  const facing = Math.max(0, normal.x * -.72 + normal.z * .69);
  const near = 1 - smooth(-5, -.5, landDistance(x + normal.x * 6, z + normal.z * 6));
  const far = 1 - smooth(-8, -1.5, landDistance(x + normal.x * 13, z + normal.z * 13));
  const approach = 1 - smooth(-7, -1, landDistance(x - .72 * 10, z + .69 * 10));
  return .12 + .88 * Math.pow(facing, .8) * near * far * (.35 + approach * .65);
}

function waveHash(x: number, z: number) { const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return value - Math.floor(value); }
function waveNoise(x: number, z: number) {
  const ix = Math.floor(x); const iz = Math.floor(z); const fx = smooth(0, 1, x - ix); const fz = smooth(0, 1, z - iz);
  const a = waveHash(ix, iz); const b = waveHash(ix + 1, iz); const c = waveHash(ix, iz + 1); const d = waveHash(ix + 1, iz + 1);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

export function shoreAlong(x: number, z: number) { return Math.sin(x * .17 + z * .11) * .6 + Math.sin(z * .39 - x * .13) * .23; }

export function shoreBreakup(x: number, z: number, time: number, secondary = false) {
  const shift = secondary ? 17.3 : 0;
  const broad = waveNoise(x * .21 + time * .035 + shift, z * .21 - time * .027);
  const fine = waveNoise(x * .62 - time * .06, z * .62 + shift);
  return smooth(.32, .65, broad * .74 + fine * .26);
}

/** Water time is elapsed seconds multiplied by the configured water speed. */
export function shorelinePhase(distance: number, x: number, z: number, time: number) {
  return -distance * 1.32 + time * 1.45 + shoreAlong(x, z);
}

/** Exact arrival of a primary crest, expressed in water time. */
export function shorelineCrestTime(distance: number, x: number, z: number, cycle: number) {
  return (Math.PI * 2 * cycle + distance * 1.32 - shoreAlong(x, z)) / 1.45;
}

export function shorelineWash(distance: number, x: number, z: number, time: number, exposure = coastExposure(x, z, distance)) {
  const along = shoreAlong(x, z), arrival = Math.pow(Math.max(0, Math.cos(time * 1.45 + along - .65)), 4);
  const runup = .28 + Math.sin(time * 1.45 + along - .35) * .48;
  return Math.exp(-Math.pow((-distance - runup) / (.42 + arrival * .38), 2)) * arrival * shoreBreakup(x, z, time) * exposure;
}

export function shorelineWave(distance: number, x: number, z: number, time: number, exposure = coastExposure(x, z, distance)) {
  const sea = -distance;
  if (sea > 10 || sea < -.4) return { crest: 0, foam: 0, curl: 0, rocky: islandAt(x, z).island.id === 'beacon' };
  const along = shoreAlong(x, z);
  const phase = shorelinePhase(distance, x, z, time);
  const secondPhase = sea * .78 + time * .93 + along * 1.7;
  const front = Math.pow(Math.max(0, Math.cos(phase)), 14);
  const swell = Math.pow(Math.max(0, Math.cos(secondPhase)), 18) * .55;
  const shallows = (1 - smooth(4, 10, sea)) * smooth(-.4, .6, sea);
  const breakMask = shoreBreakup(x, z, time); const secondPatch = shoreBreakup(x, z, time, true);
  const crest = (front * breakMask + swell * secondPatch) * shallows * exposure;
  const curl = (-Math.sin(phase) * Math.pow(Math.max(0, Math.cos(phase)), 8) * breakMask - Math.sin(secondPhase) * Math.pow(Math.max(0, Math.cos(secondPhase)), 10) * secondPatch * .45) * shallows * exposure;
  // Wash follows each arrival, spreads briefly, then drains completely between sets.
  const wash = shorelineWash(distance, x, z, time, exposure);
  const lace = .6 + .4 * Math.sin(x * 2.8 - z * 2.2 + time * .35) * Math.sin(z * 3.2 + x * 1.1);
  const foam = Math.min(1, crest * .82 + wash * .72) * lace;
  return { crest, foam, curl, rocky: islandAt(x, z).island.id === 'beacon' };
}

export const shorelineWaveGLSL = /* glsl */ `
float waveHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float waveNoise(vec2 p) {
  vec2 cell=floor(p); vec2 f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(waveHash(cell),waveHash(cell+vec2(1.,0.)),f.x),mix(waveHash(cell+vec2(0.,1.)),waveHash(cell+1.),f.x),f.y);
}
float shoreBreakup(vec2 p,float time,float shift) {
  float broad=waveNoise(p*.21+vec2(time*.035+shift,-time*.027));
  float fine=waveNoise(p*.62+vec2(-time*.06,shift));
  return smoothstep(.32,.65,broad*.74+fine*.26);
}
vec3 shoreWave(float coast, vec2 p, float time, float exposure) {
  float sea=-coast;
  if (sea>10. || sea<-.4) return vec3(0.);
  float along=sin(p.x*.17+p.y*.11)*.6+sin(p.y*.39-p.x*.13)*.23;
  float phase=sea*1.32+time*1.45+along;
  float secondPhase=sea*.78+time*.93+along*1.7;
  float front=pow(max(0.,cos(phase)),14.);
  float swell=pow(max(0.,cos(secondPhase)),18.)*.55;
  float shallow=(1.-smoothstep(4.,10.,sea))*smoothstep(-.4,.6,sea);
  float breakMask=shoreBreakup(p,time,0.); float secondPatch=shoreBreakup(p,time,17.3);
  float crest=(front*breakMask+swell*secondPatch)*shallow*exposure;
  float curl=(-sin(phase)*pow(max(0.,cos(phase)),8.)*breakMask-sin(secondPhase)*pow(max(0.,cos(secondPhase)),10.)*secondPatch*.45)*shallow*exposure;
  float arrival=pow(max(0.,cos(time*1.45+along-.65)),4.);
  float runup=.28+sin(time*1.45+along-.35)*.48;
  float wash=exp(-pow((sea-runup)/(.42+arrival*.38),2.))*arrival*breakMask*exposure;
  float lace=.6+.4*sin(p.x*2.8-p.y*2.2+time*.35)*sin(p.y*3.2+p.x*1.1);
  float foam=min(1.,crest*.82+wash*.72)*lace;
  return vec3(crest,foam,curl);
}
`;
