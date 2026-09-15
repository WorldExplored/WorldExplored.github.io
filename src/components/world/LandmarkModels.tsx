'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
const SEGMENTS = 72;

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
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 8 }).translate(0, 0, -depth / 2);
}

function cylinder(radius: number, height: number, y: number, segments: number) {
  return new CylinderGeometry(radius, radius, height, segments).translate(0, y, 0);
}

function useResources<T extends Record<string, BufferGeometry>>(create: () => T): T {
  // Adaptive quality changes raster cost; architectural resources live until unmount.
  const [resources] = useState(create);
  useEffect(() => () => Object.values(resources).forEach(geometry => geometry.dispose()), [resources]);
  return resources;
}

function usePalette({ active, paused, runtime }: ModelProps, id: LandmarkId) {
  const materials = useMemo(() => ({
    porcelain: new MeshPhysicalMaterial({ color: '#f5fcff', roughness: 0.17, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.055, envMapIntensity: 1.25 }),
    edge: new MeshPhysicalMaterial({ color: '#cfedff', roughness: 0.12, metalness: 0.025, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 }),
    gold: new MeshPhysicalMaterial({ color: world.colors.gold, roughness: 0.24, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 }),
    glass: new MeshPhysicalMaterial({ color: '#a3efff', roughness: 0.045, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 1.65, transparent: true, opacity: 0.25, depthWrite: false, side: DoubleSide }),
    cyan: new MeshPhysicalMaterial({ color: world.colors.cyan, emissive: world.colors.cyan, emissiveIntensity: id === 'building' ? world.lighting.lampEnabled ? world.lighting.lampIntensity * 0.35 : 0 : world.lighting.windowIllumination, roughness: 0.13, metalness: 0.035, clearcoat: 1, envMapIntensity: 1.25 }),
    lime: new MeshPhysicalMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.09, roughness: 0.21, metalness: 0.035, clearcoat: 1 }),
    ink: new MeshPhysicalMaterial({ color: '#086da9', roughness: 0.2, metalness: 0.025, clearcoat: 1 }),
    black: new MeshPhysicalMaterial({ color: '#202523', roughness: 0.28, metalness: 0.015, clearcoat: 1, clearcoatRoughness: 0.12 }),
    print: new MeshPhysicalMaterial({ color: '#77a8b8', roughness: 0.24, metalness: 0, clearcoat: 1 }),
    blue: new MeshPhysicalMaterial({ color: '#147de5', roughness: 0.14, metalness: 0.025, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.35 }),
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
  const { runtime, paused } = props;
  const segments = SEGMENTS;
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
      ribs.push(new TorusGeometry(3.24, 0.05, 12, segments, Math.PI).rotateY(index * Math.PI / 4).translate(0, 1.44, 0));
    }
    const serverBodies: BufferGeometry[] = [];
    const serverRows: BufferGeometry[] = [];
    const serverCores: BufferGeometry[] = [];
    const serverFrames: BufferGeometry[] = [];
    const pathways: BufferGeometry[] = [];
    for (let index = 0; index < 3; index++) {
      const x = (index - 1) * 1.75;
      const z = index === 1 ? -1.65 : -0.8;
      serverBodies.push(roundedBox(0.63, 1.9, 0.62, 0.12).translate(x, 2.53, z));
      serverCores.push(roundedBox(0.33, 1.73, 0.3, 0.08).translate(x, 2.53, z));
      for (const level of [1.58, 3.48]) {
        serverFrames.push(roundedBox(0.68, 0.075, 0.67, 0.03).translate(x, level, z));
      }
      for (let row = 0; row < 6; row++) {
        serverRows.push(roundedBox(0.39, 0.045, 0.035, 0.015).translate(x, 1.88 + row * 0.26, z + 0.34));
      }
      const path = new CatmullRomCurve3([new Vector3(x, 1.47, z), new Vector3(x * 0.7, 1.47, 0.4), new Vector3(x * 0.3, 1.47, 2.9)]);
      pathways.push(new TubeGeometry(path, 24, 0.023, 6, false));
    }
    return {
      base: combine([cylinder(3.7, 0.22, 0.98, segments), cylinder(3.48, 0.16, 1.17, segments), cylinder(3.29, 0.16, 1.36, segments), roundedBox(2.2, 0.12, 0.55, 0.05).translate(0, 0.97, 3.65), roundedBox(2, 0.12, 0.45, 0.05).translate(0, 1.12, 3.42)]),
      skirt: cylinder(3.52, 0.055, 1.105, segments),
      dome: new SphereGeometry(3.2, segments, segments / 2, 0, TAU, 0, Math.PI / 2),
      ribs: combine(ribs),
      rim: new TorusGeometry(3.23, 0.075, 12, segments).rotateX(Math.PI / 2),
      orbit: new TorusGeometry(2.3, 0.018, 8, segments),
      floorRing: new TorusGeometry(2.78, 0.025, 8, segments).rotateX(Math.PI / 2).translate(0, 1.465, 0),
      pathways: combine(pathways),
      frames: combine(serverFrames),
      board: roundedBox(1.98, 1.72, 0.23, 0.13),
      die: roundedBox(0.91, 0.84, 0.13),
      cells: combine([-0.2, 0.2].flatMap(x => [-0.18, 0.18].map(y => roundedBox(0.32, 0.27, 0.03, 0.025).translate(x, y, 0.105)))),
      pins: combine(pins),
      servers: combine(serverBodies),
      cores: combine(serverCores),
      rows: combine(serverRows),
      apex: combine([cylinder(0.19, 0.07, 4.71, 24), new SphereGeometry(0.13, 24, 16).translate(0, 4.83, 0)]),
      bead: new SphereGeometry(0.09, 12, 8),
    };
  });
  useFrame(() => {
    if (paused || !pulses.current) return;
    pulses.current.rotation.z = runtime.current.elapsed * 0.28;
  });
  return <group dispose={null} scale={1.2} position-y={-0.16}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.skirt} material={material.cyan} />
    <mesh geometry={geometry.rim} material={material.edge} position-y={1.44} />
    <mesh geometry={geometry.floorRing} material={material.edge} />
    <mesh geometry={geometry.pathways} material={material.cyan} />
    <mesh geometry={geometry.frames} material={material.porcelain} />
    <mesh geometry={geometry.servers} material={material.glass} />
    <mesh geometry={geometry.cores} material={material.ink} castShadow />
    <mesh geometry={geometry.rows} material={material.cyan} />
    <group position={[0, 2.72, 0.7]} rotation={[-0.08, 0, 0]}>
      <mesh geometry={geometry.board} material={material.lime} castShadow />
      <mesh geometry={geometry.pins} material={material.edge} />
      <mesh geometry={geometry.die} material={material.ink} position-z={0.19} />
      <mesh geometry={geometry.cells} material={material.cyan} position-z={0.19} />
    </group>
    <mesh geometry={geometry.dome} material={material.glass} position-y={1.44} />
    <mesh geometry={geometry.ribs} material={material.porcelain} castShadow />
    <mesh geometry={geometry.apex} material={material.edge} />
    <group position={[0, 2.8, 0]} rotation={[0.95, 0.2, 0.13]}>
      <mesh geometry={geometry.orbit} material={material.cyan} />
      <group ref={pulses}>
        <mesh geometry={geometry.bead} material={material.lime} position={[2.3, 0, 0]} />
        <mesh geometry={geometry.bead} material={material.cyan} position={[-1.15, 1.992, 0]} />
        <mesh geometry={geometry.bead} material={material.cyan} position={[-1.15, -1.992, 0]} />
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
  const { runtime, paused } = props;
  const segments = SEGMENTS;
  const material = usePalette(props, 'research');
  const pageMaterial = useMemo(() => new MeshPhysicalMaterial({ color: world.colors.porcelain, roughness: 0.23, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.075, side: DoubleSide }), []);
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
        edges.push(new TubeGeometry(edge, 24, 0.014, 6, false));
      }
      for (let row = 0; row < 8; row++) {
        const z = -0.94 + row * 0.265;
        const curve = new CatmullRomCurve3(Array.from({ length: 13 }, (_, index) => {
          const u = 0.15 + index / 12 * (row === 7 ? 0.48 : 0.71);
          return new Vector3(side * (0.055 + u * 2.12), pageHeight(u, z) + 0.015, z);
        }));
        lines.push(new TubeGeometry(curve, 24, 0.009, 4, false));
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
      orbit: new TorusGeometry(2.7, 0.017, 8, segments).rotateX(Math.PI / 2),
      bead: new SphereGeometry(0.115, 12, 8),
    };
  });
  useFrame(() => {
    if (paused || !pulse.current) return;
    const angle = runtime.current.elapsed * 0.22;
    pulse.current.position.set(Math.cos(angle) * 2.7, 1.1 + Math.sin(angle) * 0.47, Math.sin(angle) * 2.66);
  });
  return <group dispose={null} position-y={0.45}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.trim} material={material.cyan} />
    <mesh geometry={geometry.cover} material={material.cyan} />
    <mesh geometry={geometry.pages} material={pageMaterial} castShadow />
    <mesh geometry={geometry.edges} material={material.edge} />
    <mesh geometry={geometry.lines} material={material.print} />
    <mesh geometry={geometry.spine} material={material.gold} />
    <mesh geometry={geometry.orbit} material={material.cyan} position-y={1.1} rotation-x={-0.16} />
    <mesh geometry={geometry.orbit} material={material.edge} position-y={0.9} rotation-x={0.13} scale={1.045} />
    <mesh ref={pulse} geometry={geometry.bead} material={material.cyan} position={[2.7, 1.1, 0]} />
  </group>;
}

function PurdueMarker(props: ModelProps) {
  const material = usePalette(props, 'purdue');
  const geometry = useResources(() => ({
    footing: roundedBox(2.02, 0.13, 1.02, 0.06).translate(0, 0.92, 0),
    posts: combine([-0.55, 0.55].map(x => new CylinderGeometry(0.055, 0.065, 0.64, 24).translate(x, 1.3, -0.05))),
    sign: roundedBox(1.66, 1.11, 0.16, 0.09).translate(0, 2.02, 0),
    rim: roundedBox(1.71, 1.16, 0.12, 0.11).translate(0, 2.02, -0.045),
    band: roundedBox(1.27, 0.025, 0.025, 0.01).translate(0, 2.31, 0.115),
    direction: combine([
      roundedBox(0.47, 0.032, 0.027, 0.014).translate(-0.08, 1.93, 0.12),
      roundedBox(0.2, 0.032, 0.027, 0.014).rotateZ(Math.PI / 4).translate(0.16, 1.99, 0.12),
      roundedBox(0.2, 0.032, 0.027, 0.014).rotateZ(-Math.PI / 4).translate(0.16, 1.87, 0.12),
    ]),
  }));
  return <group dispose={null}>
    <mesh geometry={geometry.footing} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.posts} material={material.black} castShadow />
    <mesh geometry={geometry.rim} material={material.gold} />
    <mesh geometry={geometry.sign} material={material.black} castShadow />
    <mesh geometry={geometry.band} material={material.gold} />
    <mesh geometry={geometry.direction} material={material.gold} />
  </group>;
}

function SignalTower(props: ModelProps) {
  const { runtime, paused } = props;
  const segments = SEGMENTS;
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
  }));
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
    <mesh geometry={geometry.crown} material={material.edge} />
    <mesh name="signal-light-sweep" ref={sweep} geometry={geometry.sweep} material={sweepMaterial} position-y={4.12} />
  </group>;
}

function StudySculpture(props: ModelProps) {
  const segments = SEGMENTS;
  const material = usePalette(props, 'about');
  const geometry = useResources(() => ({
    base: combine([cylinder(1.65, 0.2, 1.04, segments), cylinder(1.43, 0.13, 1.2, segments)]),
    trim: new TorusGeometry(1.49, 0.042, 8, segments).rotateX(Math.PI / 2).translate(0, 1.16, 0),
    desk: combine([roundedBox(2.03, 0.19, 1.45, 0.085).translate(0, 1.85, 0), new CylinderGeometry(0.11, 0.15, 0.61, 16).translate(-0.68, 1.56, 0), new CylinderGeometry(0.11, 0.15, 0.61, 16).translate(0.68, 1.56, 0)]),
    support: cylinder(0.39, 0.13, 2.02, segments),
  }));
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.trim} material={material.cyan} />
    <mesh geometry={geometry.desk} material={material.porcelain} castShadow />
    <mesh geometry={geometry.support} material={material.blue} />
  </group>;
}

function CorrespondenceKiosk(props: ModelProps) {
  const segments = SEGMENTS;
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
  });
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
  if (id === 'purdue') return <PurdueMarker {...props} />;
  if (id === 'about') return <StudySculpture {...props} />;
  if (id === 'contact') return <CorrespondenceKiosk {...props} />;
  return <SignalTower {...props} />;
}
