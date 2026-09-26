import { Box3, InstancedBufferAttribute, InstancedMesh, Vector3, type BufferGeometry } from 'three';

/** Two shared draws per anatomy. Spatial cells change detail together; roots and colors never move. */
export function createClusteredMarineLOD(near: InstancedMesh, farGeometry: BufferGeometry, cellSize = 12) {
  const capacity = near.count, source = near.instanceMatrix.array.slice(), colors = near.instanceColor?.array.slice();
  const far = new InstancedMesh(farGeometry, near.material, capacity);
  far.name = `${near.name}-distant`; far.raycast = () => {}; far.receiveShadow = near.receiveShadow;
  far.userData.marineLOD = 'far'; near.userData.marineLOD = 'near';
  if (colors) far.instanceColor = new InstancedBufferAttribute(new Float32Array(colors.length), 3);
  near.computeBoundingSphere();
  far.boundingSphere = near.boundingSphere?.clone() ?? null;
  const cells = new Map<string, { bounds: Box3; indices: number[]; close: boolean }>();
  const point = new Vector3();
  for (let i = 0; i < capacity; i++) {
    point.set(source[i*16+12], source[i*16+13], source[i*16+14]);
    const key = `${Math.floor(point.x/cellSize)},${Math.floor(point.z/cellSize)}`;
    let cell = cells.get(key);
    if (!cell) { cell = { bounds: new Box3(), indices: [], close: false }; cells.set(key, cell); }
    cell.bounds.expandByPoint(point); cell.indices.push(i);
  }
  const clusters = [...cells.values()], previous = new Vector3(Infinity, Infinity, Infinity);
  let active = capacity, threshold = -1, dirty = true;
  far.count = 0; far.visible = false;
  function pack() {
    let nearCount = 0, farCount = 0;
    for (const cluster of clusters) for (const index of cluster.indices) {
      if (index >= active) continue;
      const mesh = cluster.close ? near : far, destination = cluster.close ? nearCount++ : farCount++;
      for (let n=0;n<16;n++) mesh.instanceMatrix.array[destination*16+n] = source[index*16+n];
      if (colors) for (let n=0;n<3;n++) mesh.instanceColor!.array[destination*3+n] = colors[index*3+n];
    }
    near.count = nearCount; far.count = farCount; near.visible = nearCount > 0; far.visible = farCount > 0;
    near.instanceMatrix.needsUpdate = far.instanceMatrix.needsUpdate = true;
    if (colors) { near.instanceColor!.needsUpdate = true; far.instanceColor!.needsUpdate = true; }
    dirty = false;
  }
  pack();
  return { far, clusters,
    setCount(count: number) { active = Math.max(0, Math.min(capacity, count)); dirty = true; pack(); },
    update(camera: Vector3, distance: number) {
      if (!dirty && threshold === distance && previous.distanceToSquared(camera) < 1) return;
      previous.copy(camera); threshold = distance;
      for (const cluster of clusters) {
        const bounds = cluster.bounds;
        const dx=Math.max(bounds.min.x-camera.x,0,camera.x-bounds.max.x);
        const dy=Math.max(bounds.min.y-camera.y,0,camera.y-bounds.max.y);
        const dz=Math.max(bounds.min.z-camera.z,0,camera.z-bounds.max.z);
        const limit=distance+(cluster.close?3:-3),close=dx*dx+dy*dy+dz*dz<limit*limit;
        if(close!==cluster.close){cluster.close=close;dirty=true;}
      }
      if(dirty)pack();
    },
    dispose() { far.dispose(); },
  };
}
