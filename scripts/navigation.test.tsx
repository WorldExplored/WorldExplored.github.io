import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Habitat } from '../src/components/Habitat';
import { clearDestination, pushDestination, readNavigation, subscribeNavigation, subscribeOverviewRecovery } from '../src/components/world/navigation';

class NavigationWindow extends EventTarget {
  entries: Array<{ state: Record<string, unknown>; url: URL }> = [{ state: {}, url: new URL('https://example.test/?diagnostics') }];
  index = 0;
  get location() { return this.entries[this.index].url; }
  history = {
    state: {} as Record<string, unknown>,
    pushState: (state: Record<string, unknown>, _unused: string, url: string) => { this.entries.splice(this.index + 1); this.entries.push({ state, url: new URL(url, this.location) }); this.index++; this.history.state = state; },
    replaceState: (state: Record<string, unknown>, _unused: string, url: string) => { this.entries[this.index] = { state, url: new URL(url, this.location) }; this.history.state = state; },
    go: (delta: number) => { this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta)); this.history.state = this.entries[this.index].state; this.dispatchEvent(new Event('popstate')); },
  };
}

test('Escape and repeated overview recovery publish new flights while preserving navigation history', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window'); const mock = new NavigationWindow();
  Object.defineProperty(globalThis, 'window', { value: mock, configurable: true });
  let notices = 0; const unsubscribe = subscribeNavigation(() => { notices++; readNavigation(); });
  const stopKeys = subscribeOverviewRecovery(clearDestination);
  try {
    const initial = readNavigation().serial;
    const escape = new Event('keydown', { cancelable: true }); Object.assign(escape, { key: 'Escape' }); mock.dispatchEvent(escape);
    assert.ok(escape.defaultPrevented); assert.equal(readNavigation().id, ''); assert.equal(readNavigation().serial, initial + 1);
    clearDestination(); assert.equal(readNavigation().serial, initial + 2, 'Clicking identity at overview still requests a fresh camera flight');
    pushDestination('work'); pushDestination('research'); assert.equal(readNavigation().id, 'research');
    const focused = readNavigation().serial;
    const close = new Event('keydown', { cancelable: true }); Object.assign(close, { key: 'Escape' }); mock.dispatchEvent(close);
    assert.equal(readNavigation().id, ''); assert.ok(readNavigation().serial > focused); assert.equal(mock.index, 0);
    mock.history.go(1); assert.equal(readNavigation().id, 'work'); mock.history.go(1); assert.equal(readNavigation().id, 'research');
    const handled = new Event('keydown', { cancelable: true }); Object.assign(handled, { key: 'Escape' }); handled.preventDefault(); mock.dispatchEvent(handled);
    assert.equal(readNavigation().id, 'research', 'A nested control can consume Escape before overview recovery');
    clearDestination(); const before = notices; stopKeys();
    const removed = new Event('keydown', { cancelable: true }); Object.assign(removed, { key: 'Escape' }); mock.dispatchEvent(removed); assert.equal(notices, before);
  } finally { unsubscribe(); stopKeys(); if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); }
});

test('the existing identity name is a native keyboard button with an overview recovery label', () => {
  const html = renderToStaticMarkup(<Habitat />);
  assert.match(html, /<h1\b[^>]*><button[^>]*type="button"[^>]*aria-label="Return to overview"[^>]*>Srreyansh Sethi<\/button><\/h1>/);
  assert.doesNotMatch(html, />Return to overview</, 'Recovery adds no visible instructional words');
});
