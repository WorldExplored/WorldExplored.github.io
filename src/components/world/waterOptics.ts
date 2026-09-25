import { REEF_BASINS } from './seafloor';

/** A broad shelf falloff avoids an opaque outline around the reef. */
export function waterOpticalDepth(x: number, z: number, offshoreDistance: number) {
  let shelf = 0;
  for (const basin of REEF_BASINS) {
    const rim = Math.max(0, Math.hypot((x - basin.x) / basin.rx, (z - basin.z) / basin.rz) - .7) * Math.min(basin.rx, basin.rz) / 35;
    shelf = Math.max(shelf, Math.exp(-rim * rim * 4));
  }
  const distance = Math.max(0, offshoreDistance) / (1 + shelf * 2);
  return .85 + distance * .3 + Math.pow(distance / 10, 2.2) * 3;
}

export function waterOpacity(depth:number,viewCosine=1) {
  const cosine=Math.max(0,Math.min(1,viewCosine));
  const absorption=1-Math.exp(-Math.max(0,depth)*.085/Math.max(.08,cosine));
  return absorption+(1-absorption)*Math.pow(1-cosine,5);
}

export const waterOpticsGLSL = /* glsl */ `
  float opticalDepth(vec2 p, float offshoreDistance) {
    float shelf = 0.;
    float rim;
    ${REEF_BASINS.map(({ x, z, rx, rz }) => `rim = max(0., length((p - vec2(${x.toFixed(1)},${z.toFixed(1)})) / vec2(${rx.toFixed(1)},${rz.toFixed(1)})) - .7) * ${(Math.min(rx, rz) / 35).toFixed(7)};\n    shelf = max(shelf, exp(-rim * rim * 4.));`).join('\n    ')}
    float distance = max(0., offshoreDistance) / (1. + shelf * 2.);
    return .85 + distance * .3 + pow(distance / 10., 2.2) * 3.;
  }
`;
