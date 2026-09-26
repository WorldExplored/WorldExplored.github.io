'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeClouds, writeCloudMatrices } from './CloudSurface';
import { createCloudClusters, createCloudRainSource } from './clouds';
import { createRain } from './Rain';
import { createStormSample, stormAt, weatherQa } from './weatherState';
import type { EnvironmentProps } from './Water';

export function StormSystem({ runtime, paused, quality }: EnvironmentProps) {
  const resources = useMemo(() => {
    const cluster = createCloudClusters(4)[3];
    cluster.center = [-300, 57, -170]; cluster.speed = 0; cluster.moisture = .97;
    for (const puff of cluster.puffs) {
      puff.offset[0] *= 11; puff.offset[1] *= 3.2; puff.offset[2] *= 8;
      puff.scale[0] *= 11; puff.scale[1] *= 3.2; puff.scale[2] *= 8;
    }
    const clouds = makeClouds(false, [cluster]);
    clouds.mesh.name = 'travelling-storm-bank'; clouds.mesh.raycast = () => undefined;
    clouds.mesh.userData.cameraInteraction = false;
    return { clouds, storm: createStormSample(), source: createCloudRainSource(cluster), rain: createRain({ capacity: 4400, impacts: 540 }) };
  }, []);
  const qa = useMemo(() => weatherQa(), []);
  useEffect(() => () => { resources.clouds.dispose(); resources.rain.dispose(); }, [resources]);
  useFrame((_, delta) => {
    const time = qa.storm ?? runtime.current.activeElapsed;
    const storm = stormAt(time, resources.storm);
    resources.clouds.mesh.visible = storm.active;
    if (storm.active) {
      const cluster = resources.clouds.clusters[0]; cluster.center = storm.center;
      cluster.moisture = .48 + storm.rain * .49;
      writeCloudMatrices(resources.clouds, 0, runtime.current);
      resources.clouds.visibility[0] = storm.cover;
      resources.source.origin.fromArray(storm.center);
      if (!paused) resources.rain.simulation.emit(resources.source, storm.rain * (quality === 'high' ? 1000 : quality === 'medium' ? 700 : 440), delta, runtime.current.activeElapsed, runtime.current.weather.wind);
    }
    // Previously emitted drops and their puddles outlive the departing cloud bank.
    resources.rain.update(runtime.current.activeElapsed, paused, runtime.current.weather.daylight);
  });
  return <group name="weather-front" dispose={null}><primitive object={resources.clouds.mesh}/><primitive object={resources.rain.root}/></group>;
}
