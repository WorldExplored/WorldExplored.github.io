import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences, serverPreferences, subscribePreferences } from '../src/components/world/preferences.ts';
import { motionPolicy } from '../src/content/world.ts';

test('preference subscriptions update, cache, and clean up automatic accessibility state', () => {
  const original = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const media = new Map();
  const document = Object.assign(new EventTarget(), { hidden: false });
  const connection = Object.assign(new EventTarget(), { saveData: false });
  const window = { matchMedia(query) { if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), { matches: false })); return media.get(query); } };
  for (const [key, value] of Object.entries({ window, document, navigator: { connection } })) Object.defineProperty(globalThis, key, { value, configurable: true });
  let calls = 0;
  const unsubscribe = subscribePreferences(() => calls++);
  try {
    assert.equal(serverPreferences().reduced, false);
    assert.equal(readPreferences(), readPreferences());
    media.get('(prefers-reduced-motion: reduce)').matches = true;
    media.get('(prefers-reduced-motion: reduce)').dispatchEvent(new Event('change'));
    assert.equal(calls, 1);
    const reduced = readPreferences();
    assert.equal(reduced.reduced, true);
    assert.deepEqual(motionPolicy(reduced.reduced, reduced.saveData, reduced.forced), { webgl: true, camera: false, ambient: false, physics: false });
    media.get('(forced-colors: active)').matches = true;
    media.get('(forced-colors: active)').dispatchEvent(new Event('change'));
    assert.equal(readPreferences().forced, true);
    connection.saveData = true;
    connection.dispatchEvent(new Event('change'));
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(readPreferences().saveData, true);
    assert.equal(readPreferences().hidden, true);
    assert.equal(calls, 4);
    unsubscribe();
    document.dispatchEvent(new Event('visibilitychange'));
    connection.dispatchEvent(new Event('change'));
    for (const query of media.values()) query.dispatchEvent(new Event('change'));
    assert.equal(calls, 4);
  } finally {
    unsubscribe();
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
