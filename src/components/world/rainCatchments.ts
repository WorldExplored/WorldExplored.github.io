import { Mesh, Object3D, Vector3 } from 'three';
import { landDistance, terrainMeshHeight } from './terrain';

interface RoofTriangle { ax:number; az:number; ay:number; bx:number; bz:number; by:number; cx:number; cz:number; cy:number; inverse:number; top:number }
const CELL = 1;
function decorativeBranch(object:Object3D) {
  return !object.visible || object.name.startsWith('city-interior-') || object.name.endsWith('-operating-assembly');
}
function decorativeMesh(object:Mesh) {
  return Array.isArray(object.geometry.userData.floors)
    || /^eco-city-.*-(garden|fabric)$/.test(object.name)
    || /-(planting|roof-gardens|climbing-side-gardens|attached-garden-trellises)$/.test(object.name);
}
/** Actual upward-facing building triangles, indexed once rather than raycasting every drop. */
export function createRainCatchments(roots: readonly Object3D[]) {
  const cells = new Map<string, RoofTriangle[]>(), a=new Vector3(), b=new Vector3(), c=new Vector3();
  let triangles=0;
  for(const root of roots) {
    root.updateWorldMatrix(true,true);
    const visit=(object:Object3D)=>{
      if(decorativeBranch(object))return;
      for(const child of object.children)visit(child);
      const mesh=object as Mesh;
      if(!mesh.isMesh || 'isInstancedMesh' in mesh || decorativeMesh(mesh))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.every(material=>!material.visible||material.opacity<.05||!material.colorWrite))return;
      const geometry=mesh.geometry,position=geometry.getAttribute('position'),indices=geometry.index,roomFill=geometry.getAttribute('aRoomFill');
      if(!position)return;
      for(let i=0;i<(indices?.count??position.count);i+=3){
        // The city batches identify interior floor faces independently of the
        // exterior ceilings and terraces sharing their material.
        const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;
        if(roomFill && roomFill.getX(ia)>.7 && roomFill.getX(ib)>.7 && roomFill.getX(ic)>.7)continue;
        a.fromBufferAttribute(position,ia).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(position,ib).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(position,ic).applyMatrix4(mesh.matrixWorld);
        const determinant=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
        // Ignore vertical walls and downward-facing soffits; glazing roofs still catch rain.
        if(determinant>=-.000001||Math.max(a.y,b.y,c.y)<.18)continue;
        const triangle={ax:a.x,az:a.z,ay:a.y,bx:b.x,bz:b.z,by:b.y,cx:c.x,cz:c.z,cy:c.y,inverse:1/determinant,top:Math.max(a.y,b.y,c.y)};
        triangles++;
        for(let x=Math.floor(Math.min(a.x,b.x,c.x)/CELL);x<=Math.floor(Math.max(a.x,b.x,c.x)/CELL);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/CELL);z<=Math.floor(Math.max(a.z,b.z,c.z)/CELL);z++){
          const key=`${x},${z}`,bucket=cells.get(key)??[];bucket.push(triangle);cells.set(key,bucket);
        }
      }
    };
    visit(root);
  }
  // The first covering roof usually ends a query. Buried floors and lower
  // ledges cannot beat an already-found surface above their highest vertex.
  for(const bucket of cells.values())bucket.sort((a,b)=>b.top-a.top);
  return {triangles,cells:cells.size,height(x:number,z:number){
    let height=-Infinity;
    for(const t of cells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)??[]){
      if(t.top<=height)break;
      const u=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))*t.inverse;
      const v=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))*t.inverse;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)height=Math.max(height,u*t.ay+v*t.by+(1-u-v)*t.cy);
    }
    return height;
  }};
}
let catchments:ReturnType<typeof createRainCatchments>|undefined;
export function installRainCatchments(roots:readonly Object3D[]){catchments=createRainCatchments(roots);return catchments;}
export function clearRainCatchments(){catchments=undefined;}
export function rainSurfaceHeight(x:number,z:number){
  return Math.max(catchments?.height(x,z)??-Infinity,landDistance(x,z)<-1?-1:terrainMeshHeight(x,z));
}
