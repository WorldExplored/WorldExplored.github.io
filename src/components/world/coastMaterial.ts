import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three';

/** Shared sand lighting avoids a color discontinuity where the island apron ends. */
export const coastalSandGLSL = /* glsl */ `
float sandHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sandNoise(vec2 p){vec2 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(sandHash(c),sandHash(c+vec2(1.,0.)),f.x),mix(sandHash(c+vec2(0.,1.)),sandHash(c+1.),f.x),f.y);}
vec3 submergedSand(float depth){return mix(vec3(.68,.65,.47),vec3(.39,.49,.40),smoothstep(.35,5.,depth));}
float sandGrain(vec2 p){return .976+sandNoise(p*64.)*.048;}
`;

/** Sub-centimetre mineral grains, not the large rocks in the previous shore normal scan. */
export function createSandMicroNormal() {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*4;
    const hash=(a:number,b:number)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
    data[offset]=Math.round(128+(hash(x,y)-.5)*24);
    data[offset+1]=Math.round(128+(hash(x+47,y+93)-.5)*24);
    data[offset+2]=254;data[offset+3]=255;
  }
  const texture=new DataTexture(data,size,size);texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(8,8);
  texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
