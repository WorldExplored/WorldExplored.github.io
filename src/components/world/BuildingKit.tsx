'use client';

import { measureConstruction } from './renderDiagnostics';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, MathUtils, MeshPhysicalMaterial, Quaternion, Shape, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type LandmarkId, type QualityTier, type SceneRuntime } from '@/content/world';


export type ModelProps = { active: boolean; runtime: MutableRefObject<SceneRuntime>; paused: boolean; quality: QualityTier };
export type Surface = (u: number, v: number) => Vector3;
export const TAU = Math.PI * 2;

export function combine(parts: BufferGeometry[]) {
  const sources = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(sources);
  new Set([...parts, ...sources]).forEach(part => part.dispose());
  if (!geometry) throw new Error('Architectural geometry could not be combined.');
  return geometry;
}

const resourceTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();

export function useResources<T extends Record<string, BufferGeometry>>(create: () => T): T {
  // Architecture retains the same GPU resources through adaptive-quality changes.
  const [resources] = useState(() => measureConstruction('landmark', create));
  useEffect(() => { clearTimeout(resourceTimers.get(resources)); return () => { resourceTimers.set(resources, setTimeout(() => Object.values(resources).forEach(geometry => geometry.dispose()), 0)); }; }, [resources]);
  return resources;
}

export function roundedBox(width: number, height: number, depth: number, corner = 0.08) {
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

export function platform(shape: Shape, top = 0.99, depth = 0.16) {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.03, curveSegments: 24 }).rotateX(Math.PI / 2).translate(0, top, 0);
}

export function gardenPlan(width: number, depth: number) {
  const shape = new Shape();
  shape.moveTo(-width * 0.48, -depth * 0.24);
  shape.bezierCurveTo(-width * 0.5, -depth * 0.54, width * 0.13, -depth * 0.5, width * 0.4, -depth * 0.35);
  shape.bezierCurveTo(width * 0.58, -depth * 0.2, width * 0.48, depth * 0.36, width * 0.24, depth * 0.43);
  shape.bezierCurveTo(-width * 0.04, depth * 0.57, -width * 0.54, depth * 0.4, -width * 0.48, -depth * 0.24);
  return shape;
}

export function surface(point: Surface, columns = 48, rows = 12, thickness = 0) {
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

export function stroke(point: (t: number) => Vector3, radius = 0.035, segments = 48) {
  const curve = new CatmullRomCurve3(Array.from({ length: 25 }, (_, index) => point(index / 24)));
  return new TubeGeometry(curve, segments, radius, 8, false);
}

export function strut(bottom: Vector3, top: Vector3, radius = 0.055) {
  const axis = top.clone().sub(bottom);
  return new BoxGeometry(radius * 1.4, axis.length(), radius * 1.4).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize())).translate((bottom.x + top.x) / 2, (bottom.y + top.y) / 2, (bottom.z + top.z) / 2);
}

export function roofEdges(roof: Surface, radius = 0.035) {
  return combine([stroke(u => roof(u, 0), radius), stroke(u => roof(u, 1), radius), stroke(v => roof(0, v), radius, 24), stroke(v => roof(1, v), radius, 24)]);
}

export function glazing(roof: Surface, edge: number, start = 0, end = 1, bottom = 1.06) {
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

export function mullions(roof: Surface, edge: number, start = 0, end = 1, divisions = 8, bottom = 1.06) {
  return combine(Array.from({ length: divisions + 1 }, (_, index) => {
    const top = roof(start + index / divisions * (end - start), edge);
    top.y -= 0.16;
    return strut(new Vector3(top.x, bottom, top.z), top, 0.029);
  }));
}

export function curvedWall(roof: Surface, edge: number, start: number, end: number, top: number) {
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

export function usePalette({ active, paused, runtime }: ModelProps, id: LandmarkId) {
  const [materials] = useState(() => ({
    porcelain: new MeshPhysicalMaterial({ name: 'painted-ceramic-shell', color: world.colors.porcelain, emissive: '#d7f8ff', emissiveIntensity: 0, roughness: .42, metalness: .015, clearcoat: .2, clearcoatRoughness: .28, envMapIntensity: .68, side: DoubleSide }),
    edge: new MeshPhysicalMaterial({ name: 'satin-aluminum-trim', color: '#a8babc', roughness: .43, metalness: .65, clearcoat: .08, envMapIntensity: .7 }),
    glass: new MeshPhysicalMaterial({ name: 'clear-aqua-glazing', color: '#b5e7e8', emissive: world.colors.cyan, emissiveIntensity: 0, roughness: .055, metalness: 0, clearcoat: .45, clearcoatRoughness: .08, envMapIntensity: .7, transparent: true, opacity: .18, depthWrite: false, side: DoubleSide, thickness: .07, ior: 1.46 }),
    facade: new MeshPhysicalMaterial({ name: 'architectural-window-glass', color: '#b4e3e5', roughness: .08, metalness: 0, clearcoat: .35, envMapIntensity: .65, transparent: true, opacity: .19, depthWrite: false, side: DoubleSide, thickness: .055, ior: 1.46 }),
    windowBacking: new MeshPhysicalMaterial({ name: 'service-window-glass', color: '#9ecfd3', roughness: .15, metalness: 0, clearcoat: .2, envMapIntensity: .55, transparent: true, opacity: .24, depthWrite: false, side: DoubleSide }),
    cyan: new MeshPhysicalMaterial({ name: 'molded-aqua-shell', color: world.colors.cyan, emissive: world.colors.cyan, emissiveIntensity: 0, roughness: .23, metalness: .02, clearcoat: .62, clearcoatRoughness: .16 }),
    green: new MeshPhysicalMaterial({ name: 'matte-roof-planting', color: '#429a08', roughness: .88, metalness: 0, clearcoat: 0, envMapIntensity: .12 }),
    paving: new MeshPhysicalMaterial({ name: 'limestone-foundation', color: '#c9c8b6', roughness: .9, metalness: 0, clearcoat: 0, envMapIntensity: .15 }),
    navy: new MeshPhysicalMaterial({ name: 'painted-navy-metal', color: '#123a4a', roughness: .48, metalness: .25, clearcoat: .1, envMapIntensity: .5 }),
    black: new MeshPhysicalMaterial({ name: 'dark-composite', color: '#202523', roughness: .72, metalness: .03, clearcoat: 0 }),
    gold: new MeshPhysicalMaterial({ name: 'brushed-brass', color: '#b99a4c', roughness: .43, metalness: .72, clearcoat: .08, envMapIntensity: .65 }),
  }));
  const animated = useRef<typeof materials | null>(null);
  useEffect(() => {
    clearTimeout(resourceTimers.get(materials));
    animated.current = materials;
    return () => {
      animated.current = null;
      resourceTimers.set(materials, setTimeout(() => Object.values(materials).forEach(material => material.dispose()), 0));
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
