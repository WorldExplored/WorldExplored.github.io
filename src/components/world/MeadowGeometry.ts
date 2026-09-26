import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { seededRandom } from './terrain';

/** Curved ribbons preserve a broad silhouette with no cone sides or alpha overdraw. */
export function meadowGeometry(underwater=false, detail:'near'|'far'='near') {
  const p:number[]=[],c:number[]=[],indices:number[]=[],random=seededRandom(underwater?18342:12839);
  const blades=underwater?13:15,rows=detail==='near'?3:2;
  for(let blade=0;blade<blades;blade++){
    const angle=blade*2.399+random()*.4,length=.5+random()*.5;
    const lean=(underwater?.36:.20)+random()*(underwater?.18:.15);
    const width=(underwater?.022:.018)+random()*(underwater?.035:.018);
    const tint=new Color().setHSL(underwater?.22+random()*.12:.23+random()*.08,underwater?.40:.48,underwater?.25+random()*.13:.28+random()*.13);
    const start=p.length/3;
    for(let row=0;row<=rows;row++)for(const side of [-1,1]){
      const t=row/rows,breadth=Math.sin(Math.PI*t)*width,curve=lean*t*t;
      p.push(Math.sin(angle)*curve+Math.cos(angle)*breadth*side,t*length,Math.cos(angle)*curve-Math.sin(angle)*breadth*side);
      const shade=.62+t*.44;c.push(tint.r*shade,tint.g*shade,tint.b*shade);
      if(row&&side===1){const n=start+row*2;if(row>1)indices.push(n-2,n-1,n);if(row<rows)indices.push(n-1,n+1,n);}
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('color',new Float32BufferAttribute(c,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData={blades,detail,underwater};return geometry;
}
