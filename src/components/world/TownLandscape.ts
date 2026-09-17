import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings } from './city';
import { groundRouteAt, terrainMeshHeight, type LandscapePlan } from './terrain';

interface Vertex { x: number; z: number; distance: number }
function clip(polygon: Vertex[], limit: number, inside: (distance: number) => boolean) {
  const result: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], aIn = inside(a.distance), bIn = inside(b.distance);
    if (aIn) result.push(a);
    if (aIn !== bIn) {
      const t = (limit - a.distance) / (b.distance - a.distance);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, distance: limit });
    }
  }
  return result;
}

/** Curbs follow the union of the graded routes, including their turns and junctions.
 * Triangulated contour strips share vertices at boundaries and never cross a road. */
export function createTownLandscape(plan: LandscapePlan) {
  const root = new Group(); root.name = 'town-landscape-edging';
  const positions: number[] = [];
  const inner = .035, outer = .17, step = .25;
  const vertex = (p: Vertex, height: number) => positions.push(p.x, terrainMeshHeight(p.x, p.z) + height, p.z);
  const points: Vertex[][] = [];
  for (let row = 0; row <= 152; row++) {
    const z = -94 + row * step, line: Vertex[] = [];
    for (let column = 0; column <= 216; column++) {
      const x = -34 + column * step;
      line.push({ x, z, distance: groundRouteAt(x,z).distance });
    }
    points.push(line);
  }
  for (let row = 0; row < 152; row++) for (let column = 0; column < 216; column++) {
    const a = points[row][column], b = points[row][column + 1], c = points[row + 1][column], d = points[row + 1][column + 1];
    for (const triangle of [[a,c,b], [b,c,d]]) {
      if (triangle.every(p => p.distance < inner) || triangle.every(p => p.distance > outer)) continue;
      const polygon = clip(clip(triangle, inner, distance => distance >= inner), outer, distance => distance <= outer);
      if (polygon.length < 3) continue;
      const x = polygon.reduce((sum,p) => sum+p.x,0)/polygon.length, z = polygon.reduce((sum,p) => sum+p.z,0)/polygon.length;
      if (plan.structures.some(structure => {
        const building=cityBuildings.find(item=>item.id===structure.id);
        if(!building)return Math.hypot(x-structure.x,z-structure.z)<structure.radius+.05;
        const dx=x-building.x,dz=z-building.z,c=Math.cos(building.rotation),s=Math.sin(building.rotation);
        return Math.abs(dx*c-dz*s)<building.width/2+.08 && Math.abs(dx*s+dz*c)<building.depth/2+.08;
      })) continue;
      for (let i=1;i<polygon.length-1;i++) { vertex(polygon[0],.055); vertex(polygon[i],.055); vertex(polygon[i+1],.055); }
      for (let i=0;i<polygon.length;i++) {
        const p=polygon[i],q=polygon[(i+1)%polygon.length];
        if (Math.abs(p.distance-q.distance)>.00001 || (Math.abs(p.distance-inner)>.00001 && Math.abs(p.distance-outer)>.00001)) continue;
        vertex(p,-.015);vertex(q,-.015);vertex(p,.055);vertex(q,-.015);vertex(q,.055);vertex(p,.055);
      }
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const material=new MeshStandardMaterial({color:'#899080',roughness:.93});
  const mesh=new Mesh(geometry,material);mesh.name='town-continuous-stone-curbs';mesh.receiveShadow=true;mesh.castShadow=true;mesh.raycast=()=>{};root.add(mesh);
  const grates: BoxGeometry[]=[];
  for(let z=-88;z<-62;z+=2)for(let x=-30;x<15;x+=2){
    const distance=groundRouteAt(x,z).distance;
    if(distance<-.4||distance>-.15||plan.structures.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+.3))continue;
    if(grates.some(g=>{g.computeBoundingBox();const p=g.boundingBox!;return Math.hypot((p.min.x+p.max.x)/2-x,(p.min.z+p.max.z)/2-z)<6;}))continue;
    const nx=groundRouteAt(x+.1,z).distance-groundRouteAt(x-.1,z).distance,nz=groundRouteAt(x,z+.1).distance-groundRouteAt(x,z-.1).distance;
    for(let slat=0;slat<6;slat++)grates.push(new BoxGeometry(.022,.018,.25).translate((slat-2.5)*.06,0,0).rotateY(Math.atan2(nx,nz)).translate(x,terrainMeshHeight(x,z)+.022,z));
  }
  const drainGeometry=mergeGeometries(grates)!,drainMaterial=new MeshStandardMaterial({color:'#4b615f',roughness:.8});grates.forEach(g=>g.dispose());
  const drains=new Mesh(drainGeometry,drainMaterial);drains.name='town-flush-drainage-grates';drains.raycast=()=>{};root.add(drains);
  return { root, dispose(){geometry.dispose();material.dispose();drainGeometry.dispose();drainMaterial.dispose();} };
}
