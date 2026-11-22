import { Cartesian3, Color, Math as CesiumMath, Viewer } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { installEarthImagery, sharpenRendering } from '../earth/imagery';

export interface LandingGlobe {
  update(progress: number, visible: boolean): void;
  destroy(): void;
}

const cameraProgress = (scrollProgress: number) => Math.max(0, Math.min(1, (scrollProgress - 0.36) / 0.55));

export function createLandingGlobe(mount: HTMLElement, progress: number, onError: () => void, onReady: () => void): LandingGlobe {
  const viewer = new Viewer(mount, {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    fullscreenButton: false, infoBox: false, selectionIndicator: false,
    baseLayer: false, scene3DOnly: true, showRenderLoopErrors: false,
    skyBox: false, contextOptions: { webgl: { alpha: true } },
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
  });
  sharpenRendering(viewer, 2);
  viewer.scene.backgroundColor = Color.TRANSPARENT;
  viewer.scene.globe.enableLighting = false;
  viewer.scene.screenSpaceCameraController.enableInputs = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = cameraProgress(progress);
  let target = current;
  let lastTime = performance.now();
  const placeCamera = () => {
    const eased = current * current * (3 - 2 * current);
    const height = Math.exp(Math.log(20_000_000) * (1 - eased) + Math.log(60_000) * eased);
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-95.37, 23 + 6.76 * eased, height),
      orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
    });
    viewer.scene.requestRender();
  };
  placeCamera();
  const stopImagery = installEarthImagery(viewer, () => {}, { detailedGlobe: true });
  const stopReady = viewer.scene.postRender.addEventListener(() => {
    if (!viewer.imageryLayers.get(0).ready || !viewer.scene.globe.tilesLoaded) return;
    stopReady();
    onReady();
  });
  const stopError = viewer.scene.renderError.addEventListener(onError);
  const stopCamera = viewer.scene.preUpdate.addEventListener(() => {
    if (current === target) return;
    const now = performance.now();
    const elapsed = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    current = reducedMotion.matches || Math.abs(target - current) < 0.0001
      ? target
      : current + (target - current) * (1 - Math.exp(-elapsed / 0.18));
    placeCamera();
  });
  return {
    update(nextProgress, visible) {
      target = cameraProgress(nextProgress);
      if (viewer.useDefaultRenderLoop !== visible) {
        viewer.useDefaultRenderLoop = visible;
        if (visible) viewer.scene.requestRender();
      }
    },
    destroy() {
      stopCamera();
      stopReady();
      stopError();
      stopImagery();
      viewer.destroy();
    },
  };
}
