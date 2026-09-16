'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CylinderGeometry, DoubleSide, LatheGeometry, MathUtils, Mesh, MeshPhysicalMaterial, Shape, SphereGeometry, Vector2, Vector3 } from 'three';
import { world, type LandmarkId } from '@/content/world';
import { combine, gardenPlan, platform, roundedBox, stroke, strut, TAU, usePalette, useResources, type ModelProps } from './BuildingKit';
import { ComputeBuilding } from './ComputeBuilding';
import { ResearchInstitute } from './ResearchInstitute';
import { CampusHall } from './CampusHall';
import { GardenGallery } from './GardenGallery';
import { ReceptionTerminal } from './ReceptionTerminal';
import { LandmarkMechanisms } from './LandmarkMechanisms';

function CoastalLighthouse(props: ModelProps) {
  const material = usePalette(props, 'building');
  const beam = useRef<Mesh<BufferGeometry, MeshPhysicalMaterial>>(null);
  const [beamMaterial] = useState(() => new MeshPhysicalMaterial({ color: '#ddffff', emissive: '#c9ffff', emissiveIntensity: 0, transparent: true, opacity: 0, roughness: 0.1, depthWrite: false, side: DoubleSide }));
  useEffect(() => () => beamMaterial.dispose(), [beamMaterial]);
  const geometry = useResources(() => {
    const profile = Array.from({ length: 33 }, (_, index) => {
      const t = index / 32;
      return new Vector2(0.87 - 0.44 * t + 0.045 * Math.sin(Math.PI * t), 1.02 + 4.24 * t);
    });
    const circle = (radius: number, y: number) => (t: number) => new Vector3(Math.cos(t * TAU) * radius, y, Math.sin(t * TAU) * radius);
    const balcony = new Shape();
    balcony.absellipse(0, 0, 1.13, 1.13, 0, TAU, false, 0);
    const cap = new LatheGeometry([new Vector2(0, 6.49), new Vector2(0.78, 6.49), new Vector2(0.81, 6.54), new Vector2(0.69, 6.62), new Vector2(0.4, 6.83), new Vector2(0.13, 6.98), new Vector2(0, 7.035)], 72);
    return {
      foundation: platform(gardenPlan(4.26, 3.7)),
      shaft: new LatheGeometry(profile, 72),
      balcony: platform(balcony, 5.3, 0.13),
      rails: combine([stroke(circle(1.09, 5.83), 0.025, 72), stroke(circle(1.09, 5.48), 0.017, 72), ...Array.from({ length: 14 }, (_, index) => {
        const angle = index * TAU / 14;
        return strut(new Vector3(Math.cos(angle) * 1.09, 5.36, Math.sin(angle) * 1.09), new Vector3(Math.cos(angle) * 1.09, 5.83, Math.sin(angle) * 1.09), 0.021);
      })]),
      lantern: new CylinderGeometry(0.58, 0.58, 1.04, 72, 1, true).translate(0, 5.98, 0),
      frames: combine([stroke(circle(0.64, 5.48), 0.038, 72), stroke(circle(0.64, 6.49), 0.038, 72), ...Array.from({ length: 8 }, (_, index) => {
        const angle = index * TAU / 8;
        return strut(new Vector3(Math.cos(angle) * 0.63, 5.47, Math.sin(angle) * 0.63), new Vector3(Math.cos(angle) * 0.63, 6.5, Math.sin(angle) * 0.63), 0.025);
      })]),
      cap,
      finial: new SphereGeometry(0.07, 24, 16).translate(0, 7.07, 0),
      door: roundedBox(0.42, 0.83, 0.05, 0.13).translate(0, 1.48, 0.858),
      windows: combine([roundedBox(0.19, 0.37, 0.035, 0.08).translate(0, 3.12, 0.7), roundedBox(0.17, 0.32, 0.035, 0.075).translate(0, 4.36, 0.565)]),
      threshold: roundedBox(0.73, 0.1, 0.42, 0.04).translate(0, 1.06, 1.03),
      beam: new CylinderGeometry(1.35, 0.08, 10, 32, 1, true).rotateZ(Math.PI / 2).translate(-5, 0, 0),
    };
  });
  useFrame((_, delta) => {
    if (props.paused || !beam.current) return;
    const enabled = world.lighting.lampEnabled && (props.active || props.runtime.current.hovered === 'building');
    beam.current.rotation.y = Math.sin(props.runtime.current.elapsed * 0.12) * Math.PI * 35 / 180;
    beam.current.material.opacity = world.lighting.lampEnabled ? MathUtils.damp(beam.current.material.opacity, enabled ? (props.active ? 0.045 : 0.035) : 0.008, 10, delta) : 0;
    beam.current.material.emissiveIntensity = world.lighting.lampEnabled ? world.lighting.lampIntensity : 0;
  });
  return <group dispose={null}>
    <mesh geometry={geometry.foundation} material={material.paving} castShadow receiveShadow />
    <mesh name="lighthouse-taper" geometry={geometry.shaft} material={material.porcelain} castShadow />
    <mesh geometry={geometry.balcony} material={material.porcelain} castShadow />
    <mesh geometry={geometry.rails} material={material.edge} />
    <mesh name="lighthouse-glazed-lantern" geometry={geometry.lantern} material={material.glass} />
    <mesh geometry={geometry.frames} material={material.edge} />
    <mesh geometry={geometry.cap} material={material.porcelain} castShadow />
    <mesh geometry={geometry.finial} material={material.edge} />
    <mesh geometry={geometry.door} material={material.navy} />
    <mesh geometry={geometry.windows} material={material.glass} />
    <mesh geometry={geometry.threshold} material={material.porcelain} />
    <mesh name="signal-light-sweep" ref={beam} geometry={geometry.beam} material={beamMaterial} position-y={6} />
  </group>;
}

export function LandmarkModel({ id, ...props }: ModelProps & { id: LandmarkId }) {
  const Architecture = id === 'work' ? ComputeBuilding : id === 'research' ? ResearchInstitute : id === 'purdue' ? CampusHall : id === 'about' ? GardenGallery : id === 'contact' ? ReceptionTerminal : CoastalLighthouse;
  return <group dispose={null}><Architecture {...props} />{id !== 'purdue' && id !== 'about' && <LandmarkMechanisms id={id} {...props} />}</group>;
}
