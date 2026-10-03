import { REEF_BASINS } from './seafloor';
import { SEAGRASS_MEADOW } from './seagrassMeadowLayout';

/** A broad shelf falloff avoids an opaque outline around the reef. */
export function waterOpticalDepth(x: number, z: number, offshoreDistance: number) {
  let shelf = 0;
  for (const basin of REEF_BASINS) {
    const rim = Math.max(0, Math.hypot((x - basin.x) / basin.rx, (z - basin.z) / basin.rz) - .7) * Math.min(basin.rx, basin.rz) / 35;
    shelf = Math.max(shelf, Math.exp(-rim * rim * 4));
  }
  const distance = Math.max(0, offshoreDistance) / (1 + shelf * 2);
  // Beyond the visible shelf, the deep slope closes transparency before the floor edge.
  return .85 + distance * .3 + Math.pow(distance / 10, 2.1) * 3 + Math.pow(Math.max(0, distance - 25), 2) * .3;
}

/** Clear grazing water blends into the same ocean without a circular hard edge. */
export function meadowWaterClarity(x:number,z:number) {
  const m=SEAGRASS_MEADOW,dx=x-m.x,dz=z-m.z;
  const radius=Math.hypot(dx/m.rx,dz/m.rz)+Math.sin(dx*.35+dz*.21)*Math.sin(dz*.28)*.055;
  const t=Math.max(0,Math.min(1,(radius-m.clarityInner)/(m.clarityOuter-m.clarityInner)));
  return 1-t*t*(3-2*t);
}
export function waterOpacity(depth:number,viewCosine=1,clarity=0) {
  const cosine=Math.max(0,Math.min(1,viewCosine));
  const absorption=1-Math.exp(-Math.max(0,depth)*.085*(1-.6*Math.max(0,Math.min(1,clarity)))/Math.max(.08,cosine));
  return absorption+(1-absorption)*Math.pow(1-cosine,5);
}

export const waterOpticsGLSL = /* glsl */ `
  float meadowClarity(vec2 p) {
    vec2 offset=p-vec2(${SEAGRASS_MEADOW.x.toFixed(1)},${SEAGRASS_MEADOW.z.toFixed(1)});
    float radius=length(offset/vec2(${SEAGRASS_MEADOW.rx.toFixed(1)},${SEAGRASS_MEADOW.rz.toFixed(1)}))+sin(offset.x*.35+offset.y*.21)*sin(offset.y*.28)*.055;
    return 1.-smoothstep(${SEAGRASS_MEADOW.clarityInner.toFixed(1)},${SEAGRASS_MEADOW.clarityOuter.toFixed(1)},radius);
  }
  float opticalDepth(vec2 p, float offshoreDistance) {
    float shelf = 0.;
    float rim;
    ${REEF_BASINS.map(({ x, z, rx, rz }) => `rim = max(0., length((p - vec2(${x.toFixed(1)},${z.toFixed(1)})) / vec2(${rx.toFixed(1)},${rz.toFixed(1)})) - .7) * ${(Math.min(rx, rz) / 35).toFixed(7)};\n    shelf = max(shelf, exp(-rim * rim * 4.));`).join('\n    ')}
    float distance = max(0., offshoreDistance) / (1. + shelf * 2.);
    return .85 + distance * .3 + pow(distance / 10., 2.1) * 3. + pow(max(0., distance - 25.), 2.) * .3;
  }
`;
