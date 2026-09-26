import { BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { cloudBounds, cloudDensity, cloudOrigin, cloudVisibility, rayCloudDistance, createCloudClusters, canSqueezeCloud, CLOUD_WET_THRESHOLD, MAX_CLOUDS, type CloudCluster } from './clouds';

const TETRAHEDRA = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
const EDGES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

/** A closed isosurface, rather than a collection of intersecting puff shells. */
export function cloudSurfaceGeometry(clusters: readonly CloudCluster[]) {
  const positions: number[] = []; const normals: number[] = []; const ids: number[] = []; const shading: number[] = []; const indices: number[] = [];
  const ranges: { start: number; count: number }[] = [];
  const point = new Vector3(); const normal = new Vector3(); const center = new Vector3();
  const tangent = new Vector3(); const bitangent = new Vector3(); const edgeA = new Vector3(); const edgeB = new Vector3();
  clusters.forEach((cloud, cloudIndex) => {
    const bounds = cloudBounds(cloud);
    const size = bounds.max.clone().sub(bounds.min);
    const step = Math.max(cloud.archetype === 'atmospheric' ? .72 : .61, size.x / 58, size.y / 30, size.z / 30);
    const nx = Math.ceil(size.x / step) + 1; const ny = Math.ceil(size.y / step) + 1; const nz = Math.ceil(size.z / step) + 1;
    const sx = size.x / (nx - 1); const sy = size.y / (ny - 1); const sz = size.z / (nz - 1);
    const stride = nx * ny; const total = stride * nz;
    const density = new Float32Array(total); const gradient = new Float32Array(total * 3);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      density[z * stride + y * nx + x] = cloudDensity(cloud, bounds.min.x + x * sx, bounds.min.y + y * sy, bounds.min.z + z * sz);
    }
    for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const index = z * stride + y * nx + x;
      gradient[index * 3] = (density[index - 1] - density[index + 1]) / (2 * sx);
      gradient[index * 3 + 1] = (density[index - nx] - density[index + nx]) / (2 * sy);
      gradient[index * 3 + 2] = (density[index - stride] - density[index + stride]) / (2 * sz);
    }
    const edgeVertices = new Map<number, number>();
    function vertex(a: number, b: number) {
      const key = Math.min(a, b) * total + Math.max(a, b);
      const cached = edgeVertices.get(key);
      if (cached !== undefined) return cached;
      const fraction = density[a] / (density[a] - density[b]);
      const ax = a % nx; const ay = Math.floor(a / nx) % ny; const az = Math.floor(a / stride);
      const bx = b % nx; const by = Math.floor(b / nx) % ny; const bz = Math.floor(b / stride);
      point.set(bounds.min.x + (ax + (bx - ax) * fraction) * sx, bounds.min.y + (ay + (by - ay) * fraction) * sy, bounds.min.z + (az + (bz - az) * fraction) * sz);
      normal.set(gradient[a * 3] + (gradient[b * 3] - gradient[a * 3]) * fraction, gradient[a * 3 + 1] + (gradient[b * 3 + 1] - gradient[a * 3 + 1]) * fraction, gradient[a * 3 + 2] + (gradient[b * 3 + 2] - gradient[a * 3 + 2]) * fraction).normalize();
      const index = positions.length / 3;
      positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); ids.push(cloudIndex);
      const occlusion = Math.max(0, cloudDensity(cloud, point.x - .45, point.y + .85, point.z - .35));
      shading.push((point.y - bounds.min.y) / size.y, Math.min(1, occlusion));
      edgeVertices.set(key, index);
      return index;
    }
    const start = indices.length;
    for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
      const base = z * stride + y * nx + x;
      const corners = [base, base + 1, base + nx, base + nx + 1, base + stride, base + stride + 1, base + stride + nx, base + stride + nx + 1];
      let inside = 0;
      for (const corner of corners) if (density[corner] >= 0) inside++;
      if (inside === 0 || inside === 8) continue;
      for (const tetrahedron of TETRAHEDRA) {
        const polygon: number[] = [];
        for (const [a, b] of EDGES) {
          const first = corners[tetrahedron[a]]; const second = corners[tetrahedron[b]];
          if ((density[first] >= 0) !== (density[second] >= 0)) polygon.push(vertex(first, second));
        }
        if (polygon.length < 3) continue;
        center.set(0, 0, 0); normal.set(0, 0, 0);
        for (const index of polygon) { center.add(point.fromArray(positions, index * 3)); normal.add(point.fromArray(normals, index * 3)); }
        center.multiplyScalar(1 / polygon.length); normal.normalize();
        tangent.fromArray(positions, polygon[0] * 3).sub(center).normalize(); bitangent.crossVectors(normal, tangent).normalize();
        polygon.sort((a, b) => {
          point.fromArray(positions, a * 3).sub(center); const first = Math.atan2(point.dot(bitangent), point.dot(tangent));
          point.fromArray(positions, b * 3).sub(center); return first - Math.atan2(point.dot(bitangent), point.dot(tangent));
        });
        for (let fan = 1; fan < polygon.length - 1; fan++) {
          point.fromArray(positions, polygon[0] * 3);
          edgeA.fromArray(positions, polygon[fan] * 3).sub(point); edgeB.fromArray(positions, polygon[fan + 1] * 3).sub(point);
          if (edgeA.cross(edgeB).dot(normal) >= 0) indices.push(polygon[0], polygon[fan], polygon[fan + 1]);
          else indices.push(polygon[0], polygon[fan + 1], polygon[fan]);
        }
      }
    }
    ranges.push({ start, count: indices.length - start });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aCloud', new Float32BufferAttribute(ids, 1));
  geometry.setAttribute('aShading', new Float32BufferAttribute(shading, 2));
  geometry.setIndex(indices);
  geometry.userData.cloudRanges = ranges;
  geometry.setDrawRange(0, indices.length);
  return geometry;
}

const cloudVertex = /* glsl */ `
  uniform vec4 uOrigins[${MAX_CLOUDS}];
  uniform vec3 uTouches[${MAX_CLOUDS}];
  uniform float uVisibility[${MAX_CLOUDS}];
  uniform float uMoisture[${MAX_CLOUDS}];
  attribute float aCloud;
  attribute vec2 aShading;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying vec2 vShading;
  varying float vDistance;
  varying float vOpacity;
  varying float vMoisture;
  void main() {
    int cloud = int(aCloud + .5);
    vec3 difference = position - uTouches[cloud];
    float dimple = uOrigins[cloud].w * exp(-dot(difference, difference) / 5.2);
    vec3 p = position - normal * dimple * .78;
    p.y *= 1. - uOrigins[cloud].w * .12;
    p.xz *= 1. + uOrigins[cloud].w * .055;
    vOpacity = uVisibility[cloud];
    vMoisture = uMoisture[cloud];
    vec4 point = modelMatrix * vec4(p + uOrigins[cloud].xyz, 1.);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - point.xyz;
    vLocal = position;
    vShading = aShading;
    vDistance = length(vView);
    gl_Position = projectionMatrix * viewMatrix * point;
  }
`;
const cloudFragment = /* glsl */ `
  uniform vec3 uWhite;
  uniform vec3 uSunDirection;
  uniform vec3 uShade;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying vec2 vShading;
  varying float vDistance;
  varying float vOpacity;
  varying float vMoisture;
  void main() {
    vec3 n = normalize(vNormal);
    float topLight = smoothstep(-.65, .75, n.y);
    float sun = smoothstep(-.5, .9, dot(n, uSunDirection));
    float light = clamp(.10 + topLight * .57 + sun * .20 + vShading.x * .19 - vShading.y * .16, 0., 1.);
    // The first usable moisture is already visibly gray; bright white means empty.
    float wet = pow(clamp((vMoisture - ${CLOUD_WET_THRESHOLD}) / ${1 - CLOUD_WET_THRESHOLD}, 0., 1.), .35);
    vec3 wetShade = uShade * mix(1., .30, wet);
    vec3 wetTop = mix(uWhite, mix(uWhite * .38, uShade * .62, .25), wet);
    // Moisture darkens the belly most strongly while retaining a lit, rounded crown.
    vec3 color = mix(wetShade, wetTop, light);
    float relief = sin(vLocal.x * 5.1 + vLocal.y * 1.3) * sin(vLocal.z * 4.7 - vLocal.y * 3.8);
    color += relief * .012 * topLight;
    float rim = pow(1. - max(dot(n, normalize(vView)), 0.), 3.);
    color = mix(color, wetTop, rim * .09);
    color = mix(color, uFog, smoothstep(uFogRange.x, uFogRange.y, vDistance));
    if(vOpacity < .003) discard;
    gl_FragColor = vec4(color, vOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeClouds(diagnostics: boolean, clusters = createCloudClusters()) {
  const geometry = cloudSurfaceGeometry(clusters);
  const origins = Array.from({length:MAX_CLOUDS}, () => new Vector4()); const touches = Array.from({length:MAX_CLOUDS}, () => new Vector3());
  const moisture: number[] = Array.from({length:MAX_CLOUDS}, (_, i) => clusters[i]?.moisture ?? 0);
  const visibility: number[] = Array.from({length:MAX_CLOUDS}, (_, index) => index < clusters.length ? 1 : 0);
  const material = new ShaderMaterial({ transparent: true, depthWrite: true, vertexShader: cloudVertex, fragmentShader: cloudFragment, uniforms: {
    uVisibility: { value: visibility }, uMoisture: { value: moisture }, uSunDirection: { value: new Vector3(-.4, .8, -.35).normalize() },
    uOrigins: { value: origins }, uTouches: { value: touches }, uWhite: { value: new Color(world.lighting.cloudColor) }, uShade: { value: new Color('#8aabc9') },
    uFog: { value: new Color(world.lighting.fogColor) }, uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) },
  } });
  const mesh = new Mesh(geometry, material); mesh.name = 'environment-clouds'; mesh.frustumCulled = false;
  mesh.userData.clusters = clusters;
  mesh.userData.cameraInteraction = true;
  let pickElapsed = 0;
  mesh.raycast = (raycaster, intersections) => {
    for (let index = 0; index < clusters.length; index++) {
      if (visibility[index] < .15 || index >= clusters.length || !canSqueezeCloud(clusters[index])) continue;
      const distance = rayCloudDistance(raycaster.ray, clusters[index], pickElapsed);
      if (distance === null) continue;
      intersections.push({ distance, point: raycaster.ray.at(distance, new Vector3()), object: mesh, faceIndex: index });
    }
  };
  const debug = diagnostics ? new Mesh(geometry, material.clone()) : null;
  if (debug) { debug.material.wireframe = true; debug.material.transparent = true; debug.material.depthWrite = false; debug.material.fragmentShader = cloudFragment.replace('gl_FragColor = vec4(color, vOpacity);', 'gl_FragColor = vec4(.02, .2, .8, .3 * vOpacity);'); debug.name = 'cloud-hit-volumes'; debug.frustumCulled = false; }
  return { clusters, visibility, moisture, setPickTime: (elapsed: number) => { pickElapsed = elapsed; }, activeCount: clusters.length, mesh, geometry, material, origins, touches, debug, origin: new Vector3(),
    dispose() { geometry.dispose(); material.dispose(); debug?.material.dispose(); },
  };
}

const dayCloud = new Color('#ffffff'), duskCloud = new Color('#ffbda8'), stormCloud = new Color('#acb8c2');
const dayShade = new Color('#8aabc9'), duskShade = new Color('#786180'), stormShade = new Color('#4d657d'), dayFog = new Color(world.lighting.fogColor);

export function writeCloudMatrices(clouds: ReturnType<typeof makeClouds>, elapsed: number, state?: SceneRuntime) {
  clouds.setPickTime(elapsed);
  for (let index = 0; index < clouds.clusters.length; index++) {
    const cluster = clouds.clusters[index];
    clouds.moisture[index] = cluster.moisture;
    clouds.visibility[index] = index < clouds.activeCount ? cloudVisibility(cluster, elapsed) : 0;
    cloudOrigin(cluster, elapsed, clouds.origin);
    clouds.origins[index].set(clouds.origin.x, clouds.origin.y, clouds.origin.z, cluster.response);
    clouds.touches[index].fromArray(cluster.interaction);
  }
  if (state?.weather) {
    const weather = state.weather;
    clouds.material.uniforms.uSunDirection.value.fromArray(state.sunDirection);
    clouds.material.uniforms.uWhite.value.set('#5d759e').lerp(dayCloud, weather.daylight).lerp(duskCloud, weather.dusk * .5).lerp(stormCloud, weather.storm * .65 * weather.daylight);
    clouds.material.uniforms.uShade.value.set('#1d2b48').lerp(dayShade, weather.daylight).lerp(duskShade, weather.dusk * .5).lerp(stormShade, weather.storm * .7 * weather.daylight);
    clouds.material.uniforms.uFog.value.set('#293a5a').lerp(dayFog, weather.daylight).lerp(duskCloud, weather.dusk * .35);
  }
  if (clouds.debug) {
    clouds.debug.material.uniforms.uOrigins.value = clouds.origins;
    clouds.debug.material.uniforms.uTouches.value = clouds.touches;
  }
  const ranges = clouds.geometry.userData.cloudRanges as { start: number; count: number }[];
  const last = ranges[clouds.activeCount - 1];
  clouds.geometry.setDrawRange(0, last ? last.start + last.count : 0);
}
