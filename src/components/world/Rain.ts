import { Color, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';

/** One GPU-instanced draw, with fixed seeds and wind-sheared falling streaks. */
export function createRain(count: number, radius: number, height: number) {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-.014, 0, 0, .014, 0, 0, -.014, .7, 0, .014, 0, 0, .014, .7, 0, -.014, .7, 0], 3));
  const seeds = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const fract = (n: number) => n - Math.floor(n);
    seeds.set([fract(Math.sin(index * 127.1 + 7) * 43758.5), fract(Math.sin(index * 311.7 + 21) * 19243.7), fract(Math.sin(index * 71.3 + 5) * 38131.9), fract(index * .61803398875)], index * 4);
  }
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = count;
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: {
    uTime: { value: 0 }, uStrength: { value: 0 }, uRadius: { value: radius }, uHeight: { value: height }, uOrigin: { value: new Vector3() }, uWind: { value: new Vector2(.48, .23) }, uTint: { value: new Color('#c5eafb') },
  }, vertexShader: `
    attribute vec4 aSeed; uniform float uTime; uniform float uRadius; uniform float uHeight; uniform float uStrength; uniform vec3 uOrigin; uniform vec2 uWind;
    varying float vAlpha;
    void main() {
      float fall=fract(aSeed.z+uTime*(.32+aSeed.w*.12));
      float angle=aSeed.x*6.283185; float radius=sqrt(aSeed.y)*uRadius;
      vec3 p=vec3(cos(angle)*radius,(1.-fall)*uHeight,sin(angle)*radius);
      p.xz+=uWind*(1.-fall)*3.;
      vec3 side=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
      p+=side*position.x+vec3(-uWind.x*.05,1.,-uWind.y*.05)*position.y;
      vec3 origin=uOrigin; origin.y=max(.16,uOrigin.y-uHeight);
      vec4 view=modelViewMatrix*vec4(p+origin,1.);
      gl_Position=projectionMatrix*view;
      vAlpha=step(aSeed.w,uStrength)*smoothstep(0.,.07,fall)*(1.-smoothstep(.94,1.,fall))*(1.-smoothstep(190.,360.,length(view.xyz)))*.52;
    }`, fragmentShader: `uniform vec3 uTint;varying float vAlpha;void main(){if(vAlpha<.002)discard;gl_FragColor=vec4(uTint,vAlpha);\n#include <colorspace_fragment>\n}` });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'rainfall'; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.raycast = () => undefined;
  return { mesh, geometry, material, dispose() { geometry.dispose(); material.dispose(); } };
}
