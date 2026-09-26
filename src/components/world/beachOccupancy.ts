/** Reserved beach corridors cover the complete adult and hatchling route, independent of frame order. */
export interface BeachReservation { owner:string; from:{x:number;z:number}; to:{x:number;z:number}; radius:number }
export function beachClearance(x:number,z:number,radius:number,reservations:readonly BeachReservation[]){
  let clearance=Infinity;
  for(const slot of reservations){
    const dx=slot.to.x-slot.from.x,dz=slot.to.z-slot.from.z,length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((x-slot.from.x)*dx+(z-slot.from.z)*dz)/length)):0;
    clearance=Math.min(clearance,Math.hypot(x-slot.from.x-t*dx,z-slot.from.z-t*dz)-slot.radius-radius);
  }
  return clearance;
}
