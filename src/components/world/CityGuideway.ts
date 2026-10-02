import { BoxGeometry, CylinderGeometry, Vector3, type BufferGeometry } from 'three';
import type { CityTransitRoute } from './city';
import type { CityFinish } from './CityArchitecture';
import { terrainHeight } from './terrain';

type Add = (geometry: BufferGeometry, finish: CityFinish) => void;

/** Hardware sits below the running surface, leaving tyres and station access clear. */
export function addGuidewayHardware(route: CityTransitRoute, add: Add) {
  const p = new Vector3(), tangent = new Vector3();
  const length = route.curve.getLength(), panels = Math.ceil(length / 1.6);
  for (let i = 0; i < panels; i++) {
    const u = (i + .5) / panels;
    route.curve.getPointAt(u, p); route.curve.getTangentAt(u, tangent);
    if (Math.hypot(p.x + 5, p.z + 68) < 4.2) continue;
    const yaw = Math.atan2(tangent.x, tangent.z), nx = tangent.z, nz = -tangent.x;
    // Recessed service panels, joint plates and edge conduits follow the continuous beam.
    for (const side of [-1, 1]) {
      add(new BoxGeometry(.024, .19, length / panels - .09).rotateY(yaw).translate(p.x + nx * side * .286, p.y - .23, p.z + nz * side * .286), 'aqua');
      add(new BoxGeometry(.035, .22, .06).rotateY(yaw).translate(p.x + nx * side * .30, p.y - .23, p.z + nz * side * .30), 'metal');
      add(new BoxGeometry(.027, .026, .55).rotateY(yaw).translate(p.x + nx * side * .305, p.y - .16, p.z + nz * side * .305), 'porcelain');
    }
  }
  for (let i = 0; i < 32; i++) {
    route.curve.getPointAt(i / 32, p); route.curve.getTangentAt(i / 32, tangent);
    if (Math.hypot(p.x + 5, p.z + 68) < 4.2) continue;
    const yaw = Math.atan2(tangent.x, tangent.z), floor = terrainHeight(p.x, p.z) - .15;
    add(new BoxGeometry(.68, .12, .74).rotateY(yaw).translate(p.x, p.y - .49, p.z), 'aqua');
    add(new BoxGeometry(.7, .12, .7).rotateY(yaw).translate(p.x, floor + .12, p.z), 'porcelain');
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const x = side * .255, z = end * .255;
      add(new CylinderGeometry(.025, .025, .024, 6).translate(p.x + x * Math.cos(yaw) + z * Math.sin(yaw), floor + .19, p.z - x * Math.sin(yaw) + z * Math.cos(yaw)), 'metal');
    }
    // Fixed maintenance cabinet is fastened to the column, below the bearing assembly.
    if (i % 4 === 0) {
      add(new BoxGeometry(.24, .32, .13).rotateY(yaw).translate(p.x + tangent.x * .27, p.y - .92, p.z + tangent.z * .27), 'porcelain');
      add(new BoxGeometry(.16, .045, .02).rotateY(yaw).translate(p.x + tangent.x * .343, p.y - .85, p.z + tangent.z * .343), 'aqua');
    }
  }
}
