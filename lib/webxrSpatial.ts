export type WebXRPoint = { x: number; y: number; z: number };

type WebXRHitPose = { transform?: { position?: WebXRPoint; matrix?: Float32Array } };
type WebXRHitResult = { getPose: (space: object) => WebXRHitPose | null };
type WebXRHitSource = object;
type WebXRView = {
  projectionMatrix: Float32Array;
  transform: { inverse: { matrix: Float32Array } };
};
type WebXRViewport = { x: number; y: number; width: number; height: number };
type WebXRFrame = {
  getHitTestResults: (source: WebXRHitSource) => WebXRHitResult[];
  getViewerPose: (space: object) => { views: WebXRView[] } | null;
};
type WebXRLayer = {
  framebuffer: WebGLFramebuffer | null;
  getViewport: (view: WebXRView) => WebXRViewport;
};
type WebXRSession = EventTarget & {
  visibilityState?: string;
  requestReferenceSpace: (type: string) => Promise<object>;
  requestHitTestSource: (options: { space: object }) => Promise<WebXRHitSource>;
  requestAnimationFrame: (callback: (time: number, frame: WebXRFrame) => void) => number;
  updateRenderState: (state: { baseLayer: WebXRLayer }) => void;
  end: () => Promise<void>;
};
type WebXRSystem = {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string, options: Record<string, unknown>) => Promise<WebXRSession>;
};
type XRCompatibleContext = WebGLRenderingContext & { makeXRCompatible?: () => Promise<void> };
type XRLayerConstructor = new (
  session: WebXRSession,
  context: XRCompatibleContext,
  options: { alpha: boolean; antialias: boolean; depth: boolean; stencil: boolean }
) => WebXRLayer;

export type WebXRARController = {
  getLatestHit: () => WebXRPoint | null;
  getLatestHitTransform: () => number[] | null;
  setAnchor: (point: WebXRPoint | null) => void;
  setObjects: (objects: WebXRPlacedBox[]) => void;
  end: () => Promise<void>;
  isEnded: () => boolean;
};

export type WebXRPlacedBox = {
  transform: number[];
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
  category: 'cabinet' | 'appliance' | 'fixture' | 'furniture' | 'opening' | 'custom';
};

export function metersToInches(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return Math.round(meters * 39.37007874 * 100) / 100;
}

export function distanceInMeters(a: WebXRPoint, b: WebXRPoint): number {
  if (![a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite)) return 0;
  const x = b.x - a.x;
  const y = b.y - a.y;
  const z = b.z - a.z;
  return Math.sqrt(x * x + y * y + z * z);
}

export function boxCornersInWorld(box: WebXRPlacedBox): WebXRPoint[] {
  if (box.transform.length !== 16 || !box.transform.every(Number.isFinite)) return [];
  const halfWidth = box.widthMeters / 2;
  const halfDepth = box.depthMeters / 2;
  const height = box.heightMeters;
  if (![halfWidth, halfDepth, height].every(Number.isFinite) || halfWidth <= 0 || halfDepth <= 0 || height <= 0) return [];
  const localCorners: Array<[number, number, number]> = [
    [-halfWidth, 0, -halfDepth], [halfWidth, 0, -halfDepth],
    [halfWidth, 0, halfDepth], [-halfWidth, 0, halfDepth],
    [-halfWidth, height, -halfDepth], [halfWidth, height, -halfDepth],
    [halfWidth, height, halfDepth], [-halfWidth, height, halfDepth],
  ];
  const matrix = box.transform;
  const normalLength = Math.hypot(matrix[4], matrix[5], matrix[6]);
  if (normalLength < 1e-6) return [];
  const normal = [matrix[4] / normalLength, matrix[5] / normalLength, matrix[6] / normalLength];
  if (Math.abs(normal[1]) < 0.75) {
    const right = [normal[2], 0, -normal[0]];
    const rightLength = Math.hypot(...right);
    if (rightLength < 1e-6) return [];
    right[0] /= rightLength;
    right[2] /= rightLength;
    const wallCorners: Array<[number, number, number]> = [
      [-halfWidth, -height / 2, 0], [halfWidth, -height / 2, 0],
      [halfWidth, height / 2, 0], [-halfWidth, height / 2, 0],
      [-halfWidth, -height / 2, box.depthMeters], [halfWidth, -height / 2, box.depthMeters],
      [halfWidth, height / 2, box.depthMeters], [-halfWidth, height / 2, box.depthMeters],
    ];
    return wallCorners.map(([x, y, z]) => ({
      x: matrix[12] + right[0] * x + normal[0] * z,
      y: matrix[13] + y + normal[1] * z,
      z: matrix[14] + right[2] * x + normal[2] * z,
    }));
  }
  return localCorners.map(([x, y, z]) => ({
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  }));
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not initialize the AR reticle.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error('Could not initialize the AR reticle.');
  }
  return shader;
}

function createReticleProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER,
    'attribute vec4 position; void main() { gl_Position = position; }');
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER,
    'precision mediump float; uniform vec4 tint; void main() { gl_FragColor = tint; }');
  const program = gl.createProgram();
  if (!program) throw new Error('Could not initialize the AR reticle.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error('Could not initialize the AR reticle.');
  }
  const buffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const position = gl.getAttribLocation(program, 'position');
  const tint = gl.getUniformLocation(program, 'tint');
  if (!buffer || !lineBuffer || position < 0 || !tint) {
    gl.deleteBuffer(buffer);
    gl.deleteBuffer(lineBuffer);
    gl.deleteProgram(program);
    throw new Error('Could not initialize the AR reticle.');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.035, 0, 0, 1, 0.035, 0, 0, 1,
    0, -0.035, 0, 1, 0, 0.035, 0, 1,
  ]), gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 0, 0);
  return { program, buffer, lineBuffer, position, tint };
}

function projectToClip(view: WebXRView, point: WebXRPoint): [number, number, number, number] | null {
  const viewMatrix = view.transform.inverse.matrix;
  const projection = view.projectionMatrix;
  if (viewMatrix.length !== 16 || projection.length !== 16) return null;
  const x = viewMatrix[0] * point.x + viewMatrix[4] * point.y + viewMatrix[8] * point.z + viewMatrix[12];
  const y = viewMatrix[1] * point.x + viewMatrix[5] * point.y + viewMatrix[9] * point.z + viewMatrix[13];
  const z = viewMatrix[2] * point.x + viewMatrix[6] * point.y + viewMatrix[10] * point.z + viewMatrix[14];
  const w = viewMatrix[3] * point.x + viewMatrix[7] * point.y + viewMatrix[11] * point.z + viewMatrix[15];
  const clipX = projection[0] * x + projection[4] * y + projection[8] * z + projection[12] * w;
  const clipY = projection[1] * x + projection[5] * y + projection[9] * z + projection[13] * w;
  const clipZ = projection[2] * x + projection[6] * y + projection[10] * z + projection[14] * w;
  const clipW = projection[3] * x + projection[7] * y + projection[11] * z + projection[15] * w;
  return clipW > 0 ? [clipX / clipW, clipY / clipW, clipZ / clipW, 1] : null;
}

/**
 * A tap that lands on an overlay control or any element other than the overlay
 * root itself (including third-party floating widgets) is not an AR placement tap.
 */
export function isOverlayInteractionTarget(target: EventTarget | null, passthrough: unknown[]): boolean {
  return Boolean(target) && !passthrough.includes(target);
}

export async function startWebXRARSession(options: {
  canvas: HTMLCanvasElement;
  overlayRoot: HTMLElement;
  onSurfaceChange: (available: boolean) => void;
  onSelect: (point: WebXRPoint | null, transform: number[] | null) => void;
  onEnd: () => void;
}): Promise<WebXRARController> {
  const xr = (navigator as Navigator & { xr?: WebXRSystem }).xr;
  const Layer = (globalThis as typeof globalThis & { XRWebGLLayer?: XRLayerConstructor }).XRWebGLLayer;
  if (!xr || !Layer) throw new Error('This browser does not provide WebXR AR.');
  if (!window.isSecureContext) throw new Error('AR requires a secure HTTPS connection.');

  const session = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: options.overlayRoot },
  });

  let ended = false;
  let latestHit: WebXRPoint | null = null;
  let latestHitTransform: number[] | null = null;
  let placedObjects: WebXRPlacedBox[] = [];
  let anchorPoint: WebXRPoint | null = null;
  let lastSurfaceState = false;
  let endPromise: Promise<void> | null = null;
  const overlayTarget = options.overlayRoot as Partial<EventTarget> | null;
  const onSelect = () => {
    if (ended) return;
    try {
      options.onSelect(latestHit, latestHitTransform);
    } catch {
      // A failing select handler must never leave the session stuck.
    }
  };
  // Taps on overlay controls and third-party widgets must not become AR placement taps.
  const onBeforeSelect = (event: Event) => {
    const passthrough = [
      overlayTarget,
      options.canvas,
      typeof document !== 'undefined' ? document.body : null,
      typeof document !== 'undefined' ? document.documentElement : null,
    ];
    if (isOverlayInteractionTarget(event.target, passthrough)) event.preventDefault();
  };
  const onSessionVisibility = () => {
    if (session.visibilityState === 'hidden') void endSession();
  };
  const onSessionEnd = () => {
    if (ended) return;
    ended = true;
    session.removeEventListener('select', onSelect);
    session.removeEventListener('end', onSessionEnd);
    session.removeEventListener('visibilitychange', onSessionVisibility);
    if (typeof overlayTarget?.removeEventListener === 'function') {
      overlayTarget.removeEventListener('beforexrselect', onBeforeSelect);
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('beforexrselect', onBeforeSelect);
    }
    try {
      options.onSurfaceChange(false);
    } finally {
      options.onEnd();
    }
  };
  const endSession = (): Promise<void> => {
    if (ended) return Promise.resolve();
    if (!endPromise) {
      endPromise = (async () => {
        try {
          await session.end();
        } catch {
          // A session that fails to end cleanly is still treated as ended locally.
        } finally {
          onSessionEnd();
        }
      })();
    }
    return endPromise;
  };

  try {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    options.canvas.width = Math.max(1, Math.round(options.canvas.clientWidth * pixelRatio));
    options.canvas.height = Math.max(1, Math.round(options.canvas.clientHeight * pixelRatio));
    const gl = options.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: true,
    }) as XRCompatibleContext | null;
    if (!gl) throw new Error('This browser could not create the AR display.');
    await gl.makeXRCompatible?.();
    const reticle = createReticleProgram(gl);
    const layer = new Layer(session, gl, { alpha: true, antialias: true, depth: true, stencil: false });
    session.updateRenderState({ baseLayer: layer });

    const viewerSpace = await session.requestReferenceSpace('viewer');
    const worldSpace = await session.requestReferenceSpace('local');
    const hitSource = await session.requestHitTestSource({ space: viewerSpace });
    const frame = (_time: number, xrFrame: WebXRFrame) => {
      if (ended) return;
      const pose = xrFrame.getViewerPose(worldSpace);
      const firstHit = xrFrame.getHitTestResults(hitSource)[0];
      const hitPose = firstHit?.getPose(worldSpace);
      const position = hitPose?.transform?.position;
      const matrix = hitPose?.transform?.matrix;
      latestHit = position && [position.x, position.y, position.z].every(Number.isFinite)
        ? { x: position.x, y: position.y, z: position.z }
        : null;
      latestHitTransform = latestHit && matrix?.length === 16 && Array.from(matrix).every(Number.isFinite)
        ? Array.from(matrix)
        : null;

      const hasSurface = Boolean(latestHit);
      if (hasSurface !== lastSurfaceState) {
        lastSurfaceState = hasSurface;
        options.onSurfaceChange(hasSurface);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (pose) {
        gl.useProgram(reticle.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, reticle.buffer);
        gl.enableVertexAttribArray(reticle.position);
        gl.vertexAttribPointer(reticle.position, 4, gl.FLOAT, false, 0, 0);
        gl.uniform4f(reticle.tint, hasSurface ? 0.38 : 1, hasSurface ? 1 : 1, hasSurface ? 0.68 : 1, 0.95);
        for (const view of pose.views) {
          const viewport = layer.getViewport(view);
          gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          gl.drawArrays(gl.LINES, 0, 4);
          if (anchorPoint && latestHit) {
            const start = projectToClip(view, anchorPoint);
            const end = projectToClip(view, latestHit);
            if (start && end) {
              gl.bindBuffer(gl.ARRAY_BUFFER, reticle.lineBuffer);
              gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...start, ...end]), gl.DYNAMIC_DRAW);
              gl.vertexAttribPointer(reticle.position, 4, gl.FLOAT, false, 0, 0);
              gl.uniform4f(reticle.tint, 1, 0.83, 0.25, 0.95);
              gl.drawArrays(gl.LINES, 0, 2);
              gl.bindBuffer(gl.ARRAY_BUFFER, reticle.buffer);
              gl.vertexAttribPointer(reticle.position, 4, gl.FLOAT, false, 0, 0);
              gl.uniform4f(reticle.tint, hasSurface ? 0.38 : 1, 1, hasSurface ? 0.68 : 1, 0.95);
            }
          }
          for (const object of placedObjects) {
            const corners = boxCornersInWorld(object);
            if (corners.length !== 8) continue;
            const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
            const clipVertices: number[] = [];
            for (const index of edges) {
              const clip = projectToClip(view, corners[index]);
              if (clip) clipVertices.push(...clip);
            }
            if (clipVertices.length === edges.length * 4) {
              gl.bindBuffer(gl.ARRAY_BUFFER, reticle.lineBuffer);
              gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(clipVertices), gl.DYNAMIC_DRAW);
              gl.vertexAttribPointer(reticle.position, 4, gl.FLOAT, false, 0, 0);
              const color = object.category === 'cabinet'
                ? [0.56, 0.72, 1]
                : object.category === 'appliance'
                  ? [0.72, 0.84, 0.92]
                  : object.category === 'furniture'
                    ? [1, 0.72, 0.42]
                    : object.category === 'opening'
                      ? [1, 0.57, 0.68]
                      : object.category === 'custom'
                        ? [0.78, 0.67, 1]
                        : [0.38, 0.95, 0.72];
              gl.uniform4f(reticle.tint, color[0], color[1], color[2], 0.95);
              gl.drawArrays(gl.LINES, 0, edges.length);
              gl.bindBuffer(gl.ARRAY_BUFFER, reticle.buffer);
              gl.vertexAttribPointer(reticle.position, 4, gl.FLOAT, false, 0, 0);
              gl.uniform4f(reticle.tint, hasSurface ? 0.38 : 1, 1, hasSurface ? 0.68 : 1, 0.95);
            }
          }
        }
      }
      session.requestAnimationFrame(frame);
    };

    session.addEventListener('select', onSelect);
    session.addEventListener('end', onSessionEnd);
    session.addEventListener('visibilitychange', onSessionVisibility);
    if (typeof overlayTarget?.addEventListener === 'function') {
      overlayTarget.addEventListener('beforexrselect', onBeforeSelect);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('beforexrselect', onBeforeSelect);
    }
    session.requestAnimationFrame(frame);

    return {
      getLatestHit: () => latestHit,
      getLatestHitTransform: () => latestHitTransform,
      setAnchor: (point) => { anchorPoint = point; },
      setObjects: (objects) => { placedObjects = objects; },
      end: endSession,
      isEnded: () => ended,
    };
  } catch (error) {
    await endSession();
    throw error;
  }
}
