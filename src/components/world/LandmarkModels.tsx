'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, MathUtils, Mesh, MeshPhysicalMaterial, Quaternion, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type LandmarkId, type QualityTier, type SceneRuntime } from '@/content/world';
import { LandmarkMechanisms } from './LandmarkMechanisms';

type ModelProps = { active: boolean; runtime: MutableRefObject<SceneRuntime>; paused: boolean; quality: QualityTier };
type Surface = (u: number, v: number) => Vector3;
const TAU = Math.PI * 2;

function combine(parts: BufferGeometry[]) {
  const sources = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(sources);
  new Set([...parts, ...sources]).forEach(part => part.dispose());
  if (!geometry) throw new Error('Architectural geometry could not be combined.');
  return geometry;
}

function useResources<T extends Record<string, BufferGeometry>>(create: () => T): T {
  // Architecture retains the same GPU resources through adaptive-quality changes.
  const [resources] = useState(create);
  useEffect(() => () => Object.values(resources).forEach(geometry => geometry.dispose()), [resources]);
  return resources;
}

function roundedBox(width: number, height: number, depth: number, corner = 0.08) {
  const radius = Math.min(corner, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.02, bevelThickness: 0.02, curveSegments: 8 }).translate(0, 0, -depth / 2);
}

function platform(shape: Shape, top = 0.99, depth = 0.16) {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.03, curveSegments: 24 }).rotateX(Math.PI / 2).translate(0, top, 0);
}

function gardenPlan(width: number, depth: number) {
  const shape = new Shape();
  shape.moveTo(-width * 0.48, -depth * 0.24);
  shape.bezierCurveTo(-width * 0.5, -depth * 0.54, width * 0.13, -depth * 0.5, width * 0.4, -depth * 0.35);
  shape.bezierCurveTo(width * 0.58, -depth * 0.2, width * 0.48, depth * 0.36, width * 0.24, depth * 0.43);
  shape.bezierCurveTo(-width * 0.04, depth * 0.57, -width * 0.54, depth * 0.4, -width * 0.48, -depth * 0.24);
  return shape;
}

function surface(point: Surface, columns = 48, rows = 12, thickness = 0) {
  const positions: number[] = [];
  const indices: number[] = [];
  const count = (columns + 1) * (rows + 1);
  for (let layer = 0; layer < (thickness ? 2 : 1); layer++) {
    for (let u = 0; u <= columns; u++) {
      for (let v = 0; v <= rows; v++) {
        const p = point(u / columns, v / rows);
        positions.push(p.x, p.y - layer * thickness, p.z);
      }
    }
  }
  for (let u = 0; u < columns; u++) {
    for (let v = 0; v < rows; v++) {
      const a = u * (rows + 1) + v;
      const b = a + rows + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
      if (thickness) indices.push(a + count, b + count, a + 1 + count, b + count, b + 1 + count, a + 1 + count);
    }
  }
  if (thickness) {
    const edge = (a: number, b: number) => indices.push(a, b, a + count, b, b + count, a + count);
    for (let u = 0; u < columns; u++) {
      edge(u * (rows + 1), (u + 1) * (rows + 1));
      edge((u + 1) * (rows + 1) + rows, u * (rows + 1) + rows);
    }
    for (let v = 0; v < rows; v++) {
      edge(v + 1, v);
      edge(columns * (rows + 1) + v, columns * (rows + 1) + v + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stroke(point: (t: number) => Vector3, radius = 0.035, segments = 48) {
  const curve = new CatmullRomCurve3(Array.from({ length: 25 }, (_, index) => point(index / 24)));
  return new TubeGeometry(curve, segments, radius, 8, false);
}

function strut(bottom: Vector3, top: Vector3, radius = 0.055) {
  const axis = top.clone().sub(bottom);
  return new BoxGeometry(radius * 1.4, axis.length(), radius * 1.4).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize())).translate((bottom.x + top.x) / 2, (bottom.y + top.y) / 2, (bottom.z + top.z) / 2);
}

function roofEdges(roof: Surface, radius = 0.035) {
  return combine([stroke(u => roof(u, 0), radius), stroke(u => roof(u, 1), radius), stroke(v => roof(0, v), radius, 24), stroke(v => roof(1, v), radius, 24)]);
}

function glazing(roof: Surface, edge: number, start = 0, end = 1, bottom = 1.06) {
  return surface((u, v) => {
    const t = start + u * (end - start);
    const top = roof(t, edge);
    const inward = roof(t, 0.5).sub(top);
    inward.y = 0;
    top.add(inward.normalize().multiplyScalar(0.075));
    // Panes clear both the frame cylinders and the underside of the roof shell.
    return new Vector3(top.x, bottom + v * (top.y - 0.255 - bottom), top.z);
  }, 48, 1);
}

function mullions(roof: Surface, edge: number, start = 0, end = 1, divisions = 8, bottom = 1.06) {
  return combine(Array.from({ length: divisions + 1 }, (_, index) => {
    const top = roof(start + index / divisions * (end - start), edge);
    top.y -= 0.16;
    return strut(new Vector3(top.x, bottom, top.z), top, 0.029);
  }));
}

function curvedWall(roof: Surface, edge: number, start: number, end: number, top: number) {
  const outer: Vector3[] = [];
  const inner: Vector3[] = [];
  for (let index = 0; index <= 48; index++) {
    const u = start + index / 48 * (end - start);
    const point = roof(u, edge);
    const tangent = roof(Math.min(1, u + 0.001), edge).sub(roof(Math.max(0, u - 0.001), edge));
    const normal = new Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(0.075);
    outer.push(point.clone().add(normal));
    inner.push(point.clone().sub(normal));
  }
  const outline = new Shape();
  outline.moveTo(outer[0].x, outer[0].z);
  [...outer.slice(1), ...inner.reverse()].forEach(point => outline.lineTo(point.x, point.z));
  outline.closePath();
  return platform(outline, top, top - 1.07);
}

function usePalette({ active, paused, runtime }: ModelProps, id: LandmarkId) {
  const [materials] = useState(() => ({
    porcelain: new MeshPhysicalMaterial({ color: world.colors.porcelain, emissive: '#d7f8ff', emissiveIntensity: 0, roughness: 0.18, metalness: 0.015, clearcoat: 1, clearcoatRoughness: 0.065, envMapIntensity: 1.25, side: DoubleSide }),
    edge: new MeshPhysicalMaterial({ name: 'architectural-trim', color: '#e4fbff', roughness: 0.32, metalness: 0.015, clearcoat: 0.9, clearcoatRoughness: 0.3, envMapIntensity: 1.15 }),
    glass: new MeshPhysicalMaterial({ color: world.colors.glass, emissive: world.colors.cyan, emissiveIntensity: 0, roughness: 0.045, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 1.5, transparent: true, opacity: 0.38, depthWrite: false, side: DoubleSide }),
    facade: new MeshPhysicalMaterial({ color: '#47b9c9', roughness: 0.2, metalness: 0.025, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1, side: DoubleSide }),
    windowBacking: new MeshPhysicalMaterial({ color: '#309dad', roughness: 0.13, metalness: 0.025, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, side: DoubleSide }),
    cyan: new MeshPhysicalMaterial({ color: world.colors.cyan, emissive: world.colors.cyan, emissiveIntensity: 0, roughness: 0.15, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.06 }),
    green: new MeshPhysicalMaterial({ color: '#429a08', roughness: 0.72, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45 }),
    paving: new MeshPhysicalMaterial({ color: '#dcebd9', roughness: 0.48, metalness: 0, clearcoat: 0.3 }),
    navy: new MeshPhysicalMaterial({ color: '#123a4a', roughness: 0.25, metalness: 0.035, clearcoat: 0.85, envMapIntensity: 1.1 }),
    black: new MeshPhysicalMaterial({ color: '#202523', roughness: 0.27, metalness: 0.015, clearcoat: 0.85 }),
    gold: new MeshPhysicalMaterial({ color: '#ddb858', roughness: 0.24, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.09 }),
  }));
  const animated = useRef<typeof materials | null>(null);
  useEffect(() => {
    animated.current = materials;
    return () => {
      animated.current = null;
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [materials]);
  useFrame((_, delta) => {
    if (paused || !animated.current) return;
    const highlighted = (active || runtime.current.hovered === id) && (id !== 'building' || world.lighting.lampEnabled);
    const palette = animated.current;
    if (id === 'building' && !world.lighting.lampEnabled) {
      palette.cyan.emissiveIntensity = 0;
      palette.glass.emissiveIntensity = 0;
      palette.porcelain.emissiveIntensity = 0;
      return;
    }
    palette.cyan.emissiveIntensity = MathUtils.damp(palette.cyan.emissiveIntensity, highlighted ? world.lighting.windowIllumination + 0.2 : 0, 16, delta);
    palette.glass.emissiveIntensity = MathUtils.damp(palette.glass.emissiveIntensity, highlighted ? 0.055 : 0, 16, delta);
    palette.porcelain.emissiveIntensity = MathUtils.damp(palette.porcelain.emissiveIntensity, highlighted ? 0.035 : 0, 16, delta);
  });
  return materials;
}

function CivicPavilion(props: ModelProps) {
  const material = usePalette(props, 'work');
  const geometry = useResources(() => {
    const west: Surface = (u, v) => new Vector3(-4.5 + 3.5 * u, 3.65 + 1.48 * Math.sin(Math.PI * 0.92 * u) + 0.28 * (0.5 - v), -0.3 + 0.35 * Math.sin(Math.PI * u) + (v - 0.5) * (3.1 + 1.45 * Math.sin(Math.PI * u)));
    const east: Surface = (u, v) => new Vector3(0.85 + 3.65 * u, 3.25 + 0.78 * Math.sin(Math.PI * u) + 0.2 * (1 - v) + 0.25 * u, 0.25 + (v - 0.5) * (2.9 + 0.85 * Math.sin(Math.PI * u)));
    const atrium: Surface = (u, v) => new Vector3(-1.15 + 2.3 * u, 3.65 + 0.72 * Math.sin(Math.PI * u) + 0.13 * (1 - v), -1.7 + 3.45 * v);
    const roofGarden: Surface = (u, v) => west(0.12 + u * 0.72, 0.18 + v * 0.61).add(new Vector3(0, 0.028, 0));
    const threshold = roundedBox(2.12, 0.12, 1.05, 0.06).translate(0, 0.93, 2.7);
    const rail = (u: number, v: number) => {
      const p = roofGarden(u, 0);
      p.y += v * 0.28;
      return p;
    };
    return {
      foundation: combine([platform(gardenPlan(9.65, 5.85)), threshold]),
      floor: platform(gardenPlan(8.85, 5.2), 1.052, 0.045),
      shells: combine([surface(west, 56, 20, 0.19), surface(east, 56, 20, 0.18)]),
      edges: roofEdges(atrium, 0.035),
      garden: surface(roofGarden, 42, 14, 0.03),
      parapet: surface((u, v) => rail(u, 0.05 + v * 0.79), 36, 1),
      parapetEdge: stroke(u => rail(u, 1), 0.026),
      atrium: combine([surface((u, v) => atrium(0.035 + u * 0.93, 0.03 + v * 0.94), 36, 20), glazing(atrium, 0), glazing(atrium, 1, 0, 0.2, 2.035), glazing(atrium, 1, 0.8, 1, 1.955)]),
      windows: combine([glazing(west, 0, 0.065, 0.98, 2.035), glazing(west, 1, 0.065, 0.96, 2.035), glazing(east, 0, 0.02, 0.94, 1.955), glazing(east, 1, 0.08, 0.94, 1.955)]),
      windowBacking: combine([glazing(west, 0, 0.075, 0.97, 2.06).translate(0, 0, 0.14), glazing(east, 0, 0.03, 0.93, 1.98).translate(0, 0, 0.14)]),
      walls: combine([curvedWall(west, 0, 0, 1, 1.91), curvedWall(west, 1, 0.02, 0.98, 1.91), curvedWall(u => west(0.01, u), 0, 0, 1, 2.58), curvedWall(east, 0, 0, 1, 1.83), curvedWall(east, 1, 0.02, 0.98, 1.83), curvedWall(u => east(0.99, u), 0, 0, 1, 2.38)]),
      sills: combine([stroke(u => { const p = west(u, 1); p.y = 1.97; return p; }, 0.045), stroke(u => { const p = east(u, 1); p.y = 1.89; return p; }, 0.045)]),
      frames: combine([mullions(west, 0, 0, 1, 8, 1.92), mullions(west, 1, 0.04, 0.96, 8, 1.92), mullions(east, 0, 0, 1, 8, 1.84), mullions(east, 1, 0.08, 0.94, 8, 1.84), mullions(atrium, 0, 0, 1, 4)]),
      entrance: combine([strut(new Vector3(-0.69, 1.04, 1.77), new Vector3(-0.69, 3.17, 1.77), 0.055), strut(new Vector3(0.69, 1.04, 1.77), new Vector3(0.69, 3.17, 1.77), 0.055), roundedBox(1.48, 0.095, 0.12, 0.04).translate(0, 3.17, 1.77)]),
      entryLight: roundedBox(1.24, 0.025, 0.025, 0.012).translate(0, 3.105, 1.845),
      interior: combine([roundedBox(2.45, 0.58, 0.5, 0.07).translate(-2.57, 1.36, -0.75), roundedBox(1.74, 0.11, 0.62, 0.045).translate(2.4, 1.55, 0.25), strut(new Vector3(1.83, 1.04, 0.25), new Vector3(1.83, 1.52, 0.25), 0.06), strut(new Vector3(2.98, 1.04, 0.25), new Vector3(2.98, 1.52, 0.25), 0.06)]),
      interiorTrim: roundedBox(2.25, 0.035, 0.025, 0.014).translate(-2.57, 1.5, -0.475),
    };
  });
  return <group dispose={null}>
    <mesh name="work-foundation" geometry={geometry.foundation} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.floor} material={material.paving} receiveShadow />
    <mesh name="work-shell-wings" geometry={geometry.shells} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.edges} material={material.edge} />
    <mesh name="work-roof-garden" geometry={geometry.garden} material={material.green} receiveShadow />
    <mesh geometry={geometry.parapet} material={material.glass} />
    <mesh geometry={geometry.parapetEdge} material={material.edge} />
    <mesh name="work-atrium-glazing" geometry={geometry.atrium} material={material.glass} />
    <mesh geometry={geometry.windows} material={material.facade} />
    <mesh geometry={geometry.windowBacking} material={material.windowBacking} />
    <mesh name="work-curved-enclosure" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.sills} material={material.navy} />
    <mesh name="work-window-frames" geometry={geometry.frames} material={material.edge} />
    <mesh name="work-open-entrance" geometry={geometry.entrance} material={material.porcelain} />
    <mesh geometry={geometry.entryLight} material={material.cyan} />
    <mesh geometry={geometry.interior} material={material.porcelain} castShadow />
    <mesh geometry={geometry.interiorTrim} material={material.cyan} />
  </group>;
}

function ReadingConservatory(props: ModelProps) {
  const material = usePalette(props, 'research');
  const geometry = useResources(() => {
    const roof: Surface = (u, v) => new Vector3(-3.05 + 6.05 * u, 2.95 + 0.83 * Math.sin(Math.PI * u) + 0.52 * u + 0.2 * (1 - v), -0.28 + (v - 0.5) * (2.6 + 0.75 * Math.sin(Math.PI * u)));
    const clerestory: Surface = (u, v) => {
      const p = roof(0.05 + u * 0.9, 0.88);
      p.y -= 0.18 + (1 - v) * 0.57;
      return p;
    };
    const sill = (u: number) => clerestory(u, 0);
    const bench = (u: number) => new Vector3(-2.18 + 3.8 * u, 1.42, -0.6 - 0.26 * Math.sin(Math.PI * u));
    return {
      foundation: platform(gardenPlan(6.55, 4.5)),
      terrace: platform(gardenPlan(5.98, 3.9), 1.054, 0.042),
      roof: surface(roof, 56, 20, 0.16),
      glass: combine([glazing(roof, 0, 0.065, 0.96, 2.08), surface(clerestory, 48, 1).translate(0, 0, -0.09)]),
      walls: combine([curvedWall(roof, 0, 0.02, 0.98, 1.98), curvedWall(u => roof(0.02, u), 0, 0, 0.9, 2.32), curvedWall(roof, 1, 0.03, 0.27, 1.58)]),
      windowBacking: combine([glazing(roof, 0, 0.075, 0.95, 2.1).translate(0, 0, 0.14), surface(clerestory, 48, 1).translate(0, 0, -0.14)]),
      frames: combine([mullions(roof, 0, 0.03, 0.96, 9, 1.99), ...[0.03, 0.47, 0.96].map(u => {
        const p = roof(u, 0.88);
        p.y -= 0.14;
        return strut(new Vector3(p.x + 0.08, 1.04, p.z - 0.18), p, 0.065);
      })]),
      sillFrame: stroke(sill, 0.043),
      counter: surface((u, v) => bench(u).add(new Vector3(0, 0, (v - 0.5) * 0.58)), 40, 4, 0.11),
      furniture: combine([...[0.1, 0.9].map(u => {
        const p = bench(u);
        return strut(new Vector3(p.x, 1.04, p.z), p, 0.075);
      }), roundedBox(1.28, 0.11, 0.5, 0.05).translate(1.34, 1.29, 1.04), roundedBox(0.09, 0.21, 0.4, 0.04).translate(0.84, 1.11, 1.04), roundedBox(0.09, 0.21, 0.4, 0.04).translate(1.84, 1.11, 1.04)]),
      light: stroke(u => sill(u).add(new Vector3(0, -0.035, 0.032)), 0.018),
      threshold: roundedBox(1.75, 0.08, 0.49, 0.04).translate(-0.5, 0.96, 1.95),
    };
  });
  return <group dispose={null}>
    <mesh geometry={geometry.foundation} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.terrace} material={material.paving} receiveShadow />
    <mesh name="research-curved-roof" geometry={geometry.roof} material={material.porcelain} castShadow />
    <mesh name="research-clerestory" geometry={geometry.glass} material={material.glass} />
    <mesh name="research-curved-enclosure" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.windowBacking} material={material.windowBacking} />
    <mesh name="research-window-frames" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh geometry={geometry.sillFrame} material={material.edge} />
    <mesh geometry={geometry.counter} material={material.navy} />
    <mesh name="research-open-terrace" geometry={geometry.furniture} material={material.porcelain} castShadow />
    <mesh geometry={geometry.light} material={material.cyan} />
    <mesh geometry={geometry.threshold} material={material.porcelain} />
  </group>;
}

function CampusGate(props: ModelProps) {
  const material = usePalette(props, 'purdue');
  const geometry = useResources(() => {
    const arch = (u: number) => new Vector3(-1.22 + 2.44 * u, 2.39 + 0.16 * Math.sin(Math.PI * u), -0.14 + 0.15 * Math.sin(Math.PI * u));
    return {
      foundation: platform(gardenPlan(3.04, 1.65)),
      piers: combine([-1.18, 1.18].map(x => roundedBox(0.2, 1.4, 0.29, 0.08).translate(x, 1.7, -0.1))),
      canopy: surface((u, v) => arch(u).add(new Vector3(0, 0, (v - 0.5) * 0.45)), 40, 6, 0.1),
      gold: combine([stroke(u => arch(u).add(new Vector3(0, 0.015, 0.235)), 0.019), ...[-1.18, 1.18].map(x => roundedBox(0.115, 0.63, 0.015, 0.02).translate(x, 1.73, 0.063))]),
      garden: combine([-1.19, 1.19].map(x => platform(gardenPlan(0.53, 1.02), 1.075, 0.04).translate(x, 0, 0.2))),
      trim: roundedBox(0.65, 0.025, 0.025, 0.012).translate(0, 2.424, 0.14),
    };
  });
  return <group dispose={null}>
    <mesh geometry={geometry.foundation} material={material.paving} receiveShadow />
    <mesh name="purdue-garden-gate" geometry={geometry.piers} material={material.black} castShadow />
    <mesh geometry={geometry.canopy} material={material.black} castShadow />
    <mesh geometry={geometry.gold} material={material.gold} />
    <mesh geometry={geometry.garden} material={material.green} />
    <mesh geometry={geometry.trim} material={material.cyan} />
  </group>;
}

function SculptureGarden(props: ModelProps) {
  const material = usePalette(props, 'about');
  const geometry = useResources(() => {
    const roof: Surface = (u, v) => {
      const angle = Math.PI * (0.02 + 0.96 * u);
      return new Vector3(Math.cos(angle) * (1.91 + v * 0.77), 3.38 + 0.38 * Math.sin(angle) + 0.1 * v, -Math.sin(angle) * (1.72 + v * 0.72));
    };
    const seat: Surface = (u, v) => {
      const angle = Math.PI * (0.09 + 0.82 * u);
      return new Vector3(Math.cos(angle) * (1.81 + v * 0.4), 1.33, -Math.sin(angle) * (1.55 + v * 0.4));
    };
    return {
      foundation: platform(gardenPlan(5.85, 5.2)),
      canopy: surface(roof, 56, 12, 0.16),
      columns: combine([0.025, 0.5, 0.975].map(u => {
        const p = roof(u, 0.58);
        p.y -= 0.12;
        return strut(new Vector3(p.x * 0.93, 1.02, p.z * 0.93), p, 0.08);
      })),
      bench: surface(seat, 48, 5, 0.12),
      benchLegs: combine([0.12, 0.5, 0.88].map(u => {
        const p = seat(u, 0.5);
        return strut(new Vector3(p.x, 1.02, p.z), p, 0.085);
      })),
      pedestal: platform(gardenPlan(1.1, 1.03), 1.45, 0.4),
      light: stroke(u => roof(u, 0.1).add(new Vector3(0, -0.12, 0)), 0.016),
    };
  });
  return <group dispose={null}>
    <mesh geometry={geometry.foundation} material={material.paving} receiveShadow />
    <mesh name="about-garden-canopy" geometry={geometry.canopy} material={material.porcelain} castShadow />
    <mesh geometry={geometry.columns} material={material.edge} castShadow />
    <mesh geometry={geometry.bench} material={material.porcelain} castShadow />
    <mesh geometry={geometry.benchLegs} material={material.navy} />
    <mesh geometry={geometry.pedestal} material={material.porcelain} />
    <mesh geometry={geometry.light} material={material.cyan} />
  </group>;
}

function ReceptionPavilion(props: ModelProps) {
  const material = usePalette(props, 'contact');
  const geometry = useResources(() => {
    const roof: Surface = (u, v) => new Vector3(-2.45 + 4.83 * u, 3.08 + 0.38 * Math.sin(Math.PI * u) + 0.29 * (1 - u) + 0.16 * (1 - v), (v - 0.5) * (2.58 + 0.65 * Math.sin(Math.PI * u)) - 0.12);
    const leftGlass: Surface = (u, v) => {
      const p = roof(0.04, u * 0.76);
      p.x += 0.075;
      p.y = 1.07 + v * (p.y - 1.325);
      return p;
    };
    const counter: Surface = (u, v) => new Vector3(-1.41 + 2.26 * u, 1.74, -0.34 + Math.sin(Math.PI * u) * 0.32 + (v - 0.5) * 0.6);
    return {
      foundation: platform(gardenPlan(5.6, 4.28)),
      floor: platform(gardenPlan(5.05, 3.72), 1.048, 0.038),
      canopy: surface(roof, 52, 18, 0.17),
      glass: combine([glazing(roof, 0, 0.04, 0.96), surface(leftGlass, 36, 1)]),
      frames: combine([mullions(roof, 0, 0.04, 0.96, 7), ...[0.06, 0.91].map(u => {
        const p = roof(u, 0.88);
        p.y -= 0.13;
        return strut(new Vector3(p.x * 0.9, 1.04, p.z - 0.16), p, 0.065);
      })]),
      counter: surface(counter, 36, 5, 0.55),
      counterEdge: stroke(u => counter(u, 1).add(new Vector3(0, -0.13, 0.016)), 0.018),
      threshold: roundedBox(1.64, 0.08, 0.54, 0.035).translate(0.55, 0.96, 1.8),
      light: stroke(u => roof(0.12 + 0.76 * u, 0.92).add(new Vector3(0, -0.125, 0)), 0.018),
    };
  });
  return <group dispose={null}>
    <mesh geometry={geometry.foundation} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.floor} material={material.paving} receiveShadow />
    <mesh name="contact-reception-canopy" geometry={geometry.canopy} material={material.porcelain} castShadow />
    <mesh geometry={geometry.glass} material={material.glass} />
    <mesh geometry={geometry.frames} material={material.edge} castShadow />
    <mesh geometry={geometry.counter} material={material.porcelain} castShadow />
    <mesh geometry={geometry.counterEdge} material={material.cyan} />
    <mesh name="contact-open-entrance" geometry={geometry.threshold} material={material.porcelain} />
    <mesh geometry={geometry.light} material={material.cyan} />
  </group>;
}

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
  const Architecture = id === 'work' ? CivicPavilion : id === 'research' ? ReadingConservatory : id === 'purdue' ? CampusGate : id === 'about' ? SculptureGarden : id === 'contact' ? ReceptionPavilion : CoastalLighthouse;
  return <group dispose={null}><Architecture {...props} /><LandmarkMechanisms id={id} {...props} /></group>;
}
