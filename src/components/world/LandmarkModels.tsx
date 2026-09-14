'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, MathUtils, Mesh, MeshPhysicalMaterial, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world, type LandmarkId, type QualityTier, type SceneRuntime } from '@/content/world';

type ModelProps = {
  active: boolean;
  runtime: MutableRefObject<SceneRuntime>;
  paused: boolean;
  quality: QualityTier;
};

const TAU = Math.PI * 2;
const LIME = world.landmarks[0].color;

function combine(parts: BufferGeometry[]) {
  const mixedIndices = parts.some(part => Boolean(part.index) !== Boolean(parts[0].index));
  const sources = mixedIndices ? parts.map(part => part.index ? part.toNonIndexed() : part) : parts;
  const geometry = mergeGeometries(sources);
  new Set([...parts, ...sources]).forEach(part => part.dispose());
  if (!geometry) throw new Error('Landmark geometry could not be combined.');
  return geometry;
}

function roundedBox(width: number, height: number, depth: number, radius = 0.08) {
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
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 6 }).translate(0, 0, -depth / 2);
}

function cylinder(radius: number, height: number, y: number, segments: number) {
  return new CylinderGeometry(radius, radius, height, segments).translate(0, y, 0);
}

function useResources<T extends Record<string, BufferGeometry>>(create: () => T, quality: QualityTier): T {
  // Quality changes replace the entire owned geometry set in one transaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resources = useMemo(create, [quality]);
  useEffect(() => () => Object.values(resources).forEach(geometry => geometry.dispose()), [resources]);
  return resources;
}

function usePalette({ active, paused, runtime }: ModelProps, id: LandmarkId) {
  const materials = useMemo(() => ({
    porcelain: new MeshPhysicalMaterial({ color: world.colors.porcelain, roughness: 0.18, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15 }),
    silver: new MeshPhysicalMaterial({ color: '#d5edff', roughness: 0.12, metalness: 0.78, clearcoat: 1, envMapIntensity: 1.4 }),
    gold: new MeshPhysicalMaterial({ color: world.colors.gold, roughness: 0.23, metalness: 0.52, clearcoat: 1, envMapIntensity: 1.2 }),
    glass: new MeshPhysicalMaterial({ color: world.colors.glass, roughness: 0.055, metalness: 0.22, clearcoat: 1, envMapIntensity: 1.45, transparent: true, opacity: 0.29, depthWrite: false, side: DoubleSide }),
    cyan: new MeshPhysicalMaterial({ color: world.colors.cyan, emissive: world.colors.cyan, emissiveIntensity: id === 'building' ? world.lighting.lampEnabled ? world.lighting.lampIntensity * 0.35 : 0 : world.lighting.windowIllumination, roughness: 0.13, metalness: 0.18, clearcoat: 1, envMapIntensity: 1.25 }),
    lime: new MeshPhysicalMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.09, roughness: 0.21, metalness: 0.18, clearcoat: 1 }),
    ink: new MeshPhysicalMaterial({ color: '#086da9', roughness: 0.2, metalness: 0.32, clearcoat: 1 }),
    blue: new MeshPhysicalMaterial({ color: '#147de5', roughness: 0.14, metalness: 0.28, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.35 }),
  }), [id]);
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
    const palette = animated.current;
    const highlighted = active || runtime.current.hovered === id;
    const illumination = id === 'building' ? world.lighting.lampEnabled ? world.lighting.lampIntensity * 0.35 : 0 : world.lighting.windowIllumination;
    const pulse = id === 'building' && highlighted && world.lighting.lampEnabled ? 0.07 * (1 + Math.sin(runtime.current.elapsed * 3)) : 0;
    const hover = highlighted && (id !== 'building' || world.lighting.lampEnabled) ? 0.22 : 0;
    palette.cyan.emissiveIntensity = MathUtils.damp(palette.cyan.emissiveIntensity, illumination + hover + pulse, 16, delta);
    palette.lime.emissiveIntensity = MathUtils.damp(palette.lime.emissiveIntensity, highlighted ? 0.27 : 0.06, 16, delta);
  });
  return materials;
}

function Observatory(props: ModelProps) {
  const { quality, runtime, paused } = props;
  const segments = world.quality[quality].segments;
  const material = usePalette(props, 'work');
  const pulses = useRef<Group>(null);
  const geometry = useResources(() => {
    const pins: BufferGeometry[] = [];
    for (let index = 0; index < 7; index++) {
      const offset = (index - 3) * 0.235;
      pins.push(new BoxGeometry(0.11, 0.3, 0.14).translate(offset, 0.98, 0));
      pins.push(new BoxGeometry(0.11, 0.3, 0.14).translate(offset, -0.98, 0));
      pins.push(new BoxGeometry(0.3, 0.11, 0.14).translate(1.1, offset, 0));
      pins.push(new BoxGeometry(0.3, 0.11, 0.14).translate(-1.1, offset, 0));
    }
    const ribs: BufferGeometry[] = [];
    for (let index = 0; index < 4; index++) {
      ribs.push(new TorusGeometry(2.84, 0.058, 8, segments, Math.PI).rotateY(index * Math.PI / 4).translate(0, 1.5, 0));
    }
    const serverBodies: BufferGeometry[] = [];
    const serverRows: BufferGeometry[] = [];
    const serverCores: BufferGeometry[] = [];
    for (let index = 0; index < 3; index++) {
      const x = (index - 1) * 1.6;
      const z = index === 1 ? -1.5 : -0.6;
      serverBodies.push(roundedBox(0.48, 1.58, 0.48).translate(x, 2.32, z));
      serverCores.push(roundedBox(0.25, 1.46, 0.23, 0.045).translate(x, 2.32, z));
      for (let row = 0; row < 5; row++) {
        serverRows.push(roundedBox(0.31, 0.055, 0.035, 0.02).translate(x, 1.82 + row * 0.25, z + 0.265));
      }
    }
    return {
      base: combine([cylinder(3.2, 0.26, 1.04, segments), cylinder(3.01, 0.18, 1.28, segments), cylinder(2.9, 0.12, 1.48, segments), roundedBox(2.1, 0.16, 0.8).translate(0, 0.98, 3.05), roundedBox(1.9, 0.16, 0.55).translate(0, 1.14, 2.95)]),
      skirt: cylinder(3.07, 0.07, 1.18, segments),
      dome: new SphereGeometry(2.8, segments, segments / 2, 0, TAU, 0, Math.PI / 2),
      ribs: combine(ribs),
      rim: new TorusGeometry(2.83, 0.085, 8, segments).rotateX(Math.PI / 2),
      orbit: new TorusGeometry(2.14, 0.023, 6, segments),
      board: roundedBox(1.98, 1.72, 0.23, 0.13),
      die: roundedBox(0.91, 0.84, 0.13),
      cells: combine([-0.2, 0.2].flatMap(x => [-0.18, 0.18].map(y => roundedBox(0.32, 0.27, 0.03, 0.025).translate(x, y, 0.105)))),
      pins: combine(pins),
      servers: combine(serverBodies),
      cores: combine(serverCores),
      rows: combine(serverRows),
      antenna: combine([new CylinderGeometry(0.04, 0.075, 0.73, 12).translate(0, 4.77, 0), new SphereGeometry(0.18, 16, 12).translate(0, 5.2, 0)]),
      bead: new SphereGeometry(0.09, 12, 8),
    };
  }, quality);
  useFrame(() => {
    if (paused || !pulses.current) return;
    pulses.current.rotation.z = runtime.current.elapsed * 0.28;
  });
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.skirt} material={material.cyan} />
    <mesh geometry={geometry.rim} material={material.silver} position-y={1.5} />
    <mesh geometry={geometry.servers} material={material.glass} />
    <mesh geometry={geometry.cores} material={material.ink} castShadow />
    <mesh geometry={geometry.rows} material={material.cyan} />
    <group position={[0, 2.66, 0.65]} rotation={[-0.08, 0, 0]}>
      <mesh geometry={geometry.board} material={material.lime} castShadow />
      <mesh geometry={geometry.pins} material={material.silver} />
      <mesh geometry={geometry.die} material={material.ink} position-z={0.19} />
      <mesh geometry={geometry.cells} material={material.cyan} position-z={0.19} />
    </group>
    <mesh geometry={geometry.dome} material={material.glass} position-y={1.5} />
    <mesh geometry={geometry.ribs} material={material.porcelain} castShadow />
    <mesh geometry={geometry.antenna} material={material.silver} />
    <group position={[0, 3.18, 0]} rotation={[0.95, 0.2, 0.13]}>
      <mesh geometry={geometry.orbit} material={material.cyan} />
      <group ref={pulses}>
        <mesh geometry={geometry.bead} material={material.lime} position={[2.14, 0, 0]} />
        <mesh geometry={geometry.bead} material={material.cyan} position={[-1.07, 1.85, 0]} />
        <mesh geometry={geometry.bead} material={material.cyan} position={[-1.07, -1.85, 0]} />
      </group>
    </group>
  </group>;
}

function pageHeight(u: number, z: number) {
  return 1.35 + 1.12 * u * u + 0.11 * Math.sin(Math.PI * u) + 0.1 * z * z * u;
}

function bookPage(side: number, layer: number, divisions: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const depthDivisions = 6;
  for (let x = 0; x <= divisions; x++) {
    const u = x / divisions;
    for (let depth = 0; depth <= depthDivisions; depth++) {
      const z = (depth / depthDivisions - 0.5) * 2.5;
      positions.push(side * (0.055 + u * (2.12 + layer * 0.025)), pageHeight(u, z) - layer * 0.072, z);
    }
  }
  for (let x = 0; x < divisions; x++) {
    for (let z = 0; z < depthDivisions; z++) {
      const a = x * (depthDivisions + 1) + z;
      const b = a + depthDivisions + 1;
      if (side === 1) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ResearchBook(props: ModelProps) {
  const { quality, runtime, paused } = props;
  const segments = world.quality[quality].segments;
  const material = usePalette(props, 'research');
  const pageMaterial = useMemo(() => new MeshPhysicalMaterial({ color: world.colors.porcelain, roughness: 0.27, metalness: 0.1, clearcoat: 0.85, side: DoubleSide }), []);
  useEffect(() => () => pageMaterial.dispose(), [pageMaterial]);
  const pulse = useRef<Mesh>(null);
  const geometry = useResources(() => {
    const pages: BufferGeometry[] = [];
    const lines: BufferGeometry[] = [];
    const edges: BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 4; layer++) {
        pages.push(bookPage(side, layer, segments / 2));
        const edge = new CatmullRomCurve3(Array.from({ length: 13 }, (_, index) => {
          const z = (index / 12 - 0.5) * 2.5;
          return new Vector3(side * (2.175 + layer * 0.025), pageHeight(1, z) - layer * 0.072, z);
        }));
        edges.push(new TubeGeometry(edge, 12, 0.021, 4, false));
      }
      for (let row = 0; row < 8; row++) {
        const z = -0.94 + row * 0.265;
        const curve = new CatmullRomCurve3(Array.from({ length: 13 }, (_, index) => {
          const u = 0.15 + index / 12 * (row === 7 ? 0.48 : 0.71);
          return new Vector3(side * (0.055 + u * 2.12), pageHeight(u, z) + 0.015, z);
        }));
        lines.push(new TubeGeometry(curve, 12, 0.012, 3, false));
      }
    }
    return {
      base: combine([cylinder(2.73, 0.3, 0.39, segments), cylinder(2.51, 0.12, 0.61, segments), cylinder(1.55, 0.2, 0.77, segments), cylinder(0.43, 0.46, 1, segments)]),
      trim: cylinder(2.63, 0.055, 0.51, segments),
      cover: combine([-1, 1].map(side => bookPage(side, 4.5, segments / 2))),
      pages: combine(pages),
      edges: combine(edges),
      lines: combine(lines),
      spine: new CylinderGeometry(0.047, 0.047, 2.56, 12).rotateX(Math.PI / 2).translate(0, 1.37, 0),
      orbit: new TorusGeometry(2.88, 0.024, 6, segments).rotateX(Math.PI / 2),
      bead: new SphereGeometry(0.115, 12, 8),
    };
  }, quality);
  useFrame(() => {
    if (paused || !pulse.current) return;
    const angle = runtime.current.elapsed * 0.22;
    pulse.current.position.set(Math.cos(angle) * 2.88, 1.1 + Math.sin(angle) * 0.47, Math.sin(angle) * 2.84);
  });
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.trim} material={material.cyan} />
    <mesh geometry={geometry.cover} material={material.cyan} />
    <mesh geometry={geometry.pages} material={pageMaterial} castShadow />
    <mesh geometry={geometry.edges} material={material.silver} />
    <mesh geometry={geometry.lines} material={material.ink} />
    <mesh geometry={geometry.spine} material={material.gold} />
    <mesh geometry={geometry.orbit} material={material.cyan} position-y={1.1} rotation-x={-0.16} />
    <mesh geometry={geometry.orbit} material={material.silver} position-y={0.9} rotation-x={0.13} scale={1.045} />
    <mesh ref={pulse} geometry={geometry.bead} material={material.cyan} position={[2.88, 1.1, 0]} />
  </group>;
}

function Pavilion(props: ModelProps) {
  const { quality } = props;
  const segments = world.quality[quality].segments;
  const material = usePalette(props, 'purdue');
  const geometry = useResources(() => {
    const columns: BufferGeometry[] = [];
    const collars: BufferGeometry[] = [];
    for (let index = 0; index < 6; index++) {
      const angle = index * TAU / 6 + Math.PI / 6;
      const x = Math.cos(angle) * 2.12;
      const z = Math.sin(angle) * 2.12;
      columns.push(new CylinderGeometry(0.145, 0.18, 2.65, Math.max(16, segments / 2)).translate(x, 2.93, z));
      columns.push(cylinder(0.29, 0.13, 1.53, 20).translate(x, 0, z));
      columns.push(cylinder(0.23, 0.16, 1.67, 20).translate(x, 0, z));
      columns.push(cylinder(0.27, 0.14, 4.27, 20).translate(x, 0, z));
      collars.push(cylinder(0.19, 0.05, 1.82, 20).translate(x, 0, z));
      collars.push(cylinder(0.175, 0.05, 4.08, 20).translate(x, 0, z));
    }
    return {
      base: combine([cylinder(3.05, 0.22, 1.01, segments), cylinder(2.84, 0.16, 1.2, segments), cylinder(2.57, 0.16, 1.36, segments)]),
      columns: combine(columns),
      collars: combine(collars),
      roof: combine([cylinder(2.76, 0.18, 4.42, segments), cylinder(2.66, 0.11, 4.56, segments)]),
      band: new TorusGeometry(2.73, 0.045, 8, segments).rotateX(Math.PI / 2).translate(0, 4.5, 0),
      floor: new TorusGeometry(2.27, 0.026, 6, segments).rotateX(Math.PI / 2).translate(0, 1.447, 0),
      dome: new SphereGeometry(2.62, segments, segments / 2, 0, TAU, 0, Math.PI / 2).scale(1, 0.26, 1).translate(0, 4.62, 0),
      finial: combine([new CylinderGeometry(0.08, 0.13, 0.29, 16).translate(0, 5.36, 0), new SphereGeometry(0.16, 16, 12).translate(0, 5.56, 0)]),
      ceiling: cylinder(2.51, 0.055, 4.31, segments),
    };
  }, quality);
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.columns} material={material.porcelain} castShadow />
    <mesh geometry={geometry.collars} material={material.gold} />
    <mesh geometry={geometry.roof} material={material.porcelain} castShadow />
    <mesh geometry={geometry.band} material={material.gold} />
    <mesh geometry={geometry.floor} material={material.gold} />
    <mesh geometry={geometry.dome} material={material.gold} castShadow />
    <mesh geometry={geometry.finial} material={material.gold} />
    <mesh geometry={geometry.ceiling} material={material.cyan} />
  </group>;
}

function SignalTower(props: ModelProps) {
  const { quality, runtime, paused } = props;
  const segments = world.quality[quality].segments;
  const material = usePalette(props, 'building');
  const sweep = useRef<Mesh<BufferGeometry, MeshPhysicalMaterial>>(null);
  const sweepMaterial = useMemo(() => new MeshPhysicalMaterial({ color: '#d4ffff', emissive: '#c0ffff', emissiveIntensity: world.lighting.lampIntensity, transparent: true, opacity: 0, roughness: 0.1, depthWrite: false, side: DoubleSide }), []);
  useEffect(() => () => sweepMaterial.dispose(), [sweepMaterial]);
  const geometry = useResources(() => ({
    base: combine([cylinder(1.45, 0.2, 0.92, segments), cylinder(1.21, 0.13, 1.08, segments), cylinder(0.85, 0.16, 1.22, segments)]),
    shaft: new CylinderGeometry(0.3, 0.5, 2.43, Math.max(24, segments / 2)).translate(0, 2.5, 0),
    band: combine([new TorusGeometry(0.4, 0.035, 8, segments).rotateX(Math.PI / 2).translate(0, 2.22, 0), new TorusGeometry(0.59, 0.045, 8, segments).rotateX(Math.PI / 2).translate(0, 3.8, 0)]),
    lens: new SphereGeometry(0.56, segments, segments / 2).translate(0, 4.12, 0),
    core: new SphereGeometry(0.27, 16, 12).translate(0, 4.12, 0),
    crown: combine([new TorusGeometry(0.56, 0.045, 8, segments).rotateX(Math.PI / 2).translate(0, 4.37, 0), cylinder(0.13, 0.25, 4.74, 16), new SphereGeometry(0.1, 12, 8).translate(0, 4.9, 0)]),
    sweep: new CylinderGeometry(0.07, 1.0, 6.3, 24, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 3.15),
  }), quality);
  useFrame((_, delta) => {
    if (paused || !sweep.current) return;
    const selected = props.active || runtime.current.hovered === 'building';
    const opacity = world.lighting.lampEnabled && selected ? 0.024 * (0.7 + Math.sin(runtime.current.elapsed * 3) * 0.3) : 0;
    sweep.current.rotation.y = runtime.current.elapsed * 0.22;
    sweep.current.material.opacity = MathUtils.damp(sweep.current.material.opacity, opacity, 10, delta);
    sweep.current.material.emissiveIntensity = world.lighting.lampEnabled ? world.lighting.lampIntensity : 0;
  });
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.shaft} material={material.porcelain} castShadow />
    <mesh geometry={geometry.band} material={material.cyan} />
    <mesh geometry={geometry.lens} material={material.glass} />
    <mesh geometry={geometry.core} material={material.cyan} />
    <mesh geometry={geometry.crown} material={material.silver} />
    <mesh ref={sweep} geometry={geometry.sweep} material={sweepMaterial} position-y={4.12} />
  </group>;
}

function StudySculpture(props: ModelProps) {
  const segments = world.quality[props.quality].segments;
  const material = usePalette(props, 'about');
  const geometry = useResources(() => ({
    base: combine([cylinder(1.65, 0.2, 1.04, segments), cylinder(1.43, 0.13, 1.2, segments)]),
    trim: new TorusGeometry(1.49, 0.042, 8, segments).rotateX(Math.PI / 2).translate(0, 1.16, 0),
    desk: combine([roundedBox(2.03, 0.19, 1.45, 0.085).translate(0, 1.85, 0), new CylinderGeometry(0.11, 0.15, 0.61, 16).translate(-0.68, 1.56, 0), new CylinderGeometry(0.11, 0.15, 0.61, 16).translate(0.68, 1.56, 0)]),
    support: cylinder(0.39, 0.13, 2.02, segments),
  }), props.quality);
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.trim} material={material.cyan} />
    <mesh geometry={geometry.desk} material={material.porcelain} castShadow />
    <mesh geometry={geometry.support} material={material.blue} />
  </group>;
}

function CorrespondenceKiosk(props: ModelProps) {
  const segments = world.quality[props.quality].segments;
  const material = usePalette(props, 'contact');
  const geometry = useResources(() => {
    const seams = [
      [new Vector3(-0.78, 0.37, 0.15), new Vector3(0, -0.09, 0.15), new Vector3(0.78, 0.37, 0.15)],
      [new Vector3(-0.78, -0.42, 0.15), new Vector3(-0.22, -0.09, 0.15)],
      [new Vector3(0.78, -0.42, 0.15), new Vector3(0.22, -0.09, 0.15)],
    ].map(points => new TubeGeometry(new CatmullRomCurve3(points, false, 'centripetal'), 16, 0.034, 6, false).translate(0, 2.65, 0.29));
    return {
      base: combine([cylinder(1.75, 0.21, 1.04, segments), cylinder(1.5, 0.13, 1.22, segments)]),
      trim: new TorusGeometry(1.59, 0.045, 8, segments).rotateX(Math.PI / 2).translate(0, 1.16, 0),
      frame: combine([roundedBox(2.18, 1.44, 0.3, 0.16).translate(0, 2.65, 0.12), roundedBox(2.5, 0.16, 1.12, 0.075).translate(0, 3.51, -0.09), new CylinderGeometry(0.11, 0.15, 1.5, 16).translate(-0.88, 2.02, -0.13), new CylinderGeometry(0.11, 0.15, 1.5, 16).translate(0.88, 2.02, -0.13)]),
      panel: roundedBox(1.92, 1.19, 0.12, 0.12).translate(0, 2.65, 0.31),
      seams: combine(seams),
      seal: new TorusGeometry(0.12, 0.035, 8, 24).translate(0, 2.58, 0.49),
      light: roundedBox(1.8, 0.045, 0.065, 0.015).translate(0, 3.405, 0.36),
    };
  }, props.quality);
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.trim} material={material.cyan} />
    <mesh geometry={geometry.frame} material={material.porcelain} castShadow />
    <mesh geometry={geometry.panel} material={material.blue} />
    <mesh geometry={geometry.seams} material={material.porcelain} />
    <mesh geometry={geometry.seal} material={material.gold} />
    <mesh geometry={geometry.light} material={material.cyan} />
  </group>;
}

export function LandmarkModel({ id, ...props }: ModelProps & { id: LandmarkId }) {
  if (id === 'work') return <Observatory {...props} />;
  if (id === 'research') return <ResearchBook {...props} />;
  if (id === 'purdue') return <Pavilion {...props} />;
  if (id === 'about') return <StudySculpture {...props} />;
  if (id === 'contact') return <CorrespondenceKiosk {...props} />;
  return <SignalTower {...props} />;
}
