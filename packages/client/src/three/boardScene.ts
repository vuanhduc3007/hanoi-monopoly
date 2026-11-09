/**
 * The 3D layer drawn over the 2D board: characters and buildings stand on
 * their tiles (positions come from the DOM tile rectangles), tokens hop
 * along their path, your own piece carries a "BẠN" marker.
 */
import * as THREE from 'three';
import { disposeObject, makeCharacter, makeHotel, makeHouse, makeYouMarker } from './models';
import { easeOutBack, slotOffset, stepMs, walkPath } from './path';

export interface Anchor {
  /** Tile centre and size, in canvas CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PieceView {
  id: string;
  character: string | null;
  color: string;
  position: number;
  inJail: boolean;
  isMe: boolean;
  isCurrent: boolean;
}

export interface BuildingView {
  id: string;
  position: number;
  houses: number;
  hotel: boolean;
}

interface Piece {
  view: PieceView;
  obj: THREE.Group;
  ring: THREE.Mesh;
  marker: THREE.Group | null;
  /** Tile the piece is (logically) on. */
  tile: number;
  queue: number[];
  direct: boolean;
  stepStart: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

interface Building {
  key: string;
  obj: THREE.Group;
  born: number;
}

const ELEVATION = THREE.MathUtils.degToRad(55);

export class BoardScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private anchors: Anchor[] = [];
  private width = 1;
  private height = 1;
  private unit = 40;
  private pieces = new Map<string, Piece>();
  private buildings = new Map<string, Building>();
  private frame = 0;
  private running = false;
  private youLabel: string;

  constructor(canvas: HTMLCanvasElement, youLabel: string) {
    this.youLabel = youLabel;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6d625a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-300, 900, 600);
    this.scene.add(sun);
  }

  /** Canvas size and tile rectangles (CSS px, relative to the canvas). */
  resize(width: number, height: number, anchors: Anchor[]): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.anchors = anchors;
    this.renderer.setSize(this.width, this.height, false);
    const c = this.camera;
    c.left = -this.width / 2;
    c.right = this.width / 2;
    c.top = this.height / 2;
    c.bottom = -this.height / 2;
    c.position.set(0, Math.sin(ELEVATION) * 1000, Math.cos(ELEVATION) * 1000);
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    const side = anchors.length ? Math.min(...anchors.map((a) => Math.min(a.w, a.h))) : 40;
    // World height h projects to h·cos(elevation) px on screen.
    this.unit = side / Math.cos(ELEVATION);
    for (const p of this.pieces.values()) {
      p.obj.scale.setScalar(this.pieceScale(p.view));
      p.obj.position.copy(this.pieceGround(p.view.id, p.tile));
    }
    // Rebuild buildings at the new size, without the pop-up animation.
    const keep = this.lastBuildings;
    for (const [id, b] of this.buildings) {
      this.buildings.delete(id);
      this.scene.remove(b.obj);
      disposeObject(b.obj);
    }
    this.syncBuildings(keep, false);
    this.render();
  }

  private lastBuildings: BuildingView[] = [];

  /** Screen point (canvas px) → point on the ground plane. */
  private groundAt(px: number, py: number): THREE.Vector3 {
    const ndc = new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.ground, out);
    return out;
  }

  private pieceScale(v: PieceView): number {
    return this.unit * (v.isMe ? 0.54 : 0.44);
  }

  /** Where a piece stands on a tile, shifted when several share it. */
  private pieceGround(id: string, tile: number): THREE.Vector3 {
    const a = this.anchors[tile];
    if (!a) return new THREE.Vector3();
    const here = [...this.pieces.values()].filter((p) => p.tile === tile).map((p) => p.view.id).sort();
    const i = Math.max(0, here.indexOf(id));
    const { dx, dy } = slotOffset(i, here.length);
    return this.groundAt(a.x + dx * a.w, a.y + a.h * 0.22 + dy * a.h);
  }

  sync(pieces: PieceView[], buildings: BuildingView[]): void {
    const seen = new Set<string>();
    for (const v of pieces) {
      seen.add(v.id);
      let p = this.pieces.get(v.id);
      if (!p) {
        p = this.createPiece(v);
        this.pieces.set(v.id, p);
      }
      const roleChanged = p.view.isMe !== v.isMe || p.view.character !== v.character || p.view.color !== v.color;
      const target = p.queue.length ? p.queue[p.queue.length - 1] : p.tile;
      const jumped = v.inJail && !p.view.inJail;
      p.view = v;
      if (roleChanged) this.rebuildPiece(p);
      if (v.position !== target) {
        const { tiles, direct } = walkPath(target, v.position, jumped);
        if (!p.queue.length) p.stepStart = performance.now();
        p.queue.push(...tiles);
        p.direct = direct;
      }
    }
    for (const [id, p] of this.pieces) {
      if (!seen.has(id)) {
        this.scene.remove(p.obj);
        disposeObject(p.obj);
        this.pieces.delete(id);
      }
    }
    this.syncBuildings(buildings);
    this.start();
  }

  private createPiece(v: PieceView): Piece {
    const obj = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xe3a72f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    const p: Piece = {
      view: v,
      obj,
      ring,
      marker: null,
      tile: v.position,
      queue: [],
      direct: false,
      stepStart: 0,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
    };
    this.rebuildPiece(p);
    this.scene.add(obj);
    obj.position.copy(this.pieceGround(v.id, v.position));
    return p;
  }

  private rebuildPiece(p: Piece): void {
    for (const c of [...p.obj.children]) {
      p.obj.remove(c);
      if (c !== p.ring) disposeObject(c);
    }
    p.obj.add(makeCharacter(p.view.character, p.view.color));
    p.obj.add(p.ring);
    p.marker = null;
    if (p.view.isMe) {
      const m = makeYouMarker(p.view.color);
      m.position.y = 1.45;
      m.add(this.label(this.youLabel, p.view.color));
      p.marker = m;
      p.obj.add(m);
    }
    p.obj.scale.setScalar(this.pieceScale(p.view));
  }

  private label(text: string, color: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.strokeStyle = '#2B2522';
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(8, 8, 240, 80, 24);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = "700 52px 'Be Vietnam Pro', system-ui, sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 50);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sprite.scale.set(0.9, 0.34, 1);
    sprite.position.y = 0.42;
    sprite.renderOrder = 10;
    return sprite;
  }

  private syncBuildings(list: BuildingView[], animate = true): void {
    this.lastBuildings = list;
    const want = new Map(list.map((b) => [b.id, b]));
    for (const [id, b] of this.buildings) {
      const v = want.get(id);
      if (!v || `${v.houses}:${v.hotel}` !== b.key) {
        this.scene.remove(b.obj);
        disposeObject(b.obj);
        this.buildings.delete(id);
      }
    }
    for (const v of list) {
      if (this.buildings.has(v.id) || (!v.hotel && v.houses === 0)) continue;
      const a = this.anchors[v.position];
      if (!a) continue;
      const group = new THREE.Group();
      const count = v.hotel ? 1 : v.houses;
      for (let i = 0; i < count; i++) {
        const m = v.hotel ? makeHotel() : makeHouse();
        const spread = count > 1 ? (i - (count - 1) / 2) * (a.w * 0.2) : 0;
        m.position.copy(this.groundAt(a.x + spread, a.y - a.h * 0.18));
        m.scale.setScalar(this.unit * (v.hotel ? 0.42 : 0.34));
        group.add(m);
      }
      this.scene.add(group);
      this.buildings.set(v.id, { key: `${v.houses}:${v.hotel}`, obj: group, born: animate ? performance.now() : -1e9 });
    }
  }

  // ---------------------------------------------------------------- loop

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.step();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    // Watchdog: if animation frames are throttled (hidden pane, background
    // tab), keep the game state moving at a low rate so pieces still arrive.
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastStep > 200) this.step();
    }, 250);
  }

  private watchdog: ReturnType<typeof setInterval> | undefined;
  private lastStep = 0;

  private step(): void {
    this.lastStep = performance.now();
    this.update(this.lastStep);
    this.render();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    clearInterval(this.watchdog);
  }

  private update(now: number): void {
    for (const p of this.pieces.values()) {
      // Walk / hop along the queued tiles.
      if (p.queue.length) {
        const dur = p.direct ? 650 : stepMs(p.queue.length + 1);
        if (p.from.lengthSq() === 0 && p.to.lengthSq() === 0) {
          p.from.copy(p.obj.position);
          p.to.copy(this.pieceGround(p.view.id, p.queue[0]));
        }
        const t = Math.min(1, (now - p.stepStart) / dur);
        const hop = Math.sin(t * Math.PI) * this.unit * (p.direct ? 0.9 : 0.28);
        p.obj.position.lerpVectors(p.from, p.to, t);
        p.obj.position.y = hop;
        if (t >= 1) {
          p.tile = p.queue.shift()!;
          p.stepStart = now;
          p.from.set(0, 0, 0);
          p.to.set(0, 0, 0);
          if (!p.queue.length) {
            p.direct = false;
            this.settle();
          }
        }
      }
      // Current player: pulsing gold ring. Others: no ring.
      p.ring.visible = p.view.isCurrent;
      if (p.view.isCurrent) {
        const s = 1 + Math.sin(now / 220) * 0.12;
        p.ring.scale.set(s, s, s);
      }
      if (p.marker) p.marker.position.y = 1.45 + Math.sin(now / 260) * 0.08;
      p.obj.rotation.y = p.queue.length ? 0 : Math.sin(now / 900 + p.view.id.length) * 0.15;
    }
    for (const b of this.buildings.values()) {
      const t = Math.min(1, (now - b.born) / 520);
      b.obj.scale.setScalar(Math.max(0.001, easeOutBack(t)));
    }
  }

  /** Re-spread pieces once nobody is moving (shared tiles). */
  private settle(): void {
    if ([...this.pieces.values()].some((p) => p.queue.length)) return;
    for (const p of this.pieces.values()) p.obj.position.copy(this.pieceGround(p.view.id, p.tile));
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    for (const p of this.pieces.values()) disposeObject(p.obj);
    for (const b of this.buildings.values()) disposeObject(b.obj);
    this.pieces.clear();
    this.buildings.clear();
    this.renderer.dispose();
  }
}
