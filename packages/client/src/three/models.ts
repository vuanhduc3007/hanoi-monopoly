/**
 * Low-poly 3D models built from primitives: toon shading + an ink outline
 * (inverted hull) to match the Đông Hồ woodcut look of the 2D board.
 * Units: a model is about 1 unit tall; callers scale it to the tile size.
 */
import * as THREE from 'three';

export const COLORS = {
  ink: 0x2b2522,
  paper: 0xf3e9d2,
  red: 0xb8312f,
  gold: 0xe3a72f,
  indigo: 0x2e4a7d,
  green: 0x5f7f3a,
  brown: 0x8a5a3b,
  pink: 0xe7a6a1,
  skin: 0xf1c9a0,
  sky: 0x8fb3c9,
  purple: 0x5b3a6e,
};

let gradient: THREE.DataTexture | null = null;
/** Three-step light ramp: flat, print-like shading. */
function toonRamp(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ink, side: THREE.BackSide });

export function toon(color: number | string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
}

/** Mesh + slightly larger back-faced black copy = ink outline. */
export function inked(geometry: THREE.BufferGeometry, color: number | string, thickness = 0.06): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geometry, toon(color));
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.setScalar(1 + thickness);
  g.add(outline, body);
  return g;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

// ---------------------------------------------------------------- characters

type Accessory = (head: THREE.Vector3) => THREE.Object3D[];

const ACCESSORIES: Record<string, Accessory> = {
  // Thiếu gia Vin: gold crown.
  C01: (h) => {
    const crown = new THREE.Group();
    crown.add(inked(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 10), COLORS.gold));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      crown.add(at(inked(new THREE.ConeGeometry(0.045, 0.12, 4), COLORS.gold), Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14));
    }
    return [at(crown, h.x, h.y + 0.17, h.z)];
  },
  // Ninja Lead: red helmet + black face mask.
  C02: (h) => [
    at(inked(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.red), h.x, h.y + 0.01, h.z),
    at(inked(new THREE.BoxGeometry(0.26, 0.09, 0.08), COLORS.ink), h.x, h.y - 0.07, h.z + 0.15),
  ],
  // Tài xế Grab: green helmet.
  C03: (h) => [at(inked(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.green), h.x, h.y + 0.01, h.z)],
  // Idol TikTok: phone held up.
  C04: (h) => [
    at(inked(new THREE.BoxGeometry(0.1, 0.18, 0.025), COLORS.ink), h.x + 0.24, h.y - 0.05, h.z + 0.08),
    at(inked(new THREE.SphereGeometry(0.035, 8, 6), COLORS.red), h.x + 0.24, h.y + 0.1, h.z + 0.08),
  ],
  // Cò đất: flag on a pole.
  C05: (h) => {
    const flag = new THREE.Group();
    flag.add(at(inked(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), COLORS.brown), 0, 0, 0));
    flag.add(at(inked(new THREE.BoxGeometry(0.18, 0.11, 0.015), COLORS.red), 0.09, 0.18, 0));
    return [at(flag, h.x + 0.24, h.y - 0.05, h.z)];
  },
  // Nghiện Tarot: pointed purple hat with a gold star.
  C06: (h) => [
    at(inked(new THREE.ConeGeometry(0.17, 0.32, 10), COLORS.purple), h.x, h.y + 0.26, h.z),
    at(inked(new THREE.OctahedronGeometry(0.05), COLORS.gold), h.x, h.y + 0.45, h.z),
  ],
  // SVBK: mortarboard.
  C07: (h) => [
    at(inked(new THREE.BoxGeometry(0.34, 0.03, 0.34), COLORS.ink), h.x, h.y + 0.19, h.z),
    at(inked(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), COLORS.ink), h.x, h.y + 0.14, h.z),
    at(inked(new THREE.SphereGeometry(0.03, 6, 4), COLORS.gold), h.x + 0.15, h.y + 0.12, h.z + 0.1),
  ],
  // Nô lệ tư bản: briefcase + red tie.
  C08: (h) => [
    at(inked(new THREE.BoxGeometry(0.2, 0.14, 0.07), COLORS.brown), h.x + 0.24, h.y - 0.33, h.z + 0.02),
    at(inked(new THREE.ConeGeometry(0.035, 0.16, 4), COLORS.red), h.x, h.y - 0.25, h.z + 0.15),
  ],
};

const BODY_COLORS: Record<string, number> = {
  C01: COLORS.gold,
  C02: COLORS.indigo,
  C03: COLORS.green,
  C04: COLORS.pink,
  C05: COLORS.brown,
  C06: COLORS.purple,
  C07: COLORS.red,
  C08: COLORS.sky,
};

export const CHARACTER_MODEL_IDS = Object.keys(ACCESSORIES);

/**
 * A pawn-like figure: player-coloured base ring, robe in the character's
 * colour, head, and the character's accessory. Origin at the feet.
 */
export function makeCharacter(character: string | null, playerColor: string): THREE.Group {
  const g = new THREE.Group();
  g.name = `character:${character ?? 'none'}`;
  g.add(at(inked(new THREE.CylinderGeometry(0.34, 0.38, 0.08, 20), playerColor, 0.04), 0, 0.04, 0));
  const robe = character ? (BODY_COLORS[character] ?? COLORS.paper) : playerColor;
  g.add(at(inked(new THREE.CylinderGeometry(0.13, 0.27, 0.5, 14), robe), 0, 0.33, 0));
  g.add(at(inked(new THREE.SphereGeometry(0.11, 10, 8), robe), 0, 0.6, 0)); // shoulders
  const head = new THREE.Vector3(0, 0.8, 0);
  g.add(at(inked(new THREE.SphereGeometry(0.17, 16, 12), COLORS.skin), head.x, head.y, head.z));
  // Eyes face +z (towards the tilted camera).
  for (const x of [-0.06, 0.06]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), toon(COLORS.ink)), x, head.y + 0.01, head.z + 0.155));
  const acc = character ? ACCESSORIES[character] : undefined;
  if (acc) g.add(...acc(head));
  return g;
}

// ---------------------------------------------------------------- buildings

function gableRoof(width: number, depth: number, height: number, color: number): THREE.Group {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 - 0.04, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2 + 0.04, 0);
  shape.lineTo(-width / 2 - 0.04, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth + 0.08, bevelEnabled: false });
  geo.translate(0, 0, -(depth + 0.08) / 2);
  return inked(geo, color, 0.04);
}

/** Nhà ống mái ngói: narrow tall house with a red tiled gable roof. Origin at the base. */
export function makeHouse(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'house';
  g.add(at(inked(new THREE.BoxGeometry(0.32, 0.5, 0.4), COLORS.paper), 0, 0.25, 0));
  g.add(at(gableRoof(0.32, 0.4, 0.2, COLORS.red), 0, 0.5, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.17, 0.01), toon(COLORS.brown)), 0, 0.085, 0.205));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.01), toon(COLORS.sky)), 0, 0.33, 0.205));
  return g;
}

/** Tòa cao tầng: indigo tower with gold window bands and a red cap. */
export function makeHotel(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hotel';
  g.add(at(inked(new THREE.BoxGeometry(0.46, 1.1, 0.46), COLORS.indigo), 0, 0.55, 0));
  for (let i = 0; i < 4; i++) {
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.05, 0.47), toon(COLORS.gold)), 0, 0.22 + i * 0.22, 0));
  }
  g.add(at(inked(new THREE.ConeGeometry(0.36, 0.22, 4), COLORS.red), 0, 1.21, 0));
  g.children[g.children.length - 1].rotation.y = Math.PI / 4;
  return g;
}

/** A purchase: green plot with a little fence, a tube house and a flag in the buyer's colour. */
export function makeDeed(color: string): THREE.Group {
  const g = new THREE.Group();
  g.name = 'deed';
  g.add(at(inked(new THREE.BoxGeometry(1.1, 0.08, 0.8), COLORS.green, 0.03), 0, 0.04, 0));
  for (let i = 0; i < 6; i++) {
    const x = -0.5 + i * 0.2;
    g.add(at(inked(new THREE.BoxGeometry(0.04, 0.14, 0.04), COLORS.paper, 0.1), x, 0.15, 0.36));
  }
  g.add(at(inked(new THREE.BoxGeometry(1.0, 0.03, 0.03), COLORS.paper, 0.1), 0, 0.17, 0.36));
  const house = makeHouse();
  house.scale.setScalar(1.35);
  house.position.set(-0.12, 0.08, -0.05);
  g.add(house);
  g.add(at(inked(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), COLORS.brown), 0.38, 0.53, 0.05));
  g.add(at(inked(new THREE.BoxGeometry(0.32, 0.2, 0.02), color), 0.55, 0.86, 0.05));
  return g;
}

/** "Bạn" marker: a downward arrow that floats above your own piece. */
export function makeYouMarker(color: string): THREE.Group {
  const g = new THREE.Group();
  g.name = 'you-marker';
  const cone = inked(new THREE.ConeGeometry(0.16, 0.3, 4), color, 0.08);
  cone.rotation.x = Math.PI;
  g.add(cone);
  return g;
}

export function disposeObject(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x !== outlineMaterial && x.dispose());
    else if (mat && mat !== outlineMaterial) mat.dispose();
  });
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- dice

/** Face values in three.js BoxGeometry material order (+x, -x, +y, -y, +z, -z); opposite faces sum to 7. */
export const DIE_FACES = [3, 4, 1, 6, 2, 5];

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

function dieFace(value: number): THREE.Material {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g = c?.getContext('2d');
  if (!c || !g) return toon(COLORS.paper);
  c.width = c.height = 128;
  g.fillStyle = '#fffaf0';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#2B2522';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  for (const [x, y] of PIPS[value]) {
    g.fillStyle = value === 1 ? '#B8312F' : '#2B2522';
    g.beginPath();
    g.arc(x * 128, y * 128, value === 1 ? 17 : 12, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: toonRamp() });
}

/** A die (1 unit cube) with pip faces and an ink outline. */
export function makeDie(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'die';
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const outline = new THREE.Mesh(geo, outlineMaterial);
  outline.scale.setScalar(1.08);
  g.add(outline, new THREE.Mesh(geo, DIE_FACES.map(dieFace)));
  return g;
}

/** Euler rotation that puts `value` on top (+y). */
export function dieRotationFor(value: number): [number, number, number] {
  switch (value) {
    case 6:
      return [Math.PI, 0, 0];
    case 2:
      return [-Math.PI / 2, 0, 0];
    case 5:
      return [Math.PI / 2, 0, 0];
    case 3:
      return [0, 0, Math.PI / 2];
    case 4:
      return [0, 0, -Math.PI / 2];
    default:
      return [0, 0, 0];
  }
}

/** Police beacon (đèn còi): red and blue halves, spun while a piece is arrested. */
export function makeBeacon(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'beacon';
  const red = at(inked(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI), COLORS.red), 0, 0, 0);
  const blue = at(inked(new THREE.SphereGeometry(0.16, 12, 8, Math.PI, Math.PI), 0x2f6fd6), 0, 0, 0);
  g.add(red, blue);
  g.add(at(inked(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 12), COLORS.ink), 0, -0.07, 0));
  return g;
}
