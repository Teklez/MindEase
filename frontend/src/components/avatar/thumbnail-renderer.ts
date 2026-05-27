// Singleton three.js renderer used by the avatar picker to produce static
// PNG portraits of each persona's .glb. We render each request into one
// shared hidden canvas + WebGL context, capture the result as a dataURL,
// and dispose the scene graph — so the picker page never holds more than
// one WebGL context (and zero once all five thumbnails have been generated).
//
// Compared with mounting a live three.js viewer per card (5 simultaneous
// WebGL contexts, 5 idle render loops, 5x GPU/RAM), this keeps the picker
// effectively as cheap as serving static `<img>` tags.

import type * as THREE from "three";
import type { GLTF, GLTFLoader as GLTFLoaderType } from "three/examples/jsm/loaders/GLTFLoader.js";

type ThreeModule = typeof THREE;
type LoadedThree = {
  THREE: ThreeModule;
  GLTFLoader: new () => GLTFLoaderType;
};

let threePromise: Promise<LoadedThree> | null = null;
function loadThree(): Promise<LoadedThree> {
  if (!threePromise) {
    threePromise = Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
    ]).then(([three, gltf]) => ({
      THREE: three as ThreeModule,
      GLTFLoader: gltf.GLTFLoader,
    }));
  }
  return threePromise;
}

// Cache parsed GLTF scenes so 5 personas sharing one .glb only parse once.
const gltfCache = new Map<string, Promise<THREE.Group>>();
async function loadGltfScene(url: string): Promise<THREE.Group> {
  const cached = gltfCache.get(url);
  if (cached) return cached;
  const promise = loadThree().then(
    ({ GLTFLoader }) =>
      new Promise<THREE.Group>((resolve, reject) => {
        new GLTFLoader().load(
          url,
          (gltf: GLTF) => resolve(gltf.scene),
          undefined,
          (err: unknown) => reject(err),
        );
      }),
  );
  gltfCache.set(url, promise);
  return promise;
}

// One hidden canvas + renderer reused across all thumbnail captures.
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
async function getRenderer(
  size: number,
): Promise<{ THREE: ThreeModule; renderer: THREE.WebGLRenderer }> {
  const { THREE } = await loadThree();
  if (!sharedRenderer) {
    sharedCanvas = document.createElement("canvas");
    sharedRenderer = new THREE.WebGLRenderer({
      canvas: sharedCanvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    sharedRenderer.toneMappingExposure = 1.0;
  }
  sharedRenderer.setPixelRatio(
    Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2),
  );
  sharedRenderer.setSize(size, size, false);
  return { THREE, renderer: sharedRenderer };
}

// Serialize captures so we never race two render() calls into the shared
// canvas. Each call waits for the previous one to finish.
let captureQueue: Promise<unknown> = Promise.resolve();

export type ThumbnailOptions = {
  url: string;
  /** Output square size in CSS pixels. */
  size?: number;
  /** Per-persona seed used to vary the camera angle when models are shared. */
  seed?: number;
};

const dataUrlCache = new Map<string, Promise<string>>();

function cacheKey(opts: ThumbnailOptions): string {
  return `${opts.url}|${opts.size ?? 256}|${opts.seed ?? 0}`;
}

export function generateAvatarThumbnail(opts: ThumbnailOptions): Promise<string> {
  const key = cacheKey(opts);
  const cached = dataUrlCache.get(key);
  if (cached) return cached;

  const promise = (captureQueue = captureQueue.then(
    () => doCapture(opts),
    () => doCapture(opts),
  )) as Promise<string>;
  dataUrlCache.set(key, promise);
  // If the capture rejects, drop the cache entry so a retry can succeed.
  promise.catch(() => dataUrlCache.delete(key));
  return promise;
}

async function doCapture(opts: ThumbnailOptions): Promise<string> {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 0;
  const { THREE, renderer } = await getRenderer(size);
  const sourceScene = await loadGltfScene(opts.url);

  const scene = new THREE.Scene();
  // Transparent background — the card's CSS gradient shows through.
  scene.background = null;

  // Clone the model so each capture has an independent transform/material set.
  const model = sourceScene.clone(true);
  scene.add(model);

  // Soft, photographic lighting — neutral ambient + warm key + cool rim.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.1);
  keyLight.position.set(1.2, 2.4, 1.6);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xb6c2ff, 0.45);
  rim.position.set(-1.6, 1.4, -1.4);
  scene.add(rim);

  // Frame the head. Ready-Player-Me-style avatars are roughly 1.7m tall
  // standing in a T-pose with the head near max.y, so we frame on a band
  // at the top of the bounding box.
  const box = new THREE.Box3().setFromObject(model);
  const min = box.min;
  const max = box.max;
  const height = max.y - min.y;
  const headY = max.y - height * 0.07;
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  // Vertical band we want to fit (head + a sliver of neck/shoulders).
  const targetHeight = height * 0.22;

  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (targetHeight / (2 * Math.tan(fov / 2))) * 1.55;

  // Spread the camera angle across personas so shared-model thumbnails
  // don't look pixel-identical. Range ~±18° in yaw.
  const yaw = seed * 0.31;
  camera.position.set(
    centerX + Math.sin(yaw) * distance,
    headY,
    centerZ + Math.cos(yaw) * distance,
  );
  camera.lookAt(centerX, headY, centerZ);

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  // Tear the cloned scene graph down so we don't leak GPU memory.
  scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as Partial<THREE.Mesh>;
    mesh.geometry?.dispose?.();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
    else mat?.dispose?.();
  });

  return dataUrl;
}
