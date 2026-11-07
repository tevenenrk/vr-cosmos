// =====================================================================
//  UKŁAD SŁONECZNY VR  –  WebXR (Meta Quest 3 / 3S, Meta Quest Browser)
//  Etap 1: Tryb 1 (model całego układu do orbity Plutona)
// =====================================================================
//
//  Wszystkie ustawienia, które warto zmieniać, są w sekcji KONFIGURACJA
//  poniżej. Reszta pliku to logika aplikacji.
//
// =====================================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/VRButton.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';

// =====================================================================
//  KONFIGURACJA
// =====================================================================

// --- Tryb 1: model układu -------------------------------------------
const SYSTEM_DIAMETER_M = 5.0;                 // średnica orbity Plutona przy skali 1 [m]
const SYSTEM_START_POSITION = [0, 1.0, -3.2];  // środek układu (Słońce) na starcie [m] (x, y, z)
const SYSTEM_SCALE_MIN = 0.03;                 // 0.03 × 5 m = 15 cm  ("trzymam w dłoni")
const SYSTEM_SCALE_MAX = 500;                  // 500 × 5 m = 2,5 km ("stoję w środku")
const USE_REAL_POSITIONS = true;               // true = planety w przybliżonych pozycjach na dziś
const TIME_SPEED_DAYS_PER_SEC = 0;             // prędkość czasu: 0 = model statyczny (wymaganie);
                                               // np. 30 = 30 dni na sekundę (planety krążą)

// --- Markery i bryły --------------------------------------------------
const MARKER_SIZE_PX = 10;          // rozmiar świecącej kropki-markera [piksele]
const SUN_MARKER_SIZE_PX = 16;      // marker Słońca [piksele]
const BODY_SWITCH_PX = 1;           // gdy prawdziwa bryła ma więcej niż tyle pikseli -> rysuj bryłę zamiast markera
const SPHERE_SEGMENTS_W = 32;       // liczba segmentów sfery (poziomo) – mało = szybko
const SPHERE_SEGMENTS_H = 16;       // liczba segmentów sfery (pionowo)
const ORBIT_SEGMENTS = 720;         // liczba odcinków linii jednej orbity
const ORBIT_OPACITY = 0.45;         // przezroczystość linii orbit (0..1)

// --- Etykiety ---------------------------------------------------------
const LABEL_ANGLE_DEG = 1.4;              // wysokość etykiety jako kąt widzenia [stopnie] (stała czytelność)
const LABEL_MIN_SEPARATION_DEG = 2.5;     // ukryj etykietę, jeśli ciało jest bliżej (kątowo) niż tyle od innego z etykietą
const LABEL_FONT = 'bold 64px system-ui, "Segoe UI", Roboto, sans-serif';

// --- Menu (panel w VR) ------------------------------------------------
const MENU_WIDTH_M = 0.42;          // szerokość panelu [m]
const MENU_DISTANCE_M = 0.6;        // odległość panelu od oczu [m]
const MENU_HEIGHT_OFFSET_M = -0.28; // panel niżej niż oczy [m]
const MENU_MAX_DISTANCE_M = 2.5;    // gdy odejdziesz dalej, panel sam wraca przed Ciebie [m]
const RAY_LENGTH_M = 0.6;           // długość promienia kontrolera [m]

// --- Przyciski kontrolerów (indeksy w gamepad.buttons, standard "xr-standard") ---
//  0 = spust (trigger), 1 = grip (ściśnięcie), 3 = wciśnięcie gałki,
//  4 = A (prawy) / X (lewy), 5 = B (prawy) / Y (lewy)
const MENU_SUMMON_BUTTON = 5;       // Y na lewym kontrolerze -> menu przed oczy
const KNIFE_BUTTON = 4;             // A na prawym kontrolerze -> nóż (Tryb 2, w następnym etapie)
const RESET_BUTTON = 5;             // B na prawym kontrolerze -> sklej planetę (Tryb 2, w następnym etapie)

// --- Wygląd -----------------------------------------------------------
const COLOR_BACKGROUND = 0x000006;
const COLOR_RAY = 0x88ccff;
const COLOR_MENU_BG = 'rgba(12, 18, 36, 0.88)';
const COLOR_MENU_BUTTON = '#2a3b6b';
const COLOR_MENU_BUTTON_HOVER = '#4a6bc4';
const COLOR_MENU_BUTTON_ACTIVE = '#d08a1e';
const COLOR_MENU_BUTTON_DISABLED = '#2b2f3a';
const STAR_COUNT = 2500;            // liczba gwiazd w tle
const AMBIENT_LIGHT = 0.18;         // światło otoczenia (żeby nocna strona nie była czarna)
const SUN_LIGHT = 3.0;              // światło Słońca padające na planety

// --- Wydajność / renderowanie -----------------------------------------
const TARGET_FPS = 72;              // docelowa częstotliwość Questa
const FRAMEBUFFER_SCALE = 1.0;      // 1.0 = natywna rozdzielczość; mniej = szybciej, ale mniej ostro
const FOVEATION = 1.0;              // 0..1, renderowanie brzegów obrazu w niższej rozdzielczości
const CAMERA_NEAR = 0.01;           // [m]
const CAMERA_FAR = 100000;          // [m]  (logarithmicDepthBuffer radzi sobie z dużym zakresem)

// --- Tekstury ---------------------------------------------------------
const TEXTURE_PATH = 'textures/';   // folder z teksturami (patrz textures/README.md)

// --- Dane ciał niebieskich (wartości rzeczywiste) ----------------------
//  radiusKm  – promień równikowy [km]
//  au        – średnia odległość od Słońca [j.a.]
//  periodDays– okres obiegu [dni]
//  L0        – średnia długość ekliptyczna w epoce J2000 [stopnie] (do pozycji "na dziś")
//  tilt      – nachylenie osi obrotu [stopnie]
//  type      – 'star' | 'rocky' | 'gas' | 'ice' (wpływa na zastępczą teksturę)
const BODIES = [
  { id: 'sun',     name: 'Słońce',  radiusKm: 696340, au: 0,      periodDays: 0,      L0: 0,      tilt: 7.25,  color: 0xffcc44, type: 'star',  texture: '2k_sun.jpg' },
  { id: 'mercury', name: 'Merkury', radiusKm: 2439.7, au: 0.387,  periodDays: 87.969, L0: 252.25, tilt: 0.03,  color: 0xa8a29a, type: 'rocky', texture: '2k_mercury.jpg' },
  { id: 'venus',   name: 'Wenus',   radiusKm: 6051.8, au: 0.723,  periodDays: 224.70, L0: 181.98, tilt: 177.4, color: 0xe8c47c, type: 'rocky', texture: '2k_venus_atmosphere.jpg' },
  { id: 'earth',   name: 'Ziemia',  radiusKm: 6371.0, au: 1.000,  periodDays: 365.26, L0: 100.46, tilt: 23.44, color: 0x3d7fe0, type: 'rocky', texture: '2k_earth_daymap.jpg' },
  { id: 'mars',    name: 'Mars',    radiusKm: 3389.5, au: 1.524,  periodDays: 686.98, L0: 355.45, tilt: 25.19, color: 0xd0562a, type: 'rocky', texture: '2k_mars.jpg' },
  { id: 'jupiter', name: 'Jowisz',  radiusKm: 69911,  au: 5.203,  periodDays: 4332.6, L0: 34.40,  tilt: 3.13,  color: 0xd9b98c, type: 'gas',   texture: '2k_jupiter.jpg' },
  { id: 'saturn',  name: 'Saturn',  radiusKm: 58232,  au: 9.537,  periodDays: 10759,  L0: 49.94,  tilt: 26.73, color: 0xe6d29a, type: 'gas',   texture: '2k_saturn.jpg',
    ring: { innerKm: 74500, outerKm: 140220, texture: '2k_saturn_ring_alpha.png' } },
  { id: 'uranus',  name: 'Uran',    radiusKm: 25362,  au: 19.19,  periodDays: 30688,  L0: 313.23, tilt: 97.77, color: 0x9fdbe6, type: 'ice',   texture: '2k_uranus.jpg' },
  { id: 'neptune', name: 'Neptun',  radiusKm: 24622,  au: 30.07,  periodDays: 60182,  L0: 304.88, tilt: 28.32, color: 0x4a6fe0, type: 'ice',   texture: '2k_neptune.jpg' },
  { id: 'pluto',   name: 'Pluton',  radiusKm: 1188.3, au: 39.48,  periodDays: 90560,  L0: 238.93, tilt: 122.5, color: 0xd2bfa4, type: 'rocky', texture: '2k_pluto.jpg' },
];

// =====================================================================
//  KONIEC KONFIGURACJI
// =====================================================================

window.__solarStarted = true;

// ---------------------------------------------------------------------
//  Jednostki: 1 jednostka w grupie układu = 1 metr przy skali grupy = 1
// ---------------------------------------------------------------------
const KM_PER_AU = 149597870.7;
const PLUTO_AU = BODIES.find(b => b.id === 'pluto').au;
const M_PER_AU = (SYSTEM_DIAMETER_M / 2) / PLUTO_AU;     // ile metrów modelu na 1 j.a.
const kmToUnits = km => (km / KM_PER_AU) * M_PER_AU;
const DEG = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

// Wspólne obiekty pomocnicze (bez tworzenia nowych w każdej klatce = mniej pracy dla GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// =====================================================================
//  RENDERER, SCENA, KAMERA
// =====================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;               // brak cieni (wydajność)
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor(FRAMEBUFFER_SCALE);
renderer.xr.setFoveation(FOVEATION);
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOR_BACKGROUND);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(0, 1.7, 0.8);

// Sterowanie myszą – tylko podgląd na PC (w VR wyłączone)
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.target.set(...SYSTEM_START_POSITION);
orbitControls.enableDamping = true;
orbitControls.update();

scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================================================================
//  TEKSTURY POMOCNICZE (generowane w kodzie)
// =====================================================================

// Prosty generator liczb losowych z ziarnem – placeholdery wyglądają zawsze tak samo
function seededRandom(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return function () {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cssColor(color, mul = 1) {
  const c = new THREE.Color(color);
  return `rgb(${Math.min(255, c.r * 255 * mul) | 0},${Math.min(255, c.g * 255 * mul) | 0},${Math.min(255, c.b * 255 * mul) | 0})`;
}

// Zastępcza tekstura planety (gdy brak pliku w folderze textures/)
function makePlaceholderTexture(body) {
  const w = 256, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom(body.id);

  if (body.type === 'gas' || body.type === 'ice' || body.type === 'star') {
    // Poziome pasy (gazowe olbrzymy) lub ziarnistość (Słońce)
    const bandH = body.type === 'ice' ? 8 : 4;
    for (let y = 0; y < h; y += bandH) {
      const k = body.type === 'ice' ? 0.92 + rnd() * 0.12 : 0.75 + rnd() * 0.45;
      ctx.fillStyle = cssColor(body.color, k);
      ctx.fillRect(0, y, w, bandH);
    }
    if (body.type === 'star') {
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(255,${(150 + rnd() * 100) | 0},0,${0.15 + rnd() * 0.25})`;
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (body.id === 'jupiter') {          // Wielka Czerwona Plama
      ctx.fillStyle = 'rgba(190,90,60,0.85)';
      ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.62, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (body.id === 'earth') {
    ctx.fillStyle = '#1f4fa8'; ctx.fillRect(0, 0, w, h);                       // oceany
    for (let i = 0; i < 35; i++) {                                            // kontynenty
      ctx.fillStyle = rnd() < 0.6 ? '#3f7d3a' : '#9b8a5a';
      ctx.beginPath(); ctx.ellipse(rnd() * w, h * 0.2 + rnd() * h * 0.6, 6 + rnd() * 22, 4 + rnd() * 14, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f2f6ff'; ctx.fillRect(0, 0, w, 9); ctx.fillRect(0, h - 9, w, 9);   // czapy polarne
  } else {
    // Planety skaliste: plamy i kratery
    ctx.fillStyle = cssColor(body.color); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = cssColor(body.color, 0.7 + rnd() * 0.5);
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Zastępcza tekstura pierścieni Saturna (pasek: lewo = wewnętrzna krawędź, prawo = zewnętrzna)
function makePlaceholderRingTexture() {
  const w = 512, h = 4;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom('ring');
  for (let x = 0; x < w; x++) {
    const f = x / w;
    let a = 0.35 + rnd() * 0.35;
    if (f < 0.12) a *= 0.35;                  // słaby pierścień C
    if (f > 0.655 && f < 0.725) a = 0.05;     // przerwa Cassiniego
    const shade = 180 + rnd() * 50;
    ctx.fillStyle = `rgba(${shade | 0},${(shade * 0.92) | 0},${(shade * 0.78) | 0},${a})`;
    ctx.fillRect(x, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Miękka świecąca kropka dla markerów
function makeGlowTexture() {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

// Ładuje prawdziwą teksturę z pliku; jeśli pliku nie ma – zostaje placeholder
const textureLoader = new THREE.TextureLoader();
function loadTextureInto(material, fileName) {
  textureLoader.load(
    TEXTURE_PATH + fileName,
    tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const old = material.map;
      material.map = tex;
      material.needsUpdate = true;
      if (old) old.dispose();
    },
    undefined,
    () => console.info(`[tekstury] Brak pliku ${TEXTURE_PATH}${fileName} – używam zastępczej tekstury.`)
  );
}

// Etykieta (billboard) z tekstem
function makeLabel(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = LABEL_FONT;
  const padX = 24, h = 96;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  canvas.width = w; canvas.height = h;
  ctx.font = LABEL_FONT;                          // po zmianie rozmiaru canvas trzeba ustawić font ponownie
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  roundRect(ctx, 0, 0, w, h, 26); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, h / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 0);                      // zaczepienie w środku dolnej krawędzi
  sprite.userData.aspect = w / h;
  sprite.renderOrder = 10;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// =====================================================================
//  GWIAZDY W TLE
// =====================================================================
const stars = (() => {
  const R = 800;
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const rnd = seededRandom('stars');
  for (let i = 0; i < STAR_COUNT; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(th) * R, u * R, r * Math.sin(th) * R], i * 3);
    const b = 0.25 + rnd() * 0.75;
    col.set([b, b, b * (0.85 + rnd() * 0.3)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true, depthTest: false, depthWrite: false,
  }));
  p.renderOrder = -100;           // rysowane jako pierwsze, wszystko inne je zasłania
  p.frustumCulled = false;
  scene.add(p);
  return p;
})();

// =====================================================================
//  TRYB 1: MODEL UKŁADU SŁONECZNEGO
// =====================================================================
const systemGroup = new THREE.Group();
systemGroup.name = 'UkladSloneczny';
scene.add(systemGroup);

const sunLight = new THREE.PointLight(0xffffff, SUN_LIGHT, 0, 0);   // decay 0 = bez zaniku z odległością
systemGroup.add(sunLight);

const sphereGeometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS_W, SPHERE_SEGMENTS_H);
const markerGeometry = new THREE.BufferGeometry();
markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
const glowTexture = makeGlowTexture();

// Kąt orbity (radiany) dla danej liczby dni od J2000
function orbitAngle(body, daysSinceJ2000) {
  if (!USE_REAL_POSITIONS) return BODIES.indexOf(body) * 2.4;      // równomierny "wachlarz"
  return (body.L0 + 360 * daysSinceJ2000 / body.periodDays) * DEG;
}

function setOrbitPosition(body, angle, snapToOrbitLine) {
  if (snapToOrbitLine) {
    // Ustaw planetę dokładnie na wierzchołku linii orbity (wtedy przy dużym
    // powiększeniu planeta leży idealnie na narysowanej linii).
    const step = (Math.PI * 2) / ORBIT_SEGMENTS;
    angle = Math.round(angle / step) * step;
  }
  const r = body.au * M_PER_AU;
  body.localPos.set(Math.cos(angle) * r, 0, -Math.sin(angle) * r);
  body.mesh.position.copy(body.localPos);
  body.marker.position.copy(body.localPos);
}

const bodies = BODIES.map(def => {
  const body = { ...def, localPos: new THREE.Vector3(), worldPos: new THREE.Vector3(), dir: new THREE.Vector3() };
  body.radiusUnits = kmToUnits(def.radiusKm);

  // Bryła z teksturą
  const placeholder = makePlaceholderTexture(def);
  const material = def.type === 'star'
    ? new THREE.MeshBasicMaterial({ map: placeholder })              // Słońce świeci samo
    : new THREE.MeshLambertMaterial({ map: placeholder });           // planety oświetlone przez Słońce
  loadTextureInto(material, def.texture);
  body.mesh = new THREE.Mesh(sphereGeometry, material);
  body.mesh.scale.setScalar(body.radiusUnits);
  body.mesh.rotation.z = def.tilt * DEG;
  body.mesh.visible = false;
  systemGroup.add(body.mesh);

  // Pierścienie (Saturn) – w jednostkach promienia planety, bo są dzieckiem bryły
  if (def.ring) {
    const inner = def.ring.innerKm / def.radiusKm, outer = def.ring.outerKm / def.radiusKm;
    const g = new THREE.RingGeometry(inner, outer, 96, 1);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {                 // UV: u = odległość od środka (pasek tekstury)
      const r = Math.hypot(p.getX(i), p.getY(i));
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    const ringMat = new THREE.MeshLambertMaterial({
      map: makePlaceholderRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    loadTextureInto(ringMat, def.ring.texture);
    const ring = new THREE.Mesh(g, ringMat);
    ring.rotation.x = -Math.PI / 2;
    body.mesh.add(ring);
  }

  // Marker: świecąca kropka o stałym rozmiarze w pikselach
  body.marker = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
    color: def.color,
    size: def.type === 'star' ? SUN_MARKER_SIZE_PX : MARKER_SIZE_PX,
    sizeAttenuation: false,
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  body.marker.frustumCulled = false;
  body.marker.renderOrder = 5;
  systemGroup.add(body.marker);

  // Orbita: cienka linia (okrąg w płaszczyźnie ekliptyki)
  if (def.au > 0) {
    const r = def.au * M_PER_AU;
    const pts = [];
    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const a = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r));
    }
    body.orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: ORBIT_OPACITY, depthWrite: false }),
    );
    systemGroup.add(body.orbit);
  }

  // Etykieta – w scenie (nie w grupie), żeby skala grupy jej nie zmieniała
  body.label = makeLabel(def.name);
  scene.add(body.label);
  return body;
});

// Kolejność ważności etykiet przy nakładaniu: Słońce, potem od zewnętrznych do wewnętrznych
const labelPriority = [bodies[0], ...bodies.slice(1).reverse()];

function updateOrbitPositions() {
  const days = (Date.now() - J2000_MS) / 86400000 + simulatedDays;
  for (const b of bodies) {
    if (b.au > 0) setOrbitPosition(b, orbitAngle(b, days), TIME_SPEED_DAYS_PER_SEC === 0);
  }
}
let simulatedDays = 0;
updateOrbitPositions();

function resetSystem() {
  systemGroup.position.set(...SYSTEM_START_POSITION);
  systemGroup.quaternion.identity();
  systemGroup.scale.setScalar(1);
  systemGroup.updateMatrixWorld(true);
}
resetSystem();

// =====================================================================
//  CHWYTANIE (jedna ręka: przesuń/obróć, dwie ręce: skaluj/obróć)
// =====================================================================
//  grabs: Map<obiekt, { ctrls: [kontroler, ...], limity skali, dane startowe }>
const grabs = new Map();

function startGrab(target, ctrl, minScale, maxScale) {
  let g = grabs.get(target);
  if (!g) { g = { target, ctrls: [], minScale, maxScale }; grabs.set(target, g); }
  if (g.ctrls.includes(ctrl)) return;
  g.ctrls.push(ctrl);
  ctrl.userData.grabTarget = target;
  initGrab(g);
}

function endGrab(ctrl) {
  const target = ctrl.userData.grabTarget;
  ctrl.userData.grabTarget = null;
  const g = target && grabs.get(target);
  if (!g) return;
  g.ctrls = g.ctrls.filter(c => c !== ctrl);
  if (g.ctrls.length === 0) grabs.delete(target);
  else initGrab(g);                       // została jedna ręka – kontynuuj chwyt jedną ręką
}

function cancelAllGrabs() {
  for (const g of grabs.values()) for (const c of g.ctrls) c.userData.grabTarget = null;
  grabs.clear();
}

// Zapamiętaj stan początkowy chwytu (wywoływane przy każdej zmianie liczby rąk)
function initGrab(g) {
  const t = g.target;
  t.updateMatrixWorld(true);
  for (const c of g.ctrls) c.updateMatrixWorld(true);
  if (g.ctrls.length === 1) {
    // offset = położenie obiektu w układzie współrzędnych kontrolera
    g.offset = new THREE.Matrix4().copy(g.ctrls[0].matrixWorld).invert().multiply(t.matrixWorld);
  } else {
    const a = new THREE.Vector3().setFromMatrixPosition(g.ctrls[0].matrixWorld);
    const b = new THREE.Vector3().setFromMatrixPosition(g.ctrls[1].matrixWorld);
    g.mid0 = a.clone().add(b).multiplyScalar(0.5);
    g.dir0 = b.clone().sub(a);
    g.dist0 = Math.max(g.dir0.length(), 0.01);
    g.dir0.normalize();
    g.pos0 = t.position.clone();
    g.quat0 = t.quaternion.clone();
    g.scale0 = t.scale.x;
  }
}

function updateGrabs() {
  for (const g of grabs.values()) {
    const t = g.target;
    if (g.ctrls.length === 1) {
      _m1.multiplyMatrices(g.ctrls[0].matrixWorld, g.offset);
      _m1.decompose(t.position, t.quaternion, _scale);     // skala bez zmian
    } else if (g.ctrls.length >= 2) {
      const a = _v1.setFromMatrixPosition(g.ctrls[0].matrixWorld);
      const b = _v2.setFromMatrixPosition(g.ctrls[1].matrixWorld);
      const mid = _v3.copy(a).add(b).multiplyScalar(0.5);
      const dir = b.sub(a);                                 // uwaga: _v2 staje się wektorem kierunku
      const dist = Math.max(dir.length(), 0.01);
      dir.normalize();
      const newScale = THREE.MathUtils.clamp(g.scale0 * dist / g.dist0, g.minScale, g.maxScale);
      const ratio = newScale / g.scale0;
      _q1.setFromUnitVectors(g.dir0, dir);                  // obrót "jak dwoma palcami"
      t.scale.setScalar(newScale);
      t.quaternion.copy(_q1).multiply(g.quat0);
      // punkt trzymany między dłońmi zostaje między dłońmi
      t.position.copy(g.pos0).sub(g.mid0).applyQuaternion(_q1).multiplyScalar(ratio).add(mid);
    }
    t.updateMatrixWorld(true);
  }
}

// =====================================================================
//  MENU (panel z przyciskami, rysowany na canvas)
// =====================================================================
const MENU_CANVAS_W = 1024, MENU_CANVAS_H = 400;
const MENU_HEIGHT_M = MENU_WIDTH_M * MENU_CANVAS_H / MENU_CANVAS_W;
const menuButtons = [
  { id: 'mode1', label: 'Tryb 1: Model', x: 30, y: 200, w: 340, h: 170 },
  { id: 'mode2', label: 'Tryb 2: Planety', sub: '(wkrótce)', x: 392, y: 200, w: 340, h: 170, disabled: true },
  { id: 'reset', label: 'Reset', x: 754, y: 200, w: 240, h: 170 },
];
const menuCanvas = document.createElement('canvas');
menuCanvas.width = MENU_CANVAS_W; menuCanvas.height = MENU_CANVAS_H;
const menuCtx = menuCanvas.getContext('2d');
const menuTexture = new THREE.CanvasTexture(menuCanvas);
menuTexture.colorSpace = THREE.SRGBColorSpace;
const menuMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(MENU_WIDTH_M, MENU_HEIGHT_M),
  new THREE.MeshBasicMaterial({ map: menuTexture, transparent: true }),
);
menuMesh.renderOrder = 20;
scene.add(menuMesh);

const state = {
  mode: 1,
  hoveredButton: null,
  status: '',
  menuNeedsPlacement: true,
  fps: 0,
};

function drawMenu() {
  const ctx = menuCtx;
  ctx.clearRect(0, 0, MENU_CANVAS_W, MENU_CANVAS_H);
  ctx.fillStyle = COLOR_MENU_BG;
  roundRect(ctx, 0, 0, MENU_CANVAS_W, MENU_CANVAS_H, 40); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Układ Słoneczny VR', 34, 80);
  ctx.fillStyle = '#a9b8d8';
  ctx.font = '36px system-ui, sans-serif';
  ctx.fillText(state.status, 34, 150);

  for (const b of menuButtons) {
    const active = (b.id === 'mode1' && state.mode === 1) || (b.id === 'mode2' && state.mode === 2);
    ctx.fillStyle = b.disabled ? COLOR_MENU_BUTTON_DISABLED
      : active ? COLOR_MENU_BUTTON_ACTIVE
      : state.hoveredButton === b.id ? COLOR_MENU_BUTTON_HOVER
      : COLOR_MENU_BUTTON;
    roundRect(ctx, b.x, b.y, b.w, b.h, 28); ctx.fill();
    ctx.fillStyle = b.disabled ? '#707888' : '#ffffff';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 - (b.sub ? 18 : 0));
    if (b.sub) {
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 30);
    }
    ctx.textAlign = 'left';
  }
  menuTexture.needsUpdate = true;
}

// Z punktu trafienia promienia (UV) -> który przycisk
function menuButtonAtUV(uv) {
  const x = uv.x * MENU_CANVAS_W, y = (1 - uv.y) * MENU_CANVAS_H;
  return menuButtons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

function onMenuButton(button) {
  if (!button || button.disabled) return;
  if (button.id === 'mode1') setMode(1);
  if (button.id === 'reset') { cancelAllGrabs(); resetSystem(); state.menuNeedsPlacement = true; }
  drawMenu();
}

function setMode(mode) {
  state.mode = mode;
  cancelAllGrabs();
  systemGroup.visible = mode === 1;
  for (const b of bodies) b.label.visible = mode === 1;
}

// Ustaw menu przed oczami użytkownika (poziomo przed nim, nieco niżej, zwrócone do niego)
function placeMenu(eyePos, headQuat) {
  const fwd = _v1.set(0, 0, -1).applyQuaternion(headQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  menuMesh.position.copy(eyePos).addScaledVector(fwd, MENU_DISTANCE_M);
  menuMesh.position.y += MENU_HEIGHT_OFFSET_M;
  menuMesh.lookAt(eyePos);
  state.menuNeedsPlacement = false;
}

// =====================================================================
//  KONTROLERY I DŁONIE
// =====================================================================
const raycaster = new THREE.Raycaster();
const controllers = [];

const handJointGeometry = new THREE.SphereGeometry(1, 8, 6);
const handJointMaterial = new THREE.MeshLambertMaterial({ color: 0xd8c8b8 });

for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);       // przestrzeń "promienia" (target ray)
  ctrl.userData = { handedness: null, inputSource: null, prevButtons: [], grabTarget: null, menuPress: false };

  // Promień do wskazywania menu
  const rayGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const ray = new THREE.Line(rayGeom, new THREE.LineBasicMaterial({ color: COLOR_RAY, transparent: true, opacity: 0.6 }));
  ray.scale.z = RAY_LENGTH_M;
  ctrl.add(ray);
  const rayDot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: COLOR_RAY }));
  rayDot.visible = false;
  ctrl.add(rayDot);
  ctrl.userData.ray = ray;
  ctrl.userData.rayDot = rayDot;

  ctrl.addEventListener('connected', e => {
    ctrl.userData.inputSource = e.data;
    ctrl.userData.handedness = e.data.handedness;
    ctrl.userData.isHand = !!e.data.hand;
    grip.userData.model.visible = !e.data.hand;
  });
  ctrl.addEventListener('disconnected', () => {
    endGrab(ctrl);
    ctrl.userData.inputSource = null;
    ctrl.userData.handedness = null;
  });
  ctrl.addEventListener('selectstart', onSelectStart);
  ctrl.addEventListener('selectend', onSelectEnd);
  scene.add(ctrl);

  // Prosty model kontrolera (bez pobierania modeli z internetu)
  const grip = renderer.xr.getControllerGrip(i);
  const model = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.11, 12), new THREE.MeshLambertMaterial({ color: 0x2c2f38 }));
  shell.rotation.x = -Math.PI / 2 + 0.35;
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 20), new THREE.MeshLambertMaterial({ color: 0x3a3f4c }));
  ringM.position.set(0, 0.02, -0.045);
  ringM.rotation.x = 0.6;
  model.add(shell, ringM);
  grip.add(model);
  grip.userData.model = model;
  scene.add(grip);

  // Dłonie (hand tracking): kulki w stawach, jedno wywołanie rysowania na dłoń
  const hand = renderer.xr.getHand(i);
  const joints = new THREE.InstancedMesh(handJointGeometry, handJointMaterial, 25);
  joints.count = 0;
  joints.frustumCulled = false;
  hand.add(joints);
  hand.userData.jointsMesh = joints;
  scene.add(hand);

  controllers.push({ ctrl, grip, hand });
}

function updateHandMeshes() {
  for (const { hand } of controllers) {
    const mesh = hand.userData.jointsMesh;
    let n = 0;
    for (const name in hand.joints) {
      const j = hand.joints[name];
      if (!j.visible || n >= 25) continue;
      _scale.setScalar(j.jointRadius || 0.008);
      _m1.compose(j.position, j.quaternion, _scale);
      mesh.setMatrixAt(n++, _m1);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function raycastMenu(ctrl) {
  if (!menuMesh.visible) return null;
  _m1.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_m1);
  const hit = raycaster.intersectObject(menuMesh, false)[0];
  return hit && hit.distance < 5 ? hit : null;
}

function onSelectStart(e) {
  const ctrl = e.target;
  ctrl.updateMatrixWorld(true);
  const hit = raycastMenu(ctrl);
  if (hit) {                                   // klik w menu ma pierwszeństwo przed chwytaniem
    ctrl.userData.menuPress = true;
    onMenuButton(menuButtonAtUV(hit.uv));
    return;
  }
  if (state.mode === 1) startGrab(systemGroup, ctrl, SYSTEM_SCALE_MIN, SYSTEM_SCALE_MAX);
}

function onSelectEnd(e) {
  const ctrl = e.target;
  if (ctrl.userData.menuPress) { ctrl.userData.menuPress = false; return; }
  endGrab(ctrl);
}

// Przyciski gamepada (A/B/X/Y) – wykrywanie momentu wciśnięcia
function pollButtons(ctrl) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp) return;
  const prev = ctrl.userData.prevButtons;
  for (let i = 0; i < gp.buttons.length; i++) {
    const pressed = gp.buttons[i].pressed;
    if (pressed && !prev[i]) onButtonDown(ctrl, i);
    prev[i] = pressed;
  }
}

function onButtonDown(ctrl, index) {
  const hand = ctrl.userData.handedness;
  if (hand === 'left' && index === MENU_SUMMON_BUTTON) state.menuNeedsPlacement = true;
  // KNIFE_BUTTON i RESET_BUTTON (prawy kontroler) zostaną podłączone w Trybie 2.
}

// =====================================================================
//  KLIKANIE MYSZĄ W MENU (podgląd na PC)
// =====================================================================
const pointer = new THREE.Vector2();
let pointerDownAt = null;
renderer.domElement.addEventListener('pointerdown', e => { pointerDownAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (renderer.xr.isPresenting || !pointerDownAt) return;
  const moved = Math.hypot(e.clientX - pointerDownAt[0], e.clientY - pointerDownAt[1]);
  pointerDownAt = null;
  if (moved > 6) return;                         // to było przeciągnięcie widoku, nie klik
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(menuMesh, false)[0];
  if (hit) onMenuButton(menuButtonAtUV(hit.uv));
});
renderer.domElement.addEventListener('pointermove', e => {
  if (renderer.xr.isPresenting) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(menuMesh, false)[0];
  const id = hit ? (menuButtonAtUV(hit.uv) || {}).id || null : null;
  if (id !== state.hoveredButton) { state.hoveredButton = id; drawMenu(); }
});

// =====================================================================
//  SESJA VR
// =====================================================================
renderer.xr.addEventListener('sessionstart', () => {
  state.menuNeedsPlacement = true;
  const session = renderer.xr.getSession();
  if (session && session.updateTargetFrameRate && session.supportedFrameRates
      && Array.from(session.supportedFrameRates).includes(TARGET_FPS)) {
    session.updateTargetFrameRate(TARGET_FPS).catch(() => {});
  }
});
renderer.xr.addEventListener('sessionend', () => {
  cancelAllGrabs();
  state.menuNeedsPlacement = true;
});

// =====================================================================
//  PĘTLA KLATEK
// =====================================================================
const eyePos = new THREE.Vector3();
const headQuat = new THREE.Quaternion();
let lastTime = 0, fpsFrames = 0, fpsTime = 0, statusTime = 0;

// Kąt (w radianach) przypadający na 1 piksel obrazu – potrzebne do reguły "bryła > 1 px"
function getPixelAngle() {
  if (renderer.xr.isPresenting) {
    const cams = renderer.xr.getCamera().cameras;
    const c = cams && cams[0];
    if (c && c.viewport.w > 0) {
      const fovY = 2 * Math.atan(1 / c.projectionMatrix.elements[5]);
      return fovY / c.viewport.w;
    }
    return (1 / 20) * DEG;                        // awaryjnie: ~20 pikseli na stopień (Quest 3S)
  }
  return (camera.fov * DEG) / renderer.domElement.height;
}

function formatLength(m) {
  if (m < 1) return `${(m * 100).toFixed(m < 0.1 ? 1 : 0)} cm`;
  if (m < 1000) return `${m.toFixed(m < 10 ? 1 : 0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function updateSystemView() {
  const s = systemGroup.scale.x;
  const pixelAngle = getPixelAngle();
  const tanLabel = Math.tan(LABEL_ANGLE_DEG * DEG);
  const minSepCos = Math.cos(LABEL_MIN_SEPARATION_DEG * DEG);

  for (const b of bodies) {
    b.worldPos.copy(b.localPos).applyMatrix4(systemGroup.matrixWorld);
    b.dir.subVectors(b.worldPos, eyePos);
    b.dist = b.dir.length();
    b.dir.divideScalar(b.dist || 1);
    const rWorld = b.radiusUnits * s;
    // rozmiar prawdziwej bryły na ekranie w pikselach
    const px = b.dist > rWorld ? (2 * Math.atan(rWorld / b.dist)) / pixelAngle : Infinity;
    const showBody = px > BODY_SWITCH_PX;
    b.mesh.visible = showBody;
    b.marker.visible = !showBody;

    // Etykieta: stały rozmiar kątowy, nad bryłą lub markerem
    const h = b.dist * tanLabel;
    const markerR = 0.5 * (b.type === 'star' ? SUN_MARKER_SIZE_PX : MARKER_SIZE_PX) * pixelAngle * b.dist;
    const offset = Math.max(showBody ? rWorld : 0, markerR) * 1.15 + h * 0.15;
    b.label.position.copy(b.worldPos).addScaledVector(UP, offset);
    b.label.scale.set(h * b.label.userData.aspect, h, 1);
    b.label.userData.inside = b.dist <= rWorld * 1.02;
  }

  // Ukrywanie nakładających się etykiet (ważniejsze wygrywają)
  const shown = [];
  for (const b of labelPriority) {
    let ok = !b.label.userData.inside;
    for (let i = 0; ok && i < shown.length; i++) if (b.dir.dot(shown[i].dir) > minSepCos) ok = false;
    b.label.visible = ok;
    if (ok) shown.push(b);
  }
}

function updateStatus(time) {
  const s = systemGroup.scale.x;
  const text = state.mode === 1
    ? `Skala ×${s < 10 ? s.toFixed(2) : s.toFixed(0)}  ·  ⌀ orbity Plutona ${formatLength(SYSTEM_DIAMETER_M * s)}  ·  ${state.fps} FPS`
    : `${state.fps} FPS`;
  if (text !== state.status && time - statusTime > 250) {
    state.status = text;
    statusTime = time;
    drawMenu();
  }
}

renderer.setAnimationLoop((time, frame) => {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
  lastTime = time;

  // Licznik FPS
  fpsFrames++;
  if (time - fpsTime > 500) {
    state.fps = Math.round(fpsFrames * 1000 / (time - fpsTime));
    fpsFrames = 0;
    fpsTime = time;
  }

  // Pozycja oczu i kierunek głowy
  if (frame && renderer.xr.isPresenting) {
    const pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
    if (pose) {
      const p = pose.transform.position, o = pose.transform.orientation;
      eyePos.set(p.x, p.y, p.z);
      headQuat.set(o.x, o.y, o.z, o.w);
    }
  } else {
    orbitControls.update();
    eyePos.copy(camera.position);
    headQuat.copy(camera.quaternion);
  }

  // Menu: ustaw przed użytkownikiem na starcie, po Y lub gdy jest za daleko
  if (state.menuNeedsPlacement || menuMesh.position.distanceTo(eyePos) > MENU_MAX_DISTANCE_M) placeMenu(eyePos, headQuat);

  // Kontrolery: przyciski, promienie, podświetlenie menu
  let hovered = null;
  for (const { ctrl } of controllers) {
    ctrl.updateMatrixWorld(true);
    pollButtons(ctrl);
    const hit = renderer.xr.isPresenting ? raycastMenu(ctrl) : null;
    ctrl.userData.ray.scale.z = hit ? hit.distance : RAY_LENGTH_M;
    ctrl.userData.rayDot.visible = !!hit;
    if (hit) {
      ctrl.userData.rayDot.position.set(0, 0, -hit.distance);
      const b = menuButtonAtUV(hit.uv);
      if (b && !b.disabled) hovered = b.id;
    }
  }
  if (renderer.xr.isPresenting && hovered !== state.hoveredButton) { state.hoveredButton = hovered; drawMenu(); }

  updateGrabs();
  updateHandMeshes();

  if (state.mode === 1) {
    if (TIME_SPEED_DAYS_PER_SEC !== 0) { simulatedDays += dt * TIME_SPEED_DAYS_PER_SEC; updateOrbitPositions(); }
    systemGroup.updateMatrixWorld(true);
    updateSystemView();
  }

  stars.position.copy(eyePos);       // gwiazdy zawsze "w nieskończoności"
  updateStatus(time);
  renderer.render(scene, camera);
});

drawMenu();

// Dostęp do obiektów z konsoli przeglądarki (pomocne przy debugowaniu)
window.solar = { THREE, scene, camera, renderer, systemGroup, bodies, orbitControls, startGrab, endGrab, updateGrabs, grabs };
