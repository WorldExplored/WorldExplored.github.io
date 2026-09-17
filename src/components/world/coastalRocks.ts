import { applySurface } from './surfaceMaterials';
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
  const sides = 24, rows=12, positions: number[] = [], colors: number[] = [], uvs:number[]=[], indices:number[]=[];
  const tint = new Color(['#7c837c', '#737d7d', '#aa9876', '#8b8e83', '#67777b', '#96988a'][kind % 6]);
  for(let row=0;row<=rows;row++){
    const t=row/rows*3,segment=Math.min(2,Math.floor(t)),mix=t-segment;
    const r=profiles[segment][0]*(1-mix)+profiles[segment+1][0]*mix;
    const height=profiles[segment][1]*(1-mix)+profiles[segment+1][1]*mix;
    for(let side=0;side<=sides;side++){
      const a=side/sides*Math.PI*2;
      const weather=1+.065*Math.sin(a*7+kind)+.10*Math.cos(a*3-kind*.8)+.035*Math.sin(a*13+row*.5);
      const ledge=.025*Math.sin(row*2.5+a*4)*Math.sin(row/rows*Math.PI);
      const x=Math.cos(a)*(r+ledge)*weather+height*.16;
      const z=Math.sin(a)*(r+ledge)*weather*(kind===2?.36:kind===0?.7:.82);
      const y=height*(1+.055*Math.sin(a*4+kind))-.02*Math.sin(row/rows*Math.PI)*Math.cos(a*3);
      positions.push(x,y,z);uvs.push(side/sides*2,row/rows);
      const stratum=.91+.045*Math.sin(y*42+a*.7)+.035*Math.sin(a*11+row*4.1);colors.push(tint.r*stratum,tint.g*stratum,tint.b*stratum);
      if(row&&side){const i=row*(sides+1)+side;indices.push(i,i-sides-1,i-1,i-1,i-sides-1,i-sides-2);}
    }
  }
  // The top is slightly domed and weathered, retaining broad geological strata.
  const top=positions.length/3,topHeight=profiles.at(-1)![1];positions.push(topHeight*.16,topHeight+.012,0);colors.push(tint.r,tint.g,tint.b);uvs.push(.5,.5);
  for(let side=0;side<sides;side++){const a=rows*(sides+1)+side;indices.push(a,top,a+1);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createCoastalRocks(sites: LandscapeRock[]) {
  const root=new Group();root.name='shoreline-rocks';const material=applySurface(new MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0}),'mineral');
  const geometries=ROCK_ARCHETYPES.map((_,i)=>coastalRockGeometry(i)), transform=new Object3D();
  const batches=geometries.map((geometry,kind)=>{
    const entries=sites.filter((_,i)=>i%6===kind);const mesh=new InstancedMesh(geometry,material,entries.length);mesh.name=`coastal-rock-${ROCK_ARCHETYPES[kind]}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.entries=entries;
    entries.forEach((rock,i)=>{transform.position.set(rock.x,rock.y-.16,rock.z);transform.rotation.set(0,rock.rotation,0);transform.scale.fromArray(rock.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});mesh.computeBoundingSphere();root.add(mesh);return mesh;
  });
  return {root,dispose(){geometries.forEach(g=>g.dispose());material.dispose();batches.forEach(m=>m.dispose());}};
}
