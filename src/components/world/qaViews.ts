import type { CameraPose } from '../../content/world';

/** Deterministic inspection poses used by the local visual-QA capture server. */
export const QA_VIEWS = Object.freeze({
  tree: { position: [7.6, 5.7, -3.7], target: [.2, 3.1, -12.9] },
  street: { position: [-5.4, 5.5, -66.1], target: [-14.2, 1.7, -77.4] },
  gull: { position: [-68.4, 10.6, -28.8], target: [-74.9, 7.8, -36] },
  crab: { position: [-19.6, 3.7, 12.1], target: [-26.1, .35, 6.8] },
  fish: { position: [1.2, 3.7, -17.8], target: [-4.5, -.45, -25.5] },
  landmark: { position: [-.4, 7.8, 12.4], target: [-8, 4.8, 0] },
  entrance: { position: [-8.5, 3, -80.7], target: [-9, 1.6, -85.5] },
  interior: { position: [-9.2, 2.5, -81.3], target: [-9, 1.8, -86] },
  elevator: { position: [-2.2, 8.4, -98.2], target: [-9.2, 5.8, -88.7] },
  bridge: { position: [1.4, 4.2, 13.4], target: [-6, 1.25, 8.2] },
  junction: { position: [-6.2, 4.8, -67.4], target: [-14.8, 1.1, -76.7] },
  solar: { position: [-16, 14, -88], target: [-19.4, 10.7, -83.9] },
  fountain: { position: [-19, 3.2, -65], target: [-16.2, 1.25, -70] },
  bell: { position: [-3.1, 4.1, -49.8], target: [-10, .65, -57.4] },
  overview: { position: [42, 29, 76], target: [-4, 2, -17] },
} satisfies Record<string, CameraPose>);

export type QaView = keyof typeof QA_VIEWS;

export function readQaView(): CameraPose | undefined {
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
  const name = new URLSearchParams(window.location.search).get('qaView') as QaView | null;
  return name && name in QA_VIEWS ? QA_VIEWS[name] : undefined;
}
