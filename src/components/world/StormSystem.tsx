'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeClouds, writeCloudMatrices } from './CloudSurface';
import { createCloudClusters } from './clouds';
import { createRain } from './Rain';
import { stormAt, weatherQa } from './weatherState';
import type { EnvironmentProps } from './Water';

export function StormSystem({ runtime, paused, quality }: EnvironmentProps) {
  const resources = useMemo(() => {
    const cluster = createCloudClusters(4)[3];
    cluster.center = [-300, 57, -170]; cluster.speed = 0;
    for (const puff of cluster.puffs) {
      puff.offset[0] *= 11; puff.offset[1] *= 3.2; puff.offset[2] *= 8;
      puff.scale[0] *= 11; puff.scale[1] *= 3.2; puff.scale[2] *= 8;
    }
    const clouds = makeClouds(false, [cluster]);
    clouds.mesh.name = 'travelling-storm-bank'; clouds.mesh.raycast = () => undefined;
    clouds.mesh.userData.cameraInteraction = false;
    return { clouds, rain: createRain(4400, 140, 52) };
  }, []);
  const qa = useMemo(() => weatherQa(), []);
  useEffect(() => () => { resources.clouds.dispose(); resources.rain.dispose(); }, [resources]);
  useFrame(() => {
    const time = qa.storm ?? runtime.current.activeElapsed;
    const storm = stormAt(time);
    resources.clouds.mesh.visible = storm.active;
    resources.rain.mesh.visible = storm.rain > .001 && !paused;
    if (!storm.active) return;
    const cluster = resources.clouds.clusters[0]; cluster.center = storm.center;
    writeCloudMatrices(resources.clouds, 0, runtime.current);
    resources.clouds.visibility[0] = storm.cover;
    const material = resources.rain.material;
    material.uniforms.uOrigin.value.set(storm.center[0], 52, storm.center[2]);
    material.uniforms.uTime.value = runtime.current.activeElapsed;
    material.uniforms.uStrength.value = storm.rain;
    material.uniforms.uWind.value.set(runtime.current.weather.wind[0], runtime.current.weather.wind[2]);
    resources.rain.geometry.instanceCount = quality === 'high' ? 4400 : quality === 'medium' ? 2600 : 1400;
  });
  return <group name="weather-front" dispose={null}><primitive object={resources.clouds.mesh}/><primitive object={resources.rain.mesh}/></group>;
}
