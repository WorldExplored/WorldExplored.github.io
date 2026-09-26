import { seededRandom } from './terrain';

const shells=['#c87949','#6d8175','#b7aa82','#954d39','#536e82','#c39b60'];
export function crabVariation(index:number){
  const random=seededRandom(61337+index*7919),dominant=index%4===0;
  return {size:.76+random()*.66,width:.88+random()*.30,depth:.87+random()*.24,
    leftClaw:dominant?1.35+random()*.22:.78+random()*.34,
    rightClaw:dominant?.67+random()*.16:.88+random()*.35,
    color:shells[index%shells.length],legColor:shells[(index+2)%shells.length]};
}
