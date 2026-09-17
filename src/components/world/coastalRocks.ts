import { BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { LandscapeRock } from './terrain';

export const ROCK_ARCHETYPES = ['stratified-shelf', 'split-granite', 'sandstone-fin', 'wave-cut-block', 'slate-cluster', 'weathered-keystone'] as const;
/** Layered, irregular polygons with embedded planar bases; no spherical source geometry. */
export function coastalRockGeometry(kind: number) {
  const profiles = [
    [[1, 0], [1.05, .16], [.93, .36], [.68, .49]],
    [[.86, 0], [1, .22], [.81, .68], [.42, .94]],
    [[1, 0], [.93, .22], [.8, .63], [.61, .79]],
    [[.95, 0], [1, .18], [.78, .54], [.83, .73]],
    [[1, 0], [.78, .16], [.88, .29], [.53, .45]],
    [[.83, 0], [1, .26], [.82, .57], [.44, .68]],
  ][kind % 6];
  const sides = [8, 7, 6, 8, 7, 9][kind % 6], positions: number[] = [], colors: number[] = [];
  const rings = profiles.map(([r, y], row) => Array.from({ length: sides }, (_, i) => {
    const a = i / sides * Math.PI * 2, uneven = 1 + .14 * Math.sin(i * 3.7 + kind * 2.1) + .07 * Math.cos(i * 1.4 + row);
    return [Math.cos(a) * r * uneven + y * .16, y, Math.sin(a) * r * uneven * (kind === 2 ? .36 : kind === 0 ? .7 : .82)];
  }));
  const tint = new Color(['#7c837c', '#737d7d', '#aa9876', '#8b8e83', '#67777b', '#96988a'][kind % 6]);
  const triangle = (a: number[], b: number[], c: number[], shade: number) => { for (const v of [a,b,c]) { positions.push(...v); colors.push(tint.r * shade, tint.g * shade, tint.b * shade); } };
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, shade = .82 + row * .05 + .09 * Math.sin(i * 2.1 + kind);
    triangle(rings[row][i], rings[row+1][i], rings[row][j], shade);
    triangle(rings[row][j], rings[row+1][i], rings[row+1][j], shade);
  }
  const top = rings.at(-1)!, center = [top.reduce((s,p)=>s+p[0],0)/sides, profiles.at(-1)![1], top.reduce((s,p)=>s+p[2],0)/sides];
  for (let i=0;i<sides;i++) {triangle(top[i],center,top[(i+1)%sides],1.03);triangle(rings[0][i],rings[0][(i+1)%sides],[0,0,0],.75);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
export function createCoastalRocks(sites: LandscapeRock[]) {
  const root=new Group();root.name='shoreline-rocks';const material=new MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0});
  const geometries=ROCK_ARCHETYPES.map((_,i)=>coastalRockGeometry(i)), transform=new Object3D();
  const batches=geometries.map((geometry,kind)=>{
    const entries=sites.filter((_,i)=>i%6===kind);const mesh=new InstancedMesh(geometry,material,entries.length);mesh.name=`coastal-rock-${ROCK_ARCHETYPES[kind]}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.entries=entries;
    entries.forEach((rock,i)=>{transform.position.set(rock.x,rock.y-.16,rock.z);transform.rotation.set(0,rock.rotation,0);transform.scale.fromArray(rock.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});mesh.computeBoundingSphere();root.add(mesh);return mesh;
  });
  return {root,dispose(){geometries.forEach(g=>g.dispose());material.dispose();batches.forEach(m=>m.dispose());}};
}
