interface Point3 { x: number; y: number; z: number }
interface Bounds3 { min: readonly number[]; max: readonly number[] }

export function clampBubblePosition(position: Point3, radius: number, bounds: Bounds3) {
  position.x = Math.max(bounds.min[0] + radius, Math.min(bounds.max[0] - radius, position.x));
  position.y = Math.max(bounds.min[1] + radius, Math.min(bounds.max[1] - radius, position.y));
  position.z = Math.max(bounds.min[2] + radius, Math.min(bounds.max[2] - radius, position.z));
}

export function bubbleDragVelocity(next: Point3, previous: Point3, elapsedMs: number, velocity: Point3) {
  const seconds = Math.max(1 / 240, elapsedMs / 1000);
  velocity.x = (next.x - previous.x) / seconds;
  velocity.y = (next.y - previous.y) / seconds;
  velocity.z = (next.z - previous.z) / seconds;
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (speed > 8) {
    const scale = 8 / speed;
    velocity.x *= scale;
    velocity.y *= scale;
    velocity.z *= scale;
  }
}
