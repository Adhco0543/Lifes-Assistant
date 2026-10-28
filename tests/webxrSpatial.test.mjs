import test from 'node:test';
import assert from 'node:assert/strict';
import { startWebXRARSession } from '../lib/webxrSpatial.ts';

const identity = () => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

test('WebXR session hit tests place and render dimensioned AR boxes', async () => {
  const calls = { requested: null, drawCounts: [], surface: [], selected: null, ended: 0 };
  let frameCallback;
  const hitMatrix = identity();
  hitMatrix[14] = -2;
  const view = {
    projectionMatrix: identity(),
    transform: { inverse: { matrix: identity() } },
  };
  const hit = {
    getPose: () => ({ transform: { position: { x: 0, y: 0, z: -2 }, matrix: hitMatrix } }),
  };
  const session = new EventTarget();
  session.requestReferenceSpace = async () => ({});
  session.requestHitTestSource = async () => ({});
  session.requestAnimationFrame = (callback) => { frameCallback = callback; return 1; };
  session.updateRenderState = () => undefined;
  session.end = async () => { session.dispatchEvent(new Event('end')); };

  class MockLayer {
    constructor() { this.framebuffer = {}; }
    getViewport() { return { x: 0, y: 0, width: 320, height: 240 }; }
  }

  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, ARRAY_BUFFER: 4,
    STATIC_DRAW: 5, FLOAT: 6, LINK_STATUS: 7, FRAMEBUFFER: 8,
    COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32, LINES: 9, DYNAMIC_DRAW: 10,
    createShader: () => ({}), shaderSource: () => undefined, compileShader: () => undefined,
    getShaderParameter: () => true, deleteShader: () => undefined, createProgram: () => ({}),
    attachShader: () => undefined, linkProgram: () => undefined, deleteProgram: () => undefined,
    getProgramParameter: () => true, createBuffer: () => ({}), deleteBuffer: () => undefined,
    getAttribLocation: () => 0, getUniformLocation: () => ({}), bindBuffer: () => undefined,
    bufferData: () => undefined, useProgram: () => undefined, enableVertexAttribArray: () => undefined,
    vertexAttribPointer: () => undefined, uniform4f: () => undefined, bindFramebuffer: () => undefined,
    clearColor: () => undefined, clear: () => undefined, viewport: () => undefined,
    drawArrays: (_mode, _first, count) => calls.drawCounts.push(count),
    makeXRCompatible: async () => undefined,
  };
  const xr = {
    requestSession: async (mode, options) => { calls.requested = { mode, options }; return session; },
  };

  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalLayer = Object.getOwnPropertyDescriptor(globalThis, 'XRWebGLLayer');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { xr } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, devicePixelRatio: 1 } });
  Object.defineProperty(globalThis, 'XRWebGLLayer', { configurable: true, value: MockLayer });

  try {
    const controller = await startWebXRARSession({
      canvas: { clientWidth: 320, clientHeight: 240, getContext: () => gl },
      overlayRoot: {},
      onSurfaceChange: (value) => calls.surface.push(value),
      onSelect: (point, transform) => { calls.selected = { point, transform }; },
      onEnd: () => { calls.ended += 1; },
    });

    assert.equal(calls.requested.mode, 'immersive-ar');
    assert.deepEqual(calls.requested.options.requiredFeatures, ['hit-test']);
    const frame = { getViewerPose: () => ({ views: [view] }), getHitTestResults: () => [hit] };
    frameCallback(0, frame);
    controller.setObjects([{
      transform: Array.from(hitMatrix),
      widthMeters: 0.75,
      heightMeters: 0.86,
      depthMeters: 0.53,
      category: 'cabinet',
    }]);
    frameCallback(16, frame);
    session.dispatchEvent(new Event('select'));

    assert.deepEqual(calls.surface, [true]);
    assert.deepEqual(calls.selected.point, { x: 0, y: 0, z: -2 });
    assert.deepEqual(calls.selected.transform, Array.from(hitMatrix));
    assert.ok(calls.drawCounts.includes(24), 'renders all 12 edges of the AR box');

    await controller.end();
    assert.equal(calls.ended, 1);
    assert.deepEqual(calls.surface, [true, false]);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalLayer) Object.defineProperty(globalThis, 'XRWebGLLayer', originalLayer);
    else delete globalThis.XRWebGLLayer;
  }
});
