// =====================================================================
//  UKŁAD SŁONECZNY VR  –  WebXR (Meta Quest 3 / 3S, Meta Quest Browser)
//
//  Tryb 1: model całego układu (do orbity Plutona) z księżycami
//  Tryb 2: duże modele planet + nóż do przecinania
//  Tryb 3: mała planeta z chodzącymi ludzikami
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
const SYSTEM_SCALE_MAX = 5e6;                  // 5 mln × – można dolecieć do planety i zobaczyć ją jak piłkę
const USE_REAL_POSITIONS = true;               // true = planety w przybliżonych pozycjach na dziś
const TIME_SPEED_DAYS_PER_SEC = 0;             // prędkość czasu: 0 = model statyczny;
                                               // np. 30 = 30 dni na sekundę (planety krążą)
const ORBIT_HIDE_SCALE = 1e5;                  // powyżej tej skali orbity planet są ukrywane (i tak są wtedy prostymi liniami)
const STICK_ZOOM_RATE = 6;                     // gałka: powiększenie ×6 na sekundę przy pełnym wychyleniu
const STICK_DEADZONE = 0.15;                   // martwa strefa gałki

// "Leć do planety" (grip/ściśnięcie przy wskazaniu planety promieniem)
const FOCUS_BODY_RADIUS_M = 0.12;      // planeta po przylocie ma taki promień [m]
const FOCUS_SYSTEM_RADIUS_M = 1.3;     // drugi grip na tej samej planecie: cały układ księżyców w takim promieniu [m]
const FOCUS_DISTANCE_M = 0.6;          // planeta zatrzymuje się tak daleko przed oczami [m]
const FOCUS_DURATION_S = 2.0;          // czas przelotu [s]
const FOCUS_PICK_ANGLE_DEG = 4;        // tolerancja celowania promieniem [stopnie]

// --- Markery i bryły (Tryb 1) ----------------------------------------
const MARKER_SIZE_PX = 10;          // rozmiar świecącej kropki-markera planety [piksele]
const SUN_MARKER_SIZE_PX = 16;      // marker Słońca [piksele]
const MOON_MARKER_SIZE_PX = 6;      // marker księżyca [piksele]
const MOON_SYSTEM_MIN_PX = 14;      // księżyc pojawia się, gdy jego orbita ma na ekranie promień > tyle pikseli
const BODY_SWITCH_PX = 1;           // gdy prawdziwa bryła ma więcej niż tyle pikseli -> rysuj bryłę zamiast markera
const SPHERE_SEGMENTS_W = 32;       // liczba segmentów sfery (poziomo) – mało = szybko
const SPHERE_SEGMENTS_H = 16;       // liczba segmentów sfery (pionowo)
const ORBIT_SEGMENTS = 720;         // liczba odcinków linii orbity planety
const MOON_ORBIT_SEGMENTS = 256;    // liczba odcinków linii orbity księżyca
const ORBIT_OPACITY = 0.45;         // przezroczystość linii orbit planet (0..1)
const MOON_ORBIT_OPACITY = 0.3;     // przezroczystość linii orbit księżyców

// --- Etykiety ---------------------------------------------------------
const LABEL_ANGLE_DEG = 1.4;              // wysokość etykiety jako kąt widzenia [stopnie] (stała czytelność)
const LABEL_MIN_SEPARATION_DEG = 2.5;     // ukryj etykietę, jeśli ciało jest bliżej (kątowo) niż tyle od innego z etykietą
const INFO_LABEL_ANGLE_DEG = 9;           // Tryb 2: wysokość tabliczki z ciekawostkami [stopnie]
const LABEL_FONT = 'bold 64px system-ui, "Segoe UI", Roboto, sans-serif';
const COLOR_LABEL_HOVER = 0xffe066;       // podświetlenie etykiety wskazanej promieniem

// --- Tryb 2: duże planety ---------------------------------------------
const MODE2_EARTH_RADIUS_M = 0.07;  // promień Ziemi w Trybie 2 [m]
const MODE2_SIZE_EXPONENT = 0.5;    // skala "edukacyjna": promień ~ (promień rzeczywisty)^0.5 (pierwiastek)
const MODE2_ARC_RADIUS_M = 1.4;     // planety stoją na łuku: tak daleko od oczu jest ich przednia powierzchnia [m]
const MODE2_MAX_ARC_DEG = 150;      // maksymalna szerokość łuku [stopnie] (gdy więcej – łuk się odsuwa)
const MODE2_GAP_M = 0.12;           // odstęp między planetami [m]
const MODE2_HEIGHT_OFFSET_M = -0.2; // środki planet nieco poniżej oczu [m]
const MODE2_SCALE_MIN = 0.3;        // minimalna skala planety (względem rozmiaru startowego)
const MODE2_SCALE_MAX = 6;          // maksymalna skala planety
const MODE2_SPHERE_SEGMENTS_W = 64; // duże kule – więcej segmentów
const MODE2_SPHERE_SEGMENTS_H = 32;
const NEAR_GRAB_MARGIN_M = 0.06;    // chwyt "z ręki", gdy kontroler jest tak blisko powierzchni [m]
const PULL_GAP_M = 0.12;            // chwyt z daleka: planeta przylatuje do ręki i zatrzymuje się tyle przed nią [m]
const PULL_DURATION_S = 0.3;        // czas przyciągania [s]

// --- Nóż (Tryb 2) -------------------------------------------------------
const KNIFE_RADIUS_M = 0.2;         // promień tarczy noża [m]
const KNIFE_OFFSET_M = 0.18;        // środek tarczy przed kontrolerem [m]
const KNIFE_COLOR = 0xbfe8ff;
const KNIFE_OPACITY = 0.28;
const CUT_PREVIEW_COLOR = 0xffe14d;  // okrąg pokazujący, gdzie nastąpi cięcie
const CUT_SEPARATION_M = 0.03;       // po cięciu połówki odsuwają się od siebie o tyle [m]
const GLUE_DURATION_S = 0.4;         // animacja sklejania [s]

// Warstwy wnętrza do przekroju: f = promień zewnętrzny warstwy jako ułamek promienia planety.
// Cienkie skorupy są celowo pogrubione, żeby było je widać. Planety gazowe uproszczone.
const LAYERS = {
  sun:     [ { name: 'Strefa konwektywna', f: 1.00, color: '#ff7a1a' }, { name: 'Strefa promienista', f: 0.70, color: '#ffb43a' }, { name: 'Jądro', f: 0.25, color: '#fff3a8' } ],
  mercury: [ { name: 'Skorupa', f: 1.00, color: '#7d746c' }, { name: 'Płaszcz', f: 0.95, color: '#c0643c' }, { name: 'Jądro', f: 0.83, color: '#f0b040' } ],
  venus:   [ { name: 'Skorupa', f: 1.00, color: '#a08060' }, { name: 'Płaszcz', f: 0.96, color: '#c85a30' }, { name: 'Jądro', f: 0.53, color: '#f2b440' } ],
  earth:   [ { name: 'Skorupa', f: 1.00, color: '#6b5a48' }, { name: 'Płaszcz', f: 0.97, color: '#d2592c' }, { name: 'Jądro zewnętrzne', f: 0.55, color: '#f29a2e' }, { name: 'Jądro wewnętrzne', f: 0.19, color: '#fff0a0' } ],
  mars:    [ { name: 'Skorupa', f: 1.00, color: '#9a5a3a' }, { name: 'Płaszcz', f: 0.95, color: '#c8643a' }, { name: 'Jądro', f: 0.52, color: '#e8a83a' } ],
  jupiter: [ { name: 'Atmosfera', f: 1.00, color: '#d8b98c' }, { name: 'Ciekły wodór', f: 0.95, color: '#9fb0d8' }, { name: 'Wodór metaliczny', f: 0.78, color: '#6878b8' }, { name: 'Jądro', f: 0.15, color: '#e0a050' } ],
  saturn:  [ { name: 'Atmosfera', f: 1.00, color: '#e6d29a' }, { name: 'Ciekły wodór', f: 0.95, color: '#a8b8d8' }, { name: 'Wodór metaliczny', f: 0.50, color: '#7080b8' }, { name: 'Jądro', f: 0.22, color: '#e0a050' } ],
  uranus:  [ { name: 'Atmosfera', f: 1.00, color: '#9fdbe6' }, { name: 'Płaszcz lodowy', f: 0.80, color: '#4a9ab8' }, { name: 'Jądro skaliste', f: 0.25, color: '#a07850' } ],
  neptune: [ { name: 'Atmosfera', f: 1.00, color: '#4a6fe0' }, { name: 'Płaszcz lodowy', f: 0.82, color: '#3a62a8' }, { name: 'Jądro skaliste', f: 0.25, color: '#a07850' } ],
};

// --- Tryb 3: planeta z ludzikami ---------------------------------------
const MODE3_PLANET_DIAMETER_M = 1.0;   // średnica planety na starcie [m]
const MODE3_DISTANCE_M = 1.45;         // środek planety tak daleko przed oczami [m] (przód planety ~0,95 m od oczu)
const MODE3_HEIGHT_OFFSET_M = -0.25;   // środek planety poniżej oczu [m]
const MODE3_PEOPLE_COUNT = 30;         // liczba ludzików
const MODE3_PERSON_HEIGHT_M = 0.01;    // wzrost ludzika przy skali 1 [m]
const MODE3_PERSON_SPEED_MPS = 0.015;  // prędkość marszu przy skali 1 [m/s]
const MODE3_TURN_NOISE = 1.5;          // jak bardzo ludziki skręcają losowo (0 = idą prosto)
const MODE3_SCALE_MIN = 0.3;           // minimalna skala planety
const MODE3_SCALE_MAX = 40;            // maksymalna skala (40 m planeta, ludzik 40 cm)
const MODE3_OCEAN_COLOR = '#2a62b8';
const MODE3_LAND_COLORS = ['#4f9a3c', '#6aa84f', '#8c9a4a', '#a58d5a'];
const MODE3_SHIRT_COLORS = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe67e22, 0xffffff, 0x1abc9c];
const MODE3_PANTS_COLOR = 0x2c3e50;
const MODE3_SKIN_COLOR = 0xf0c8a0;

// --- Menu (panel w VR) ------------------------------------------------
const MENU_WIDTH_M = 0.46;          // szerokość panelu [m]
const MENU_DISTANCE_M = 0.6;        // odległość panelu od oczu [m]
const MENU_HEIGHT_OFFSET_M = -0.3;  // panel niżej niż oczy [m]
const MENU_MAX_DISTANCE_M = 2.5;    // gdy odejdziesz dalej, panel sam wraca przed Ciebie [m]
const RAY_LENGTH_M = 0.6;           // długość promienia kontrolera [m]

// --- Przyciski kontrolerów (indeksy w gamepad.buttons, standard "xr-standard") ---
//  0 = spust (trigger), 1 = grip (ściśnięcie), 3 = wciśnięcie gałki,
//  4 = A (prawy) / X (lewy), 5 = B (prawy) / Y (lewy)
const MENU_SUMMON_BUTTON = 5;       // Y na lewym kontrolerze -> menu przed oczy
const FOCUS_BUTTON = 1;             // grip: Tryb 1 – leć do wskazanej planety
const KNIFE_BUTTON = 4;             // A na prawym kontrolerze -> nóż wł./wył. (Tryb 2)
const RESET_BUTTON = 5;             // B na prawym kontrolerze -> sklej planety (Tryb 2)
const ZOOM_STICK_AXIS = 3;          // oś gałki (3 = góra/dół) – Tryb 1: zoom

// --- Wygląd -----------------------------------------------------------
const COLOR_BACKGROUND = 0x000006;
const COLOR_RAY = 0x88ccff;
const COLOR_MENU_BG = 'rgba(12, 18, 36, 0.88)';
const COLOR_MENU_BUTTON = '#2a3b6b';
const COLOR_MENU_BUTTON_HOVER = '#4a6bc4';
const COLOR_MENU_BUTTON_ACTIVE = '#d08a1e';
const STAR_COUNT = 2500;            // liczba gwiazd w tle
const AMBIENT_LIGHT = 0.18;         // światło otoczenia (żeby nocna strona nie była czarna)
const SUN_LIGHT = 3.0;              // światło Słońca padające na planety (Tryb 1)
const MODE23_AMBIENT = 0.9;         // Tryby 2 i 3: światło otoczenia
const MODE23_HEADLIGHT = 2.2;       // Tryby 2 i 3: światło "z głowy" użytkownika

// --- Wydajność / renderowanie -----------------------------------------
const TARGET_FPS = 72;              // docelowa częstotliwość Questa
const FRAMEBUFFER_SCALE = 1.0;      // 1.0 = natywna rozdzielczość; mniej = szybciej, ale mniej ostro
const FOVEATION = 1.0;              // 0..1, renderowanie brzegów obrazu w niższej rozdzielczości
const CAMERA_NEAR = 0.01;           // [m]
const CAMERA_FAR = 1e8;             // [m]  (logarithmicDepthBuffer radzi sobie z ogromnym zakresem)

// --- Tekstury ---------------------------------------------------------
const USE_TEXTURE_FILES = true;     // false = zawsze kolorowe tekstury zastępcze
const TEXTURE_PATH = 'textures/';   // folder z teksturami (patrz textures/README.md)

// --- Dane ciał niebieskich (wartości rzeczywiste) ----------------------
//  radiusKm  – promień równikowy [km]
//  au        – średnia odległość od Słońca [j.a.]
//  periodDays– okres obiegu [dni]
//  L0        – średnia długość ekliptyczna w epoce J2000 [stopnie] (do pozycji "na dziś")
//  tilt      – nachylenie osi obrotu [stopnie]
//  type      – 'star' | 'rocky' | 'gas' | 'ice' (wpływa na zastępczą teksturę)
//  rings     – pierścienie: promień wewn./zewn. [km], styl rysowania
//  info      – Tryb 2: tabliczka z danymi i ciekawostką
const BODIES = [
  { id: 'sun', name: 'Słońce', radiusKm: 696340, au: 0, periodDays: 0, L0: 0, tilt: 7.25, color: 0xffcc44, type: 'star', texture: '2k_sun.jpg',
    info: { diameter: '1 392 700 km', period: '~230 mln lat (wokół Galaktyki)', distance: 'centrum układu', fact: 'Zmieściłoby się w nim ok. 1,3 mln Ziem.' } },
  { id: 'mercury', name: 'Merkury', radiusKm: 2439.7, au: 0.387, periodDays: 87.969, L0: 252.25, tilt: 0.03, color: 0xa8a29a, type: 'rocky', texture: '2k_mercury.jpg',
    info: { diameter: '4 879 km', period: '88 dni', distance: '57,9 mln km', fact: 'Jedna doba słoneczna trwa tu 176 ziemskich dni.' } },
  { id: 'venus', name: 'Wenus', radiusKm: 6051.8, au: 0.723, periodDays: 224.70, L0: 181.98, tilt: 177.4, color: 0xe8c47c, type: 'rocky', texture: '2k_venus_atmosphere.jpg',
    info: { diameter: '12 104 km', period: '225 dni', distance: '108,2 mln km', fact: 'Najgorętsza planeta: ok. 465 °C przy powierzchni.' } },
  { id: 'earth', name: 'Ziemia', radiusKm: 6371.0, au: 1.000, periodDays: 365.26, L0: 100.46, tilt: 23.44, color: 0x3d7fe0, type: 'rocky', texture: '2k_earth_daymap.jpg',
    info: { diameter: '12 742 km', period: '365,25 dni', distance: '149,6 mln km', fact: 'Jedyne znane miejsce we Wszechświecie z życiem.' } },
  { id: 'mars', name: 'Mars', radiusKm: 3389.5, au: 1.524, periodDays: 686.98, L0: 355.45, tilt: 25.19, color: 0xd0562a, type: 'rocky', texture: '2k_mars.jpg',
    info: { diameter: '6 779 km', period: '687 dni', distance: '227,9 mln km', fact: 'Ma najwyższy wulkan w Układzie: Olympus Mons (~22 km).' } },
  { id: 'jupiter', name: 'Jowisz', radiusKm: 69911, au: 5.203, periodDays: 4332.6, L0: 34.40, tilt: 3.13, color: 0xd9b98c, type: 'gas', texture: '2k_jupiter.jpg',
    rings: [ { innerKm: 100000, outerKm: 129000, style: 'faint', color: 0x9a8a78, alpha: 0.22 } ],
    info: { diameter: '139 820 km', period: '11,9 roku', distance: '778,5 mln km', fact: 'Wielka Czerwona Plama to burza większa od Ziemi.' } },
  { id: 'saturn', name: 'Saturn', radiusKm: 58232, au: 9.537, periodDays: 10759, L0: 49.94, tilt: 26.73, color: 0xe6d29a, type: 'gas', texture: '2k_saturn.jpg',
    rings: [ { innerKm: 74500, outerKm: 140220, style: 'saturn', color: 0xe0cfa0, texture: '2k_saturn_ring_alpha.png' } ],
    info: { diameter: '116 460 km', period: '29,5 roku', distance: '1,43 mld km', fact: 'Jego średnia gęstość jest mniejsza niż gęstość wody.' } },
  { id: 'uranus', name: 'Uran', radiusKm: 25362, au: 19.19, periodDays: 30688, L0: 313.23, tilt: 97.77, color: 0x9fdbe6, type: 'ice', texture: '2k_uranus.jpg',
    rings: [ { innerKm: 41000, outerKm: 52000, style: 'lines', color: 0xc8d8e0, alpha: 0.8, lines: [41837, 42234, 42571, 44718, 45661, 47176, 47627, 48300, 51149] } ],
    info: { diameter: '50 724 km', period: '84 lata', distance: '2,87 mld km', fact: 'Obraca się „na boku” – oś nachylona o 98°.' } },
  { id: 'neptune', name: 'Neptun', radiusKm: 24622, au: 30.07, periodDays: 60182, L0: 304.88, tilt: 28.32, color: 0x4a6fe0, type: 'ice', texture: '2k_neptune.jpg',
    rings: [ { innerKm: 40000, outerKm: 64000, style: 'lines', color: 0xb8c0d0, alpha: 0.6, lines: [41900, 53200, 57200, 62932] } ],
    info: { diameter: '49 244 km', period: '164,8 roku', distance: '4,5 mld km', fact: 'Wieją tu najszybsze wiatry: ponad 2000 km/h.' } },
  { id: 'pluto', name: 'Pluton', radiusKm: 1188.3, au: 39.48, periodDays: 90560, L0: 238.93, tilt: 122.5, color: 0xd2bfa4, type: 'rocky', texture: '2k_pluto.jpg' },
];

// Księżyce: promień [km], promień orbity [km], kolor, incl = nachylenie orbity względem równika planety [stopnie]
const MOONS = {
  earth:   [ { name: 'Księżyc', radiusKm: 1737.4, aKm: 384400, color: 0xbdbdbd, incl: -18.3 } ],
  mars:    [ { name: 'Fobos', radiusKm: 11.3, aKm: 9376, color: 0x8f7f70 },
             { name: 'Deimos', radiusKm: 6.2, aKm: 23463, color: 0xa39282 } ],
  jupiter: [ { name: 'Io', radiusKm: 1821.6, aKm: 421700, color: 0xe8d44d },
             { name: 'Europa', radiusKm: 1560.8, aKm: 671034, color: 0xd8c8a8 },
             { name: 'Ganimedes', radiusKm: 2634.1, aKm: 1070412, color: 0x9e9284 },
             { name: 'Kallisto', radiusKm: 2410.3, aKm: 1882709, color: 0x6e6255 } ],
  saturn:  [ { name: 'Mimas', radiusKm: 198.2, aKm: 185539, color: 0xc9c9c9 },
             { name: 'Enceladus', radiusKm: 252.1, aKm: 237948, color: 0xf2f6ff },
             { name: 'Tetyda', radiusKm: 531.1, aKm: 294619, color: 0xdadada },
             { name: 'Dione', radiusKm: 561.4, aKm: 377396, color: 0xcfcfcf },
             { name: 'Rea', radiusKm: 763.8, aKm: 527108, color: 0xc4c4c4 },
             { name: 'Tytan', radiusKm: 2574.7, aKm: 1221870, color: 0xe3a857 },
             { name: 'Japet', radiusKm: 734.5, aKm: 3560820, color: 0x9a8b78, incl: 15.5 } ],
  uranus:  [ { name: 'Miranda', radiusKm: 235.8, aKm: 129390, color: 0xb5b5b5 },
             { name: 'Ariel', radiusKm: 578.9, aKm: 191020, color: 0xc8c8c8 },
             { name: 'Umbriel', radiusKm: 584.7, aKm: 266000, color: 0x7d7d7d },
             { name: 'Tytania', radiusKm: 788.4, aKm: 435910, color: 0xb8aea4 },
             { name: 'Oberon', radiusKm: 761.4, aKm: 583520, color: 0xa69c92 } ],
  neptune: [ { name: 'Proteus', radiusKm: 210, aKm: 117647, color: 0x7a7a7a },
             { name: 'Tryton', radiusKm: 1353.4, aKm: 354759, color: 0xd9cbc2, incl: 157 } ],
  pluto:   [ { name: 'Charon', radiusKm: 606, aKm: 19591, color: 0xa8a39a } ],
};

// =====================================================================
//  KONIEC KONFIGURACJI
// =====================================================================

window.__solarStarted = true;

// ---------------------------------------------------------------------
//  Jednostki: 1 jednostka w grupie układu = 1 metr przy skali grupy = 1
// ---------------------------------------------------------------------
const KM_PER_AU = 149597870.7;
const EARTH_RADIUS_KM = 6371;
const PLUTO_AU = BODIES.find(b => b.id === 'pluto').au;
const M_PER_AU = (SYSTEM_DIAMETER_M / 2) / PLUTO_AU;     // ile metrów modelu na 1 j.a.
const kmToUnits = km => (km / KM_PER_AU) * M_PER_AU;
const DEG = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const smooth = t => t * t * (3 - 2 * t);

// Wspólne obiekty pomocnicze (bez tworzenia nowych w każdej klatce = mniej pracy dla GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// =====================================================================
//  RENDERER, SCENA, KAMERA
// =====================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;               // brak cieni (wydajność)
renderer.localClippingEnabled = true;             // płaszczyzny cięcia (nóż w Trybie 2)
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

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Zastępcza tekstura planety (gdy brak pliku w folderze textures/) – jedna na planetę, współdzielona
const placeholderCache = new Map();
function placeholderTexture(def) {
  if (placeholderCache.has(def.id)) return placeholderCache.get(def.id);
  const w = 256, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom(def.id);

  if (def.type === 'gas' || def.type === 'ice' || def.type === 'star') {
    // Poziome pasy (gazowe olbrzymy) lub ziarnistość (Słońce)
    const bandH = def.type === 'ice' ? 8 : 4;
    for (let y = 0; y < h; y += bandH) {
      const k = def.type === 'ice' ? 0.92 + rnd() * 0.12 : 0.75 + rnd() * 0.45;
      ctx.fillStyle = cssColor(def.color, k);
      ctx.fillRect(0, y, w, bandH);
    }
    if (def.type === 'star') {
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(255,${(150 + rnd() * 100) | 0},0,${0.15 + rnd() * 0.25})`;
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (def.id === 'jupiter') {          // Wielka Czerwona Plama
      ctx.fillStyle = 'rgba(190,90,60,0.85)';
      ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.62, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (def.id === 'earth') {
    drawContinents(ctx, w, h, rnd, '#1f4fa8', ['#3f7d3a', '#9b8a5a'], 35);
  } else {
    // Planety skaliste: plamy i kratery
    ctx.fillStyle = cssColor(def.color); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = cssColor(def.color, 0.7 + rnd() * 0.5);
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = canvasTexture(canvas);
  placeholderCache.set(def.id, tex);
  return tex;
}

// Oceany + kontynenty + czapy polarne (Ziemia i planeta z Trybu 3)
function drawContinents(ctx, w, h, rnd, ocean, lands, count) {
  ctx.fillStyle = ocean; ctx.fillRect(0, 0, w, h);
  const k = w / 256;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = lands[(rnd() * lands.length) | 0];
    const x = rnd() * w, y = h * 0.18 + rnd() * h * 0.64;
    const rx = (6 + rnd() * 22) * k, ry = (4 + rnd() * 14) * k, rot = rnd() * 3;
    for (const dx of [-w, 0, w]) {              // zawijanie na krawędzi mapy
      ctx.beginPath(); ctx.ellipse(x + dx, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#f2f6ff'; ctx.fillRect(0, 0, w, h * 0.07); ctx.fillRect(0, h * 0.93, w, h * 0.07);
}

// Tekstura pierścieni (pasek: lewo = wewnętrzna krawędź, prawo = zewnętrzna)
const ringTextureCache = new Map();
function ringTexture(def, ring) {
  const key = def.id + ring.innerKm;
  if (ringTextureCache.has(key)) return ringTextureCache.get(key);
  const w = 1024, h = 4;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom(key);
  const c = new THREE.Color(ring.color);
  const rgb = (a, k = 1) => `rgba(${(c.r * 255 * k) | 0},${(c.g * 255 * k) | 0},${(c.b * 255 * k) | 0},${a})`;
  const span = ring.outerKm - ring.innerKm;
  if (ring.style === 'saturn') {
    for (let x = 0; x < w; x++) {
      const f = x / w;
      let a = 0.35 + rnd() * 0.35;
      if (f < 0.12) a *= 0.35;                  // słaby pierścień C
      if (f > 0.655 && f < 0.725) a = 0.05;     // przerwa Cassiniego
      ctx.fillStyle = rgb(a, 0.85 + rnd() * 0.25);
      ctx.fillRect(x, 0, 1, h);
    }
  } else if (ring.style === 'lines') {
    for (const km of ring.lines) {
      const x = ((km - ring.innerKm) / span) * w;
      ctx.fillStyle = rgb(ring.alpha);
      ctx.fillRect(x - 1.5, 0, 3, h);
    }
  } else {                                      // 'faint' – delikatna mgiełka
    for (let x = 0; x < w; x++) {
      const f = x / w;
      const edge = Math.min(1, f / 0.15, (1 - f) / 0.05);
      ctx.fillStyle = rgb(ring.alpha * edge * (0.7 + rnd() * 0.3));
      ctx.fillRect(x, 0, 1, h);
    }
  }
  const tex = canvasTexture(canvas);
  ringTextureCache.set(key, tex);
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

// Prawdziwe tekstury z plików: ładowane raz, podmieniane we wszystkich materiałach, które ich używają.
// Jeśli pliku nie ma – zostaje placeholder.
const textureLoader = new THREE.TextureLoader();
const fileTextures = new Map();   // nazwa pliku -> { tex, materials:Set }
function useTextureFile(material, fileName) {
  if (!USE_TEXTURE_FILES || !fileName) return;
  let entry = fileTextures.get(fileName);
  if (!entry) {
    entry = { tex: null, materials: new Set() };
    fileTextures.set(fileName, entry);
    textureLoader.load(
      TEXTURE_PATH + fileName,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        entry.tex = tex;
        for (const m of entry.materials) { m.map = tex; m.needsUpdate = true; }
      },
      undefined,
      () => console.info(`[tekstury] Brak pliku ${TEXTURE_PATH}${fileName} – używam zastępczej tekstury.`)
    );
  }
  entry.materials.add(material);
  if (entry.tex) material.map = entry.tex;
}
function forgetMaterial(material) {
  for (const e of fileTextures.values()) e.materials.delete(material);
  material.dispose();
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 0);                      // zaczepienie w środku dolnej krawędzi
  sprite.userData.aspect = w / h;
  sprite.renderOrder = 10;
  return sprite;
}

// Tryb 2: tabliczka z nazwą, danymi, ciekawostką i legendą warstw wnętrza
function makeInfoLabel(def) {
  const W = 900, pad = 34;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const info = def.info || {};
  const layers = LAYERS[def.id] || [];

  // rysowanie w dwóch przebiegach: najpierw pomiar wysokości, potem właściwe rysowanie
  function paint(draw) {
    let y = pad;
    const text = (t, font, color, x = pad) => {
      ctx.font = font;
      if (draw) { ctx.fillStyle = color; ctx.fillText(t, x, y); }
    };
    ctx.textBaseline = 'top';
    text(def.name, 'bold 66px system-ui, sans-serif', '#ffffff'); y += 84;
    for (const [k, v] of [['Średnica', info.diameter], ['Okres obiegu', info.period], ['Od Słońca', info.distance]]) {
      if (!v) continue;
      text(`${k}: `, '38px system-ui, sans-serif', '#9fb3d9');
      const kw = ctx.measureText(`${k}: `).width;
      text(v, 'bold 38px system-ui, sans-serif', '#ffffff', pad + kw); y += 50;
    }
    if (info.fact) {
      ctx.font = 'italic 36px system-ui, sans-serif';
      y += 8;
      for (const line of wrapText(ctx, info.fact, W - pad * 2)) { text(line, 'italic 36px system-ui, sans-serif', '#ffe9a8'); y += 44; }
    }
    if (layers.length) {
      y += 12;
      text('Wnętrze:', 'bold 34px system-ui, sans-serif', '#9fb3d9'); y += 46;
      ctx.font = '32px system-ui, sans-serif';
      let x = pad;
      for (const L of layers) {
        const wItem = 40 + ctx.measureText(L.name).width + 30;
        if (x + wItem > W - pad) { x = pad; y += 44; }
        if (draw) {
          ctx.fillStyle = L.color; ctx.fillRect(x, y + 2, 30, 30);
          ctx.fillStyle = '#e8ecf5'; ctx.fillText(L.name, x + 40, y);
        }
        x += wItem;
      }
      y += 44;
    }
    return y + pad;
  }
  canvas.width = W; canvas.height = 64;
  const H = Math.ceil(paint(false));
  canvas.height = H;
  ctx.fillStyle = 'rgba(8, 12, 28, 0.82)';
  roundRect(ctx, 0, 0, W, H, 34); ctx.fill();
  paint(true);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 0);
  sprite.userData.aspect = W / H;
  sprite.renderOrder = 11;
  return sprite;
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Okrąg z linii w płaszczyźnie XZ (orbity)
function makeCircleLineXZ(radius, segments, color, opacity) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

// Pierścień w jednostkach promienia planety (dziecko kuli o promieniu 1)
function makeRingMesh(def, ring, clippingPlanes = null) {
  const inner = ring.innerKm / def.radiusKm, outer = ring.outerKm / def.radiusKm;
  const g = new THREE.RingGeometry(inner, outer, 96, 1);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {                 // UV: u = odległość od środka (pasek tekstury)
    const r = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  const mat = new THREE.MeshLambertMaterial({
    map: ringTexture(def, ring), side: THREE.DoubleSide, transparent: true, depthWrite: false, clippingPlanes,
  });
  useTextureFile(mat, ring.texture);
  const mesh = new THREE.Mesh(g, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function makePlanetMaterial(def, clippingPlanes = null) {
  const opts = { map: placeholderTexture(def), clippingPlanes };
  const mat = def.type === 'star'
    ? new THREE.MeshBasicMaterial(opts)              // Słońce świeci samo
    : new THREE.MeshLambertMaterial(opts);           // planety oświetlone
  useTextureFile(mat, def.texture);
  return mat;
}

// Ile razy wyraźne pierścienie (Saturna) wystają poza promień planety; słabe pierścienie pomijamy
const ringExtent = def => Math.max(1, ...(def.rings || []).filter(r => r.style === 'saturn').map(r => r.outerKm / def.radiusKm));

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
const mode1Labels = new THREE.Group();          // etykiety leżą w scenie (bez skali układu)
scene.add(mode1Labels);

const sunLight = new THREE.PointLight(0xffffff, SUN_LIGHT, 0, 0);   // decay 0 = bez zaniku z odległością
systemGroup.add(sunLight);

const sphereGeometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS_W, SPHERE_SEGMENTS_H);
const sphereGeometryHi = new THREE.SphereGeometry(1, MODE2_SPHERE_SEGMENTS_W, MODE2_SPHERE_SEGMENTS_H);
const markerGeometry = new THREE.BufferGeometry();
markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
const glowTexture = makeGlowTexture();

function makeMarker(color, sizePx) {
  const m = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
    color, size: sizePx, sizeAttenuation: false, map: glowTexture,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.frustumCulled = false;
  m.renderOrder = 5;
  return m;
}

// Kąt orbity (radiany) dla danej liczby dni od J2000
function orbitAngle(def, daysSinceJ2000) {
  if (!USE_REAL_POSITIONS) return BODIES.indexOf(def) * 2.4;      // równomierny "wachlarz"
  return (def.L0 + 360 * daysSinceJ2000 / def.periodDays) * DEG;
}

// Ciało niebieskie w Trybie 1:
//   holder   – obiekt, w którego układzie współrzędnych leży localPos
//   pivot    – (planety) punkt planety, obrócony o nachylenie osi; w nim bryła, pierścienie, księżyce
const bodies = [];       // Słońce + planety
const moons = [];        // wszystkie księżyce
const allBodies = [];    // wszystko razem

for (const def of BODIES) {
  const b = {
    def, name: def.name, kind: def.type === 'star' ? 'star' : 'planet',
    radiusUnits: kmToUnits(def.radiusKm), holder: systemGroup,
    localPos: new THREE.Vector3(), worldPos: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 1, moons: [],
  };
  b.extentUnits = b.radiusUnits * ringExtent(def);
  b.pivot = new THREE.Object3D();
  b.pivot.rotation.z = def.tilt * DEG;
  systemGroup.add(b.pivot);

  b.mesh = new THREE.Mesh(sphereGeometry, makePlanetMaterial(def));
  b.mesh.scale.setScalar(b.radiusUnits);
  b.mesh.visible = false;
  b.pivot.add(b.mesh);
  for (const ring of def.rings || []) b.mesh.add(makeRingMesh(def, ring));

  b.marker = makeMarker(def.color, def.type === 'star' ? SUN_MARKER_SIZE_PX : MARKER_SIZE_PX);
  b.pivot.add(b.marker);

  if (def.au > 0) {
    b.orbit = makeCircleLineXZ(def.au * M_PER_AU, ORBIT_SEGMENTS, def.color, ORBIT_OPACITY);
    systemGroup.add(b.orbit);
  }
  b.label = makeLabel(def.name);
  mode1Labels.add(b.label);

  // Księżyce – w płaszczyźnie równika planety (nachylone razem z nią)
  const rnd = seededRandom('moons-' + def.id);
  for (const md of MOONS[def.id] || []) {
    const frame = new THREE.Object3D();
    frame.rotation.z = (md.incl || 0) * DEG;
    b.pivot.add(frame);
    const m = {
      def: md, name: md.name, kind: 'moon', parent: b,
      radiusUnits: kmToUnits(md.radiusKm), orbitUnits: kmToUnits(md.aKm), holder: frame,
      localPos: new THREE.Vector3(), worldPos: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 1, active: false,
    };
    m.extentUnits = m.radiusUnits;
    const step = (Math.PI * 2) / MOON_ORBIT_SEGMENTS;        // księżyc dokładnie na wierzchołku linii orbity
    const ang = Math.round((rnd() * Math.PI * 2) / step) * step;
    m.localPos.set(Math.cos(ang) * m.orbitUnits, 0, -Math.sin(ang) * m.orbitUnits);

    m.mesh = new THREE.Mesh(sphereGeometry, new THREE.MeshLambertMaterial({ color: md.color }));
    m.mesh.position.copy(m.localPos);
    m.mesh.scale.setScalar(m.radiusUnits);
    m.mesh.visible = false;
    m.marker = makeMarker(md.color, MOON_MARKER_SIZE_PX);
    m.marker.position.copy(m.localPos);
    m.orbit = makeCircleLineXZ(m.orbitUnits, MOON_ORBIT_SEGMENTS, md.color, MOON_ORBIT_OPACITY);
    frame.add(m.mesh, m.marker, m.orbit);
    m.label = makeLabel(md.name);
    mode1Labels.add(m.label);
    b.moons.push(m);
    moons.push(m);
  }
  b.moonSystemUnits = Math.max(0, ...b.moons.map(m => m.orbitUnits));
  bodies.push(b);
}
allBodies.push(...bodies, ...moons);

// Kolejność ważności etykiet przy nakładaniu: Słońce, planety od zewnętrznych, potem duże księżyce
const labelPriority = [bodies[0], ...bodies.slice(1).reverse(), ...moons.slice().sort((a, b) => b.radiusUnits - a.radiusUnits)];

let simulatedDays = 0;
function updateOrbitPositions() {
  const days = (Date.now() - J2000_MS) / 86400000 + simulatedDays;
  const snap = TIME_SPEED_DAYS_PER_SEC === 0;
  for (const b of bodies) {
    if (b.def.au <= 0) continue;
    let angle = orbitAngle(b.def, days);
    if (snap) {
      // Planeta dokładnie na wierzchołku linii orbity (przy dużym powiększeniu leży idealnie na linii)
      const step = (Math.PI * 2) / ORBIT_SEGMENTS;
      angle = Math.round(angle / step) * step;
    }
    const r = b.def.au * M_PER_AU;
    b.localPos.set(Math.cos(angle) * r, 0, -Math.sin(angle) * r);
    b.pivot.position.copy(b.localPos);
  }
}
updateOrbitPositions();

function resetSystem() {
  state.focus = null;
  systemGroup.position.set(...SYSTEM_START_POSITION);
  systemGroup.quaternion.identity();
  systemGroup.scale.setScalar(1);
  systemGroup.updateMatrixWorld(true);
}

// =====================================================================
//  STAN APLIKACJI
// =====================================================================
const state = {
  mode: 1,
  hoveredButton: null,
  status: '',
  menuNeedsPlacement: true,
  fps: 0,
  focus: null,           // animacja "leć do planety"
  lastFocusBody: null,
  hoverBody: null,       // Tryb 1: ciało wskazane promieniem
  knife: false,          // Tryb 2: nóż włączony
  m2Hover: new Set(),    // Tryb 2: wskazane planety (pokazują tabliczkę)
  m2Placed: false,
  m3Placed: false,
};

// =====================================================================
//  CHWYTANIE
//   jedna ręka: 'lever' = obiekt sztywno przyczepiony do dłoni (przesuwanie + obrót)
//               'spin'  = obracanie globusa wokół jego środka
//   dwie ręce:  skalowanie (odległość dłoni) + obrót + przesuwanie
// =====================================================================
const grabs = new Map();   // obiekt -> { ctrls, opts, dane startowe }

function startGrab(target, ctrl, opts, pullTo = null) {
  let g = grabs.get(target);
  if (!g) { g = { target, ctrls: [], opts }; grabs.set(target, g); }
  if (g.ctrls.includes(ctrl) || g.ctrls.length >= 2) return;
  g.ctrls.push(ctrl);
  ctrl.userData.grabTarget = target;
  initGrab(g, g.ctrls.length === 1 ? pullTo : null);
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

// Puść obiekt (np. gdy znika po przecięciu). Zwraca kontrolery, które go trzymały.
function releaseTarget(target) {
  const g = grabs.get(target);
  if (!g) return [];
  for (const c of g.ctrls) c.userData.grabTarget = null;
  grabs.delete(target);
  return g.ctrls.slice();
}

function cancelAllGrabs() {
  for (const g of grabs.values()) for (const c of g.ctrls) c.userData.grabTarget = null;
  grabs.clear();
}

function reinitGrab(target) {
  const g = grabs.get(target);
  if (g) initGrab(g);
}

// Zapamiętaj stan początkowy chwytu (wywoływane przy każdej zmianie liczby rąk)
function initGrab(g, pullTo = null) {
  const t = g.target;
  t.updateMatrixWorld(true);
  for (const c of g.ctrls) c.updateMatrixWorld(true);
  if (g.ctrls.length === 1) {
    const c = g.ctrls[0];
    if (g.opts.oneHand === 'spin') {
      g.v0 = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld).sub(t.position);
      g.v0 = g.v0.lengthSq() > 1e-6 ? g.v0.normalize() : null;
      g.q0 = t.quaternion.clone();
    } else {
      // offset = położenie obiektu w układzie współrzędnych kontrolera
      const off = new THREE.Matrix4().copy(c.matrixWorld).invert().multiply(t.matrixWorld);
      g.offPos = new THREE.Vector3(); g.offQuat = new THREE.Quaternion(); g.offScale = new THREE.Vector3();
      off.decompose(g.offPos, g.offQuat, g.offScale);
      g.pullFrom = pullTo ? g.offPos.clone() : null;
      g.pullTo = pullTo;
      g.pullT = 0;
    }
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

function updateGrabs(dt) {
  for (const g of grabs.values()) {
    const t = g.target;
    if (g.ctrls.length === 1) {
      const c = g.ctrls[0];
      if (g.opts.oneHand === 'spin') {
        if (!g.v0) continue;
        const v = _v1.setFromMatrixPosition(c.matrixWorld).sub(t.position);
        if (v.lengthSq() < 1e-6) continue;
        _q1.setFromUnitVectors(g.v0, v.normalize());
        t.quaternion.copy(_q1).multiply(g.q0);
      } else {
        let off = g.offPos;
        if (g.pullTo) {                                    // chwyt z daleka: planeta przylatuje do ręki
          g.pullT = Math.min(1, g.pullT + dt / PULL_DURATION_S);
          off = _v1.lerpVectors(g.pullFrom, g.pullTo, smooth(g.pullT));
        }
        _m2.compose(off, g.offQuat, g.offScale);
        _m1.multiplyMatrices(c.matrixWorld, _m2);
        _m1.decompose(t.position, t.quaternion, _scale);   // skala bez zmian
      }
    } else if (g.ctrls.length >= 2) {
      const a = _v1.setFromMatrixPosition(g.ctrls[0].matrixWorld);
      const b = _v2.setFromMatrixPosition(g.ctrls[1].matrixWorld);
      const mid = _v3.copy(a).add(b).multiplyScalar(0.5);
      const dir = b.sub(a);                                 // uwaga: _v2 staje się wektorem kierunku
      const dist = Math.max(dir.length(), 0.01);
      dir.normalize();
      const newScale = THREE.MathUtils.clamp(g.scale0 * dist / g.dist0, g.opts.minScale, g.opts.maxScale);
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

const MODE1_GRAB = { minScale: SYSTEM_SCALE_MIN, maxScale: SYSTEM_SCALE_MAX, oneHand: 'lever' };
const MODE2_GRAB = { minScale: MODE2_SCALE_MIN, maxScale: MODE2_SCALE_MAX, oneHand: 'lever' };
const MODE3_GRAB = { minScale: MODE3_SCALE_MIN, maxScale: MODE3_SCALE_MAX, oneHand: 'spin' };

// =====================================================================
//  TRYB 1: widoczność, etykiety, przybliżanie, "leć do planety"
// =====================================================================

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

// Bryła czy marker + ustawienie etykiety dla jednego ciała
function updateBodyView(b, s, pixelAngle, tanLabel) {
  b.worldPos.copy(b.localPos).applyMatrix4(b.holder.matrixWorld);
  b.dir.subVectors(b.worldPos, eyePos);
  b.dist = b.dir.length();
  b.dir.divideScalar(b.dist || 1);
  const rWorld = b.radiusUnits * s;
  const px = b.dist > rWorld ? (2 * Math.atan(rWorld / b.dist)) / pixelAngle : Infinity;   // rozmiar na ekranie
  const showBody = px > BODY_SWITCH_PX;
  b.mesh.visible = showBody;
  b.marker.visible = !showBody;

  // Etykieta: stały rozmiar kątowy, nad bryłą lub markerem
  const h = b.dist * tanLabel;
  const markerR = 0.5 * b.marker.material.size * pixelAngle * b.dist;
  const offset = Math.max(showBody ? rWorld : 0, markerR) * 1.15 + h * 0.15;
  b.label.position.copy(b.worldPos).addScaledVector(UP, offset);
  b.label.scale.set(h * b.label.userData.aspect, h, 1);
  b.label.userData.blocked = b.dist <= rWorld * 1.02;     // jesteśmy w środku bryły
}

function updateSystemView() {
  const s = systemGroup.scale.x;
  const pixelAngle = getPixelAngle();
  const tanLabel = Math.tan(LABEL_ANGLE_DEG * DEG);
  const minSepCos = Math.cos(LABEL_MIN_SEPARATION_DEG * DEG);
  const showOrbits = s < ORBIT_HIDE_SCALE;

  for (const b of bodies) {
    updateBodyView(b, s, pixelAngle, tanLabel);
    if (b.orbit) b.orbit.visible = showOrbits;
    for (const m of b.moons) {
      // księżyc pojawia się dopiero, gdy jego orbita jest na ekranie odpowiednio duża
      const orbitPx = (m.orbitUnits * s / Math.max(b.dist, 1e-9)) / pixelAngle;
      m.active = orbitPx > MOON_SYSTEM_MIN_PX;
      m.orbit.visible = m.active;
      if (!m.active) {
        m.mesh.visible = m.marker.visible = false;
        m.label.userData.blocked = true;
        continue;
      }
      updateBodyView(m, s, pixelAngle, tanLabel);
    }
  }

  // Ukrywanie nakładających się etykiet (ważniejsze wygrywają; wskazane promieniem zawsze widoczne)
  const shown = [];
  const hb = state.hoverBody;
  for (const b of labelPriority) b.label.material.color.set(0xffffff);
  if (hb && !hb.label.userData.blocked) {
    hb.label.material.color.set(COLOR_LABEL_HOVER);
    shown.push(hb);
  }
  for (const b of labelPriority) {
    if (b === hb && shown.includes(b)) { b.label.visible = true; continue; }
    let ok = !b.label.userData.blocked;
    for (let i = 0; ok && i < shown.length; i++) if (b.dir.dot(shown[i].dir) > minSepCos) ok = false;
    b.label.visible = ok;
    if (ok) shown.push(b);
  }
}

// Ciało niebieskie, na które wskazuje promień (z tolerancją kątową)
function pickBody(origin, dir) {
  let best = null, bestScore = 1;
  const minAngle = FOCUS_PICK_ANGLE_DEG * DEG;
  const s = systemGroup.scale.x;
  for (const b of allBodies) {
    if (b.kind === 'moon' && !b.active) continue;
    const v = _v4.subVectors(b.worldPos, origin);
    const d = v.length();
    if (d < 1e-9) continue;
    const cos = v.dot(dir) / d;
    if (cos <= 0) continue;
    const angle = Math.acos(Math.min(1, cos));
    const thr = Math.max(minAngle, Math.atan((b.radiusUnits * s) / d) * 1.1);
    const score = angle / thr;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  return best;
}

// Przelot: planeta płynnie przylatuje przed oczy i rośnie do wygodnego rozmiaru.
// Ponowny "lot" do tej samej planety pokazuje cały układ jej księżyców.
function startFocus(body) {
  cancelAllGrabs();
  systemGroup.updateMatrixWorld(true);
  const s0 = systemGroup.scale.x;
  const bodyScale = FOCUS_BODY_RADIUS_M / body.extentUnits;
  const atBody = state.lastFocusBody === body && Math.abs(Math.log(s0 / bodyScale)) < 0.2;
  const systemView = atBody && body.moonSystemUnits > 0;
  let s1 = systemView ? FOCUS_SYSTEM_RADIUS_M / body.moonSystemUnits : bodyScale;
  s1 = THREE.MathUtils.clamp(s1, SYSTEM_SCALE_MIN, SYSTEM_SCALE_MAX);

  const fwd = _v1.set(0, 0, -1).applyQuaternion(headQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const dist = systemView ? FOCUS_SYSTEM_RADIUS_M + FOCUS_DISTANCE_M : FOCUS_DISTANCE_M + FOCUS_BODY_RADIUS_M;
  const P1 = eyePos.clone().addScaledVector(fwd, dist);
  P1.y -= 0.1;
  const local = body.worldPos.clone().applyMatrix4(_m1.copy(systemGroup.matrixWorld).invert());
  state.focus = { t: 0, s0, s1, P0: body.worldPos.clone(), P1, local };
  state.lastFocusBody = body;
  if (!renderer.xr.isPresenting) orbitControls.target.copy(P1);
}

function updateFocus(dt) {
  const f = state.focus;
  if (!f) return;
  f.t = Math.min(1, f.t + dt / FOCUS_DURATION_S);
  const e = smooth(f.t);
  const s = f.s0 * Math.pow(f.s1 / f.s0, e);              // skala zmienia się logarytmicznie (płynny zoom)
  const P = _v2.lerpVectors(f.P0, f.P1, e);
  systemGroup.scale.setScalar(s);
  systemGroup.position.copy(f.local).applyQuaternion(systemGroup.quaternion).multiplyScalar(s);
  systemGroup.position.subVectors(P, systemGroup.position);
  systemGroup.updateMatrixWorld(true);
  if (f.t >= 1) state.focus = null;
}

// Powiększenie układu wokół punktu (gałka, klawisze +/-)
function zoomSystemAround(pivot, factor) {
  const s0 = systemGroup.scale.x;
  const s1 = THREE.MathUtils.clamp(s0 * factor, SYSTEM_SCALE_MIN, SYSTEM_SCALE_MAX);
  const r = s1 / s0;
  systemGroup.position.sub(pivot).multiplyScalar(r).add(pivot);
  systemGroup.scale.setScalar(s1);
  systemGroup.updateMatrixWorld(true);
  reinitGrab(systemGroup);
}

// =====================================================================
//  TRYB 2: DUŻE PLANETY + NÓŻ
// =====================================================================
const mode2Group = new THREE.Group();
mode2Group.visible = false;
scene.add(mode2Group);

// Światło "z głowy" – planety zawsze ładnie oświetlone od strony patrzącego
function makeHeadlight(group) {
  group.add(new THREE.AmbientLight(0xffffff, MODE23_AMBIENT));
  const light = new THREE.DirectionalLight(0xffffff, MODE23_HEADLIGHT);
  group.add(light, light.target);
  return light;
}
const mode2Light = makeHeadlight(mode2Group);

// Wygląd planety (kula + pierścienie), opcjonalnie przycięty płaszczyzną
function buildPlanetVisual(def, R, clipPlane = null) {
  const clip = clipPlane ? [clipPlane] : null;
  const group = new THREE.Group();
  group.rotation.z = def.tilt * DEG;
  const mat = makePlanetMaterial(def, clip);
  const sphere = new THREE.Mesh(sphereGeometryHi, mat);
  sphere.scale.setScalar(R);
  group.add(sphere);
  const materials = [mat];
  for (const ring of def.rings || []) {
    const r = makeRingMesh(def, ring, clip);
    sphere.add(r);
    materials.push(r.material);
  }
  return { group, materials };
}

// Planety Trybu 2 (Słońce + 8 planet)
const m2Items = [];
for (const def of BODIES) {
  if (def.id === 'pluto') continue;
  const R = MODE2_EARTH_RADIUS_M * Math.pow(def.radiusKm / EARTH_RADIUS_KM, MODE2_SIZE_EXPONENT);
  const item = { kind: 'whole', def, R, extent: R * ringExtent(def), obj: new THREE.Group(), cutPair: null };
  item.obj.add(buildPlanetVisual(def, R).group);
  item.nameLabel = makeLabel(def.name);
  item.infoLabel = makeInfoLabel(def);
  item.infoLabel.visible = false;
  mode2Group.add(item.obj, item.nameLabel, item.infoLabel);
  m2Items.push(item);
}
let m2Pairs = [];     // przecięte planety: { whole, a, b, glue }

// Wszystko, co można złapać w Trybie 2: całe planety + połówki
function m2Grabbables() {
  const list = [];
  for (const it of m2Items) if (!it.cutPair) list.push(it);
  for (const p of m2Pairs) list.push(p.a, p.b);
  return list;
}

// Ustaw planety na łuku przed użytkownikiem (od lewej: Słońce, Merkury, ... Neptun)
function layoutMode2() {
  glueAll(true);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  let arcR = MODE2_ARC_RADIUS_M;
  const widthAngle = r => m2Items.reduce((sum, it) => sum + (2 * it.extent + MODE2_GAP_M) / (r + it.R), 0);
  while (widthAngle(arcR) > MODE2_MAX_ARC_DEG * DEG) arcR *= 1.08;
  let angle = -widthAngle(arcR) / 2;
  for (const it of m2Items) {
    const span = (2 * it.extent + MODE2_GAP_M) / (arcR + it.R);
    const a = angle + span / 2;
    angle += span;
    const d = arcR + it.R;
    it.obj.position.copy(eyePos).addScaledVector(fwd, Math.cos(a) * d).addScaledVector(right, Math.sin(a) * d);
    it.obj.position.y = eyePos.y + MODE2_HEIGHT_OFFSET_M;
    it.obj.quaternion.identity();
    it.obj.scale.setScalar(1);
    it.obj.updateMatrixWorld(true);
  }
  if (!renderer.xr.isPresenting) orbitControls.target.copy(eyePos).addScaledVector(fwd, arcR).setY(eyePos.y + MODE2_HEIGHT_OFFSET_M);
}

// Który obiekt Trybu 2 chwyta kontroler: najpierw "z ręki" (blisko), potem promieniem
function pickMode2(origin, dir) {
  const list = m2Grabbables();
  let best = null, bestD = Infinity;
  for (const e of list) {
    const d = origin.distanceTo(e.obj.position) - e.R * e.obj.scale.x;
    if (d < NEAR_GRAB_MARGIN_M && d < bestD) { best = e; bestD = d; }
  }
  if (best) return { entry: best, near: true, distance: 0 };
  raycaster.ray.origin.copy(origin);
  raycaster.ray.direction.copy(dir);
  for (const e of list) {
    _sphere.set(e.obj.position, e.R * e.obj.scale.x);
    const hit = raycaster.ray.intersectSphere(_sphere, _v4);
    if (!hit) continue;
    const d = origin.distanceTo(hit);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best ? { entry: best, near: false, distance: bestD } : null;
}

function grabMode2(ctrl) {
  const origin = _v1.setFromMatrixPosition(ctrl.matrixWorld);
  const dir = _v2.set(0, 0, -1).transformDirection(ctrl.matrixWorld);
  const res = pickMode2(origin.clone(), dir.clone());
  if (!res) return;
  const e = res.entry;
  const pullTo = (!res.near && !grabs.has(e.obj))
    ? new THREE.Vector3(0, 0, -(e.R * e.obj.scale.x + PULL_GAP_M))
    : null;
  startGrab(e.obj, ctrl, MODE2_GRAB, pullTo);
}

// ---------- Nóż -------------------------------------------------------
// Tarcza leży w płaszczyźnie YZ kontrolera (jak ostrze trzymane w pięści), normalna = oś X.
const knife = new THREE.Group();
{
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(KNIFE_RADIUS_M, 48),
    new THREE.MeshBasicMaterial({ color: KNIFE_COLOR, transparent: true, opacity: KNIFE_OPACITY, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.y = Math.PI / 2;
  const edgePts = [];
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; edgePts.push(new THREE.Vector3(0, Math.sin(a) * KNIFE_RADIUS_M, Math.cos(a) * KNIFE_RADIUS_M)); }
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineBasicMaterial({ color: 0xffffff }));
  disc.renderOrder = edge.renderOrder = 15;
  knife.add(disc, edge);
  knife.position.set(0, 0, -KNIFE_OFFSET_M);
  knife.visible = false;
}
// Okrąg pokazujący miejsce cięcia na planecie
const cutPreview = (() => {
  const pts = [];
  for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: CUT_PREVIEW_COLOR, depthTest: false }));
  l.renderOrder = 30;
  l.visible = false;
  mode2Group.add(l);
  return l;
})();

const knifeN = new THREE.Vector3(), knifeP = new THREE.Vector3();
function knifePlaneWorld() {
  knife.updateMatrixWorld(true);
  knifeP.setFromMatrixPosition(knife.matrixWorld);
  knifeN.set(1, 0, 0).transformDirection(knife.matrixWorld);
}

// Planeta przecinana przez tarczę (najbliższa środkowi tarczy)
function findCutCandidate(n, p) {
  let best = null;
  for (const it of m2Items) {
    if (it.cutPair) continue;
    const c = it.obj.position;
    const Rw = it.R * it.obj.scale.x;
    const d = _v1.subVectors(c, p).dot(n);
    if (Math.abs(d) > Rw * 0.97) continue;
    const proj = _v2.copy(c).addScaledVector(n, -d);
    const circleR = Math.sqrt(Rw * Rw - d * d);
    const inPlane = proj.distanceTo(p);
    if (inPlane > KNIFE_RADIUS_M + circleR) continue;      // tarcza nie dotyka planety
    if (!best || inPlane < best.score) best = { item: it, score: inPlane, proj: proj.clone(), circleR };
  }
  return best;
}

// Tekstura przekroju: koncentryczne warstwy w miejscu cięcia
function makeCapTexture(def, R, dAbs, capR) {
  const S = 512, k = (S / 2) / capR;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom(def.id + 'cap');
  const layers = LAYERS[def.id] || [{ name: 'Wnętrze', f: 1, color: cssColor(def.color) }];
  for (const L of layers) {
    const lr = L.f * R;
    if (lr <= dAbs) continue;                            // ta warstwa nie sięga płaszczyzny cięcia
    const rr = Math.sqrt(lr * lr - dAbs * dAbs) * k;
    ctx.fillStyle = L.color;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, rr, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 80 * rr / (S / 2); i++) {          // drobne ziarno, żeby nie było "płasko"
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rr;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 2 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, rr, 0, Math.PI * 2); ctx.stroke();
  }
  return canvasTexture(canvas);
}

// Tarcza przekroju leżąca dokładnie w płaszczyźnie cięcia (w układzie lokalnym planety)
function makeCap(def, R, plane) {
  const d = -plane.constant;                          // płaszczyzna: n·x + c = 0  ->  punkt n·(-c)
  const capR = Math.sqrt(Math.max(R * R - d * d, 1e-8));
  const tex = makeCapTexture(def, R, Math.abs(d), capR);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(capR, 96), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.position.copy(plane.normal).multiplyScalar(d);
  mesh.quaternion.setFromUnitVectors(Z_AXIS, plane.normal.clone().negate());   // patrzy w stronę odciętej części
  return mesh;
}

// Połówka: klon planety z płaszczyzną przycinającą + tarcza z warstwami
function makeHalf(item, localPlane) {
  const h = { kind: 'half', def: item.def, R: item.R, obj: new THREE.Group(), localPlane, worldPlane: new THREE.Plane() };
  const vis = buildPlanetVisual(item.def, item.R, h.worldPlane);
  h.materials = vis.materials;
  h.cap = makeCap(item.def, item.R, localPlane);
  h.obj.add(vis.group, h.cap);
  h.obj.position.copy(item.obj.position);
  h.obj.quaternion.copy(item.obj.quaternion);
  h.obj.scale.copy(item.obj.scale);
  mode2Group.add(h.obj);
  return h;
}

function disposeHalf(h) {
  h.obj.removeFromParent();
  for (const m of h.materials) forgetMaterial(m);
  h.cap.geometry.dispose();
  h.cap.material.map.dispose();
  h.cap.material.dispose();
}

// CIĘCIE: planeta dzieli się na dwie połówki wzdłuż płaszczyzny (n, p) w świecie
function cutPlanet(item, n, p) {
  const obj = item.obj;
  obj.updateMatrixWorld(true);
  const inv = _m1.copy(obj.matrixWorld).invert();
  const pL = p.clone().applyMatrix4(inv);
  const nL = n.clone().transformDirection(inv);
  const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(nL, pL);   // A: strona +n
  const planeB = planeA.clone().negate();                                   // B: strona -n
  const holders = releaseTarget(obj);
  const a = makeHalf(item, planeA), b = makeHalf(item, planeB);
  a.obj.position.addScaledVector(n, CUT_SEPARATION_M / 2);
  b.obj.position.addScaledVector(n, -CUT_SEPARATION_M / 2);
  const pair = { whole: item, a, b, glue: null };
  a.pair = b.pair = pair;
  item.cutPair = pair;
  obj.visible = false;
  m2Pairs.push(pair);
  updateHalfPlanes();
  // ręka, która trzymała planetę, trzyma dalej połówkę po swojej stronie
  for (const c of holders) {
    const side = _v1.setFromMatrixPosition(c.matrixWorld).sub(p).dot(n) >= 0 ? a : b;
    startGrab(side.obj, c, MODE2_GRAB);
  }
}

// SKLEJANIE: połówka B płynnie wraca do A, potem obie zastępuje cała planeta
function glueAll(instant = false) {
  for (const pair of m2Pairs) {
    if (instant) { finishGlue(pair); continue; }
    if (pair.glue) continue;
    releaseTarget(pair.b.obj);
    pair.glue = { t: 0, p0: pair.b.obj.position.clone(), q0: pair.b.obj.quaternion.clone(), s0: pair.b.obj.scale.x };
  }
  m2Pairs = m2Pairs.filter(p => !p.done);
}

function finishGlue(pair) {
  const { whole, a, b } = pair;
  const holders = [...releaseTarget(a.obj), ...releaseTarget(b.obj)];
  whole.obj.position.copy(a.obj.position);
  whole.obj.quaternion.copy(a.obj.quaternion);
  whole.obj.scale.copy(a.obj.scale);
  whole.obj.visible = true;
  whole.cutPair = null;
  disposeHalf(a);
  disposeHalf(b);
  pair.done = true;
  for (const c of holders) startGrab(whole.obj, c, MODE2_GRAB);
}

function updateGlue(dt) {
  for (const pair of m2Pairs) {
    const g = pair.glue;
    if (!g) continue;
    g.t = Math.min(1, g.t + dt / GLUE_DURATION_S);
    const e = smooth(g.t), B = pair.b.obj, A = pair.a.obj;
    B.position.lerpVectors(g.p0, A.position, e);
    B.quaternion.slerpQuaternions(g.q0, A.quaternion, e);
    B.scale.setScalar(THREE.MathUtils.lerp(g.s0, A.scale.x, e));
    if (g.t >= 1) finishGlue(pair);
  }
  m2Pairs = m2Pairs.filter(p => !p.done);
}

// Płaszczyzny przycinające muszą poruszać się razem z połówkami
function updateHalfPlanes() {
  for (const pair of m2Pairs) {
    for (const h of [pair.a, pair.b]) {
      h.obj.updateMatrixWorld(true);
      h.worldPlane.copy(h.localPlane).applyMatrix4(h.obj.matrixWorld);
    }
  }
}

function getController(handedness) {
  return controllers.find(c => c.ctrl.userData.handedness === handedness) || null;
}

function updateKnife() {
  const right = getController('right');
  const active = state.mode === 2 && state.knife && right;
  knife.visible = !!active;
  cutPreview.visible = false;
  if (!active) return null;
  const parent = right.grip;
  if (knife.parent !== parent) parent.add(knife);
  parent.updateMatrixWorld(true);
  knifePlaneWorld();
  const cand = findCutCandidate(knifeN, knifeP);
  if (cand) {
    cutPreview.visible = true;
    cutPreview.position.copy(cand.proj);
    cutPreview.quaternion.setFromUnitVectors(Z_AXIS, knifeN);
    cutPreview.scale.setScalar(cand.circleR * 1.003);
  }
  return cand;
}

function tryKnifeCut() {
  const cand = updateKnife();
  if (cand) cutPlanet(cand.item, knifeN.clone(), knifeP.clone());
}

function setKnife(on) {
  state.knife = on;
  if (!on) knife.removeFromParent();
  drawMenu();
}

// Etykiety Trybu 2: nazwa; po wskazaniu/chwyceniu – tabliczka z ciekawostkami
function updateMode2Labels() {
  const tanName = Math.tan(LABEL_ANGLE_DEG * 1.3 * DEG);
  const tanInfo = Math.tan(INFO_LABEL_ANGLE_DEG * DEG);
  for (const it of m2Items) {
    const anchor = it.cutPair ? it.cutPair.a.obj : it.obj;
    const objs = it.cutPair ? [it.cutPair.a.obj, it.cutPair.b.obj] : [it.obj];
    const showInfo = state.m2Hover.has(it.def.id) || objs.some(o => grabs.has(o));
    const dist = Math.max(0.05, anchor.position.distanceTo(eyePos));
    const top = it.R * anchor.scale.x * 1.05 + dist * 0.01;
    for (const [label, visible, tan] of [[it.nameLabel, !showInfo, tanName], [it.infoLabel, showInfo, tanInfo]]) {
      label.visible = visible;
      if (!visible) continue;
      const h = dist * tan;
      label.position.copy(anchor.position).addScaledVector(UP, top);
      label.scale.set(h * label.userData.aspect, h, 1);
    }
  }
}

// =====================================================================
//  TRYB 3: PLANETA Z LUDZIKAMI
// =====================================================================
const mode3Group = new THREE.Group();
mode3Group.visible = false;
scene.add(mode3Group);
const mode3Light = makeHeadlight(mode3Group);

const m3Planet = new THREE.Group();              // to chwytamy; ludziki są jego dziećmi -> rosną razem z nim
mode3Group.add(m3Planet);
const M3_R = MODE3_PLANET_DIAMETER_M / 2;
{
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  drawContinents(canvas.getContext('2d'), 1024, 512, seededRandom('mode3'), MODE3_OCEAN_COLOR, MODE3_LAND_COLORS, 60);
  const mesh = new THREE.Mesh(sphereGeometryHi, new THREE.MeshLambertMaterial({ map: canvasTexture(canvas) }));
  mesh.scale.setScalar(M3_R);
  m3Planet.add(mesh);
}

// Ludzik zbudowany w jednostkach "wysokość ≈ 1.08", stopy na y = 0, patrzy w +Z
const PERSON_UNITS = 1.08;
const legGeo = new THREE.BoxGeometry(0.11, 0.45, 0.13).translate(0, -0.225, 0);
const torsoGeo = new THREE.CapsuleGeometry(0.14, 0.2, 3, 8).translate(0, 0.62, 0);
const headGeo = new THREE.SphereGeometry(0.11, 10, 8).translate(0, 0.97, 0);
const N3 = MODE3_PEOPLE_COUNT;
const legsMesh = new THREE.InstancedMesh(legGeo, new THREE.MeshLambertMaterial({ color: MODE3_PANTS_COLOR }), N3 * 2);
const torsoMesh = new THREE.InstancedMesh(torsoGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N3);
const headMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: MODE3_SKIN_COLOR }), N3);
for (const m of [legsMesh, torsoMesh, headMesh]) { m.frustumCulled = false; m3Planet.add(m); }

const people = [];
{
  const rnd = seededRandom('people');
  const c = new THREE.Color();
  for (let i = 0; i < N3; i++) {
    const p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (p.lengthSq() < 1e-3) p.set(0, 1, 0);
    p.normalize();
    const f = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    f.addScaledVector(p, -f.dot(p));
    if (f.lengthSq() < 1e-4) f.set(1, 0, 0).addScaledVector(p, -p.x);
    f.normalize();
    people.push({ p, f, speed: MODE3_PERSON_SPEED_MPS * (0.7 + rnd() * 0.6), turn: 0, phase: rnd() * 6 });
    torsoMesh.setColorAt(i, c.set(MODE3_SHIRT_COLORS[i % MODE3_SHIRT_COLORS.length]));
  }
  torsoMesh.instanceColor.needsUpdate = true;
}

const _right = new THREE.Vector3();
function updatePeople(dt) {
  const H = MODE3_PERSON_HEIGHT_M / PERSON_UNITS;
  _scale.setScalar(H);
  for (let i = 0; i < N3; i++) {
    const P = people[i];
    // marsz "prosto przed siebie" = obrót po wielkim kole planety
    _right.crossVectors(P.p, P.f).normalize();
    _q1.setFromAxisAngle(_right, P.speed * dt / M3_R);
    P.p.applyQuaternion(_q1).normalize();
    P.f.applyQuaternion(_q1);
    // lekkie, losowe skręcanie
    P.turn = THREE.MathUtils.clamp(P.turn + (Math.random() - 0.5) * MODE3_TURN_NOISE * dt * 4, -1.2, 1.2) * (1 - 0.5 * dt);
    _q1.setFromAxisAngle(P.p, P.turn * dt);
    P.f.applyQuaternion(_q1);
    P.f.addScaledVector(P.p, -P.f.dot(P.p)).normalize();
    P.phase += P.speed * dt / (MODE3_PERSON_HEIGHT_M * 0.35);

    _right.crossVectors(P.p, P.f);                       // x = prawo, y = góra (od środka planety), z = przód
    _m1.makeBasis(_right, P.p, P.f).scale(_scale).setPosition(_v1.copy(P.p).multiplyScalar(M3_R));
    torsoMesh.setMatrixAt(i, _m1);
    headMesh.setMatrixAt(i, _m1);
    const swing = Math.sin(P.phase) * 0.6;
    _m2.makeRotationX(swing).setPosition(-0.07, 0.45, 0);
    legsMesh.setMatrixAt(i * 2, _m3.multiplyMatrices(_m1, _m2));
    _m2.makeRotationX(-swing).setPosition(0.07, 0.45, 0);
    legsMesh.setMatrixAt(i * 2 + 1, _m3.multiplyMatrices(_m1, _m2));
  }
  legsMesh.instanceMatrix.needsUpdate = true;
  torsoMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;
}

function layoutMode3() {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  m3Planet.position.copy(eyePos).addScaledVector(fwd, MODE3_DISTANCE_M);
  m3Planet.position.y = eyePos.y + MODE3_HEIGHT_OFFSET_M;
  m3Planet.quaternion.identity();
  m3Planet.scale.setScalar(1);
  m3Planet.updateMatrixWorld(true);
  if (!renderer.xr.isPresenting) orbitControls.target.copy(m3Planet.position);
}

function updateHeadlight(light) {
  light.position.copy(eyePos).add(_v1.set(0.3, 0.8, 0));
  light.target.position.copy(eyePos).add(_v1.set(0, -0.6, -2).applyQuaternion(headQuat));
}

// =====================================================================
//  MENU (panel z przyciskami, rysowany na canvas)
// =====================================================================
const MENU_CANVAS_W = 1024, MENU_CANVAS_H = 520;
const MENU_HEIGHT_M = MENU_WIDTH_M * MENU_CANVAS_H / MENU_CANVAS_W;
const menuButtons = [
  { id: 'mode1', label: 'Tryb 1', sub: 'Model', x: 24, y: 214, w: 236, h: 140 },
  { id: 'mode2', label: 'Tryb 2', sub: 'Planety', x: 272, y: 214, w: 236, h: 140 },
  { id: 'mode3', label: 'Tryb 3', sub: 'Ludziki', x: 520, y: 214, w: 236, h: 140 },
  { id: 'reset', label: 'Reset', x: 768, y: 214, w: 232, h: 140 },
  { id: 'knife', label: () => state.knife ? 'Nóż: WŁĄCZONY  (A)' : 'Nóż: wyłączony  (A)', x: 24, y: 370, w: 484, h: 124, modes: [2] },
  { id: 'glue', label: 'Sklej planety  (B)', x: 520, y: 370, w: 480, h: 124, modes: [2] },
];
const MENU_HINTS = {
  1: 'Spust: chwyć · 2 spusty: zoom · Gałka: zoom · Grip na planecie: leć do niej',
  2: 'Spust: chwyć/przyciągnij · 2 spusty: skaluj · A: nóż · prawy spust: tnij',
  3: 'Spust: obracaj planetę · 2 spusty: skaluj i przesuwaj',
};
const menuCanvas = document.createElement('canvas');
menuCanvas.width = MENU_CANVAS_W; menuCanvas.height = MENU_CANVAS_H;
const menuCtx = menuCanvas.getContext('2d');
const menuTexture = canvasTexture(menuCanvas);
const menuMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(MENU_WIDTH_M, MENU_HEIGHT_M),
  new THREE.MeshBasicMaterial({ map: menuTexture, transparent: true }),
);
menuMesh.renderOrder = 20;
scene.add(menuMesh);

const menuVisibleButtons = () => menuButtons.filter(b => !b.modes || b.modes.includes(state.mode));
const menuUsedHeight = () => (state.mode === 2 ? 516 : 370);

function drawMenu() {
  const ctx = menuCtx;
  ctx.clearRect(0, 0, MENU_CANVAS_W, MENU_CANVAS_H);
  ctx.fillStyle = COLOR_MENU_BG;
  roundRect(ctx, 0, 0, MENU_CANVAS_W, menuUsedHeight(), 40); ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('Układ Słoneczny VR', 30, 72);
  ctx.fillStyle = '#a9b8d8';
  ctx.font = '34px system-ui, sans-serif';
  ctx.fillText(state.status, 30, 128);
  ctx.fillStyle = '#7f8db0';
  ctx.font = '27px system-ui, sans-serif';
  ctx.fillText(MENU_HINTS[state.mode], 30, 182);

  for (const b of menuVisibleButtons()) {
    const active = b.id === 'mode' + state.mode || (b.id === 'knife' && state.knife);
    ctx.fillStyle = active ? COLOR_MENU_BUTTON_ACTIVE
      : state.hoveredButton === b.id ? COLOR_MENU_BUTTON_HOVER
      : COLOR_MENU_BUTTON;
    roundRect(ctx, b.x, b.y, b.w, b.h, 26); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = typeof b.label === 'function' ? b.label() : b.label;
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 - (b.sub ? 20 : 0));
    if (b.sub) {
      ctx.font = '34px system-ui, sans-serif';
      ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 26);
    }
  }
  ctx.textAlign = 'left';
  menuTexture.needsUpdate = true;
}

// Z punktu trafienia promienia (UV) -> który przycisk
function menuButtonAtUV(uv) {
  const x = uv.x * MENU_CANVAS_W, y = (1 - uv.y) * MENU_CANVAS_H;
  return menuVisibleButtons().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

function onMenuButton(button) {
  if (!button) return;
  switch (button.id) {
    case 'mode1': setMode(1); break;
    case 'mode2': setMode(2); break;
    case 'mode3': setMode(3); break;
    case 'reset': resetCurrentMode(); break;
    case 'knife': setKnife(!state.knife); break;
    case 'glue': glueAll(); break;
  }
  drawMenu();
}

function setMode(mode) {
  state.mode = mode;
  cancelAllGrabs();
  state.focus = null;
  state.hoverBody = null;
  setKnife(false);
  systemGroup.visible = mode1Labels.visible = mode === 1;
  mode2Group.visible = mode === 2;
  mode3Group.visible = mode === 3;
  if (mode === 1 && !renderer.xr.isPresenting) orbitControls.target.set(...SYSTEM_START_POSITION);
  if (mode === 2 && !state.m2Placed) { layoutMode2(); state.m2Placed = true; }
  if (mode === 3 && !state.m3Placed) { layoutMode3(); state.m3Placed = true; }
  if (mode === 2 && !renderer.xr.isPresenting) layoutMode2Target();
  if (mode === 3 && !renderer.xr.isPresenting) orbitControls.target.copy(m3Planet.position);
  drawMenu();
}

function layoutMode2Target() {
  const c = new THREE.Vector3();
  for (const it of m2Items) c.add(it.obj.position);
  orbitControls.target.copy(c.divideScalar(m2Items.length));
}

function resetCurrentMode() {
  cancelAllGrabs();
  if (state.mode === 1) { resetSystem(); if (!renderer.xr.isPresenting) orbitControls.target.set(...SYSTEM_START_POSITION); }
  if (state.mode === 2) layoutMode2();
  if (state.mode === 3) layoutMode3();
  state.menuNeedsPlacement = true;
}

// Ustaw menu przed oczami użytkownika (poziomo przed nim, nieco niżej, zwrócone do niego)
function placeMenu() {
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

  // Promień do wskazywania
  const rayGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const ray = new THREE.Line(rayGeom, new THREE.LineBasicMaterial({ color: COLOR_RAY, transparent: true, opacity: 0.6 }));
  ray.scale.z = RAY_LENGTH_M;
  ctrl.add(ray);
  const rayDot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: COLOR_RAY }));
  rayDot.visible = false;
  ctrl.add(rayDot);
  ctrl.userData.ray = ray;
  ctrl.userData.rayDot = rayDot;

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

  ctrl.addEventListener('connected', e => {
    ctrl.userData.inputSource = e.data;
    ctrl.userData.handedness = e.data.handedness;
    ctrl.userData.isHand = !!e.data.hand;
    model.visible = !e.data.hand;
  });
  ctrl.addEventListener('disconnected', () => {
    endGrab(ctrl);
    ctrl.userData.inputSource = null;
    ctrl.userData.handedness = null;
  });
  ctrl.addEventListener('selectstart', onSelectStart);
  ctrl.addEventListener('selectend', onSelectEnd);
  scene.add(ctrl);

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

function setRayFromController(ctrl) {
  _m1.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_m1);
}

// Trafienie w panel menu (tylko w jego narysowaną część)
function raycastMenu() {
  if (!menuMesh.visible) return null;
  const hit = raycaster.intersectObject(menuMesh, false)[0];
  if (!hit || hit.distance > 5) return null;
  if ((1 - hit.uv.y) * MENU_CANVAS_H > menuUsedHeight()) return null;
  return hit;
}

const isKnifeHand = ctrl => state.mode === 2 && state.knife && ctrl.userData.handedness === 'right';

function onSelectStart(e) {
  const ctrl = e.target;
  ctrl.updateMatrixWorld(true);
  setRayFromController(ctrl);
  const hit = raycastMenu();
  if (hit) {                                   // klik w menu ma pierwszeństwo przed chwytaniem
    ctrl.userData.menuPress = true;
    onMenuButton(menuButtonAtUV(hit.uv));
    return;
  }
  if (state.mode === 1) { state.focus = null; startGrab(systemGroup, ctrl, MODE1_GRAB); }
  if (state.mode === 2) { if (isKnifeHand(ctrl)) tryKnifeCut(); else grabMode2(ctrl); }
  if (state.mode === 3) startGrab(m3Planet, ctrl, MODE3_GRAB);
}

function onSelectEnd(e) {
  const ctrl = e.target;
  if (ctrl.userData.menuPress) { ctrl.userData.menuPress = false; return; }
  endGrab(ctrl);
}

// Przyciski gamepada (A/B/X/Y/grip) – wykrywanie momentu wciśnięcia
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
  if (state.mode === 1 && index === FOCUS_BUTTON) {
    setRayFromController(ctrl);
    const b = pickBody(raycaster.ray.origin, raycaster.ray.direction);
    if (b) startFocus(b);
  }
  if (state.mode === 2 && hand === 'right' && index === KNIFE_BUTTON) setKnife(!state.knife);
  if (state.mode === 2 && hand === 'right' && index === RESET_BUTTON) glueAll();
}

// Gałka: płynny zoom układu wokół dłoni (Tryb 1)
function stickZoom(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(y) < STICK_DEADZONE) return;
  state.focus = null;
  zoomSystemAround(_v4.setFromMatrixPosition(ctrl.matrixWorld), Math.pow(STICK_ZOOM_RATE, -y * dt));
}

// =====================================================================
//  MYSZ I KLAWIATURA (podgląd na PC)
//   klik w panel = przycisk, podwójny klik na planecie = leć do niej (Tryb 1)
//   +/- = zoom układu (Tryb 1), C = przetnij wskazaną planetę, G = sklej (Tryb 2)
// =====================================================================
const pointer = new THREE.Vector2();
let pointerInside = false;
let pointerDownAt = null;
function setRayFromMouse(e) {
  if (e) pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
renderer.domElement.addEventListener('pointerdown', e => { pointerDownAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (renderer.xr.isPresenting || !pointerDownAt) return;
  const moved = Math.hypot(e.clientX - pointerDownAt[0], e.clientY - pointerDownAt[1]);
  pointerDownAt = null;
  if (moved > 6) return;                         // to było przeciągnięcie widoku, nie klik
  setRayFromMouse(e);
  const hit = raycastMenu();
  if (hit) onMenuButton(menuButtonAtUV(hit.uv));
});
renderer.domElement.addEventListener('dblclick', e => {
  if (renderer.xr.isPresenting || state.mode !== 1) return;
  setRayFromMouse(e);
  const b = pickBody(raycaster.ray.origin, raycaster.ray.direction);
  if (b) startFocus(b);
});
renderer.domElement.addEventListener('pointermove', e => { pointerInside = true; setRayFromMouse(e); });
renderer.domElement.addEventListener('pointerleave', () => { pointerInside = false; });
window.addEventListener('keydown', e => {
  if (renderer.xr.isPresenting) return;
  if (state.mode === 1 && (e.key === '+' || e.key === '=')) zoomSystemAround(orbitControls.target.clone(), 2);
  if (state.mode === 1 && e.key === '-') zoomSystemAround(orbitControls.target.clone(), 0.5);
  if (state.mode === 2 && (e.key === 'c' || e.key === 'C')) {
    setRayFromMouse();
    const res = pickMode2(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    if (res && res.entry.kind === 'whole') {
      const n = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);   // cięcie pionowe, prostopadłe do ekranu
      cutPlanet(res.entry, n, res.entry.obj.position.clone());
      // rozsuń połówki, żeby było widać wnętrze
      const pair = res.entry.cutPair;
      pair.a.obj.position.addScaledVector(n, pair.a.R * 0.6);
      pair.b.obj.position.addScaledVector(n, -pair.a.R * 0.6);
      pair.a.obj.rotateOnWorldAxis(UP, -0.5);
      pair.b.obj.rotateOnWorldAxis(UP, 0.5);
    }
  }
  if (state.mode === 2 && (e.key === 'g' || e.key === 'G')) glueAll();
});

// =====================================================================
//  SESJA VR
// =====================================================================
renderer.xr.addEventListener('sessionstart', () => {
  state.menuNeedsPlacement = true;
  state.m2Placed = state.m3Placed = false;      // ułóż planety Trybów 2/3 względem pozycji w goglach
  state.needsModeLayout = true;
  const session = renderer.xr.getSession();
  if (session && session.updateTargetFrameRate && session.supportedFrameRates
      && Array.from(session.supportedFrameRates).includes(TARGET_FPS)) {
    session.updateTargetFrameRate(TARGET_FPS).catch(() => {});
  }
});
renderer.xr.addEventListener('sessionend', () => {
  cancelAllGrabs();
  setKnife(false);
  state.menuNeedsPlacement = true;
  state.m2Placed = state.m3Placed = false;
  state.needsModeLayout = true;
});

// =====================================================================
//  PĘTLA KLATEK
// =====================================================================
const eyePos = new THREE.Vector3();
const headQuat = new THREE.Quaternion();
let lastTime = 0, fpsFrames = 0, fpsTime = 0, statusTime = 0;

function formatLength(m) {
  if (m < 1) return `${(m * 100).toFixed(m < 0.1 ? 1 : 0)} cm`;
  if (m < 1000) return `${m.toFixed(m < 10 ? 1 : 0)} m`;
  return `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: m < 1e4 ? 2 : 0 })} km`;
}

function formatScale(s) {
  if (s < 10) return s.toFixed(2);
  if (s < 1e4) return s.toFixed(0);
  return s.toExponential(1).replace('e+', '·10^');
}

function updateStatus(time) {
  let text;
  if (state.mode === 1) {
    const s = systemGroup.scale.x;
    text = `Skala ×${formatScale(s)}  ·  ⌀ orbity Plutona ${formatLength(SYSTEM_DIAMETER_M * s)}  ·  ${state.fps} FPS`;
  } else if (state.mode === 2) {
    text = `Nóż: ${state.knife ? 'WŁĄCZONY' : 'wyłączony'}  ·  przecięte: ${m2Pairs.length}  ·  ${state.fps} FPS`;
  } else {
    text = `Skala ×${m3Planet.scale.x.toFixed(2)}  ·  ⌀ planety ${formatLength(MODE3_PLANET_DIAMETER_M * m3Planet.scale.x)}  ·  ${state.fps} FPS`;
  }
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
  const presenting = renderer.xr.isPresenting;
  if (frame && presenting) {
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

  // Po wejściu do VR: ułóż bieżący tryb względem pozycji w goglach
  if (state.needsModeLayout && (!presenting || frame)) {
    state.needsModeLayout = false;
    if (state.mode === 2) { layoutMode2(); state.m2Placed = true; }
    if (state.mode === 3) { layoutMode3(); state.m3Placed = true; }
  }

  // Menu: ustaw przed użytkownikiem na starcie, po Y lub gdy jest za daleko
  if (state.menuNeedsPlacement || menuMesh.position.distanceTo(eyePos) > MENU_MAX_DISTANCE_M) placeMenu();

  // Kontrolery: przyciski, gałka, promienie, podświetlenia
  let hovered = null;
  let hoverBody = null;
  state.m2Hover.clear();
  for (const { ctrl, grip } of controllers) {
    ctrl.updateMatrixWorld(true);
    grip.updateMatrixWorld(true);
    pollButtons(ctrl);
    if (state.mode === 1 && presenting) stickZoom(ctrl, dt);
    const knifeHand = isKnifeHand(ctrl);
    ctrl.userData.ray.visible = presenting && !knifeHand;
    ctrl.userData.rayDot.visible = false;
    if (!presenting) continue;
    setRayFromController(ctrl);
    const hit = raycastMenu();
    let rayLen = RAY_LENGTH_M;
    if (hit) {
      rayLen = hit.distance;
      ctrl.userData.rayDot.visible = true;
      ctrl.userData.rayDot.position.set(0, 0, -hit.distance);
      const b = menuButtonAtUV(hit.uv);
      if (b) hovered = b.id;
    } else if (state.mode === 1 && !ctrl.userData.grabTarget) {
      hoverBody = hoverBody || pickBody(raycaster.ray.origin, raycaster.ray.direction);
    } else if (state.mode === 2 && !knifeHand) {
      const res = pickMode2(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
      if (res) {
        state.m2Hover.add(res.entry.def.id);
        if (!res.near) rayLen = res.distance;
      }
    }
    ctrl.userData.ray.scale.z = rayLen;
  }
  if (!presenting && pointerInside) {
    // podgląd na PC: wskazywanie myszą
    setRayFromMouse();
    const hit = raycastMenu();
    if (hit) { const b = menuButtonAtUV(hit.uv); hovered = b ? b.id : null; }
    else if (state.mode === 1) hoverBody = pickBody(raycaster.ray.origin, raycaster.ray.direction);
    else if (state.mode === 2) {
      const res = pickMode2(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
      if (res) state.m2Hover.add(res.entry.def.id);
    }
  }
  state.hoverBody = hoverBody;
  if (hovered !== state.hoveredButton) { state.hoveredButton = hovered; drawMenu(); }

  updateFocus(dt);
  updateGlue(dt);
  updateGrabs(dt);
  updateHandMeshes();

  if (state.mode === 1) {
    if (TIME_SPEED_DAYS_PER_SEC !== 0) { simulatedDays += dt * TIME_SPEED_DAYS_PER_SEC; updateOrbitPositions(); }
    systemGroup.updateMatrixWorld(true);
    updateSystemView();
  } else if (state.mode === 2) {
    updateHalfPlanes();
    updateKnife();
    updateMode2Labels();
    updateHeadlight(mode2Light);
  } else {
    updatePeople(dt);
    updateHeadlight(mode3Light);
  }

  stars.position.copy(eyePos);       // gwiazdy zawsze "w nieskończoności"
  updateStatus(time);
  renderer.render(scene, camera);
});

resetSystem();
setMode(1);

// Dostęp do obiektów z konsoli przeglądarki (pomocne przy debugowaniu)
window.solar = {
  THREE, scene, camera, renderer, state, systemGroup, bodies, moons, orbitControls,
  m2Items, get m2Pairs() { return m2Pairs; }, m3Planet, people,
  setMode, startFocus, cutPlanet, glueAll, startGrab, endGrab, updateGrabs, grabs, zoomSystemAround,
  controllers, setKnife, updateKnife, tryKnifeCut, grabMode2,
};
