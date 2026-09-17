import { world } from '../../content/world';

// Match the displacement used by the open-water vertex shader, without allocating vectors.
export function harborWaterHeight(x: number, z: number, elapsed: number, detail = 1) {
  const time = elapsed * world.environment.waterSpeed;
  return Math.sin(x * .39 + z * .25 + time) * .055 + Math.sin(x * -.24 + z * .53 - time * .75) * .035 + Math.sin(x * .095 + z * .13 + time * .64) * .13 + (detail > .5 ? Math.sin(x * 1.2 + z * .71 + time * 1.3) * .013 * detail : 0);
}
