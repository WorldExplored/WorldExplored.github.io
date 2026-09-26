import { Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial } from 'three';
import { rainSurfaceHeight } from './rainCatchments';

export const RAIN_GRAVITY = 9.81;
const FALL_SPEED = .65, WATER_SURFACE = .14;
export interface RainSource { sample(output: Float64Array, serial: number): void }
export interface RainOptions { capacity: number; impacts: number; sampleHeight?: (x: number, z: number) => number }
const hash = (n: number) => { const value = Math.sin(n * 127.1 + 7) * 43758.5453; return value - Math.floor(value); };
const groundHeight = rainSurfaceHeight;
export function rainFallTime(height: number) { return (Math.sqrt(FALL_SPEED * FALL_SPEED + 2 * RAIN_GRAVITY * Math.max(0, height)) - FALL_SPEED) / RAIN_GRAVITY; }

/** Fixed slots retain each drop's birth, wind and actual sampled landing. No full-column respawn. */
export class RainSimulation {
  readonly origins: Float32Array;
  readonly motion: Float32Array;
  readonly landing: Float64Array;
  readonly active: Uint8Array;
  readonly impacts: Float32Array;
  readonly shapes: Float32Array;
  readonly slopes: Float32Array;
  private readonly sample = new Float64Array(3);
  private readonly height: (x: number, z: number) => number;
  private cursor = 0;
  private waterCursor = 0;
  private landCursor = 0;
  private serial = 0;
  private credit = 0;
  readonly waterSlots: number;
  time = 0;
  live = 0;
  emitted = 0;
  waterHits = 0;
  groundHits = 0;
  dropsChanged = false;
  impactsChanged = false;
  visibleUntil = 0;
  constructor(readonly capacity: number, readonly impactCapacity: number, sampleHeight = groundHeight) {
    this.origins = new Float32Array(capacity * 4); this.motion = new Float32Array(capacity * 4);
    this.landing = new Float64Array(capacity * 4); this.active = new Uint8Array(capacity);
    this.impacts = new Float32Array(impactCapacity * 4); this.shapes = new Float32Array(impactCapacity * 4); this.slopes = new Float32Array(impactCapacity * 2);
    this.height = sampleHeight; this.waterSlots = Math.floor(impactCapacity * .72);
    for (let i = 0; i < capacity; i++) this.origins[i * 4 + 3] = -1000000;
    for (let i = 0; i < impactCapacity; i++) this.impacts[i * 4 + 3] = -1000000;
  }
  emit(source: RainSource, rate: number, seconds: number, now: number, wind: readonly number[]) {
    if (rate <= 0 || seconds <= 0) { this.credit = 0; return; }
    const dt = Math.min(.15, seconds);
    this.credit = Math.min(this.capacity, this.credit + rate * dt);
    let remaining = Math.floor(this.credit), inspected = 0;
    this.credit -= remaining;
    while (remaining > 0 && inspected++ < this.capacity) {
      const slot = this.cursor; this.cursor = (this.cursor + 1) % this.capacity;
      if (this.active[slot]) continue;
      const serial = ++this.serial, offset = slot * 4;
      source.sample(this.sample, serial);
      const x = this.sample[0], y = this.sample[1], z = this.sample[2], born = now - hash(serial + 81) * dt;
      const vx = wind[0] * (1.4 + hash(serial) * .3), vz = wind[2] * (1.4 + hash(serial + 1) * .3);
      const maximum = rainFallTime(y - WATER_SURFACE);
      let low=0,high=maximum;
      // Find the first surface reached along the wind-blown trajectory. A fixed
      // endpoint iteration can oscillate between a roof edge and the ground below.
      for(let step=1;step<=24;step++){
        const t=maximum*step/24;
        if(y-FALL_SPEED*t-RAIN_GRAVITY*.5*t*t<=Math.max(WATER_SURFACE,this.height(x+vx*t,z+vz*t))){high=t;break;}
        low=t;
      }
      for(let step=0;step<18;step++){
        const t=(low+high)*.5;
        if(y-FALL_SPEED*t-RAIN_GRAVITY*.5*t*t>Math.max(WATER_SURFACE,this.height(x+vx*t,z+vz*t)))low=t;else high=t;
      }
      const flight=(low+high)*.5,floor=Math.max(WATER_SURFACE,this.height(x+vx*flight,z+vz*flight));
      this.origins[offset] = x; this.origins[offset + 1] = y; this.origins[offset + 2] = z; this.origins[offset + 3] = born;
      this.motion[offset] = vx; this.motion[offset + 1] = vz; this.motion[offset + 2] = flight; this.motion[offset + 3] = hash(serial + 71);
      this.landing[offset] = x + vx * flight; this.landing[offset + 1] = floor; this.landing[offset + 2] = z + vz * flight; this.landing[offset + 3] = born + flight;
      this.active[slot] = 1; this.live++; this.emitted++; this.dropsChanged = true; remaining--;
    }
  }
  advance(now: number, paused = false) {
    if (paused) return;
    this.time = now;
    for (let slot = 0; slot < this.capacity; slot++) {
      const offset = slot * 4;
      if (!this.active[slot] || now < this.landing[offset + 3]) continue;
      this.active[slot] = 0; this.live--;
      const water = this.landing[offset + 1] <= WATER_SURFACE;
      if (water) this.waterHits++; else this.groundHits++;
      // Aggregate dense rain into bounded, legible surface responses.
      if ((water ? this.waterHits : this.groundHits) % 3 === 0) this.impact(slot, water);
    }
  }
  private impact(drop: number, water: boolean) {
    const d = drop * 4, x = this.landing[d], y = this.landing[d + 1], z = this.landing[d + 2], born = this.landing[d + 3];
    let slot = -1;
    if (!water) {
      for (let i = this.waterSlots; i < this.impactCapacity; i++) {
        const offset = i * 4;
        if (born - this.impacts[offset + 3] < this.shapes[offset + 1] && Math.hypot(this.impacts[offset] - x, this.impacts[offset + 2] - z) < .6) {
          this.shapes[offset] = Math.min(.62, this.shapes[offset] + .045);
          this.impacts[offset + 3] = born; this.visibleUntil = Math.max(this.visibleUntil, born + this.shapes[offset + 1]); this.impactsChanged = true; return;
        }
      }
      slot = this.waterSlots + this.landCursor; this.landCursor = (this.landCursor + 1) % (this.impactCapacity - this.waterSlots);
    } else { slot = this.waterCursor; this.waterCursor = (this.waterCursor + 1) % this.waterSlots; }
    const offset = slot * 4;
    const sx = water ? 0 : (this.height(x + .15, z) - this.height(x - .15, z)) / .3;
    const sz = water ? 0 : (this.height(x, z + .15) - this.height(x, z - .15)) / .3;
    // Steep ground sheds water rather than suspending a flat pool over a cliff.
    if (!water && Math.hypot(sx, sz) > .46) return;
    this.impacts[offset] = x; this.impacts[offset + 1] = y + (water ? .065 : .025); this.impacts[offset + 2] = z; this.impacts[offset + 3] = born;
    this.shapes[offset] = water ? .24 + hash(drop + 8) * .24 : .17 + hash(drop + 11) * .12;
    this.shapes[offset + 1] = water ? 1.45 : 7 + hash(drop + 7) * 6;
    this.shapes[offset + 2] = water ? 0 : 1; this.shapes[offset + 3] = hash(drop + 1);
    this.slopes[slot * 2] = sx; this.slopes[slot * 2 + 1] = sz;
    this.visibleUntil = Math.max(this.visibleUntil, born + this.shapes[offset + 1]);
    this.impactsChanged = true;
  }
}

function attribute(values: Float32Array, size: number) { return new InstancedBufferAttribute(values, size).setUsage(DynamicDrawUsage); }
export function createRain({ capacity, impacts, sampleHeight }: RainOptions) {
  const simulation = new RainSimulation(capacity, impacts, sampleHeight);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, -.5, 1, 0, .5, 0, 0, .5, 1, 0, -.5, 1, 0], 3));
  geometry.setAttribute('aBirth', attribute(simulation.origins, 4)); geometry.setAttribute('aMotion', attribute(simulation.motion, 4));
  geometry.instanceCount = capacity;
  const time = { value: 0 }, daylight = { value: 1 };
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: time, uDaylight: daylight, uTint: { value: new Color('#bad6e0') } },
    vertexShader: `attribute vec4 aBirth;attribute vec4 aMotion;uniform float uTime;varying float vAlpha;
    void main(){float age=uTime-aBirth.w;if(age<0.||age>=aMotion.z){gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;return;}
    vec3 p=aBirth.xyz+vec3(aMotion.x*age,-${FALL_SPEED}*age-${RAIN_GRAVITY / 2}*age*age,aMotion.y*age);
    vec3 side=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
    float speed=${FALL_SPEED}+${RAIN_GRAVITY}*age;float streak=min(.42,.07+speed*.015);
    p+=side*position.x*(.025+aMotion.w*.012)+normalize(vec3(-aMotion.x,speed,-aMotion.y))*position.y*streak;
    vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
    vAlpha=smoothstep(0.,.08,age)*(1.-smoothstep(190.,360.,length(view.xyz)))*(.46+aMotion.w*.25);}`,
    fragmentShader: 'uniform vec3 uTint;uniform float uDaylight;varying float vAlpha;void main(){if(vAlpha<.002)discard;gl_FragColor=vec4(uTint*(.30+.70*uDaylight),vAlpha);\n#include <colorspace_fragment>\n}' });
  const mesh = new Mesh(geometry, material); mesh.name = 'falling-cloud-droplets'; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.raycast = () => undefined;
  const impactGeometry = new InstancedBufferGeometry();
  impactGeometry.setAttribute('position', new Float32BufferAttribute([-1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1], 3));
  impactGeometry.setAttribute('aImpact', attribute(simulation.impacts, 4)); impactGeometry.setAttribute('aShape', attribute(simulation.shapes, 4)); impactGeometry.setAttribute('aSlope', attribute(simulation.slopes, 2)); impactGeometry.instanceCount = impacts;
  const impactMaterial = new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: time, uDaylight: daylight },
    vertexShader: `attribute vec4 aImpact;attribute vec4 aShape;attribute vec2 aSlope;uniform float uTime;varying vec2 vUv;varying vec4 vShape;varying float vAge;
    void main(){float age=uTime-aImpact.w;if(age<0.||age>=aShape.y){gl_Position=vec4(2.,2.,2.,1.);vAge=-1.;return;}
    float growth=aShape.z<.5?.25+age/aShape.y: (.75+.25*smoothstep(0.,.3,age))*(1.-.28*smoothstep(aShape.y*.25,aShape.y,age));vec2 offset=position.xz*aShape.x*growth;
    vec3 p=aImpact.xyz+vec3(offset.x,dot(offset,aSlope),offset.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);vUv=position.xz;vShape=aShape;vAge=age;}`,
    fragmentShader: `uniform float uDaylight;varying vec2 vUv;varying vec4 vShape;varying float vAge;
    void main(){if(vAge<0.)discard;float r=length(vUv),angle=atan(vUv.y,vUv.x);float fade=1.-smoothstep(vShape.y*.25,vShape.y,vAge);float alpha;vec3 tint;
    if(vShape.z<.5){alpha=(1.-smoothstep(.035,.10,abs(r-.77)))*fade*.38;tint=vec3(.41,.78,.81);}
    else{float edge=.86+sin(angle*3.+vShape.w*6.28)*.055+cos(angle*5.-vShape.w*7.)*.03;alpha=(1.-smoothstep(edge-.09,edge,r))*fade*.27;tint=mix(vec3(.12,.30,.34),vec3(.45,.72,.73),smoothstep(.61,.68,r)*.42);}
    if(alpha<.003)discard;gl_FragColor=vec4(tint*(.32+.68*uDaylight),alpha);\n#include <colorspace_fragment>\n}` });
  const impactMesh = new Mesh(impactGeometry, impactMaterial); impactMesh.name = 'rain-ripples-and-puddles'; impactMesh.frustumCulled = false; impactMesh.renderOrder = 4; impactMesh.raycast = () => undefined;
  const root = new Group(); root.name = 'physical-rainfall'; root.add(mesh, impactMesh);
  return { root, mesh, geometry, material, impactMesh, impactGeometry, impactMaterial, simulation,
    update(now: number, paused: boolean, light = 1) {
      simulation.advance(now, paused); time.value = simulation.time; daylight.value = light; root.visible = simulation.live > 0 || simulation.time < simulation.visibleUntil;
      if (simulation.dropsChanged) { geometry.getAttribute('aBirth').needsUpdate = true; geometry.getAttribute('aMotion').needsUpdate = true; simulation.dropsChanged = false; }
      if (simulation.impactsChanged) { impactGeometry.getAttribute('aImpact').needsUpdate = true; impactGeometry.getAttribute('aShape').needsUpdate = true; impactGeometry.getAttribute('aSlope').needsUpdate = true; simulation.impactsChanged = false; }
    },
    dispose() { geometry.dispose(); material.dispose(); impactGeometry.dispose(); impactMaterial.dispose(); },
  };
}
