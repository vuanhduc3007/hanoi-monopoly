/**
 * The 3D layer drawn over the 2D board: dice fall in the middle, then the
 * characters walk tile by tile; buildings stand on their tiles. Positions come
 * from the DOM tile rectangles, so 2D and 3D always line up.
 */
import * as THREE from 'three';
import {
  disposeObject,
  dieRotationFor,
  makeBeacon,
  makeCharacter,
  makeDie,
  makeHotel,
  makeHouse,
  makeYouMarker,
} from './models';
import { DICE_MS, easeOutBack, slotOffset, stepMs, type Step } from './path';

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

/** What happened in one server update, for choreography. */
export interface MovePlan {
  /** Dice to throw first (pieces wait for them to land). */
  dice?: number[];
  /** Per player: the steps to play, in order. */
  steps: Record<string, Step[]>;
}

interface Piece {
  view: PieceView;
  obj: THREE.Group;
  figure: THREE.Group;
  ring: THREE.Mesh;
  marker: THREE.Group | null;
  beacon: THREE.Group | null;
  tile: number;
  queue: Step[];
  stepStart: number;
  from: THREE.Vector3 | null;
  to: THREE.Vector3 | null;
}

interface Building {
  key: string;
  obj: THREE.Group;
  born: number;
}

interface Die {
  /** Outer holder: position + yaw only (keeps the result face pointing up). */
  obj: THREE.Group;
  /** Inner cube: face rotation + tumbling spin. */
  cube: THREE.Group;
  value: number;
  yaw: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  spin: THREE.Vector3;
  born: number;
}

const ELEVATION = THREE.MathUtils.degToRad(55);
const DICE_STAY_MS = 3200;
const ARREST_MS = 1500;

export class BoardScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private anchors: Anchor[] = [];
  private center = { x: 0, y: 0 };
  private width = 1;
  private height = 1;
  private unit = 40;
  private pieces = new Map<string, Piece>();
  private buildings = new Map<string, Building>();
  private lastBuildings: BuildingView[] = [];
  private dice: Die[] = [];
  /** Pieces do not start walking before this time (dice still rolling). */
  private holdUntil = 0;
  private frame = 0;
  private running = false;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private lastStep = 0;
  private youLabel: string;
  /** Called when a piece starts its arrest pause (for the 2D banner + whistle). */
  onArrest?: (playerId: string) => void;

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

  /** Canvas size, tile rectangles and board centre (CSS px, relative to the canvas). */
  resize(width: number, height: number, anchors: Anchor[], center: { x: number; y: number }): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.anchors = anchors;
    this.center = center;
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
      if (!p.queue.length) p.obj.position.copy(this.pieceGround(p.view.id, p.tile));
    }
    const keep = this.lastBuildings;
    for (const [id, b] of this.buildings) {
      this.buildings.delete(id);
      this.scene.remove(b.obj);
      disposeObject(b.obj);
    }
    this.syncBuildings(keep, false);
    this.render();
  }

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
    const here = [...this.pieces.values()].filter((p) => p.tile === tile && !p.queue.length).map((p) => p.view.id);
    if (!here.includes(id)) here.push(id);
    here.sort();
    const { dx, dy } = slotOffset(here.indexOf(id), here.length);
    return this.groundAt(a.x + dx * a.w, a.y + a.h * 0.22 + dy * a.h);
  }

  /**
   * Apply a server update. Returns how long (ms) the choreography will run,
   * so prompts can wait for the pieces to arrive.
   */
  sync(pieces: PieceView[], buildings: BuildingView[], plan: MovePlan = { steps: {} }): number {
    const now = performance.now();
    if (plan.dice?.length) {
      this.throwDice(plan.dice, now);
      this.holdUntil = now + DICE_MS;
    }
    const seen = new Set<string>();
    for (const v of pieces) {
      seen.add(v.id);
      let p = this.pieces.get(v.id);
      if (!p) {
        p = this.createPiece(v);
        this.pieces.set(v.id, p);
      }
      const roleChanged = p.view.isMe !== v.isMe || p.view.character !== v.character || p.view.color !== v.color;
      p.view = v;
      if (roleChanged) this.rebuildPiece(p);
      const planned = plan.steps[v.id];
      if (planned?.length) {
        if (!p.queue.length) p.stepStart = Math.max(now, this.holdUntil);
        p.queue.push(...planned);
      }
      // Safety net (reconnect, missed events): end where the server says.
      const end = p.queue.length ? lastTile(p.queue, p.tile) : p.tile;
      if (end !== v.position) {
        if (!p.queue.length) p.stepStart = Math.max(now, this.holdUntil);
        p.queue.push({ tile: v.position, mode: 'hop' });
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
    return this.busyFor(now);
  }

  /** Time until every piece has finished its queue. */
  private busyFor(now: number): number {
    let max = Math.max(0, this.holdUntil - now);
    for (const p of this.pieces.values()) {
      let t = Math.max(0, p.stepStart - now);
      const walks = p.queue.filter((s) => s.mode === 'walk').length;
      for (const s of p.queue) t += stepDuration(s, walks);
      max = Math.max(max, t);
    }
    return max;
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
      figure: new THREE.Group(),
      ring,
      marker: null,
      beacon: null,
      tile: v.position,
      queue: [],
      stepStart: 0,
      from: null,
      to: null,
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
    p.figure = makeCharacter(p.view.character, p.view.color);
    p.obj.add(p.figure, p.ring);
    p.marker = null;
    p.beacon = null;
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

  // ---------------------------------------------------------------- dice

  private throwDice(values: number[], now: number): void {
    for (const d of this.dice) {
      this.scene.remove(d.obj);
      disposeObject(d.obj);
    }
    this.dice = values.map((value, i) => {
      const cube = makeDie();
      const obj = new THREE.Group();
      obj.add(cube);
      const size = this.unit * 0.42;
      obj.scale.setScalar(size);
      const gap = (i - (values.length - 1) / 2) * size * 1.6;
      const to = this.groundAt(this.center.x + gap, this.center.y + this.unit * 0.25);
      to.y = size / 2;
      const from = to.clone().add(new THREE.Vector3(-size * 2 + i * size, size * 9, -size * 3));
      const spin = new THREE.Vector3(6 + Math.random() * 4, 4 + Math.random() * 4, 5 + Math.random() * 3);
      this.scene.add(obj);
      // A little yaw so the pair looks thrown, never enough to hide the top face.
      const yaw = (i === 0 ? -1 : 1) * 0.22;
      return { obj, cube, value, yaw, from, to, spin, born: now + i * 90 };
    });
  }

  private updateDice(now: number): void {
    for (const d of this.dice) {
      const t = Math.min(1, Math.max(0, (now - d.born) / (DICE_MS - 150)));
      // Fall, then two small bounces, then rest on the rolled face.
      const fall = t < 0.6 ? (t / 0.6) ** 2 : 1;
      const bounce = t < 0.6 ? 0 : Math.abs(Math.sin(((t - 0.6) / 0.4) * Math.PI * 2)) * (1 - t) * 0.9;
      d.obj.position.lerpVectors(d.from, d.to, fall);
      d.obj.position.y = d.to.y + (1 - fall) * (d.from.y - d.to.y) + bounce * d.to.y * 2;
      // Face rotation on the inner cube, yaw on the holder: composing them in one
      // Euler tilted the result face for 2 and 5 (the "lệch" dice).
      const [rx, , rz] = dieRotationFor(d.value);
      const left = 1 - Math.min(1, t / 0.85);
      d.cube.rotation.set(rx + d.spin.x * left, 0, rz + d.spin.z * left);
      d.obj.rotation.set(0, d.yaw + d.spin.y * left, 0);
      // Clear the table a while after landing so old dice never confuse the next turn.
      d.obj.visible = now - d.born < DICE_MS + DICE_STAY_MS;
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
    // tab), keep the choreography moving so pieces still arrive.
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastStep > 200) this.step();
    }, 250);
  }

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
    this.updateDice(now);
    for (const p of this.pieces.values()) {
      this.advance(p, now);
      p.ring.visible = p.view.isCurrent;
      if (p.view.isCurrent) {
        const s = 1 + Math.sin(now / 220) * 0.12;
        p.ring.scale.set(s, s, s);
      }
      if (p.marker) p.marker.position.y = 1.45 + Math.sin(now / 260) * 0.08;
      if (!p.queue.length) p.obj.rotation.y = Math.sin(now / 900 + p.view.id.length) * 0.15;
    }
    for (const b of this.buildings.values()) {
      const t = Math.min(1, (now - b.born) / 520);
      b.obj.scale.setScalar(Math.max(0.001, easeOutBack(t)));
    }
  }

  private advance(p: Piece, now: number): void {
    const s = p.queue[0];
    if (!s || now < p.stepStart) return;
    const walks = p.queue.filter((x) => x.mode === 'walk').length;
    const dur = stepDuration(s, walks);
    const t = Math.min(1, (now - p.stepStart) / dur);
    if (s.mode === 'pause') {
      if (s.arrest) this.arrestPose(p, now, t);
    } else {
      if (!p.from || !p.to) {
        p.from = p.obj.position.clone();
        p.from.y = 0;
        p.to = this.pieceGround(p.view.id, s.tile);
        p.obj.rotation.y = 0;
      }
      const hop = Math.sin(t * Math.PI) * this.unit * (s.mode === 'hop' ? 0.9 : 0.28);
      p.obj.position.lerpVectors(p.from, p.to, t);
      p.obj.position.y = hop;
    }
    if (t >= 1) {
      p.queue.shift();
      if (s.mode !== 'pause') p.tile = s.tile;
      if (s.arrest) this.endArrest(p);
      p.stepStart = now;
      p.from = null;
      p.to = null;
      if (!p.queue.length) this.settle();
    }
  }

  /** Shake + spinning red/blue beacon while CSGT blows the whistle. */
  private arrestPose(p: Piece, now: number, t: number): void {
    if (!p.beacon) {
      p.beacon = makeBeacon();
      p.beacon.position.y = 1.25;
      p.obj.add(p.beacon);
      this.onArrest?.(p.view.id);
    }
    p.beacon.rotation.y = now / 90;
    p.figure.position.x = Math.sin(now / 35) * 0.05 * (1 - t);
  }

  private endArrest(p: Piece): void {
    if (p.beacon) {
      p.obj.remove(p.beacon);
      disposeObject(p.beacon);
      p.beacon = null;
    }
    p.figure.position.x = 0;
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
    for (const d of this.dice) disposeObject(d.obj);
    this.pieces.clear();
    this.buildings.clear();
    this.renderer.dispose();
  }
}

function lastTile(queue: Step[], fallback: number): number {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].mode !== 'pause') return queue[i].tile;
  return fallback;
}

function stepDuration(s: Step, walks: number): number {
  if (s.mode === 'pause') return s.ms ?? (s.arrest ? ARREST_MS : 500);
  if (s.mode === 'hop') return 650;
  return stepMs(walks);
}
