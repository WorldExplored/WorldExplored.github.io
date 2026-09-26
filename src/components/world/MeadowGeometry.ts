import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { seededRandom } from './terrain';

/** Curved ribbons preserve a broad silhouette with no cone sides or alpha overdraw. */
export function meadowGeometry(underwater=false, detail:'near'|'far'='near',form=0) {
  const p:number[]=[],c:number[]=[],indices:number[]=[],random=seededRandom(underwater?18342+form*791:12839+form*613);
  const blades=underwater?[13,6,19,9][form%4]:[15,7,11][form%3],rows=detail==='near'?3:2;
  for(let blade=0;blade<blades;blade++){
    const fern=underwater&&form===2,fan=underwater&&form===3;
    const angle=fern?(blade%2?1:-1)*1.22+Math.floor(blade/2)*.08:fan?(blade/blades-.5)*2.1:blade*2.399+random()*(underwater?.8:.4);
    const base=fern&&blade>0?Math.floor((blade+1)/2)/10*.65:0;
    const length=fern?(blade===0?1:.18+random()*.18):fan?.25+random()*.40:underwater?.42+random()*.58:.5+random()*.5;
    const lean=fern?(blade===0?.02:.22):fan?.25+random()*.21:(underwater?.22:form===1?.07:form===2?.23:.20)+random()*(underwater?.26:.15);
    const width=underwater?(form===1?.075+random()*.065:fern?.012+random()*.025:fan?.042+random()*.037:.014+random()*.03):form===1?.009+random()*.010:form===2?.034+random()*.021:.018+random()*.018;
    const tint=new Color().setHSL(underwater?(fan?.015:form===1?.13:.22)+random()*.065:.23+random()*.08,underwater?.40:.48,underwater?.25+random()*.13:.28+random()*.13);
    const start=p.length/3;
    for(let row=0;row<=rows;row++)for(const side of [-1,1]){
      const t=row/rows,ruffle=underwater&&form===1?1+.22*Math.sin(t*17+blade):1,breadth=Math.sin(Math.PI*t)*width*ruffle,curve=lean*t*t;
      const rootX=!underwater||fern?0:Math.sin(angle)*.018*(blade%3),rootZ=!underwater||fern?0:Math.cos(angle)*.018*(blade%3);
      p.push(rootX+Math.sin(angle)*curve+Math.cos(angle)*breadth*side,base+t*length,rootZ+Math.cos(angle)*curve-Math.sin(angle)*breadth*side);
      const shade=.62+t*.44;c.push(tint.r*shade,tint.g*shade,tint.b*shade);
      if(row&&side===1){const n=start+row*2;if(row>1)indices.push(n-2,n-1,n);if(row<rows)indices.push(n-1,n+1,n);}
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('color',new Float32BufferAttribute(c,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData={blades,detail,underwater,form};return geometry;
}
