import test from 'node:test';
import assert from 'node:assert/strict';
import { createLandscapePlan, generatePlantPositions, generatePlantPositionsAsync } from '../src/components/world/terrain';

test('incremental planting yields to input and preserves deterministic placement',async()=>{
  const plan=createLandscapePlan();let turns=0;const interval=setInterval(()=>turns++,0);
  try{
    const actual=await generatePlantPositionsAsync(4000,plan,new AbortController().signal);
    assert.deepEqual(actual,generatePlantPositions(4000,plan));assert.ok(turns>1);
  }finally{clearInterval(interval);}
});
test('abandoned startup cancels queued planting',async()=>{
  const controller=new AbortController();const pending=generatePlantPositionsAsync(18000,createLandscapePlan(),controller.signal);controller.abort();assert.equal(await pending,null);
});

test('exported layout retains terrain attributes and deterministic planting', async () => {
  const { BufferGeometry, Float32BufferAttribute } = await import('three');
  const { encodeWorldLayout, decodeWorldLayout } = await import('../src/components/world/worldLayout');
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0,0,0,1,0,0,0,0,1],3));
  geometry.setAttribute('aEcology', new Float32BufferAttribute([.2,.5,.7,.2,.5,.7,.2,.5,.7],3));
  geometry.setIndex([0,2,1]);
  const positions = generatePlantPositions(12, createLandscapePlan());
  const decoded = decodeWorldLayout(encodeWorldLayout(geometry, positions));
  try {
    for (const key of Object.keys(geometry.attributes)) {
      const actual = decoded.ground.getAttribute(key).array, expected = geometry.getAttribute(key).array;
      assert.equal(actual.length, expected.length);
      expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) <= 1 / 8192));
    }
    assert.deepEqual([...decoded.ground.index!.array], [...geometry.index!.array]);
    positions.forEach((plant,i) => Object.keys(plant).forEach(key => {
      const property = key as keyof typeof plant;
      assert.ok(Math.abs(plant[property]-decoded.plants[i][property]) < .00001);
    }));
  } finally { geometry.dispose(); decoded.ground.dispose(); }
});

test('surface downloads overlap layout, share sources and recover from stalled or failed images', async context => {
  const { Texture, TextureLoader } = await import('three');
  const { SURFACE_LOAD_TIMEOUT_MS, surfaceLoadsPending, surfaceTexture } = await import('../src/components/world/surfaceMaterials');
  const { prepareWorldLayout } = await import('../src/components/world/worldLayout');
  const descriptors = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const colors: string[] = [];
  const browser = new EventTarget(); let notifications = 0;
  browser.addEventListener('portfolio:surfaces-ready', () => notifications++);
  const requests: { url: string; texture: InstanceType<typeof Texture>; load: () => void; fail: () => void }[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() {
    const paint = { fillStyle: '', fillRect() { colors.push(this.fillStyle); } };
    return { width: 0, height: 0, getContext: () => paint };
  } } });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(TextureLoader.prototype, 'load', (url: string, onLoad: (texture: InstanceType<typeof Texture>) => void, _progress: unknown, onError: () => void) => {
    const texture = new Texture(); requests.push({ url, texture, load: () => onLoad(texture), fail: onError }); return texture;
  });
  context.mock.method(globalThis, 'fetch', async () => {
    assert.equal(requests.length, 11, 'Used material channels begin downloading before the layout response');
    return new Response(null, { status: 404 });
  });
  try {
    await prepareWorldLayout();
    assert.equal(surfaceLoadsPending(), 11);
    const color = surfaceTexture('mineral', 'color', 1.3)!;
    const normal = surfaceTexture('mineral', 'normal', 1.3)!;
    assert.equal(requests.length, 11, 'Repeat variants do not create duplicate requests');
    const first = requests.find(request => request.url.endsWith('mineral-color.webp'))!;
    const second = requests.find(request => request.url.endsWith('mineral-normal.webp'))!;
    first.fail(); second.fail();
    assert.equal(surfaceLoadsPending(), 9);
    assert.equal((color.image as HTMLCanvasElement).width, 1); assert.equal((normal.image as HTMLCanvasElement).width, 1);
    assert.deepEqual(colors, ['#ffffff', '#8080ff'], 'Failed maps become neutral color and flat normals');
    context.mock.timers.tick(SURFACE_LOAD_TIMEOUT_MS);
    assert.equal(surfaceLoadsPending(), 0, 'Stalled requests cannot keep entry waiting indefinitely');
    assert.equal(notifications, 11);
    const version = color.version;
    const decodedImage = { width: 512, height: 512 };
    first.texture.image = decodedImage; first.load(); first.fail();
    assert.equal(color.image, decodedImage, 'Late success replaces every shared repeat variant');
    assert.ok(color.version > version);
    assert.equal(surfaceLoadsPending(), 0, 'Late or repeated callbacks never decrement twice');
    assert.equal(requests.length, 11);
  } finally {
    context.mock.timers.reset();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
