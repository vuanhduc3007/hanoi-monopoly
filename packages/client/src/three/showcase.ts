/** A single 3D model turning on a small stage (purchase pop-up, character preview). */
import * as THREE from 'three';
import { disposeObject } from './models';

export class Showcase {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private holder = new THREE.Group();
  private frame = 0;
  private born = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6d625a, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-2, 4, 3);
    this.scene.add(sun);
    this.scene.add(this.holder);
    this.camera.position.set(0, 1.7, 3.3);
    this.camera.lookAt(0, 0.5, 0);
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Replace the model; it springs in from below and keeps turning. */
  show(model: THREE.Object3D, height = 1): void {
    for (const c of [...this.holder.children]) {
      this.holder.remove(c);
      disposeObject(c);
    }
    model.scale.setScalar(1.25 / Math.max(0.4, height));
    this.holder.add(model);
    this.born = performance.now();
  }

  start(): void {
    const tick = () => {
      this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    // Keep drawing when animation frames are throttled (hidden pane, background tab).
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastDraw > 200) this.draw();
    }, 250);
  }

  private watchdog: ReturnType<typeof setInterval> | undefined;
  private lastDraw = 0;

  private draw(): void {
    this.lastDraw = performance.now();
    const t = (this.lastDraw - this.born) / 1000;
    const rise = Math.min(1, t / 0.45);
    this.holder.position.y = (1 - rise) * -0.8 + Math.sin(t * 2.2) * 0.03;
    this.holder.rotation.y = t * 1.3;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    clearInterval(this.watchdog);
    cancelAnimationFrame(this.frame);
    for (const c of this.holder.children) disposeObject(c);
    this.renderer.dispose();
  }
}
