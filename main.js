// =====================================================================
//  UKŁAD SŁONECZNY VR  –  WebXR (Meta Quest 3 / 3S, Meta Quest Browser)
//
//  Tryb 1: model całego układu (do orbity Plutona) z księżycami
//  Tryb 2: planety i księżyce w prawdziwych proporcjach + nóż do przecinania
//  Tryb 3: mała planeta z chodzącymi ludzikami
//  Tryb 4: niezwykłe obiekty (czarna dziura, pulsar, biały karzeł, kometa)
//  Tryb 5: kosmos w największej skali – galaktyki i sieć kosmiczna
//  Tryb 6: skala – od bakterii do Ziemi (skoki i płynny zoom)
// =====================================================================
//
//  Wszystkie ustawienia, które warto zmieniać, są w sekcji KONFIGURACJA
//  poniżej. Reszta pliku to logika aplikacji.
//
// =====================================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =====================================================================
//  KONFIGURACJA
// =====================================================================

// --- Tryb 1: model układu -------------------------------------------
const SYSTEM_DIAMETER_M = 5.0;                 // średnica orbity Plutona przy skali 1 [m]
const SYSTEM_START_POSITION = [0, 1.0, -3.2];  // środek układu (Słońce) na starcie [m] (x, y, z)
const SYSTEM_SCALE_MIN = 0.03;                 // 0.03 × 5 m = 15 cm  ("trzymam w dłoni")
const SYSTEM_SCALE_MAX = 5e6;                  // 5 mln × – można dolecieć do planety i zobaczyć ją jak piłkę
const USE_REAL_POSITIONS = true;               // true = planety w przybliżonych pozycjach na dziś
const TIME_SPEEDS = [0.1, 1, 5, 20, 100, 365];  // prędkości czasu do wyboru w menu [dni na sekundę]
const TIME_SPEED_DEFAULT_INDEX = 2;            // na start: 5 dni/s (rok Ziemi trwa ~73 s)
const TIME_START_PAUSED = false;               // true = model nieruchomy na starcie
const SPIN_MAX_DEG_S = 120;                    // obrót wokół osi: maks. widoczna prędkość [°/s] (prawdziwa przy
                                               // przyspieszonym czasie byłaby migotaniem, np. Jowisz – 12 obrotów/s)
const MOON_MAX_DEG_S = 90;                     // obieg księżyców: maks. widoczna prędkość [°/s]
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
const INFO_LABEL_ANGLE_DEG = 11;          // Tryby 2 i 4: wysokość tabliczki z ciekawostkami [stopnie]
const LABEL_FONT = 'bold 64px system-ui, "Segoe UI", Roboto, sans-serif';
const COLOR_LABEL_HOVER = 0xffe066;       // podświetlenie etykiety wskazanej promieniem

// --- Rzucanie (Tryby 2, 3, 4): obiekty lecą chwilę i hamują jak w gęstej cieczy, bez grawitacji ---
const THROW_DRAG = 1.6;             // opór ruchu [1/s]: większy = szybciej się zatrzymują
const THROW_ANGULAR_DRAG = 1.2;     // opór obrotu [1/s]
const THROW_SPEED_FACTOR = 1.0;     // mnożnik prędkości rzutu
const THROW_MAX_SPEED = 5;          // maksymalna prędkość po rzucie [m/s]
const THROW_MAX_SPIN = 12;          // maksymalna prędkość obrotu po rzucie [rad/s]
const THROW_SAMPLE_S = 0.1;         // z ilu ostatnich sekund ruchu liczyć prędkość rzutu

// --- Tryb 2: planety i księżyce w prawdziwych proporcjach ---------------
const MODE2_EARTH_RADIUS_M = 0.05;  // promień Ziemi w Trybie 2 [m]; wszystko inne w tej samej skali (Słońce ~5,5 m!)
const MODE2_ARC_RADIUS_M = 1.6;     // planety stoją na łuku: tak daleko od oczu jest ich przednia powierzchnia [m]
const MODE2_MAX_ARC_DEG = 160;      // maksymalna szerokość łuku [stopnie] (gdy więcej – łuk się odsuwa)
const MODE2_GAP_M = 0.12;           // odstęp między planetami [m]
const MODE2_HEIGHT_OFFSET_M = -0.1; // środki planet względem wysokości oczu [m]
const MODE2_SUN_BEHIND_M = 4.0;     // Słońce stoi za łukiem planet: tyle metrów za nim jest jego powierzchnia
const MODE2_SUN_TOP_OFFSET_M = -1.4; // szczyt Słońca tyle poniżej oczu – wschodzi zza "horyzontu" za planetami [m]
const MODE2_MOON_GAP_M = 0.05;      // księżyce leżą pod swoją planetą, w takim odstępie [m]
const MODE2_MOON_LABEL_DISTANCE_M = 1.2; // nazwy księżyców widać z bliska (lub po wskazaniu)
const MODE2_SCALE_MIN = 0.05;       // minimalna skala obiektu (względem rozmiaru startowego)
const MODE2_SCALE_MAX = 40;         // maksymalna skala (np. Europa 2,4 cm -> ~1 m)
const MODE2_SPHERE_SEGMENTS_W = 64; // duże kule – więcej segmentów
const MODE2_SPHERE_SEGMENTS_H = 32;
const NEAR_GRAB_MARGIN_M = 0.06;    // chwyt "z ręki", gdy kontroler jest tak blisko powierzchni [m]
const PICK_TOLERANCE_DEG = 1.5;     // celowanie w małe obiekty: tolerancja [stopnie]
const PULL_GAP_M = 0.12;            // chwyt z daleka: obiekt przylatuje do ręki i zatrzymuje się tyle przed nią [m]
const PULL_DURATION_S = 0.3;        // czas przyciągania [s]

// --- Tryb 4: obiekty (nie w skali – prawdziwe rozmiary na tabliczkach) --------
const MODE4_ARC_RADIUS_M = 1.2;     // odległość obiektów od oczu [m]
const MODE4_GAP_M = 0.3;            // odstęp między obiektami [m]
const MODE4_HEIGHT_OFFSET_M = -0.15;
const PULSAR_SPIN_HZ = 0.5;         // obroty pulsara na sekundę (prawdziwe: od ~1 do 716!)
const BLACK_HOLE_DISK_SPEED = 0.6;  // prędkość wirowania dysku akrecyjnego [rad/s]
const COMET_TAIL_DIRECTION = [1, 0.15, 0.4]; // warkocz zawsze w tę stronę (od "Słońca")

// --- Nóż (Tryby 2 i 4) -----------------------------------------------------
const KNIFE_RADIUS_M = 0.2;         // promień tarczy noża [m]
const KNIFE_OFFSET_M = 0.18;        // środek tarczy przed kontrolerem [m]
const KNIFE_COLOR = 0xbfe8ff;
const KNIFE_OPACITY = 0.28;
const CUT_PREVIEW_COLOR = 0xffe14d;  // okrąg pokazujący, gdzie nastąpi cięcie
const CUT_SEPARATION_M = 0.03;       // po cięciu połówki odsuwają się od siebie o tyle [m]
const GLUE_DURATION_S = 0.4;         // animacja sklejania [s]
const CAP_TEXTURE_SIZE = 1024;       // rozdzielczość przekroju (cienkie skorupy potrzebują pikseli)

// Warstwy wnętrza (przekrój). f = promień ZEWNĘTRZNY warstwy jako ułamek promienia ciała.
// Wartości w prawdziwych proporcjach wg współczesnej wiedzy (sejsmologia Ziemi i Marsa – InSight,
// misje Juno, Cassini, Galileo, Apollo, New Horizons; modele teoretyczne dla gwiazd).
// Tam, gdzie nauka nie jest pewna, nazwa warstwy ma dopisek „(?)”.
const LAYERS = {
  sun:       [ { name: 'Strefa konwektywna', f: 1.000, color: '#ff7a1a' }, { name: 'Strefa promienista', f: 0.713, color: '#ffb43a' },
               { name: 'Jądro (synteza wodoru w hel)', f: 0.250, color: '#fff6c0' } ],
  mercury:   [ { name: 'Skorupa', f: 1.000, color: '#8a8078' }, { name: 'Płaszcz krzemianowy', f: 0.985, color: '#b8643c' },
               { name: 'Jądro zewnętrzne (ciekłe)', f: 0.828, color: '#f29a2e' }, { name: 'Jądro wewnętrzne (stałe, ?)', f: 0.410, color: '#ffe08a' } ],
  venus:     [ { name: 'Skorupa', f: 1.000, color: '#a08060' }, { name: 'Płaszcz krzemianowy', f: 0.995, color: '#c85a30' },
               { name: 'Jądro żelazno-niklowe', f: 0.530, color: '#f2b440' } ],
  earth:     [ { name: 'Skorupa', f: 1.000, color: '#6b5a48' }, { name: 'Płaszcz górny', f: 0.995, color: '#e0702e' },
               { name: 'Płaszcz dolny', f: 0.896, color: '#c4492a' }, { name: 'Jądro zewnętrzne (ciekłe)', f: 0.546, color: '#f29a2e' },
               { name: 'Jądro wewnętrzne (stałe)', f: 0.192, color: '#fff0a0' } ],
  mars:      [ { name: 'Skorupa', f: 1.000, color: '#9a5a3a' }, { name: 'Płaszcz krzemianowy', f: 0.986, color: '#c8643a' },
               { name: 'Warstwa stopionych krzemianów', f: 0.540, color: '#e07a40' }, { name: 'Jądro ciekłe (żelazo z siarką)', f: 0.494, color: '#f0b040' } ],
  jupiter:   [ { name: 'Atmosfera (chmury)', f: 1.000, color: '#d8b98c' }, { name: 'Ciekły wodór cząsteczkowy', f: 0.986, color: '#9fb0d8' },
               { name: 'Wodór metaliczny', f: 0.830, color: '#6878b8' }, { name: 'Rozmyte jądro (ciężkie pierwiastki)', f: 0.450, color: '#c08a50' } ],
  saturn:    [ { name: 'Atmosfera (chmury)', f: 1.000, color: '#e6d29a' }, { name: 'Ciekły wodór cząsteczkowy', f: 0.985, color: '#a8b8d8' },
               { name: 'Wodór metaliczny', f: 0.620, color: '#7080b8' }, { name: 'Rozmyte jądro (lód i skały)', f: 0.500, color: '#c08a50' } ],
  uranus:    [ { name: 'Atmosfera (wodór, hel, metan)', f: 1.000, color: '#9fdbe6' }, { name: 'Płaszcz „lodowy” (woda, amoniak, metan)', f: 0.750, color: '#3f8fb0' },
               { name: 'Jądro skalno-żelazne', f: 0.200, color: '#a07850' } ],
  neptune:   [ { name: 'Atmosfera (wodór, hel, metan)', f: 1.000, color: '#4a6fe0' }, { name: 'Płaszcz „lodowy” (woda, amoniak, metan)', f: 0.800, color: '#2f5aa0' },
               { name: 'Jądro skalno-żelazne', f: 0.250, color: '#a07850' } ],
  pluto:     [ { name: 'Skorupa lodowa (azot, metan, woda)', f: 1.000, color: '#e8dccb' }, { name: 'Ocean (prawdopodobny, ?)', f: 0.850, color: '#3a7bd5' },
               { name: 'Jądro skalne', f: 0.720, color: '#8a6a50' } ],
  moon:      [ { name: 'Skorupa', f: 1.000, color: '#b0aaa0' }, { name: 'Płaszcz', f: 0.977, color: '#8a7a68' },
               { name: 'Częściowo stopiona warstwa', f: 0.277, color: '#c8643a' }, { name: 'Jądro zewnętrzne (ciekłe)', f: 0.190, color: '#f29a2e' },
               { name: 'Jądro wewnętrzne (stałe)', f: 0.148, color: '#fff0a0' } ],
  io:        [ { name: 'Skorupa', f: 1.000, color: '#d8c860' }, { name: 'Warstwa częściowo stopiona (magma)', f: 0.970, color: '#e05a20' },
               { name: 'Płaszcz krzemianowy', f: 0.940, color: '#a8643a' }, { name: 'Jądro (żelazo, siarczek żelaza)', f: 0.520, color: '#f0b040' } ],
  europa:    [ { name: 'Skorupa lodowa', f: 1.000, color: '#eef2f8' }, { name: 'Słony ocean', f: 0.985, color: '#2f6fd0' },
               { name: 'Płaszcz skalny', f: 0.920, color: '#8a6a50' }, { name: 'Jądro żelazne', f: 0.400, color: '#d8a040' } ],
  ganymede:  [ { name: 'Skorupa lodowa', f: 1.000, color: '#d8dde4' }, { name: 'Ocean', f: 0.940, color: '#2f6fd0' },
               { name: 'Lód wysokociśnieniowy', f: 0.900, color: '#a8c8e0' }, { name: 'Płaszcz skalny', f: 0.600, color: '#8a6a50' },
               { name: 'Jądro żelazne', f: 0.250, color: '#d8a040' } ],
  callisto:  [ { name: 'Skorupa lodowa', f: 1.000, color: '#b0a898' }, { name: 'Ocean (prawdopodobny, ?)', f: 0.930, color: '#2f6fd0' },
               { name: 'Mieszanina lodu i skał', f: 0.890, color: '#7a6e60' } ],
  titan:     [ { name: 'Skorupa lodowa', f: 1.000, color: '#e0c890' }, { name: 'Ocean (woda z amoniakiem)', f: 0.960, color: '#2f6fd0' },
               { name: 'Lód wysokociśnieniowy', f: 0.890, color: '#a8c8e0' }, { name: 'Jądro z uwodnionych skał', f: 0.780, color: '#8a6a50' } ],
  enceladus: [ { name: 'Skorupa lodowa', f: 1.000, color: '#f4f8ff' }, { name: 'Globalny ocean', f: 0.910, color: '#2f6fd0' },
               { name: 'Jądro skalne (porowate)', f: 0.740, color: '#8a6a50' } ],
  triton:    [ { name: 'Skorupa (lód azotowy i wodny)', f: 1.000, color: '#e8d8d0' }, { name: 'Płaszcz lodowy (możliwy ocean, ?)', f: 0.880, color: '#a8c8e0' },
               { name: 'Jądro skalno-metaliczne', f: 0.700, color: '#8a6a50' } ],
  charon:    [ { name: 'Płaszcz lodowy', f: 1.000, color: '#c8c8cc' }, { name: 'Jądro skalne', f: 0.660, color: '#8a6a50' } ],
  neutronstar: [ { name: 'Skorupa zewnętrzna (jądra atomowe, elektrony)', f: 1.000, color: '#c0d0ff' },
               { name: 'Skorupa wewnętrzna („jądrowy makaron”)', f: 0.970, color: '#8fa0f0' },
               { name: 'Jądro zewnętrzne (nadciekłe neutrony)', f: 0.920, color: '#6a5ad8' },
               { name: 'Jądro wewnętrzne (nieznane: hiperony? kwarki?)', f: 0.500, color: '#e060c0' } ],
  whitedwarf: [ { name: 'Atmosfera wodorowa', f: 1.000, color: '#e8f0ff' }, { name: 'Warstwa helowa', f: 0.998, color: '#c8d8ff' },
               { name: 'Jądro węglowo-tlenowe', f: 0.980, color: '#ffd890' }, { name: 'Skrystalizowane centrum (w chłodnych karłach)', f: 0.500, color: '#ffffff' } ],
};

// --- Modele 3D (.glb w folderze models/) ----------------------------------
//  Jeśli pliku nie ma, aplikacja używa prostych kształtów z kodu.
const MODEL_PATH = 'models/';
const MODEL_FILES = {
  earth: 'earth.glb',               // Ziemia z teksturą – używana we wszystkich trybach
  smallPlanet: 'small_planet.glb',  // planeta Trybu 3
  person: 'person.glb',             // ludzik ze szkieletem i animacją chodu (Tryb 3 i Tryb 6)
};
const MODEL_LOAD_TIMEOUT_S = 40;    // po tylu sekundach przestajemy czekać na model
const PERSON_ANIMATION = 'walk';    // fragment nazwy animacji chodu w pliku ludzika (np. "Walking")
const PERSON_IDLE_ANIMATION = 'idle'; // animacja "stania" (człowiek w Trybie 6)
const PERSON_RUN_ANIMATION = 'run';   // animacja biegu
const PERSON_MODEL_YAW_DEG = 0;     // obrót modelu ludzika, jeśli po wczytaniu "idzie bokiem"

// --- Tryb 3: planeta z ludzikami ---------------------------------------
const MODE3_PLANET_DIAMETER_M = 1.0;   // średnica planety na starcie [m]
const MODE3_DISTANCE_M = 1.45;         // środek planety tak daleko przed oczami [m] (przód planety ~0,95 m od oczu)
const MODE3_HEIGHT_OFFSET_M = -0.25;   // środek planety poniżej oczu [m]
const MODE3_PEOPLE_COUNT = 30;         // liczba ludzików
const MODE3_PERSON_HEIGHT_M = 0.01;    // wzrost ludzika przy skali 1 [m]
const MODE3_PERSON_SPEED_MPS = 0.015;  // prędkość marszu przy skali 1 [m/s]
const MODE3_TURN_NOISE = 1.5;          // jak bardzo ludziki skręcają losowo (0 = idą prosto)
const MODE3_RUN_SPEED_FACTOR = 2.6;    // bieg jest tyle razy szybszy od marszu
// Zachowanie ludzików: [czynność, szansa wyboru, min. czas, maks. czas [s]]
const MODE3_BEHAVIOR = [['walk', 0.55, 4, 12], ['idle', 0.3, 2, 7], ['run', 0.15, 2, 5]];
const MODE3_AVOID_WATER = true;
const MODE3_CLOUD_COUNT = 14;          // chmurki nad planetą
const MODE3_CLOUD_HEIGHT = 1.12;       // wysokość chmur jako ułamek promienia planety (1 = powierzchnia)
const MODE3_CLOUD_SPEED_DEG_S = 3;     // jak szybko chmury przesuwają się nad planetą
const MODE3_MINI_COSMOS = true;        // kreskówkowe słoneczko i planetki w tle        // ludziki omijają morza (planeta z modelu: wykrywanie po kolorze tekstury)
const MODE3_PLANET_SPIN_DEG_S = 0;     // samodzielny obrót planety [stopnie/s] (0 = stoi)
const MODE3_PULL_GAP_M = 0.15;         // planeta przyciągnięta promieniem zatrzymuje się tyle przed dłonią [m]
const MODE3_SCALE_MIN = 0.1;           // minimalna skala planety
const MODE3_SCALE_MAX = 40;            // maksymalna skala (40 m planeta, ludzik 40 cm)
const MODE3_OCEAN_COLOR = '#2a62b8';
const MODE3_LAND_COLORS = ['#4f9a3c', '#6aa84f', '#8c9a4a', '#a58d5a'];
const MODE3_SHIRT_COLORS = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe67e22, 0xffffff, 0x1abc9c];
const MODE3_PANTS_COLOR = 0x2c3e50;
const MODE3_SKIN_COLOR = 0xf0c8a0;

// --- Tryb 5: kosmos – galaktyki i sieć kosmiczna --------------------------
const LY_MILLIONS_PER_M = 1;           // skala: 1 m = 1 mln lat świetlnych (Droga Mleczna ma 10 cm, Andromeda jest 2,5 m dalej)
const GALAXY_COUNT = 700;              // liczba galaktyk wokół Ciebie (obrazki na kilku "instancjach" – tanie)
const GALAXY_MIN_DIST_M = 0.5;         // najbliższa galaktyka (żeby nie wchodziła w twarz) [m]
const GALAXY_FIELD_RADIUS_M = 14;      // w takiej kuli wokół Ciebie latają galaktyki [m]
const GALAXY_NEAR_DENSITY = 1.6;       // >1 = więcej galaktyk blisko Ciebie
const GALAXY_SIZE_MIN_M = 0.04;        // najmniejsza galaktyka (średnica) [m] (gęstość i rozmiary powiększone dla efektu)
const GALAXY_SIZE_MAX_M = 0.5;         // największa galaktyka [m]
const GALAXY_DRIFT_MPS = 0.02;         // prędkość dryfu galaktyk [m/s]
const GALAXY_ON_FILAMENT = 0.5;        // część galaktyk wokół Ciebie ułożona wzdłuż "Twojego" włókna
const WEB3D_RADIUS_M = 160;            // trójwymiarowy fragment sieci kosmicznej wokół Ciebie [m przy skali 1]
const WEB3D_NODE_COUNT = 45;           // gromady galaktyk w tym fragmencie
const WEB3D_POINT_COUNT = 40000;       // dalsze galaktyki jako świecące punkty (tanie)
const MODE5_SCALE_MIN = 0.006;         // najmocniejsze oddalenie: cały fragment sieci (~300 mln lat św.) to bryła ~2 m przed Tobą
const MODE5_ZOOM_PIVOT_M = 1.2;        // gałka zmniejsza/powiększa kosmos wokół punktu tyle przed Tobą [m]
const MODE5_SCALE_MAX = 2.5;           // najmocniejsze przybliżenie
const WEB_SKY_RADIUS_M = 500;          // tło: sfera z obrazem sieci kosmicznej [m]
const WEB_TEXTURE_WIDTH = 4096;        // rozdzielczość tła (szerokość; wysokość = połowa). 2048 = szybciej, mniej ostro
const WEB_NODE_COUNT = 90;             // gromady galaktyk na tle
const WEB_POINT_COUNT = 90000;         // punkty (dalekie galaktyki) tworzące włókna na tle

// --- Tryb 6: skala – od bakterii do Ziemi --------------------------------------
const SCALE_FOCUS_SIZE_M = 0.6;      // obiekt "w centrum uwagi" ma w goglach taki rozmiar [m]
const SCALE_DISTANCE_M = 1.2;        // przód obiektów tak daleko przed oczami [m]
const SCALE_BASELINE_Y_M = 0.75;     // obiekty stoją na wysokości stołu nad podłogą [m]
const SCALE_HIDE_SMALL_M = 0.004;    // obiekt mniejszy w goglach niż 4 mm znika (za mały, by go zobaczyć)
const SCALE_HIDE_LARGE_M = 60;       // obiekt większy niż 60 m znika (za duży, by go ogarnąć)
const SCALE_FADE_FACTOR = 2.5;       // płynne znikanie w przedziale ×2,5
const SCALE_SPEED_DEFAULT = 0.8;     // prędkość zoomu: ile rzędów wielkości (×10) na sekundę
const SCALE_SPEED_MIN = 0.1;
const SCALE_SPEED_MAX = 4;
const SCALE_GAP_DEG = 5;              // odstęp kątowy między sąsiednimi obiektami na łuku (mniejsze z lewej, większe z prawej)
const SCALE_DEPTH_FACTOR = 0.8;       // większe obiekty stoją dalej: odległość = SCALE_DISTANCE_M + rozmiar × to
const SCALE_NEIGHBORS = 2.6;          // ile obiektów w każdą stronę widać jednocześnie
const SCALE_TURN_DEG_S = 10;         // obiekty powoli obracają się, by pokazać kształt
const SCALE_MANUAL_TURN_DEG_S = 90;   // obracanie obiektu gałką (lewo/prawo; lewa gałka góra/dół = pochylenie)
// sizeM = rozmiar w metrach (wymiar opisany w sizeText); kolejność od najmniejszego.
// Kolejne obiekty różnią się najwyżej ~30×, więc zawsze widać trzy porównywalne obok siebie.
const SCALE_OBJECTS = [
  { id: 'atom', name: 'Atom wodoru', sizeM: 1e-10, sizeText: 'średnica ok. 0,1 nm', fact: 'Gdyby atom był wielkości stadionu, jego jądro byłoby ziarnkiem grochu.' },
  { id: 'glucose', name: 'Cząsteczka glukozy', sizeM: 9e-10, sizeText: 'ok. 1 nm', fact: 'Cukier, z którego komórki czerpią energię: 24 atomy.' },
  { id: 'dna', name: 'Podwójna helisa DNA', sizeM: 3.4e-9, sizeText: 'jeden skręt 3,4 nm', fact: 'DNA z jednej komórki rozciągnięte miałoby ok. 2 metrów.' },
  { id: 'ribosome', name: 'Rybosom', sizeM: 2.5e-8, sizeText: 'ok. 25 nm', fact: 'Komórkowa „fabryka” białek – w każdej komórce są ich miliony.' },
  { id: 'virus', name: 'Wirus grypy', sizeM: 1.2e-7, sizeText: 'ok. 120 nm', fact: 'Jest ok. 15 razy mniejszy od bakterii.' },
  { id: 'bacterium', name: 'Bakteria E. coli', sizeM: 2e-6, sizeText: 'długość 2 µm', fact: 'Na główce szpilki zmieściłoby się ich ok. pół miliona.' },
  { id: 'rbc', name: 'Czerwona krwinka', sizeM: 7.5e-6, sizeText: 'średnica 7,5 µm', fact: 'W jednej kropli krwi jest ich ok. 250 milionów.' },
  { id: 'pollen', name: 'Ziarno pyłku', sizeM: 3e-5, sizeText: 'ok. 30 µm', fact: 'Kolce pomagają mu przyczepić się do owadów.' },
  { id: 'hair', name: 'Włos ludzki', sizeM: 4.2e-4, sizeText: 'grubość 0,07 mm', fact: 'Rośnie ok. 1 cm na miesiąc. Pokrywają go łuski jak dachówki.' },
  { id: 'ant', name: 'Mrówka', sizeM: 5e-3, sizeText: 'długość 5 mm', fact: 'Potrafi unieść ciężar 10–50 razy większy od siebie.' },
  { id: 'coin', name: 'Moneta 1 zł', sizeM: 0.023, sizeText: 'średnica 23 mm', fact: 'Na jej średnicy zmieszczą się ok. 4 mrówki.' },
  { id: 'hamster', name: 'Chomik', sizeM: 0.12, sizeText: 'długość 12 cm', fact: 'W torbach policzkowych przenosi jedzenie na zapas.' },
  { id: 'human', name: 'Człowiek', sizeM: 1.75, sizeText: 'wzrost 1,75 m', fact: 'Składa się z ok. 30 bilionów komórek.' },
  { id: 'bus', name: 'Autobus', sizeM: 12, sizeText: 'długość 12 m', fact: 'Mieści ok. 100 pasażerów.' },
  { id: 'whale', name: 'Płetwal błękitny', sizeM: 30, sizeText: 'długość 30 m', fact: 'Największe zwierzę w historii Ziemi – większe od dinozaurów.' },
  { id: 'eiffel', name: 'Wieża Eiffla', sizeM: 330, sizeText: 'wysokość 330 m', fact: 'Latem jest o ok. 15 cm wyższa – stal rozszerza się od ciepła.' },
  { id: 'burj', name: 'Burj Khalifa', sizeM: 828, sizeText: 'wysokość 828 m', fact: 'Najwyższy budynek świata (Dubaj), 163 piętra.' },
  { id: 'everest', name: 'Mount Everest', sizeM: 8849, sizeText: 'wysokość 8849 m n.p.m.', fact: 'Najwyższy szczyt Ziemi; rośnie ok. 4 mm na rok.' },
  { id: 'phobos', name: 'Fobos (księżyc Marsa)', sizeM: 2.25e4, sizeText: 'ok. 22 km', fact: 'Krąży tak nisko, że za kilkadziesiąt mln lat rozpadnie się lub spadnie na Marsa.' },
  { id: 'amalthea', name: 'Amaltea (księżyc Jowisza)', sizeM: 1.67e5, sizeText: 'ok. 167 km', fact: 'Jedno z najbardziej czerwonych ciał w Układzie Słonecznym.' },
  { id: 'enceladus', name: 'Enceladus', sizeM: 5.04e5, sizeText: 'średnica 504 km', fact: 'Z gejzerów tryska woda z podziemnego oceanu.' },
  { id: 'moon', name: 'Księżyc', sizeM: 3.474e6, sizeText: 'średnica 3474 km', fact: 'Oddala się od Ziemi o ok. 3,8 cm rocznie.' },
  { id: 'earth', name: 'Ziemia', sizeM: 12742e3, sizeText: 'średnica 12 742 km', fact: 'Gdyby była wielkości jabłka, Everest byłby cieńszy niż jego skórka.' },
  { id: 'jupiter', name: 'Jowisz', sizeM: 1.398e8, sizeText: 'średnica 139 820 km', fact: 'Zmieściłoby się w nim ok. 1300 Ziem.' },
  { id: 'sun', name: 'Słońce', sizeM: 1.3927e9, sizeText: 'średnica 1,39 mln km', fact: 'Jego światło leci do Ziemi ok. 8 minut.' },
  { id: 'arcturus', name: 'Arktur (czerwony olbrzym)', sizeM: 3.54e10, sizeText: 'średnica ok. 35 mln km (25× Słońce)', fact: 'Jedna z najjaśniejszych gwiazd na niebie (gwiazdozbiór Wolarza).' },
  { id: 'betelgeuse', name: 'Betelgeza (nadolbrzym)', sizeM: 1.06e12, sizeText: 'średnica ok. 1 mld km (760× Słońce)', fact: 'Postawiona w miejscu Słońca sięgałaby za orbitę Marsa.' },
  { id: 'solarsystem', name: 'Układ Słoneczny', sizeM: 9e12, sizeText: 'orbita Neptuna: ok. 9 mld km', fact: 'Światło przelatuje go w ok. 8 godzin.' },
  { id: 'heliosphere', name: 'Heliosfera', sizeM: 3.6e13, sizeText: 'ok. 240 j.a. (bańka wiatru słonecznego)', fact: 'Sondy Voyager 1 i 2 wyleciały poza nią w 2012 i 2018 roku.' },
  { id: 'sedna', name: 'Orbita Sedny', sizeM: 1.5e14, sizeText: 'ok. 1000 j.a.', fact: 'Sedna okrąża Słońce raz na ok. 11 400 lat.' },
  { id: 'hills', name: 'Wewnętrzny obłok Oorta (hipotetyczny)', sizeM: 6e15, sizeText: 'ok. 40 000 j.a.', fact: 'Przypuszczalny rezerwuar komet – nikt go jeszcze nie zaobserwował.' },
  { id: 'oort', name: 'Obłok Oorta', sizeM: 3e16, sizeText: 'ok. 3 lata świetlne', fact: 'Sięga prawie do połowy drogi do najbliższej gwiazdy.' },
  { id: 'neareststars', name: 'Najbliższe gwiazdy', sizeM: 2.27e17, sizeText: 'kula o promieniu 12 lat św.', fact: 'Najbliższa – Proxima Centauri – jest 4,2 roku świetlnego od nas.' },
  { id: 'pleiades', name: 'Gromada Plejad', sizeM: 7.6e17, sizeText: 'ok. 80 lat świetlnych', fact: 'Młode gwiazdy (ok. 100 mln lat), widoczne gołym okiem zimą.' },
  { id: 'localbubble', name: 'Bąbel Lokalny', sizeM: 9.5e18, sizeText: 'ok. 1000 lat świetlnych', fact: 'Rozrzedzona „bańka” wydmuchana przez wybuchy supernowych – Słońce jest w środku.' },
  { id: 'orionarm', name: 'Ramię Oriona (fragment Galaktyki)', sizeM: 9.5e19, sizeText: 'ok. 10 000 lat świetlnych', fact: 'W tym ramieniu spiralnym Drogi Mlecznej leży Słońce.' },
  { id: 'milkyway', name: 'Droga Mleczna', sizeM: 9.5e20, sizeText: 'średnica ok. 100 000 lat św.', fact: '100–400 mld gwiazd; Słońce okrąża jej środek w ok. 230 mln lat.' },
  { id: 'mwmc', name: 'Droga Mleczna i Obłoki Magellana', sizeM: 3.8e21, sizeText: 'ok. 400 000 lat świetlnych', fact: 'Obłoki Magellana to galaktyki karłowate krążące wokół naszej Galaktyki.' },
  { id: 'localgroup', name: 'Grupa Lokalna galaktyk', sizeM: 9.5e22, sizeText: 'ok. 10 mln lat świetlnych', fact: 'Ponad 80 galaktyk; Droga Mleczna i Andromeda zderzą się za ok. 4,5 mld lat.' },
];

// --- Menu (panel w VR) ------------------------------------------------
const MENU_WIDTH_M = 0.48;          // szerokość panelu [m]
const MENU_DISTANCE_M = 0.6;        // odległość panelu od oczu [m]
const MENU_HEIGHT_OFFSET_M = -0.3;  // panel niżej niż oczy [m]
const MENU_MAX_DISTANCE_M = 3.0;    // gdy odejdziesz dalej, panel sam wraca przed Ciebie [m]
const MENU_TAB_OFFSET = [-0.22, -0.32, -0.5]; // schowane menu: mała zakładka (w lewo, w dół, przed oczy) [m]
const RAY_LENGTH_M = 0.6;           // długość promienia kontrolera [m]

// --- Przyciski kontrolerów (indeksy w gamepad.buttons, standard "xr-standard") ---
//  0 = spust (trigger), 1 = grip (ściśnięcie), 3 = wciśnięcie gałki,
//  4 = A (prawy) / X (lewy), 5 = B (prawy) / Y (lewy)
const MENU_TOGGLE_BUTTON = 5;       // Y na lewym kontrolerze -> pokaż/schowaj menu
const FOCUS_BUTTON = 1;             // grip: Tryb 1 – leć do wskazanej planety (w innych trybach grip = chwyć)
const KNIFE_BUTTON = 4;             // A na prawym kontrolerze -> nóż wł./wył. (Tryby 2, 4); Tryb 6: następny obiekt
const RESET_BUTTON = 5;             // B na prawym kontrolerze -> sklej (Tryby 2, 4); Tryb 6: poprzedni obiekt
const ZOOM_STICK_AXIS = 3;          // oś gałki (3 = góra/dół) – Tryby 1 i 6: zoom

// --- Wygląd -----------------------------------------------------------
const COLOR_BACKGROUND = 0x000006;
const COLOR_RAY = 0x88ccff;
const COLOR_MENU_BG = 'rgba(12, 18, 36, 0.9)';
const COLOR_MENU_BUTTON = '#2a3b6b';
const COLOR_MENU_BUTTON_HOVER = '#4a6bc4';
const COLOR_MENU_BUTTON_ACTIVE = '#d08a1e';
const STAR_COUNT = 2500;            // liczba gwiazd w tle
const AMBIENT_LIGHT = 0.18;         // światło otoczenia (żeby nocna strona nie była czarna)
const SUN_LIGHT = 3.0;              // światło Słońca padające na planety (Tryb 1)
const SHELF_AMBIENT = 0.9;          // Tryby 2–4: światło otoczenia
const SHELF_HEADLIGHT = 2.2;        // Tryby 2–4: światło "z głowy" użytkownika

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
//  type      – wygląd zastępczej tekstury: 'star' | 'rocky' | 'gas' | 'ice' | 'icy' | 'volcanic'
//  rings     – pierścienie: promień wewn./zewn. [km], styl rysowania
//  info      – tabliczka (Tryb 2): wiersze danych i ciekawostka
const BODIES = [
  { id: 'sun', name: 'Słońce', radiusKm: 696340, au: 0, periodDays: 0, L0: 0, tilt: 7.25, color: 0xffcc44, type: 'star', texture: '2k_sun.jpg',
    info: { rows: [['Średnica', '1 392 700 km'], ['Obieg Galaktyki', '~230 mln lat'], ['Temperatura jądra', '~15 mln °C']], fact: 'Zmieściłoby się w nim ok. 1,3 mln Ziem.' } },
  { id: 'mercury', name: 'Merkury', radiusKm: 2439.7, au: 0.387, periodDays: 87.969, L0: 252.25, tilt: 0.03, color: 0xa8a29a, type: 'rocky', texture: '2k_mercury.jpg',
    info: { rows: [['Średnica', '4 879 km'], ['Okres obiegu', '88 dni'], ['Od Słońca', '57,9 mln km']], fact: 'Jedna doba słoneczna trwa tu 176 ziemskich dni.' } },
  { id: 'venus', name: 'Wenus', radiusKm: 6051.8, au: 0.723, periodDays: 224.70, L0: 181.98, tilt: 177.4, color: 0xe8c47c, type: 'rocky', texture: '2k_venus_atmosphere.jpg',
    info: { rows: [['Średnica', '12 104 km'], ['Okres obiegu', '225 dni'], ['Od Słońca', '108,2 mln km']], fact: 'Najgorętsza planeta: ok. 465 °C przy powierzchni.' } },
  { id: 'earth', name: 'Ziemia', radiusKm: 6371.0, au: 1.000, periodDays: 365.26, L0: 100.46, tilt: 23.44, color: 0x3d7fe0, type: 'rocky', texture: '2k_earth_daymap.jpg',
    info: { rows: [['Średnica', '12 742 km'], ['Okres obiegu', '365,25 dnia'], ['Od Słońca', '149,6 mln km']], fact: 'Jedyne znane miejsce we Wszechświecie z życiem.' } },
  { id: 'mars', name: 'Mars', radiusKm: 3389.5, au: 1.524, periodDays: 686.98, L0: 355.45, tilt: 25.19, color: 0xd0562a, type: 'rocky', texture: '2k_mars.jpg',
    info: { rows: [['Średnica', '6 779 km'], ['Okres obiegu', '687 dni'], ['Od Słońca', '227,9 mln km']], fact: 'Ma najwyższy wulkan w Układzie: Olympus Mons (~22 km).' } },
  { id: 'jupiter', name: 'Jowisz', radiusKm: 69911, au: 5.203, periodDays: 4332.6, L0: 34.40, tilt: 3.13, color: 0xd9b98c, type: 'gas', texture: '2k_jupiter.jpg',
    rings: [ { innerKm: 100000, outerKm: 129000, style: 'faint', color: 0x9a8a78, alpha: 0.22 } ],
    info: { rows: [['Średnica', '139 820 km'], ['Okres obiegu', '11,9 roku'], ['Od Słońca', '778,5 mln km']], fact: 'Wielka Czerwona Plama to burza większa od Ziemi.' } },
  { id: 'saturn', name: 'Saturn', radiusKm: 58232, au: 9.537, periodDays: 10759, L0: 49.94, tilt: 26.73, color: 0xe6d29a, type: 'gas', texture: '2k_saturn.jpg',
    rings: [ { innerKm: 74500, outerKm: 140220, style: 'saturn', color: 0xe0cfa0, texture: '2k_saturn_ring_alpha.png' } ],
    info: { rows: [['Średnica', '116 460 km'], ['Okres obiegu', '29,5 roku'], ['Od Słońca', '1,43 mld km']], fact: 'Jego średnia gęstość jest mniejsza niż gęstość wody.' } },
  { id: 'uranus', name: 'Uran', radiusKm: 25362, au: 19.19, periodDays: 30688, L0: 313.23, tilt: 97.77, color: 0x9fdbe6, type: 'ice', texture: '2k_uranus.jpg',
    rings: [ { innerKm: 41000, outerKm: 52000, style: 'lines', color: 0xc8d8e0, alpha: 0.8, lines: [41837, 42234, 42571, 44718, 45661, 47176, 47627, 48300, 51149] } ],
    info: { rows: [['Średnica', '50 724 km'], ['Okres obiegu', '84 lata'], ['Od Słońca', '2,87 mld km']], fact: 'Obraca się „na boku” – oś nachylona o 98°.' } },
  { id: 'neptune', name: 'Neptun', radiusKm: 24622, au: 30.07, periodDays: 60182, L0: 304.88, tilt: 28.32, color: 0x4a6fe0, type: 'ice', texture: '2k_neptune.jpg',
    rings: [ { innerKm: 40000, outerKm: 64000, style: 'lines', color: 0xb8c0d0, alpha: 0.6, lines: [41900, 53200, 57200, 62932] } ],
    info: { rows: [['Średnica', '49 244 km'], ['Okres obiegu', '164,8 roku'], ['Od Słońca', '4,5 mld km']], fact: 'Wieją tu najszybsze wiatry: ponad 2000 km/h.' } },
  { id: 'pluto', name: 'Pluton', radiusKm: 1188.3, au: 39.48, periodDays: 90560, L0: 238.93, tilt: 122.5, color: 0xd2bfa4, type: 'rocky', texture: '2k_pluto.jpg',
    info: { rows: [['Średnica', '2 377 km'], ['Okres obiegu', '248 lat'], ['Od Słońca', '5,9 mld km']], fact: 'Planeta karłowata z lodowymi górami i równiną w kształcie serca.' } },
];

// Orbity eliptyczne i obrót wokół osi: e = mimośród, peri = długość peryhelium [°], rot = doba gwiazdowa [dni]
// (ujemna = obrót wsteczny). Orbity leżą w jednej płaszczyźnie (pominięte nachylenia).
const ORBIT_ELEMENTS = {
  sun: { e: 0, peri: 0, rot: 25.4 },
  mercury: { e: 0.2056, peri: 77.46, rot: 58.65 },
  venus: { e: 0.0068, peri: 131.53, rot: -243.0 },
  earth: { e: 0.0167, peri: 102.95, rot: 0.997 },
  mars: { e: 0.0934, peri: 336.04, rot: 1.026 },
  jupiter: { e: 0.0484, peri: 14.75, rot: 0.414 },
  saturn: { e: 0.0539, peri: 92.43, rot: 0.444 },
  uranus: { e: 0.0473, peri: 170.96, rot: -0.718 },
  neptune: { e: 0.0086, peri: 44.97, rot: 0.671 },
  pluto: { e: 0.2488, peri: 224.07, rot: -6.387 },
};
// Okresy obiegu księżyców [dni] (ujemny = obieg wsteczny)
const MOON_PERIODS = {
  'Księżyc': 27.32, Fobos: 0.319, Deimos: 1.263, Io: 1.769, Europa: 3.551, Ganimedes: 7.155, Kallisto: 16.69,
  Mimas: 0.942, Enceladus: 1.370, Tetyda: 1.888, Dione: 2.737, Rea: 4.518, Tytan: 15.95, Japet: 79.32,
  Miranda: 1.413, Ariel: 2.520, Umbriel: 4.144, Tytania: 8.706, Oberon: 13.46, Proteus: 1.122, Tryton: -5.877, Charon: 6.387,
};

// Księżyce: promień [km], promień orbity [km], kolor, incl = nachylenie orbity względem równika planety [stopnie].
// Te z polem "id" pojawiają się też w Trybie 2 (obok swojej planety, w prawdziwej skali) i można je przeciąć.
const MOONS = {
  earth:   [ { id: 'moon', name: 'Księżyc', radiusKm: 1737.4, aKm: 384400, color: 0xbdbdbd, incl: -18.3, type: 'rocky', texture: '2k_moon.jpg',
               info: { rows: [['Średnica', '3 474 km'], ['Obiega Ziemię w', '27,3 dnia'], ['Od Ziemi', '384 400 km']], fact: 'Zawsze zwrócony do Ziemi tą samą stroną.' } } ],
  mars:    [ { name: 'Fobos', radiusKm: 11.3, aKm: 9376, color: 0x8f7f70 },
             { name: 'Deimos', radiusKm: 6.2, aKm: 23463, color: 0xa39282 } ],
  jupiter: [ { id: 'io', name: 'Io', radiusKm: 1821.6, aKm: 421700, color: 0xe8d44d, type: 'volcanic',
               info: { rows: [['Średnica', '3 643 km'], ['Obiega Jowisza w', '1,77 dnia'], ['Od Jowisza', '421 700 km']], fact: 'Najbardziej wulkaniczne ciało Układu: ponad 400 czynnych wulkanów.' } },
             { id: 'europa', name: 'Europa', radiusKm: 1560.8, aKm: 671034, color: 0xd8c8a8, type: 'icy',
               info: { rows: [['Średnica', '3 122 km'], ['Obiega Jowisza w', '3,55 dnia'], ['Od Jowisza', '671 000 km']], fact: 'Pod lodem kryje słony ocean z ok. 2× większą ilością wody niż na Ziemi.' } },
             { id: 'ganymede', name: 'Ganimedes', radiusKm: 2634.1, aKm: 1070412, color: 0x9e9284, type: 'rocky',
               info: { rows: [['Średnica', '5 268 km'], ['Obiega Jowisza w', '7,15 dnia'], ['Od Jowisza', '1,07 mln km']], fact: 'Największy księżyc – większy od Merkurego; ma własne pole magnetyczne.' } },
             { id: 'callisto', name: 'Kallisto', radiusKm: 2410.3, aKm: 1882709, color: 0x6e6255, type: 'rocky',
               info: { rows: [['Średnica', '4 821 km'], ['Obiega Jowisza w', '16,7 dnia'], ['Od Jowisza', '1,88 mln km']], fact: 'Najbardziej pokryte kraterami ciało w Układzie Słonecznym.' } } ],
  saturn:  [ { name: 'Mimas', radiusKm: 198.2, aKm: 185539, color: 0xc9c9c9 },
             { id: 'enceladus', name: 'Enceladus', radiusKm: 252.1, aKm: 237948, color: 0xf2f6ff, type: 'icy',
               info: { rows: [['Średnica', '504 km'], ['Obiega Saturna w', '1,37 dnia'], ['Od Saturna', '238 000 km']], fact: 'Z gejzerów na biegunie południowym tryska woda z podziemnego oceanu.' } },
             { name: 'Tetyda', radiusKm: 531.1, aKm: 294619, color: 0xdadada },
             { name: 'Dione', radiusKm: 561.4, aKm: 377396, color: 0xcfcfcf },
             { name: 'Rea', radiusKm: 763.8, aKm: 527108, color: 0xc4c4c4 },
             { id: 'titan', name: 'Tytan', radiusKm: 2574.7, aKm: 1221870, color: 0xe3a857, type: 'ice',
               info: { rows: [['Średnica', '5 150 km'], ['Obiega Saturna w', '15,9 dnia'], ['Od Saturna', '1,22 mln km']], fact: 'Ma gęstą atmosferę oraz jeziora i rzeki ciekłego metanu.' } },
             { name: 'Japet', radiusKm: 734.5, aKm: 3560820, color: 0x9a8b78, incl: 15.5 } ],
  uranus:  [ { name: 'Miranda', radiusKm: 235.8, aKm: 129390, color: 0xb5b5b5 },
             { name: 'Ariel', radiusKm: 578.9, aKm: 191020, color: 0xc8c8c8 },
             { name: 'Umbriel', radiusKm: 584.7, aKm: 266000, color: 0x7d7d7d },
             { name: 'Tytania', radiusKm: 788.4, aKm: 435910, color: 0xb8aea4 },
             { name: 'Oberon', radiusKm: 761.4, aKm: 583520, color: 0xa69c92 } ],
  neptune: [ { name: 'Proteus', radiusKm: 210, aKm: 117647, color: 0x7a7a7a },
             { id: 'triton', name: 'Tryton', radiusKm: 1353.4, aKm: 354759, color: 0xd9cbc2, incl: 157, type: 'icy',
               info: { rows: [['Średnica', '2 707 km'], ['Obiega Neptuna w', '5,88 dnia (wstecz!)'], ['Od Neptuna', '354 800 km']], fact: 'Krąży „pod prąd” – to pewnie przechwycony obiekt z Pasa Kuipera.' } } ],
  pluto:   [ { id: 'charon', name: 'Charon', radiusKm: 606, aKm: 19591, color: 0xa8a39a, type: 'rocky',
               info: { rows: [['Średnica', '1 212 km'], ['Obiega Plutona w', '6,39 dnia'], ['Od Plutona', '19 600 km']], fact: 'Tak duży, że Pluton i Charon krążą wokół punktu między nimi.' } } ],
};

// Tryb 4: niezwykłe obiekty. displayRadiusM = rozmiar w goglach (NIE w skali), radiusKm = prawdziwy promień (do warstw).
const OBJECTS = [
  { id: 'blackhole', name: 'Czarna dziura', visual: 'blackhole', displayRadiusM: 0.11, cuttable: false, pickFactor: 3, extentFactor: 5, color: 0xffa040,
    info: { rows: [['Przykład', 'Sagittarius A* (centrum Galaktyki)'], ['Masa', '4,3 mln mas Słońca'], ['Horyzont zdarzeń', '⌀ ok. 24 mln km (17 Słońc)'], ['Odległość', '26 700 lat świetlnych']],
      fact: 'Spod horyzontu zdarzeń nic nie ucieka – nawet światło. Dlatego tej kuli nie da się przeciąć!' } },
  { id: 'neutronstar', name: 'Gwiazda neutronowa (pulsar)', visual: 'pulsar', radiusKm: 12, displayRadiusM: 0.12, pickFactor: 1.4, extentFactor: 2, color: 0xc8dcff,
    info: { rows: [['Średnica', 'ok. 24 km (jak duże miasto)'], ['Masa', '1,4–2 masy Słońca'], ['Obrót', 'do 716 razy na sekundę']],
      fact: 'Łyżeczka jej materii ważyłaby ok. miliarda ton.' } },
  { id: 'whitedwarf', name: 'Biały karzeł (Syriusz B)', visual: 'whitedwarf', radiusKm: 5800, displayRadiusM: 0.13, pickFactor: 1.2, extentFactor: 1.6, color: 0xeef4ff,
    info: { rows: [['Średnica', 'ok. 11 600 km (jak Ziemia)'], ['Masa', '~1 masa Słońca'], ['Temperatura', 'ok. 25 000 °C']],
      fact: 'Tak skończy nasze Słońce – za ok. 6 mld lat.' } },
  { id: 'earth', name: 'Ziemia (dla porównania)', visual: 'earth', radiusKm: 6371, displayRadiusM: 0.12, pickFactor: 1.1, extentFactor: 1.2, color: 0x3d7fe0, tilt: 23.44,
    info: { rows: [['Średnica', '12 742 km'], ['Masa', '1/333 000 masy Słońca'], ['Porównaj', 'biały karzeł ma podobną średnicę!']],
      fact: 'Gwiazda neutronowa jest 500 razy mniejsza od Ziemi, a cięższa od Słońca.' } },
  { id: 'comet', name: 'Kometa 67P', visual: 'comet', displayRadiusM: 0.1, cuttable: false, pickFactor: 1.6, extentFactor: 2.5, color: 0x5a5652,
    info: { rows: [['Jądro', '4,1 × 3,3 km'], ['Okres obiegu', '6,4 roku'], ['Badała ją', 'sonda Rosetta (2014–2016)']],
      fact: '„Brudna kula śnieżna” z lodu, pyłu i związków organicznych. Warkocz zawsze wskazuje od Słońca.' } },
];

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
for (const def of [...BODIES, ...Object.values(MOONS).flat(), ...OBJECTS]) if (def.id && LAYERS[def.id]) def.layers = LAYERS[def.id];

// Wspólne obiekty pomocnicze (bez tworzenia nowych w każdej klatce = mniej pracy dla GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const eyePos = new THREE.Vector3();
const headQuat = new THREE.Quaternion();
let nowS = 0;                     // czas bieżącej klatki [s]

// =====================================================================
//  STAN APLIKACJI
// =====================================================================
const state = {
  mode: 1,
  hoveredButton: null,
  status: '',
  menuNeedsPlacement: true,
  menuHidden: false,
  fps: 0,
  focus: null,           // animacja "leć do planety"
  lastFocusBody: null,
  hoverBody: null,       // Tryb 1: ciało wskazane promieniem
  knife: false,          // Tryby 2/4: nóż włączony
  shelfHover: new Set(), // Tryby 2/4: wskazane obiekty (pokazują tabliczkę)
  placed: {},            // czy tryb został już ułożony przed użytkownikiem
};

// =====================================================================
//  RENDERER, SCENA, KAMERA
// =====================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;               // brak cieni (wydajność)
renderer.localClippingEnabled = true;             // płaszczyzny cięcia (nóż)
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

const raycaster = new THREE.Raycaster();
const sphereGeometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS_W, SPHERE_SEGMENTS_H);
const sphereGeometryHi = new THREE.SphereGeometry(1, MODE2_SPHERE_SEGMENTS_W, MODE2_SPHERE_SEGMENTS_H);

// =====================================================================
//  WCZYTYWANIE MODELI 3D (przed zbudowaniem scen – trwa kilka sekund)
// =====================================================================
const gltfLoader = new GLTFLoader();
function loadGLB(file) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { console.warn(`[modele] ${file}: przekroczony czas wczytywania`); resolve(null); }, MODEL_LOAD_TIMEOUT_S * 1000);
    gltfLoader.load(MODEL_PATH + file,
      gltf => { clearTimeout(timer); resolve(gltf); },
      undefined,
      () => { clearTimeout(timer); console.info(`[modele] Brak pliku ${MODEL_PATH}${file} – używam kształtu z kodu.`); resolve(null); });
  });
}
const loadingEl = document.getElementById('loading');
if (loadingEl) loadingEl.style.display = 'block';
const models = {};
{
  const keys = Object.keys(MODEL_FILES);
  const loaded = await Promise.all(keys.map(k => loadGLB(MODEL_FILES[k])));
  keys.forEach((k, i) => { models[k] = loaded[i]; });
}
if (loadingEl) loadingEl.style.display = 'none';

// Promień modelu (największe odchylenie od środka) – do normalizacji rozmiaru
function modelRadius(root) {
  const box = new THREE.Box3().setFromObject(root);
  return Math.max(...box.min.toArray().map(Math.abs), ...box.max.toArray().map(Math.abs));
}
const earthModelRadius = models.earth ? modelRadius(models.earth.scene) : 1;

// Ziemia z modelu: kopia z własnymi materiałami (żeby można było ją przyciąć nożem)
function buildEarthModel(R, clip = null) {
  const group = new THREE.Group();
  const m = models.earth.scene.clone(true);
  const materials = [];
  m.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.clippingPlanes = clip;
    o.frustumCulled = false;
    materials.push(o.material);
  });
  m.scale.setScalar(R / earthModelRadius);
  group.add(m);
  return { group, materials };
}

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
// Rozkład normalny (Gaussa) z generatora losowego
const gaussian = rnd => () => {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

function cssColor(color, mul = 1) {
  const c = new THREE.Color(color);
  return `rgb(${Math.min(255, c.r * 255 * mul) | 0},${Math.min(255, c.g * 255 * mul) | 0},${Math.min(255, c.b * 255 * mul) | 0})`;
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

// Zastępcza tekstura ciała (gdy brak pliku w folderze textures/) – jedna na ciało, współdzielona
const placeholderCache = new Map();
function placeholderTexture(def) {
  if (placeholderCache.has(def.id)) return placeholderCache.get(def.id);
  const w = 256, h = 128;
  const [canvas, ctx] = makeCanvas(w, h);
  const rnd = seededRandom(def.id);
  const type = def.type || 'rocky';

  if (type === 'gas' || type === 'ice' || type === 'star') {
    // Poziome pasy (gazowe olbrzymy, Tytan) lub ziarnistość (Słońce)
    const bandH = type === 'ice' ? 8 : 4;
    for (let y = 0; y < h; y += bandH) {
      const k = type === 'ice' ? 0.92 + rnd() * 0.12 : 0.75 + rnd() * 0.45;
      ctx.fillStyle = cssColor(def.color, k);
      ctx.fillRect(0, y, w, bandH);
    }
    if (type === 'star') {
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
  } else if (type === 'icy') {
    // Lodowa powierzchnia z pęknięciami (Europa, Enceladus, Tryton)
    ctx.fillStyle = cssColor(def.color); ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(150,90,60,${0.3 + rnd() * 0.4})`;
      ctx.beginPath();
      const x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + rnd() * 80 - 40, y + rnd() * 40 - 20, x + rnd() * 80 - 40, y + rnd() * 40 - 20, x + rnd() * 120 - 60, y + rnd() * 50 - 25);
      ctx.stroke();
    }
  } else if (type === 'volcanic') {
    // Io: siarka i wulkany
    ctx.fillStyle = cssColor(def.color); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const c = ['rgba(230,120,30,0.7)', 'rgba(40,30,20,0.8)', 'rgba(250,250,220,0.6)', 'rgba(200,170,60,0.6)'][(rnd() * 4) | 0];
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Ciała skaliste: plamy i kratery
    ctx.fillStyle = cssColor(def.color); ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = cssColor(def.color, 0.7 + rnd() * 0.5);
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 7, 0, Math.PI * 2); ctx.fill();
    }
    if (def.id === 'pluto') {            // "serce" – Tombaugh Regio
      ctx.fillStyle = 'rgba(245,240,230,0.9)';
      ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.55, 18, 14, 0.3, 0, Math.PI * 2); ctx.fill();
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
  const [canvas, ctx] = makeCanvas(w, h);
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

// Miękka świecąca kropka (markery, poświaty)
function makeGlowTexture() {
  const s = 64;
  const [canvas, ctx] = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}
const glowTexture = makeGlowTexture();

// Bardzo miękka poświata (gromady galaktyk, aureole gwiazd)
const softGlowTexture = (() => {
  const s = 128;
  const [canvas, ctx] = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
})();

function makeGlowSprite(color, size, opacity = 1, texture = glowTexture) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(size);
  return s;
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
  const [canvas, ctx] = makeCanvas(8, 8);
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

// Ustaw etykietę nad punktem: stały rozmiar kątowy
function placeLabel(label, pos, lift, angleDeg) {
  const dist = Math.max(0.05, pos.distanceTo(eyePos));
  const h = dist * Math.tan(angleDeg * DEG);
  label.position.copy(pos).addScaledVector(UP, lift + dist * 0.01);
  label.scale.set(h * label.userData.aspect, h, 1);
}

function formatKm(km) {
  if (km < 10) return km.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
  return Math.round(km).toLocaleString('pl-PL');
}

// Tabliczka z nazwą, danymi, ciekawostką i legendą warstw wnętrza (z głębokościami)
function makeInfoLabel(def) {
  const W = 940, pad = 34;
  const [canvas, ctx] = makeCanvas(W, 64);
  const info = def.info || { rows: [] };
  const layers = def.layers || [];

  // rysowanie w dwóch przebiegach: najpierw pomiar wysokości, potem właściwe rysowanie
  function paint(draw) {
    let y = pad;
    const text = (t, font, color, x = pad) => {
      ctx.font = font;
      if (draw) { ctx.fillStyle = color; ctx.fillText(t, x, y); }
    };
    ctx.textBaseline = 'top';
    text(def.name, 'bold 62px system-ui, sans-serif', '#ffffff'); y += 80;
    for (const [k, v] of info.rows) {
      text(`${k}: `, '36px system-ui, sans-serif', '#9fb3d9');
      const kw = ctx.measureText(`${k}: `).width;
      text(v, 'bold 36px system-ui, sans-serif', '#ffffff', pad + kw); y += 48;
    }
    if (info.fact) {
      ctx.font = 'italic 34px system-ui, sans-serif';
      y += 6;
      for (const line of wrapText(ctx, info.fact, W - pad * 2)) { text(line, 'italic 34px system-ui, sans-serif', '#ffe9a8'); y += 42; }
    }
    if (layers.length) {
      y += 12;
      text(def.radiusKm ? 'Wnętrze (głębokość od powierzchni):' : 'Wnętrze:', 'bold 32px system-ui, sans-serif', '#9fb3d9'); y += 44;
      layers.forEach((L, i) => {
        const inner = i + 1 < layers.length ? layers[i + 1].f : 0;
        if (draw) { ctx.fillStyle = L.color; ctx.fillRect(pad, y + 3, 28, 28); }
        text(L.name, '30px system-ui, sans-serif', '#e8ecf5', pad + 40);
        if (def.radiusKm) {
          const d = `${formatKm((1 - L.f) * def.radiusKm)}–${formatKm((1 - inner) * def.radiusKm)} km`;
          ctx.font = '28px system-ui, sans-serif';
          const dw = ctx.measureText(d).width;
          text(d, '28px system-ui, sans-serif', '#9fb3d9', W - pad - dw);
        }
        y += 40;
      });
    }
    return y + pad;
  }
  const H = Math.ceil(paint(false));
  canvas.height = H;
  ctx.fillStyle = 'rgba(8, 12, 28, 0.84)';
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

// Pierścień płaski z UV "radialnym": u = odległość od środka (0 wewnątrz, 1 na zewnątrz)
function radialRingGeometry(inner, outer, segments = 96) {
  const g = new THREE.RingGeometry(inner, outer, segments, 1);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  return g;
}

// Pierścień w jednostkach promienia planety (dziecko kuli o promieniu 1)
function makeRingMesh(def, ring, clippingPlanes = null) {
  const mat = new THREE.MeshLambertMaterial({
    map: ringTexture(def, ring), side: THREE.DoubleSide, transparent: true, depthWrite: false, clippingPlanes,
  });
  useTextureFile(mat, ring.texture);
  const mesh = new THREE.Mesh(radialRingGeometry(ring.innerKm / def.radiusKm, ring.outerKm / def.radiusKm), mat);
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

const markerGeometry = new THREE.BufferGeometry();
markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));

function makeMarker(color, sizePx) {
  const m = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
    color, size: sizePx, sizeAttenuation: false, map: glowTexture,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.frustumCulled = false;
  m.renderOrder = 5;
  return m;
}

// Położenie na orbicie eliptycznej (prawa Keplera): Słońce w ognisku elipsy
function keplerLocal(def, daysSinceJ2000, out) {
  const el = ORBIT_ELEMENTS[def.id] || { e: 0, peri: 0 };
  const e = el.e, peri = el.peri * DEG;
  const L = USE_REAL_POSITIONS ? (def.L0 + 360 * daysSinceJ2000 / def.periodDays) * DEG
    : BODIES.indexOf(def) * 2.4 + 2 * Math.PI * daysSinceJ2000 / def.periodDays;
  const M = L - peri;                                       // anomalia średnia
  let E = M;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));   // równanie Keplera
  return ellipsePoint(def, E, out);
}
function ellipsePoint(def, E, out) {
  const el = ORBIT_ELEMENTS[def.id] || { e: 0, peri: 0 };
  const a = def.au * M_PER_AU, e = el.e, peri = el.peri * DEG;
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const X = x * Math.cos(peri) - y * Math.sin(peri), Y = x * Math.sin(peri) + y * Math.cos(peri);
  return out.set(X, 0, -Y);
}
function makeEllipseLine(def, color, opacity) {
  const pts = [];
  for (let i = 0; i < ORBIT_SEGMENTS; i++) pts.push(ellipsePoint(def, i / ORBIT_SEGMENTS * Math.PI * 2, new THREE.Vector3()));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
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

  b.mesh = (def.id === 'earth' && models.earth)
    ? buildEarthModel(1).group                                  // Ziemia z modelu 3D
    : new THREE.Mesh(sphereGeometry, makePlanetMaterial(def));
  b.mesh.scale.setScalar(b.radiusUnits);
  b.mesh.visible = false;
  b.pivot.add(b.mesh);
  for (const ring of def.rings || []) b.mesh.add(makeRingMesh(def, ring));

  b.marker = makeMarker(def.color, def.type === 'star' ? SUN_MARKER_SIZE_PX : MARKER_SIZE_PX);
  b.pivot.add(b.marker);

  if (def.au > 0) {
    b.orbit = makeEllipseLine(def, def.color, ORBIT_OPACITY);
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
    m.angle = rnd() * Math.PI * 2;
    m.period = MOON_PERIODS[md.name] || 10;
    m.localPos.set(Math.cos(m.angle) * m.orbitUnits, 0, -Math.sin(m.angle) * m.orbitUnits);

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
state.timeIndex = TIME_SPEED_DEFAULT_INDEX;
state.timePaused = TIME_START_PAUSED;
const timeSpeed = () => (state.timePaused ? 0 : TIME_SPEEDS[state.timeIndex]);

function updateOrbitPositions() {
  const days = (Date.now() - J2000_MS) / 86400000 + simulatedDays;
  for (const b of bodies) {
    if (b.def.au <= 0) continue;
    keplerLocal(b.def, days, b.localPos);
    b.pivot.position.copy(b.localPos);
    b.pivot.updateMatrix();
  }
}
updateOrbitPositions();

// Upływ czasu: obieg po orbitach, obrót wokół osi, ruch księżyców
function advanceTime(dt) {
  const days = timeSpeed() * dt;
  if (!days) return;
  simulatedDays += days;
  const clampDeg = (deg, max) => Math.sign(deg) * Math.min(Math.abs(deg), max * dt);
  for (const b of bodies) {
    const rot = (ORBIT_ELEMENTS[b.def.id] || {}).rot;
    if (rot) b.mesh.rotation.y += clampDeg(360 * days / rot, SPIN_MAX_DEG_S) * DEG;
    for (const m of b.moons) {
      m.angle += clampDeg(360 * days / m.period, MOON_MAX_DEG_S) * DEG;
      m.localPos.set(Math.cos(m.angle) * m.orbitUnits, 0, -Math.sin(m.angle) * m.orbitUnits);
      m.mesh.position.copy(m.localPos);
      m.marker.position.copy(m.localPos);
    }
  }
}

// Położenie ciała w układzie współrzędnych całego modelu (także księżyca)
function bodyGroupLocal(b, out) {
  if (b.kind !== 'moon') return out.copy(b.localPos);
  b.parent.pivot.updateMatrix();
  b.holder.updateMatrix();
  return out.copy(b.localPos).applyMatrix4(b.holder.matrix).applyMatrix4(b.parent.pivot.matrix);
}

// Po przelocie układ "śledzi" planetę: ona zostaje przed Tobą, a reszta układu krąży
function applyTrack() {
  const t = state.track;
  if (!t || state.focus || grabs.has(systemGroup)) return;
  const local = bodyGroupLocal(t.body, _v3);
  systemGroup.position.copy(local).applyQuaternion(systemGroup.quaternion).multiplyScalar(systemGroup.scale.x);
  systemGroup.position.subVectors(t.point, systemGroup.position);
}

function resetSystem() {
  state.focus = null;
  state.track = null;
  systemGroup.position.set(...SYSTEM_START_POSITION);
  systemGroup.quaternion.identity();
  systemGroup.scale.setScalar(1);
  systemGroup.updateMatrixWorld(true);
}

// =====================================================================
//  CHWYTANIE I RZUCANIE
//   jedna ręka: 'lever'  = obiekt sztywno przyczepiony do dłoni (przesuwanie + obrót)
//               'spin'   = obracanie globusa wokół jego środka
//               'remote' = obiekt obraca się w miejscu tak, jak obracasz dłoń (dla dalekich, wielkich obiektów)
//   dwie ręce:  skalowanie (odległość dłoni) + obrót + przesuwanie
//   po puszczeniu: obiekty z userData.throwable lecą dalej i hamują (opór "gęstej cieczy")
// =====================================================================
const grabs = new Map();      // obiekt -> { ctrls, opts, dane startowe, historia ruchu }
const floaters = new Map();   // obiekt -> { vel, ang } (lecące po rzucie)

function startGrab(target, ctrl, opts, pullTo = null) {
  let g = grabs.get(target);
  if (!g) { g = { target, ctrls: [], opts, hist: [] }; grabs.set(target, g); }
  if (g.ctrls.includes(ctrl) || g.ctrls.length >= (opts.single ? 1 : 2)) return false;
  g.ctrls.push(ctrl);
  ctrl.userData.grabTarget = target;
  floaters.delete(target);                // złapany obiekt przestaje lecieć
  initGrab(g, g.ctrls.length === 1 ? pullTo : null);
  return true;
}

function endGrab(ctrl) {
  const target = ctrl.userData.grabTarget;
  ctrl.userData.grabTarget = null;
  const g = target && grabs.get(target);
  if (!g) return;
  g.ctrls = g.ctrls.filter(c => c !== ctrl);
  if (g.ctrls.length === 0) {
    grabs.delete(target);
    if (target.userData.throwable) launch(g);
  } else initGrab(g);                     // została jedna ręka – kontynuuj chwyt jedną ręką
}

// Puść obiekt bez rzutu (np. gdy znika po przecięciu). Zwraca kontrolery, które go trzymały.
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

// Prędkość rzutu = ruch obiektu w ostatnich ~0,1 s przed puszczeniem
function launch(g) {
  if (g.pullTo && g.pullT < 1) return;    // puszczony w trakcie przyciągania – zostaje w miejscu
  const h = g.hist;
  if (h.length < 2) return;
  const last = h[h.length - 1];
  let first = h[0];
  for (const e of h) if (last.t - e.t <= THROW_SAMPLE_S) { first = e; break; }
  const dt = last.t - first.t;
  if (dt < 0.01) return;
  const vel = new THREE.Vector3().subVectors(last.p, first.p).multiplyScalar(THROW_SPEED_FACTOR / dt);
  if (vel.length() > THROW_MAX_SPEED) vel.setLength(THROW_MAX_SPEED);
  // prędkość kątowa z różnicy orientacji
  const dq = _q1.copy(last.q).multiply(_q2.copy(first.q).invert());
  if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
  const angle = 2 * Math.acos(Math.min(1, dq.w));
  const s = Math.sqrt(1 - dq.w * dq.w);
  const ang = s > 1e-4 ? new THREE.Vector3(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(angle / dt) : new THREE.Vector3();
  if (ang.length() > THROW_MAX_SPIN) ang.setLength(THROW_MAX_SPIN);
  if (vel.lengthSq() > 1e-4 || ang.lengthSq() > 1e-3) floaters.set(g.target, { vel, ang });
}

function updateFloaters(dt) {
  const kv = Math.exp(-THROW_DRAG * dt), ka = Math.exp(-THROW_ANGULAR_DRAG * dt);
  for (const [obj, f] of floaters) {
    if (grabs.has(obj) || !obj.parent) { floaters.delete(obj); continue; }
    obj.position.addScaledVector(f.vel, dt);
    const a = f.ang.length();
    if (a > 1e-5) {
      _q1.setFromAxisAngle(_v1.copy(f.ang).divideScalar(a), a * dt);
      obj.quaternion.premultiply(_q1);
    }
    f.vel.multiplyScalar(kv);
    f.ang.multiplyScalar(ka);
    if (f.vel.lengthSq() < 1e-6 && f.ang.lengthSq() < 1e-4) floaters.delete(obj);
  }
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
    } else if (g.opts.oneHand === 'remote') {
      g.cq0 = new THREE.Quaternion();
      c.matrixWorld.decompose(_v1, g.cq0, _scale);
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
    g.pullTo = null;
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
      } else if (g.opts.oneHand === 'remote') {
        c.matrixWorld.decompose(_v1, _q1, _scale);
        _q1.multiply(_q2.copy(g.cq0).invert());              // obrót dłoni od początku chwytu
        t.quaternion.copy(_q1).multiply(g.q0);
      } else {
        let off = g.offPos;
        if (g.pullTo) {                                    // chwyt z daleka: obiekt przylatuje do ręki
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
    // historia ruchu (do rzutu)
    g.hist.push({ t: nowS, p: t.position.clone(), q: t.quaternion.clone() });
    if (g.hist.length > 12) g.hist.shift();
  }
}

const MODE1_GRAB = { minScale: SYSTEM_SCALE_MIN, maxScale: SYSTEM_SCALE_MAX, oneHand: 'lever' };
const SHELF_GRAB = { minScale: MODE2_SCALE_MIN, maxScale: MODE2_SCALE_MAX, oneHand: 'lever' };
const SHELF_GRAB_REMOTE = { minScale: MODE2_SCALE_MIN, maxScale: MODE2_SCALE_MAX, oneHand: 'remote' };
const MODE3_GRAB = { minScale: MODE3_SCALE_MIN, maxScale: MODE3_SCALE_MAX, oneHand: 'lever' };
const MODE5_GRAB = { minScale: MODE5_SCALE_MIN, maxScale: MODE5_SCALE_MAX, oneHand: 'remote' };   // obrót wokół siebie; 2 ręce = zoom
const MENU_GRAB = { minScale: 1, maxScale: 1, oneHand: 'lever', single: true };

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

function horizontalForward() {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  return fwd.normalize();
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

  const fwd = horizontalForward();
  const dist = systemView ? FOCUS_SYSTEM_RADIUS_M + FOCUS_DISTANCE_M : FOCUS_DISTANCE_M + FOCUS_BODY_RADIUS_M;
  const P1 = eyePos.clone().addScaledVector(fwd, dist);
  P1.y -= 0.1;
  state.track = null;
  state.focus = { t: 0, s0, s1, P0: body.worldPos.clone(), P1, body };
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
  systemGroup.position.copy(bodyGroupLocal(f.body, _v3)).applyQuaternion(systemGroup.quaternion).multiplyScalar(s);
  systemGroup.position.subVectors(P, systemGroup.position);
  systemGroup.updateMatrixWorld(true);
  if (f.t >= 1) { state.focus = null; state.track = { body: f.body, point: f.P1.clone() }; }
}

// Powiększenie układu wokół punktu (gałka, klawisze +/-)
function zoomSystemAround(pivot, factor) {
  state.track = null;
  const s0 = systemGroup.scale.x;
  const s1 = THREE.MathUtils.clamp(s0 * factor, SYSTEM_SCALE_MIN, SYSTEM_SCALE_MAX);
  const r = s1 / s0;
  systemGroup.position.sub(pivot).multiplyScalar(r).add(pivot);
  systemGroup.scale.setScalar(s1);
  systemGroup.updateMatrixWorld(true);
  reinitGrab(systemGroup);
}

// =====================================================================
//  WYGLĄD OBIEKTÓW TRYBÓW 2 i 4 (z opcjonalną płaszczyzną przycinającą)
//  Każda funkcja zwraca { group, materials, update(dt, obj) }.
// =====================================================================
function buildVisual(def, R, clipPlane = null) {
  const clip = clipPlane ? [clipPlane] : null;
  if (def.id === 'earth' && models.earth) {
    const v = buildEarthModel(R, clip);
    v.group.rotation.z = (def.tilt || 0) * DEG;
    return v;
  }
  switch (def.visual) {
    case 'blackhole': return buildBlackHole(def, R);
    case 'pulsar': return buildPulsar(def, R, clip);
    case 'whitedwarf': return buildWhiteDwarf(def, R, clip);
    case 'comet': return buildComet(def, R);
    case 'earth':
    default: return buildPlanetVisual(def, R, clip);
  }
}

function buildPlanetVisual(def, R, clip) {
  const group = new THREE.Group();
  group.rotation.z = (def.tilt || 0) * DEG;
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

// --- Czarna dziura: czarny "cień", wirujący dysk akrecyjny, pierścień fotonowy i obraz dysku zagięty przez grawitację
const blackHoleTextures = (() => {
  // dysk akrecyjny (widziany z góry)
  const S = 512, c = S / 2;
  const [dc, dctx] = makeCanvas(S, S);
  dctx.fillStyle = '#000'; dctx.fillRect(0, 0, S, S);
  const inner = c * (1.2 / 5);
  const g = dctx.createRadialGradient(c, c, inner, c, c, c);
  g.addColorStop(0, 'rgba(255,250,225,1)');
  g.addColorStop(0.12, 'rgba(255,215,140,1)');
  g.addColorStop(0.35, 'rgba(255,140,40,0.85)');
  g.addColorStop(0.7, 'rgba(170,40,10,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g;
  dctx.beginPath(); dctx.arc(c, c, c, 0, Math.PI * 2); dctx.arc(c, c, inner, 0, Math.PI * 2, true); dctx.fill();
  const rnd = seededRandom('bh');
  dctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) {                         // spiralne smugi gorącej materii
    const r = inner + rnd() * (c - inner) * 0.9, a = rnd() * Math.PI * 2, len = 0.3 + rnd() * 0.9;
    dctx.strokeStyle = `rgba(255,${(150 + rnd() * 90) | 0},${(60 + rnd() * 80) | 0},${0.08 + rnd() * 0.12})`;
    dctx.lineWidth = 1 + rnd() * 3;
    dctx.beginPath(); dctx.arc(c, c, r, a, a + len); dctx.stroke();
  }
  // obraz soczewkowany (zawsze zwrócony do patrzącego): pierścień fotonowy + łuk dysku, jaśniejszy z jednej strony
  const [lc, lctx] = makeCanvas(S, S);
  lctx.fillStyle = '#000'; lctx.fillRect(0, 0, S, S);
  const k = c / 2.0;                                      // sprite obejmuje promień 2R
  for (let deg = 0; deg < 360; deg += 1) {
    const a = deg * DEG;
    const boost = 0.55 + 0.45 * Math.cos(a - Math.PI);    // efekt Dopplera: lewa strona jaśniejsza
    for (let r = 1.12; r < 1.6; r += 0.02) {
      const fall = 1 - (r - 1.12) / 0.48;
      lctx.fillStyle = `rgba(255,${(170 + 60 * fall) | 0},${(70 + 80 * fall) | 0},${0.05 * boost * fall})`;
      lctx.fillRect(c + Math.cos(a) * r * k - 2, c + Math.sin(a) * r * k - 2, 4, 4);
    }
  }
  lctx.strokeStyle = 'rgba(255,245,220,0.95)';             // cienki pierścień fotonowy
  lctx.lineWidth = 3;
  lctx.beginPath(); lctx.arc(c, c, 1.03 * k, 0, Math.PI * 2); lctx.stroke();
  return { disk: canvasTexture(dc), lens: canvasTexture(lc) };
})();

function buildBlackHole(def, R) {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(sphereGeometryHi, new THREE.MeshBasicMaterial({ color: 0x000000 }));
  shadow.scale.setScalar(R);
  const tilt = new THREE.Group();
  tilt.rotation.x = -Math.PI / 2 + 0.28;                  // dysk lekko pochylony do patrzącego
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.2 * R, 5 * R, 128, 1), new THREE.MeshBasicMaterial({
    map: blackHoleTextures.disk, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  // UV planarne pasujące do kwadratowej tekstury dysku
  const p = disk.geometry.attributes.position, uv = disk.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (10 * R), 0.5 + p.getY(i) / (10 * R));
  tilt.add(disk);
  const lens = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blackHoleTextures.lens, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lens.scale.setScalar(4 * R);
  group.add(shadow, tilt, lens);
  return {
    group, materials: [shadow.material, disk.material, lens.material],
    update: dt => { disk.rotation.z += BLACK_HOLE_DISK_SPEED * dt; },
  };
}

// --- Pulsar: gorąca, mała gwiazda z dwoma wiązkami promieniowania obracającymi się razem z nią
const beamTexture = (() => {
  const [canvas, ctx] = makeCanvas(4, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);       // góra tekstury = wierzchołek stożka (przy gwieździe)
  g.addColorStop(0, 'rgba(200,220,255,0.9)');
  g.addColorStop(1, 'rgba(120,150,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
})();

function buildPulsar(def, R, clip) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: def.color, clippingPlanes: clip });
  const star = new THREE.Mesh(sphereGeometryHi, mat);
  star.scale.setScalar(R);
  const spin = new THREE.Group();                         // oś obrotu = Y
  const magnetic = new THREE.Group();                     // oś magnetyczna nachylona o 25°
  magnetic.rotation.z = 25 * DEG;
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, clippingPlanes: clip,
  });
  const L = 6 * R;
  const beamGeo = new THREE.ConeGeometry(1.4 * R, L, 24, 1, true).translate(0, -L / 2, 0);   // wierzchołek w środku gwiazdy
  const b1 = new THREE.Mesh(beamGeo, beamMat);
  b1.rotation.x = Math.PI;                                // w górę
  const b2 = new THREE.Mesh(beamGeo, beamMat);            // w dół
  magnetic.add(b1, b2);
  spin.add(magnetic);
  group.add(star, spin);
  if (!clip) group.add(makeGlowSprite(0x9fb8ff, 5 * R, 0.8));
  return { group, materials: [mat, beamMat], update: dt => { spin.rotation.y += PULSAR_SPIN_HZ * Math.PI * 2 * dt; } };
}

// --- Biały karzeł: mała, bardzo gorąca, biało-niebieska kula
function buildWhiteDwarf(def, R, clip) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: def.color, clippingPlanes: clip });
  const star = new THREE.Mesh(sphereGeometryHi, mat);
  star.scale.setScalar(R);
  group.add(star);
  if (!clip) group.add(makeGlowSprite(0xcfe0ff, 3.5 * R, 0.7));
  return { group, materials: [mat] };
}

// --- Kometa: nieregularne, ciemne jądro ("kaczka" jak 67P), otoczka (koma) i dwa warkocze
const COMET_TAIL_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...COMET_TAIL_DIRECTION).normalize());
function lumpyGeometry(seed, sx, sy, sz) {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const p = g.attributes.position;
  const rnd = seededRandom(seed);
  const ph = Array.from({ length: 6 }, () => rnd() * 6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.13 * Math.sin(3.1 * x + ph[0]) * Math.sin(2.7 * y + ph[1]) * Math.sin(3.3 * z + ph[2])
                + 0.06 * Math.sin(7 * x + ph[3]) * Math.sin(6 * y + ph[4]) * Math.sin(8 * z + ph[5]);
    p.setXYZ(i, x * d * sx, y * d * sy, z * d * sz);
  }
  g.computeVertexNormals();
  return g;
}
const tailTexture = (() => {
  const [canvas, ctx] = makeCanvas(4, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
})();

function buildComet(def, R) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: def.color });
  const lobe1 = new THREE.Mesh(lumpyGeometry('c1', 1, 0.8, 0.85), mat);
  lobe1.scale.setScalar(R * 0.62);
  lobe1.position.x = -R * 0.3;
  const lobe2 = new THREE.Mesh(lumpyGeometry('c2', 0.9, 0.75, 0.8), mat);
  lobe2.scale.setScalar(R * 0.45);
  lobe2.position.set(R * 0.45, R * 0.15, 0);
  const coma = makeGlowSprite(0xbfd8ff, 3 * R, 0.35, softGlowTexture);
  const tails = new THREE.Group();
  const mk = (len, rad, color, opacity) => {
    const geo = new THREE.ConeGeometry(rad, len, 20, 1, true).translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tailTexture, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    return m;                                            // wierzchołek przy jądrze, rozszerza się "w dół" (-Y)
  };
  const ion = mk(10 * R, 0.6 * R, 0x7fb0ff, 0.5);        // warkocz jonowy – prosty, niebieski
  const dust = mk(6 * R, 1.5 * R, 0xffe8b0, 0.35);        // warkocz pyłowy – szerszy, zakrzywiony
  dust.rotation.z = 0.25;
  tails.add(ion, dust);
  group.add(lobe1, lobe2, coma, tails);
  return {
    group, materials: [mat, ion.material, dust.material],
    // warkocze zawsze w tym samym kierunku w świecie (od "Słońca"), niezależnie od obrotu komety
    update: (dt, obj) => { tails.quaternion.copy(obj.quaternion).invert().multiply(COMET_TAIL_QUAT); },
  };
}

// =====================================================================
//  TRYBY 2 i 4: "PÓŁKI" Z OBIEKTAMI DO CHWYTANIA, RZUCANIA I CIĘCIA
// =====================================================================
function makeHeadlight(group) {
  group.add(new THREE.AmbientLight(0xffffff, SHELF_AMBIENT));
  const light = new THREE.DirectionalLight(0xffffff, SHELF_HEADLIGHT);
  group.add(light, light.target);
  return light;
}
function updateHeadlight(light) {
  light.position.copy(eyePos).add(_v1.set(0.3, 0.8, 0));
  light.target.position.copy(eyePos).add(_v1.set(0, -0.6, -2).applyQuaternion(headQuat));
}

function createShelf(mode) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  return { mode, group, items: [], pairs: [], light: makeHeadlight(group) };
}

// Obiekt na półce: całość (kind 'whole'); po przecięciu zastępują go dwie połówki (kind 'half')
function makeShelfItem(shelf, def, R, extra = {}) {
  const item = {
    kind: 'whole', def, R, shelf, cutPair: null, infoLabel: null,
    pickR: R * (def.pickFactor || 1), extent: R * (def.extentFactor || ringExtent(def)),
    obj: new THREE.Group(), ...extra,
  };
  const vis = buildVisual(def, R);
  item.obj.add(vis.group);
  item.update = vis.update || null;
  item.obj.userData.throwable = true;
  item.nameLabel = makeLabel(def.name);
  shelf.group.add(item.obj, item.nameLabel);
  shelf.items.push(item);
  return item;
}

const shelf2 = createShelf(2);   // planety i księżyce w prawdziwych proporcjach
const shelf4 = createShelf(4);   // niezwykłe obiekty
const shelfFor = mode => (mode === 2 ? shelf2 : mode === 4 ? shelf4 : null);

// Tryb 2: Słońce, planety, Pluton i największe księżyce – wszystko w jednej skali
const mode2Radius = km => MODE2_EARTH_RADIUS_M * km / EARTH_RADIUS_KM;
for (const def of BODIES) {
  const planet = makeShelfItem(shelf2, def, mode2Radius(def.radiusKm), {
    isSun: def.type === 'star', moons: [],
  });
  for (const md of MOONS[def.id] || []) {
    if (!md.id) continue;
    planet.moons.push(makeShelfItem(shelf2, { tilt: 0, ...md }, mode2Radius(md.radiusKm), { isMoon: true, parentItem: planet }));
  }
}
// Tryb 4: obiekty (każdy w wygodnym rozmiarze; prawdziwy rozmiar na tabliczce)
for (const def of OBJECTS) makeShelfItem(shelf4, def, def.displayRadiusM);

function resetItemTransform(it) {
  it.obj.quaternion.identity();
  it.obj.scale.setScalar(1);
  floaters.delete(it.obj);
}

// Tryb 2: planety na łuku przed Tobą (od lewej: Merkury ... Pluton), księżyce pod swoimi planetami,
// a za nimi olbrzymie Słońce – wszystko w prawdziwych proporcjach.
function layoutShelf2() {
  glueAll(shelf2, true);
  const fwd = horizontalForward();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const planets = shelf2.items.filter(it => !it.isMoon && !it.isSun);
  let arcR = MODE2_ARC_RADIUS_M;
  const widthAngle = r => planets.reduce((sum, it) => sum + (2 * it.extent + MODE2_GAP_M) / (r + it.R), 0);
  while (widthAngle(arcR) > MODE2_MAX_ARC_DEG * DEG) arcR *= 1.08;
  let angle = -widthAngle(arcR) / 2;
  for (const it of planets) {
    const span = (2 * it.extent + MODE2_GAP_M) / (arcR + it.R);
    const a = angle + span / 2;
    angle += span;
    const d = arcR + it.R;
    resetItemTransform(it);
    it.obj.position.copy(eyePos).addScaledVector(fwd, Math.cos(a) * d).addScaledVector(right, Math.sin(a) * d);
    it.obj.position.y = eyePos.y + MODE2_HEIGHT_OFFSET_M;
    // księżyce: rządek pod planetą, wysunięty w stronę patrzącego
    if (it.moons.length) {
      const toEye = _v1.subVectors(eyePos, it.obj.position).setY(0).normalize();
      const side = _v2.crossVectors(toEye, UP).normalize();
      const tiltDrop = it.extent * Math.abs(Math.sin((it.def.tilt || 0) * DEG));
      const below = Math.max(it.R, tiltDrop) + MODE2_MOON_GAP_M;
      const widths = it.moons.map(m => 2 * m.R + 0.04);
      let x = -widths.reduce((s, w) => s + w, 0) / 2;
      it.moons.forEach((m, i) => {
        resetItemTransform(m);
        m.obj.position.copy(it.obj.position).addScaledVector(toEye, it.R * 0.7).addScaledVector(side, x + widths[i] / 2);
        m.obj.position.y -= below + m.R;
        x += widths[i];
      });
    }
  }
  const sun = shelf2.items.find(it => it.isSun);
  resetItemTransform(sun);
  sun.obj.position.copy(eyePos).addScaledVector(fwd, arcR + MODE2_SUN_BEHIND_M + sun.R);
  sun.obj.position.y = eyePos.y + MODE2_SUN_TOP_OFFSET_M - sun.R;
  for (const it of shelf2.items) it.obj.updateMatrixWorld(true);
  if (!renderer.xr.isPresenting) orbitControls.target.copy(eyePos).addScaledVector(fwd, arcR).setY(eyePos.y + MODE2_HEIGHT_OFFSET_M);
}

// Tryb 4: obiekty na łuku przed Tobą
function layoutShelf4() {
  glueAll(shelf4, true);
  const fwd = horizontalForward();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const arcR = MODE4_ARC_RADIUS_M;
  const items = shelf4.items;
  const spans = items.map(it => (2 * it.extent * 0.6 + MODE4_GAP_M) / (arcR + it.R));
  let angle = -spans.reduce((s, v) => s + v, 0) / 2;
  items.forEach((it, i) => {
    const a = angle + spans[i] / 2;
    angle += spans[i];
    const d = arcR + it.R;
    resetItemTransform(it);
    it.obj.position.copy(eyePos).addScaledVector(fwd, Math.cos(a) * d).addScaledVector(right, Math.sin(a) * d);
    it.obj.position.y = eyePos.y + MODE4_HEIGHT_OFFSET_M;
    it.obj.updateMatrixWorld(true);
  });
  if (!renderer.xr.isPresenting) orbitControls.target.copy(eyePos).addScaledVector(fwd, arcR).setY(eyePos.y + MODE4_HEIGHT_OFFSET_M);
}

// Wszystko, co można złapać na półce: całe obiekty + połówki
function shelfGrabbables(shelf) {
  const list = [];
  for (const it of shelf.items) if (!it.cutPair) list.push(it);
  for (const p of shelf.pairs) list.push(p.a, p.b);
  return list;
}

// Który obiekt chwyta kontroler: najpierw "z ręki" (blisko), potem promieniem (z tolerancją dla małych)
function pickShelf(shelf, origin, dir) {
  const list = shelfGrabbables(shelf);
  let best = null, bestD = Infinity;
  for (const e of list) {
    const d = origin.distanceTo(e.obj.position) - e.pickR * e.obj.scale.x;
    if (d < NEAR_GRAB_MARGIN_M && d < bestD) { best = e; bestD = d; }
  }
  if (best) return { entry: best, near: true, distance: 0 };
  raycaster.ray.origin.copy(origin);
  raycaster.ray.direction.copy(dir);
  const tol = Math.tan(PICK_TOLERANCE_DEG * DEG);
  for (const e of list) {
    const r = Math.max(e.pickR * e.obj.scale.x, origin.distanceTo(e.obj.position) * tol);
    _sphere.set(e.obj.position, r);
    const hit = raycaster.ray.intersectSphere(_sphere, _v4);
    if (!hit) continue;
    const d = origin.distanceTo(hit);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best ? { entry: best, near: false, distance: bestD } : null;
}

function grabShelf(shelf, ctrl) {
  const origin = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(ctrl.matrixWorld);
  const res = pickShelf(shelf, origin, dir);
  if (!res) return;
  const e = res.entry;
  if (e.isSun && !res.near) {                       // Słońce jest za wielkie, by je przyciągnąć – obracasz je zdalnie
    startGrab(e.obj, ctrl, SHELF_GRAB_REMOTE);
    return;
  }
  const pullTo = (!res.near && !grabs.has(e.obj))
    ? new THREE.Vector3(0, 0, -(e.pickR * e.obj.scale.x + PULL_GAP_M))
    : null;
  startGrab(e.obj, ctrl, SHELF_GRAB, pullTo);
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
// Okrąg pokazujący miejsce cięcia
const cutPreview = (() => {
  const pts = [];
  for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: CUT_PREVIEW_COLOR, depthTest: false }));
  l.renderOrder = 30;
  l.visible = false;
  scene.add(l);
  return l;
})();

const knifeN = new THREE.Vector3(), knifeP = new THREE.Vector3();
function knifePlaneWorld() {
  knife.updateMatrixWorld(true);
  knifeP.setFromMatrixPosition(knife.matrixWorld);
  knifeN.set(1, 0, 0).transformDirection(knife.matrixWorld);
}

const isCuttable = it => !!(it.def.layers && it.def.cuttable !== false);

// Obiekt przecinany przez tarczę (najbliższy środkowi tarczy)
function findCutCandidate(shelf, n, p) {
  let best = null;
  for (const it of shelf.items) {
    if (it.cutPair || !isCuttable(it)) continue;
    const c = it.obj.position;
    const Rw = it.R * it.obj.scale.x;
    const d = _v1.subVectors(c, p).dot(n);
    if (Math.abs(d) > Rw * 0.97) continue;
    const proj = _v2.copy(c).addScaledVector(n, -d);
    const circleR = Math.sqrt(Rw * Rw - d * d);
    const inPlane = proj.distanceTo(p);
    if (inPlane > KNIFE_RADIUS_M + circleR) continue;      // tarcza nie dotyka obiektu
    if (!best || inPlane < best.score) best = { item: it, score: inPlane, proj: proj.clone(), circleR };
  }
  return best;
}

// Tekstura przekroju: koncentryczne warstwy w miejscu cięcia (prawdziwe proporcje)
function makeCapTexture(def, R, dAbs, capR) {
  const S = CAP_TEXTURE_SIZE, k = (S / 2) / capR;
  const [canvas, ctx] = makeCanvas(S, S);
  const rnd = seededRandom(def.id + 'cap');
  for (const L of def.layers) {
    const lr = L.f * R;
    if (lr <= dAbs) continue;                            // ta warstwa nie sięga płaszczyzny cięcia
    const rr = Math.sqrt(lr * lr - dAbs * dAbs) * k;
    ctx.fillStyle = L.color;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, rr, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 120 * rr / (S / 2); i++) {         // drobne ziarno, żeby nie było "płasko"
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rr;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 3 + rnd() * 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';                 // granica warstwy – widoczna nawet dla cienkiej skorupy
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, rr - 1, 0, Math.PI * 2); ctx.stroke();
  }
  return canvasTexture(canvas);
}

// Tarcza przekroju leżąca dokładnie w płaszczyźnie cięcia (w układzie lokalnym obiektu)
function makeCap(def, R, plane) {
  const d = -plane.constant;                          // płaszczyzna: n·x + c = 0  ->  punkt n·(-c)
  const capR = Math.sqrt(Math.max(R * R - d * d, 1e-8));
  const tex = makeCapTexture(def, R, Math.abs(d), capR);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(capR, 96), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.position.copy(plane.normal).multiplyScalar(d);
  mesh.quaternion.setFromUnitVectors(Z_AXIS, plane.normal.clone().negate());   // patrzy w stronę odciętej części
  return mesh;
}

// Połówka: klon obiektu z płaszczyzną przycinającą + tarcza z warstwami
function makeHalf(item, localPlane) {
  const h = {
    kind: 'half', def: item.def, R: item.R, pickR: item.R, shelf: item.shelf,
    obj: new THREE.Group(), localPlane, worldPlane: new THREE.Plane(),
  };
  const vis = buildVisual(item.def, item.R, h.worldPlane);
  h.materials = vis.materials;
  h.update = vis.update || null;
  h.cap = makeCap(item.def, item.R, localPlane);
  h.obj.add(vis.group, h.cap);
  h.obj.position.copy(item.obj.position);
  h.obj.quaternion.copy(item.obj.quaternion);
  h.obj.scale.copy(item.obj.scale);
  h.obj.userData.throwable = true;
  item.shelf.group.add(h.obj);
  return h;
}

function disposeHalf(h) {
  h.obj.removeFromParent();
  floaters.delete(h.obj);
  for (const m of h.materials) forgetMaterial(m);
  h.cap.geometry.dispose();
  h.cap.material.map.dispose();
  h.cap.material.dispose();
}

// CIĘCIE: obiekt dzieli się na dwie połówki wzdłuż płaszczyzny (n, p) w świecie
function cutItem(item, n, p) {
  const obj = item.obj;
  obj.updateMatrixWorld(true);
  const inv = _m1.copy(obj.matrixWorld).invert();
  const pL = p.clone().applyMatrix4(inv);
  const nL = n.clone().transformDirection(inv);
  const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(nL, pL);   // A: strona +n
  const planeB = planeA.clone().negate();                                   // B: strona -n
  const holders = releaseTarget(obj);
  floaters.delete(obj);
  const a = makeHalf(item, planeA), b = makeHalf(item, planeB);
  a.obj.position.addScaledVector(n, CUT_SEPARATION_M / 2);
  b.obj.position.addScaledVector(n, -CUT_SEPARATION_M / 2);
  const pair = { whole: item, a, b, glue: null };
  a.pair = b.pair = pair;
  item.cutPair = pair;
  obj.visible = false;
  item.shelf.pairs.push(pair);
  updateHalfPlanes(item.shelf);
  // ręka, która trzymała obiekt, trzyma dalej połówkę po swojej stronie
  for (const c of holders) {
    const side = _v1.setFromMatrixPosition(c.matrixWorld).sub(p).dot(n) >= 0 ? a : b;
    startGrab(side.obj, c, SHELF_GRAB);
  }
}

// SKLEJANIE: połówka B płynnie wraca do A, potem obie zastępuje cały obiekt
function glueAll(shelf, instant = false) {
  if (!shelf) return;
  for (const pair of shelf.pairs) {
    if (instant) { finishGlue(pair); continue; }
    if (pair.glue) continue;
    releaseTarget(pair.b.obj);
    floaters.delete(pair.b.obj);
    pair.glue = { t: 0, p0: pair.b.obj.position.clone(), q0: pair.b.obj.quaternion.clone(), s0: pair.b.obj.scale.x };
  }
  shelf.pairs = shelf.pairs.filter(p => !p.done);
}

function finishGlue(pair) {
  const { whole, a, b } = pair;
  const holders = [...releaseTarget(a.obj), ...releaseTarget(b.obj)];
  const fl = floaters.get(a.obj);
  whole.obj.position.copy(a.obj.position);
  whole.obj.quaternion.copy(a.obj.quaternion);
  whole.obj.scale.copy(a.obj.scale);
  whole.obj.visible = true;
  whole.cutPair = null;
  disposeHalf(a);
  disposeHalf(b);
  pair.done = true;
  if (fl) floaters.set(whole.obj, fl);
  for (const c of holders) startGrab(whole.obj, c, SHELF_GRAB);
}

function updateGlue(shelf, dt) {
  for (const pair of shelf.pairs) {
    const g = pair.glue;
    if (!g) continue;
    g.t = Math.min(1, g.t + dt / GLUE_DURATION_S);
    const e = smooth(g.t), B = pair.b.obj, A = pair.a.obj;
    B.position.lerpVectors(g.p0, A.position, e);
    B.quaternion.slerpQuaternions(g.q0, A.quaternion, e);
    B.scale.setScalar(THREE.MathUtils.lerp(g.s0, A.scale.x, e));
    if (g.t >= 1) finishGlue(pair);
  }
  shelf.pairs = shelf.pairs.filter(p => !p.done);
}

// Płaszczyzny przycinające muszą poruszać się razem z połówkami
function updateHalfPlanes(shelf) {
  for (const pair of shelf.pairs) {
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
  const shelf = shelfFor(state.mode);
  const right = getController('right');
  const active = shelf && state.knife && right;
  knife.visible = !!active;
  cutPreview.visible = false;
  if (!active) return null;
  const parent = right.grip;
  if (knife.parent !== parent) parent.add(knife);
  parent.updateMatrixWorld(true);
  knifePlaneWorld();
  const cand = findCutCandidate(shelf, knifeN, knifeP);
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
  if (cand) cutItem(cand.item, knifeN.clone(), knifeP.clone());
}

function setKnife(on) {
  state.knife = on;
  if (!on) knife.removeFromParent();
  drawMenu();
}

// Etykiety: nazwa; po wskazaniu/chwyceniu – tabliczka z danymi i warstwami
function updateShelfLabels(shelf) {
  for (const it of shelf.items) {
    const anchor = it.cutPair ? it.cutPair.a.obj : it.obj;
    const objs = it.cutPair ? [it.cutPair.a.obj, it.cutPair.b.obj] : [it.obj];
    const showInfo = state.shelfHover.has(it) || objs.some(o => grabs.has(o));
    if (showInfo && !it.infoLabel) {                     // tabliczki tworzone dopiero, gdy są potrzebne
      it.infoLabel = makeInfoLabel(it.def);
      shelf.group.add(it.infoLabel);
    }
    const near = anchor.position.distanceTo(eyePos) < MODE2_MOON_LABEL_DISTANCE_M;
    it.nameLabel.visible = !showInfo && (!it.isMoon || near);
    if (it.infoLabel) it.infoLabel.visible = showInfo;
    const lift = it.pickR * anchor.scale.x * 1.05;
    if (it.nameLabel.visible) placeLabel(it.nameLabel, anchor.position, lift, LABEL_ANGLE_DEG * (it.isMoon ? 1 : 1.3));
    if (showInfo) placeLabel(it.infoLabel, anchor.position, lift, INFO_LABEL_ANGLE_DEG);
  }
}

// Animacje obiektów (dysk czarnej dziury, pulsar, warkocze komety) – także w połówkach
function updateShelfAnimations(shelf, dt) {
  for (const it of shelf.items) if (it.update && !it.cutPair) it.update(dt, it.obj);
  for (const p of shelf.pairs) for (const h of [p.a, p.b]) if (h.update) h.update(dt, h.obj);
}

// =====================================================================
//  TRYB 3: PLANETA Z LUDZIKAMI
// =====================================================================
const mode3Group = new THREE.Group();
mode3Group.visible = false;
scene.add(mode3Group);
const mode3Light = makeHeadlight(mode3Group);

const m3Planet = new THREE.Group();              // to chwytamy; ludziki są jego dziećmi -> rosną razem z nim
m3Planet.userData.throwable = true;
mode3Group.add(m3Planet);
const M3_R = MODE3_PLANET_DIAMETER_M / 2;

// Powierzchnia planety: promień gruntu i "czy to woda" w danym kierunku (w układzie planety, skala 1)
let m3Surface;
if (models.smallPlanet) {
  const root = models.smallPlanet.scene;
  let mesh = null;
  root.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  root.updateMatrixWorld(true);
  m3Surface = buildSurfaceIndex(mesh, M3_R);     // model ma promień ~1 -> skalujemy do M3_R
  root.scale.setScalar(M3_R);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  m3Planet.add(root);
} else {
  const [canvas, ctx] = makeCanvas(1024, 512);
  drawContinents(ctx, 1024, 512, seededRandom('mode3'), MODE3_OCEAN_COLOR, MODE3_LAND_COLORS, 60);
  const mesh = new THREE.Mesh(sphereGeometryHi, new THREE.MeshLambertMaterial({ map: canvasTexture(canvas) }));
  mesh.scale.setScalar(M3_R);
  m3Planet.add(mesh);
  m3Surface = { query: () => ({ r: M3_R, water: false }) };
}

// Szybkie "promienie od środka planety": trójkąty posortowane w siatkę długość × szerokość geograficzna,
// więc każde zapytanie sprawdza tylko kilkadziesiąt trójkątów zamiast dziesiątek tysięcy.
// Model jest "skorupą" z dwiema warstwami – grunt to DRUGIE trafienie licząc od środka.
function buildSurfaceIndex(mesh, scale) {
  const geo = mesh.geometry;
  const pa = geo.attributes.position, uva = geo.attributes.uv;
  const n = pa.count;
  const P = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale); P.set([v.x, v.y, v.z], i * 3); }
  const idx = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  const triCount = idx.length / 3;
  const NLON = 128, NLAT = 64;
  const binOf = (x, y, z) => {
    const r = Math.hypot(x, y, z) || 1;
    const i = Math.floor((Math.atan2(z, x) + Math.PI) / (2 * Math.PI) * NLON) % NLON;
    const j = Math.min(NLAT - 1, Math.floor((Math.asin(THREE.MathUtils.clamp(y / r, -1, 1)) + Math.PI / 2) / Math.PI * NLAT));
    return [i, j];
  };
  const bins = Array.from({ length: NLON * NLAT }, () => []);
  for (let t = 0; t < triCount; t++) {
    const seen = new Set();
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const o = idx[t * 3 + k] * 3;
      cx += P[o]; cy += P[o + 1]; cz += P[o + 2];
      const [i, j] = binOf(P[o], P[o + 1], P[o + 2]);
      seen.add(j * NLON + i);
    }
    const [i, j] = binOf(cx, cy, cz);
    seen.add(j * NLON + i);
    for (const b of seen) bins[b].push(t);
  }
  // mała kopia tekstury do rozpoznawania wody (niebieskie = morze)
  let pix = null;
  const TW = 256;
  const img = mesh.material && mesh.material.map && mesh.material.map.image;
  if (img && MODE3_AVOID_WATER) {
    try {
      const [canvas, ctx] = makeCanvas(TW, TW);
      ctx.drawImage(img, 0, 0, TW, TW);
      pix = ctx.getImageData(0, 0, TW, TW).data;
    } catch (e) { pix = null; }
  }
  const stamp = new Int32Array(triCount);
  let query = 0;
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  const ua = new THREE.Vector2(), ub = new THREE.Vector2(), uc = new THREE.Vector2(), uvHit = new THREE.Vector2();
  let last = { r: scale, water: false };
  return {
    query(dir) {
      query++;
      ray.direction.copy(dir);
      const [bi, bj] = binOf(dir.x, dir.y, dir.z);
      let t1 = Infinity, t2 = Infinity, tri1 = -1, tri2 = -1;
      for (let dj = -1; dj <= 1; dj++) {
        const j = bj + dj;
        if (j < 0 || j >= NLAT) continue;
        for (let di = -1; di <= 1; di++) {
          for (const t of bins[j * NLON + ((bi + di + NLON) % NLON)]) {
            if (stamp[t] === query) continue;
            stamp[t] = query;
            const ia = idx[t * 3] * 3, ib = idx[t * 3 + 1] * 3, ic = idx[t * 3 + 2] * 3;
            a.set(P[ia], P[ia + 1], P[ia + 2]); b.set(P[ib], P[ib + 1], P[ib + 2]); c.set(P[ic], P[ic + 1], P[ic + 2]);
            if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
            const d = hit.length();
            if (d < t1) { t2 = t1; tri2 = tri1; t1 = d; tri1 = t; } else if (d < t2) { t2 = d; tri2 = t; }
          }
        }
      }
      const useT = tri2 >= 0 ? t2 : t1, useTri = tri2 >= 0 ? tri2 : tri1;
      if (useTri < 0) return last;
      let water = false;
      if (pix && uva) {
        const ia = idx[useTri * 3], ib = idx[useTri * 3 + 1], ic = idx[useTri * 3 + 2];
        a.set(P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]); b.set(P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]); c.set(P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]);
        hit.copy(dir).multiplyScalar(useT);
        ua.fromBufferAttribute(uva, ia); ub.fromBufferAttribute(uva, ib); uc.fromBufferAttribute(uva, ic);
        THREE.Triangle.getInterpolation(hit, a, b, c, ua, ub, uc, uvHit);
        const x = Math.min(TW - 1, Math.max(0, Math.floor((uvHit.x % 1 + 1) % 1 * TW)));
        const y = Math.min(TW - 1, Math.max(0, Math.floor((uvHit.y % 1 + 1) % 1 * TW)));
        const o = (y * TW + x) * 4;
        const R = pix[o], G = pix[o + 1], B = pix[o + 2];
        water = (B >= G - 15 && B > R + 30) || (R > 200 && G > 200 && B > 200);   // niebieskie/turkusowe lub białe chmury = woda
      }
      last = { r: useT, water };
      return last;
    },
  };
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

// Ludzik z modelu (person.glb): kopia ze szkieletem + animacja chodu. Zwraca { root, mixer } albo null.
const findClip = name => models.person
  ? (models.person.animations.find(a => a.name.toLowerCase().includes(name.toLowerCase())) || models.person.animations[0] || null)
  : null;
const personBox = models.person ? new THREE.Box3().setFromObject(models.person.scene) : null;
function makePersonModel(heightM, rnd = Math.random, animation = PERSON_ANIMATION) {
  if (!models.person) return null;
  const holder = new THREE.Group();
  const c = SkeletonUtils.clone(models.person.scene);
  const h = personBox.max.y - personBox.min.y || 1;
  const k = heightM / h;
  c.scale.setScalar(k);
  c.position.y = -personBox.min.y * k;             // stopy na ziemi
  c.rotation.y = PERSON_MODEL_YAW_DEG * DEG;
  c.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  holder.add(c);
  const mixer = new THREE.AnimationMixer(c);
  const clip = findClip(animation);
  let current = null;
  if (clip) {
    current = mixer.clipAction(clip);
    current.play();
    current.time = rnd() * clip.duration;          // każdy ludzik w innej fazie kroku
  }
  // płynne przejście do innej animacji (chód / bieg / stanie)
  const play = (name, fade = 0.4) => {
    const list = models.person.animations.filter(a => a.name.toLowerCase().includes(name.toLowerCase()));
    if (!list.length) return;
    const next = mixer.clipAction(list[Math.floor(rnd() * list.length)]);
    if (next === current) return;
    next.reset().play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  };
  return { root: holder, mixer, play };
}

function pickBehavior(rnd = Math.random) {
  let r = rnd() * MODE3_BEHAVIOR.reduce((s, b) => s + b[1], 0);
  for (const [name, w, t0, t1] of MODE3_BEHAVIOR) {
    if ((r -= w) <= 0) return [name, t0 + rnd() * (t1 - t0)];
  }
  return ['walk', 5];
}

const people = [];
{
  const rnd = seededRandom('people');
  const c = new THREE.Color();
  const randomDir = () => {
    const p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    return p.lengthSq() < 1e-3 ? p.set(0, 1, 0) : p.normalize();
  };
  for (let i = 0; i < N3; i++) {
    let p = randomDir();
    for (let k = 0; k < 200 && m3Surface.query(p).water; k++) p = randomDir();   // start na lądzie
    const f = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    f.addScaledVector(p, -f.dot(p));
    if (f.lengthSq() < 1e-4) f.set(1, 0, 0).addScaledVector(p, -p.x);
    f.normalize();
    const P = { p, f, r: m3Surface.query(p).r, speed: MODE3_PERSON_SPEED_MPS * (0.7 + rnd() * 0.6), turn: 0, phase: rnd() * 6, avoid: 0, checkIn: rnd() * 0.2,
      action: 'walk', actionT: 2 + rnd() * 8 };
    const model = makePersonModel(MODE3_PERSON_HEIGHT_M, rnd);
    if (model) {
      P.model = model;
      model.root.matrixAutoUpdate = false;
      m3Planet.add(model.root);
    }
    people.push(P);
    torsoMesh.setColorAt(i, c.set(MODE3_SHIRT_COLORS[i % MODE3_SHIRT_COLORS.length]));
  }
  torsoMesh.instanceColor.needsUpdate = true;
  if (models.person) legsMesh.visible = torsoMesh.visible = headMesh.visible = false;
}

// --- Chmurki nad planetą: puszyste kulki w jednej siatce (1 wywołanie rysowania), obracają się z planetą ---
const m3Clouds = new THREE.Group();
{
  const rnd = seededRandom('clouds');
  const puff = new THREE.SphereGeometry(1, 10, 8);
  const geoms = [];
  for (let k = 0; k < MODE3_CLOUD_COUNT; k++) {
    const dir = new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.75, rnd() * 2 - 1).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const base = dir.clone().multiplyScalar(M3_R * MODE3_CLOUD_HEIGHT);
    const size = 0.45 + rnd() * 0.55;
    const n = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const r = (0.014 + rnd() * 0.012) * size;
      const off = new THREE.Vector3((i - n / 2) * 0.016 * size, rnd() * 0.008, (rnd() - 0.5) * 0.02 * size);
      geoms.push(puff.clone().scale(r, r * 0.75, r).translate(off.x, off.y, off.z).applyQuaternion(q).translate(base.x, base.y, base.z));
    }
  }
  m3Clouds.add(mergedMesh(geoms, new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x3a4250 })));
  m3Planet.add(m3Clouds);
}

// --- Kreskówkowy mini-kosmos w tle: uśmiechnięte słoneczko i kolorowe planetki ---
const m3Cosmos = new THREE.Group();
const m3CosmosParts = { rays: null, orbits: [] };
if (MODE3_MINI_COSMOS) {
  mode3Group.add(m3Cosmos);
  const sun = new THREE.Group();
  sun.position.set(-3.4, 1.4, -4.6);                 // w lewo, w górę i do tyłu od planety
  m3Cosmos.add(sun);
  sun.add(new THREE.Mesh(sphereGeometryHi, new THREE.MeshBasicMaterial({ color: 0xffc928 })));
  sun.children[0].scale.setScalar(0.55);
  const cone = new THREE.ConeGeometry(0.09, 0.28, 8);
  const rays = mergedMesh(Array.from({ length: 12 }, (_, i) => {
    const a = i / 12 * Math.PI * 2, d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    return placedGeometry(cone, d, 0.72);
  }), new THREE.MeshBasicMaterial({ color: 0xffa21a }));
  sun.add(rays);
  m3CosmosParts.rays = rays;
  const black = new THREE.MeshBasicMaterial({ color: 0x3a2200 });
  for (const sx of [-1, 1]) sun.add(ellipsoid(black, 0.05, 0.08, 0.03, sx * 0.17, 0.12, 0.53));   // oczy
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24, Math.PI), black);
  smile.rotation.z = Math.PI; smile.position.set(0, -0.02, 0.52);
  sun.add(smile, makeGlowSprite(0xffb030, 2.6, 0.55));
  const planets = [
    { r: 0.16, color: 0x5ec2ff, orbit: 1.3, period: 40 },
    { r: 0.22, color: 0xff7a8a, orbit: 2.0, period: 65, ring: 0xffd1dc },
    { r: 0.3, color: 0x9b6bff, orbit: 2.9, period: 95, moon: 0xdddddd },
    { r: 0.12, color: 0x7ee08a, orbit: 3.6, period: 120 },
    { r: 0.2, color: 0xffb35a, orbit: 4.4, period: 160, bands: true },
  ];
  const plane = new THREE.Group();                   // płaszczyzna orbit lekko pochylona do patrzącego
  plane.rotation.x = 0.35;
  sun.add(plane);
  planets.forEach((pd, i) => {
    const orbit = new THREE.Group();
    orbit.rotation.y = i * 1.7;
    plane.add(orbit);
    let map = null;
    if (pd.bands) {
      const [canvas, ctx] = makeCanvas(64, 64);
      for (let y = 0; y < 64; y += 8) { ctx.fillStyle = y % 16 ? '#ffb35a' : '#ff8a3a'; ctx.fillRect(0, y, 64, 8); }
      map = canvasTexture(canvas);
    }
    const body = new THREE.Mesh(sphereGeometry, new THREE.MeshToonMaterial({ color: map ? 0xffffff : pd.color, map }));
    body.scale.setScalar(pd.r);
    body.position.x = pd.orbit;
    orbit.add(body);
    if (pd.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 40), new THREE.MeshToonMaterial({ color: pd.ring, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2 + 0.4;
      body.add(ring);
    }
    if (pd.moon) {
      const moonPivot = new THREE.Group();
      body.add(moonPivot);
      const moon = new THREE.Mesh(sphereGeometry, new THREE.MeshToonMaterial({ color: pd.moon }));
      moon.scale.setScalar(0.25);
      moon.position.x = 1.8;
      moonPivot.add(moon);
      m3CosmosParts.orbits.push({ obj: moonPivot, speed: 1.2 });
    }
    m3CosmosParts.orbits.push({ obj: orbit, speed: Math.PI * 2 / pd.period }, { obj: body, speed: 0.8 + i * 0.2 });
  });
}

function updateMode3Extras(dt) {
  m3Clouds.rotation.y += MODE3_CLOUD_SPEED_DEG_S * DEG * dt;
  if (!MODE3_MINI_COSMOS) return;
  m3CosmosParts.rays.rotation.z += 0.3 * dt;
  for (const o of m3CosmosParts.orbits) o.obj.rotation.y += o.speed * dt;
}

const _right = new THREE.Vector3();
const _ahead = new THREE.Vector3();
function updatePeople(dt) {
  const H = MODE3_PERSON_HEIGHT_M / PERSON_UNITS;
  _scale.setScalar(H);
  for (let i = 0; i < N3; i++) {
    const P = people[i];
    // co jakiś czas zmiana czynności: chód, bieg albo postój (rozglądanie się)
    P.actionT -= dt;
    if (P.actionT <= 0) {
      [P.action, P.actionT] = pickBehavior();
      if (P.model) P.model.play(P.action === 'run' ? PERSON_RUN_ANIMATION : P.action === 'idle' ? PERSON_IDLE_ANIMATION : PERSON_ANIMATION);
    }
    const speedK = P.action === 'run' ? MODE3_RUN_SPEED_FACTOR : P.action === 'idle' ? 0 : 1;
    const v = P.speed * speedK;
    // marsz "prosto przed siebie" = obrót po wielkim kole planety
    _right.crossVectors(P.p, P.f).normalize();
    _q1.setFromAxisAngle(_right, v * dt / M3_R);
    P.p.applyQuaternion(_q1).normalize();
    P.f.applyQuaternion(_q1);
    // przed nami woda? -> skręć w miejscu
    P.checkIn -= dt;
    if (MODE3_AVOID_WATER && P.checkIn <= 0 && v > 0) {
      P.checkIn = 0.2;
      _q1.setFromAxisAngle(_right, MODE3_PERSON_HEIGHT_M * 2.5 / M3_R);
      _ahead.copy(P.p).applyQuaternion(_q1);
      if (P.avoid <= 0 && m3Surface.query(_ahead).water) { P.avoid = 0.8; P.turn = (Math.random() < 0.5 ? -1 : 1) * 3; }
    }
    if (P.avoid > 0) P.avoid -= dt;
    else P.turn = THREE.MathUtils.clamp(P.turn + (Math.random() - 0.5) * MODE3_TURN_NOISE * dt * 4, -1.2, 1.2) * (1 - 0.5 * dt);
    _q1.setFromAxisAngle(P.p, P.turn * dt * (speedK > 0 ? 1 : 0.3));
    P.f.applyQuaternion(_q1);
    P.f.addScaledVector(P.p, -P.f.dot(P.p)).normalize();
    P.phase += v * dt / (MODE3_PERSON_HEIGHT_M * 0.35);
    // wysokość gruntu (góry, doliny) – płynnie
    P.r += (m3Surface.query(P.p).r - P.r) * Math.min(1, dt * 12);

    _right.crossVectors(P.p, P.f);                       // x = prawo, y = góra (od środka planety), z = przód
    _v1.copy(P.p).multiplyScalar(P.r);
    if (P.model) {
      P.model.root.matrix.makeBasis(_right, P.p, P.f).setPosition(_v1);
      P.model.root.matrixWorldNeedsUpdate = true;
      P.model.mixer.update(dt * (speedK === 1 ? P.speed / MODE3_PERSON_SPEED_MPS : 1));
      continue;
    }
    _m1.makeBasis(_right, P.p, P.f).scale(_scale).setPosition(_v1);
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
  if (MODE3_PLANET_SPIN_DEG_S && !grabs.has(m3Planet) && !floaters.has(m3Planet)) m3Planet.rotateY(MODE3_PLANET_SPIN_DEG_S * DEG * dt);
}

// Chwyt planety jak przedmiotu: z bliska od razu, z daleka (promieniem) przylatuje do ręki
function grabMode3(ctrl) {
  const origin = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(ctrl.matrixWorld);
  const R = M3_R * m3Planet.scale.x;
  const near = origin.distanceTo(m3Planet.position) < R + NEAR_GRAB_MARGIN_M;
  if (!near) {
    raycaster.ray.set(origin, dir);
    _sphere.set(m3Planet.position, R * 1.05);
    if (!raycaster.ray.intersectsSphere(_sphere)) return false;
  }
  const pullTo = (!near && !grabs.has(m3Planet)) ? new THREE.Vector3(0, 0, -(R + MODE3_PULL_GAP_M)) : null;
  return startGrab(m3Planet, ctrl, MODE3_GRAB, pullTo);
}

function layoutMode3() {
  const fwd = horizontalForward();
  floaters.delete(m3Planet);
  m3Planet.position.copy(eyePos).addScaledVector(fwd, MODE3_DISTANCE_M);
  m3Planet.position.y = eyePos.y + MODE3_HEIGHT_OFFSET_M;
  m3Planet.quaternion.identity();
  m3Planet.scale.setScalar(1);
  m3Planet.updateMatrixWorld(true);
  m3Cosmos.position.copy(m3Planet.position);
  m3Cosmos.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
  if (!renderer.xr.isPresenting) orbitControls.target.copy(m3Planet.position);
}

// =====================================================================
//  TRYB 5: KOSMOS – GALAKTYKI WOKÓŁ CIEBIE I SIEĆ KOSMICZNA W TLE
//   Skala: 1 m = LY_MILLIONS_PER_M mln lat świetlnych.
// =====================================================================
const mode5Group = new THREE.Group();
mode5Group.visible = false;
scene.add(mode5Group);
const universe = new THREE.Group();          // to chwytasz: przesuwasz, obracasz, skalujesz cały kosmos
mode5Group.add(universe);
const mode5Labels = new THREE.Group();
mode5Group.add(mode5Labels);

// Obrazki galaktyk (rysowane na czarnym tle, dodawane światłem – czarne = przezroczyste)
function makeGalaxyTexture(kind, seed) {
  const S = 256, c = S / 2;
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighter';
  const rnd = seededRandom(seed), gauss = gaussian(rnd);
  const dot = (x, y, r, rgb, a) => { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const bulge = (r, a) => {
    const g = ctx.createRadialGradient(c, c, 0, c, c, r);
    g.addColorStop(0, `rgba(255,245,215,${a})`);
    g.addColorStop(0.4, `rgba(255,220,160,${a * 0.45})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  };
  if (kind === 'elliptical') {
    bulge(c * 0.95, 0.9);
    bulge(c * 0.35, 0.8);
  } else if (kind === 'irregular') {
    for (let k = 0; k < 10; k++) {
      const cx = c + gauss() * c * 0.25, cy = c + gauss() * c * 0.2;
      for (let i = 0; i < 70; i++) dot(cx + gauss() * 10, cy + gauss() * 10, 0.8 + rnd() * 1.6, rnd() < 0.2 ? '255,140,190' : '170,200,255', 0.25);
    }
    bulge(c * 0.3, 0.25);
  } else {
    const arms = kind === 'spiral3' ? 3 : 2;
    const bar = kind === 'barred';
    const wind = kind === 'spiral3' ? 3.0 : 4.4;
    const r0 = bar ? 0.2 : 0.06;
    for (let i = 0; i < 2600; i++) {
      const arm = i % arms;
      const t = Math.pow(rnd(), 0.75);
      const r = (r0 + t * (0.92 - r0)) * c;
      const th = arm * (Math.PI * 2 / arms) + t * wind + gauss() * 0.22;
      const pink = rnd() < 0.06;
      dot(c + Math.cos(th) * r + gauss() * 3, c + Math.sin(th) * r + gauss() * 3, 0.7 + rnd() * 1.4,
        pink ? '255,120,180' : '170,200,255', (pink ? 0.45 : 0.22) * (1 - 0.6 * t));
    }
    for (let i = 0; i < 900; i++) {                     // rozmyty dysk między ramionami
      const r = Math.abs(gauss()) * c * 0.35, th = rnd() * Math.PI * 2;
      dot(c + Math.cos(th) * r, c + Math.sin(th) * r, 1, '255,230,200', 0.06);
    }
    if (bar) {
      const g = ctx.createLinearGradient(c - c * 0.32, c, c + c * 0.32, c);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(255,225,170,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c, c, c * 0.32, c * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    }
    bulge(c * 0.28, 0.95);
  }
  return canvasTexture(canvas);
}

const GALAXY_KINDS = [
  { kind: 'spiral2', share: 0.3, tint: [0.85, 0.92, 1.0], billboard: false },
  { kind: 'barred', share: 0.2, tint: [0.95, 0.95, 1.0], billboard: false },
  { kind: 'spiral3', share: 0.15, tint: [0.8, 0.9, 1.0], billboard: false },
  { kind: 'elliptical', share: 0.25, tint: [1.0, 0.85, 0.65], billboard: true },
  { kind: 'irregular', share: 0.1, tint: [0.8, 0.9, 1.0], billboard: true },
];

const galaxyMeshes = [];       // jedno InstancedMesh na rodzaj galaktyki = kilka wywołań rysowania
const galaxies = [];           // { mesh, index, pos, vel, quat, spin, size, aspect, fixed }
const namedPlaces = [];        // etykiety: { label, pos }

// Tło: sfera z obrazem sieci kosmicznej (włókna i gromady galaktyk), rysowana raz przy starcie.
// Sieć jest wygenerowana w 3D i "rzutowana" na niebo, więc bliższe włókna przecinają całe niebo.
function buildCosmicWebSky(rnd, gauss) {
  const W = WEB_TEXTURE_WIDTH, H = W / 2;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const toPixel = v => {                       // kierunek -> piksel mapy równokątnej (UV sfery three.js)
    const d = v.clone().normalize();
    let phi = Math.atan2(d.z, -d.x);
    if (phi < 0) phi += Math.PI * 2;
    return [phi / (Math.PI * 2) * W, Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI * H];
  };
  const dot = (v, rgb, bright, size) => {
    const [x, y] = toPixel(v);
    ctx.fillStyle = `rgba(${rgb},${Math.min(1, bright)})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };
  const nodes = [];
  while (nodes.length < WEB_NODE_COUNT) {
    const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(0.15 + 0.85 * Math.cbrt(rnd()));
    nodes.push(v);
  }
  const edges = new Set();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, a.distanceTo(b)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3)
      .forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  const edgeList = [...edges].map(k => k.split('-').map(Number));
  const lengths = edgeList.map(([i, j]) => nodes[i].distanceTo(nodes[j]));
  const total = lengths.reduce((s, l) => s + l, 0);
  const sizeK = W / 2048;
  const emit = (v, warm) => {
    const near = 1 / (v.length() + 0.15);                 // bliższe = jaśniejsze i większe
    const rgb = warm ? '255,215,170' : (rnd() < 0.5 ? '170,180,255' : '205,175,255');
    dot(v, rgb, 0.18 * near * (0.4 + rnd()), sizeK * (0.8 + near * 0.9 * rnd()));
  };
  edgeList.forEach(([i, j], e) => {
    const n = Math.round(WEB_POINT_COUNT * 0.7 * lengths[e] / total);
    for (let k = 0; k < n; k++) {
      const t = rnd();
      const w = 0.012 + 0.02 * rnd();
      emit(new THREE.Vector3().lerpVectors(nodes[i], nodes[j], t).add(new THREE.Vector3(gauss() * w, gauss() * w, gauss() * w)), rnd() < 0.12);
    }
  });
  const perNode = WEB_POINT_COUNT * 0.3 / nodes.length;
  for (const nd of nodes) {
    const sigma = 0.01 + 0.025 * rnd();
    for (let k = 0; k < perNode; k++) emit(nd.clone().add(new THREE.Vector3(gauss() * sigma, gauss() * sigma, gauss() * sigma)), rnd() < 0.5);
  }
  // poświata włókien: rozmyta kopia dodana na wierzch
  const [glow, gctx] = makeCanvas(W / 4, H / 4);
  gctx.filter = 'blur(3px)';
  gctx.drawImage(canvas, 0, 0, W / 4, H / 4);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(glow, 0, 0, W, H);
  ctx.globalAlpha = 1;
  const tex = canvasTexture(canvas);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(WEB_SKY_RADIUS_M, 64, 32), new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, depthWrite: false, depthTest: false,
  }));
  sky.renderOrder = -90;
  sky.frustumCulled = false;
  return sky;
}

const cosmos = (() => {
  const rnd = seededRandom('cosmos'), gauss = gaussian(rnd);
  const quad = new THREE.PlaneGeometry(1, 1);
  const sky = buildCosmicWebSky(rnd, gauss);
  mode5Group.add(sky);                               // tło nie skaluje się – zawsze "w nieskończoności"

  // --- trójwymiarowy fragment sieci kosmicznej: gromady połączone włóknami, galaktyki jako punkty ---
  const filDir = new THREE.Vector3(-0.78, 0.15, -0.6).normalize();   // "nasze" włókno przechodzi przez Ciebie
  const nodes = [filDir.clone().multiplyScalar(WEB3D_RADIUS_M * 0.7), filDir.clone().multiplyScalar(-WEB3D_RADIUS_M * 0.75)];
  const virgo = new THREE.Vector3(-30, 18, -42).normalize().multiplyScalar(54);
  nodes.push(virgo);
  while (nodes.length < WEB3D_NODE_COUNT) {
    const v = new THREE.Vector3(gauss(), gauss() * 0.8, gauss()).normalize().multiplyScalar(WEB3D_RADIUS_M * Math.cbrt(rnd()));
    if (v.length() > 30) nodes.push(v);
  }
  const edges = new Set(['0-2', '1-2']);
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, a.distanceTo(b)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3)
      .forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  const edgeList = [...edges].map(k => k.split('-').map(Number));
  const lengths = edgeList.map(([i, j]) => nodes[i].distanceTo(nodes[j]));
  const totalLen = lengths.reduce((a, l) => a + l, 0);
  const pos = [], col = [];
  const push = (v, warm) => {
    if (v.length() < GALAXY_FIELD_RADIUS_M * 0.8) return;   // blisko są obrazki galaktyk
    pos.push(v.x, v.y, v.z);
    const b = 0.35 + rnd() * 0.5;
    if (warm) col.push(b, b * 0.82, b * 0.6); else col.push(b * 0.78, b * 0.82, b);
  };
  edgeList.forEach(([i, j], e) => {
    const n = Math.round(WEB3D_POINT_COUNT * 0.72 * lengths[e] / totalLen);
    for (let k = 0; k < n; k++) {
      const t = rnd(), w = 2.5 + 3 * rnd();
      push(new THREE.Vector3().lerpVectors(nodes[i], nodes[j], t).add(new THREE.Vector3(gauss() * w, gauss() * w, gauss() * w)), rnd() < 0.15);
    }
  });
  for (const nd of nodes) {
    const sigma = 3 + rnd() * 5;
    for (let k = 0; k < WEB3D_POINT_COUNT * 0.28 / nodes.length; k++) push(nd.clone().add(new THREE.Vector3(gauss() * sigma, gauss() * sigma, gauss() * sigma)), rnd() < 0.55);
  }
  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  webGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const web = new THREE.Points(webGeo, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  web.frustumCulled = false;
  universe.add(web);
  namedPlaces.push({ label: makeLabel('Gromada w Pannie (54 mln lat św.)'), pos: virgo.clone(), lift: 6 });

  const specs = [];
  // Nasza Grupa Lokalna w prawdziwej skali (1 m = 1 mln lat św.)
  specs.push({ kind: 'barred', pos: new THREE.Vector3(0, -0.35, -0.7), size: 0.1, fixed: true, name: 'Droga Mleczna – tu jesteśmy', normal: new THREE.Vector3(0.2, 1, 0.3) });
  specs.push({ kind: 'spiral2', pos: new THREE.Vector3(0.55, 0.25, -0.8).normalize().multiplyScalar(2.5), size: 0.22, fixed: true, name: 'Galaktyka Andromedy (2,5 mln lat św.)', normal: new THREE.Vector3(0.9, 0.35, 0.3) });
  const pickKind = () => { let r = rnd(); for (const k of GALAXY_KINDS) { if ((r -= k.share) <= 0) return k.kind; } return 'spiral2'; };
  while (specs.length < GALAXY_COUNT) {
    let p;
    if (rnd() < GALAXY_ON_FILAMENT) {                 // wzdłuż włókna przechodzącego przez Ciebie
      p = filDir.clone().multiplyScalar((rnd() * 2 - 1) * GALAXY_FIELD_RADIUS_M).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(2.5));
      if (p.length() < GALAXY_MIN_DIST_M || p.length() > GALAXY_FIELD_RADIUS_M) continue;
    } else {
      const dir = new THREE.Vector3(gauss(), gauss(), gauss()).normalize();
      p = dir.multiplyScalar(GALAXY_MIN_DIST_M + (GALAXY_FIELD_RADIUS_M - GALAXY_MIN_DIST_M) * Math.pow(rnd(), GALAXY_NEAR_DENSITY / 3 + 0.33));
    }
    if (p.distanceTo(specs[0].pos) < 0.35 || p.distanceTo(specs[1].pos) < 0.5) continue;   // wolne miejsce wokół naszych galaktyk
    const size = GALAXY_SIZE_MIN_M * Math.pow(GALAXY_SIZE_MAX_M / GALAXY_SIZE_MIN_M, Math.pow(rnd(), 1.4));
    specs.push({ kind: pickKind(), pos: p, size });
  }
  for (const k of GALAXY_KINDS) {
    const list = specs.filter(s => s.kind === k.kind);
    const mesh = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({
      map: makeGalaxyTexture(k.kind, k.kind), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }), list.length);
    mesh.frustumCulled = false;
    const color = new THREE.Color();
    list.forEach((s, index) => {
      const g = {
        mesh, index, billboard: k.billboard, pos: s.pos.clone(), size: s.size, fixed: !!s.fixed,
        aspect: k.billboard ? 0.6 + rnd() * 0.4 : 1,
        vel: s.fixed ? new THREE.Vector3() : new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(GALAXY_DRIFT_MPS * (0.3 + rnd())),
        quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, (s.normal || new THREE.Vector3(gauss(), gauss(), gauss())).normalize()),
        spin: (0.03 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1),
      };
      const b = s.fixed ? 1 : 0.5 + rnd() * 0.5;
      mesh.setColorAt(index, color.setRGB(k.tint[0] * b, k.tint[1] * b, k.tint[2] * b));
      galaxies.push(g);
      if (s.name) namedPlaces.push({ label: makeLabel(s.name), pos: s.pos.clone(), lift: s.size * 0.7 });
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    galaxyMeshes.push(mesh);
    universe.add(mesh);
  }
  for (const n of namedPlaces) mode5Labels.add(n.label);
  return { sky, web };
})();

const _spinQ = new THREE.Quaternion();
function updateGalaxies(dt) {
  cosmos.sky.position.copy(eyePos);
  cosmos.sky.quaternion.copy(universe.quaternion);
  universe.updateMatrixWorld(true);
  const eyeLocal = _v3.copy(eyePos).applyMatrix4(_m3.copy(universe.matrixWorld).invert());
  for (const g of galaxies) {
    if (!g.fixed) {
      g.pos.addScaledVector(g.vel, dt);
      const r = g.pos.length();
      if (r > GALAXY_FIELD_RADIUS_M) g.pos.multiplyScalar(-0.98);   // wylatuje z jednej strony – wraca z drugiej
      else if (r < GALAXY_MIN_DIST_M) g.vel.negate();             // nie wlatuje w twarz
    }
    if (g.billboard) {
      _m1.lookAt(eyeLocal, g.pos, UP);                     // eliptyczne i nieregularne: zawsze przodem do Ciebie
      _q1.setFromRotationMatrix(_m1);
    } else {
      g.quat.multiply(_spinQ.setFromAxisAngle(Z_AXIS, g.spin * dt));            // spirale powoli wirują
      _q1.copy(g.quat);
    }
    _scale.set(g.size, g.size * g.aspect, 1);
    _m2.compose(g.pos, _q1, _scale);
    g.mesh.setMatrixAt(g.index, _m2);
  }
  for (const m of galaxyMeshes) m.instanceMatrix.needsUpdate = true;
  for (const n of namedPlaces) {
    _v1.copy(n.pos).applyMatrix4(universe.matrixWorld);
    placeLabel(n.label, _v1, n.lift * universe.scale.x, LABEL_ANGLE_DEG);
  }
}

function layoutMode5() {
  const fwd = horizontalForward();
  universe.position.copy(eyePos);
  universe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
  universe.scale.setScalar(1);
  universe.updateMatrixWorld(true);
  if (!renderer.xr.isPresenting) orbitControls.target.copy(eyePos).addScaledVector(fwd, 0.7).setY(eyePos.y - 0.35);
}

function formatLy(millions) {
  if (millions >= 1000) return `${(millions / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} mld`;
  if (millions >= 1) return `${millions.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} mln`;
  return `${Math.round(millions * 1000).toLocaleString('pl-PL')} tys.`;
}

// =====================================================================
//  TRYB 6: SKALA – OD BAKTERII DO ZIEMI
//   state.scaleLog = log10(ile metrów naprawdę odpowiada 1 m w goglach).
//   Obiekty stoją w rzędzie; zbyt małe i zbyt duże płynnie znikają.
// =====================================================================
const mode6Group = new THREE.Group();
mode6Group.visible = false;
scene.add(mode6Group);
const mode6Light = makeHeadlight(mode6Group);

const stdMat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts });

// odcinek (walec) między dwoma punktami
function beam(a, b, radius, mat, radial = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), radial, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function ellipsoid(mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(sphereGeometry, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// wiele małych elementów (kolce, atomy) jako jedna siatka = jedno wywołanie rysowania
function mergedMesh(geoms, mat) {
  const merged = mergeGeometries(geoms.map(g => (g.index ? g.toNonIndexed() : g)), false);
  return new THREE.Mesh(merged, mat);
}
// geometria ustawiona wzdłuż kierunku (od środka) w danej odległości
function placedGeometry(geo, dir, dist) {
  const m = new THREE.Matrix4().compose(dir.clone().multiplyScalar(dist), new THREE.Quaternion().setFromUnitVectors(UP, dir), new THREE.Vector3(1, 1, 1));
  return geo.clone().applyMatrix4(m);
}
const fibonacciDirs = n => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963;
  return V(Math.cos(a) * r, y, Math.sin(a) * r);
});
function sphereVisual(def, R) {                 // planeta/księżyc z tablic BODIES/MOONS (z teksturą zastępczą)
  const v = buildPlanetVisual({ tilt: 0, ...def }, R, null);
  v.group.position.y = R;
  const g = new THREE.Group();
  g.add(v.group);
  return g;
}
// chmura punktów (komety, gwiazdy); place(v) ustawia punkt z kuli jednostkowej
function starPoints(n, seed, place, color = [0.85, 0.9, 1]) {
  const rnd = seededRandom(seed), gauss = gaussian(rnd);
  const pos = [], col = [];
  for (let i = 0; i < n; i++) {
    const v = place(V(gauss(), gauss(), gauss()).normalize().multiplyScalar(Math.cbrt(rnd())), rnd);
    pos.push(v.x, v.y, v.z);
    const b = 0.4 + rnd() * 0.6;
    col.push(color[0] * b, color[1] * b, color[2] * b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
// obłok komet: promień wewn./zewn., spłaszczenie (1 = kula)
function cometCloud(n, r0, r1, flat) {
  const g = new THREE.Group();
  g.add(starPoints(n, 'comets' + n, (v, rnd) => {
    const r = r0 + (r1 - r0) * Math.sqrt(rnd());
    return v.normalize().multiplyScalar(r).multiply(V(1, flat, 1)).add(V(0, 0.5, 0));
  }, [0.75, 0.85, 1]));
  const sun = makeGlowSprite(0xffd060, 0.03, 1); sun.position.y = 0.5;
  g.add(sun);
  return g;
}
const galaxyTextureCache = {};
function galaxyQuad(kind, size, y, tilt) {
  galaxyTextureCache[kind] = galaxyTextureCache[kind] || makeGalaxyTexture(kind, kind + '6');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: galaxyTextureCache[kind], transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  m.position.y = y;
  m.rotation.x = tilt;
  return m;
}
function starVisual(color, glowColor, lumpy = false) {
  const g = new THREE.Group();
  const geo = lumpy ? lumpyGeometry('star' + color, 1, 1, 1) : sphereGeometryHi;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.scale.setScalar(0.5);
  m.position.y = 0.5;
  const glow = makeGlowSprite(glowColor, 1.7, 0.75);
  glow.position.y = 0.5;
  g.add(m, glow);
  return g;
}

// Każdy model ma rozmiar opisany w SCALE_OBJECTS = 1 jednostka, podstawa na y = 0
const SCALE_BUILDERS = {
  bacterium() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.68, 8, 16), stdMat(0x7cc96b, { roughness: 0.35, emissive: 0x0b2408 }));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.2;
    g.add(body);
    const fl = stdMat(0xd8ecd0);
    for (let k = 0; k < 4; k++) {                       // wici (napęd bakterii)
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        pts.push(V(-0.48 - t * 0.7, 0.2 + Math.sin(t * 12 + k * 1.6) * 0.06 + (k - 1.5) * 0.06 * t, Math.cos(t * 12 + k) * 0.06 + (k % 2 - 0.5) * 0.15 * t));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 5), fl));
    }
    return g;
  },
  rbc() {
    // kształt dwuwklęsły (wzór Evansa–Funga)
    const pts = [];
    const N = 28;
    const z = x => 0.25 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.207161 + 2.002558 * x * x - 1.122762 * x ** 4);
    for (let i = 0; i <= N; i++) { const x = i / N; pts.push(new THREE.Vector2(x * 0.5, z(x))); }
    for (let i = N; i >= 0; i--) { const x = i / N; pts.push(new THREE.Vector2(x * 0.5, -z(x))); }
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), stdMat(0xb3202a, { roughness: 0.45, side: THREE.DoubleSide }));
    m.rotation.x = 1.1;
    m.position.y = 0.46;
    const g = new THREE.Group();
    g.add(m);
    return g;
  },
  hair() {
    const [canvas, ctx] = makeCanvas(64, 256);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 9) {                  // łuski włosa jak dachówki
      ctx.strokeStyle = 'rgba(20,10,5,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= 64; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 2.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(160,120,90,0.25)'; ctx.fillRect(0, y + 2, 64, 3);
    }
    const tex = canvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 3);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.086, 1, 28, 1), stdMat(0xffffff, { map: tex, roughness: 0.5 }));
    m.position.y = 0.5;
    m.rotation.z = 0.12;
    const g = new THREE.Group();
    g.add(m);
    return g;
  },
  ant() {
    const g = new THREE.Group();
    const mat = stdMat(0x2a1810, { roughness: 0.3 });
    g.add(ellipsoid(mat, 0.17, 0.14, 0.22, 0, 0.21, -0.3), ellipsoid(mat, 0.045, 0.045, 0.06, 0, 0.18, -0.06),
      ellipsoid(mat, 0.07, 0.07, 0.16, 0, 0.19, 0.06), ellipsoid(mat, 0.1, 0.09, 0.1, 0, 0.22, 0.3));
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const z = -0.02 + k * 0.08;
        const hip = V(sx * 0.05, 0.17, z), knee = V(sx * 0.2, 0.28, z + (k - 1) * 0.1), foot = V(sx * 0.32, 0.0, z + (k - 1) * 0.22);
        g.add(beam(hip, knee, 0.012, mat), beam(knee, foot, 0.01, mat));
      }
      const a0 = V(sx * 0.04, 0.27, 0.36), a1 = V(sx * 0.1, 0.4, 0.42), a2 = V(sx * 0.17, 0.33, 0.56);
      g.add(beam(a0, a1, 0.008, mat), beam(a1, a2, 0.007, mat));
    }
    return g;
  },
  hamster() {
    const g = new THREE.Group();
    const fur = stdMat(0xd8964e, { roughness: 0.9 }), belly = stdMat(0xf5e6d0, { roughness: 0.9 });
    const pink = stdMat(0xf0a0a8), black = stdMat(0x111111, { roughness: 0.2 });
    g.add(ellipsoid(fur, 0.32, 0.28, 0.42, 0, 0.29, -0.02), ellipsoid(belly, 0.26, 0.2, 0.34, 0, 0.22, 0.04),
      ellipsoid(fur, 0.24, 0.22, 0.22, 0, 0.36, 0.3));
    for (const sx of [-1, 1]) {
      g.add(ellipsoid(belly, 0.12, 0.1, 0.12, sx * 0.14, 0.3, 0.36),          // policzki
        ellipsoid(fur, 0.065, 0.075, 0.03, sx * 0.13, 0.56, 0.24), ellipsoid(pink, 0.045, 0.055, 0.02, sx * 0.13, 0.56, 0.26),
        ellipsoid(black, 0.035, 0.035, 0.03, sx * 0.1, 0.42, 0.49),
        ellipsoid(pink, 0.06, 0.03, 0.08, sx * 0.16, 0.03, 0.22), ellipsoid(pink, 0.06, 0.03, 0.08, sx * 0.17, 0.03, -0.25));
    }
    g.add(ellipsoid(pink, 0.03, 0.025, 0.025, 0, 0.37, 0.53));
    return g;
  },
  human() {
    const model = makePersonModel(1, Math.random, PERSON_IDLE_ANIMATION);
    if (model) { model.root.userData.mixer = model.mixer; return model.root; }
    const g = new THREE.Group();
    const skin = stdMat(0xf0c8a0), shirt = stdMat(0x3a78c8), pants = stdMat(0x2c3e50), hair = stdMat(0x3a2a1a), shoe = stdMat(0x222222);
    for (const sx of [-1, 1]) {
      g.add(beam(V(sx * 0.06, 0.48, 0), V(sx * 0.07, 0.04, 0.01), 0.045, pants, 10));
      g.add(ellipsoid(shoe, 0.045, 0.03, 0.08, sx * 0.07, 0.03, 0.03));
      g.add(beam(V(sx * 0.16, 0.8, 0), V(sx * 0.2, 0.48, 0.02), 0.035, shirt, 10));
      g.add(ellipsoid(skin, 0.035, 0.045, 0.035, sx * 0.205, 0.44, 0.02));
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.24, 6, 12), shirt);
    torso.position.y = 0.64;
    g.add(torso, ellipsoid(skin, 0.075, 0.09, 0.08, 0, 0.9, 0), ellipsoid(hair, 0.08, 0.05, 0.085, 0, 0.96, -0.01));
    return g;
  },
  eiffel() {
    const g = new THREE.Group();
    const mat = stdMat(0x6e5a3e, { roughness: 0.8, metalness: 0.2 });
    const w = h => 0.19 * Math.exp(-3.16 * h);           // połowa szerokości wieży na wysokości h
    const levels = [0, 0.06, 0.12, 0.173, 0.23, 0.29, 0.35, 0.45, 0.55, 0.65, 0.75, 0.84];
    const corner = (h, sx, sz) => V(sx * w(h), h, sz * w(h));
    const linePts = [];
    for (let i = 0; i < levels.length - 1; i++) {
      const h0 = levels[i], h1 = levels[i + 1];
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(beam(corner(h0, sx, sz), corner(h1, sx, sz), 0.004 + 0.012 * (1 - h0), mat));
      const c0 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => corner(h0, a, b));
      const c1 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => corner(h1, a, b));
      for (let k = 0; k < 4; k++) {                      // kratownica: poziomy i krzyże na każdej ścianie
        const n = (k + 1) % 4;
        if (h0 > 0.15) linePts.push(c0[k], c0[n]);
        linePts.push(c0[k], c1[n], c0[n], c1[k]);
      }
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x9a8058 })));
    for (const [h, t] of [[0.173, 0.012], [0.35, 0.01], [0.84, 0.008]]) {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(2 * w(h) + 0.03, t, 2 * w(h) + 0.03), mat);
      plat.position.y = h;
      g.add(plat);
    }
    for (let k = 0; k < 4; k++) {                        // łuki między nogami
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.006, 6, 24, Math.PI), mat);
      arch.position.y = 0.0;
      arch.rotation.y = k * Math.PI / 2;
      arch.translateZ(w(0.06));
      g.add(arch);
    }
    g.add(beam(V(0, 0.84, 0), V(0, 1, 0), 0.004, mat));
    return g;
  },
  everest() {
    const geo = new THREE.ConeGeometry(0.75, 1, 64, 20).translate(0, 0.5, 0);
    const p = geo.attributes.position;
    const colors = [];
    const rnd = seededRandom('everest');
    const ph = Array.from({ length: 4 }, () => rnd() * 6);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = 0.22 * Math.sin(a * 3 + ph[0]) + 0.12 * Math.sin(a * 7 + ph[1] + y * 6) + 0.06 * Math.sin(a * 17 + ph[2]);
      const k = y < 0.995 ? 1 + n * (1 - y) : 1;
      p.setXYZ(i, x * k, y + (y > 0.02 && y < 0.99 ? 0.02 * Math.sin(a * 11 + ph[3]) : 0), z * k);
      const snow = y > 0.55 + 0.08 * Math.sin(a * 5);
      const c = snow ? [0.95, 0.96, 1] : y > 0.25 ? [0.45, 0.43, 0.41] : [0.38, 0.33, 0.27];
      const j = 0.9 + rnd() * 0.15;
      colors.push(c[0] * j, c[1] * j, c[2] * j);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, stdMat(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.95 })));
    return g;
  },
  atom() {
    const g = new THREE.Group();
    const cloud = new THREE.Mesh(sphereGeometryHi, stdMat(0x5aa0ff, { transparent: true, opacity: 0.18, depthWrite: false, emissive: 0x10305a }));
    cloud.scale.setScalar(0.5); cloud.position.y = 0.5;
    const nucleus = ellipsoid(stdMat(0xff5a40, { emissive: 0x401008 }), 0.05, 0.05, 0.05, 0, 0.5, 0);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.004, 6, 80), stdMat(0x9fd0ff, { emissive: 0x2a4a70 }));
    orbit.position.y = 0.5; orbit.rotation.x = 1.2;
    const electron = ellipsoid(stdMat(0x9fe0ff, { emissive: 0x3070a0 }), 0.03, 0.03, 0.03, 0.38, 0.5, 0);
    g.add(cloud, nucleus, orbit, electron);
    return g;
  },
  glucose() {
    const g = new THREE.Group();
    const C = stdMat(0x505050), O = stdMat(0xe03030), H = stdMat(0xf0f0f0), bond = stdMat(0xbbbbbb);
    const ring = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ring.push(V(Math.cos(a) * 0.22, 0.5 + Math.sin(a) * 0.22, 0)); }
    ring.forEach((p, i) => {
      g.add(ellipsoid(i === 0 ? O : C, 0.07, 0.07, 0.07, p.x, p.y, p.z));
      g.add(beam(p, ring[(i + 1) % 6], 0.015, bond));
      if (i > 0) {                                   // grupy -OH na zewnątrz pierścienia
        const out = p.clone().sub(V(0, 0.5, 0)).setZ(0).normalize();
        const o = p.clone().addScaledVector(out, 0.17).add(V(0, 0, (i % 2 ? 0.08 : -0.08)));
        const h = o.clone().addScaledVector(out, 0.1);
        g.add(beam(p, o, 0.012, bond), ellipsoid(O, 0.055, 0.055, 0.055, o.x, o.y, o.z), beam(o, h, 0.01, bond), ellipsoid(H, 0.035, 0.035, 0.035, h.x, h.y, h.z));
      }
    });
    return g;
  },
  dna() {
    const g = new THREE.Group();
    const strand = (phase, color) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 2 + phase; pts.push(V(Math.cos(a) * 0.2, t, Math.sin(a) * 0.2)); }
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.03, 8), stdMat(color, { roughness: 0.4 }));
    };
    g.add(strand(0, 0x3a7bd5), strand(Math.PI * 0.8, 0xe08a2a));
    const colors = [0x4caf50, 0xe53935, 0xfdd835, 0x8e24aa];
    for (let k = 0; k < 10; k++) {                    // pary zasad (A–T, G–C)
      const t = (k + 0.5) / 10, a = t * Math.PI * 2;
      const p1 = V(Math.cos(a) * 0.2, t, Math.sin(a) * 0.2), p2 = V(Math.cos(a + Math.PI * 0.8) * 0.2, t, Math.sin(a + Math.PI * 0.8) * 0.2);
      const mid = p1.clone().lerp(p2, 0.5);
      g.add(beam(p1, mid, 0.02, stdMat(colors[k % 4])), beam(mid, p2, 0.02, stdMat(colors[(k + 2) % 4])));
    }
    return g;
  },
  ribosome() {
    const g = new THREE.Group();
    const big = new THREE.Mesh(lumpyGeometry('rib1', 1, 0.8, 0.9), stdMat(0x6b8fd6, { roughness: 0.8 }));
    big.scale.setScalar(0.33); big.position.y = 0.6;
    const small = new THREE.Mesh(lumpyGeometry('rib2', 1, 0.6, 0.8), stdMat(0xd6a86b, { roughness: 0.8 }));
    small.scale.setScalar(0.27); small.position.set(0.04, 0.2, 0.02);
    g.add(big, small);
    return g;
  },
  virus() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(sphereGeometryHi, stdMat(0xc85a8a, { roughness: 0.7 }));
    body.scale.setScalar(0.33); body.position.y = 0.5;
    const stalk = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5), head = new THREE.SphereGeometry(0.035, 6, 4);
    const geoms = [];
    for (const d of fibonacciDirs(70)) geoms.push(placedGeometry(stalk, d, 0.38), placedGeometry(head, d, 0.46));
    const spikes = mergedMesh(geoms, stdMat(0xf0d070, { roughness: 0.6 }));
    spikes.position.y = 0.5;
    g.add(body, spikes);
    return g;
  },
  pollen() {
    const g = new THREE.Group();
    const mat = stdMat(0xe8c040, { roughness: 0.85 });
    const body = new THREE.Mesh(sphereGeometryHi, mat);
    body.scale.setScalar(0.4); body.position.y = 0.5;
    const cone = new THREE.ConeGeometry(0.03, 0.1, 6);
    const spikes = mergedMesh(fibonacciDirs(140).map(d => placedGeometry(cone, d, 0.43)), mat);
    spikes.position.y = 0.5;
    g.add(body, spikes);
    return g;
  },
  coin() {
    const [canvas, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#c9c9cf'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#9a9aa2'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8a8a92'; ctx.font = 'bold 120px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('1', 128, 112); ctx.font = 'bold 44px system-ui, sans-serif'; ctx.fillText('ZŁOTY', 128, 196);
    const face = stdMat(0xffffff, { map: canvasTexture(canvas), metalness: 0.7, roughness: 0.35 });
    const edge = stdMat(0xbfbfc6, { metalness: 0.7, roughness: 0.35 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 64), [edge, face, face]);
    m.rotation.x = Math.PI / 2; m.position.y = 0.5;
    const g = new THREE.Group();
    g.add(m);
    return g;
  },
  bus() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 0.21), stdMat(0xd8342c, { roughness: 0.5 }));
    body.position.y = 0.17;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.075, 0.214), stdMat(0x1c2a3a, { roughness: 0.2, metalness: 0.3 }));
    windows.position.set(-0.02, 0.22, 0);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.18), stdMat(0x1c2a3a, { roughness: 0.2 }));
    front.position.set(0.5, 0.2, 0);
    const wheelGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.03, 16).rotateX(Math.PI / 2);
    const wheels = mergedMesh([[-0.33, 0.106], [-0.33, -0.106], [0.33, 0.106], [0.33, -0.106]].map(([x, z]) => wheelGeo.clone().translate(x, 0.048, z)), stdMat(0x111111));
    g.add(body, windows, front, wheels);
    return g;
  },
  whale() {
    const g = new THREE.Group();
    const skin = stdMat(0x5a7aa0, { roughness: 0.6 }), belly = stdMat(0xc8d4e0, { roughness: 0.7 });
    g.add(ellipsoid(skin, 0.42, 0.075, 0.09, 0.05, 0.1, 0), ellipsoid(belly, 0.36, 0.05, 0.07, 0.08, 0.07, 0),
      ellipsoid(skin, 0.14, 0.05, 0.06, -0.38, 0.11, 0));
    for (const sz of [-1, 1]) {
      const fluke = ellipsoid(skin, 0.07, 0.01, 0.07, -0.5, 0.12, sz * 0.06); fluke.rotation.y = sz * 0.5; g.add(fluke);
      const fin = ellipsoid(skin, 0.07, 0.008, 0.025, 0.2, 0.06, sz * 0.09); fin.rotation.y = -sz * 0.6; fin.rotation.x = sz * 0.4; g.add(fin);
    }
    return g;
  },
  burj() {
    const g = new THREE.Group();
    const mat = stdMat(0xaebdd0, { metalness: 0.6, roughness: 0.3 });
    const segs = [[0, 0.18, 0.12], [0.18, 0.34, 0.1], [0.34, 0.48, 0.08], [0.48, 0.6, 0.06], [0.6, 0.7, 0.045], [0.7, 0.78, 0.03], [0.78, 0.83, 0.02]];
    for (const [y0, y1, r] of segs) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, y1 - y0, 6), mat);
      m.position.y = (y0 + y1) / 2;
      g.add(m);
    }
    g.add(beam(V(0, 0.83, 0), V(0, 1, 0), 0.006, mat));
    return g;
  },
  phobos() {
    const m = new THREE.Mesh(lumpyGeometry('phobos', 1, 0.82, 0.72), stdMat(0x7a6e64, { roughness: 0.95 }));
    m.scale.setScalar(0.5); m.position.y = 0.42;
    const g = new THREE.Group(); g.add(m); return g;
  },
  amalthea() {
    const m = new THREE.Mesh(lumpyGeometry('amalthea', 1, 0.6, 0.55), stdMat(0xa04a2a, { roughness: 0.9 }));
    m.scale.setScalar(0.5); m.position.y = 0.33;
    const g = new THREE.Group(); g.add(m); return g;
  },
  enceladus() { return sphereVisual(MOONS.saturn.find(m => m.id === 'enceladus'), 0.5); },
  moon() { return sphereVisual(MOONS.earth[0], 0.5); },
  jupiter() { return sphereVisual(BODIES.find(b => b.id === 'jupiter'), 0.5); },
  sun() {
    const g = sphereVisual(BODIES.find(b => b.id === 'sun'), 0.5);
    const glow = makeGlowSprite(0xffd060, 1.6, 0.6);
    glow.position.y = 0.5;
    g.add(glow);
    return g;
  },
  arcturus() { return starVisual(0xffa860, 0xff9040); },
  betelgeuse() { return starVisual(0xff6a30, 0xff4a20, true); },
  solarsystem() {
    const g = new THREE.Group();
    const disk = new THREE.Group();
    disk.position.y = 0.5;
    disk.rotation.x = 0.45;                            // lekko pochylony, żeby orbity były widoczne
    const nep = BODIES.find(b => b.id === 'neptune').au;
    for (const b of BODIES) {
      if (b.au <= 0 || b.id === 'pluto') continue;
      const r = 0.5 * b.au / nep;
      disk.add(makeCircleLineXZ(r, 128, b.color, 0.8));
      const a = (b.L0 || 0) * DEG;
      const dot = ellipsoid(new THREE.MeshBasicMaterial({ color: b.color }), 0.008, 0.008, 0.008, Math.cos(a) * r, 0, -Math.sin(a) * r);
      disk.add(dot);
    }
    disk.add(ellipsoid(new THREE.MeshBasicMaterial({ color: 0xffd060 }), 0.012, 0.012, 0.012, 0, 0, 0));
    const glow = makeGlowSprite(0xffd060, 0.08, 0.9);
    disk.add(glow);
    g.add(disk);
    return g;
  },
  heliosphere() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(sphereGeometryHi, stdMat(0x6fa8ff, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, emissive: 0x18305a }));
    shell.scale.set(0.5, 0.36, 0.36); shell.position.y = 0.36;
    const shock = new THREE.Mesh(sphereGeometryHi, stdMat(0xa8d0ff, { transparent: true, opacity: 0.15, depthWrite: false, emissive: 0x203a60 }));
    shock.scale.setScalar(0.2); shock.position.set(0.08, 0.36, 0);
    const sun = makeGlowSprite(0xffd060, 0.06, 0.9); sun.position.set(0.08, 0.36, 0);
    const nep = makeCircleLineXZ(0.06, 64, 0x4a6fe0, 0.9); nep.position.set(0.08, 0.36, 0);
    g.add(shell, shock, sun, nep);
    return g;
  },
  sedna() {
    const g = new THREE.Group();
    const disk = new THREE.Group(); disk.position.y = 0.5; disk.rotation.x = 0.45; g.add(disk);
    const e = 0.85, a = 0.5, b = a * Math.sqrt(1 - e * e);
    const pts = [];
    for (let i = 0; i < 256; i++) { const E = i / 256 * Math.PI * 2; pts.push(V(a * (Math.cos(E) - e), 0, b * Math.sin(E))); }
    disk.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff8060, transparent: true, opacity: 0.9 })));
    disk.add(makeCircleLineXZ(0.0296, 48, 0x4a6fe0, 0.9), makeGlowSprite(0xffd060, 0.03, 0.9));
    disk.add(ellipsoid(new THREE.MeshBasicMaterial({ color: 0xd06040 }), 0.008, 0.008, 0.008, a * (Math.cos(0.4) - e), 0, b * Math.sin(0.4)));
    return g;
  },
  hills() { return cometCloud(4000, 0.06, 0.5, 0.18); },
  oort() { return cometCloud(5000, 0.25, 0.5, 1); },
  neareststars() {
    const g = new THREE.Group();
    const rnd = seededRandom('nearest');
    // [odległość w latach św., kolor, jasność]
    const stars = [[4.37, 0xfff4e0, 1.3], [5.96, 0xff9a70, 0.6], [7.9, 0xff8a60, 0.5], [8.3, 0xffa070, 0.6], [8.6, 0xcfe0ff, 1.6], [8.7, 0xff8a60, 0.5],
      [9.7, 0xff9a70, 0.5], [10.3, 0xff8a60, 0.5], [10.5, 0xffd0a0, 0.8], [10.7, 0xffa070, 0.6], [11.0, 0xff9a70, 0.5], [11.4, 0xffc090, 0.7], [11.5, 0xfff0d0, 1.2]];
    const sun = makeGlowSprite(0xffd060, 0.05, 1); sun.position.y = 0.5; g.add(sun);
    for (const [d, color, k] of stars) {
      const dir = V(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.6, rnd() * 2 - 1).normalize();
      const sp = makeGlowSprite(color, 0.035 * k, 1);
      sp.position.copy(dir.multiplyScalar(0.5 * d / 12)).add(V(0, 0.5, 0));
      g.add(sp);
    }
    const shell = new THREE.Mesh(sphereGeometryHi, stdMat(0x8090c0, { transparent: true, opacity: 0.06, depthWrite: false, side: THREE.BackSide }));
    shell.scale.setScalar(0.5); shell.position.y = 0.5;
    g.add(shell);
    return g;
  },
  pleiades() {
    const g = new THREE.Group();
    const rnd = seededRandom('pleiades'), gauss = gaussian(rnd);
    for (let i = 0; i < 45; i++) {
      const k = i < 7 ? 1.6 : 0.5 + rnd() * 0.5;
      const sp = makeGlowSprite(0xcfe0ff, 0.035 * k, 1);
      sp.position.set(gauss() * 0.13, 0.5 + gauss() * 0.13, gauss() * 0.13);
      g.add(sp);
    }
    const neb = makeGlowSprite(0x6f9fff, 0.9, 0.3, softGlowTexture); neb.position.y = 0.5;
    g.add(neb);
    return g;
  },
  localbubble() {
    const g = new THREE.Group();
    const bubble = new THREE.Mesh(lumpyGeometry('bubble', 1, 0.8, 0.9), stdMat(0xff8ab0, { transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, emissive: 0x401828 }));
    bubble.scale.setScalar(0.45); bubble.position.y = 0.42;
    const pts = starPoints(1500, 'bubble', p => p.multiplyScalar(0.48).add(V(0, 0.42, 0)));
    const sun = makeGlowSprite(0xffd060, 0.04, 1); sun.position.y = 0.42;
    g.add(bubble, pts, sun);
    return g;
  },
  orionarm() {
    const g = new THREE.Group();
    const rnd = seededRandom('orion'), gauss = gaussian(rnd);
    const pos = [], col = [];
    for (let i = 0; i < 9000; i++) {                // łukowate pasmo gwiazd (fragment ramienia spiralnego)
      const t = rnd() - 0.5, a = t * 0.9;
      const R = 1.2;
      const x = Math.sin(a) * R, z = (1 - Math.cos(a)) * R - 0.1;
      pos.push(x + gauss() * 0.02, 0.25 + gauss() * 0.03, z + gauss() * 0.07);
      const b = 0.4 + rnd() * 0.6; if (rnd() < 0.2) col.push(b, b * 0.8, b * 0.6); else col.push(b * 0.8, b * 0.85, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    for (let i = 0; i < 6; i++) {                   // mgławice (różowe obszary gwiazdotwórcze)
      const a = (rnd() - 0.5) * 0.8;
      const sp = makeGlowSprite(0xff6aa0, 0.08 + rnd() * 0.06, 0.45, softGlowTexture);
      sp.position.set(Math.sin(a) * 1.2, 0.25, (1 - Math.cos(a)) * 1.2 - 0.1);
      g.add(sp);
    }
    const sun = makeGlowSprite(0xffe070, 0.03, 1); sun.position.set(0.05, 0.25, -0.08);
    g.add(sun);
    return g;
  },
  milkyway() {
    const g = new THREE.Group();
    g.add(galaxyQuad('barred', 1, 0.5, -1.1));
    const sun = makeGlowSprite(0xffe070, 0.03, 1); sun.position.set(0.13, 0.5, 0.06);
    g.add(sun);
    return g;
  },
  mwmc() {
    const g = new THREE.Group();
    g.add(galaxyQuad('barred', 0.25, 0.5, -1.1));
    const lmc = galaxyQuad('irregular', 0.06, 0.5, -0.3); lmc.position.x = 0.38; lmc.position.z = 0.1;
    const smc = galaxyQuad('irregular', 0.035, 0.5, -0.3); smc.position.x = 0.46; smc.position.z = -0.12;
    g.add(lmc, smc);
    return g;
  },
  localgroup() {
    const g = new THREE.Group();
    const rnd = seededRandom('localgroup'), gauss = gaussian(rnd);
    // rozmiary galaktyk powiększone ok. 2× (inaczej byłyby kropkami); odległości prawdziwe
    const mw = galaxyQuad('barred', 0.07, 0.5, -1.0); mw.position.x = -0.12;
    const m31 = galaxyQuad('spiral2', 0.12, 0.5, -0.7); m31.position.set(0.13, 0.52, -0.02);
    const m33 = galaxyQuad('spiral3', 0.04, 0.5, -0.4); m33.position.set(0.17, 0.45, 0.06);
    g.add(mw, m31, m33);
    for (const [gq, c] of [[mw, 0xffe0b0], [m31, 0xffe0b0], [m33, 0xcfd8ff]]) {
      const halo = makeGlowSprite(c, 0.05, 0.8); halo.position.copy(gq.position); g.add(halo);
    }
    for (const [cx, cy, cz, k] of [[-0.12, 0.5, 0, 1], [0.13, 0.52, -0.02, 1]]) {   // galaktyki karłowate wokół dwóch dużych
      const glow = makeGlowSprite(0xb0c0ff, 0.2 * k, 0.35, softGlowTexture); glow.position.set(cx, cy, cz); g.add(glow);
      for (let i = 0; i < 20; i++) {
        const sp = makeGlowSprite(0xdde4ff, 0.015 + rnd() * 0.015, 1);
        sp.position.set(cx + gauss() * 0.06, cy + gauss() * 0.06, cz + gauss() * 0.06);
        g.add(sp);
      }
    }
    for (let i = 0; i < 15; i++) {
      const sp = makeGlowSprite(0xdde4ff, 0.014, 1);
      sp.position.set(gauss() * 0.22, 0.5 + gauss() * 0.15, gauss() * 0.22);
      g.add(sp);
    }
    return g;
  },
  earth() {
    const def = BODIES.find(b => b.id === 'earth');
    const v = models.earth ? buildEarthModel(0.5) : buildPlanetVisual(def, 0.5, null);
    v.group.position.y = 0.5;
    v.group.rotation.z = 23.44 * DEG;
    const g = new THREE.Group();
    g.add(v.group);
    return g;
  },
};

const scaleItems = [];
for (const def of SCALE_OBJECTS) {
  const model = (SCALE_BUILDERS[def.id] || SCALE_BUILDERS.hamster)();
  const holder = new THREE.Group();                  // pozycja i skala (zmieniają się przy zoomie)
  const turn = new THREE.Group();                    // powolny obrót
  turn.add(model);
  holder.add(turn);
  mode6Group.add(holder);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);                        // obrót wokół środka obiektu (także ręczny, gałką)
  turn.position.copy(center);
  const mats = [];
  model.traverse(o => {
    if (!o.material) return;
    // własne kopie materiałów: znikanie nie może wpływać na inne tryby (np. ludziki z Trybu 3)
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) {
      m.userData.baseOpacity = m.opacity;
      m.transparent = true;                          // do płynnego znikania
      mats.push(m);
    }
    o.frustumCulled = false;
  });
  const maxDim = Math.max(size.x, size.y, size.z);
  const extent = def.sizeM * maxDim;
  const label = makeLabel(`${def.name} · ${def.sizeText}`);
  const info = makeInfoLabel({ name: def.name, info: { rows: [['Rozmiar', def.sizeText]], fact: def.fact } });
  for (const l of [label, info]) { l.material.depthTest = false; l.renderOrder = 40; }   // zawsze czytelne
  mode6Group.add(label, info);
  scaleItems.push({
    def, holder, turn, mats, maxDim, height: box.max.y, label, info, alpha: -1,
    focusLog: Math.log10(extent / SCALE_FOCUS_SIZE_M), mixer: model.userData.mixer || null,
  });
}
// Napis "1 m tutaj = ... naprawdę" (aktualizowany kilka razy na sekundę)
const scaleRuler = (() => {
  const [canvas, ctx] = makeCanvas(1024, 112);
  const tex = canvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 1);
  sprite.userData.aspect = 1024 / 112;
  sprite.renderOrder = 12;
  mode6Group.add(sprite);
  let lastText = '';
  return {
    sprite,
    setText(text) {
      if (text === lastText) return;
      lastText = text;
      ctx.clearRect(0, 0, 1024, 112);
      ctx.fillStyle = 'rgba(8,12,28,0.75)'; roundRect(ctx, 0, 0, 1024, 112, 30); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 54px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 512, 58);
      tex.needsUpdate = true;
    },
  };
})();

const m6Origin = new THREE.Vector3(), m6Fwd = new THREE.Vector3(0, 0, -1), m6Right = new THREE.Vector3(1, 0, 0);
state.scaleLog = scaleItems.find(it => it.def.id === 'human').focusLog;
state.scaleSpeed = SCALE_SPEED_DEFAULT;
state.scaleAnim = null;
const scaleLogMin = scaleItems[0].focusLog - 1, scaleLogMax = scaleItems[scaleItems.length - 1].focusLog + 1;

function layoutMode6() {
  m6Fwd.copy(horizontalForward());
  m6Right.crossVectors(m6Fwd, UP).normalize();
  m6Origin.set(eyePos.x, 0, eyePos.z);
  state.scaleAnim = null;
  state.scaleLog = scaleItems.find(it => it.def.id === 'human').focusLog;
  if (!renderer.xr.isPresenting) orbitControls.target.copy(m6Origin).addScaledVector(m6Fwd, SCALE_DISTANCE_M + 0.3).setY(SCALE_BASELINE_Y_M + 0.3);
}

// Ułamkowy "numer" obiektu w centrum uwagi dla danej skali (np. 12,4 = między człowiekiem a autobusem)
function scaleIndexAt(L) {
  const it = scaleItems;
  if (L <= it[0].focusLog) return 0;
  for (let i = 0; i < it.length - 1; i++) {
    if (L < it[i + 1].focusLog) return i + (L - it[i].focusLog) / (it[i + 1].focusLog - it[i].focusLog);
  }
  return it.length - 1;
}

function nearestScaleItem(L = state.scaleLog) {
  let best = scaleItems[0];
  for (const it of scaleItems) if (Math.abs(it.focusLog - L) < Math.abs(best.focusLog - L)) best = it;
  return best;
}

function scaleJump(dir) {
  const L = state.scaleAnim ? state.scaleAnim.to : state.scaleLog;
  const list = dir > 0 ? scaleItems.filter(it => it.focusLog > L + 0.05) : scaleItems.filter(it => it.focusLog < L - 0.05).reverse();
  if (!list.length) return;
  const to = list[0].focusLog;
  state.scaleAnim = { from: state.scaleLog, to, t: 0, dur: Math.max(0.7, Math.abs(to - state.scaleLog) / state.scaleSpeed) };
}

function scaleZoom(amountDecades) {
  state.scaleAnim = null;
  state.scaleLog = THREE.MathUtils.clamp(state.scaleLog + amountDecades, scaleLogMin, scaleLogMax);
}

function setScaleSpeedFromFraction(f) {
  f = THREE.MathUtils.clamp(f, 0, 1);
  state.scaleSpeed = SCALE_SPEED_MIN * Math.pow(SCALE_SPEED_MAX / SCALE_SPEED_MIN, f);
  drawMenu();
}

function formatMeters(m) {
  const LY = 9.4607e15;
  if (m >= 1e15) {                                    // duże odległości w latach świetlnych
    const ly = m / LY;
    if (ly >= 1e6) return `${(ly / 1e6).toLocaleString('pl-PL', { maximumSignificantDigits: 3 })} mln lat św.`;
    if (ly >= 1e3) return `${(ly / 1e3).toLocaleString('pl-PL', { maximumSignificantDigits: 3 })} tys. lat św.`;
    return `${ly.toLocaleString('pl-PL', { maximumSignificantDigits: 3 })} lat św.`;
  }
  if (m >= 1e9) return `${(m / 1e9).toLocaleString('pl-PL', { maximumSignificantDigits: 3 })} mln km`;
  const units = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm']];
  for (const [u, name] of units) {
    if (m >= u * 0.999) return `${(m / u).toLocaleString('pl-PL', { maximumSignificantDigits: 3 })} ${name}`;
  }
  return `${m.toExponential(2)} m`;
}

function updateScaleMode(dt) {
  const a = state.scaleAnim;
  if (a) {
    a.t = Math.min(1, a.t + dt / a.dur);
    state.scaleLog = THREE.MathUtils.lerp(a.from, a.to, smooth(a.t));
    if (a.t >= 1) state.scaleAnim = null;
  }
  const L = state.scaleLog, F = Math.pow(10, L);
  const jc = scaleIndexAt(L);
  // Kąty na łuku: obiekty ustawione jeden obok drugiego tak, by się nie zasłaniały
  const n = scaleItems.length;
  const dists = new Array(n), half = new Array(n), theta = new Array(n);
  for (let j = 0; j < n; j++) {
    const e = scaleItems[j].def.sizeM / F * scaleItems[j].maxDim;
    dists[j] = SCALE_DISTANCE_M + e * SCALE_DEPTH_FACTOR;
    half[j] = Math.atan((e / 2) / dists[j]);
  }
  theta[0] = 0;
  for (let j = 1; j < n; j++) theta[j] = theta[j - 1] + half[j - 1] + half[j] + SCALE_GAP_DEG * DEG;
  const j0 = Math.min(n - 2, Math.floor(jc));
  const offset = THREE.MathUtils.lerp(theta[j0], theta[j0 + 1], smooth(jc - j0));
  const lnFade = Math.log(SCALE_FADE_FACTOR);
  const current = nearestScaleItem(L);
  const nearFocus = Math.abs(current.focusLog - L) < 0.2 && !state.scaleAnim;
  scaleItems.forEach((it, j) => {
    const d = it.def.sizeM / F;                         // skala modelu (1 jednostka = d metrów w goglach)
    const extent = d * it.maxDim;
    const rel = j - jc;                                 // < 0: mniejsze (z lewej), > 0: większe (z prawej)
    const alpha = Math.min(1, Math.log(extent / SCALE_HIDE_SMALL_M) / lnFade, Math.log(SCALE_HIDE_LARGE_M / extent) / lnFade,
      SCALE_NEIGHBORS + 0.5 - Math.abs(rel));
    const visible = alpha > 0.01;
    it.holder.visible = visible;
    it.label.visible = visible && alpha > 0.3 && !(nearFocus && it === current);
    it.info.visible = visible && nearFocus && it === current;
    if (!visible) return;
    if (Math.abs(alpha - it.alpha) > 0.01) {
      for (const m of it.mats) m.opacity = m.userData.baseOpacity * Math.min(1, alpha);
      it.alpha = alpha;
    }
    // łuk przed Tobą: obiekt w centrum na wprost, mniejsze w lewo, większe w prawo i dalej
    const th = theta[j] - offset;
    const dist = dists[j];
    _v3.copy(m6Right).multiplyScalar(Math.sin(th)).addScaledVector(m6Fwd, Math.cos(th));
    it.holder.scale.setScalar(d);
    it.holder.position.copy(m6Origin).addScaledVector(_v3, dist);
    it.holder.position.y = SCALE_BASELINE_Y_M;
    if (!it.manual) it.turn.quaternion.premultiply(_q1.setFromAxisAngle(UP, SCALE_TURN_DEG_S * DEG * dt));
    if (it.mixer) it.mixer.update(dt);
    // etykieta: na przedniej krawędzi obiektu, nie wyżej niż trochę ponad oczami
    const anchor = _v1.copy(m6Origin).addScaledVector(_v3, Math.max(SCALE_DISTANCE_M, dist - extent * 0.5));
    anchor.y = Math.min(SCALE_BASELINE_Y_M + it.height * d, eyePos.y + 0.3);
    if (it.label.visible) placeLabel(it.label, anchor, 0.02, LABEL_ANGLE_DEG * 1.2);
    if (it.info.visible) placeLabel(it.info, anchor, 0.02, INFO_LABEL_ANGLE_DEG * 0.8);
  });
  scaleRuler.setText(`1 m w goglach = ${formatMeters(F)} naprawdę`);
  const rp = _v2.copy(m6Origin).addScaledVector(m6Fwd, SCALE_DISTANCE_M * 0.85);
  rp.y = SCALE_BASELINE_Y_M - 0.04;
  const h = Math.max(0.05, rp.distanceTo(eyePos)) * Math.tan(1.8 * DEG);
  scaleRuler.sprite.position.copy(rp);
  scaleRuler.sprite.scale.set(h * scaleRuler.sprite.userData.aspect, h, 1);
}

// =====================================================================
//  MENU (panel z przyciskami, rysowany na canvas) – przesuwane i chowane
// =====================================================================
const MENU_CANVAS_W = 1024, MENU_CANVAS_H = 470;
const MENU_USED_H = 460;
const MENU_HEIGHT_M = MENU_WIDTH_M * MENU_CANVAS_H / MENU_CANVAS_W;
const MODE_NAMES = { 1: 'Model', 2: 'Planety', 3: 'Ludziki', 4: 'Obiekty', 5: 'Kosmos', 6: 'Skala' };
const menuButtons = [
  { id: 'hide', label: 'Schowaj ✕', x: 760, y: 18, w: 246, h: 70, small: true },
  ...[1, 2, 3, 4, 5, 6].map(m => ({ id: 'mode' + m, label: 'Tryb ' + m, sub: MODE_NAMES[m], x: 18 + (m - 1) * 168, y: 196, w: 156, h: 120 })),
  { id: 'reset', label: 'Reset', x: 18, y: 332, w: 300, h: 112, modes: [1, 2, 3, 4, 5] },
  { id: 'timeSlow', label: '◀◀ Wolniej', x: 330, y: 332, w: 220, h: 112, modes: [1], small: true },
  { id: 'timePlay', label: () => (state.timePaused ? '▶ Start' : '❚❚ Pauza'), x: 562, y: 332, w: 220, h: 112, modes: [1], small: true },
  { id: 'timeFast', label: 'Szybciej ▶▶', x: 794, y: 332, w: 212, h: 112, modes: [1], small: true },
  { id: 'prev', label: '◀ Mniejszy (B)', x: 18, y: 332, w: 262, h: 112, modes: [6], small: true },
  { id: 'speed', slider: true, x: 292, y: 332, w: 440, h: 112, modes: [6] },
  { id: 'next', label: 'Większy (A) ▶', x: 744, y: 332, w: 262, h: 112, modes: [6], small: true },
  { id: 'knife', label: () => state.knife ? 'Nóż: WŁ (A)' : 'Nóż: wył (A)', x: 330, y: 332, w: 340, h: 112, modes: [2, 4] },
  { id: 'glue', label: 'Sklej (B)', x: 682, y: 332, w: 324, h: 112, modes: [2, 4] },
];
const MENU_HINTS = {
  1: 'Spust: chwyć · 2 ręce/gałka: zoom · Grip na planecie: leć do niej (śledzi ją)',
  2: 'Spust/grip: chwyć (z daleka przyciąga) · puść w ruchu = rzut · A: nóż · B: sklej',
  3: 'Spust/grip: chwyć planetę (z daleka przylatuje) i obracaj w dłoni · 2 ręce: powiększ',
  4: 'Obiekty NIE w skali – prawdziwe rozmiary na tabliczkach · A: nóż · B: sklej',
  5: 'Gałka lub 2 ręce: pomniejsz/powiększ kosmos · spust/grip + obrót dłoni: obróć niebo',
  6: 'Prawa gałka: zoom · gałki lewo/prawo: obróć obiekt · A/B: większy/mniejszy',
};
const [menuCanvas, menuCtx] = makeCanvas(MENU_CANVAS_W, MENU_CANVAS_H);
const menuTexture = canvasTexture(menuCanvas);
const menuMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(MENU_WIDTH_M, MENU_HEIGHT_M),
  new THREE.MeshBasicMaterial({ map: menuTexture, transparent: true }),
);
menuMesh.renderOrder = 20;
scene.add(menuMesh);

// Zakładka widoczna, gdy menu jest schowane (podąża za wzrokiem, w lewym dolnym rogu)
const menuTab = (() => {
  const [canvas, ctx] = makeCanvas(320, 112);
  ctx.fillStyle = COLOR_MENU_BG; roundRect(ctx, 0, 0, 320, 112, 30); ctx.fill();
  ctx.strokeStyle = '#4a6bc4'; ctx.lineWidth = 4; roundRect(ctx, 2, 2, 316, 108, 28); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 50px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText('☰ Menu', 160, 58);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true }));
  m.renderOrder = 20;
  m.visible = false;
  scene.add(m);
  return m;
})();

const menuVisibleButtons = () => menuButtons.filter(b => !b.modes || b.modes.includes(state.mode));

function drawMenu() {
  const ctx = menuCtx;
  ctx.clearRect(0, 0, MENU_CANVAS_W, MENU_CANVAS_H);
  ctx.fillStyle = COLOR_MENU_BG;
  roundRect(ctx, 0, 0, MENU_CANVAS_W, MENU_USED_H, 40); ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5a6a90';                         // uchwyt do przesuwania
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(34 + j * 14, 34 + i * 14, 4.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px system-ui, sans-serif';
  ctx.fillText('Układ Słoneczny VR', 72, 66);
  ctx.fillStyle = '#6f7fa6';
  ctx.font = '23px system-ui, sans-serif';
  ctx.fillText('złap tło panelu, aby go przesunąć', 72, 98);
  ctx.fillStyle = '#a9b8d8';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText(state.status, 30, 142);
  ctx.fillStyle = '#7f8db0';
  ctx.font = '25px system-ui, sans-serif';
  ctx.fillText(MENU_HINTS[state.mode], 30, 180);

  for (const b of menuVisibleButtons()) {
    const active = b.id === 'mode' + state.mode || (b.id === 'knife' && state.knife);
    ctx.fillStyle = active ? COLOR_MENU_BUTTON_ACTIVE
      : state.hoveredButton === b.id ? COLOR_MENU_BUTTON_HOVER
      : COLOR_MENU_BUTTON;
    roundRect(ctx, b.x, b.y, b.w, b.h, 24); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.slider) {                                   // suwak prędkości zoomu (Tryb 6)
      const f = Math.log(state.scaleSpeed / SCALE_SPEED_MIN) / Math.log(SCALE_SPEED_MAX / SCALE_SPEED_MIN);
      const x0 = b.x + 30, x1 = b.x + b.w - 30, yT = b.y + 80;
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`Prędkość zoomu: ×10 w ${(1 / state.scaleSpeed).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s`, b.x + b.w / 2, b.y + 34);
      ctx.fillStyle = '#1a2340'; roundRect(ctx, x0, yT - 7, x1 - x0, 14, 7); ctx.fill();
      ctx.fillStyle = '#7fb0ff'; roundRect(ctx, x0, yT - 7, (x1 - x0) * f, 14, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * f, yT, 18, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const label = typeof b.label === 'function' ? b.label() : b.label;
    ctx.font = b.small ? 'bold 34px system-ui, sans-serif' : 'bold 40px system-ui, sans-serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 - (b.sub ? 18 : 0));
    if (b.sub) {
      ctx.font = '32px system-ui, sans-serif';
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
    case 'hide': setMenuHidden(true); break;
    case 'mode1': setMode(1); break;
    case 'mode2': setMode(2); break;
    case 'mode3': setMode(3); break;
    case 'mode4': setMode(4); break;
    case 'mode5': setMode(5); break;
    case 'mode6': setMode(6); break;
    case 'prev': scaleJump(-1); break;
    case 'timeSlow': state.timeIndex = Math.max(0, state.timeIndex - 1); state.timePaused = false; break;
    case 'timeFast': state.timeIndex = Math.min(TIME_SPEEDS.length - 1, state.timeIndex + 1); state.timePaused = false; break;
    case 'timePlay': state.timePaused = !state.timePaused; break;
    case 'next': scaleJump(1); break;
    case 'reset': resetCurrentMode(); break;
    case 'knife': setKnife(!state.knife); break;
    case 'glue': glueAll(shelfFor(state.mode)); break;
  }
  drawMenu();
}

function setMenuHidden(hidden) {
  state.menuHidden = hidden;
  releaseTarget(menuMesh);
  menuMesh.visible = !hidden;
  menuTab.visible = hidden;
  if (!hidden) state.menuNeedsPlacement = true;
  else placeMenuTab(true);
}

function setMode(mode) {
  state.mode = mode;
  cancelAllGrabs();
  state.focus = null;
  state.hoverBody = null;
  setKnife(false);
  systemGroup.visible = mode1Labels.visible = mode === 1;
  shelf2.group.visible = mode === 2;
  mode3Group.visible = mode === 3;
  shelf4.group.visible = mode === 4;
  mode5Group.visible = mode === 5;
  mode6Group.visible = mode === 6;
  stars.visible = mode !== 5;                        // w przestrzeni międzygalaktycznej nie ma pobliskich gwiazd
  if (!state.placed[mode]) { layoutMode(mode); state.placed[mode] = true; }
  else if (!renderer.xr.isPresenting) focusOrbitOnMode(mode);
  drawMenu();
}

function layoutMode(mode) {
  if (mode === 1) { resetSystem(); if (!renderer.xr.isPresenting) orbitControls.target.set(...SYSTEM_START_POSITION); }
  if (mode === 2) layoutShelf2();
  if (mode === 3) layoutMode3();
  if (mode === 4) layoutShelf4();
  if (mode === 5) layoutMode5();
  if (mode === 6) layoutMode6();
}

// Suwak: pozycja trafienia na pasku -> prędkość
function sliderFromUV(uv) {
  const b = menuButtons.find(x => x.id === 'speed');
  const x = uv.x * MENU_CANVAS_W;
  setScaleSpeedFromFraction((x - (b.x + 30)) / (b.w - 60));
}

// PC: przy powrocie do trybu obracaj kamerę wokół jego środka
function focusOrbitOnMode(mode) {
  if (mode === 1) orbitControls.target.copy(systemGroup.position);
  if (mode === 3) orbitControls.target.copy(m3Planet.position);
  if (mode === 6) orbitControls.target.copy(m6Origin).addScaledVector(m6Fwd, SCALE_DISTANCE_M + 0.3).setY(SCALE_BASELINE_Y_M + 0.3);
  const shelf = shelfFor(mode);
  if (shelf) {
    const c = new THREE.Vector3();
    const list = shelf.items.filter(it => !it.isSun);
    for (const it of list) c.add(it.obj.position);
    orbitControls.target.copy(c.divideScalar(list.length));
  }
}

function resetCurrentMode() {
  cancelAllGrabs();
  layoutMode(state.mode);
  state.placed[state.mode] = true;
  if (!state.menuHidden) state.menuNeedsPlacement = true;
}

function facingQuaternion(pos) {
  _m1.lookAt(eyePos, pos, UP);       // +Z w stronę oczu
  return _q1.setFromRotationMatrix(_m1);
}

// Ustaw menu przed oczami użytkownika (poziomo przed nim, nieco niżej, zwrócone do niego)
function placeMenu() {
  const fwd = horizontalForward();
  menuMesh.position.copy(eyePos).addScaledVector(fwd, MENU_DISTANCE_M);
  menuMesh.position.y += MENU_HEIGHT_OFFSET_M;
  menuMesh.quaternion.copy(facingQuaternion(menuMesh.position));
  state.menuNeedsPlacement = false;
}

// Zakładka schowanego menu płynnie podąża za wzrokiem (lewy dolny róg pola widzenia)
const _tabTarget = new THREE.Vector3();
function placeMenuTab(instant, dt = 0) {
  _tabTarget.set(...MENU_TAB_OFFSET).applyQuaternion(headQuat).add(eyePos);
  if (instant) menuTab.position.copy(_tabTarget);
  else menuTab.position.lerp(_tabTarget, 1 - Math.exp(-3 * dt));
  menuTab.quaternion.copy(facingQuaternion(menuTab.position));
}

// =====================================================================
//  KONTROLERY I DŁONIE
// =====================================================================
const controllers = [];

const handJointGeometry = new THREE.SphereGeometry(1, 8, 6);
const handJointMaterial = new THREE.MeshLambertMaterial({ color: 0xd8c8b8 });

for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);       // przestrzeń "promienia" (target ray)
  ctrl.userData = { handedness: null, inputSource: null, prevButtons: [], grabTarget: null, grabSource: null, uiPress: null };

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
  ctrl.addEventListener('selectstart', e => onPressStart(e.target, 'select'));
  ctrl.addEventListener('selectend', e => onPressEnd(e.target, 'select'));
  ctrl.addEventListener('squeezestart', e => onPressStart(e.target, 'squeeze'));
  ctrl.addEventListener('squeezeend', e => onPressEnd(e.target, 'squeeze'));
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

// Trafienie promienia w interfejs: panel menu (jego narysowaną część) lub zakładkę schowanego menu
function raycastUI() {
  if (menuMesh.visible) {
    const hit = raycaster.intersectObject(menuMesh, false)[0];
    if (hit && hit.distance < 5 && (1 - hit.uv.y) * MENU_CANVAS_H <= MENU_USED_H) {
      return { kind: 'menu', hit, button: menuButtonAtUV(hit.uv) };
    }
  }
  if (menuTab.visible) {
    const hit = raycaster.intersectObject(menuTab, false)[0];
    if (hit && hit.distance < 5) return { kind: 'tab', hit };
  }
  return null;
}

const isKnifeHand = ctrl => !!shelfFor(state.mode) && state.knife && ctrl.userData.handedness === 'right';

// Naciśnięcie spustu ('select') lub gripa ('squeeze')
function onPressStart(ctrl, source) {
  ctrl.updateMatrixWorld(true);
  setRayFromController(ctrl);
  const ui = raycastUI();
  if (ui) {                                     // interfejs ma pierwszeństwo przed chwytaniem
    ctrl.userData.uiPress = source;
    if (ui.kind === 'tab') setMenuHidden(false);
    else if (ui.button && ui.button.id === 'speed') { state.sliderCtrl = ctrl; sliderFromUV(ui.hit.uv); }
    else if (ui.button) { if (source === 'select') onMenuButton(ui.button); }
    else if (startGrab(menuMesh, ctrl, MENU_GRAB)) ctrl.userData.grabSource = source;   // tło panelu = uchwyt
    return;
  }
  if (ctrl.userData.grabTarget) return;         // ta ręka już coś trzyma
  const mode = state.mode;
  let grabbed = false;
  if (mode === 1) {
    if (source !== 'select') return;            // w Trybie 1 grip = "leć do planety"
    state.focus = null;
    state.track = null;
    grabbed = startGrab(systemGroup, ctrl, MODE1_GRAB);
  } else if (shelfFor(mode)) {
    if (isKnifeHand(ctrl)) { if (source === 'select') tryKnifeCut(); return; }
    grabShelf(shelfFor(mode), ctrl);
    grabbed = !!ctrl.userData.grabTarget;
  } else if (mode === 3) grabbed = grabMode3(ctrl);
  else if (mode === 5) grabbed = startGrab(universe, ctrl, MODE5_GRAB);
  if (grabbed || ctrl.userData.grabTarget) ctrl.userData.grabSource = source;
}

function onPressEnd(ctrl, source) {
  if (ctrl.userData.uiPress === source) {
    ctrl.userData.uiPress = null;
    if (state.sliderCtrl === ctrl) state.sliderCtrl = null;
  }
  if (ctrl.userData.grabTarget && ctrl.userData.grabSource === source) {
    ctrl.userData.grabSource = null;
    endGrab(ctrl);
  }
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
  if (hand === 'left' && index === MENU_TOGGLE_BUTTON) setMenuHidden(!state.menuHidden);
  if (state.mode === 1 && index === FOCUS_BUTTON && ctrl.userData.uiPress !== 'squeeze') {
    setRayFromController(ctrl);
    const b = pickBody(raycaster.ray.origin, raycaster.ray.direction);
    if (b) startFocus(b);
  }
  if (shelfFor(state.mode) && hand === 'right' && index === KNIFE_BUTTON) setKnife(!state.knife);
  if (shelfFor(state.mode) && hand === 'right' && index === RESET_BUTTON) glueAll(shelfFor(state.mode));
  if (state.mode === 6 && hand === 'right' && index === KNIFE_BUTTON) scaleJump(1);
  if (state.mode === 6 && hand === 'right' && index === RESET_BUTTON) scaleJump(-1);
}

// Gałka w Trybie 5: powiększanie/pomniejszanie całego kosmosu wokół głowy
function stickUniverse(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(y) < STICK_DEADZONE) return;
  zoomUniverse(Math.pow(STICK_ZOOM_RATE * 0.5, -y * dt));
}
function zoomUniverse(factor) {
  const s0 = universe.scale.x;
  const s1 = THREE.MathUtils.clamp(s0 * factor, MODE5_SCALE_MIN, MODE5_SCALE_MAX);
  // punkt przed Tobą (zoom wokół oka nic by nie zmienił – wszystko kurczyłoby się w stronę źrenicy)
  const pivot = _v4.copy(eyePos).addScaledVector(horizontalForward(), MODE5_ZOOM_PIVOT_M);
  universe.position.sub(pivot).multiplyScalar(s1 / s0).add(pivot);
  universe.scale.setScalar(s1);
  universe.updateMatrixWorld(true);
  reinitGrab(universe);
}

// Gałki w Trybie 6: prawa góra/dół = zoom; lewo/prawo = obrót obiektu w centrum; lewa góra/dół = pochylenie
function stickScale(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  const left = ctrl.userData.handedness === 'left';
  const yaw = Math.abs(x) > STICK_DEADZONE ? x : 0;
  const pitch = left && Math.abs(y) > STICK_DEADZONE ? y : 0;
  if (!left && Math.abs(y) > STICK_DEADZONE) scaleZoom(y * state.scaleSpeed * dt);
  if (yaw || pitch) rotateScaleItem(yaw * dt, pitch * dt);
}
function rotateScaleItem(yawK, pitchK) {
  const it = nearestScaleItem();
  it.manual = true;                                   // ręczne obracanie wyłącza automatyczny obrót
  const r = SCALE_MANUAL_TURN_DEG_S * DEG;
  it.turn.quaternion.premultiply(_q1.setFromAxisAngle(UP, yawK * r));
  it.turn.quaternion.premultiply(_q1.setFromAxisAngle(m6Right, pitchK * r));
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
//   klik w panel = przycisk, M = pokaż/schowaj menu
//   Tryb 1: podwójny klik na planecie = leć do niej, +/- = zoom układu
//   Tryby 2/4: C = przetnij obiekt pod kursorem, G = sklej, T = rzuć obiekt pod kursorem
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
  const ui = raycastUI();
  if (ui && ui.kind === 'tab') setMenuHidden(false);
  else if (ui && ui.button && ui.button.id === 'speed') sliderFromUV(ui.hit.uv);
  else if (ui && ui.button) onMenuButton(ui.button);
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
  const key = e.key.toLowerCase();
  if (key === 'm') setMenuHidden(!state.menuHidden);
  if (state.mode === 1 && (e.key === '+' || e.key === '=')) zoomSystemAround(orbitControls.target.clone(), 2);
  if (state.mode === 1 && e.key === ' ') { state.timePaused = !state.timePaused; drawMenu(); }
  if (state.mode === 1 && e.key === '.') { state.timeIndex = Math.min(TIME_SPEEDS.length - 1, state.timeIndex + 1); state.timePaused = false; }
  if (state.mode === 1 && e.key === ',') { state.timeIndex = Math.max(0, state.timeIndex - 1); state.timePaused = false; }
  if (state.mode === 5 && (e.key === '+' || e.key === '=')) zoomUniverse(2);
  if (state.mode === 5 && e.key === '-') zoomUniverse(0.5);
  if (state.mode === 1 && e.key === '-') zoomSystemAround(orbitControls.target.clone(), 0.5);
  if (state.mode === 6) {
    if (e.key === '+' || e.key === '=') scaleZoom(-0.25);
    if (e.key === '-') scaleZoom(0.25);
    if (e.key === 'ArrowLeft') rotateScaleItem(-0.15, 0);
    if (e.key === 'ArrowRight') rotateScaleItem(0.15, 0);
    if (e.key === 'ArrowUp') rotateScaleItem(0, -0.15);
    if (e.key === 'ArrowDown') rotateScaleItem(0, 0.15);
    if (key === 'n') scaleJump(1);
    if (key === 'p') scaleJump(-1);
    if (key === ']') setScaleSpeedFromFraction(Math.log(state.scaleSpeed * 1.5 / SCALE_SPEED_MIN) / Math.log(SCALE_SPEED_MAX / SCALE_SPEED_MIN));
    if (key === '[') setScaleSpeedFromFraction(Math.log(state.scaleSpeed / 1.5 / SCALE_SPEED_MIN) / Math.log(SCALE_SPEED_MAX / SCALE_SPEED_MIN));
  }
  const shelf = shelfFor(state.mode);
  if (!shelf) return;
  if (key === 'g') glueAll(shelf);
  if (key === 'c' || key === 't') {
    setRayFromMouse();
    const res = pickShelf(shelf, raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    if (!res) return;
    const it = res.entry;
    if (key === 't') {                              // test rzutu: obiekt odlatuje w prawo i się zatrzymuje
      floaters.set(it.obj, { vel: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(1.5), ang: new THREE.Vector3(0, 3, 0) });
      return;
    }
    if (it.kind !== 'whole' || !isCuttable(it)) return;
    const n = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);   // cięcie pionowe, prostopadłe do ekranu
    cutItem(it, n, it.obj.position.clone());
    // rozsuń i obróć połówki przekrojem do kamery, żeby było widać wnętrze
    const pair = it.cutPair;
    const off = it.R * it.obj.scale.x * 0.7;
    pair.a.obj.position.addScaledVector(n, off);
    pair.b.obj.position.addScaledVector(n, -off);
    pair.a.obj.rotateOnWorldAxis(UP, 0.7);
    pair.b.obj.rotateOnWorldAxis(UP, -0.7);
  }
});

// =====================================================================
//  SESJA VR
// =====================================================================
renderer.xr.addEventListener('sessionstart', () => {
  state.menuNeedsPlacement = !state.menuHidden;
  state.placed = {};                       // ułóż tryby względem pozycji w goglach
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
  state.menuNeedsPlacement = !state.menuHidden;
  state.placed = {};
  state.needsModeLayout = true;
});

// =====================================================================
//  PĘTLA KLATEK
// =====================================================================
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
  const mode = state.mode;
  if (mode === 1) {
    const s = systemGroup.scale.x;
    const date = new Date(Date.now() + simulatedDays * 86400000).toLocaleDateString('pl-PL');
    const speed = state.timePaused ? 'pauza' : `${TIME_SPEEDS[state.timeIndex].toLocaleString('pl-PL')} dni/s`;
    text = `Skala ×${formatScale(s)}  ·  czas: ${speed}  ·  ${date}  ·  ${state.fps} FPS`;
  } else if (mode === 2 || mode === 4) {
    const extra = mode === 2 ? `1 cm = ${formatKm(EARTH_RADIUS_KM / MODE2_EARTH_RADIUS_M / 100)} km` : 'obiekty nie w skali';
    text = `Nóż: ${state.knife ? 'WŁĄCZONY' : 'wyłączony'}  ·  ${extra}  ·  ${state.fps} FPS`;
  } else if (mode === 3) {
    text = `Skala ×${m3Planet.scale.x.toFixed(2)}  ·  ⌀ planety ${formatLength(MODE3_PLANET_DIAMETER_M * m3Planet.scale.x)}  ·  ${state.fps} FPS`;
  } else if (mode === 5) {
    text = `1 m = ${formatLy(LY_MILLIONS_PER_M / universe.scale.x)} lat świetlnych  ·  galaktyk: ${galaxies.length + cosmos.web.geometry.attributes.position.count}  ·  ${state.fps} FPS`;
  } else {
    text = `1 m w goglach = ${formatMeters(Math.pow(10, state.scaleLog))}  ·  ${nearestScaleItem().def.name}  ·  ${state.fps} FPS`;
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
  nowS = time / 1000;

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
    layoutMode(state.mode);
    state.placed[state.mode] = true;
  }

  // Menu: ustaw przed użytkownikiem na starcie, po Y lub gdy jest za daleko; schowane – zakładka podąża za wzrokiem
  if (!state.menuHidden) {
    if (state.menuNeedsPlacement || (!grabs.has(menuMesh) && menuMesh.position.distanceTo(eyePos) > MENU_MAX_DISTANCE_M)) placeMenu();
  } else placeMenuTab(false, dt);

  // Kontrolery: przyciski, gałka, promienie, podświetlenia
  let hovered = null;
  let hoverBody = null;
  state.shelfHover.clear();
  const shelf = shelfFor(state.mode);
  for (const { ctrl, grip } of controllers) {
    ctrl.updateMatrixWorld(true);
    grip.updateMatrixWorld(true);
    pollButtons(ctrl);
    if (state.mode === 1 && presenting) stickZoom(ctrl, dt);
    if (state.mode === 6 && presenting) stickScale(ctrl, dt);
    if (state.mode === 5 && presenting) stickUniverse(ctrl, dt);
    const knifeHand = isKnifeHand(ctrl);
    ctrl.userData.ray.visible = presenting && !knifeHand;
    ctrl.userData.rayDot.visible = false;
    if (!presenting) continue;
    setRayFromController(ctrl);
    const ui = raycastUI();
    let rayLen = RAY_LENGTH_M;
    if (ui) {
      rayLen = ui.hit.distance;
      ctrl.userData.rayDot.visible = true;
      ctrl.userData.rayDot.position.set(0, 0, -ui.hit.distance);
      if (ui.button) hovered = ui.button.id;
    } else if (state.mode === 1 && !ctrl.userData.grabTarget) {
      hoverBody = hoverBody || pickBody(raycaster.ray.origin, raycaster.ray.direction);
    } else if (shelf && !knifeHand && !ctrl.userData.grabTarget) {
      const res = pickShelf(shelf, raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
      if (res) {
        state.shelfHover.add(res.entry.kind === 'half' ? res.entry.pair.whole : res.entry);
        if (!res.near) rayLen = res.distance;
      }
    }
    ctrl.userData.ray.scale.z = rayLen;
  }
  if (!presenting && pointerInside) {
    // podgląd na PC: wskazywanie myszą
    setRayFromMouse();
    const ui = raycastUI();
    if (ui) hovered = ui.button ? ui.button.id : null;
    else if (state.mode === 1) hoverBody = pickBody(raycaster.ray.origin, raycaster.ray.direction);
    else if (shelf) {
      const res = pickShelf(shelf, raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
      if (res) state.shelfHover.add(res.entry.kind === 'half' ? res.entry.pair.whole : res.entry);
    }
  }
  state.hoverBody = hoverBody;
  if (state.sliderCtrl) {                            // przeciąganie suwaka prędkości
    setRayFromController(state.sliderCtrl);
    const ui = raycastUI();
    if (ui && ui.kind === 'menu') sliderFromUV(ui.hit.uv);
  }
  if (hovered !== state.hoveredButton) { state.hoveredButton = hovered; drawMenu(); }

  updateFocus(dt);
  if (shelf) updateGlue(shelf, dt);
  updateFloaters(dt);
  updateGrabs(dt);
  updateHandMeshes();

  if (state.mode === 1) {
    advanceTime(dt);
    updateOrbitPositions();
    applyTrack();
    systemGroup.updateMatrixWorld(true);
    updateSystemView();
  } else if (shelf) {
    updateHalfPlanes(shelf);
    updateShelfAnimations(shelf, dt);
    updateKnife();
    updateShelfLabels(shelf);
    updateHeadlight(shelf.light);
  } else if (state.mode === 3) {
    updatePeople(dt);
    updateMode3Extras(dt);
    updateHeadlight(mode3Light);
  } else if (state.mode === 5) {
    updateGalaxies(dt);
  } else {
    updateScaleMode(dt);
    updateHeadlight(mode6Light);
  }
  if (!shelf) cutPreview.visible = knife.visible = false;

  stars.position.copy(eyePos);       // gwiazdy zawsze "w nieskończoności"
  updateStatus(time);
  renderer.render(scene, camera);
});

resetSystem();
setMode(1);

// Dostęp do obiektów z konsoli przeglądarki (pomocne przy debugowaniu)
window.solar = {
  THREE, scene, camera, renderer, state, systemGroup, bodies, moons, orbitControls,
  shelf2, shelf4, m3Planet, people, universe, galaxies, cosmos, menuMesh, menuTab, floaters, controllers,
  setMode, startFocus, cutItem, glueAll, startGrab, endGrab, updateGrabs, grabs, zoomSystemAround,
  setKnife, updateKnife, tryKnifeCut, grabShelf, setMenuHidden, onPressStart, onPressEnd,
  models, scaleItems, scaleJump, scaleZoom, m3Surface, layoutMode,
};
