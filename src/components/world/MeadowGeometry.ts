import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { seededRandom } from './terrain';

/** Curved ribbons preserve a broad silhouette with no cone sides or alpha overdraw. */
export function meadowGeometry(underwater=false, detail:'near'|'far'='near',form=0) {
  const p:number[]=[],c:number[]=[],indices:number[]=[],random=seededRandom(underwater?18342+form*791:12839+form*613);
  const blades=underwater?(detail==='near'?[19,8,25,11]:[9,4,11,5])[form%4]:(detail==='near'?[23,12,19]:[11,7,9])[form%3],rows=detail==='near'?3:2;
  for(let blade=0;blade<blades;blade++){
    const fern=underwater&&form===2,fan=underwater&&form===3,seedHead=!underwater&&form===1&&blade%3===0;
    const angle=fern?(blade%2?1:-1)*1.22+Math.floor(blade/2)*.08:fan?(blade/blades-.5)*2.1:blade*2.399+random()*(underwater?.8:.4);
    const base=fern&&blade>0?Math.floor((blade+1)/2)/10*.65:0;
    const length=fern?(blade===0?1:.18+random()*.18):fan?.25+random()*.40:underwater?.42+random()*.58:seedHead?.82+random()*.18:form===2?.35+random()*.40:.5+random()*.5;
    const lean=fern?(blade===0?.02:.22):fan?.25+random()*.21:(underwater?.22:form===1?.07:form===2?.23:.20)+random()*(underwater?.26:.15);
    const width=underwater?(form===1?.075+random()*.065:fern?.012+random()*.025:fan?.042+random()*.037:.014+random()*.03):form===1?.009+random()*.010:form===2?.034+random()*.021:.018+random()*.018;
    const basalAngle=blade*2.399,basalReach=underwater?(fern||fan?0:.10*Math.sqrt(random())):.07*Math.sqrt(random());
    const basalX=Math.sin(basalAngle)*basalReach,basalZ=Math.cos(basalAngle)*basalReach;
    const tint=new Color().setHSL(underwater?(fan?.015:form===1?.13:.22)+random()*.065:.23+random()*.08,underwater?.40:.48,underwater?.25+random()*.13:.28+random()*.13);
    const start=p.length/3;
    for(let row=0;row<=rows;row++)for(const side of [-1,1]){
      const t=row/rows,ruffle=underwater&&form===1?1+.22*Math.sin(t*17+blade):1,breadth=Math.sin(Math.PI*t)*width*ruffle*(detail==='far'?1.35:1),curve=lean*t*t;
      const rootX=basalX,rootZ=basalZ;
      p.push(rootX+Math.sin(angle)*curve+Math.cos(angle)*breadth*side,base+t*length,rootZ+Math.cos(angle)*curve-Math.sin(angle)*breadth*side);
      const shade=.62+t*.44;c.push(tint.r*shade,tint.g*shade,tint.b*shade);
      if(row&&side===1){const n=start+row*2;if(row>1)indices.push(n-2,n-1,n);if(row<rows)indices.push(n-1,n+1,n);}
    }
    if(seedHead){
      // Branched oat panicles hang from a fine, upright culm.
      for(let seed=0;seed<(detail==='near'?5:3);seed++){
        const t=.71+seed*.047,side=seed%2?-1:1,tipX=basalX+Math.sin(angle)*lean*t*t,tipZ=basalZ+Math.cos(angle)*lean*t*t;
        const endX=tipX+Math.cos(angle)*side*.043,endZ=tipZ-Math.sin(angle)*side*.043,start=p.length/3;
        p.push(tipX,t*length,tipZ,endX,(t+.045)*length,endZ,endX+Math.sin(angle)*.01,(t+.10)*length,endZ+Math.cos(angle)*.01);
        for(let v=0;v<3;v++)c.push(tint.r*1.3,tint.g*1.10,tint.b*.75);indices.push(start,start+1,start+2);
      }
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('color',new Float32BufferAttribute(c,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData={blades,detail,underwater,form};return geometry;
}
