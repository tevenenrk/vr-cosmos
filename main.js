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
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
const STICK_TURN_DEG_S = 70;                   // gałka lewo/prawo: obrót układu wokół trzymanej planety [°/s]

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
const GALLERY_DISTANCE_M = 0.5;     // galeria miniatur (Tryb 2): tak daleko przed Tobą [m]
const GALLERY_HEIGHT_M = -0.32;     // ...i tyle poniżej oczu [m] (księżyce rządek niżej i bliżej)
const GALLERY_SPACING_M = 0.075;    // odstęp miniatur [m]
const GALLERY_MINI_R_M = 0.026;     // promień miniatury [m]
const GALLERY_PULL_M = 0.12;        // wyciągnięta dalej niż tyle z galerii – rośnie do prawdziwej wielkości [m]
const GALLERY_GROW_S = 0.6;         // jak szybko rośnie / maleje [s]
const SURFACE_SKY_M = 500;          // widok z powierzchni: inne ciała rysowane tak daleko (z prawdziwą wielkością kątową) [m]
const SURFACE_ELEVATION_DEG = 30;   // ...najbliższe ciało stoi tyle stopni nad horyzontem
const SURFACE_BUTTON = 4;           // X na lewym kontrolerze -> stań na wskazanej planecie / wróć
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

// --- Tryb 3: planeta generowana w kodzie (true = zamiast tego model models/small_planet.glb) ---
const MODE3_USE_MODEL_PLANET_FILE = false;
const MODE3_PLANET_DETAIL = 64;        // gęstość siatki planety (64 ≈ 83 tys. trójkątów); mniej = szybciej
const MODE3_SEA_LEVEL = 0.0;           // poziom morza w "wysokości" szumu: więcej = więcej oceanów
const MODE3_MOUNTAIN_HEIGHT = 0.07;    // najwyższe góry jako ułamek promienia planety
const MODE3_TREE_COUNT = 450;          // drzewka na lądzie (jedna "instancja" – tanie)
const MODE3_VILLAGES = 3;              // wioski z domkami (tam mieszka większość ludzików)
const MODE3_HOUSES_PER_VILLAGE = 9;
const MODE3_VILLAGE_RADIUS_RAD = 0.09; // promień wioski (kąt na planecie)
const MODE3_HOME_SHARE = 0.75;         // jaka część ludzików mieszka w wioskach (i wraca do nich)
const MODE3_VOLCANO = true;            // wulkan z kraterem i dymem
const MODE3_STORM = true;              // chmura burzowa z deszczem i błyskawicami
const MODE3_MOON = true;               // księżyc i sztuczny satelita krążące wokół planety
const MODE3_FOLLOW_SCALE = 20;         // "kamera za ludzikiem": planeta powiększona tyle razy (ludzik ~20 cm)
const MODE3_FOLLOW_DISTANCE_M = 0.6;   // ludzik tyle przed Tobą
const MODE3_FOLLOW_DROP_M = 0.45;      // stopy ludzika tyle poniżej oczu
const MODE3_ORBIT_RADIUS_M = 420;      // planeta krąży wokół Słońca po orbicie o takim promieniu [m] (Słońce jest daleko)
const MODE3_SUN_RADIUS_M = 24;         // promień Słońca [m] (z planety widać je jak dużą tarczę)
const MODE3_MIN_GAP_M = 0.12;          // przy największym przybliżeniu powierzchnia planety jest tyle przed oczami [m]
const MODE3_STICK_TURN_DEG_S = 60;     // gałka lewo/prawo obraca planetę [stopnie/s]
const MODE3_PULL_GAP_M = 0.15;         // planeta przyciągnięta promieniem zatrzymuje się tyle przed dłonią [m]

// --- Modele 3D (.glb w folderze models/) ----------------------------------
//  Jeśli pliku nie ma, aplikacja używa prostych kształtów z kodu.
const MODEL_PATH = 'models/';
const MODEL_FILES = {
  earth: 'earth.glb',               // Ziemia z teksturą – używana we wszystkich trybach
  ...(MODE3_USE_MODEL_PLANET_FILE ? { smallPlanet: 'small_planet.glb' } : {}),   // planeta Trybu 3 z pliku (opcjonalnie)
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
//  walk – chód, run – bieg, idle – stanie i rozglądanie się, wave – machanie (w Twoją stronę),
//  squat – kucnięcie, social – podchodzi do kogoś w pobliżu i rozmawia (tak tworzą się grupki)
const MODE3_BEHAVIOR = [['walk', 0.36, 4, 12], ['idle', 0.1, 2, 6], ['run', 0.1, 2, 5], ['wave', 0.12, 2.5, 4.5],
  ['squat', 0.1, 3, 6], ['social', 0.22, 5, 10]];
const MODE3_SOCIAL_RANGE_RAD = 0.4;    // jak daleko (kąt na planecie) ludzik szuka rozmówcy
const MODE3_AVOID_WATER = true;
const MODE3_CLOUD_COUNT = 14;          // chmurki nad planetą
const MODE3_CLOUD_HEIGHT = 1.12;       // wysokość chmur jako ułamek promienia planety (1 = powierzchnia)
const MODE3_CLOUD_SPEED_DEG_S = 3;     // jak szybko chmury przesuwają się nad planetą
const MODE3_MINI_COSMOS = true;        // Słońce i planetki z kontynentami w tle
const MODE3_YEAR_S = 240;              // tyle sekund trwa "rok" – obieg wokół Słońca (dzień i noc na planecie)
const MODE3_SUN_LIGHT = 2.4;           // jasność światła Słońca
const MODE3_AMBIENT = 0.45;            // światło otoczenia (nocna strona nie jest czarna)        // ludziki omijają morza (planeta z modelu: wykrywanie po kolorze tekstury)
const MODE3_PLANET_SPIN_DEG_S = 2;     // obrót planety wokół osi [stopnie/s] (0 = stoi)
const MODE3_SCALE_MIN = 0.1;           // minimalna skala planety
const MODE3_SCALE_MAX = 40;            // maksymalna skala (40 m planeta, ludzik 40 cm)
const MODE3_OCEAN_COLOR = '#2a62b8';
const MODE3_LAND_COLORS = ['#4f9a3c', '#6aa84f', '#8c9a4a', '#a58d5a'];
const MODE3_SHIRT_COLORS = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe67e22, 0xffffff, 0x1abc9c];
const MODE3_PANTS_COLOR = 0x2c3e50;
const MODE3_SKIN_COLOR = 0xf0c8a0;

// --- Tryb 5: kosmos – galaktyki i sieć kosmiczna --------------------------
const LY_MILLIONS_PER_M = 1;           // skala: 1 m = 1 mln lat świetlnych (Droga Mleczna ma 10 cm, Andromeda jest 2,5 m dalej)
const GALAXY_COUNT = 1200;             // liczba galaktyk wokół Ciebie (obrazki na kilku "instancjach" – tanie)
const GALAXY_MIN_DIST_M = 0.5;         // najbliższa galaktyka (żeby nie wchodziła w twarz) [m]
const GALAXY_FIELD_RADIUS_M = 14;      // w takiej kuli wokół Ciebie latają galaktyki [m]
const GALAXY_NEAR_DENSITY = 1.6;       // >1 = więcej galaktyk blisko Ciebie
const GALAXY_SIZE_MIN_M = 0.04;        // najmniejsza galaktyka (średnica) [m] (gęstość i rozmiary powiększone dla efektu)
const GALAXY_SIZE_MAX_M = 0.5;         // największa galaktyka [m]
const GALAXY_DRIFT_MPS = 0.02;         // prędkość dryfu galaktyk [m/s]
const GALAXY_ON_FILAMENT = 0.5;        // część galaktyk wokół Ciebie ułożona wzdłuż "Twojego" włókna
const WEB3D_RADIUS_M = 160;            // trójwymiarowy fragment sieci kosmicznej wokół Ciebie [m przy skali 1]
const WEB3D_NODE_COUNT = 45;           // gromady galaktyk w tym fragmencie
const WEB3D_POINT_COUNT = 80000;       // dalsze galaktyki jako świecące punkty (tanie)
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

// --- Tryb 7: Droga Mleczna – od całej Galaktyki do Słońca ---------------------
const MW_POINTS = 260000;              // gwiazdy (punkty) tworzące Galaktykę
const MW_START_SIZE_M = 2.4;           // na starcie cała Galaktyka (100 000 lat św.) ma tyle metrów
const MW_DISTANCE_M = 1.3;             // Słońce (punkt, wokół którego jest zoom) tyle przed oczami
const MW_TILT_DEG = 40;                // pochylenie dysku Galaktyki w Twoją stronę
const MW_TILT_INSIDE_DEG = 20;         // ...a gdy jesteś w środku Galaktyki (pas Drogi Mlecznej na niebie)
const MW_BRIGHTNESS = 0.45;            // jasność gwiazd Galaktyki (sumują się – za dużo = biała plama)
const MW_ZOOM_RATE = 1.6;              // domyślna prędkość przelotu: tyle rzędów wielkości (×10) na sekundę
const MW_SPEED_MIN = 0.2;              // suwak w menu: najwolniej
const MW_SPEED_MAX = 5;                // suwak w menu: najszybciej
const MW_SCALE_MAX = 7e8;              // największe przybliżenie [m na rok świetlny] – Ziemia ma wtedy ok. 0,95 m
const MW_TO_EARTH_FROM = 4.6;          // od tej skali (cały Układ Słoneczny ok. 2 m) punkt zoomu przesuwa się ze Słońca...
const MW_TO_EARTH_TO = 7.6;            // ...do Ziemi (log10 m/rok św.) – Słońce mijasz z boku, małe
const MW_STAR_DENSITY = 0.004;         // gwiazdy na rok świetlny³ w sąsiedztwie Słońca (prawdziwa gęstość)
const MW_NEAR_REAL_LY = 160;           // do tej odległości od Słońca gwiazdy mają prawdziwą gęstość (ok. 55 tys. gwiazd)
const MW_NEAR_SLOPE = 3.8;             // dalej gęstość maleje jak (160/r)^3,8 (mniej = więcej gwiazd dalej; razem ok. 170 tys.)
const MW_NEAR_RADIUS_LY = 4000;        // gęsty fragment ramienia wokół Słońca ma taki promień (dalej Galaktykę tworzą jej własne gwiazdy)
const MW_NEAR_THIN = 1.3;              // przy oddalaniu o 10× pokazywana gęstość maleje 10^1,3 ≈ 20× (mniej = gwiazdy gasną wolniej)
const MW_NEAR_FADE_FROM = -4.6;        // gęsty fragment znika dopiero między tymi skalami (log10 m/rok św.) –
const MW_NEAR_FADE_TO = -5.3;          // gdy widać już całą Galaktykę
const MW_NEAR_GAIN = 0.12;             // jasność gęstego fragmentu: ile „pełnych” gwiazd może nałożyć się na piksel (więcej = jaśniej)
const MW_ECLIPTIC_TILT_DEG = 60;       // płaszczyzna orbit planet jest nachylona do dysku Galaktyki o ok. 60°
const MW_SKY_M = 3000;                 // dalsze gwiazdy są rysowane na niebie (sfera o tym promieniu) – Droga Mleczna zawsze widoczna

// --- Tryb 8: czasoprzestrzeń – siatka wyginana przez masy -------------------
const ST_SIZE_M = 2.4;                 // bok sześcianu siatki (i płachty 2D) [m]
const ST_DISTANCE_M = 1.75;            // środek siatki tyle przed Tobą [m]
const ST_HEIGHT_OFFSET_M = -0.25;      // środek siatki poniżej oczu [m]
const ST_LINES_3D = 11;                // linii w każdym kierunku (siatka 3D)
const ST_LINES_SHEET = 41;             // linii w każdym kierunku (płachta 2D)
const ST_SEGMENTS = 40;                // odcinków na linię (im więcej, tym gładsze wygięcie)
const ST_SHEET_Y = -0.3;               // wysokość płachty względem środka siatki [m]
const ST_BRIGHTNESS = 0.6;             // jasność linii
const ST_EARTH_YEAR_S = 14;            // tyle sekund Ziemia okrąża Słońce w siatce
const ST_INSIDE_SCALE = 1.6;           // "jestem w środku siatki": siatka tyle razy większa, jej środek w Twojej głowie
const ST_YEARS_PER_S = 1;              // sondy-bliźniaki: tyle lat mija na sekundę (daleko od mas)
const ST_PROBE_START_AGE = 20;         // wiek sond po wyzerowaniu [lata]
const ST_TIME_EFFECT = 1.4;            // jak mocno zakrzywienie spowalnia zegar sond (przesadzone, żeby było widać)

// --- Tryb 9: prędkość światła -------------------------------------------------
const SR_LIGHT_SPEED_MPS = 2;          // światło "zwolnione" do 2 m/s, żeby było widać, jak leci
const SR_TRACK_LENGTH_M = 16;          // tor przelotu statku (z miarką co 0,5 m)
const SR_DISTANCE_M = 2.4;             // tor tyle przed Tobą [m]
const SR_SHIP_LENGTH_M = 1.6;          // długość statku w spoczynku [m]
const SR_CLOCK_HEIGHT_M = 0.5;         // zegar świetlny: odległość lusterek [m]
const SR_SPEEDS = [0, 0.1, 0.5, 0.87, 0.99, 0.999];   // prędkości do wyboru (ułamek prędkości światła)

// --- Tryb 10: podróż od człowieka do całego kosmosu -----------------------------
const J_SCALE_START_M = 1;             // na starcie 1 m w goglach = 1 m naprawdę (człowiek w prawdziwej wielkości)
const J_ATMOSPHERE_KM = 100;           // Podróż: grubość atmosfery (niebieskie niebo z bliska, poświata nad brzegiem Ziemi z kosmosu)
const J_SUN_ELEVATION_DEG = 55;        // Podróż: Słońce tak wysoko nad człowiekiem (dzień)

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
const _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
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
  m5Hands: new Set(),    // Tryb 5: dłonie z wciśniętym spustem (zoom dwiema rękami)
  m5Pinch: null,
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
    } else if (g.opts.oneHand === 'globe') {
      initGlobe(g, c);
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

// "Globus": punkt planety wskazany promieniem (albo dotknięty dłonią) – kierunek od środka planety
const _gv1 = new THREE.Vector3(), _gv2 = new THREE.Vector3(), _gv3 = new THREE.Vector3(), _gv4 = new THREE.Vector3(), _gv5 = new THREE.Vector3();
const _gRay = new THREE.Ray(), _gSphere = new THREE.Sphere(), _gq = new THREE.Quaternion();
function globeTarget(g, c, out) {
  const C = g.target.position, s = g.target.scale.x;
  const P = _gv1.setFromMatrixPosition(c.matrixWorld);
  if (g.near) return out.subVectors(P, C).normalize();
  _gRay.set(P, _gv2.set(0, 0, -1).transformDirection(c.matrixWorld));
  if (!_gRay.intersectSphere(_gSphere.set(C, g.rad * s), out)) _gRay.closestPointToPoint(C, out);
  return out.sub(C).normalize();
}
function initGlobe(g, c) {
  const t = g.target, s = t.scale.x, C = t.position;
  const P = _gv1.setFromMatrixPosition(c.matrixWorld);
  g.near = P.distanceTo(C) < M3_R * s + NEAR_GRAB_MARGIN_M;
  g.rad = M3_R * 1.02;
  if (!g.near) {
    _gRay.set(P, _gv2.set(0, 0, -1).transformDirection(c.matrixWorld));
    const hit = _gRay.intersectSphere(_gSphere.set(C, g.rad * s), _gv3) || _gRay.closestPointToPoint(C, _gv3);
    g.rad = Math.max(hit.distanceTo(C) / s, M3_R * 0.3);
  }
  g.L = globeTarget(g, c, new THREE.Vector3()).applyQuaternion(_gq.copy(t.quaternion).invert());
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
      } else if (g.opts.oneHand === 'globe') {
        // złapany punkt planety idzie za promieniem/dłonią – planeta obraca się w miejscu
        const T = globeTarget(g, c, _gv4);
        const W = _gv5.copy(g.L).applyQuaternion(t.quaternion);
        g.opts.onRotate(_q1.setFromUnitVectors(W, T));
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
      if (g.opts.twoHand === 'approach') { g.opts.onScale(newScale); t.updateMatrixWorld(true); continue; }
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
// Tryb 3: planetę chwytasz jak przedmiot (z daleka przylatuje do ręki); Ty i ona lecicie razem po jej orbicie
const MODE3_GRAB = { minScale: MODE3_SCALE_MIN, maxScale: MODE3_SCALE_MAX, oneHand: 'lever' };
// Tryb 5: bez chwytania i obracania – tylko zoom (gałka albo rozsuwanie obu dłoni ze spustami)
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
function zoomSystemAround(pivot, factor, keepTrack = false) {
  if (!keepTrack) state.track = null;
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

// Tryb 2: GALERIA MINIATUR – wszystkie ciała jako małe kulki na dwóch półkach przed Tobą.
// Wyciągnięte z galerii rosną do prawdziwej wielkości (w skali Trybu 2), odłożone z powrotem – maleją.
const galleryTrays = [0, 1].map(() => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.006, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, transparent: true, opacity: 0.55, roughness: 0.6 }));
  shelf2.group.add(m);
  return m;
});
function layoutShelf2() {
  glueAll(shelf2, true);
  exitSurface();
  const fwd = horizontalForward();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const bodies = shelf2.items.filter(it => !it.isMoon);            // Słońce, planety, Pluton
  const moons = shelf2.items.filter(it => it.isMoon);
  const row = (list, dist, dy, miniR, tray) => {
    list.forEach((it, i) => {
      const x = (i - (list.length - 1) / 2) * GALLERY_SPACING_M;
      it.slot = eyePos.clone().addScaledVector(fwd, dist).addScaledVector(right, x);
      it.slot.y = eyePos.y + dy;
      resetItemTransform(it);
      it.miniScale = miniR / it.extent;
      it.gallery = true;
      it.growK = 0;
      it.obj.position.copy(it.slot);
      it.obj.scale.setScalar(it.miniScale);
    });
    tray.position.copy(eyePos).addScaledVector(fwd, dist);
    tray.position.y = eyePos.y + dy - miniR - 0.006;
    tray.scale.x = list.length * GALLERY_SPACING_M + 0.04;
    tray.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right);
  };
  row(bodies, GALLERY_DISTANCE_M, GALLERY_HEIGHT_M, GALLERY_MINI_R_M, galleryTrays[0]);
  row(moons, GALLERY_DISTANCE_M - 0.08, GALLERY_HEIGHT_M - 0.1, GALLERY_MINI_R_M * 0.8, galleryTrays[1]);
  // na start wyciągnięte: Ziemia i Księżyc (do porównania)
  const out = (id, x) => {
    const it = shelf2.items.find(i => i.def.id === id);
    if (!it) return;
    it.gallery = false; it.growK = 1;
    it.obj.scale.setScalar(1);
    it.obj.position.copy(eyePos).addScaledVector(fwd, 1.0).addScaledVector(right, x);
    it.obj.position.y = eyePos.y - 0.05;
  };
  out('earth', -0.12);
  out('moon', 0.14);
  for (const it of shelf2.items) it.obj.updateMatrixWorld(true);
  if (!renderer.xr.isPresenting) orbitControls.target.copy(eyePos).addScaledVector(fwd, 0.8).setY(eyePos.y - 0.15);
}

// co klatkę: wyciąganie z galerii (rośnie), odkładanie (maleje i wraca na swoje miejsce)
function updateGallery(dt) {
  for (const it of shelf2.items) {
    if (it.cutPair || !it.slot) continue;
    const held = grabs.has(it.obj);
    if (held && it.gallery && it.obj.position.distanceTo(it.slot) > GALLERY_PULL_M) it.gallery = false;     // wyciągnięty
    if (!held && it.wasHeld && !it.gallery && it.obj.position.distanceTo(it.slot) < GALLERY_PULL_M) it.gallery = true;   // odłożony
    it.wasHeld = held;
    const goal = it.gallery ? 0 : 1;
    if (it.growK !== goal) {
      it.growK = THREE.MathUtils.clamp(it.growK + Math.sign(goal - it.growK) * dt / GALLERY_GROW_S, 0, 1);
      const sc = it.miniScale * Math.pow(1 / it.miniScale, smooth(it.growK));
      it.obj.scale.setScalar(sc);
      // trzymany i rosnący: odsuń go od dłoni, żeby nie wchodził w głowę (Słońce ma 11 m!)
      const g = grabs.get(it.obj);
      if (g && g.ctrls.length === 1 && g.offPos) {
        const want = it.pickR * sc + PULL_GAP_M;
        if (g.pullTo) { if (g.pullTo.length() < want) g.pullTo.setLength(want); }
        else if (g.offPos.length() < want) g.offPos.setLength(want);
      }
    }
    if (it.gallery && !held) {
      floaters.delete(it.obj);
      it.obj.position.lerp(it.slot, Math.min(1, dt * 8));
      it.obj.rotateY(dt * 0.4);
    }
  }
}

// ---------- Widok z powierzchni planety: płaski grunt pod stopami, inne wyciągnięte ciała na niebie
//  (w tych samych kierunkach i z tą samą wielkością kątową, co z tego miejsca w modelu)
const surfGroup = new THREE.Group();
surfGroup.visible = false;
scene.add(surfGroup);
const surfLight = new THREE.DirectionalLight(0xfff4e8, 2.4);
surfGroup.add(surfLight, surfLight.target, new THREE.AmbientLight(0xffffff, 0.14));
const surfContent = new THREE.Group();
surfGroup.add(surfContent);
const SURF_ATMOSPHERE = { earth: 0x8fb8ff, mars: 0xd8a070, venus: 0xe8c890, jupiter: 0xd8c0a0, saturn: 0xe0d0a8, uranus: 0xa0e0e8, neptune: 0x7090ff, titan: 0xd8a050 };
state.surf = null;
state.surfPick = false;

function atmosphereTexture(color) {
  const [cv, ctx] = makeCanvas(4, 256);
  const c = new THREE.Color(color), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `rgba(${rgb},0.06)`);
  g.addColorStop(0.3, `rgba(${rgb},0.18)`);
  g.addColorStop(0.47, `rgba(${rgb},0.75)`);
  g.addColorStop(0.5, `rgba(${rgb},0.9)`);
  g.addColorStop(1, `rgba(${rgb},0.9)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  return canvasTexture(cv);
}

function enterSurface(A, hitN = null) {
  exitSurface();
  setKnife(false);
  cancelAllGrabs();
  const others = shelf2.items.filter(it => it !== A && !it.gallery && !it.cutPair);
  const cA = A.obj.position.clone(), RA = A.R * A.obj.scale.x;
  // najbliższe (największe na niebie) ciało stoi SURFACE_ELEVATION_DEG nad horyzontem, na wprost
  let B = null, best = 0;
  for (const it of others) { const a = it.R * it.obj.scale.x / it.obj.position.distanceTo(cA); if (a > best) { best = a; B = it; } }
  const toB = B ? B.obj.position.clone().sub(cA).normalize() : horizontalForward().clone();
  const side = new THREE.Vector3().crossVectors(toB, UP);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  // stoisz dokładnie w klikniętym miejscu (hitN); bez kliknięcia – tam, skąd B jest SURFACE_ELEVATION_DEG nad horyzontem
  const n = hitN ? hitN.clone().normalize() : toB.clone().applyAxisAngle(side, Math.PI / 2 - SURFACE_ELEVATION_DEG * DEG);
  let f = toB.clone().addScaledVector(n, -toB.dot(n));                                     // twarzą w stronę B
  if (f.lengthSq() < 1e-4) f = horizontalForward().clone().addScaledVector(n, -horizontalForward().dot(n));
  if (f.lengthSq() < 1e-4) f = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
  f.normalize();
  const E = cA.clone().addScaledVector(n, RA);
  const fw = horizontalForward().clone();
  const qs = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f, n), n, f.clone().negate()));
  const qw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(fw, UP), UP, fw.clone().negate()));
  const qMap = qw.multiply(qs.invert());
  const eye = eyePos.clone();
  const sky = [];
  let sunDir = null;
  const place = (def, R, d, dir, quat, isSun) => {
    const wrap = new THREE.Group();
    const vis = buildVisual(def, 1);
    wrap.add(vis.group);
    if (isSun) wrap.add(makeGlowSprite(0xffd27a, 4, 0.6));
    wrap.scale.setScalar(SURFACE_SKY_M * R / d);
    wrap.position.copy(eye).addScaledVector(dir, SURFACE_SKY_M);
    if (quat) wrap.quaternion.copy(quat);
    surfContent.add(wrap);
    const label = makeLabel(def.name);
    surfContent.add(label);
    placeLabel(label, wrap.position, SURFACE_SKY_M * R / d * 1.2, 2.2);
    sky.push({ def, deg: 2 * Math.asin(Math.min(1, R / d)) / DEG });
  };
  for (const it of others) {
    const v = it.obj.position.clone().sub(E), d = v.length(), R = it.R * it.obj.scale.x;
    if (d <= R) continue;
    const dir = v.normalize().applyQuaternion(qMap);
    place(it.def, R, d, dir, qMap.clone().multiply(it.obj.quaternion), it.isSun);
    if (it.isSun) sunDir = dir.clone();
  }
  // Słońce w galerii: rysujemy je tak, jak widać je naprawdę z orbity tej planety
  if (!sunDir) {
    const sunDef = BODIES.find(b => b.type === 'star');
    const au = A.isMoon ? A.parentItem.def.au : A.isSun ? 0 : A.def.au;
    if (au > 0) {
      sunDir = fw.clone().applyAxisAngle(UP, 2.3).multiplyScalar(Math.cos(25 * DEG)).add(new THREE.Vector3(0, Math.sin(25 * DEG), 0)).normalize();
      const d = au * KM_PER_AU;
      place(sunDef, sunDef.radiusKm, d, sunDir, null, true);
    }
  }
  if (!sunDir) sunDir = new THREE.Vector3(0.3, 0.8, 0.4).normalize();
  surfLight.position.copy(eye).addScaledVector(sunDir, 100);
  surfLight.target.position.copy(eye);
  // grunt: powiększony fragment tekstury planety
  let map = null;
  A.obj.traverse(o => { if (!map && o.material && o.material.map) map = o.material.map; });
  const floorTex = map ? map.clone() : null;
  if (floorTex) { floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(0.12, 0.12); floorTex.offset.set(0.31, 0.44); floorTex.needsUpdate = true; }
  const floorMat = A.isSun ? new THREE.MeshBasicMaterial({ map: floorTex, color: 0xffe2a0 })
    : new THREE.MeshLambertMaterial({ map: floorTex, color: floorTex ? 0xffffff : (A.def.color || 0x888888) });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(420, 96).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(eye.x, renderer.xr.isPresenting ? 0 : eye.y - 1.6, eye.z);
  surfContent.add(floor);
  // atmosfera (niebo przy horyzoncie w kolorze nieba tej planety)
  const atm = SURF_ATMOSPHERE[A.def.id];
  if (atm) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.MeshBasicMaterial({ map: atmosphereTexture(atm), transparent: true, side: THREE.BackSide, depthWrite: false }));
    dome.position.copy(eye);
    surfContent.add(dome);
  }
  shelf2.group.visible = false;
  surfGroup.visible = true;
  state.surf = { A, sky };
  state.surfPick = false;
  drawMenu();
}
function exitSurface() {
  if (!state.surf && !surfGroup.visible) return;
  surfContent.traverse(o => { if (o.geometry && o.geometry !== sphereGeometryHi && o.geometry !== sphereGeometry) o.geometry.dispose(); });
  surfContent.clear();
  surfGroup.visible = false;
  shelf2.group.visible = state.mode === 2;
  state.surf = null;
  drawMenu();
}
function surfaceAction(origin, dir) {             // stań na wskazanej planecie (albo wróć)
  if (state.surf) { exitSurface(); return; }
  const res = pickShelf(shelf2, origin, dir);
  if (res) {
    const A = res.entry.kind === 'half' ? res.entry.pair.whole : res.entry;
    // punkt na kuli, w który celujesz – tam stajesz
    const C = A.obj.position, r = A.R * A.obj.scale.x;
    _gRay.set(origin, dir);
    let hit = res.near ? origin.clone() : _gRay.intersectSphere(_gSphere.set(C, r), new THREE.Vector3());
    if (!hit) hit = _gRay.closestPointToPoint(C, new THREE.Vector3());
    const n = hit.sub(C);
    enterSurface(A, n.lengthSq() > 1e-10 ? n.normalize() : null);
  }
  else { state.surfPick = !state.surfPick; drawMenu(); }
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
  if (e.isSun && !res.near && !e.gallery) {         // Słońce jest za wielkie, by je przyciągnąć – obracasz je zdalnie
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
    if (it.cutPair || !isCuttable(it) || it.gallery) continue;
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
    if (it.gallery && !it.cutPair) {                     // galeria: mały podpis pod miniaturą
      it.nameLabel.visible = !showInfo;
      if (it.infoLabel) it.infoLabel.visible = showInfo;
      const r = it.pickR * anchor.scale.x;
      if (it.nameLabel.visible) placeLabel(it.nameLabel, anchor.position, -(r + 0.016), 0.75);
      if (showInfo) placeLabel(it.infoLabel, anchor.position, r + 0.01, INFO_LABEL_ANGLE_DEG);
      continue;
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
const mode3Light = (() => {                        // słabe światło "z głowy" + otoczenie; główne światło daje Słońce
  mode3Group.add(new THREE.AmbientLight(0xffffff, MODE3_AMBIENT));
  const l = new THREE.DirectionalLight(0xffffff, 0.55);
  mode3Group.add(l, l.target);
  return l;
})();

const m3Planet = new THREE.Group();              // to chwytamy; ludziki są jego dziećmi -> rosną razem z nim
mode3Group.add(m3Planet);
const M3_R = MODE3_PLANET_DIAMETER_M / 2;

// ---------- Planety generowane w kodzie (szum fraktalny): kontynenty, góry, śnieg, oceany ----------
function makeNoise3(seed) {
  const rnd = seededRandom(seed);
  const perm = new Uint8Array(512), val = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) val[i] = rnd() * 2 - 1;
  const f = t => t * t * t * (t * (t * 6 - 15) + 10);
  const L = (a, b, t) => a + (b - a) * t;
  const n = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const xf = x - X, yf = y - Y, zf = z - Z, u = f(xf), v = f(yf), w = f(zf);
    const h = (i, j, k) => val[perm[perm[perm[(X + i) & 255] + ((Y + j) & 255)] + ((Z + k) & 255)]];
    return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v),
             L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
  return (x, y, z, octaves = 5) => {                 // szum fraktalny (kilka "oktaw" coraz drobniejszych szczegółów)
    let sum = 0, amp = 0.5, fr = 1;
    for (let o = 0; o < octaves; o++) { sum += amp * n(x * fr + 31.4 * o, y * fr, z * fr); amp *= 0.5; fr *= 2.03; }
    return sum;
  };
}

// Palety kolorów: [wysokość od, kolor]
const PLANET_PALETTES = {
  moon: { ocean: null, floor: 0x8a8a8a, bands: [[-1, 0x7e7e7e], [0, 0x9a9a98], [0.2, 0xb4b4b0]], polar: false },
  earth: { ocean: 0x2a72c8, floor: 0x1d4f8c, bands: [[0, 0xe6d6a2], [0.03, 0x5fae4a], [0.16, 0x3f8a3a], [0.3, 0x8a7f72], [0.45, 0xf4f6fa]], polar: true },
  desert: { ocean: null, floor: 0xc89a5a, bands: [[-1, 0xb8804a], [0, 0xd8aa66], [0.15, 0xc48a52], [0.3, 0x9a6a44]], polar: false },
  ice: { ocean: 0x7fb8e8, floor: 0x5f8fbf, bands: [[0, 0xdfeaf4], [0.1, 0xf6faff]], polar: true },
  green: { ocean: 0x2f8fb0, floor: 0x1f6080, bands: [[0, 0xd8d090], [0.03, 0x6cc04a], [0.2, 0x4a9a3a], [0.38, 0xf0f4f0]], polar: true },
};

// Zwraca { group, height(dir) -> h, radiusAt(h) } – planetę o promieniu R
// prepare(baseHeight) może dodać ukształtowanie (np. wulkan): zwraca { bump(d), color(d, h) -> kolor albo null }
function makeProceduralPlanet(R, seed, paletteName, detail, mountain = MODE3_MOUNTAIN_HEIGHT, prepare = null) {
  const pal = PLANET_PALETTES[paletteName];
  const noise = makeNoise3(seed);
  const baseHeight = d => noise(d.x * 1.7, d.y * 1.7, d.z * 1.7) * 1.15 - MODE3_SEA_LEVEL + 0.04 * noise(d.x * 9, d.y * 9, d.z * 9, 2);
  const extra = prepare ? prepare(baseHeight) : null;
  const height = extra ? (d => baseHeight(d) + extra.bump(d)) : baseHeight;
  const radiusAt = h => (h > 0 || !pal.ocean ? 1 + Math.max(h, -0.2) * mountain : 1 + h * 0.03) * R;
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const d = new THREE.Vector3(), c = new THREE.Color(), c2 = new THREE.Color();
  const jitter = makeNoise3(seed + 'c');
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const h = height(d);
    pos.setXYZ(i, d.x * radiusAt(h), d.y * radiusAt(h), d.z * radiusAt(h));
    if (h < 0 && pal.ocean) c.setHex(pal.floor);
    else {
      let k = 0;
      while (k + 1 < pal.bands.length && h > pal.bands[k + 1][0]) k++;
      c.setHex(pal.bands[k][1]);
      if (k + 1 < pal.bands.length) {               // płynne przejście między strefami
        const t = THREE.MathUtils.clamp((h - pal.bands[k + 1][0]) / 0.03 + 1, 0, 1);
        c.lerp(c2.setHex(pal.bands[k + 1][1]), t * 0.6);
      }
    }
    if (pal.polar && Math.abs(d.y) > 0.86 + 0.05 * jitter(d.x * 4, d.y * 4, d.z * 4, 2)) c.setHex(0xf4f6fa);   // czapy polarne
    const fc = extra && extra.color(d, h);
    if (fc != null) c.setHex(fc);
    const v = 0.92 + 0.16 * jitter(d.x * 14, d.y * 14, d.z * 14, 2);
    colors.set([c.r * v, c.g * v, c.b * v], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })));
  if (pal.ocean) {
    const water = new THREE.Mesh(new THREE.IcosahedronGeometry(R, Math.min(detail, 24)), new THREE.MeshStandardMaterial({
      color: pal.ocean, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88,
    }));
    group.add(water);
  }
  return { group, height, baseHeight, radiusAt, hasOcean: !!pal.ocean, extra };
}

// Miejsca na wulkan i wioski wybrane na lądzie; wulkan wbudowany w rzeźbę terenu
function planFeatures(baseHeight) {
  const rnd = seededRandom('features');
  const randDir = () => new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.7, rnd() * 2 - 1).normalize();
  const find = (ok, tries = 4000) => { for (let i = 0; i < tries; i++) { const d = randDir(); if (ok(d)) return d; } return null; };
  const volcano = MODE3_VOLCANO ? find(d => { const h = baseHeight(d); return h > 0.1 && h < 0.24; }) : null;
  const villages = [];
  for (let v = 0; v < MODE3_VILLAGES; v++) {
    const d = find(dir => {
      const h = baseHeight(dir);
      if (h < 0.05 || h > 0.16) return false;
      if (volcano && dir.angleTo(volcano) < 0.55) return false;
      return villages.every(o => dir.angleTo(o) > 0.6);
    });
    if (d) villages.push(d);
  }
  const VR = 0.13, CR = 0.022;                       // promień wulkanu i krateru (kąt)
  const features = { volcano, villages, volcanoRadius: VR, craterRadius: CR };
  return {
    features,
    bump(d) {
      if (!volcano) return 0;
      const a = d.angleTo(volcano);
      if (a > VR) return 0;
      const t = 1 - a / VR;
      let b = 0.95 * Math.pow(t, 1.6);                 // stożek wulkanu
      if (a < CR) b -= 0.35 * (1 - a / CR);             // krater
      return b;
    },
    color(d, h) {
      if (volcano) {
        const a = d.angleTo(volcano);
        if (a < CR * 0.9) return 0xff5a1a;               // lawa
        if (a < VR * 0.75) return a < CR * 1.6 ? 0x2e2622 : 0x4a3e36;   // bazalt
      }
      for (const v of villages) if (d.angleTo(v) < MODE3_VILLAGE_RADIUS_RAD * 0.8 && h > 0.02) return 0x8fb058;   // łąki wokół wiosek
      return null;
    },
  };
}

// Powierzchnia planety: promień gruntu i "czy to woda" w danym kierunku (w układzie planety, skala 1)
const m3Flags = { dry: false };            // np. 300°C: brak wody (ludziki mogą chodzić po dawnym dnie)
const m3DynFields = [];                     // zmiany rzeźby terenu ze scenariuszy (góry, krater)
const m3Trees = { trunks: null, crowns: null, dirs: [] };
let m3Surface;
let m3Proc = null;
let m3Features = { volcano: null, villages: [] };
if (!models.smallPlanet) {
  let planned = null;
  m3Proc = makeProceduralPlanet(M3_R, 'swiat', 'earth', MODE3_PLANET_DETAIL, MODE3_MOUNTAIN_HEIGHT, bh => (planned = planFeatures(bh)));
  m3Features = planned.features;
  m3Planet.add(m3Proc.group);
  // powierzchnia liczona wprost ze wzoru – dokładnie i bez kosztownego "strzelania promieniami"
  m3Surface = { query: d => { const h = m3Proc.height(d); return { r: m3Proc.radiusAt(Math.max(h, 0)) + m3DynR(d), water: h < 0.012 && !m3Flags.dry }; } };
  // drzewka: pień + korona, po jednej instancji na cały las
  const rnd = seededRandom('trees');
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.4, 5).translate(0, 0.2, 0);
  const crownGeo = new THREE.ConeGeometry(0.28, 0.75, 7).translate(0, 0.72, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }), MODE3_TREE_COUNT);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), MODE3_TREE_COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < MODE3_TREE_COUNT && tries < MODE3_TREE_COUNT * 30; tries++) {
    const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const h = m3Proc.height(d);
    if (h < 0.04 || h > 0.3 || Math.abs(d.y) > 0.8) continue;
    if (m3Features.volcano && d.angleTo(m3Features.volcano) < 0.15) continue;                         // nie na wulkanie
    if (m3Features.villages.some(v => d.angleTo(v) < MODE3_VILLAGE_RADIUS_RAD * 1.1)) continue;       // nie w wiosce
    q.setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6.3));
    sc.setScalar(0.012 + rnd() * 0.014);
    m.compose(d.clone().multiplyScalar(m3Proc.radiusAt(h) - 0.001), q, sc);
    trunks.setMatrixAt(n, m); crowns.setMatrixAt(n, m);
    m3Trees.dirs.push(d);
    crowns.setColorAt(n, col.setHSL(0.27 + rnd() * 0.08, 0.55, 0.22 + rnd() * 0.12));
    n++;
  }
  trunks.count = crowns.count = n;
  crowns.instanceColor.needsUpdate = true;
  m3Planet.add(trunks, crowns);
  m3Trees.trunks = trunks; m3Trees.crowns = crowns;
} else if (models.smallPlanet) {
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
  // kości do ruchów układanych w kodzie (machanie, kucanie, gesty)
  const bones = {};
  c.traverse(o => {
    if (!o.isBone) return;
    for (const k of ['Hips', 'Spine', 'Head', 'RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg']) {
      if (o.name.endsWith(k) && !(k === 'RightArm' && o.name.endsWith('ForeArm')) && !(k === 'LeftArm' && o.name.endsWith('ForeArm'))) bones[k] = o;
    }
  });
  return { root: holder, mixer, play, bones };
}

// Ruchy dokładane do animacji stania: machanie, kucanie, gestykulacja przy rozmowie.
// o = siła każdego ruchu (0..1, płynnie narasta i zanika); kąty dobrane do szkieletu Mixamo.
const _eul = new THREE.Euler(), _qo = new THREE.Quaternion();
function applyPersonOverlay(P) {
  const b = P.model.bones, o = P.ov, t = P.time;
  const rot = (bone, x, y, z) => { if (bone) bone.quaternion.multiply(_qo.setFromEuler(_eul.set(x, y, z))); };
  if (o.wave > 0.01) {
    rot(b.RightArm, 0, 0, 1.5 * o.wave);
    rot(b.RightForeArm, 0, 0, (1.4 + 0.45 * Math.sin(t * 9)) * o.wave);
  }
  if (o.squat > 0.01) {
    if (b.Hips) b.Hips.position.y -= 40 * o.squat;
    rot(b.LeftUpLeg, -1.3 * o.squat, 0, 0); rot(b.RightUpLeg, -1.3 * o.squat, 0, 0);
    rot(b.LeftLeg, 1.9 * o.squat, 0, 0); rot(b.RightLeg, 1.9 * o.squat, 0, 0);
    rot(b.Spine, 0.25 * o.squat, 0, 0);
  }
  if (o.talk > 0.01) {
    const speaking = Math.sin(t * 0.7 + P.phase) > 0;     // na zmianę: mówi i słucha
    rot(b.RightArm, 0, 0, 0.35 * o.talk);
    rot(b.RightForeArm, (speaking ? 1.1 + 0.3 * Math.sin(t * 4 + P.phase) : 0.4) * o.talk, 0, 0);
    rot(b.Head, (speaking ? 0.06 * Math.sin(t * 5) : 0.12 * Math.sin(t * 2.2)) * o.talk, 0, 0);
  }
}

function pickBehavior(rnd = Math.random) {
  let r = rnd() * MODE3_BEHAVIOR.reduce((s, b) => s + b[1], 0);
  for (const [name, w, t0, t1] of MODE3_BEHAVIOR) {
    if ((r -= w) <= 0) return [name, t0 + rnd() * (t1 - t0)];
  }
  return ['walk', 5];
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

// Atmosfera: niebieska poświata wokół planety i lekka mgiełka przy jej krawędzi (kolor zależy od temperatury)
const m3Atmo = (() => {
  const shared = { uColor: { value: new THREE.Color(0x6fa8ff) }, uStrength: { value: 1 }, uInside: { value: 0 } };
  const vert = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
  const frag = back => `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uStrength;
uniform float uInside;
varying vec3 vN;
varying vec3 vP;
void main() {
  #include <logdepthbuf_fragment>
  float d = dot(normalize(vN), normalize(-vP));
  float i;
  ${back ? `if (uInside > 0.5) i = 0.18 + 0.3 * (1.0 - abs(d));          // z wnętrza: niebo, jaśniejsze przy horyzoncie
  else i = pow(clamp(-d / 0.42, 0.0, 1.0), 1.6);                        // z zewnątrz: poświata przy krawędzi planety`
    : `i = pow(clamp(1.0 - d, 0.0, 1.0), 3.0) * 0.55;`}
  gl_FragColor = vec4(uColor * i * uStrength, 1.0);
}`;
  const make = (r, back) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.ShaderMaterial({
      uniforms: shared, vertexShader: vert, fragmentShader: frag(back),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: back ? THREE.BackSide : THREE.FrontSide,
    }));
    m.frustumCulled = false;
    m3Planet.add(m);
    return m;
  };
  const halo = make(M3_R * 1.1, true), rim = make(M3_R * 1.015, false);
  return { shared, halo, rim, goal: { color: new THREE.Color(0x6fa8ff), strength: 1 } };
})();
const M3_ATMO = { '-30': [0xcfe6ff, 0.9], 15: [0x6fa8ff, 1], 40: [0x8fc0ff, 1.05], 80: [0xd8d8d0, 1.2], 300: [0xe8b060, 1.8] };
function m3SetAtmosphere(T, color = null, strength = null) {
  const a = M3_ATMO[T] || M3_ATMO[15];
  m3Atmo.goal.color.setHex(color ?? a[0]);
  m3Atmo.goal.strength = strength ?? a[1];
}
function m3UpdateAtmosphere(dt) {
  const k = Math.min(1, dt * 1.2), sh = m3Atmo.shared;
  sh.uColor.value.lerp(m3Atmo.goal.color, k);
  sh.uStrength.value += (m3Atmo.goal.strength - sh.uStrength.value) * k;
  sh.uInside.value = eyePos.distanceTo(m3Planet.position) < M3_R * 1.1 * m3Planet.scale.x ? 1 : 0;
}

// --- Wioski, wulkan, chmura burzowa, księżyc i satelita (wszystko jako część planety) ---
const m3Extras = { houses: [], smoke: [], lava: null, storm: null, moon: null, sat: null };
// ustawia obiekt na powierzchni: kierunek d, wysokość nad środkiem r, obrót wokół pionu
function surfaceMatrix(d, r, yaw, scale, out = new THREE.Matrix4()) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d).multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  return out.compose(d.clone().multiplyScalar(r), q, new THREE.Vector3(scale, scale, scale));
}
if (m3Proc) {
  // domki: ściany + dach (2 instancje na wszystkie wioski)
  const rnd = seededRandom('houses');
  const total = MODE3_VILLAGES * MODE3_HOUSES_PER_VILLAGE;
  const wallGeo = new THREE.BoxGeometry(1, 0.75, 0.85).translate(0, 0.33, 0);
  const roofGeo = new THREE.ConeGeometry(0.8, 0.55, 4).rotateY(Math.PI / 4).scale(1, 1, 0.85).translate(0, 0.98, 0);
  const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), total);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), total);
  const wallColors = [0xf2ead8, 0xe8d8b8, 0xf6f0e6, 0xd8c8a8, 0xe0e8f0], roofColors = [0xb03a2a, 0x8a3a20, 0x6a4a3a, 0xc05a30];
  const col = new THREE.Color(), m = new THREE.Matrix4();
  let n = 0;
  for (const v of m3Features.villages) {
    const t1 = new THREE.Vector3().crossVectors(v, UP).normalize(), t2 = new THREE.Vector3().crossVectors(v, t1);
    for (let k = 0, tries = 0; k < MODE3_HOUSES_PER_VILLAGE && tries < 200; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * MODE3_VILLAGE_RADIUS_RAD;
      const d = v.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
      const h = m3Proc.height(d);
      if (h < 0.02 || m3Extras.houses.some(o => o.d.angleTo(d) < 0.035)) continue;
      const sc = 0.016 + rnd() * 0.006;
      surfaceMatrix(d, m3Proc.radiusAt(h) - 0.002, rnd() * 6.3, sc, m);
      walls.setMatrixAt(n, m); roofs.setMatrixAt(n, m);
      walls.setColorAt(n, col.setHex(wallColors[n % wallColors.length]));
      roofs.setColorAt(n, col.setHex(roofColors[n % roofColors.length]));
      m3Extras.houses.push({ d, rad: sc * 0.8 / M3_R });
      n++; k++;
    }
  }
  walls.count = roofs.count = n;
  if (n) { walls.instanceColor.needsUpdate = true; roofs.instanceColor.needsUpdate = true; }
  m3Planet.add(walls, roofs);

  // wulkan: poświata lawy w kraterze + kłęby dymu
  const vd = m3Features.volcano;
  if (vd) {
    const top = vd.clone().multiplyScalar(m3Proc.radiusAt(m3Proc.height(vd)) + 0.002);
    const lava = makeGlowSprite(0xff6a20, 0.03, 0.9);
    lava.position.copy(top);
    m3Planet.add(lava);
    m3Extras.lava = lava;
    for (let i = 0; i < 12; i++) {
      const puff = makeGlowSprite(0x6a6460, 0.02, 0.5, softGlowTexture);
      puff.material.blending = THREE.NormalBlending;
      puff.userData.t = i / 12;
      m3Planet.add(puff);
      m3Extras.smoke.push(puff);
    }
    m3Extras.volcanoTop = top;
    m3Extras.volcanoDir = vd;
  }
}

// chmura burzowa z deszczem i błyskawicami – płynie razem z warstwą chmur
if (MODE3_STORM) {
  const rnd = seededRandom('storm');
  const dir = new THREE.Vector3(0.55, 0.35, 0.76).normalize();
  const storm = new THREE.Group();
  storm.position.copy(dir).multiplyScalar(M3_R * 1.16);
  storm.quaternion.setFromUnitVectors(UP, dir);      // lokalnie: +Y = w górę (od planety)
  const puff = new THREE.SphereGeometry(1, 10, 8);
  const geoms = [];
  for (let i = 0; i < 14; i++) {
    const r = 0.016 + rnd() * 0.012;
    geoms.push(puff.clone().scale(r, r * 0.7, r).translate((rnd() - 0.5) * 0.07, rnd() * 0.012, (rnd() - 0.5) * 0.05));
  }
  const cloudMat = new THREE.MeshToonMaterial({ color: 0x4a4f5a, emissive: 0x000000 });
  storm.add(mergedMesh(geoms, cloudMat));
  // deszcz: krótkie kreski spadające w dół
  const drops = [];
  const fallH = M3_R * 0.16;
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 0.07, z = (rnd() - 0.5) * 0.05, y = -rnd() * fallH;
    drops.push(x, y, z, x, y - 0.006, z);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fc0e8, transparent: true, opacity: 0.55 }));
  const rainBox = new THREE.Group();
  rainBox.add(rain);
  storm.add(rainBox);
  // błyskawica: łamana od chmury do ziemi (losowana przy każdym błysku)
  const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3())),
    new THREE.LineBasicMaterial({ color: 0xf4f0ff }));
  bolt.visible = false;
  storm.add(bolt);
  const flash = makeGlowSprite(0xdfe8ff, 0.12, 0.0);
  storm.add(flash);
  m3Clouds.add(storm);
  m3Extras.storm = { storm, rainBox, rain, fallH, bolt, flash, cloudMat, next: 2, on: 0 };
}

// księżyc (na sztywno związany z planetą – krąży wokół niej) i sztuczny satelita
if (MODE3_MOON) {
  const moonPivot = new THREE.Group();
  moonPivot.rotation.z = 0.25;
  const moon = makeProceduralPlanet(0.09, 'ksiezyc', 'moon', 16, 0.15);
  moon.group.position.set(1.05, 0, 0);
  moonPivot.add(moon.group);
  m3Planet.add(moonPivot);
  const satPivot = new THREE.Group();
  satPivot.rotation.x = 0.9;
  const sat = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.7, roughness: 0.35 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x2a4a9a, metalness: 0.4, roughness: 0.3, emissive: 0x0a1430 });
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.018), metal));
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.001, 0.012), panel);
    p.position.x = sx * 0.022;
    sat.add(p);
  }
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.004, 12, 1, true), metal);
  dish.position.z = 0.011; dish.rotation.x = Math.PI / 2;
  sat.add(dish);
  sat.position.set(0.7, 0, 0);
  satPivot.add(sat);
  m3Planet.add(satPivot);
  m3Extras.moon = moonPivot;
  m3Extras.sat = satPivot;
}

function updateMode3World(dt) {
  if (m3Extras.moon) m3Extras.moon.rotation.y += dt * 0.12;
  if (m3Extras.sat) m3Extras.sat.rotation.y += dt * 0.5;
  // dym z wulkanu: kłęby wznoszą się, rosną i znikają
  if (m3Extras.volcanoTop) {
    const up = m3Extras.volcanoDir;
    for (const puff of m3Extras.smoke) {
      puff.userData.t = (puff.userData.t + dt * 0.12) % 1;
      const t = puff.userData.t;
      puff.position.copy(m3Extras.volcanoTop).addScaledVector(up, t * 0.09);
      puff.position.x += Math.sin(t * 6 + puff.id) * 0.006;
      puff.scale.setScalar(0.012 + t * 0.045);
      puff.material.opacity = 0.55 * Math.sin(Math.PI * t);
    }
    m3Extras.lava.material.opacity = 0.7 + 0.25 * Math.sin(performance.now() / 300);
  }
  // burza: deszcz spada, co kilka sekund błyskawica
  const st = m3Extras.storm;
  if (st) {
    st.rainBox.position.y = -((performance.now() / 1000 * 0.12) % 0.012);
    st.next -= dt;
    if (st.next <= 0) {
      st.next = 1.5 + Math.random() * 4;
      st.on = 0.14;
      const pos = st.bolt.geometry.attributes.position;
      let x = (Math.random() - 0.5) * 0.04, z = (Math.random() - 0.5) * 0.03;
      for (let i = 0; i < pos.count; i++) {
        const y = -i / (pos.count - 1) * st.fallH * 1.05;
        pos.setXYZ(i, x, y, z);
        x += (Math.random() - 0.5) * 0.012; z += (Math.random() - 0.5) * 0.01;
      }
      pos.needsUpdate = true;
    }
    st.on -= dt;
    const lit = st.on > 0;
    st.bolt.visible = lit && (st.on > 0.09 || st.on < 0.05);   // migotanie
    st.flash.material.opacity = lit ? 0.6 : 0;
    st.cloudMat.emissive.setHex(lit ? 0x6a7090 : 0x000000);
  }
}

// przeszkody: domki i krater wulkanu
function isObstacle(d) {
  for (const h of m3Extras.houses) if (d.angleTo(h.d) < h.rad) return true;
  return !!(m3Features.volcano && d.angleTo(m3Features.volcano) < 0.05);
}

const people = [];
{
  const rnd = seededRandom('people');
  const c = new THREE.Color();
  const randomDir = () => {
    const p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    return p.lengthSq() < 1e-3 ? p.set(0, 1, 0) : p.normalize();
  };
  const villages = m3Features.villages;
  for (let i = 0; i < N3; i++) {
    // większość ludzików mieszka w wioskach (zaczyna przy swoim domu)
    const home = villages.length && rnd() < MODE3_HOME_SHARE ? villages[i % villages.length] : null;
    const nearHome = () => {
      const t1 = new THREE.Vector3().crossVectors(home, UP).normalize(), t2 = new THREE.Vector3().crossVectors(home, t1);
      const a = rnd() * 6.3, r = Math.sqrt(rnd()) * MODE3_VILLAGE_RADIUS_RAD * 1.3;
      return home.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
    };
    const pick = home ? nearHome : randomDir;
    let p = pick();
    for (let k = 0; k < 200 && (m3Surface.query(p).water || isObstacle(p)); k++) p = pick();   // start na lądzie, nie w domu
    const f = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    f.addScaledVector(p, -f.dot(p));
    if (f.lengthSq() < 1e-4) f.set(1, 0, 0).addScaledVector(p, -p.x);
    f.normalize();
    const P = { p, f, r: m3Surface.query(p).r, speed: MODE3_PERSON_SPEED_MPS * (0.7 + rnd() * 0.6), turn: 0, phase: rnd() * 6, avoid: 0, checkIn: rnd() * 0.2,
      action: 'walk', actionT: 2 + rnd() * 8, ov: { wave: 0, squat: 0, talk: 0 }, time: rnd() * 10, target: null, home };
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

// --- "Kamera za ludzikiem": wybrany ludzik stoi przed Tobą (powiększony), a planeta kręci się pod nim ---
const ACTION_NAMES = { walk: 'idzie', run: 'biegnie', idle: 'rozgląda się', wave: 'macha', squat: 'kuca', talk: 'rozmawia', approach: 'idzie do kogoś' };
const followAnchor = new THREE.Vector3(), followFwd = new THREE.Vector3(0, 0, -1);
const _fqL = new THREE.Quaternion(), _fqW = new THREE.Quaternion(), _fm = new THREE.Matrix4();
function personWorldPos(P, out) {
  return out.copy(P.p).multiplyScalar(P.r + MODE3_PERSON_HEIGHT_M * 0.5).applyMatrix4(m3Planet.matrixWorld);
}
// ludzik najbliżej promienia (tolerancja kątowa, bo z daleka są maleńcy)
function pickPerson(origin, dir) {
  m3Planet.updateMatrixWorld(true);
  let best = null, bestA = 6 * DEG;
  for (const P of people) {
    const v = personWorldPos(P, _v4).sub(origin);
    const a = v.angleTo(dir);
    if (a < bestA) { bestA = a; best = P; }
  }
  return best;
}
function startFollow(P) {
  state.follow = P;
  state.m3Pick = false;
  cancelAllGrabs();
  floaters.delete(m3Planet);
  followFwd.copy(horizontalForward());
  followAnchor.copy(eyePos).addScaledVector(followFwd, MODE3_FOLLOW_DISTANCE_M);
  followAnchor.y = eyePos.y - MODE3_FOLLOW_DROP_M;
  state.followYaw = 0;
  state.followScale = MODE3_FOLLOW_SCALE;
  state.m3Saved = { pos: m3Planet.position.clone(), scale: m3Planet.scale.x };
  drawMenu();
}
function stopFollow() {
  state.follow = null;
  state.m3Pick = false;
  if (state.m3Saved) { m3Planet.position.copy(state.m3Saved.pos); m3Planet.scale.setScalar(state.m3Saved.scale); }   // planeta wraca na swoje miejsce
  drawMenu();
}
function togglePersonPick() {
  if (state.follow) stopFollow();
  else { state.m3Pick = !state.m3Pick; drawMenu(); }
}
function updateFollow(dt) {
  const P = state.follow;
  if (!P) return;
  const k = 1 - Math.exp(-dt * 5);
  // obrót planety: "góra" ludzika = w górę, jego przód = od Ciebie (widzisz go od tyłu)
  const fwdW = _v3.copy(followFwd).applyAxisAngle(UP, state.followYaw);
  _right.crossVectors(P.p, P.f).normalize();
  _fqL.setFromRotationMatrix(_fm.makeBasis(_right, P.p, P.f));
  _fqW.setFromRotationMatrix(_fm.makeBasis(_v2.crossVectors(UP, fwdW).normalize(), UP, fwdW));
  _fqW.multiply(_fqL.invert());                    // docelowy obrót planety w świecie
  // obracamy "widok" (planetę razem z jej układem słonecznym), więc Słońce zostaje tam, gdzie naprawdę jest
  m3View.slerp(_fqW.multiply(_gq.copy(m3True).invert()), k);
  const s0 = m3Planet.scale.x;
  m3Planet.scale.setScalar(s0 * Math.pow(state.followScale / s0, k));
  m3Planet.quaternion.multiplyQuaternions(m3View, m3True);
  const feet = _v1.copy(P.p).multiplyScalar(P.r * m3Planet.scale.x).applyQuaternion(m3Planet.quaternion);
  m3Planet.position.copy(followAnchor).sub(feet);
}
// gałka podczas śledzenia: góra/dół = zoom, lewo/prawo = obejście ludzika dookoła
function stickFollow(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  if (!state.follow) {                               // bez śledzenia: góra/dół = przybliż się, lewo/prawo = obróć planetę
    if (Math.abs(y) > STICK_DEADZONE && !grabs.has(m3Planet)) setM3Zoom(m3Planet.scale.x * Math.pow(3, -y * dt));
    if (Math.abs(x) > STICK_DEADZONE) rotateM3Planet(_q2.setFromAxisAngle(UP, x * MODE3_STICK_TURN_DEG_S * DEG * dt));
    return;
  }
  if (Math.abs(y) > STICK_DEADZONE) state.followScale = THREE.MathUtils.clamp(state.followScale * Math.pow(3, -y * dt), 4, 80);
  if (Math.abs(x) > STICK_DEADZONE) state.followYaw -= x * 70 * DEG * dt;
}

// --- Układ słoneczny planety (daleko w tle – nie da się go dotknąć): Słońce, inne planety i orbity.
//     Lecisz razem ze swoją planetą po jej orbicie: planeta zostaje przed Tobą, a Słońce i inne planety
//     powoli przesuwają się w tle. Obracanie i przybliżanie planety nie zmienia jej orbity.
//     Układ nie skaluje się razem z planetą (jest bardzo daleko), więc widać go też w trybie kamery za ludzikiem.
const m3True = new THREE.Quaternion();     // obrót planety względem gwiazd (jej doba: dzień i noc)
const m3View = new THREE.Quaternion();     // obrót całego układu względem Ciebie (zmienia go tylko kamera za ludzikiem)
const m3Base = { center: new THREE.Vector3(), cosmosQ: new THREE.Quaternion() };
const m3Cosmos = new THREE.Group();        // środek = środek Twojej planety
const m3Helio = new THREE.Group();         // Słońce w środku; przesuwane tak, by Twoja planeta była w środku m3Cosmos
const m3CosmosParts = { spinners: [], others: [], ourOrbit: null, t: 0, phi0: 50 * DEG };
if (MODE3_MINI_COSMOS) {
  mode3Group.add(m3Cosmos);
  const plane = new THREE.Group();          // płaszczyzna orbit lekko pochylona: Słońce przechodzi nad horyzontem
  plane.rotation.x = 0.25;
  m3Cosmos.add(plane);
  plane.add(m3Helio);
  const A = MODE3_ORBIT_RADIUS_M, RS = MODE3_SUN_RADIUS_M;
  const sunBody = new THREE.Mesh(sphereGeometryHi, new THREE.MeshBasicMaterial({ map: placeholderTexture(BODIES[0]), color: 0xffe2a0 }));
  sunBody.scale.setScalar(RS);
  useTextureFile(sunBody.material, '2k_sun.jpg');
  m3Helio.add(sunBody, makeGlowSprite(0xffd27a, RS * 3.6, 0.85), makeGlowSprite(0xff9a30, RS * 7.2, 0.3, softGlowTexture));
  m3CosmosParts.spinners.push({ obj: sunBody, speed: 0.05 });
  // światło od Słońca (dzień i noc) – punktowe, więc każda planeta jest oświetlona ze swojej strony
  const light = new THREE.PointLight(0xfff2dd, MODE3_SUN_LIGHT, 0, 0);
  m3Helio.add(light);
  m3CosmosParts.light = light;
  // orbita Twojej planety: jaśniejsza linia, wygaszona przy samej planecie (żeby nie wychodziła z ziemi)
  {
    const N = 720, pos = [], col = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N * Math.PI * 2;
      pos.push(Math.cos(t) * A, 0, Math.sin(t) * A);
      const ang = Math.min(t, Math.PI * 2 - t);              // odległość kątowa od Twojej planety (wierzchołek 0)
      const k = 0.55 * THREE.MathUtils.smoothstep(ang, 0.06, 0.25);
      col.push(0.5 * k, 0.7 * k, 1 * k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m3Helio.add(line);
    m3CosmosParts.ourOrbit = line;
  }
  // inne planety (z kontynentami, w tym jedna z pierścieniem i jedna z księżycem); okresy jak w prawie Keplera
  const planets = [
    { a: 230, r: 5, palette: 'desert' },
    { a: 680, r: 9, palette: 'green', moon: true },
    { a: 980, r: 7, palette: 'ice' },
    { a: 1400, r: 14, palette: 'earth', ring: true },
  ];
  planets.forEach((pd, i) => {
    const pl = makeProceduralPlanet(pd.r, 'mini' + i, pd.palette, 24, 0.08);
    pl.group.rotation.z = 0.4;
    m3Helio.add(pl.group);
    if (pd.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(pd.r * 1.4, pd.r * 2.1, 64), new THREE.MeshStandardMaterial({ color: 0xd8c8a8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
      ring.rotation.x = -Math.PI / 2;
      pl.group.add(ring);
    }
    if (pd.moon) {
      const moonPivot = new THREE.Group();
      pl.group.add(moonPivot);
      const moon = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ map: placeholderTexture(MOONS.earth[0]), roughness: 0.9 }));
      moon.scale.setScalar(pd.r * 0.27);
      moon.position.x = pd.r * 2.2;
      moonPivot.add(moon);
      m3CosmosParts.spinners.push({ obj: moonPivot, speed: 0.3 });
    }
    m3Helio.add(makeCircleLineXZ(pd.a, 256, 0xffffff, 0.1));
    m3CosmosParts.others.push({ obj: pl.group, a: pd.a, phi0: i * 1.9 + 0.6, period: MODE3_YEAR_S * Math.pow(pd.a / A, 1.5) });
    m3CosmosParts.spinners.push({ obj: pl.group, speed: 0.25 + i * 0.05 });
  });
}

function updateMode3Extras(dt) {
  m3Clouds.rotation.y += MODE3_CLOUD_SPEED_DEG_S * DEG * dt;
  if (!MODE3_MINI_COSMOS) return;
  const C = m3CosmosParts, A = MODE3_ORBIT_RADIUS_M;
  C.t += dt;
  const ph = C.phi0 + Math.PI * 2 * C.t / MODE3_YEAR_S;    // Twoja planeta na orbicie
  m3Helio.position.set(-Math.cos(ph) * A, 0, -Math.sin(ph) * A);
  C.ourOrbit.rotation.y = -ph;                              // wygaszony fragment orbity zawsze przy Twojej planecie
  for (const o of C.others) {
    const p = o.phi0 + Math.PI * 2 * C.t / o.period;
    o.obj.position.set(Math.cos(p) * o.a, 0, Math.sin(p) * o.a);
  }
  for (const o of C.spinners) o.obj.rotation.y += o.speed * dt;
}

// gałka/klawisze: powiększenie planety wokół jej środka
function setM3Zoom(s) {
  m3Planet.scale.setScalar(THREE.MathUtils.clamp(s, MODE3_SCALE_MIN, MODE3_SCALE_MAX));
}
// obrót planety (q – obrót w świecie) wokół jej środka; orbita się nie zmienia
function rotateM3Planet(q) {
  // planeta w świecie = m3View * m3True, więc nowe m3True = m3View⁻¹ · q · m3View · m3True
  _gq.copy(m3View).invert().multiply(q).multiply(m3View);
  m3True.premultiply(_gq).normalize();
  m3Planet.quaternion.multiplyQuaternions(m3View, m3True);
}
// co klatkę: doba planety (gdy jej nie trzymasz), układ słoneczny wokół miejsca, w którym "lecisz" razem z planetą
function updateM3Frame(dt) {
  if (state.m3Ride) { if (MODE3_PLANET_SPIN_DEG_S) m3True.multiply(_gq.setFromAxisAngle(UP, MODE3_PLANET_SPIN_DEG_S * DEG * dt)); return; }   // lot rakietą ustawia widok sam
  const held = grabs.has(m3Planet);
  if (held) m3True.copy(m3View).invert().multiply(m3Planet.quaternion);   // obrót z ręki
  else if (MODE3_PLANET_SPIN_DEG_S) m3True.multiply(_gq.setFromAxisAngle(UP, MODE3_PLANET_SPIN_DEG_S * DEG * dt));
  if (state.follow) updateFollow(dt);
  else if (!held) m3Planet.quaternion.multiplyQuaternions(m3View, m3True);
  m3Planet.updateMatrixWorld(true);
  m3Cosmos.position.copy(m3Base.center);
  m3Cosmos.quaternion.multiplyQuaternions(m3View, m3Base.cosmosQ);
}

// Nowa czynność ludzika (z animacją)
function startBehavior(P, action, duration) {
  if (action === 'social') {                         // znajdź kogoś w pobliżu (także już rozmawiającą grupkę)
    let best = null, bestA = MODE3_SOCIAL_RANGE_RAD;
    for (const Q of people) {
      if (Q === P || !['walk', 'idle', 'talk', 'approach'].includes(Q.action)) continue;
      const a = P.p.angleTo(Q.p);
      if (a < bestA) { bestA = a; best = Q; }
    }
    if (!best) { action = 'walk'; duration = 4; }
    else {
      P.target = best;
      action = 'approach'; duration = 14;
      if (best.action === 'walk' || best.action === 'idle') { best.target = P; best.action = 'approach'; best.actionT = 14; best.model && best.model.play(PERSON_ANIMATION); }
    }
  }
  if (action === 'talk' && P.target && P.target.action === 'approach' && P.target.target === P) {
    P.target.action = 'talk'; P.target.actionT = duration; P.target.model && P.target.model.play(PERSON_IDLE_ANIMATION);
  }
  P.action = action;
  P.actionT = duration;
  if (!P.model) return;
  P.model.play(action === 'run' ? PERSON_RUN_ANIMATION : (action === 'walk' || action === 'approach') ? PERSON_ANIMATION : PERSON_IDLE_ANIMATION);
}
// Obróć ludzika (płynnie) w stronę punktu na planecie
function faceToward(P, targetDir, k) {
  const g = _v4.copy(targetDir).addScaledVector(P.p, -targetDir.dot(P.p));
  if (g.lengthSq() < 1e-8) return;
  P.f.lerp(g.normalize(), Math.min(1, k)).addScaledVector(P.p, -P.f.dot(P.p)).normalize();
}
// Kierunek do Twoich oczu w układzie planety (ludziki machają w Twoją stronę)
const _eyeLocal = new THREE.Vector3();
function eyeOnPlanet() {
  return _eyeLocal.copy(eyePos).applyMatrix4(_m3.copy(m3Planet.matrixWorld).invert()).normalize();
}

const _right = new THREE.Vector3();
const _ahead = new THREE.Vector3();
function updatePeople(dt) {
  const H = MODE3_PERSON_HEIGHT_M / PERSON_UNITS;
  _scale.setScalar(H);
  for (let i = 0; i < N3; i++) {
    const P = people[i];
    P.time += dt;
    // co jakiś czas zmiana czynności
    P.actionT -= dt;
    if (P.actionT <= 0) { P.watch = null; startBehavior(P, ...pickBehavior()); }
    // cel ze scenariusza: idź/biegnij do punktu, potem schowaj się w domu albo stań i patrz
    if (P.hidden) { if (P.action !== 'idle') startBehavior(P, 'idle', 5); P.actionT = Math.max(P.actionT, 1); }
    else if (P.goal) {
      P.goalT -= dt;
      faceToward(P, P.goal, dt * 6);
      const act = P.goalRun ? 'run' : 'walk';
      if (P.action !== act) startBehavior(P, act, 30);
      if (P.p.angleTo(P.goal) < (P.goalThen === 'hide' ? 0.018 : 0.025) || P.goalT <= 0) {
        const then = P.goalThen;
        P.goal = null;
        if (then === 'hide') P.hidden = true;
        else startBehavior(P, 'idle', then === 'watch' ? 12 : 2 + Math.random() * 3);
      }
    }
    if (P.watch && !P.goal && P.action === 'idle') faceToward(P, P.watch, dt * 3);
    if (P.action === 'approach') {                   // idzie do rozmówcy; na miejscu – rozmowa
      const T = P.target;
      if (!T || T.action === 'walk' || T.action === 'run') startBehavior(P, 'walk', 4);
      else if (P.p.angleTo(T.p) < MODE3_PERSON_HEIGHT_M * 2.4 / M3_R) startBehavior(P, 'talk', 5 + Math.random() * 5);
      else faceToward(P, T.p, dt * 5);
    }
    if (P.action === 'talk' && P.target) faceToward(P, P.target.p, dt * 3);
    if (P.action === 'wave') faceToward(P, eyeOnPlanet(), dt * 3);
    const speedK = P.action === 'run' ? MODE3_RUN_SPEED_FACTOR : (P.action === 'walk' || P.action === 'approach') ? 1 : 0;
    const v = P.speed * speedK * (P.hidden ? 0 : m3W.speedK || 1);
    for (const k of ['wave', 'squat', 'talk']) {     // płynne narastanie/zanikanie ruchów
      const goal = P.action === k ? 1 : 0;
      P.ov[k] += THREE.MathUtils.clamp(goal - P.ov[k], -dt * 2.5, dt * 2.5);
    }
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
      if (P.avoid <= 0 && !P.goal && (m3Surface.query(_ahead).water || isObstacle(_ahead))) { P.avoid = 0.8; P.turn = (Math.random() < 0.5 ? -1 : 1) * 3; }
      // daleko od domu? -> zawróć w stronę swojej wioski
      if (P.home && P.avoid <= 0 && P.action === 'walk' && P.p.angleTo(P.home) > MODE3_VILLAGE_RADIUS_RAD * 2.2) faceToward(P, P.home, 0.5);
    }
    if (P.avoid > 0) P.avoid -= dt;
    else P.turn = THREE.MathUtils.clamp(P.turn + (Math.random() - 0.5) * MODE3_TURN_NOISE * dt * 4, -1.2, 1.2) * (1 - 0.5 * dt);
    const wander = P.action === 'walk' || P.action === 'run' ? 1 : P.action === 'idle' ? 0.3 : 0;
    _q1.setFromAxisAngle(P.p, P.turn * dt * wander);
    P.f.applyQuaternion(_q1);
    P.f.addScaledVector(P.p, -P.f.dot(P.p)).normalize();
    P.phase += v * dt / (MODE3_PERSON_HEIGHT_M * 0.35);
    // wysokość gruntu (góry, doliny) – płynnie
    P.r += (m3Surface.query(P.p).r - P.r) * Math.min(1, dt * 12);

    _right.crossVectors(P.p, P.f);                       // x = prawo, y = góra (od środka planety), z = przód
    _v1.copy(P.p).multiplyScalar(P.r);
    if (P.model) {
      P.model.root.visible = !P.hidden;
      P.model.root.matrix.makeBasis(_right, P.p, P.f).setPosition(_v1);
      P.model.root.matrixWorldNeedsUpdate = true;
      P.model.mixer.update(dt * (speedK === 1 ? P.speed / MODE3_PERSON_SPEED_MPS : 1));
      applyPersonOverlay(P);
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
}

// =====================================================================
//  Tryb 3: TEMPERATURA PLANETY I SCENARIUSZE
//   Temperatura: −30°C (epoka lodowa), 15°C (jak Ziemia), 40°C, 80°C, 300°C (jak Wenus).
//   Scenariusze (każdy ok. 20 s): zderzenie płyt tektonicznych i trzęsienie ziemi, erupcja wulkanu,
//   tornado, tsunami, uderzenie meteorytu. Zmiany rzeźby (góry, krater, zastygła lawa) zostają do "Reset".
// =====================================================================
const M3_TEMPS = [-30, 15, 40, 80, 300];
const M3_EVENTS = ['quake', 'volcano', 'tornado', 'tsunami', 'meteor', 'rocket', 'astronaut', 'greenhouse'];
const M3_TEMP_NOTES = {
  '-30': 'Epoka lodowa (−30°C): oceany zamarzły, ląd pod śniegiem',
  15: '',
  40: 'Upał (40°C): susza, trawa żółknie, topnieją lodowce',
  80: 'Gorąco (80°C): oceany parują, rośliny usychają – ludzie schowali się w domach',
  300: 'Piekło (300°C, Wenus ma ok. 460°C): woda wyparowała, skały się rozgrzewają',
};
const m3W = { ready: false, T: 15, trans: null, event: null, note: '', tempNote: '', shake: new THREE.Group(), peopleHidden: false, dry: false };

// przesunięcie gruntu (w górę +, w dół −) ze scenariuszy, w metrach przy skali 1
function m3DynR(d) {
  let r = 0;
  for (const f of m3DynFields) if (f.k > 0) r += f.k * f.fn(d);
  return r;
}

function m3WorldInit() {
  if (m3W.ready) return true;
  if (!m3Proc) return false;
  const land = m3Proc.group.children[0], water = m3Proc.group.children[1];
  const geo = land.geometry, pos = geo.attributes.position, n = pos.count;
  Object.assign(m3W, { land, water, geo, n, index: geo.index.array });
  m3W.basePos = Float32Array.from(pos.array);
  m3W.origCol = Float32Array.from(geo.attributes.color.array);
  m3W.baseCol = Float32Array.from(m3W.origCol);              // kolory przy 15°C (zmieniają je góry, lawa, krater)
  m3W.dirs = new Float32Array(n * 3);
  m3W.r0 = new Float32Array(n);
  m3W.vh0 = new Float32Array(n);
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i);
    m3W.r0[i] = d.length();
    d.normalize();
    m3W.dirs[i * 3] = d.x; m3W.dirs[i * 3 + 1] = d.y; m3W.dirs[i * 3 + 2] = d.z;
    m3W.vh0[i] = m3Proc.height(d);
  }
  m3W.vh = Float32Array.from(m3W.vh0);
  m3W.flood = new Float32Array(n);
  if (water) {
    m3W.waterBase = { color: water.material.color.clone(), opacity: water.material.opacity, rough: water.material.roughness };
    m3W.waterPos0 = Float32Array.from(water.geometry.attributes.position.array);
  }
  m3W.waterGoal = { color: m3W.waterBase.color.clone(), opacity: m3W.waterBase.opacity, rough: m3W.waterBase.rough, scale: 1 };
  if (m3Trees.trunks) m3W.treeMat0 = { t: Float32Array.from(m3Trees.trunks.instanceMatrix.array), c: Float32Array.from(m3Trees.crowns.instanceMatrix.array) };
  m3W.cloudMat = m3Clouds.children[0].material;
  m3W.cloudMat.transparent = true;
  m3W.cloudGoal = 1;
  m3W.speedK = 1;
  // grupa, którą trzęsiemy przy trzęsieniu ziemi: wszystko, co jest na planecie
  const kids = [...m3Planet.children];
  m3Planet.add(m3W.shake);
  for (const c of kids) m3W.shake.add(c);
  // para wodna nad oceanami (80°C)
  m3W.steam = [];
  const rnd = seededRandom('steam');
  for (let k = 0; k < 40; k++) {
    let dd;
    for (let t = 0; t < 200; t++) { dd = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(); if (m3Proc.height(dd) < -0.1) break; }
    const sp = makeGlowSprite(0xf4f8ff, 0.03, 0, softGlowTexture);
    sp.material.blending = THREE.NormalBlending;
    sp.visible = false;
    sp.userData = { d: dd, t: rnd() };
    m3W.shake.add(sp);
    m3W.steam.push(sp);
  }
  m3W.ready = true;
  return true;
}

// ---------- kolory zależne od temperatury
const _tc = new THREE.Color(), _tc2 = new THREE.Color();
function m3TempColor(i, T, out) {
  const b = m3W.baseCol, h = m3W.vh[i];
  _tc.setRGB(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
  const snow = _tc.r > 0.75 && _tc.g > 0.75 && _tc.b > 0.75;
  if (T <= -10) { if (h >= 0) _tc.lerp(_tc2.setHex(0xeef4fa), 0.85); }
  else if (T >= 300) _tc.lerp(_tc2.setHex(h < -0.15 ? 0x7a2a12 : 0x3a2a24), 0.85);
  else if (T >= 80) {
    if (h < 0) _tc.lerp(_tc2.setHex(0xd8d0bc), h > -0.3 ? 0.85 : 0.4);     // odsłonięte dno – sól i piasek
    else _tc.lerp(_tc2.setHex(snow ? 0x8a7f72 : 0xa8784a), 0.75);
  } else if (T >= 40) { if (h >= 0) _tc.lerp(_tc2.setHex(snow ? 0x8a7f72 : 0xc8b060), snow ? 0.6 : 0.45); }
  const f = m3W.flood[i];
  if (f > 0) _tc.lerp(_tc2.setHex(0x3a6aa8), 0.65 * f);                  // zalane przez tsunami
  out[i * 3] = _tc.r; out[i * 3 + 1] = _tc.g; out[i * 3 + 2] = _tc.b;
}
function m3ApplyColors(list = null) {
  const col = m3W.geo.attributes.color.array;
  if (list) for (const i of list) m3TempColor(i, m3W.T, col);
  else for (let i = 0; i < m3W.n; i++) m3TempColor(i, m3W.T, col);
  m3W.geo.attributes.color.needsUpdate = true;
}

function setM3Temperature(T) {
  if (!m3WorldInit()) return;
  m3W.T = T;
  const col = m3W.geo.attributes.color.array, to = new Float32Array(col.length);
  for (let i = 0; i < m3W.n; i++) m3TempColor(i, T, to);
  m3W.trans = { from: Float32Array.from(col), to, t: 0 };
  const wb = m3W.waterBase;
  m3W.waterGoal = T <= -10 ? { color: new THREE.Color(0xdcecf8), opacity: 0.98, rough: 0.55, scale: 1 }
    : T >= 300 ? { color: new THREE.Color(0x6a3a20), opacity: 0, rough: 0.9, scale: 0.97 }
    : T >= 80 ? { color: new THREE.Color(0x3a8a80), opacity: 0.85, rough: 0.2, scale: 0.99 }
    : { color: wb.color.clone(), opacity: wb.opacity, rough: wb.rough, scale: 1 };
  m3Flags.dry = T >= 300;
  // ludzie: przy 80°C i więcej chowają się w domach, w mrozie trzymają się wiosek, w upale zwalniają
  const prevT = m3W.prevT === undefined ? 15 : m3W.prevT;
  m3W.prevT = T;
  if (T >= 80) { for (const P of people) if (!P.hidden && !m3Shelter(P, 3)) P.hidden = true; }
  else {
    if (prevT >= 80) m3UnhideAll();
    if (T <= -10) for (const P of people) if (P.home) m3Go(P, P.home, 'idle');
  }
  m3W.speedK = T <= -10 ? 0.6 : T >= 40 ? 0.8 : 1;
  // chmury: w upale ich ubywa, przy 80°C i 300°C znikają (woda wyparowała); burza tylko w umiarkowanym klimacie
  m3W.cloudGoal = { '-30': 0.85, 15: 1, 40: 0.5, 80: 0, 300: 0 }[T];
  if (m3Extras.storm) m3Extras.storm.storm.visible = T === 15 || T === 40;
  m3SetAtmosphere(T);
  if (m3Trees.crowns) {
    m3Trees.trunks.visible = m3Trees.crowns.visible = T < 300;
    const cm = m3Trees.crowns.material;
    cm.color.setHex(T >= 80 ? 0x8a6040 : T >= 40 ? 0xd8c080 : 0xffffff);
    cm.emissive.setHex(T <= -10 ? 0x8a96a8 : 0x000000);
  }
  m3W.cloudMat.color.setHex(T >= 300 ? 0x9a7a5a : 0xffffff);
  m3W.cloudMat.emissive.setHex(T >= 300 ? 0x2a1a0a : 0x3a4250);
  m3W.land.material.emissive.setHex(T >= 300 ? 0x2a0800 : 0x000000);
  m3W.tempNote = M3_TEMP_NOTES[T] || '';
  m3W.note = m3W.event ? m3W.note : m3W.tempNote;
  drawMenu();
}

// ---------- pomocnicze: punkty na powierzchni, obszary siatki, normalne
const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3(), _w3 = new THREE.Vector3();
function m3SurfR(d) { return m3Proc.radiusAt(Math.max(m3Proc.height(d), 0)) + m3DynR(d); }
function m3Tangents(d) {
  const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
  return [t1, new THREE.Vector3().crossVectors(d, t1).normalize()];
}
function m3RandomDir(ok, tries = 3000) {
  for (let i = 0; i < tries; i++) {
    const d = new THREE.Vector3(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.75, Math.random() * 2 - 1).normalize();
    if (ok(d)) return d;
  }
  return null;
}
// wierzchołki w promieniu kątowym + trójkąty, które ich dotykają
function m3Region(c, ang) {
  const cosA = Math.cos(ang), D = m3W.dirs, verts = [], flag = new Uint8Array(m3W.n);
  for (let i = 0; i < m3W.n; i++) if (D[i * 3] * c.x + D[i * 3 + 1] * c.y + D[i * 3 + 2] * c.z > cosA) { verts.push(i); flag[i] = 1; }
  const idx = m3W.index, tris = [];
  for (let t = 0; t < idx.length; t += 3) if (flag[idx[t]] || flag[idx[t + 1]] || flag[idx[t + 2]]) tris.push(t);
  return { verts, flag, tris };
}
function m3RegionGeometry(reg) {
  const p = m3W.geo.attributes.position.array, D = m3W.dirs;
  for (const i of reg.verts) {
    _w1.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
    const r = m3W.r0[i] + m3DynR(_w1);
    p[i * 3] = _w1.x * r; p[i * 3 + 1] = _w1.y * r; p[i * 3 + 2] = _w1.z * r;
  }
  // normalne tylko w tym obszarze (całość byłaby za wolna na każdą klatkę)
  const nrm = m3W.geo.attributes.normal.array, idx = m3W.index;
  for (const i of reg.verts) nrm[i * 3] = nrm[i * 3 + 1] = nrm[i * 3 + 2] = 0;
  for (const t of reg.tris) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    _w1.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    _w2.set(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
    _w3.crossVectors(_w1, _w2);
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) if (reg.flag[v]) { nrm[v * 3] += _w3.x; nrm[v * 3 + 1] += _w3.y; nrm[v * 3 + 2] += _w3.z; }
  }
  for (const i of reg.verts) {
    _w1.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]).normalize();
    nrm[i * 3] = _w1.x; nrm[i * 3 + 1] = _w1.y; nrm[i * 3 + 2] = _w1.z;
  }
  m3W.geo.attributes.position.needsUpdate = true;
  m3W.geo.attributes.normal.needsUpdate = true;
}
// okrąg na powierzchni (fala sejsmiczna, fala uderzeniowa, piana tsunami)
function m3Ring(color, opacity = 0.9) {
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, () => new THREE.Vector3())),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}
function m3SetRing(line, c, ang, lift = 0.003, fixedR = 0) {
  const [t1, t2] = m3Tangents(c), p = line.geometry.attributes.position, n = p.count;
  for (let k = 0; k < n; k++) {
    const th = k / n * Math.PI * 2;
    _w1.copy(c).multiplyScalar(Math.cos(ang)).addScaledVector(t1, Math.cos(th) * Math.sin(ang)).addScaledVector(t2, Math.sin(th) * Math.sin(ang)).normalize();
    _w1.multiplyScalar((fixedR || m3SurfR(_w1)) + lift);
    p.setXYZ(k, _w1.x, _w1.y, _w1.z);
  }
  p.needsUpdate = true;
}
// ---------- "namiastka inteligencji": ludziki reagują na to, co się dzieje
// m3Go: idź (run = biegnij) do punktu, a potem: 'hide' – schowaj się w domu, 'watch' – stań i patrz na watch, 'idle'
function m3Go(P, dir, then = 'idle', run = false, watch = null) {
  P.goal = dir.clone().normalize(); P.goalThen = then; P.goalRun = run; P.goalT = 25;
  P.watch = watch ? watch.clone() : null;
  startBehavior(P, run ? 'run' : 'walk', 30);
}
function m3Watch(P, dir, dur = 8) { if (P.hidden) return; P.goal = null; P.watch = dir.clone(); startBehavior(P, 'idle', dur); }
// punkt dalej od c (o kąt ang) – ucieczka
function m3AwayPoint(P, c, ang) {
  const axis = new THREE.Vector3().crossVectors(c, P.p);
  if (axis.lengthSq() < 1e-8) axis.copy(m3Tangents(P.p)[0]);
  return P.p.clone().applyAxisAngle(axis.normalize(), ang);
}
function m3NearestHouse(p) {
  let best = null, ba = Infinity;
  for (const h of m3Extras.houses) { const a = p.angleTo(h.d); if (a < ba) { ba = a; best = h; } }
  return best ? { d: best.d, a: ba } : null;
}
function m3Shelter(P, maxAng = 0.5) {
  if (P.hidden) return true;
  const h = m3NearestHouse(P.p);
  if (h && h.a < maxAng) { m3Go(P, h.d, 'hide', true); return true; }
  return false;
}
// najwyżej położony punkt w okolicy (ucieczka przed tsunami)
function m3Uphill(p, reach = 0.12) {
  let best = p, bh = -9;
  const [t1, t2] = m3Tangents(p);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const d = p.clone().addScaledVector(t1, Math.cos(a) * reach).addScaledVector(t2, Math.sin(a) * reach).normalize();
    const h = m3Proc.height(d);
    if (h > bh) { bh = h; best = d; }
  }
  return best;
}
function m3UnhideAll() {
  for (const P of people) {
    if (P.hidden) { P.hidden = false; startBehavior(P, 'walk', 4); }
    P.goal = null; P.watch = null;
  }
}
function m3PeopleNear(c, ang) { return people.filter(P => !P.hidden && P.p.angleTo(c) < ang); }

// ludzie w okolicy: przewracają się ("fall") albo uciekają ("run") od punktu c
function m3Panic(c, ang, how) {
  for (const P of people) {
    if (P.p.angleTo(c) > ang) continue;
    if (how === 'fall') { startBehavior(P, 'squat', 1.5 + Math.random()); continue; }
    startBehavior(P, 'run', 4 + Math.random() * 3);
    faceToward(P, _w1.copy(P.p).multiplyScalar(2).sub(c).normalize(), 1);
  }
}
// drzewa w okolicy: wyrwane / zasypane / spalone
function m3KillTrees(test) {
  if (!m3Trees.trunks) return;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let any = false;
  m3Trees.dirs.forEach((d, i) => {
    if (i >= m3Trees.trunks.count || !test(d)) return;
    m3Trees.trunks.setMatrixAt(i, zero); m3Trees.crowns.setMatrixAt(i, zero); any = true;
  });
  if (any) { m3Trees.trunks.instanceMatrix.needsUpdate = true; m3Trees.crowns.instanceMatrix.needsUpdate = true; }
}
function m3Puff(color, size, opacity, additive = false) {
  const sp = makeGlowSprite(color, size, opacity, softGlowTexture);
  if (!additive) sp.material.blending = THREE.NormalBlending;
  return sp;
}
// cząstki scenariusza: lot, grawitacja w stronę środka planety, opór, rośnięcie, zanikanie
function m3AddPart(ev, sprite, pos, vel, life, o = {}) {
  sprite.position.copy(pos);
  ev.objs.add(sprite);
  ev.parts.push({ s: sprite, v: vel.clone(), life, age: 0, size0: sprite.scale.x, op0: sprite.material.opacity, ...o });
}
function m3UpdateParts(ev, dt) {
  for (let i = ev.parts.length - 1; i >= 0; i--) {
    const q = ev.parts[i];
    q.age += dt;
    let dead = q.age >= q.life || (q.hit && q.s.position.length() < m3SurfR(_w1.copy(q.s.position).normalize()));
    if (!dead && q.fn && q.fn(q) === false) dead = true;
    if (dead) { if (q.onDie && q.age < q.life) q.onDie(q); q.s.removeFromParent(); q.s.material.dispose(); ev.parts.splice(i, 1); continue; }
    if (q.g) q.v.addScaledVector(_w1.copy(q.s.position).normalize(), -q.g * dt);
    if (q.drag) q.v.multiplyScalar(Math.exp(-q.drag * dt));
    q.s.position.addScaledVector(q.v, dt);
    const f = q.age / q.life;
    q.s.scale.setScalar(q.size0 * (1 + (q.grow || 0) * f));
    q.s.material.opacity = q.op0 * (q.fade === false ? 1 : Math.min(1, f * 6, (1 - f) * 2.5));
  }
}
// pole "rzeźby" scenariusza (k rośnie od 0 do 1)
function m3AddField(fn) { const f = { fn, k: 0 }; m3DynFields.push(f); return f; }

// ---------- scenariusze
const M3_SCENARIOS = {
  // Zderzenie płyt tektonicznych: rosną góry, potem trzęsienie ziemi
  quake: {
    dur: 22,
    start(ev) {
      const vill = m3Features.villages;
      const c = m3RandomDir(d => { const h = m3Proc.height(d); return h > 0.04 && h < 0.18 && vill.every(v => d.angleTo(v) > 0.3) && vill.some(v => d.angleTo(v) < 0.65) && (!m3Features.volcano || d.angleTo(m3Features.volcano) > 0.45); })
        || m3RandomDir(d => m3Proc.height(d) > 0.03);
      const [t1, t2] = m3Tangents(c), a = Math.random() * Math.PI;
      const t = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      const nrm = new THREE.Vector3().crossVectors(c, t).normalize();
      const L = 0.55, W = 0.05, A = 0.026;
      ev.c = c; ev.t = t; ev.nrm = nrm;
      ev.field = m3AddField(d => {
        const s = Math.atan2(d.dot(t), d.dot(c));
        if (Math.abs(s) > L || d.dot(c) < 0) return 0;
        const ds = Math.asin(THREE.MathUtils.clamp(d.dot(nrm), -1, 1));
        return A * Math.exp(-((ds / W) ** 2)) * Math.cos(s / L * Math.PI / 2) * (0.75 + 0.25 * Math.sin(s * 23 + 1.3));
      });
      ev.reg = m3Region(c, L + 0.1);
      // granica płyt (świecąca linia) i strzałki ruchu płyt
      const pts = [];
      for (let k = 0; k <= 80; k++) { const s = -L + 2 * L * k / 80; pts.push(new THREE.Vector3()); pts[k].userData = s; }
      ev.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0, depthWrite: false }));
      ev.line.frustumCulled = false;
      ev.objs.add(ev.line);
      ev.arrows = [];
      for (const side of [1, -1]) for (const s of [-0.25, 0.25]) {
        const ar = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.024, 8).rotateX(Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: side > 0 ? 0xffa040 : 0x60c0ff, transparent: true, opacity: 0 }));
        ar.userData = { side, s };
        ev.objs.add(ar); ev.arrows.push(ar);
      }
      ev.rings = [0, 1, 2, 3].map(() => { const r = m3Ring(0xffc060); r.visible = false; ev.objs.add(r); return r; });
      ev.flash = makeGlowSprite(0xffd080, 0.06, 0);
      ev.flash.position.copy(c).multiplyScalar(m3SurfR(c) + 0.004);
      ev.objs.add(ev.flash);
    },
    update(ev, dt) {
      const T = ev.time, c = ev.c, t = ev.t, nrm = ev.nrm;
      const vis = Math.min(1, T / 1.5, (ev.dur - T) / 2);
      // linia granicy po powierzchni
      const p = ev.line.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const s = -0.55 + 1.1 * k / (p.count - 1);
        _w1.copy(c).multiplyScalar(Math.cos(s)).addScaledVector(t, Math.sin(s)).normalize();
        _w1.multiplyScalar(m3SurfR(_w1) + 0.003);
        p.setXYZ(k, _w1.x, _w1.y, _w1.z);
      }
      p.needsUpdate = true;
      ev.line.material.opacity = 0.9 * vis * (T < 12 ? 1 : 0.5);
      // strzałki płyt suną do granicy
      const move = THREE.MathUtils.clamp(T / 12, 0, 1);
      for (const ar of ev.arrows) {
        const { side, s } = ar.userData, ds = side * (0.14 - 0.08 * move);
        _w1.copy(c).multiplyScalar(Math.cos(s)).addScaledVector(t, Math.sin(s)).normalize();
        _w2.copy(_w1).multiplyScalar(Math.cos(ds)).addScaledVector(nrm, Math.sin(ds)).normalize();
        ar.position.copy(_w2).multiplyScalar(m3SurfR(_w2) + 0.012);
        _w3.copy(nrm).multiplyScalar(-side).addScaledVector(_w2, -_w2.dot(nrm) * -side).normalize();
        ar.lookAt(_w3.multiplyScalar(0.1).add(ar.position).applyMatrix4(ar.parent.matrixWorld));
        ar.material.opacity = vis * (T < 12 ? 1 : 0.4);
      }
      // góry rosną (miliony lat w kilka sekund)
      if (T > 3 && T < 12.5) {
        ev.field.k = smooth(THREE.MathUtils.clamp((T - 3) / 9, 0, 1));
        m3RegionGeometry(ev.reg);
        const D = m3W.dirs, oc = m3W.origCol;
        for (const i of ev.reg.verts) {
          _w1.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
          const up = ev.field.k * ev.field.fn(_w1);
          m3W.vh[i] = m3W.vh0[i] + up / (M3_R * MODE3_MOUNTAIN_HEIGHT);
          _tc.setRGB(oc[i * 3], oc[i * 3 + 1], oc[i * 3 + 2]);
          if (up > 0.004) _tc.lerp(_tc2.setHex(0x8a7f72), Math.min(1, (up - 0.004) / 0.008));
          if (up > 0.017) _tc.lerp(_tc2.setHex(0xf4f6fa), Math.min(1, (up - 0.017) / 0.004));
          m3W.baseCol[i * 3] = _tc.r; m3W.baseCol[i * 3 + 1] = _tc.g; m3W.baseCol[i * 3 + 2] = _tc.b;
        }
        m3ApplyColors(ev.reg.verts);
        if (!ev.treesGone) { ev.treesGone = true; m3KillTrees(d => Math.abs(Math.asin(THREE.MathUtils.clamp(d.dot(nrm), -1, 1))) < 0.09 && Math.abs(Math.atan2(d.dot(t), d.dot(c))) < 0.6 && d.dot(c) > 0); }
      }
      // trzęsienie ziemi
      if (T >= 12) {
        if (!ev.fell) { ev.fell = true; m3Panic(c, 0.9, 'fall'); }
        // po wstrząsie: uciekają z dala od domów, na otwartą przestrzeń, i patrzą w stronę epicentrum
        if (!ev.ran && T > 14.5) { ev.ran = true; for (const P of m3PeopleNear(c, 0.9)) m3Go(P, m3AwayPoint(P, c, 0.12), 'watch', true, c); }
        const q = T - 12;
        ev.shake = 0.0035 * Math.exp(-q / 2.5);
        ev.rings.forEach((r, k) => {
          const a = (q - k * 0.7) * 0.22;
          r.visible = a > 0.005 && a < 1.2;
          if (r.visible) { m3SetRing(r, c, a); r.material.opacity = 0.9 * (1 - a / 1.2); }
        });
        ev.flash.material.opacity = Math.max(0, 0.9 - q * 0.6);
      }
      return T < 3 ? 'Dwie płyty tektoniczne napierają na siebie (naprawdę ok. 2–5 cm na rok)'
        : T < 12 ? 'Miliony lat w kilka sekund: płyty się zgniatają i wypiętrzają góry (tak powstały Himalaje)'
        : 'Trzęsienie ziemi! Fale sejsmiczne rozchodzą się od epicentrum';
    },
  },

  // Erupcja wulkanu: dym, bomby wulkaniczne, lawa spływa i stygnie
  volcano: {
    dur: 22,
    start(ev) {
      const vd = m3Features.volcano;
      if (!vd) { ev.time = ev.dur; return; }
      ev.c = vd;
      ev.top = m3Extras.volcanoTop.clone();
      ev.reg = m3Region(vd, 0.2);
      ev.noise = makeNoise3('lava' + Math.random());
      ev.glow = makeGlowSprite(0xff7a20, 0.08, 0);
      ev.glow.position.copy(ev.top);
      ev.objs.add(ev.glow);
      ev.lava = new Float32Array(m3W.n);              // 1 = świeża lawa, potem stygnie
    },
    update(ev, dt) {
      const T = ev.time, up = ev.c;
      if (T < 2) ev.shake = 0.0012;
      else ev.shake = T < 14 ? 0.0006 : 0;
      const [t1, t2] = m3Tangents(up);
      const erupt = T > 2 && T < 14;
      if (!ev.looked) { ev.looked = true; for (const P of m3PeopleNear(up, 0.9)) m3Watch(P, up, 3); }   // co to za huk?
      if (erupt && !ev.fled) { ev.fled = true; for (const P of m3PeopleNear(up, 0.6)) m3Go(P, m3AwayPoint(P, up, 0.3), 'watch', true, up); }
      ev.glow.material.opacity = erupt ? 0.7 + 0.3 * Math.sin(T * 9) : Math.max(0, ev.glow.material.opacity - dt);
      // popiół: ciemne kłęby wysoko w niebo, rozwiewane przez wiatr
      ev.ashT = (ev.ashT || 0) - dt;
      if ((T < 2 || erupt || T < 16) && ev.ashT <= 0) {
        ev.ashT = erupt ? 0.06 : 0.25;
        const dir = _w1.copy(up).multiplyScalar(0.05 + Math.random() * 0.03).addScaledVector(t1, (Math.random() - 0.5) * 0.012 + 0.006).addScaledVector(t2, (Math.random() - 0.5) * 0.012);
        const g = 0.25 + Math.random() * 0.15;
        m3AddPart(ev, m3Puff(new THREE.Color(g * 0.9, g * 0.85, g * 0.8).getHex(), 0.02 + Math.random() * 0.015, 0.75), ev.top, dir, 5 + Math.random() * 3, { drag: 0.35, grow: 4 });
      }
      // bomby wulkaniczne: rozżarzone kawałki lawy lecące po łuku
      ev.bombT = (ev.bombT || 0) - dt;
      if (erupt && ev.bombT <= 0) {
        ev.bombT = 0.05;
        const a = Math.random() * Math.PI * 2, sp = 0.03 + Math.random() * 0.05;
        const v = _w1.copy(up).multiplyScalar(0.12 + Math.random() * 0.08).addScaledVector(t1, Math.cos(a) * sp).addScaledVector(t2, Math.sin(a) * sp);
        m3AddPart(ev, makeGlowSprite(0xffa040, 0.008 + Math.random() * 0.006, 1), ev.top, v, 4, { g: 0.22, hit: true, fade: false });
      }
      // lawa spływa po zboczach (front z "jęzorami"), po wybuchu stygnie w czarną skałę
      if (T > 2.5) {
        const front = 0.025 + 0.13 * smooth(THREE.MathUtils.clamp((T - 2.5) / 10, 0, 1));
        const D = m3W.dirs, oc = m3W.origCol, cool = THREE.MathUtils.clamp((T - 14) / 6, 0, 1);
        for (const i of ev.reg.verts) {
          _w1.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
          const ang = _w1.angleTo(up), lim = front * (0.55 + 0.45 * (0.5 + 0.5 * ev.noise(_w1.x * 30, _w1.y * 30, _w1.z * 30, 2)));
          if (ang < lim) ev.lava[i] = 1;
          if (!ev.lava[i]) continue;
          _tc.setHex(0xff5a1a).lerp(_tc2.setHex(0x2a2220), cool);
          if (cool === 0) _tc.multiplyScalar(0.85 + 0.3 * Math.random());
          m3W.baseCol[i * 3] = _tc.r; m3W.baseCol[i * 3 + 1] = _tc.g; m3W.baseCol[i * 3 + 2] = _tc.b;
        }
        m3ApplyColors(ev.reg.verts);
        if (!ev.burnT || T - ev.burnT > 1) { ev.burnT = T; m3KillTrees(d => d.angleTo(up) < front); }
      }
      m3W.land.material.emissive.setHex(T > 2.5 && T < 16 && m3W.T < 300 ? 0x120400 : (m3W.T >= 300 ? 0x2a0800 : 0));
      return T < 2 ? 'Wulkan się budzi: ziemia drży, z krateru bucha dym'
        : T < 14 ? 'Erupcja! Lawa (ok. 1100°C) spływa po zboczach, popiół leci wysoko w niebo'
        : 'Lawa stygnie i zamienia się w czarną skałę – wulkan zbudował nowy ląd';
    },
  },

  // Tornado: wirujący lej przechodzi obok wioski
  tornado: {
    dur: 18,
    start(ev) {
      const v = m3Features.villages[Math.floor(Math.random() * m3Features.villages.length)] || m3RandomDir(d => m3Proc.height(d) > 0.03);
      const [t1, t2] = m3Tangents(v);
      const a = Math.random() * Math.PI * 2;
      const side = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      const fwd = new THREE.Vector3().crossVectors(v, side).normalize();
      // start ~0,2 rad przed wioską, przejście 0,06 rad obok niej
      ev.p0 = v.clone().applyAxisAngle(side, -0.22).applyAxisAngle(fwd, 0.06).normalize();
      ev.axis = side.clone();                              // obrót po wielkim kole
      ev.c = v;
      const [cv, cx] = makeCanvas(64, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
        const k = 0.5 + 0.5 * Math.sin((x / 64) * Math.PI * 6 + y * 0.12);
        cx.fillStyle = `rgba(${180 + k * 60},${175 + k * 55},${170 + k * 50},${0.25 + k * 0.5})`;
        cx.fillRect(x, y, 1, 1);
      }
      const tex = canvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      ev.tex = tex;
      ev.funnel = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.003, 0.08, 32, 8, true).translate(0, 0.04, 0),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.002, 0.075, 24, 4, true).translate(0, 0.0375, 0),
        new THREE.MeshBasicMaterial({ color: 0x6a6460, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8).scale(1, 0.25, 1).translate(0, 0.085, 0),
        new THREE.MeshToonMaterial({ color: 0x3a3e46 }));
      ev.funnel.add(cone, inner, cloud);
      // wirujące śmieci
      ev.debris = [];
      for (let k = 0; k < 40; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.002), new THREE.MeshStandardMaterial({ color: k % 3 ? 0x6b4a2a : 0x4f8a3a }));
        m.userData = { a: Math.random() * 6.3, h: Math.random() * 0.06, w: 4 + Math.random() * 4 };
        ev.funnel.add(m); ev.debris.push(m);
      }
      ev.objs.add(ev.funnel);
    },
    update(ev, dt) {
      const T = ev.time;
      const d = _w1.copy(ev.p0).applyAxisAngle(ev.axis, T * 0.026).normalize();
      const grow = Math.min(1, T / 1.5, (ev.dur - T) / 2);
      ev.funnel.position.copy(d).multiplyScalar(m3SurfR(d));
      ev.funnel.quaternion.setFromUnitVectors(UP, d);
      ev.funnel.scale.set(grow, Math.max(0.01, grow), grow);
      ev.tex.offset.x -= dt * 2.5;
      ev.tex.offset.y -= dt * 0.4;
      for (const m of ev.debris) {
        const u = m.userData;
        u.a += u.w * dt;
        m.position.set(Math.cos(u.a) * (0.006 + u.h * 0.2), u.h, Math.sin(u.a) * (0.006 + u.h * 0.2));
        m.rotation.x += dt * 5; m.rotation.y += dt * 3;
      }
      const here = d.clone();
      m3KillTrees(q => q.angleTo(here) < 0.03 * grow);
      ev.panicT = (ev.panicT || 0) - dt;
      if (ev.panicT <= 0) {
        ev.panicT = 1;
        // blisko domu – chowają się w środku; w polu – uciekają w bok od trąby
        for (const P of m3PeopleNear(here, 0.22)) if (!P.goal && !m3Shelter(P, 0.1)) m3Go(P, m3AwayPoint(P, here, 0.18), 'watch', true, here);
      }
      return 'Tornado: powietrze wiruje z prędkością do ~300 km/h – drzewa są wyrywane, ludzie uciekają';
    },
  },

  // Tsunami: trzęsienie pod oceanem, fala rośnie przy brzegu i zalewa wybrzeże
  tsunami: {
    dur: 20,
    start(ev) {
      const vill = m3Features.villages;
      const c = m3RandomDir(d => m3Proc.height(d) < -0.12 && vill.some(v => d.angleTo(v) > 0.2 && d.angleTo(v) < 0.45))
        || m3RandomDir(d => m3Proc.height(d) < -0.1) || new THREE.Vector3(0, 0, 1);
      ev.c = c;
      const wp = m3W.waterPos0, n = wp.length / 3;
      ev.wAng = new Float32Array(n);
      for (let i = 0; i < n; i++) { _w1.set(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2]).normalize(); ev.wAng[i] = _w1.angleTo(c); }
      ev.coast = [];
      ev.coastAng = [];
      const D = m3W.dirs;
      for (let i = 0; i < m3W.n; i++) {
        if (m3W.vh[i] < 0 || m3W.vh[i] > 0.07) continue;
        _w1.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
        const a = _w1.angleTo(c);
        if (a < 0.75) { ev.coast.push(i); ev.coastAng.push(a); }
      }
      ev.foam = m3Ring(0xffffff, 0.9);
      ev.foam2 = m3Ring(0xbfe0ff, 0.5);
      ev.objs.add(ev.foam, ev.foam2);
      ev.flash = makeGlowSprite(0x9fd0ff, 0.08, 0.9);
      ev.flash.position.copy(c).multiplyScalar(M3_R * 1.002);
      ev.objs.add(ev.flash);
      ev.ran = new Set();
    },
    update(ev, dt) {
      const T = ev.time, c = ev.c;
      ev.shake = T < 1.5 ? 0.0015 : 0;
      ev.flash.material.opacity = Math.max(0, 0.9 - T * 0.5);
      const front = Math.max(0, (T - 1.2) * 0.045);
      const amp = 0.006 * Math.min(1, (T - 1.2) / 1.5) * Math.max(0, Math.min(1, (17 - T) / 4));
      const water = m3W.water;
      if (water && amp > 0) {
        const p = water.geometry.attributes.position.array, wp = m3W.waterPos0, A = ev.wAng;
        for (let i = 0; i < A.length; i++) {
          const x = A[i] - front;
          if (x > 0.12 || x < -0.2) { p[i * 3] = wp[i * 3]; p[i * 3 + 1] = wp[i * 3 + 1]; p[i * 3 + 2] = wp[i * 3 + 2]; continue; }
          const k = 1 + (amp * Math.exp(-((x / 0.022) ** 2)) - 0.4 * amp * Math.exp(-(((x + 0.05) / 0.025) ** 2))) / M3_R;
          p[i * 3] = wp[i * 3] * k; p[i * 3 + 1] = wp[i * 3 + 1] * k; p[i * 3 + 2] = wp[i * 3 + 2] * k;
        }
        water.geometry.attributes.position.needsUpdate = true;
      }
      ev.foam.visible = ev.foam2.visible = amp > 0.0005 && front < 1.0;
      if (ev.foam.visible) {
        m3SetRing(ev.foam, c, front, 0, M3_R + amp * 1.05);
        m3SetRing(ev.foam2, c, Math.max(0.001, front - 0.05), 0, M3_R - amp * 0.2);
        ev.foam.material.opacity = 0.9 * amp / 0.006;
      }
      // zalewanie wybrzeża, potem woda się cofa
      const recede = THREE.MathUtils.clamp((T - 13) / 6, 0, 1);
      ev.coast.forEach((i, k) => {
        const reach = front - ev.coastAng[k];
        const f = reach > 0 ? Math.min(1, reach / 0.03) * (1 - m3W.vh[i] / 0.07) * (1 - recede) : 0;
        m3W.flood[i] = f;
      });
      m3ApplyColors(ev.coast);
      // ludzie przy brzegu uciekają pod górę (najwyższy punkt w okolicy), potem patrzą na morze
      for (const P of people) {
        if (ev.ran.has(P) || P.hidden) continue;
        const a = P.p.angleTo(c);
        if (a < front + 0.25 && a < 0.85 && m3Proc.height(P.p) < 0.12) { ev.ran.add(P); m3Go(P, m3Uphill(m3Uphill(P.p)), 'watch', true, c); }
      }
      return T < 1.5 ? 'Trzęsienie ziemi pod dnem oceanu wypycha w górę ogromną masę wody'
        : T < 13 ? 'Tsunami: na otwartym oceanie fala jest niska i bardzo szybka, przy brzegu rośnie i zalewa ląd'
        : 'Woda się cofa – tsunami potrafi wedrzeć się kilka kilometrów w głąb lądu';
    },
    end(ev) {
      if (m3W.water) { m3W.water.geometry.attributes.position.array.set(m3W.waterPos0); m3W.water.geometry.attributes.position.needsUpdate = true; }
      for (const i of ev.coast) m3W.flood[i] = 0;
      m3ApplyColors(ev.coast);
    },
  },

  // Meteoryt: najpierw kilka sekund ostrzeżenia (skąd leci i gdzie uderzy), potem wejście w atmosferę i uderzenie
  meteor: {
    dur: 22,
    start(ev) {
      const vill = m3Features.villages;
      const c = m3RandomDir(d => { const h = m3Proc.height(d); return h > 0.03 && h < 0.2 && vill.every(v => d.angleTo(v) > 0.35) && vill.some(v => d.angleTo(v) < 0.8) && (!m3Features.volcano || d.angleTo(m3Features.volcano) > 0.3); })
        || m3RandomDir(d => m3Proc.height(d) > 0.02);
      ev.c = c;
      const [t1, t2] = m3Tangents(c);
      const inc = c.clone().multiplyScalar(0.55).addScaledVector(t1, 0.8).addScaledVector(t2, 0.25).normalize();   // skąd nadlatuje
      ev.far = inc.clone().multiplyScalar(M3_R * 7).addScaledVector(t2, M3_R * 0.6);
      ev.from = inc.clone().multiplyScalar(M3_R * 2.2);
      ev.to = c.clone().multiplyScalar(m3SurfR(c));
      ev.rock = new THREE.Group();
      ev.rock.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.008, 0), new THREE.MeshStandardMaterial({ color: 0x6a5e54, roughness: 1 })));
      ev.glow = makeGlowSprite(0xfff0c0, 0.03, 0.4);
      ev.rock.add(ev.glow);
      // przewidywany tor (przerywana czerwona linia) i znacznik miejsca uderzenia
      const pts = [];
      for (let k = 0; k <= 40; k++) { const f = k / 40; pts.push(new THREE.Vector3().lerpVectors(ev.far, ev.from, f)); }
      for (let k = 1; k <= 10; k++) pts.push(new THREE.Vector3().lerpVectors(ev.from, ev.to, k / 10));
      ev.path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xff4040, dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.9 }));
      ev.path.computeLineDistances();
      ev.path.frustumCulled = false;
      ev.markers = [m3Ring(0xff3030), m3Ring(0xff8080, 0.6)];
      ev.trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
      ev.trail.frustumCulled = false;
      ev.trail.visible = false;
      ev.objs.add(ev.rock, ev.trail, ev.path, ...ev.markers);
      const CR = 0.045, DEPTH = 0.011;
      ev.field = m3AddField(d => {
        const a = d.angleTo(c);
        if (a > CR * 2.2) return 0;
        return (a < CR ? -DEPTH * (1 - (a / CR) ** 2) : 0) + 0.35 * DEPTH * Math.exp(-(((a - CR) / (0.3 * CR)) ** 2));
      });
      ev.reg = m3Region(c, CR * 2.5);
      ev.CR = CR;
      ev.flash = makeGlowSprite(0xfff2d0, 0.25, 0);
      ev.flash.position.copy(ev.to);
      ev.objs.add(ev.flash);
      ev.rings = [0, 1, 2].map(() => { const r = m3Ring(0xffd8a0); r.visible = false; ev.objs.add(r); return r; });
      ev.noise = makeNoise3('ejecta' + Math.random());
    },
    update(ev, dt) {
      const T = ev.time, c = ev.c, WARN = 5, HIT = 7;
      if (T < HIT) {
        const pulse = 0.5 + 0.5 * Math.sin(T * 8);
        m3SetRing(ev.markers[0], c, 0.03 + 0.01 * pulse, 0.004);
        m3SetRing(ev.markers[1], c, 0.012, 0.004);
        ev.markers[0].material.opacity = 0.5 + 0.5 * pulse;
        ev.rock.rotation.x += dt * 2; ev.rock.rotation.y += dt * 1.3;
        if (!ev.looked && T > 0.5) { ev.looked = true; for (const P of m3PeopleNear(c, 1.3)) m3Watch(P, c, 8); }   // patrzą w niebo
        if (!ev.fled && T > 2.2) {                       // w miejscu uderzenia: do domów albo jak najdalej
          ev.fled = true;
          for (const P of m3PeopleNear(c, 0.5)) if (P.p.angleTo(c) > 0.2 || !m3Shelter(P, 0.08)) m3Go(P, m3AwayPoint(P, c, 0.4), 'watch', true, c);
        }
      }
      if (T < WARN) {
        ev.rock.position.lerpVectors(ev.far, ev.from, smooth(T / WARN) * 0.85 + (T / WARN) * 0.15);
        ev.glow.material.opacity = 0.4;
        return 'Wykryto meteoryt! Czerwona linia: skąd leci i gdzie uderzy – ludzie uciekają z tego miejsca';
      }
      if (T < HIT) {
        const f = ((T - WARN) / (HIT - WARN)) ** 2;
        ev.rock.position.lerpVectors(ev.from, ev.to, f);
        ev.glow.material.opacity = 1;
        ev.glow.scale.setScalar(0.03 + 0.03 * f);
        ev.trail.visible = true;
        ev.trail.geometry.attributes.position.setXYZ(0, ev.rock.position.x, ev.rock.position.y, ev.rock.position.z);
        _w1.lerpVectors(ev.from, ev.to, Math.max(0, f - 0.3));
        ev.trail.geometry.attributes.position.setXYZ(1, _w1.x, _w1.y, _w1.z);
        ev.trail.geometry.attributes.position.needsUpdate = true;
        ev.path.material.opacity = 0.9 * (1 - f);
        return 'Meteoryt wpada w atmosferę z prędkością ok. 20 km/s i rozgrzewa się do białości';
      }
      if (!ev.hit) {
        ev.hit = true;
        ev.rock.visible = ev.trail.visible = ev.path.visible = false;
        for (const m of ev.markers) m.visible = false;
        m3Panic(c, 0.7, 'fall');
        m3KillTrees(d => d.angleTo(c) < ev.CR * 2.4);
        for (const P of people) if (P.hidden && P.p.angleTo(c) < ev.CR) P.hidden = false;
        const [t1, t2] = m3Tangents(c);
        for (let k = 0; k < 26; k++) {             // pył wyrzucony w niebo
          const a = Math.random() * Math.PI * 2, sp = 0.02 + Math.random() * 0.04;
          const v = _w1.copy(c).multiplyScalar(0.03 + Math.random() * 0.05).addScaledVector(t1, Math.cos(a) * sp).addScaledVector(t2, Math.sin(a) * sp);
          const g = 0.35 + Math.random() * 0.2;
          m3AddPart(ev, m3Puff(new THREE.Color(g, g * 0.88, g * 0.75).getHex(), 0.02, 0.8), ev.to, v, 6 + Math.random() * 4, { drag: 0.5, grow: 5 });
        }
      }
      const q = T - HIT;
      if (!ev.watched && q > 2.2) { ev.watched = true; for (const P of m3PeopleNear(c, 1.2)) m3Watch(P, c, 6); }   // wstają i patrzą na krater
      ev.flash.material.opacity = Math.max(0, 1 - q * 0.8);
      ev.shake = 0.004 * Math.exp(-q / 1.5);
      ev.field.k = Math.min(1, q / 0.5);
      if (q < 0.8) {
        m3RegionGeometry(ev.reg);
        const D = m3W.dirs, oc = m3W.origCol;
        for (const i of ev.reg.verts) {
          _w1.set(D[i * 3], D[i * 3 + 1], D[i * 3 + 2]);
          const a = _w1.angleTo(c), rays = 0.5 + 0.5 * ev.noise(_w1.x * 40, _w1.y * 40, _w1.z * 40, 1);
          _tc.setRGB(oc[i * 3], oc[i * 3 + 1], oc[i * 3 + 2]);
          if (a < ev.CR) _tc.lerp(_tc2.setHex(0x3a3028), 0.85);
          else if (a < ev.CR * 2.4) _tc.lerp(_tc2.setHex(0xa89880), 0.75 * rays * (1 - (a - ev.CR) / (ev.CR * 1.4)));
          m3W.baseCol[i * 3] = _tc.r; m3W.baseCol[i * 3 + 1] = _tc.g; m3W.baseCol[i * 3 + 2] = _tc.b;
        }
        m3ApplyColors(ev.reg.verts);
      }
      ev.rings.forEach((r, k) => {
        const a = (q - k * 0.5) * 0.3;
        r.visible = a > 0.01 && a < 1.0;
        if (r.visible) { m3SetRing(r, c, a); r.material.opacity = 0.9 * (1 - a); }
      });
      // pył przyciemnia Słońce na chwilę ("zima po uderzeniu")
      if (m3CosmosParts.light) m3CosmosParts.light.intensity = MODE3_SUN_LIGHT * (1 - 0.45 * Math.min(1, q / 2) * Math.min(1, (ev.dur - T) / 3));
      return q < 4 ? 'Uderzenie! Powstał krater, fala uderzeniowa obiega okolicę, pył wzbija się w niebo'
        : 'Pył zasłania Słońce – tak 66 mln lat temu zginęły dinozaury';
    },
    end() { if (m3CosmosParts.light) m3CosmosParts.light.intensity = MODE3_SUN_LIGHT; },
  },

  // Start rakiety: znacznik na starcie, odliczanie, lot w górę, orbita, ucieczka w daleki kosmos
  rocket: {
    dur: 27,
    start(ev) {
      const vill = m3Features.villages;
      const c = m3RandomDir(d => { const h = m3Proc.height(d); return h > 0.02 && h < 0.12 && vill.some(v => d.angleTo(v) > 0.12 && d.angleTo(v) < 0.3) && (!m3Features.volcano || d.angleTo(m3Features.volcano) > 0.4) && !isObstacle(d); })
        || m3RandomDir(d => m3Proc.height(d) > 0.02);
      ev.c = c;
      const [t1, t2] = m3Tangents(c), a = Math.random() * Math.PI * 2;
      ev.t = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      ev.Rs = m3SurfR(c);
      const up = new THREE.Quaternion().setFromUnitVectors(UP, c);
      const grey = new THREE.MeshStandardMaterial({ color: 0x8a8e96, roughness: 0.7 });
      const pad = new THREE.Group();
      pad.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.002, 24), grey));
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.03, 0.002), new THREE.MeshStandardMaterial({ color: 0xc04030 }));
      tower.position.set(0.006, 0.015, 0);
      pad.add(tower);
      pad.position.copy(c).multiplyScalar(ev.Rs); pad.quaternion.copy(up);
      ev.marker = m3Ring(0xffe040);
      ev.beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([c.clone().multiplyScalar(ev.Rs), c.clone().multiplyScalar(ev.Rs + 0.15)]),
        new THREE.LineBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
      ev.beam.frustumCulled = false;
      // rakieta (oś +Y), podstawa w zerze
      const rk = new THREE.Group();
      const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.2 });
      const red = new THREE.MeshStandardMaterial({ color: 0xd03a2a, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.02, 16), white); body.position.y = 0.012;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.0026, 0.007, 16), red); nose.position.y = 0.0255;
      rk.add(body, nose);
      for (let k = 0; k < 3; k++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.005, 0.004), red);
        const ang = k / 3 * Math.PI * 2;
        fin.position.set(Math.cos(ang) * 0.003, 0.004, Math.sin(ang) * 0.003); fin.rotation.y = -ang;
        rk.add(fin);
      }
      ev.flame = makeGlowSprite(0xffb050, 0.014, 0);
      ev.flame.position.y = -0.003;
      rk.add(ev.flame);
      rk.position.copy(c).multiplyScalar(ev.Rs); rk.quaternion.copy(up);
      ev.rocket = rk;
      ev.N = 300;
      ev.trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: ev.N }, () => rk.position.clone())),
        new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
      ev.trail.frustumCulled = false;
      ev.objs.add(pad, ev.marker, ev.beam, rk, ev.trail);
      ev.prev = rk.position.clone();
      ev.viewers = [];
    },
    update(ev, dt) {
      const T = ev.time, c = ev.c, t = ev.t, Ro = M3_R * 1.35;
      let phi = 0, r = ev.Rs, note, thrust = 0;
      // ludzie: przychodzą popatrzeć (z bezpiecznej odległości)
      if (!ev.gathered && T > 0.2) {
        ev.gathered = true;
        for (const P of m3PeopleNear(c, 0.5)) {
          const axis = new THREE.Vector3().crossVectors(c, P.p);
          if (axis.lengthSq() < 1e-8) continue;
          const spot = c.clone().applyAxisAngle(axis.normalize(), 0.07 + Math.random() * 0.04);
          m3Go(P, spot, 'watch', false, c);
          ev.viewers.push(P);
        }
      }
      if (T < 5) {
        note = `Start rakiety za ${Math.ceil(5 - T)}… (żółty znacznik: miejsce startu) – ludzie przychodzą popatrzeć`;
        const pulse = 0.5 + 0.5 * Math.sin(T * 6);
        m3SetRing(ev.marker, c, 0.03 + 0.008 * pulse, 0.003);
        ev.marker.material.opacity = 0.5 + 0.5 * pulse;
        if (T > 4) thrust = (T - 4) * 0.5;
      } else if (T < 10) {
        const u = (T - 5) / 5;
        r = ev.Rs + (Ro - ev.Rs) * smooth(u);
        phi = 0.55 * u * u;
        thrust = 1;
        note = 'Start! Rakieta leci pionowo w górę, potem się przechyla, żeby nabrać prędkości w bok';
        ev.smokeT = (ev.smokeT || 0) - dt;
        if (T < 7.5 && ev.smokeT <= 0) {
          ev.smokeT = 0.08;
          const [t1, t2] = m3Tangents(c), a = Math.random() * Math.PI * 2;
          const v = _w1.copy(c).multiplyScalar(0.004).addScaledVector(t1, Math.cos(a) * 0.02).addScaledVector(t2, Math.sin(a) * 0.02);
          m3AddPart(ev, m3Puff(0xe8e4dc, 0.012, 0.7), c.clone().multiplyScalar(ev.Rs + 0.003), v, 4, { drag: 0.6, grow: 3 });
        }
      } else if (T < 18) {
        const tau = T - 10;
        phi = tau < 2 ? 0.55 + 0.22 * tau + 0.07 * tau * tau : 1.27 + 0.5 * (tau - 2);
        r = Ro;
        thrust = tau < 1.5 ? 0.6 : 0;
        note = 'Rakieta na orbicie: leci tak szybko w bok, że cały czas „spada” obok planety';
      } else {
        const tau = T - 18;
        phi = 4.27 + 0.5 * tau - 0.03 * tau * tau;
        r = Ro * Math.exp(0.38 * tau);
        thrust = tau < 3 ? 1 : 0.4;
        note = 'Silnik znów pracuje: rakieta ucieka z orbity w daleki kosmos';
        const fade = Math.min(1, (ev.dur - T) / 3);
        ev.rocket.scale.setScalar(Math.max(0.01, fade));
        ev.trail.material.opacity = 0.55 * fade;
      }
      if (T >= 5) { ev.marker.material.opacity = Math.max(0, ev.marker.material.opacity - dt); ev.beam.material.opacity = Math.max(0, ev.beam.material.opacity - dt); }
      const pos = _w1.copy(c).multiplyScalar(Math.cos(phi)).addScaledVector(t, Math.sin(phi)).multiplyScalar(r);
      ev.rocket.position.copy(pos);
      const vel = _w2.copy(pos).sub(ev.prev);
      if (vel.lengthSq() > 1e-12) ev.rocket.quaternion.slerp(_gq.setFromUnitVectors(UP, vel.normalize()), Math.min(1, dt * 6));
      ev.prev.copy(pos);
      ev.flame.material.opacity = thrust * (0.8 + 0.2 * Math.random());
      ev.flame.scale.setScalar(0.01 + 0.012 * thrust);
      if (T >= 4.8) {
        const a = ev.trail.geometry.attributes.position;
        a.array.copyWithin(0, 3);
        a.setXYZ(ev.N - 1, pos.x, pos.y, pos.z);
        a.needsUpdate = true;
      }
      // widzowie śledzą rakietę wzrokiem, po wejściu na orbitę machają
      ev.watchT = (ev.watchT || 0) - dt;
      if (T > 5 && ev.watchT <= 0) { ev.watchT = 0.4; for (const P of ev.viewers) if (!P.goal && !P.hidden) { P.watch = pos.clone().normalize(); if (P.action !== 'idle' && P.action !== 'wave') startBehavior(P, 'idle', 6); } }
      if (!ev.waved && T > 10.5) { ev.waved = true; for (const P of ev.viewers) if (!P.goal && !P.hidden && Math.random() < 0.7) startBehavior(P, 'wave', 3); }
      return note;
    },
  },

  // Lot rakietą: to samo co "Rakieta", ale jesteś w środku (kabina); po locie wracasz na swoje miejsce
  astronaut: {
    dur: 27,
    start(ev) { M3_SCENARIOS.rocket.start(ev); m3RideStart(ev); },
    update(ev, dt) {
      const note = M3_SCENARIOS.rocket.update(ev, dt);
      m3RideUpdate(ev, dt);
      const T = ev.time;
      return T < 5 ? `Siedzisz w rakiecie na wyrzutni – start za ${Math.ceil(5 - T)}…`
        : T < 10 ? 'Start! Planeta zostaje w dole, przelatujesz przez chmury i atmosferę'
        : T < 18 ? 'Jesteś na orbicie: pod Tobą przesuwa się planeta, niebo jest czarne'
        : T < ev.dur - 2 ? 'Silnik znów pracuje – odlatujesz w daleki kosmos, planeta maleje' : note;
    },
    end(ev) { m3RideEnd(); },
  },

  // Efekt cieplarniany: CO₂ rośnie, ciepło (czerwone) coraz częściej wraca na planetę, robi się gorąco
  greenhouse: {
    dur: 28,
    start(ev) {
      m3W.event = ev;
      setM3Temperature(40);                            // cel: +25°C …
      if (m3W.trans) m3W.trans.dur = 20;               // … osiągany powoli
      m3SetAtmosphere(15);
      ev.layer = new THREE.Mesh(new THREE.SphereGeometry(M3_R * 1.1, 48, 24),
        new THREE.MeshBasicMaterial({ color: 0xb0905a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      ev.objs.add(ev.layer);
      ev.sunT = 0;
    },
    update(ev, dt) {
      const T = ev.time, k = THREE.MathUtils.clamp(T / 20, 0, 1);
      const ppm = Math.round(280 + 720 * k), temp = Math.round(15 + 25 * k);
      ev.layer.material.opacity = 0.18 * k;
      if (!ev.hazed && T > 6) { ev.hazed = true; m3SetAtmosphere(40, 0xc8b890, 1.5); }
      if (!ev.rise && T > 10) { ev.rise = true; m3W.waterGoal.scale = 1.003; }      // poziom mórz rośnie
      if (!ev.shade && T > 15) { ev.shade = true; for (const P of people) if (Math.random() < 0.45) m3Shelter(P, 0.3); }
      // kierunek do Słońca (w układzie planety)
      const sunW = m3Helio.getWorldPosition(_w3);
      const sun = m3W.shake.worldToLocal(sunW.clone()).normalize();
      const [t1, t2] = m3Tangents(sun);
      const trap = 0.12 + 0.75 * k;
      ev.sunT -= dt;
      if (T < ev.dur - 3 && ev.sunT <= 0) {
        ev.sunT = 0.07;
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * M3_R * 0.85;
        const p0 = sun.clone().multiplyScalar(M3_R * 1.9).addScaledVector(t1, Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr);
        // światło słoneczne (żółte) dochodzi do powierzchni i ogrzewa ją; ta oddaje ciepło (czerwone) w górę
        m3AddPart(ev, makeGlowSprite(0xffe860, 0.01, 0.9), p0, sun.clone().multiplyScalar(-0.3), 5, { hit: true, fade: false, onDie: q => {
          const d = q.s.position.clone().normalize();
          m3AddPart(ev, makeGlowSprite(0xff4a2a, 0.011, 0.9), q.s.position.clone().multiplyScalar(1.005), d.multiplyScalar(0.12), 6, { fade: false, fn: h => {
            const len = h.s.position.length();
            if (!h.bounced && len > M3_R * 1.1) {
              h.bounced = true;
              if (Math.random() < trap) h.v.multiplyScalar(-1);   // zatrzymane przez CO₂ – wraca na planetę
            }
            if (len > M3_R * 1.8) return false;                     // uciekło w kosmos
            if (h.bounced && len < M3_R) return false;
            return true;
          } });
        } });
      }
      return T < 20 ? `Efekt cieplarniany: CO₂ ${ppm} ppm, średnio ${temp}°C – ciepło (czerwone) coraz częściej wraca na planetę`
        : 'Lodowce stopniały, poziom mórz wzrósł, upał – część ludzi chowa się w domach';
    },
  },
};


// ---------- Widok z rakiety: planeta jest powiększona i ustawiona tak, że kabina rakiety jest w Twojej głowie;
// "w dół" = w stronę planety, "przód" = kierunek lotu. Gwiazdy i Słońce obracają się razem z planetą.
const M3_RIDE_SCALE = 40;
const m3Ride = { cabin: null, board: null, saved: null, eye: new THREE.Vector3(), fwd: new THREE.Vector3(), prev: new THREE.Vector3(), first: true };
function m3BuildCabin() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.6, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 12, 48), frame);
  ring.position.set(0, 0.05, -0.8);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), frame);
  panel.position.set(0, -0.55, -0.55);
  panel.rotation.x = -0.5;
  g.add(ring, panel);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), new THREE.MeshBasicMaterial({ color: [0x40ff80, 0xffc040, 0x40a0ff][i % 3] }));
    b.position.set(-0.3 + i * 0.12, -0.5, -0.5);
    b.rotation.x = -0.5;
    g.add(b);
  }
  m3Ride.board = makeTextBoard(900, 2, '#bfe8ff');
  m3Ride.board.sprite.position.set(0, -0.36, -0.75);
  const h = 0.75 * Math.tan(3 * DEG);
  m3Ride.board.sprite.scale.set(h * m3Ride.board.sprite.userData.aspect, h, 1);
  g.add(m3Ride.board.sprite);
  g.visible = false;
  mode3Group.add(g);
  return g;
}
function m3RideStart(ev) {
  cancelAllGrabs();
  if (state.follow) stopFollow();
  if (!m3Ride.cabin) m3Ride.cabin = m3BuildCabin();
  m3Ride.saved = { pos: m3Planet.position.clone(), q: m3Planet.quaternion.clone(), s: m3Planet.scale.x };
  m3Ride.eye.copy(eyePos);
  m3Ride.fwd.copy(horizontalForward());
  m3Ride.cabin.position.copy(eyePos);
  m3Ride.cabin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), m3Ride.fwd);
  m3Ride.cabin.visible = true;
  m3Ride.first = true;
  m3Ride.prev.copy(ev.rocket.position);
  ev.rocket.visible = false;                     // jesteś w środku
  ev.trail.visible = false;
  state.m3Ride = ev;
}
const _rq1 = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rm = new THREE.Matrix4();
const _ru = new THREE.Vector3(), _rf = new THREE.Vector3(), _rr = new THREE.Vector3(), _rp = new THREE.Vector3();
function m3RideUpdate(ev, dt) {
  const S = M3_RIDE_SCALE, p = ev.rocket.position;
  const up = _ru.copy(p).normalize();
  let f = _rf.copy(p).sub(m3Ride.prev);
  m3Ride.prev.copy(p);
  f.addScaledVector(up, -f.dot(up));
  if (f.lengthSq() < 1e-14) f.copy(ev.t).addScaledVector(up, -ev.t.dot(up));
  f.normalize();
  // obrót: (prawo, góra, tył) rakiety -> (prawo, góra, tył) Twojej głowy
  _rq1.setFromRotationMatrix(_rm.makeBasis(_rr.crossVectors(f, up).normalize(), up, f.clone().negate()));
  const fw = m3Ride.fwd;
  _rq2.setFromRotationMatrix(_rm.makeBasis(_rp.crossVectors(fw, UP).normalize(), UP, fw.clone().negate()));
  const Q = _rq2.multiply(_rq1.invert());
  if (m3Ride.first) { m3Planet.quaternion.copy(Q); m3Ride.first = false; }
  else m3Planet.quaternion.slerp(Q, Math.min(1, dt * 4));
  m3Planet.scale.setScalar(S);
  // kabina (czubek rakiety) w Twojej głowie
  const cockpit = _rp.copy(p).addScaledVector(up, 0.022).multiplyScalar(S).applyQuaternion(m3Planet.quaternion);
  m3Planet.position.copy(m3Ride.eye).sub(cockpit);
  m3Planet.updateMatrixWorld(true);
  // gwiazdy, Słońce i inne planety obracają się razem z planetą (wiernie: dzień i noc się zgadzają)
  m3Cosmos.position.copy(m3Planet.position);
  m3Cosmos.quaternion.copy(m3Planet.quaternion).multiply(_rq1.copy(m3True).invert()).multiply(m3Base.cosmosQ);
  const alt = (p.length() - ev.Rs) / M3_R * 6371;
  m3Ride.board.setText([`Wysokość: ${Math.max(0, alt).toFixed(0)} km (gdyby planeta była Ziemią)`, ev.time < 5 ? 'Odliczanie…' : ev.time < 18 ? 'Silnik: ' + (ev.flame.material.opacity > 0.3 ? 'PRACUJE' : 'wyłączony') : 'Kurs: daleki kosmos']);
}
function m3RideEnd() {
  if (!state.m3Ride) return;
  state.m3Ride = null;
  const sv = m3Ride.saved;
  if (sv) { m3Planet.position.copy(sv.pos); m3Planet.quaternion.copy(sv.q); m3Planet.scale.setScalar(sv.s); }
  m3Cosmos.position.copy(m3Base.center);
  m3Cosmos.quaternion.multiplyQuaternions(m3View, m3Base.cosmosQ);
  if (m3Ride.cabin) m3Ride.cabin.visible = false;
}

function m3StartEvent(type) {
  if (state.mode !== 3 || !m3WorldInit()) return;
  m3EndEvent();
  const sc = M3_SCENARIOS[type];
  const ev = { type, time: 0, dur: sc.dur, objs: new THREE.Group(), parts: [], shake: 0 };
  m3W.shake.add(ev.objs);
  m3W.event = ev;
  sc.start(ev);
  drawMenu();
}
function m3EndEvent() {
  const ev = m3W.event;
  if (!ev) return;
  const sc = M3_SCENARIOS[ev.type];
  if (sc.end) sc.end(ev);
  ev.objs.removeFromParent();
  ev.objs.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  m3W.event = null;
  m3W.shake.position.set(0, 0, 0);
  if (m3W.T < 80) m3UnhideAll();
  m3W.note = m3W.tempNote;
  drawMenu();
}
// Reset: planeta jak na początku (bez gór, kraterów i lawy ze scenariuszy, 15°C)
function m3WorldReset() {
  if (!m3W.ready) return;
  m3EndEvent();
  m3UnhideAll();
  m3W.prevT = 15;
  m3DynFields.length = 0;
  m3W.geo.attributes.position.array.set(m3W.basePos);
  m3W.geo.attributes.position.needsUpdate = true;
  m3W.geo.computeVertexNormals();
  m3W.baseCol.set(m3W.origCol);
  m3W.vh.set(m3W.vh0);
  m3W.flood.fill(0);
  if (m3W.treeMat0) {
    m3Trees.trunks.instanceMatrix.array.set(m3W.treeMat0.t); m3Trees.crowns.instanceMatrix.array.set(m3W.treeMat0.c);
    m3Trees.trunks.instanceMatrix.needsUpdate = m3Trees.crowns.instanceMatrix.needsUpdate = true;
  }
  setM3Temperature(15);
  m3W.trans = null;
  m3ApplyColors();
  const w = m3W.water, g = m3W.waterGoal;
  if (w) { w.material.color.copy(g.color); w.material.opacity = g.opacity; w.material.roughness = g.rough; w.scale.setScalar(1); w.visible = true; }
}

function updateM3World(dt) {
  if (!m3W.ready) return;
  // płynna zmiana temperatury
  const tr = m3W.trans;
  if (tr) {
    tr.t = Math.min(1, tr.t + dt / (tr.dur || 2.5));
    const e = smooth(tr.t), col = m3W.geo.attributes.color.array;
    for (let i = 0; i < col.length; i++) col[i] = tr.from[i] + (tr.to[i] - tr.from[i]) * e;
    m3W.geo.attributes.color.needsUpdate = true;
    if (tr.t >= 1) m3W.trans = null;
  }
  const w = m3W.water, g = m3W.waterGoal;
  if (w) {
    const k = Math.min(1, dt * 1.5);
    w.material.color.lerp(g.color, k);
    w.material.opacity += (g.opacity - w.material.opacity) * k;
    w.material.roughness += (g.rough - w.material.roughness) * k;
    w.scale.setScalar(w.scale.x + (g.scale - w.scale.x) * k);
    w.visible = w.material.opacity > 0.02;
  }
  // chmury
  const cm = m3W.cloudMat;
  cm.opacity += ((m3W.cloudGoal ?? 1) - cm.opacity) * Math.min(1, dt * 0.8);
  m3Clouds.children[0].visible = cm.opacity > 0.02;
  // atmosfera
  m3UpdateAtmosphere(dt);
  // para wodna nad oceanami przy 80°C
  const steamOn = m3W.T >= 80 && m3W.T < 300;
  for (const sp of m3W.steam) {
    sp.visible = steamOn;
    if (!steamOn) continue;
    const u = sp.userData;
    u.t = (u.t + dt * 0.25) % 1;
    sp.position.copy(u.d).multiplyScalar(M3_R * (1.0 + u.t * 0.12));
    sp.scale.setScalar(0.015 + u.t * 0.04);
    sp.material.opacity = 0.5 * Math.sin(Math.PI * u.t);
  }
  // scenariusz
  const ev = m3W.event;
  if (ev) {
    ev.time += dt;
    ev.shake = 0;
    const note = M3_SCENARIOS[ev.type].update(ev, dt);
    m3UpdateParts(ev, dt);
    if (note && note !== m3W.note) { m3W.note = note; }
    const a = ev.shake;
    m3W.shake.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    if (ev.time >= ev.dur && ev.parts.length === 0) m3EndEvent();
    else if (ev.time >= ev.dur + 6) m3EndEvent();
  }
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
  state.follow = null;
  state.m3Pick = false;
  floaters.delete(m3Planet);
  m3Planet.position.copy(eyePos).addScaledVector(fwd, MODE3_DISTANCE_M);
  m3Planet.position.y = eyePos.y + MODE3_HEIGHT_OFFSET_M;
  m3Base.center.copy(m3Planet.position);
  m3Base.cosmosQ.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
  m3View.identity();
  m3True.identity();
  m3Planet.scale.setScalar(1);
  updateM3Frame(0);
  m3WorldReset();
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
  const S = 512, c = S / 2, q = S / 256;              // 512 px – ostrzejsze galaktyki z bliska
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighter';
  const rnd = seededRandom(seed), gauss = gaussian(rnd);
  const dot = (x, y, r, rgb, a) => { ctx.fillStyle = `rgba(${rgb},${a})`; ctx.beginPath(); ctx.arc(x, y, r * q, 0, Math.PI * 2); ctx.fill(); };
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
      for (let i = 0; i < 140; i++) dot(cx + gauss() * 10 * q, cy + gauss() * 10 * q, 0.6 + rnd() * 1.2, rnd() < 0.2 ? '255,140,190' : '170,200,255', 0.22);
    }
    bulge(c * 0.3, 0.25);
  } else {
    const arms = kind === 'spiral3' ? 3 : 2;
    const bar = kind === 'barred';
    const wind = kind === 'spiral3' ? 3.0 : 4.4;
    const r0 = bar ? 0.2 : 0.06;
    for (let i = 0; i < 6000; i++) {
      const arm = i % arms;
      const t = Math.pow(rnd(), 0.75);
      const r = (r0 + t * (0.92 - r0)) * c;
      const th = arm * (Math.PI * 2 / arms) + t * wind + gauss() * 0.22;
      const pink = rnd() < 0.06;
      dot(c + Math.cos(th) * r + gauss() * 3 * q, c + Math.sin(th) * r + gauss() * 3 * q, 0.5 + rnd() * 1.1,
        pink ? '255,120,180' : '170,200,255', (pink ? 0.4 : 0.18) * (1 - 0.6 * t));
    }
    for (let i = 0; i < 1800; i++) {                    // rozmyty dysk między ramionami
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
  specs.push({ kind: 'barred', pos: new THREE.Vector3(0, -0.35, -0.7), size: 0.1, fixed: true, isMW: true, name: 'Droga Mleczna – tu jesteśmy', normal: new THREE.Vector3(0.2, 1, 0.3) });
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
        mesh, index, billboard: k.billboard, pos: s.pos.clone(), size: s.size, fixed: !!s.fixed, isMW: !!s.isMW,
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
    if (g.isMW && state.journey) _scale.setScalar(1e-9);          // w Podróży Drogę Mleczną rysuje jej własny obraz dysku
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
  m5Origin.copy(eyePos);
  m5Pivot.copy(eyePos).addScaledVector(fwd, MODE5_ZOOM_PIVOT_M);
  universe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
  setUniverseScale(1);
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

// Fokus: kliknij obiekt – gałka lewo/prawo obraca Cię wokół niego (oglądasz inne skale "z jego perspektywy").
// Zoom działa dalej; kliknij go jeszcze raz (albo puste miejsce), żeby wrócić do zwykłego widoku.
state.m6Focus = null;
function pickScaleItem(origin, dir) {
  mode6Group.updateMatrixWorld(true);
  let best = null, bestD = Infinity;
  for (const it of scaleItems) {
    if (!it.holder.visible) continue;
    const d = it.holder.scale.x, r = Math.max(0.05, d * it.maxDim * 0.5);
    const c = _v4.set(0, it.height * 0.5, 0).applyMatrix4(it.holder.matrixWorld);
    _sphere.set(c, r);
    raycaster.ray.set(origin, dir);
    const hit = raycaster.ray.intersectSphere(_sphere, _v5);
    if (hit && origin.distanceTo(hit) < bestD) { bestD = origin.distanceTo(hit); best = it; }
  }
  return best;
}
function scaleFocusClick(origin, dir) {
  const it = pickScaleItem(origin, dir);
  state.m6Focus = it && it !== state.m6Focus ? it : null;
  drawMenu();
}
function turnAroundFocus(angle) {
  const it = state.m6Focus;
  if (!it) return;
  mode6Group.updateMatrixWorld(true);
  const W = _v5.setFromMatrixPosition(it.holder.matrixWorld);
  mode6Group.position.sub(W).applyAxisAngle(UP, angle).add(W);
  mode6Group.quaternion.premultiply(_q2.setFromAxisAngle(UP, angle));
}
function updateScaleFocus(dt) {
  if (state.m6Focus) return;
  const k = Math.min(1, dt * 3);                     // bez fokusu: płynny powrót do zwykłego widoku
  mode6Group.quaternion.slerp(_q2.identity(), k);
  mode6Group.position.lerp(_v5.set(0, 0, 0), k);
}

function layoutMode6() {
  state.m6Focus = null;
  mode6Group.position.set(0, 0, 0);
  mode6Group.quaternion.identity();
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

// Suwak prędkości: Tryb 6 – zoom skali, Tryb 7 – przelot Galaktyka ↔ Słońce
function speedSlider() {
  return state.mode === 7 || state.mode === 10
    ? { v: state.mwSpeed, min: MW_SPEED_MIN, max: MW_SPEED_MAX, set: v => { state.mwSpeed = v; } }
    : { v: state.scaleSpeed, min: SCALE_SPEED_MIN, max: SCALE_SPEED_MAX, set: v => { state.scaleSpeed = v; } };
}
function setScaleSpeedFromFraction(f) {
  const sl = speedSlider();
  sl.set(sl.min * Math.pow(sl.max / sl.min, THREE.MathUtils.clamp(f, 0, 1)));
  drawMenu();
}
function nudgeSpeed(k) {
  const sl = speedSlider();
  setScaleSpeedFromFraction(Math.log(sl.v * k / sl.min) / Math.log(sl.max / sl.min));
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
//  TRYB 7: DROGA MLECZNA – od całej Galaktyki do Słońca
//   Jednostki: lata świetlne. state.mwLog = log10(ile metrów w goglach ma 1 rok świetlny).
//   Warstwy: Galaktyka (140 tys. gwiazd) → sąsiedztwo Słońca (1000 lat św.) → Układ Słoneczny → Słońce.
// =====================================================================
const mode7Group = new THREE.Group();
mode7Group.visible = false;
scene.add(mode7Group);
mode7Group.add(new THREE.AmbientLight(0xffffff, 0.12));
const AU_PER_LY = 63241;
const M_PER_LY = 9.4607e15;
const SUN_GAL = new THREE.Vector3(0, 0, 26000);        // Słońce 26 000 lat św. od centrum
const SUN_R_AU = 696340 / KM_PER_AU, EARTH_R_AU = 6371 / KM_PER_AU, MOON_R_AU = 1737.4 / KM_PER_AU, MOON_DIST_AU = 384400 / KM_PER_AU;

// Gwiazdy dalej niż MW_SKY_M od punktu zoomu rysujemy na sferze o tym promieniu – w tym samym kierunku,
// więc wyglądają tak samo, a nie uciekają poza zasięg kamery. Dzięki temu z bliska Słońca i Ziemi
// widać na niebie pas Drogi Mlecznej utworzony przez te same gwiazdy, które z daleka tworzą całą Galaktykę.
const mwSkyUniforms = { uCenter: { value: new THREE.Vector3() }, uSky: { value: MW_SKY_M }, uDim: { value: 1 } };
function skyPointsMaterial(size, extra = null) {
  const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, mwSkyUniforms, extra ? extra.uniforms : {});
    sh.vertexShader = 'uniform vec3 uCenter;\nuniform float uSky;\nuniform float uDim;\nvarying float vFade;\n' + (extra ? extra.head : '') +
      sh.vertexShader.replace('#include <project_vertex>', `
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vec3 dd = wp.xyz - uCenter;
        float ln = length(dd);
        if (ln > uSky) wp.xyz = uCenter + dd * (uSky / ln);
        vFade = uDim;
        float sizeK = 1.0;
        ${extra ? extra.body : ''}
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`).replace('gl_PointSize = size;', 'gl_PointSize = size * sizeK;');
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vFade;');
  };
  mat.customProgramCacheKey = () => 'sky-' + size + (extra ? extra.key : '');
  return mat;
}

// Pas Drogi Mlecznej na niebie (miękka poświata – miliardy gwiazd, których nie da się narysować osobno)
function makeMilkyWayBandTexture() {
  const W = 1024, H = 128;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const noise = makeNoise3('mwband');
  for (let x = 0; x < W; x++) {
    const lon = x / W * Math.PI * 2;
    const dl = Math.abs(lon - Math.PI);                   // u = 0,5 -> kierunek do centrum Galaktyki
    const core = Math.exp(-((dl / 0.75) ** 2));
    const base = 0.22 + 0.78 * core;
    const width = 0.35 + 0.45 * core;
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1) * 2 - 1;
      const g = Math.exp(-((v / width) ** 2) * 2.5);
      const rift = 1 - 0.6 * (0.3 + 0.7 * core) * Math.exp(-(((v - 0.04) / 0.13) ** 2));   // ciemne pasma pyłu
      const n = 0.6 + 0.4 * noise(Math.cos(lon) * 3, Math.sin(lon) * 3, v * 2.5, 3);
      const I = Math.max(0, base * g * rift * n) * 255;
      const i = (y * W + x) * 4;
      img.data[i] = I; img.data[i + 1] = I * (0.93 - 0.08 * core); img.data[i + 2] = I * (0.86 - 0.2 * core); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(canvas);
}

// Obraz dysku Galaktyki narysowany z tych samych gwiazd (widok z góry): przy oddalaniu gwiazdy płynnie
// przechodzą w ten obraz, a on jest tym, co dalej widać wśród innych galaktyk – bez przeskoku.
const MW_DISK_SIZE_LY = 110000;
const MW_TO_DISK_FROM = -5.2, MW_TO_DISK_TO = -4.4;         // w tym zakresie skali gwiazdy Galaktyki przechodzą w jej obraz
const MW_DISK_FAR_OPACITY = 0.85;
const MW_SKY_BAND_BRIGHTNESS = 0.25;     // jasność gwiazd Galaktyki widzianych z jej wnętrza (pas Drogi Mlecznej na niebie)
function mwDiskTexture(pos, col) {
  const W = 1024, S = MW_DISK_SIZE_LY, acc = new Float32Array(W * W * 3);
  for (let i = 0; i < pos.length; i += 3) {
    const px = Math.floor((pos[i] / S + 0.5) * W), py = Math.floor((pos[i + 2] / S + 0.5) * W);
    if (px < 0 || py < 0 || px >= W || py >= W) continue;
    const k = (py * W + px) * 3;
    acc[k] += col[i]; acc[k + 1] += col[i + 1]; acc[k + 2] += col[i + 2];
  }
  const [canvas, ctx] = makeCanvas(W, W);
  const img = ctx.createImageData(W, W);
  for (let j = 0; j < W * W; j++) {
    for (let c = 0; c < 3; c++) img.data[j * 4 + c] = 255 * (1 - Math.exp(-acc[j * 3 + c] * 1.2));
    img.data[j * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const [glow, gctx] = makeCanvas(W / 4, W / 4);              // rozmyta poświata (miliardy gwiazd między punktami)
  gctx.filter = 'blur(2px)';
  gctx.drawImage(canvas, 0, 0, W / 4, W / 4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.8;
  ctx.drawImage(glow, 0, 0, W, W);
  return canvasTexture(canvas);
}

const mw = (() => {
  const rnd = seededRandom('milkyway'), gauss = gaussian(rnd);
  const pos = [], col = [];
  const add = (x, y, z, r, g, b) => { pos.push(x, y, z); col.push(r * MW_BRIGHTNESS, g * MW_BRIGHTNESS, b * MW_BRIGHTNESS); };
  const B = Math.tan(12 * DEG);                         // skok ramion spiralnych (12°)
  for (let i = 0; i < MW_POINTS; i++) {
    const u = rnd();
    if (u < 0.17) {                                     // zgrubienie centralne i poprzeczka
      const bar = rnd() < 0.5;
      const x = gauss() * (bar ? 6000 : 2600), z = gauss() * (bar ? 1500 : 2600), y = gauss() * 1000;
      const k = 0.7 + rnd() * 0.3;
      const c = Math.cos(0.45), s2 = Math.sin(0.45);
      add(x * c - z * s2, y, x * s2 + z * c, k, k * 0.82, k * 0.55);
    } else if (u < 0.82) {                              // 4 ramiona spiralne (Perseusza, Strzelca, Tarczy–Centaura, Węgielnicy)
      const arm = Math.floor(rnd() * 4);
      const r = 4500 + Math.min(48000, -Math.log(1 - rnd() * 0.98) * 12000);
      const th = Math.log(r / 4500) / B + arm * Math.PI / 2 + gauss() * 0.11;
      const spread = 700 + r * 0.03;
      const x = Math.cos(th) * r + gauss() * spread, z = Math.sin(th) * r + gauss() * spread, y = gauss() * (300 + r * 0.004);
      const pink = rnd() < 0.04, k = 0.55 + rnd() * 0.45;
      if (pink) add(x, y, z, 1, 0.45, 0.7); else add(x, y, z, k * 0.75, k * 0.85, k);
    } else {                                            // dysk między ramionami
      const r = -Math.log(1 - rnd() * 0.99) * 11000, th = rnd() * Math.PI * 2;
      const k = 0.35 + rnd() * 0.35;
      add(Math.cos(th) * r, gauss() * 500, Math.sin(th) * r, k, k * 0.92, k * 0.8);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const galaxy = new THREE.Group();
  const galUniforms = { uGal: { value: 1 } };                       // 1 = gwiazdy, 0 = sam obraz dysku (z daleka)
  const stars = new THREE.Points(geo, skyPointsMaterial(1.8, { key: 'gal', uniforms: galUniforms, head: 'uniform float uGal;\n', body: 'vFade *= uGal;' }));
  stars.frustumCulled = false;
  const bulge = makeGlowSprite(0xffd8a0, 14000, 0.35, softGlowTexture);
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(MW_DISK_SIZE_LY, MW_DISK_SIZE_LY).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: mwDiskTexture(pos, col), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0.35,
  }));
  galaxy.add(disk, stars, bulge);
  mode7Group.add(galaxy);

  // sąsiedztwo Słońca: do MW_NEAR_REAL_LY prawdziwa gęstość gwiazd (ok. 0,004 na rok świetlny³), dalej warstwy coraz
  // rzadsze (płynnie, MW_NEAR_SLOPE). Przy oddalaniu gęstość pokazywana (uDisp) maleje powoli, a gęstszych miejsc nie pokazujemy
  // gęściej niż uDisp – brak „kuli”. Cały gęsty fragment ramienia widać jeszcze razem z zarysem Galaktyki.
  const near = new THREE.Group();
  const nearUniforms = { uDisp: { value: MW_STAR_DENSITY }, uAlpha: { value: 0 }, uGain: { value: 1 }, uR: { value: new THREE.Vector3(MW_NEAR_RADIUS_LY, MW_NEAR_RADIUS_LY * 0.35, MW_NEAR_RADIUS_LY) } };
  const nearExtra = {
    key: 'near2', uniforms: nearUniforms,
    head: 'attribute float rank;\nattribute float dens;\nuniform float uDisp;\nuniform float uAlpha;\nuniform float uGain;\nuniform vec3 uR;\n',
    body: `float rn = length(position / uR);
        float frac = min(1.0, uDisp / dens);
        float de = distance(wp.xyz, cameraPosition);
        vFade *= uAlpha * uGain * clamp((frac - rank) / (0.05 * frac + 1e-5), 0.0, 1.0) * (1.0 - smoothstep(0.6, 1.0, rn)) * clamp(pow(1.5 / de, 1.3), 0.04, 1.0);
        sizeK = 1.0 + 1.2 * clamp(1.0 - de / 1.2, 0.0, 1.0);`,
  };
  const nrnd = seededRandom('mwnear3');
  const tints = [[1, 0.72, 0.5], [1, 0.9, 0.75], [1, 0.97, 0.92], [0.92, 0.95, 1], [0.72, 0.82, 1]];
  const sets = [{ size: 1.7, p: [], c: [], r: [], d: [] }, { size: 3.2, p: [], c: [], r: [], d: [] }];   // zwykłe i jasne
  // gęstość: prawdziwa do MW_NEAR_REAL_LY, dalej maleje płynnie jak (R0/r)^MW_NEAR_SLOPE; w pionie dysk (wysokość skali Hz).
  // Losujemy dokładnie z tego rozkładu (odległość z tablicy, potem wysokość), bez warstw – nigdzie nie ma skoku gęstości.
  const Hz = 300, R0 = MW_NEAR_REAL_LY, RN = MW_NEAR_RADIUS_LY;           // grubość dysku (wysokość skali) ~300 lat św.
  const fR = r => Math.min(1, (R0 / Math.max(r, 1e-6)) ** MW_NEAR_SLOPE);
  const NB = 4000, cdf = new Float64Array(NB + 1);
  for (let i = 1; i <= NB; i++) {
    const r = (i - 0.5) / NB * RN, gz = Hz / r * (1 - Math.exp(-r / Hz));  // średnio exp(-|z|/Hz) na sferze o promieniu r
    cdf[i] = cdf[i - 1] + 4 * Math.PI * r * r * fR(r) * gz * (RN / NB);
  }
  const count = Math.round(MW_STAR_DENSITY * cdf[NB]);
  for (let i = 0; i < count; i++) {
    const x = nrnd() * cdf[NB];
    let lo = 0, hi = NB;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m; else hi = m; }
    const r = (lo + (x - cdf[lo]) / (cdf[hi] - cdf[lo] || 1)) / NB * RN;
    const au = -Hz / r * Math.log(1 - nrnd() * (1 - Math.exp(-r / Hz)));  // |u| z rozkładu ~exp(-r|u|/Hz)
    const u = Math.min(1, au) * (nrnd() < 0.5 ? -1 : 1), th = nrnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    const set = sets[nrnd() < 0.012 ? 1 : 0];
    set.p.push(r * q * Math.cos(th), r * u, r * q * Math.sin(th));
    const t = tints[Math.floor(nrnd() * tints.length)], b = set === sets[1] ? 0.7 + nrnd() * 0.3 : 0.3 + nrnd() * 0.7;
    set.c.push(t[0] * b, t[1] * b, t[2] * b);
    set.r.push(nrnd()); set.d.push(MW_STAR_DENSITY * fR(r) * Math.exp(-Math.abs(r * u) / Hz));
  }
  for (const set of sets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(set.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(set.c, 3));
    g.setAttribute('rank', new THREE.Float32BufferAttribute(set.r, 1));
    g.setAttribute('dens', new THREE.Float32BufferAttribute(set.d, 1));
    const pts = new THREE.Points(g, skyPointsMaterial(set.size, nearExtra));
    pts.frustumCulled = false;
    near.add(pts);
  }
  near.userData.count = sets[0].p.length / 3 + sets[1].p.length / 3;
  mode7Group.add(near);
  // najbardziej znane gwiazdy (poświata + podpis); położenie liczone co klatkę (daleko = na niebie)
  const namedList = [['Alfa Centauri (4,4 lat św.)', 4.37], ['Syriusz (8,6)', 8.6], ['Wega (25)', 25], ['Arktur (37)', 37], ['Gwiazda Polarna (430)', 433],
    ['Plejady (444)', 444], ['Betelgeza (550)', 548], ['Mgławica Oriona (1340)', 1344]];
  const named = namedList.map(([name, d], i) => {
    const dir = new THREE.Vector3(Math.cos(i * 2.4), (rnd() - 0.5) * 0.6, Math.sin(i * 2.4)).normalize();
    const sp = makeGlowSprite(0xfff0d0, 1, 1);
    mode7Group.add(sp);
    const label = makeLabel(name);
    mode7Group.add(label);
    return { sprite: sp, label, pos: dir.multiplyScalar(d), size: d * 0.03 + 0.15, d };
  });

  // pas Drogi Mlecznej i jasne centrum na niebie (gdy jesteś w środku Galaktyki)
  const band = new THREE.Group();
  const BR = MW_SKY_M * 0.9;
  const bandMesh = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, 2 * BR * Math.tan(14 * DEG), 128, 1, true),
    new THREE.MeshBasicMaterial({ map: makeMilkyWayBandTexture(), transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  band.add(bandMesh);
  const core = makeGlowSprite(0xffe2b0, 2 * BR * Math.tan(10 * DEG), 0, softGlowTexture);
  core.position.set(0, 0, -BR);
  band.add(core);
  mode7Group.add(band);

  // Układ Słoneczny (jednostki: j.a.) i obłok Oorta
  const solar = new THREE.Group();
  const nep = BODIES.find(b => b.id === 'neptune').au;
  for (const b of BODIES) if (b.au > 0 && b.id !== 'pluto' && b.id !== 'earth') solar.add(makeCircleLineXZ(b.au, 256, b.color, 0.7));
  const earthOrbit = makeCircleLineXZ(1, 2048, 0x3d7fe0, 0.8);     // Ziemia leży dokładnie na wierzchołku 0 tej linii
  solar.add(earthOrbit);
  const oort = starPoints(3000, 'mwoort', (v, r) => v.normalize().multiplyScalar(2000 + 98000 * Math.sqrt(r())), [0.7, 0.8, 1]);
  solar.add(oort);
  const sunMesh = new THREE.Mesh(sphereGeometryHi, new THREE.MeshBasicMaterial({ map: placeholderTexture(BODIES[0]), color: 0xffe2a0 }));
  useTextureFile(sunMesh.material, '2k_sun.jpg');
  sunMesh.scale.setScalar(SUN_R_AU);
  solar.add(sunMesh, makeGlowSprite(0xffd27a, SUN_R_AU * 4, 0.5));
  mode7Group.add(solar);

  // Ziemia i Księżyc (osobno, bez przenikania – oświetla je Słońce)
  const earthSys = new THREE.Group();
  earthSys.add(new THREE.PointLight(0xfff4e8, 2.6, 0, 0));          // światło Słońca (w środku układu)
  const earthPivot = new THREE.Group();
  const earth = buildVisual(BODIES.find(b => b.id === 'earth'), EARTH_R_AU);
  earthPivot.add(earth.group);
  const moon = buildVisual(MOONS.earth[0], MOON_R_AU);
  earthPivot.add(moon.group);
  earthSys.add(earthPivot);
  mode7Group.add(earthSys);

  // znaczniki o stałej wielkości (gdy Słońce albo Ziemia są za małe, by je zobaczyć)
  const marker = makeMarker(0xffe070, 12);
  const earthMarker = makeMarker(0x6fb0ff, 10);
  mode7Group.add(marker, earthMarker);
  const labels = {
    sun: makeLabel('Słońce'),
    earth: makeLabel('Ziemia – tu jesteśmy'),
    moon: makeLabel('Księżyc'),
    center: makeLabel('Centrum Galaktyki (czarna dziura Sagittarius A*)'),
    neptune: makeLabel('Orbita Neptuna'),
  };
  for (const l of Object.values(labels)) mode7Group.add(l);
  const matsOf = g => { const m = []; g.traverse(o => { if (o.material) { o.material.transparent = true; o.material.userData.baseOpacity = o.material.opacity; m.push(o.material); } }); return m; };
  return { galaxy, stars, galUniforms, disk, near, nearUniforms, named, band, bandMesh, core, solar, earthOrbit, oort, sunMesh, earthSys, earthPivot, earth: earth.group, moon: moon.group,
    marker, earthMarker, labels, nep, mats: { glow: [disk.material, bulge.material], solar: matsOf(solar) } };
})();
for (const m of mw.mats.glow) m.userData.baseOpacity = m.opacity;

// =====================================================================
//  TRYB 10: PODRÓŻ – od człowieka do całego kosmosu (jedna, ciągła skala)
//   Korzysta ze sceny Trybu 7 (Galaktyka, sąsiedztwo, Układ Słoneczny) i dokłada:
//   – powierzchnię Ziemi w prawdziwej skali: człowiek, wieża Eiffla, Mount Everest na zakrzywionym gruncie,
//   – sieć kosmiczną i Grupę Lokalną galaktyk (Andromeda) poza Drogą Mleczną.
//   Punkt zoomu: człowiek → (Ziemia schodzi w dół, widać jej krzywiznę) → środek Ziemi → Słońce → Galaktyka.
// =====================================================================
const J_EARTH_R = 6.371e6;
// mgła powietrza nad dalekim gruntem (w dzień) i drobne szczegóły gruntu z bliska – dopisywane do materiałów Ziemi
function jHazeShader(mat, U, detail) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;\nvarying float vVD;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vLP = position;\n  vVD = -mvPosition.z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLP; varying float vVD;
      uniform float uDetail; uniform vec3 uHaze; uniform float uHazeK; uniform float uDay;
      float jH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float jN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(jH(i), jH(i + vec2(1.0, 0.0)), f.x), mix(jH(i + vec2(0.0, 1.0)), jH(i + vec2(1.0, 1.0)), f.x), f.y); }
      float jDetail(vec2 p) {
        float fw = max(length(fwidth(p)), 1e-3), k = 0.0, wl = 24000.0;
        for (int i = 0; i < 10; i++) { k += (jN(p / wl + float(i) * 7.31) - 0.5) * 0.34 * smoothstep(3.0, 8.0, wl / fw); wl *= 0.5; }
        return k;
      }`);
    if (detail) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float k = jDetail(vLP.xz) * uDetail; diffuseColor.rgb *= vec3(1.0 + k * 1.1, 1.0 + k, 1.0 + k * 0.8); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, (1.0 - exp(-vVD * uHazeK)) * uDay);`);
  };
  mat.customProgramCacheKey = () => 'jhaze' + (detail ? 'd' : '');
  mat.needsUpdate = true;
}
const J_ATMO_VERTEX = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
// rozpraszanie Rayleigha: niebieskie światło rozprasza się mocniej; gęstość powietrza maleje wykładniczo z wysokością.
// Odległości liczone względem środka Ziemi z wartości podanych z JS (podwójna precyzja) – działa i przy 1 m = 1 m.
const J_ATMO_FRAGMENT = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uUp, uSun;
uniform float uRh, uR, uHs, uCG, uCA, uI;
varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vW - cameraPosition);
  float b = uRh * dot(d, uUp);
  float da = b * b - uCA;
  if (da <= 0.0) discard;
  float sq = sqrt(da);
  float t0 = max(0.0, -b - sq), t1 = -b + sq;
  float dg = b * b - uCG;
  if (b < 0.0 && dg > 0.0) t1 = min(t1, max(t0, -b - sqrt(dg)));
  if (t1 <= t0) discard;
  const int N = 12;
  float len = t1 - t0;
  vec3 beta = vec3(0.16, 0.37, 0.85);
  vec3 sum = vec3(0.0);
  float od = 0.0;
  for (int i = 0; i < N; i++) {
    float fa = float(i) / float(N), fb = float(i + 1) / float(N);
    float ta = t0 + len * fa * fa, tb = t0 + len * fb * fb;          // gęściej blisko oka (tam powietrze jest gęste)
    vec3 p = uUp * uRh + d * (0.5 * (ta + tb));
    float r = length(p);
    float dens = exp(-max(0.0, r - uR) / uHs) * (tb - ta) / uHs;
    float lit = smoothstep(-0.12, 0.08, dot(p / r, uSun));
    sum += (exp(-beta * od) - exp(-beta * (od + dens))) * lit;      // światło rozproszone na tym odcinku i osłabione po drodze
    od += dens;
  }
  float mu = dot(d, uSun);
  vec3 col = sum * 0.75 * (1.0 + mu * mu) * uI;
  col = 1.0 - exp(-col * 1.3);
  gl_FragColor = vec4(col, exp(-0.45 * od));
}`;
// Próbnik kuli Ziemi: kierunek (z jej środka) → współrzędne tekstury i kolor. Model ma własny układ tekstury,
// więc szukamy trójkąta, przez który przechodzi ten kierunek (kosze wg kierunku przyspieszają szukanie).
function makeGlobeSampler(root) {
  let mesh = null;
  root.traverse(o => { if (!mesh && o.isMesh && o.geometry.attributes.uv && o.material.map && o.material.map.image) mesh = o; });
  if (!mesh) return null;
  root.updateMatrixWorld(true);
  const M = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const g = mesh.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index;
  const vp = new Float32Array(P.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(M); vp[i * 3] = v.x; vp[i * 3 + 1] = v.y; vp[i * 3 + 2] = v.z; }
  const nT = (I ? I.count : P.count) / 3, tri = new Uint32Array(nT * 3);
  for (let k = 0; k < nT * 3; k++) tri[k] = I ? I.getX(k) : k;
  const BW = 96, BH = 48, bins = Array.from({ length: BW * BH }, () => []);
  const binOf = (x, y, z) => {
    const l = Math.hypot(x, y, z) || 1;
    const bi = Math.min(BH - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, y / l))) / Math.PI * BH));
    return [bi, Math.floor((Math.atan2(z, x) + Math.PI) / (2 * Math.PI) * BW) % BW];
  };
  for (let t = 0; t < nT; t++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { const j = tri[t * 3 + k] * 3; x += vp[j]; y += vp[j + 1]; z += vp[j + 2]; }
    const [bi, bj] = binOf(x, y, z);
    bins[bi * BW + bj].push(t);
  }
  const out = { u: 0, v: 0 };
  const hit = (t, dx, dy, dz) => {                      // promień ze środka (Möller–Trumbore)
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3;
    const e1x = vp[b] - vp[a], e1y = vp[b + 1] - vp[a + 1], e1z = vp[b + 2] - vp[a + 2];
    const e2x = vp[c] - vp[a], e2y = vp[c + 1] - vp[a + 1], e2z = vp[c + 2] - vp[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det, tx = -vp[a], ty = -vp[a + 1], tz = -vp[a + 2];
    const bu = (tx * px + ty * py + tz * pz) * inv;
    if (bu < -1e-6 || bu > 1 + 1e-6) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const bv = (dx * qx + dy * qy + dz * qz) * inv;
    if (bv < -1e-6 || bu + bv > 1 + 1e-6) return false;
    if ((e2x * qx + e2y * qy + e2z * qz) * inv <= 0) return false;
    const ia = tri[t * 3], ib = tri[t * 3 + 1], ic = tri[t * 3 + 2], w = 1 - bu - bv;
    out.u = U.getX(ia) * w + U.getX(ib) * bu + U.getX(ic) * bv;
    out.v = U.getY(ia) * w + U.getY(ib) * bu + U.getY(ic) * bv;
    return true;
  };
  let last = 0;
  function uvAt(d) {
    if (hit(last, d.x, d.y, d.z)) return out;
    const [bi, bj] = binOf(d.x, d.y, d.z);
    const wide = bi <= 1 || bi >= BH - 2;
    for (let i = Math.max(0, bi - 1); i <= Math.min(BH - 1, bi + 1); i++) {
      for (let jj = wide ? 0 : -1; jj <= (wide ? BW - 1 : 1); jj++) {
        const j = wide ? jj : (bj + jj + BW) % BW;
        for (const t of bins[i * BW + j]) if (hit(t, d.x, d.y, d.z)) { last = t; return out; }
      }
    }
    return null;
  }
  // piksele tekstury (kolor w danym miejscu)
  const map = mesh.material.map, img = map.image;
  const TW = Math.min(2048, img.width), TH = Math.min(2048, img.height);
  const [cv, ctx] = makeCanvas(TW, TH);
  ctx.drawImage(img, 0, 0, TW, TH);
  const px = ctx.getImageData(0, 0, TW, TH).data;
  function colorAt(u, v, res) {
    u = u - Math.floor(u); v = v - Math.floor(v);
    if (map.flipY) v = 1 - v;
    const x = u * TW - 0.5, y = v * TH - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let c = 0; c < 3; c++) {
      const g2 = (xx, yy) => px[((Math.min(TH - 1, Math.max(0, yy)) * TW) + ((xx % TW + TW) % TW)) * 4 + c];
      res[c] = (g2(x0, y0) * (1 - fx) + g2(x0 + 1, y0) * fx) * (1 - fy) + (g2(x0, y0 + 1) * (1 - fx) + g2(x0 + 1, y0 + 1) * fx) * fy;
    }
    return res;
  }
  return { uvAt, colorAt, map, mesh };
}
const J_LOG_MAX = Math.log10(M_PER_LY / J_SCALE_START_M);        // 1 m w goglach = J_SCALE_START_M m naprawdę
const J_LOG_MIN = Math.log10(MODE5_SCALE_MIN * 1e-6);            // najmocniejsze oddalenie Trybu 5 (sieć kosmiczna)
const J_BELOW_FROM = 8.7, J_BELOW_TO = 9.15;                      // tu punkt centralny przechodzi z człowieka na całą Ziemię
const J_COSMOS_LOG = Math.log10(MODE5_SCALE_MAX * 1e-6);             // dalej: pełna scena z Trybu 5 (galaktyki, sieć, tło)
state.journey = false;
const journey = (() => {
  const layer = new THREE.Group();                                // powierzchnia: jednostki = metry, (0,0,0) = stopy człowieka
  mode7Group.add(layer);
  // grunt: czasza kuli (promień Ziemi) – gęsta siatka blisko człowieka, rzadsza dalej. Kolory bierze z tej samej
  // tekstury co kula Ziemi (wypalane przy pierwszym wejściu, journeyPrepare), więc przy oddalaniu grunt płynnie
  // przechodzi w Ziemię; z bliska dochodzą drobne szczegóły (szum w kilku skalach).
  // czasza sięga ok. 3800 km od człowieka (A = 0,6 rad) – dalej niż horyzont, aż Ziemia jest mała; tekstura ma
  // nieliniowe współrzędne (CAP_P), więc blisko człowieka jest szczegółowa, a przy brzegu rzadsza
  const A = 0.6, NR = 140, NS = 160, CAP_W = J_EARTH_R * Math.sin(A), CAP_P = 0.6;
  const pos = [], col = [], uv = [], idx = [];
  const c = new THREE.Color(), c2 = new THREE.Color();
  const EV = new THREE.Vector3(14000, 0, -26000);                 // Everest: 30 km na wprost i w prawo
  const vtx = (x, y, z) => {
    pos.push(x, y, z);
    const rho = Math.hypot(x, z), rq = Math.pow(rho / CAP_W, CAP_P);
    uv.push(rho > 0 ? 0.5 + 0.5 * x / rho * rq : 0.5, rho > 0 ? 0.5 + 0.5 * z / rho * rq : 0.5);
    const dEv = Math.hypot(x - EV.x, z - EV.z);
    c.setRGB(1, 1, 1);
    if (dEv < 40000) c.lerp(c2.setRGB(0.85, 0.8, 0.75), 1 - dEv / 40000);   // Himalaje: skały
    col.push(c.r, c.g, c.b);
  };
  vtx(0, 0, 0);
  for (let i = 1; i <= NR; i++) {
    const a = A * Math.pow(i / NR, 2.2);
    for (let j = 0; j < NS; j++) {
      const f = j / NS * Math.PI * 2;
      vtx(J_EARTH_R * Math.sin(a) * Math.cos(f), J_EARTH_R * (Math.cos(a) - 1), J_EARTH_R * Math.sin(a) * Math.sin(f));
    }
  }
  for (let j = 0; j < NS; j++) idx.push(0, 1 + (j + 1) % NS, 1 + j);
  for (let i = 1; i < NR; i++) for (let j = 0; j < NS; j++) {
    const a0 = 1 + (i - 1) * NS + j, a1 = 1 + (i - 1) * NS + (j + 1) % NS, b0 = a0 + NS, b1 = a1 + NS;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const skyU = { uDetail: { value: 1 }, uHaze: { value: new THREE.Color(0.72, 0.8, 0.9) }, uHazeK: { value: 0 }, uDay: { value: 1 } };
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a8a6a, vertexColors: true, roughness: 0.92, metalness: 0, transparent: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  jHazeShader(groundMat, skyU, true);
  const ground = new THREE.Mesh(geo, groundMat);
  ground.frustumCulled = false;
  ground.renderOrder = -1;
  layer.add(ground, new THREE.HemisphereLight(0xcfe4ff, 0x5a6a4a, 0.55));
  // obiekty w prawdziwej wielkości (modele z Trybu 6)
  const drop = d => J_EARTH_R * (Math.cos(d / J_EARTH_R) - 1);       // krzywizna: ile grunt opada na odległość d
  const put = (id, x, z, yaw = 0) => {
    const def = SCALE_OBJECTS.find(o => o.id === id);
    const m = (SCALE_BUILDERS[id] || SCALE_BUILDERS.hamster)();
    const g = new THREE.Group();
    g.add(m);
    m.traverse(o => { o.frustumCulled = false; });
    g.scale.setScalar(def.sizeM);
    g.position.set(x, drop(Math.hypot(x, z)), z);
    g.rotation.y = yaw;
    layer.add(g);
    const label = makeLabel(`${def.name} · ${def.sizeText}`);
    label.material.depthTest = false; label.renderOrder = 40;
    mode7Group.add(label);
    return { def, g, label, mixer: m.userData.mixer || null, top: def.sizeM };
  };
  const items = [put('human', 0, 0, Math.PI), put('bus', 6, -14, 0.4), put('eiffel', -170, -420, 0.3), put('everest', EV.x, EV.z, 0)];
  // Ziemia (model z teksturą) – zastępuje Ziemię z Trybu 7; ląd u góry
  const earthV = buildVisual(BODIES.find(b => b.id === 'earth'), 1), earth = earthV.group;
  for (const m of earthV.materials || []) jHazeShader(m, skyU, false);
  const earthWrap = new THREE.Group();
  earthWrap.add(earth);
  mode7Group.add(earthWrap);
  // atmosfera: powłoka nad Ziemią; jej kolor liczy shader (rozpraszanie światła w powietrzu wzdłuż promienia wzroku):
  // z dołu niebieskie niebo i jaśniejszy horyzont, z kosmosu cienka niebieska poświata nad brzegiem Ziemi
  const atmoU = { uUp: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uRh: { value: 1 }, uR: { value: 1 }, uHs: { value: 1 },
    uCG: { value: 0 }, uCA: { value: 0 }, uI: { value: 1.6 } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({
    uniforms: atmoU, vertexShader: J_ATMO_VERTEX, fragmentShader: J_ATMO_FRAGMENT, side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, blendEquation: THREE.AddEquation,
  }));
  atmo.frustumCulled = false;
  atmo.renderOrder = 5;
  mode7Group.add(atmo);
  const sun = makeGlowSprite(0xfff0d0, 1, 1), sunCore = makeGlowSprite(0xffffff, 1, 1);
  sun.renderOrder = sunCore.renderOrder = 6;
  mode7Group.add(sun, sunCore);
  const earthLabel = makeLabel('Ziemia · średnica 12 742 km');
  mode7Group.add(earthLabel);
  // sieć kosmiczna i Grupa Lokalna (jednostki: mln lat św.; Droga Mleczna w (0,-0.35,-0.7) jak w Trybie 5)
  const web = new THREE.Group();
  const webPts = new THREE.Points(cosmos.web.geometry, skyPointsMaterial(2.0));
  webPts.frustumCulled = false;
  const gp = [], gc = [];
  for (const gx of galaxies) { if (gx.fixed) continue; gp.push(gx.pos.x, gx.pos.y, gx.pos.z); gc.push(0.7, 0.75, 0.9); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  const nearGal = new THREE.Points(gg, skyPointsMaterial(2.6));
  nearGal.frustumCulled = false;
  const andro = galaxyQuad('spiral2', 0.22, 0, 0);
  andro.position.set(0.55, 0.25, -0.8).normalize().multiplyScalar(2.5);
  andro.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.9, 0.35, 0.3).normalize());
  web.add(webPts, nearGal, andro);
  web.visible = false;
  mode7Group.add(web);
  const webLabels = [['Galaktyka Andromedy (2,5 mln lat św.)', andro.position.clone()], ['Gromada w Pannie (54 mln lat św.)', new THREE.Vector3(-30, 18, -42).normalize().multiplyScalar(54)]]
    .map(([t, p]) => { const l = makeLabel(t); mode7Group.add(l); return { l, p }; });
  const mats = [webPts.material, nearGal.material, andro.material];
  for (const m of mats) m.userData.baseOpacity = m.opacity;
  return { layer, ground, groundMat, skyU, items, earth, earthWrap, earthLabel, atmo, atmoU, sun, sunCore, capW: CAP_W, capP: CAP_P, Qa: new THREE.Quaternion(), ready: false, bake: null,
    web, webLabels, mats, mwPosInWeb: new THREE.Vector3(0, -0.35, -0.7) };
})();
journey.layer.visible = journey.earthWrap.visible = journey.atmo.visible = journey.sun.visible = journey.sunCore.visible = false;

// raz, przy pierwszym wejściu: miejsce człowieka na kuli Ziemi (ląd, nie ocean ani chmury) i tekstura gruntu
// wycięta z tekstury kuli – dzięki temu grunt i kula Ziemi wyglądają tak samo i przechodzą w siebie bez przeskoku
function journeyPrepare() {
  const J = journey;
  if (J.ready) return;
  J.ready = true;
  J.earthWrap.position.set(0, 0, 0); J.earthWrap.quaternion.identity(); J.earthWrap.scale.setScalar(1);
  const smp = makeGlobeSampler(J.earthWrap);
  if (!smp) return;
  const res = [0, 0, 0], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), d2 = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(J.earth.quaternion);
  const land = d => {
    const uv = smp.uvAt(d);
    if (!uv) return 0;
    const [r, g, b] = smp.colorAt(uv.u, uv.v, res);
    if (b > r + 12 && b >= g - 6) return 0;                       // ocean
    if (r > 165 && g > 165 && b > 165) return 0;                  // chmury, lód
    if (Math.max(r, g, b) < 25) return 0;
    return g >= b && g >= r * 0.8 ? 1.3 : 1;                      // zielony ląd – najlepiej
  };
  let best = new THREE.Vector3(0, 1, 0), bestS = -1;
  for (const d of fibonacciDirs(400)) {
    if (Math.abs(d.dot(axis)) > 0.8) continue;                    // nie przy biegunach
    e1.crossVectors(d, Math.abs(d.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
    e2.crossVectors(d, e1);
    let sc = land(d) * 3;
    for (const r of [0.012, 0.03, 0.05, 0.07]) for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + r * 10;
      sc += land(d2.copy(d).addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r).normalize());
    }
    if (sc > bestS) { bestS = sc; best = d.clone(); }
  }
  J.Qa.setFromUnitVectors(best, UP);
  const N = 1024, [cv, ctx] = makeCanvas(N, N);
  J.bake = { smp, N, cv, ctx, img: ctx.createImageData(N, N), row: 0, QaI: J.Qa.clone().invert() };
}
// tekstura gruntu wypalana po kilkadziesiąt wierszy na klatkę (żeby nie było przycięcia przy wejściu w tryb)
function journeyBakeStep() {
  const J = journey, B = J.bake;
  if (!B) return;
  const res = [0, 0, 0], d = _jC, W = J.capW, N = B.N;
  for (const end = Math.min(N, B.row + 64); B.row < end; B.row++) {
    const py = B.row;
    for (let px = 0; px < N; px++) {
      const qx = (px + 0.5) / N * 2 - 1, qz = (py + 0.5) / N * 2 - 1, rq = Math.hypot(qx, qz);
      const rho = W * Math.pow(rq, 1 / J.capP), a = Math.asin(Math.min(1, rho / J_EARTH_R)), sa = Math.sin(a);
      d.set(rq > 0 ? sa * qx / rq : 0, Math.cos(a), rq > 0 ? sa * qz / rq : 0).applyQuaternion(B.QaI);
      const uv = B.smp.uvAt(d);
      if (uv) B.smp.colorAt(uv.u, uv.v, res);
      const k = (py * N + px) * 4;
      B.img.data[k] = res[0]; B.img.data[k + 1] = res[1]; B.img.data[k + 2] = res[2]; B.img.data[k + 3] = 255;
    }
  }
  if (B.row < N) return;
  B.ctx.putImageData(B.img, 0, 0);
  const tex = canvasTexture(B.cv);
  tex.flipY = false;
  tex.anisotropy = 4;
  J.groundMat.map = tex;
  J.groundMat.color.setHex(0xffffff);
  J.groundMat.needsUpdate = true;
  J.bake = null;
}
function layoutMode10() {
  state.journey = true;
  layoutMode7();
  state.journey = true;
  journeyPrepare();
  // Słońce wysoko nad człowiekiem (dzień): miejsce Ziemi na orbicie dobrane tak, żeby Słońce było jak najbliżej
  // wysokości J_SUN_ELEVATION_DEG, z przodu (raczej z boku niż prosto w oczy)
  mwOrientation(99);
  const fwd = state.mwFwd, right = new THREE.Vector3().crossVectors(fwd, UP).normalize(), QSi = mwQuatSol.clone().invert();
  let bestV = null, bestS = -1e9;
  const el = J_SUN_ELEVATION_DEG * DEG;
  for (let az = -85; az <= 85; az += 5) {
    const D = fwd.clone().multiplyScalar(Math.cos(el) * Math.cos(az * DEG)).addScaledVector(right, Math.cos(el) * Math.sin(az * DEG)).addScaledVector(UP, Math.sin(el));
    const v = D.applyQuaternion(QSi);
    v.y = 0;
    if (v.lengthSq() < 1e-6) continue;
    v.normalize();
    const wv = v.clone().applyQuaternion(mwQuatSol);
    const sc = -Math.abs(Math.asin(wv.y) - el) - 0.15 * Math.max(0, 20 * DEG - Math.abs(az * DEG));
    if (sc > bestS) { bestS = sc; bestV = v; }
  }
  if (bestV) mwSetEarthDir(bestV.negate());
  state.mwLog = J_LOG_MAX;
  state.jFloorY = renderer.xr.isPresenting ? 0 : eyePos.y - 1.6;
  state.jEye = eyePos.clone();
  state.jCosmos = false;
}
const mwLogMin = () => (state.journey ? J_LOG_MIN : MW_LOG_MIN);
const mwLogMax = () => (state.journey ? J_LOG_MAX : MW_LOG_MAX);

const _jSun = new THREE.Vector3(), _jE = new THREE.Vector3(), _jA = new THREE.Vector3(), _jB = new THREE.Vector3(), _jC = new THREE.Vector3(), _jD = new THREE.Vector3(), _jN = new THREE.Vector3(), _jQ = new THREE.Quaternion(), _jQ2 = new THREE.Quaternion();
// co klatkę (z updateMode7): powierzchnia Ziemi, Ziemia, sieć kosmiczna
function updateJourney(dt, L, s, w, w2, Rk, piv, sAU, sunW) {
  const J = journey, on = state.journey;
  J.layer.visible = J.earthWrap.visible = J.web.visible = on && true;
  J.atmo.visible = J.sun.visible = J.sunCore.visible = false;
  for (const it of J.items) it.label.visible = false;
  J.earthLabel.visible = false;
  for (const wl of J.webLabels) wl.l.visible = false;
  mwSkyUniforms.uDim.value = 1;
  stars.material.color.setScalar(1);
  if (!on) return;
  mw.earth.visible = false;
  mw.labels.earth.visible = mw.labels.earth.visible && L < 8.6;
  const k = s / M_PER_LY;                                          // metry w goglach na 1 m naprawdę
  // środek Ziemi (dokładnie, w liczbach podwójnej precyzji) i punkt pod stopami człowieka
  const C = _jA.copy(mwEarthDir).multiplyScalar(1 - w).multiplyScalar(sAU).applyQuaternion(mwQuatSol).add(piv);
  J.earthWrap.position.copy(C);
  J.earthWrap.scale.setScalar(Rk);
  J.earthWrap.visible = L > 3 && L < 10.8;          // bliżej – grunt (czasza) z tą samą teksturą, ale ostrzejszą
  // stopy człowieka: "szczyt" Ziemi (nad środkiem)
  const n = _jN.set(0, 1, 0);
  const S = _jB.copy(C).addScaledVector(n, Rk);
  J.layer.position.copy(S);
  J.layer.scale.setScalar(k);
  J.layer.quaternion.setFromUnitVectors(UP, n).multiply(_jQ2.setFromAxisAngle(UP, state.mwYaw)).multiply(_jQ.setFromUnitVectors(new THREE.Vector3(0, 0, -1), state.mwFwd));
  J.earthWrap.quaternion.copy(J.layer.quaternion).multiply(J.Qa);   // kula Ziemi obrócona tak, jak wycięty z niej grunt
  J.layer.visible = L > 10.6;
  // grunt → kula Ziemi: grunt (ta sama tekstura) płynnie znika, odsłaniając kulę pod spodem
  journeyBakeStep();
  const capA = THREE.MathUtils.smoothstep(L, 10.2, 10.7);
  J.groundMat.opacity = capA;
  J.ground.visible = capA > 0.003;
  J.skyU.uDetail.value = THREE.MathUtils.smoothstep(L, 11.9, 12.6);
  // niebo i atmosfera (liczone w podwójnej precyzji względem środka Ziemi)
  const dC = _jD.copy(eyePos).sub(C), dist = dC.length(), h = dist - Rk, At = J_ATMOSPHERE_KM * 1000 * k, U = J.atmoU;
  J.atmo.visible = L > 6;
  J.atmo.position.copy(C);
  J.atmo.scale.setScalar(Rk + At);
  U.uUp.value.copy(dC).divideScalar(dist);
  U.uRh.value = dist; U.uR.value = Rk; U.uHs.value = 8000 * k;
  U.uCG.value = h * (2 * Rk + h); U.uCA.value = (h - At) * (2 * Rk + h + At);
  const sunDir = _jE.copy(sunW).sub(C).normalize();
  U.uSun.value.copy(sunDir);
  const day = 1 - THREE.MathUtils.smoothstep(Math.log10(Math.max(1, h / k)), 3.9, 4.8);   // wysokość oczu naprawdę: do ~8 km dzień
  J.skyU.uDay.value = day;
  J.skyU.uHazeK.value = 1 / (35000 * k);
  const dim = 1 - day;                              // w dzień gwiazd nie widać
  mwSkyUniforms.uDim.value = dim;
  stars.material.color.setScalar(dim);
  mw.bandMesh.material.opacity *= dim;
  mw.core.material.opacity *= dim;
  for (const n of mw.named) n.sprite.material.opacity *= dim;
  const sunA = THREE.MathUtils.smoothstep(L, 9.2, 9.8);
  J.sun.visible = J.sunCore.visible = sunA > 0.01;
  J.sun.position.copy(eyePos).addScaledVector(sunDir, 2500);
  J.sunCore.position.copy(J.sun.position);
  J.sun.scale.setScalar(2500 * 0.5); J.sun.material.opacity = 0.5 * sunA;
  J.sunCore.scale.setScalar(2500 * 0.05); J.sunCore.material.opacity = sunA;
  for (const it of J.items) {
    if (it.mixer) it.mixer.update(dt);
    const h = it.top * k;                                          // wysokość w goglach
    it.g.visible = h > 0.0005 && L > 9.5;
    it.label.visible = J.layer.visible && h > 0.02 && h < 60;
    if (it.label.visible) placeLabel(it.label, _jA.copy(it.g.position).setY(it.g.position.y + it.top).applyMatrix4(J.layer.matrixWorld), 0.02, LABEL_ANGLE_DEG * 1.2);
  }
  J.layer.updateMatrixWorld(true);
  J.earthLabel.visible = Rk > 0.05 && Rk < 2.5 && L > 6;
  if (J.earthLabel.visible) placeLabel(J.earthLabel, C, Rk * 1.1, LABEL_ANGLE_DEG * 1.2);
  // sieć kosmiczna: Droga Mleczna (jej środek) w miejscu Galaktyki z Trybu 7
  const sMly = s * 1e6;
  const webA = 0;                                                  // dalej niż Galaktyka: pełna scena Trybu 5 (journeyCosmos)
  J.web.visible = webA > 0.01;
  if (J.web.visible) {
    const G = _jA.copy(SUN_GAL).multiplyScalar(-s).applyQuaternion(mwQuat).add(piv);   // środek Galaktyki
    J.web.quaternion.copy(mwQuat);
    J.web.scale.setScalar(sMly);
    J.web.position.copy(J.mwPosInWeb).multiplyScalar(-sMly).applyQuaternion(mwQuat).add(G);
    for (const m of J.mats) m.opacity = m.userData.baseOpacity * webA;
    for (const wl of J.webLabels) {
      wl.l.visible = webA > 0.5 && L > -7.5;
      if (wl.l.visible) placeLabel(wl.l, _jB.copy(wl.p).sub(J.mwPosInWeb).multiplyScalar(sMly).applyQuaternion(mwQuat).add(G), 0.03, LABEL_ANGLE_DEG * 1.2);
    }
  }
}
// co jest "na pierwszym planie" przy danej skali (do napisu na panelu)
function journeyFocusText(L) {
  const m = M_PER_LY / Math.pow(10, L);                            // ile metrów naprawdę = 1 m w goglach
  const evMm = 8849 / (J_EARTH_R * 2) * Math.max(0.2, 2 * J_EARTH_R / m) * 1000;
  if (m < 8) return 'człowiek';
  if (m < 60) return 'autobus';
  if (m < 2000) return 'wieża Eiffla';
  if (m < 60000) return 'Mount Everest';
  if (m < 2e6) return 'Himalaje i krzywizna Ziemi';
  if (m < 4e7) return `cała Ziemia – Everest byłby na niej wysoki na ${evMm < 1 ? evMm.toFixed(2) : evMm.toFixed(1)} mm`;
  if (m < 2e9) return 'Ziemia i Księżyc';
  if (m < 2e13) return 'Układ Słoneczny';
  if (m < 2e17) return 'najbliższe gwiazdy';
  if (m < 2e21) return 'Droga Mleczna';
  if (L >= J_COSMOS_LOG) return 'Droga Mleczna z daleka';
  if (m < 3e22) return 'Grupa Lokalna: Droga Mleczna, Andromeda i setki galaktyk wokół';
  return 'sieć kosmiczna – włókna i gromady galaktyk';
}

const mwPivot = new THREE.Vector3();
const mwQuat = new THREE.Quaternion();
const mwEarthDir = new THREE.Vector3(1, 0, 0);          // kierunek Słońce -> Ziemia (w płaszczyźnie orbit, j.a.)
state.mwLog = Math.log10(MW_START_SIZE_M / 100000);
state.mwYaw = 0;
state.mwAnim = null;
state.mwSpeed = MW_ZOOM_RATE;
// state.mwLog to pozycja na trasie: zoom do Słońca → przelot do Ziemi → zoom do Ziemi
const MW_LOG_MIN = Math.log10(0.6 / 100000), MW_LOG_MAX = Math.log10(MW_SCALE_MAX);
// state.mwLog = log10(m/rok św.); w = jak daleko punkt zoomu przesunął się ze Słońca do Ziemi
function mwPath(u) {
  if (state.journey) return { L: u, w: 1 };            // Tryb 10: od Ziemi do końca punktem centralnym jest Ziemia
  return { L: u, w: THREE.MathUtils.smoothstep(u, MW_TO_EARTH_FROM, MW_TO_EARTH_TO) };
}

const _mwBase = new THREE.Quaternion(), _mwTilt = new THREE.Quaternion();
const mwQuatSol = new THREE.Quaternion();                     // Układ Słoneczny: płaszczyzna orbit nachylona do dysku Galaktyki
const MW_ECLIPTIC_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), MW_ECLIPTIC_TILT_DEG * DEG);
function mwOrientation(L = -99) {
  _mwBase.setFromUnitVectors(new THREE.Vector3(0, 0, -1), state.mwFwd || new THREE.Vector3(0, 0, -1));
  // z daleka dysk pochylony do Ciebie; w środku Galaktyki mniej – pas Drogi Mlecznej bliżej wysokości oczu
  const tilt = THREE.MathUtils.lerp(MW_TILT_DEG, MW_TILT_INSIDE_DEG, THREE.MathUtils.smoothstep(L, -3, -1.5));
  _mwTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt * DEG);
  mwQuat.setFromAxisAngle(UP, state.mwYaw).multiply(_mwBase).multiply(_mwTilt);
  mwQuatSol.copy(mwQuat).multiply(MW_ECLIPTIC_Q);
  return mwQuat;
}

function layoutMode7() {
  state.journey = false;
  const fwd = horizontalForward();
  mwPivot.copy(eyePos).addScaledVector(fwd, MW_DISTANCE_M);
  mwPivot.y = eyePos.y - 0.15;
  state.mwFwd = fwd.clone();
  state.mwLog = Math.log10(MW_START_SIZE_M / 100000);
  state.mwYaw = 0;
  state.mwAnim = null;
  // Ziemia ok. 60° w prawo od kierunku patrzenia: lecąc do niej, mijasz (małe) Słońce z boku
  mwOrientation(99);                                  // kierunek Ziemi liczony dla widoku "z wnętrza" Galaktyki
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const want = fwd.clone().multiplyScalar(Math.cos(60 * DEG)).addScaledVector(right, Math.sin(60 * DEG));
  want.applyQuaternion(mwQuatSol.clone().invert());
  want.y = 0;
  mwSetEarthDir(want.normalize());
  if (!renderer.xr.isPresenting) orbitControls.target.copy(mwPivot);
}
// kierunek Słońce → Ziemia (w płaszczyźnie orbit); orbita i Księżyc dopasowują się do niego
function mwSetEarthDir(dir) {
  mwEarthDir.copy(dir);
  mw.earthPivot.position.copy(mwEarthDir);
  mw.earthOrbit.rotation.y = Math.atan2(-mwEarthDir.z, mwEarthDir.x);
  // Księżyc: trochę za Ziemią i w bok (widać go obok niej)
  const side = new THREE.Vector3(-mwEarthDir.z, 0, mwEarthDir.x);
  mw.moon.position.copy(mwEarthDir).multiplyScalar(0.8).addScaledVector(side, -0.6).normalize().multiplyScalar(MOON_DIST_AU);
}
function mwZoom(decades) { state.mwAnim = null; state.mwLog = THREE.MathUtils.clamp(state.mwLog + decades, mwLogMin(), mwLogMax()); }
function mwGoTo(log) { state.mwAnim = { from: state.mwLog, to: log, t: 0, dur: Math.max(1, Math.abs(log - state.mwLog) / state.mwSpeed) }; }
function mwSetScale(s) { state.mwAnim = null; state.mwLog = THREE.MathUtils.clamp(Math.log10(s), mwLogMin(), mwLogMax()); }

// płynne pojawianie/znikanie warstwy w zakresie skali (log10 m/rok św.)
const fadeWindow = (L, a0, a1, b0, b1) => Math.max(0, Math.min(1, (L - a0) / (a1 - a0), (b1 - L) / (b1 - b0)));
function setLayerOpacity(mats, alpha, group) {
  if (group) group.visible = alpha > 0.01;
  for (const m of mats) m.opacity = m.userData.baseOpacity * alpha;
}

const _mwF = new THREE.Vector3(), _mwP = new THREE.Vector3(), _mwW = new THREE.Vector3();
function mwStepAnim(dt) {
  const a = state.mwAnim;
  if (a) {
    a.t = Math.min(1, a.t + dt / a.dur);
    state.mwLog = THREE.MathUtils.lerp(a.from, a.to, smooth(a.t));
    if (a.t >= 1) state.mwAnim = null;
  }
}
// Podróż, dalej niż Galaktyka: galaktyki, sieć kosmiczna i tło z dawnego Trybu 5 pojawiają się płynnie wokół
// Drogi Mlecznej (ona sama zostaje – ten sam obraz dysku, w tym samym miejscu i ułożeniu, więc nic nie przeskakuje)
const J_COSMOS_FROM = J_COSMOS_LOG + 0.5, J_COSMOS_TO = J_COSMOS_LOG - 0.3;
function journeyCosmos(dt) {
  mwStepAnim(dt);
  updateMode7(dt);
  const L = state.mwLog, cA = 1 - THREE.MathUtils.smoothstep(L, J_COSMOS_TO, J_COSMOS_FROM);
  mode5Group.visible = cA > 0.005;
  state.jCosmos = mode5Group.visible;
  if (!mode5Group.visible) return;
  universe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), state.mwFwd);
  universe.scale.setScalar(Math.pow(10, L + 6));                  // 1 m we wnętrzu „universe” = 1 mln lat św.
  // Droga Mleczna z „universe” dokładnie w środku obrazu dysku Galaktyki – cały kosmos oddala się razem z nią
  // (uwaga: localToWorld sam przelicza macierz, więc przesunięcie liczymy z kopii, zanim zmienimy position)
  universe.position.set(0, 0, 0);
  universe.updateMatrixWorld(true);
  _jB.copy(journey.mwPosInWeb).applyMatrix4(universe.matrixWorld);
  universe.position.copy(mw.galaxy.getWorldPosition(_jC)).sub(_jB);
  universe.updateMatrixWorld(true);
  for (const m of galaxyMeshes) m.material.opacity = cA;
  cosmos.web.material.opacity = cA;
  cosmos.web.material.transparent = true;
  cosmos.sky.material.transparent = true;
  cosmos.sky.material.opacity = cA;
  mode5Labels.visible = cA > 0.6;
  updateGalaxies(dt);
}
function updateMode7(dt) {
  mwStepAnim(dt);
  const { L, w } = mwPath(state.mwLog);
  const s = Math.pow(10, L), sAU = s / AU_PER_LY;      // s = metry na rok świetlny
  mwOrientation(L);
  mw.earth.rotation.y += dt * 0.05;
  // punkt zoomu: Słońce, w czasie przelotu przesuwa się do Ziemi (F – w j.a., w układzie Słońca)
  _mwF.copy(mwEarthDir).multiplyScalar(w);
  // duże Słońce odsuwamy trochę dalej, żeby nie "wejść" w nie (jak podchodzenie do kuli)
  const push = Math.max(0, SUN_R_AU * sAU + 0.7 - MW_DISTANCE_M) * (1 - w);
  const piv = _mwP.copy(mwPivot).addScaledVector(state.mwFwd, push);
  mwSkyUniforms.uCenter.value.copy(mwPivot);
  // Tryb 10: duża Ziemia leży POD Tobą (jej powierzchnia = podłoga), a przy oddalaniu maleje pod stopami;
  // dopiero gdy jest mała (< ~5 m), przesuwa się przed Ciebie – nigdy nie przelatujesz przez jej wnętrze
  let w2 = 0, Rk = 0;
  if (state.journey) {
    Rk = J_EARTH_R * s / M_PER_LY;
    // człowiek (stopy) w punkcie zoomu – na środku widoku – aż widać całą Ziemię; potem środek Ziemi.
    // Ziemia leży pod punktem zoomu, więc nigdy nie przelatujesz przez jej wnętrze.
    const f = THREE.MathUtils.smoothstep(L, J_BELOW_FROM, J_BELOW_TO);   // 0 = środek Ziemi, 1 = człowiek
    const toFloor = (mwPivot.y - state.jFloorY) * THREE.MathUtils.smoothstep(L, 13.5, 15.5);   // 1:1 – grunt na podłodze
    piv.addScaledVector(UP, -(Rk * f + toFloor));
  }
  const place = (g, focusLocal, scale, q = mwQuat) => {
    g.quaternion.copy(q);
    g.scale.setScalar(scale);
    g.position.copy(focusLocal).multiplyScalar(-scale).applyQuaternion(q).add(piv);
  };
  place(mw.galaxy, _mwW.copy(_mwF).divideScalar(AU_PER_LY).add(SUN_GAL), s);
  place(mw.near, _mwW.copy(_mwF).divideScalar(AU_PER_LY), s);
  place(mw.solar, _mwF, sAU, mwQuatSol);
  place(mw.earthSys, _mwF, sAU, mwQuatSol);
  mw.band.position.copy(mwPivot);
  mw.band.quaternion.copy(mwQuat);

  // co widać przy jakiej skali
  setLayerOpacity(mw.mats.glow, fadeWindow(L, -99, -98, -3.6, -2.8));
  const galG = THREE.MathUtils.smoothstep(L, MW_TO_DISK_FROM, MW_TO_DISK_TO);       // 1 = gwiazdy, 0 = obraz dysku
  mw.galUniforms.uGal.value = galG * THREE.MathUtils.lerp(1, MW_SKY_BAND_BRIGHTNESS, THREE.MathUtils.smoothstep(L, -2.2, -0.8))   // z wnętrza: pas na niebie
    * Math.min(1, Math.pow(10, 1.2 * (L + 4.2)));       // z daleka: im mniejsza Galaktyka, tym ciemniejsze punkty (jasność powierzchni stała)
  mw.disk.material.opacity *= 1 + (MW_DISK_FAR_OPACITY / 0.35 - 1) * (1 - galG);
  const nearA = THREE.MathUtils.smoothstep(L, MW_NEAR_FADE_TO, MW_NEAR_FADE_FROM);
  mw.nearUniforms.uAlpha.value = nearA;
  const uD = MW_STAR_DENSITY * Math.min(1, Math.pow(10, MW_NEAR_THIN * (L + 2.2)));
  mw.nearUniforms.uDisp.value = uD;
  // jasność: ile gwiazd nakłada się na jeden piksel w środku fragmentu (gwiazdy na drodze wzroku przez gęsty środek);
  // gdy dużo – każda ciemniejsza, więc środek świeci, ale nie robi się biała plama, a brzegi są „ziarniste”
  const rU = Math.min(MW_NEAR_RADIUS_LY, MW_NEAR_REAL_LY * Math.pow(MW_STAR_DENSITY / uD, 1 / MW_NEAR_SLOPE));
  const pxM = MW_DISTANCE_M * getPixelAngle();                        // ile metrów (w goglach) ma piksel na odległości Słońca
  const overlap = uD * 2 * Math.min(rU, 600) / (s * s) * 3 * pxM * pxM;
  mw.nearUniforms.uGain.value = Math.min(1, MW_NEAR_GAIN / Math.max(1e-6, overlap));
  stars.visible = L > -1 && !state.journey;            // z wnętrza Galaktyki: jeszcze tło dalekich gwiazd (w Podróży – gwiazdy sąsiedztwa)
  mw.near.visible = nearA > 0.01;
  const bandA = THREE.MathUtils.smoothstep(L, -2.6, -1.2);
  mw.bandMesh.material.opacity = bandA;
  mw.core.material.opacity = 0.45 * bandA;
  mw.band.visible = bandA > 0.01;
  const solarA = fadeWindow(L, 0.5, 1.5, 99, 100);
  setLayerOpacity(mw.mats.solar, solarA, mw.solar);
  mw.oort.material.opacity = solarA * (1 - THREE.MathUtils.smoothstep(L, 5.5, 6.5));
  mw.earthSys.visible = L > 3;
  mw.earth.visible = !state.journey;

  // znane gwiazdy: blisko – w przestrzeni, daleko – na niebie
  const namedA = THREE.MathUtils.smoothstep(L, -3.0, -2.4);
  for (const n of mw.named) {
    const p = n.sprite.position.copy(n.pos).sub(_mwW.copy(_mwF).divideScalar(AU_PER_LY)).multiplyScalar(s).applyQuaternion(mwQuat).add(piv);
    const d = p.distanceTo(mwPivot), k = d > MW_SKY_M ? MW_SKY_M / d : 1;
    if (k < 1) p.sub(mwPivot).multiplyScalar(k).add(mwPivot);
    n.sprite.scale.setScalar(n.size * s * k);
    n.sprite.material.opacity = namedA;
    n.sprite.visible = namedA > 0.01;
    n.label.visible = namedA > 0.5 && L < 4 && d > 0.04;
    if (n.label.visible) placeLabel(n.label, p, n.size * s * k * 0.3, LABEL_ANGLE_DEG);
  }

  // Słońce, Ziemia, Księżyc – położenia w świecie
  const sunW = _mwW.copy(_mwF).multiplyScalar(-sAU).applyQuaternion(mwQuatSol).add(piv);
  _jSun.copy(sunW);
  const sunR = SUN_R_AU * sAU;
  const px = getPixelAngle();
  mw.marker.position.copy(sunW);
  mw.marker.visible = sunR / Math.max(0.1, sunW.distanceTo(eyePos)) / px < 3;
  const lb = mw.labels;
  lb.sun.visible = true;
  placeLabel(lb.sun, sunW, Math.max(0.02, sunR * 1.15), LABEL_ANGLE_DEG);
  mw.earthSys.updateMatrixWorld(true);
  const earthW = new THREE.Vector3().setFromMatrixPosition(mw.earth.matrixWorld);
  const earthR = EARTH_R_AU * sAU;
  mw.earthMarker.position.copy(earthW);
  mw.earthMarker.visible = L > 4 && earthR / Math.max(0.1, earthW.distanceTo(eyePos)) / px < 3;
  lb.earth.visible = L > 4.5;
  if (lb.earth.visible) placeLabel(lb.earth, earthW, Math.max(0.02, earthR * 1.15), LABEL_ANGLE_DEG);
  const moonW = new THREE.Vector3().setFromMatrixPosition(mw.moon.matrixWorld);
  lb.moon.visible = w > 0.99 && L > 7.6;
  if (lb.moon.visible) placeLabel(lb.moon, moonW, Math.max(0.02, MOON_R_AU * sAU * 1.2), LABEL_ANGLE_DEG);
  lb.center.visible = L < -2;
  if (lb.center.visible) placeLabel(lb.center, _mwW.copy(SUN_GAL).multiplyScalar(-s).applyQuaternion(mwQuat).add(piv), 0.02, LABEL_ANGLE_DEG);
  lb.neptune.visible = solarA > 0.5 && L < 5.5;
  if (lb.neptune.visible) {
    const p = _mwW.set(mw.nep, 0, 0).sub(_mwF).multiplyScalar(sAU).applyQuaternion(mwQuatSol).add(piv);
    lb.neptune.visible = p.distanceTo(piv) < 60;
    placeLabel(lb.neptune, p, 0.02, LABEL_ANGLE_DEG);
  }
  updateJourney(dt, L, s, w, w2, Rk, piv, sAU, _jSun);
}

// =====================================================================
//  TRYB 8: CZASOPRZESTRZEŃ – siatka wyginana przez masy
//   Siatka pokazuje, jak masa zakrzywia przestrzeń (efekt mocno przesadzony, żeby było go widać).
//   Im bardziej zwarty obiekt (czarna dziura, gwiazda neutronowa), tym głębsze wygięcie przy nim.
//   Kolor linii: niebieski = płasko, żółty i czerwony = mocne zakrzywienie (tam czas płynie wolniej).
//   Para czarnych dziur krąży wokół siebie i wysyła fale grawitacyjne (zmarszczki siatki).
// =====================================================================
// Tablica z tekstem (kilka linijek), aktualizowana na żywo – zegary sond, liczniki w Trybie 9
function makeTextBoard(width = 720, lines = 2, color = '#ffffff') {
  const H = 64 * lines + 24;
  const [canvas, ctx] = makeCanvas(width, H);
  const tex = canvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 0);
  sprite.userData.aspect = width / H;
  sprite.renderOrder = 11;
  let last = '';
  return {
    sprite,
    setText(list, colors = []) {
      const key = list.join('|');
      if (key === last) return;
      last = key;
      ctx.clearRect(0, 0, width, H);
      ctx.fillStyle = 'rgba(6,10,26,0.72)'; roundRect(ctx, 0, 0, width, H, 26); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      list.forEach((t, i) => { ctx.fillStyle = colors[i] || color; ctx.font = (i === 0 ? 'bold ' : '') + '44px system-ui, sans-serif'; ctx.fillText(t, width / 2, 12 + 64 * i + 34); });
      tex.needsUpdate = true;
    },
  };
}
function placeBoard(board, pos, lift, angleDeg) {
  const dist = Math.max(0.05, pos.distanceTo(eyePos)), h = dist * Math.tan(angleDeg * DEG);
  board.sprite.position.copy(pos).addScaledVector(UP, lift);
  board.sprite.scale.set(h * board.sprite.userData.aspect, h, 1);
}

const mode8Group = new THREE.Group();
mode8Group.visible = false;
scene.add(mode8Group);
const mode8Light = makeHeadlight(mode8Group);
const ST_MAX = 6;                                          // ile mas naraz liczy shader
const stRoot = new THREE.Group();                          // środek siatki (obiekty są w świecie, siatka tu)
mode8Group.add(stRoot);
const stShared = {
  uMass: { value: Array.from({ length: ST_MAX }, () => new THREE.Vector4()) },   // xyz = położenie, w = "masa"
  uSoft: { value: new Array(ST_MAX).fill(0.1) },                                  // rozmiar jądra wygięcia
  uCount: { value: 0 },
  uWave: { value: new THREE.Vector4() },                                          // xyz = para czarnych dziur, w = amplituda fal
  uWaveAng: { value: 0 },
};
const ST_VERTEX = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec4 uMass[${ST_MAX}];
uniform float uSoft[${ST_MAX}];
uniform int uCount;
uniform vec4 uWave;
uniform float uWaveAng;
uniform float uSheet;
uniform float uHalf;
varying float vPot;
varying float vEdge;
void main() {
  vec3 p = position;
  float pot = 0.0;
  vec3 disp = vec3(0.0);
  for (int i = 0; i < ${ST_MAX}; i++) {
    if (i >= uCount) break;
    vec3 d = uMass[i].xyz - p;
    float m = uMass[i].w, s = uSoft[i];
    if (uSheet > 0.5) {                       // płachta: lejek (głębokość ~ potencjał grawitacyjny)
      float r = length(d.xz);
      pot += m * (1.0 / sqrt(r * r + s * s) - 1.0 / sqrt(2.6 + s * s));
    } else {                                  // siatka 3D: punkty przestrzeni ściągnięte w stronę masy
      float r = length(d) + 1e-5;
      pot += m / (r + s);
      disp += d / r * min(1.3 * m / (r + s), 0.8 * r);
    }
  }
  if (uWave.w > 0.0) {                        // fale grawitacyjne: dwuramienna spirala rozchodząca się od pary
    vec3 q = p - uWave.xyz;
    float r = length(q.xz) + 1e-5;
    float wv = uWave.w * sin(2.0 * atan(q.z, q.x) - 2.0 * uWaveAng + r * 16.0) * smoothstep(0.06, 0.22, r) / (1.0 + r * 2.0);
    if (uSheet > 0.5) p.y += wv; else disp += vec3(q.x, 0.0, q.z) / r * wv;
  }
  if (uSheet > 0.5) p.y -= min(max(pot, 0.0), 0.9); else p += disp;
  vPot = pot;
  vec3 a = abs(position) / uHalf;
  vEdge = uSheet > 0.5 ? max(a.x, a.z) : max(max(a.x, a.y), a.z);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
}`;
const ST_FRAGMENT = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uOpacity;
varying float vPot;
varying float vEdge;
void main() {
  #include <logdepthbuf_fragment>
  float k = clamp(vPot * 1.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.25, 0.55, 1.0), vec3(1.0, 0.85, 0.3), smoothstep(0.05, 0.5, k));
  c = mix(c, vec3(1.0, 0.3, 0.15), smoothstep(0.5, 1.0, k));
  float a = uOpacity * (1.0 - 0.85 * smoothstep(0.7, 1.0, vEdge));
  gl_FragColor = vec4(c * a, 1.0);
}`;
function stGridMesh(sheet) {
  const h = ST_SIZE_M / 2, n = sheet ? ST_LINES_SHEET : ST_LINES_3D, seg = sheet ? ST_SEGMENTS * 2 : ST_SEGMENTS;
  const pos = [];
  const c = i => -h + 2 * h * i / (n - 1);
  const axes = sheet ? [0, 2] : [0, 1, 2];
  for (const axis of axes) for (let i = 0; i < n; i++) for (let j = 0; j < (sheet ? 1 : n); j++) {
    const P = t => sheet ? (axis === 0 ? [t, 0, c(i)] : [c(i), 0, t])
      : axis === 0 ? [t, c(i), c(j)] : axis === 1 ? [c(i), t, c(j)] : [c(i), c(j), t];
    for (let k = 0; k < seg; k++) pos.push(...P(-h + 2 * h * k / seg), ...P(-h + 2 * h * (k + 1) / seg));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...stShared, uSheet: { value: sheet ? 1 : 0 }, uHalf: { value: h }, uOpacity: { value: ST_BRIGHTNESS * (sheet ? 0.8 : 0.55) } },
    vertexShader: ST_VERTEX, fragmentShader: ST_FRAGMENT,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  if (sheet) lines.position.y = ST_SHEET_Y;
  return lines;
}
const stGrid3D = stGridMesh(false), stSheet = stGridMesh(true);
stRoot.add(stGrid3D, stSheet);

// Obiekty: m = "masa" (siła i zasięg wygięcia), soft = jak bardzo skupione (mniej = zwarty obiekt, głęboki lejek)
const ST_OBJECTS = [
  { id: 'sun', name: 'Słońce', note: 'zegar: −66 s na rok', R: 0.12, m: 0.05, soft: 0.17, home: [0, 0, 0] },
  { id: 'earth', name: 'Ziemia', note: 'zegar: −0,02 s na rok', R: 0.045, m: 0.006, soft: 0.06, home: [0.5, 0, 0], orbit: true },
  { id: 'neutron', name: 'Gwiazda neutronowa', note: 'czas o ok. 20% wolniej', R: 0.035, m: 0.02, soft: 0.035, shelf: -1 },
  { id: 'blackhole', name: 'Czarna dziura', note: 'na horyzoncie czas staje', R: 0.04, m: 0.03, soft: 0.02, shelf: 0 },
  { id: 'binary', name: 'Dwie czarne dziury', note: 'fale grawitacyjne', R: 0.06, m: 0.014, soft: 0.018, shelf: 1, binary: true },
];
const stObjects = ST_OBJECTS.map(def => {
  let vis;
  if (def.id === 'sun') {
    const g = new THREE.Group();
    const body = new THREE.Mesh(sphereGeometryHi, new THREE.MeshBasicMaterial({ map: placeholderTexture(BODIES[0]), color: 0xffe2a0 }));
    useTextureFile(body.material, '2k_sun.jpg');
    body.scale.setScalar(def.R);
    g.add(body, makeGlowSprite(0xffd27a, def.R * 4, 0.6));
    vis = { group: g, update: dt => { body.rotation.y += dt * 0.1; } };
  } else if (def.id === 'earth') vis = buildVisual(BODIES.find(b => b.id === 'earth'), def.R);
  else if (def.id === 'neutron') vis = buildVisual(OBJECTS.find(o => o.id === 'neutronstar'), def.R);
  else if (def.id === 'blackhole') vis = buildVisual(OBJECTS.find(o => o.id === 'blackhole'), def.R);
  else {                                                   // para czarnych dziur krążących wokół siebie
    const g = new THREE.Group(), spin = new THREE.Group();
    const bhDef = OBJECTS.find(o => o.id === 'blackhole');
    const a = buildBlackHole(bhDef, def.R * 0.35), b = buildBlackHole(bhDef, def.R * 0.35);
    a.group.position.x = def.R; b.group.position.x = -def.R;
    spin.add(a.group, b.group);
    g.add(spin);
    vis = { group: g, spin, update: dt => { a.update(dt); b.update(dt); } };
  }
  const obj = vis.group;
  const outer = new THREE.Group();
  outer.add(obj);
  mode8Group.add(outer);
  const label = makeLabel(`${def.name} · ${def.note}`);
  mode8Group.add(label);
  return { def, group: outer, vis, label, orbiting: !!def.orbit, rel: new THREE.Vector3(), local: new THREE.Vector3(), weight: 0,
    onShelf: def.shelf !== undefined, slot: new THREE.Vector3() };
});
// Sondy-bliźniaki: dwa małe statki; zegar każdego chodzi tym wolniej, im głębiej w "studni" grawitacyjnej jest
function makeProbe(color) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe4ec, metalness: 0.6, roughness: 0.35 });
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.04, 16).rotateX(Math.PI / 2), hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.018, 16).rotateX(-Math.PI / 2), paint);
  nose.position.z = -0.029;
  g.add(body, nose);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.002, 0.012), paint);
    fin.position.set(sx * 0.012, 0, 0.014);
    g.add(fin);
  }
  const flame = makeGlowSprite(0x7fc0ff, 0.02, 0.9);
  flame.position.z = 0.026;
  g.add(flame);
  const outer = new THREE.Group();
  outer.add(g);
  outer.visible = false;
  mode8Group.add(outer);
  return outer;
}
const stProbes = [['Sonda A', 0x5fb0ff, '#8fd0ff'], ['Sonda B', 0xffa05f, '#ffc890']].map(([name, color, css]) => {
  const board = makeTextBoard(760, 2, css);
  board.sprite.visible = false;
  mode8Group.add(board.sprite);
  return { name, css, group: makeProbe(color), board, age: ST_PROBE_START_AGE, rate: 1, def: { R: 0.03 }, local: new THREE.Vector3() };
});
state.stSheet = false;
state.stSheetY = ST_SHEET_Y;
state.stAngle = 0;
state.stInside = false;
state.stProbes = false;

function layoutMode8() {
  const fwd = horizontalForward(), right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const inside = state.stInside;
  // siatka przed Tobą albo wokół Ciebie (wtedy jej środek jest w Twojej głowie, a płachta pod stopami)
  stRoot.position.copy(eyePos).addScaledVector(fwd, inside ? 0 : ST_DISTANCE_M);
  stRoot.position.y = eyePos.y + (inside ? 0 : ST_HEIGHT_OFFSET_M);
  stRoot.scale.setScalar(inside ? ST_INSIDE_SCALE : 1);
  stRoot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.clone().negate());
  stRoot.updateMatrixWorld(true);
  state.stSheetY = inside ? -0.62 : ST_SHEET_Y;
  stSheet.position.y = state.stSheetY;
  const sunHome = inside ? new THREE.Vector3(0, -0.1, -0.62) : new THREE.Vector3(0, 0, 0);
  for (const o of stObjects) {
    o.group.quaternion.copy(stRoot.quaternion);
    o.orbiting = !!o.def.orbit;
    if (o.def.shelf !== undefined) {                  // półka: przed Tobą, nisko (stąd bierzesz obiekty)
      o.onShelf = true;
      o.slot.copy(eyePos).addScaledVector(fwd, 0.42).addScaledVector(right, o.def.shelf * 0.2);
      o.slot.y = eyePos.y - 0.42;
      o.group.position.copy(o.slot);
      continue;
    }
    const local = o.def.orbit ? sunHome.clone().add(new THREE.Vector3(0.5, 0, 0)) : sunHome.clone();
    if (o.orbiting) o.rel.set(0.5, 0, 0);
    o.group.position.copy(stRoot.localToWorld(local));
  }
  stProbes.forEach((pr, i) => {
    pr.group.position.copy(eyePos).addScaledVector(fwd, 0.6).addScaledVector(right, (i ? 1 : -1) * 0.22);
    pr.group.position.y = eyePos.y - 0.12;
    pr.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), right.clone().multiplyScalar(i ? 1 : -1));
    pr.age = ST_PROBE_START_AGE;
  });
  if (!renderer.xr.isPresenting) orbitControls.target.copy(stRoot.position).addScaledVector(fwd, inside ? 0.8 : 0);
}
function toggleSheet() { state.stSheet = !state.stSheet; drawMenu(); }
function toggleInside() { state.stInside = !state.stInside; cancelAllGrabs(); layoutMode8(); drawMenu(); }
function toggleProbes() { state.stProbes = !state.stProbes; if (state.stProbes) layoutProbesOnly(); drawMenu(); }
function layoutProbesOnly() {
  const fwd = horizontalForward(), right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  stProbes.forEach((pr, i) => {
    pr.group.position.copy(eyePos).addScaledVector(fwd, 0.6).addScaledVector(right, (i ? 1 : -1) * 0.22);
    pr.group.position.y = eyePos.y - 0.12;
    pr.age = ST_PROBE_START_AGE;
  });
}
function resetProbeAges() { for (const pr of stProbes) pr.age = ST_PROBE_START_AGE; }
// gałka lewo/prawo: obróć siatkę (razem z obiektami) wokół jej środka – w środku siatki: wokół siebie
function stickST(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1];
  if (Math.abs(x) > STICK_DEADZONE) stRoot.quaternion.premultiply(_q2.setFromAxisAngle(UP, -x * 50 * DEG * dt));
}

// obiekt pod promieniem (albo przy dłoni)
function pickST(origin, dir) {
  let best = null, bestD = Infinity;
  const list = state.stProbes ? [...stObjects, ...stProbes] : stObjects;
  for (const o of list) {
    const c = o.group.position, r = Math.max(o.def.R * 1.8, 0.07);
    const near = origin.distanceTo(c) < r + NEAR_GRAB_MARGIN_M;
    _sphere.set(c, r);
    raycaster.ray.set(origin, dir);
    const hit = near ? origin.clone() : raycaster.ray.intersectSphere(_sphere, _v4);
    if (!hit) continue;
    const d = near ? 0 : origin.distanceTo(hit);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}
const ST_GRAB = { minScale: 1, maxScale: 1, oneHand: 'lever', single: true };

// głębokość płachty w punkcie (to samo co w shaderze) – żeby kule leżały w swoich lejkach
function stSheetDepth(x, z) {
  let pot = 0;
  const U = stShared.uMass.value, S = stShared.uSoft.value;
  for (let i = 0; i < stShared.uCount.value; i++) {
    const r = Math.hypot(U[i].x - x, U[i].z - z), s = S[i];
    pot += U[i].w * (1 / Math.sqrt(r * r + s * s) - 1 / Math.sqrt(2.6 + s * s));
  }
  return Math.min(Math.max(pot, 0), 0.9);
}

const _stInv = new THREE.Matrix4(), _stQ = new THREE.Quaternion();
function updateMode8(dt) {
  const sheet = state.stSheet, h = ST_SIZE_M / 2;
  stGrid3D.visible = !sheet;
  stSheet.visible = sheet;
  stRoot.updateMatrixWorld(true);
  _stInv.copy(stRoot.matrixWorld).invert();
  const sun = stObjects[0];
  // Ziemia krąży wokół Słońca (gdy jej nie trzymasz); puszczona blisko Słońca – wraca na orbitę
  for (const o of stObjects) o.local.copy(o.group.position).applyMatrix4(_stInv);
  for (const o of stObjects) {
    if (!o.def.orbit) continue;
    if (grabs.has(o.group)) { o.orbiting = false; continue; }
    const rel = _v1.copy(o.local).sub(sun.local);
    if (!o.orbiting && rel.length() < 0.9 && rel.length() > sun.def.R + o.def.R) { o.orbiting = true; o.rel.copy(rel); }
    if (o.orbiting) {
      const r = Math.max(0.15, Math.hypot(o.rel.x, o.rel.z));
      o.rel.applyAxisAngle(UP, Math.PI * 2 / ST_EARTH_YEAR_S * Math.pow(0.5 / r, 1.5) * dt);
      o.local.copy(sun.local).add(o.rel);
    }
  }
  // para czarnych dziur
  state.stAngle += dt * 5;
  const bin = stObjects.find(o => o.def.binary);
  bin.vis.spin.rotation.y = state.stAngle;
  // masy dla shadera (w układzie siatki); obiekty poza siatką (na "półce") nie wyginają jej
  const U = stShared.uMass.value, S = stShared.uSoft.value;
  let n = 0;
  for (const o of stObjects) {
    const l = o.local;
    const out = sheet ? Math.max(Math.abs(l.x), Math.abs(l.z)) - h : Math.max(Math.abs(l.x), Math.abs(l.y), Math.abs(l.z)) - h;
    o.weight = o.onShelf ? 0 : 1 - THREE.MathUtils.smoothstep(out, 0, 0.2);
    if (o.weight <= 0) continue;
    if (o.def.binary) {
      for (const sgn of [1, -1]) {
        const a = state.stAngle, R = o.def.R;
        _v2.set(Math.cos(a) * R * sgn, 0, -Math.sin(a) * R * sgn);
        U[n].set(l.x + _v2.x, l.y, l.z + _v2.z, o.def.m * o.weight); S[n] = o.def.soft; n++;
      }
      stShared.uWave.value.set(l.x, l.y, l.z, 0.022 * o.weight);
      stShared.uWaveAng.value = state.stAngle;
    } else { U[n].set(l.x, l.y, l.z, o.def.m * o.weight); S[n] = o.def.soft; n++; }
  }
  stShared.uCount.value = n;
  if (bin.weight <= 0) stShared.uWave.value.w = 0;
  // płachta: puszczone obiekty leżą w swoich lejkach
  if (sheet) {
    for (const o of stObjects) {
      if (grabs.has(o.group) || o.weight <= 0) continue;
      o.local.y = state.stSheetY - stSheetDepth(o.local.x, o.local.z) + o.def.R * 0.8 / stRoot.scale.x;
      if (o.orbiting) o.rel.y = o.local.y - sun.local.y;
    }
  }
  for (const o of stObjects) {
    const held = grabs.has(o.group);
    // półka: odłożony blisko swojego miejsca – wraca na półkę (i nie wygina siatki)
    if (o.def.shelf !== undefined) {
      if (held) o.onShelf = false;
      else if (o.wasHeld) o.onShelf = o.group.position.distanceTo(o.slot) < 0.14;
      o.wasHeld = held;
    }
    if (!held) {
      if (o.onShelf) o.group.position.lerp(o.slot, Math.min(1, dt * 8));
      else o.group.position.copy(o.local).applyMatrix4(stRoot.matrixWorld);
    }
    if (o.vis.update) o.vis.update(dt, o.vis.group);
    placeLabel(o.label, o.group.position, o.def.R * 1.4 + 0.02, LABEL_ANGLE_DEG);
  }
  // sondy-bliźniaki: zegar zwalnia w zakrzywionej czasoprzestrzeni
  for (const pr of stProbes) {
    pr.group.visible = pr.board.sprite.visible = state.stProbes;
    if (!state.stProbes) continue;
    pr.local.copy(pr.group.position).applyMatrix4(_stInv);
    let pot = 0;
    for (let i = 0; i < n; i++) pot += U[i].w / (pr.local.distanceTo(_v1.set(U[i].x, U[i].y, U[i].z)) + S[i]);
    pr.rate = Math.sqrt(Math.max(0, 1 - ST_TIME_EFFECT * pot));
    pr.age += dt * ST_YEARS_PER_S * pr.rate;
    pr.group.children[0].rotation.z += dt * 0.5;
    pr.board.setText([`${pr.name}: ${pr.age.toFixed(1).replace('.', ',')} lat`, `zegar chodzi ×${pr.rate.toFixed(2).replace('.', ',')}`]);
    placeBoard(pr.board, pr.group.position, 0.04, 2.2);
  }
}

// =====================================================================
//  TRYB 9: PRĘDKOŚĆ ŚWIATŁA – skrócenie długości i spowolnienie czasu (szczególna teoria względności)
//   Światło jest tu "zwolnione" do SR_LIGHT_SPEED_MPS, żeby było widać, jak leci.
//   Statek leci wzdłuż miarki: przy prędkości v jest krótszy γ razy (γ = 1/√(1−v²/c²)),
//   a jego zegar świetlny (błysk odbijający się między lusterkami) tyka γ razy wolniej:
//   z Twojego punktu widzenia błysk leci po skosie, więc dłuższą drogą.
// =====================================================================
const mode9Group = new THREE.Group();
mode9Group.visible = false;
scene.add(mode9Group);
const mode9Light = makeHeadlight(mode9Group);
state.srBeta = 0.87;
state.srPaused = false;
const srGamma = () => 1 / Math.sqrt(1 - state.srBeta * state.srBeta);

function makeShip(color) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xe4e8f0, metalness: 0.55, roughness: 0.35 });
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 });
  const L = SR_SHIP_LENGTH_M;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, L * 0.7, 24).rotateZ(Math.PI / 2), hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, L * 0.22, 24).rotateZ(-Math.PI / 2), paint);
  nose.position.x = L * 0.46;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, L * 0.08, 24).rotateZ(Math.PI / 2), paint);
  tail.position.x = -L * 0.39;
  g.add(body, nose, tail);
  for (const [y, z] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.28, Math.abs(y) > 0 ? 0.16 : 0.02, Math.abs(z) > 0 ? 0.16 : 0.02), paint);
    fin.position.set(-L * 0.3, y, z);
    g.add(fin);
  }
  for (let i = 0; i < 5; i++) {
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
    win.position.set(-L * 0.2 + i * 0.16, 0.05, 0.172);
    g.add(win);
  }
  // zegar świetlny na grzbiecie: dwa lusterka i rama
  const H = SR_CLOCK_HEIGHT_M, y0 = 0.2;
  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 0.9, roughness: 0.1, emissive: 0x203040 });
  for (const y of [y0, y0 + H]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.16), mirrorMat);
    m.position.y = y;
    g.add(m);
  }
  for (const x of [-0.1, 0.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, H, 6), hull);
    post.position.set(x, y0 + H / 2, -0.07);
    g.add(post);
  }
  const flame = makeGlowSprite(0x7fc0ff, 0.35, 0.8);
  flame.position.x = -L * 0.5;
  g.add(flame);
  return g;
}
// błysk światła i jego ślad (zygzak)
function makePhoton() {
  const sprite = makeGlowSprite(0xfff6a0, 0.07, 1);
  const N = 240;
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: N }, () => new THREE.Vector3())),
    new THREE.LineBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.85 }));
  trail.frustumCulled = false;
  mode9Group.add(sprite, trail);
  return { sprite, trail, N, count: 0, ticks: 0 };
}
function pushTrail(ph, p) {
  const a = ph.trail.geometry.attributes.position;
  if (ph.count < ph.N) { for (let i = ph.count; i < ph.N; i++) a.setXYZ(i, p.x, p.y, p.z); ph.count++; }
  else { a.array.copyWithin(0, 3); a.setXYZ(ph.N - 1, p.x, p.y, p.z); }
  a.needsUpdate = true;
}
function clearTrail(ph) { ph.count = 0; }        // następny punkt wypełni cały ślad

const sr = {
  moving: makeShip(0x4f8fff), resting: makeShip(0x9a9aa8),
  phMove: makePhoton(), phRest: makePhoton(),
  board: makeTextBoard(1500, 3), restBoard: makeTextBoard(900, 2, '#d0d6e6'),
  ruler: new THREE.Group(), x: 0, tYou: 0, tShip: 0, origin: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0), fwd: new THREE.Vector3(0, 0, -1),
  y: 0, labels: [],
};
mode9Group.add(sr.moving, sr.resting, sr.board.sprite, sr.restBoard.sprite, sr.ruler);
// miarka: kreski co 1 m wzdłuż toru
{
  const pts = [], L = SR_TRACK_LENGTH_M;
  pts.push(new THREE.Vector3(-L / 2, 0, 0), new THREE.Vector3(L / 2, 0, 0));
  for (let i = 0; i <= L * 2; i++) { const x = -L / 2 + i * 0.5, h = i % 2 ? 0.05 : 0.12; pts.push(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -h, 0)); }
  sr.ruler.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fa8d8 })));
}

function layoutMode9() {
  sr.fwd.copy(horizontalForward());
  sr.right.crossVectors(sr.fwd, UP).normalize();
  sr.origin.copy(eyePos).addScaledVector(sr.fwd, SR_DISTANCE_M);
  sr.y = eyePos.y - 0.12;
  sr.origin.y = sr.y;
  sr.ruler.position.copy(sr.origin).addScaledVector(UP, -0.25);
  sr.ruler.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sr.right);
  // statek w spoczynku: pod torem, na środku – lecący statek mija go tuż nad nim (widać różnicę długości)
  sr.resting.position.copy(sr.origin).addScaledVector(UP, -0.95);
  sr.resting.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sr.right);
  sr.moving.quaternion.copy(sr.resting.quaternion);
  sr.x = -SR_TRACK_LENGTH_M / 2;
  srResetClocks();
}
function srResetClocks() {
  sr.tYou = sr.tShip = 0;
  sr.phMove.ticks = sr.phRest.ticks = 0;
  clearTrail(sr.phMove, sr.moving.position);
  clearTrail(sr.phRest, sr.resting.position);
}
function setSrSpeed(b) { state.srBeta = b; sr.x = -SR_TRACK_LENGTH_M / 2; srResetClocks(); drawMenu(); }

// pozycja błysku: odbija się między lusterkami; pionowo leci z prędkością c/γ (po skosie – z prędkością c)
function photonY(t, vy) {
  const H = SR_CLOCK_HEIGHT_M, period = 2 * H / vy, f = (t % period) / period;
  return { y: 0.2 + H * (f < 0.5 ? f * 2 : 2 - f * 2), ticks: Math.floor(t / period) };
}
const _sr1 = new THREE.Vector3();
function updateMode9(dt) {
  if (state.srShip) { updateSrShip(dt); return; }
  const c = SR_LIGHT_SPEED_MPS, b = state.srBeta, g = srGamma();
  if (!state.srPaused) {
    sr.tYou += dt;
    sr.tShip += dt / g;
    sr.x += b * c * dt;
  }
  const L = SR_TRACK_LENGTH_M;
  if (sr.x > L / 2) {                                // przeleciał – wraca na początek toru (zegary liczą dalej)
    sr.x = -L / 2;
    clearTrail(sr.phMove, _sr1.copy(sr.origin).addScaledVector(sr.right, sr.x));
  }
  // statek w ruchu: skrócony γ razy wzdłuż kierunku lotu
  sr.moving.position.copy(sr.origin).addScaledVector(sr.right, sr.x);
  sr.moving.scale.set(1 / g, 1, 1);
  const edge = Math.min(1, (L / 2 - Math.abs(sr.x)) / 0.8);   // na końcach toru znika
  sr.moving.visible = edge > 0.05;
  // błyski: w spoczynku pionowo z prędkością c, w ruchu pionowo z c/γ
  const pm = photonY(sr.tYou, c / g), pr = photonY(sr.tYou, c);
  sr.phMove.sprite.position.copy(sr.moving.position).addScaledVector(UP, pm.y);
  sr.phRest.sprite.position.copy(sr.resting.position).addScaledVector(UP, pr.y);
  if (!state.srPaused) { pushTrail(sr.phMove, sr.phMove.sprite.position); pushTrail(sr.phRest, sr.phRest.sprite.position); }
  sr.phMove.sprite.visible = sr.phMove.trail.visible = sr.moving.visible;
  // tablice
  const kms = Math.round(b * 299792).toLocaleString('pl-PL');
  const fmt = v => v.toFixed(1).replace('.', ',');
  sr.board.setText([
    `${String(b).replace('.', ',')} c (${kms} km/s)  ·  γ = ${g.toFixed(2).replace('.', ',')}`,
    `Twój zegar: ${fmt(sr.tYou)} s   ·   zegar statku: ${fmt(sr.tShip)} s`,
    `Statek: ${(SR_SHIP_LENGTH_M / g).toFixed(2).replace(".", ",")} m zamiast ${fmt(SR_SHIP_LENGTH_M)} m  ·  ${g > 1.05 ? "czas płynie " + fmt(g) + "× wolniej" : "prawie jak w spoczynku"}`,
  ], ['#ffe9a8', '#ffffff', '#9fd0ff']);
  placeBoard(sr.board, _sr1.copy(sr.origin).addScaledVector(UP, 0.85), 0, 5.5);
  sr.restBoard.setText(['Ten sam statek w spoczynku', `${fmt(SR_SHIP_LENGTH_M)} m · zegar tyka co ${fmt(2 * SR_CLOCK_HEIGHT_M / c)} s`]);
  placeBoard(sr.restBoard, _sr1.copy(sr.resting.position).addScaledVector(sr.right, -1.75), -0.1, 2.6);
}

// ---------- Widok z pokładu: jak wygląda kosmos z pędzącego statku (zgodnie ze szczególną teorią względności)
//  1) Aberracja światła: kierunek do każdego źródła przesuwa się do przodu: cos θ' = (cos θ + β) / (1 + β cos θ)
//     – gwiazdy zbierają się przed Tobą, a mijane obiekty wyginają się (tzw. obrót Terrella).
//  2) Efekt Dopplera: światło z przodu ma wyższą częstotliwość (niebieskie), z tyłu niższą (czerwone):
//     czynnik D = γ (1 + β cos θ); gwiazda o temperaturze T wygląda jak gwiazda o temperaturze D·T,
//     a lampka świecąca falą λ wygląda jak λ / D (może zniknąć – przejść w podczerwień lub nadfiolet).
//  3) Jasność: z przodu jaśniej (~D³), z tyłu ciemniej („efekt reflektora”).
//  Obiekty stoją w miejscu, a Ty lecisz przez nie wzdłuż −Z.
const SR_SHIP_GLSL = `
uniform float uBeta;
// d – kierunek do źródła w układzie gwiazd (jednostkowy), ruch wzdłuż −Z; zwraca kierunek widziany ze statku
vec3 srAberrate(vec3 d, out float D) {
  float ct = -d.z;
  float g = 1.0 / sqrt(1.0 - uBeta * uBeta);
  D = g * (1.0 + uBeta * ct);
  float ct2 = (ct + uBeta) / (1.0 + uBeta * ct);
  float st2 = sqrt(max(0.0, 1.0 - ct2 * ct2));
  float pl = length(d.xy);
  vec2 pd = pl > 1e-6 ? d.xy / pl : vec2(1.0, 0.0);
  return vec3(pd * st2, -ct2);
}
// barwa ciała doskonale czarnego o temperaturze T [K] (przybliżenie T. Hellanda)
vec3 srBlackbody(float T) {
  float t = clamp(T, 1000.0, 40000.0) / 100.0;
  vec3 c;
  c.r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  c.g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0) : clamp(1.1298909 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
  return c * smoothstep(700.0, 2600.0, T);            // bardzo "zimne" = podczerwień, prawie niewidoczne
}
// barwa światła o długości fali wl [nm]; poza 380–750 nm: niewidzialne
vec3 srWavelength(float wl) {
  vec3 c = vec3(0.0);
  if (wl >= 380.0 && wl < 440.0) c = vec3(-(wl - 440.0) / 60.0, 0.0, 1.0);
  else if (wl < 490.0 && wl >= 440.0) c = vec3(0.0, (wl - 440.0) / 50.0, 1.0);
  else if (wl < 510.0 && wl >= 490.0) c = vec3(0.0, 1.0, -(wl - 510.0) / 20.0);
  else if (wl < 580.0 && wl >= 510.0) c = vec3((wl - 510.0) / 70.0, 1.0, 0.0);
  else if (wl < 645.0 && wl >= 580.0) c = vec3(1.0, -(wl - 645.0) / 65.0, 0.0);
  else if (wl <= 750.0 && wl >= 645.0) c = vec3(1.0, 0.0, 0.0);
  float f = wl < 420.0 ? 0.3 + 0.7 * (wl - 380.0) / 40.0 : wl > 700.0 ? 0.3 + 0.7 * (750.0 - wl) / 50.0 : 1.0;
  return c * clamp(f, 0.0, 1.0);
}`;
const srShip = { group: new THREE.Group(), uniforms: { uBeta: { value: 0 }, uShift: { value: 0 } }, z: 0 };
mode9Group.add(srShip.group);
srShip.group.visible = false;
{
  const U = srShip.uniforms;
  const head = `#include <common>
#include <logdepthbuf_pars_vertex>
${SR_SHIP_GLSL}
uniform float uShift;
varying vec3 vCol;`;
  const frag = `#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vCol;
uniform float uRound;
void main() {
  #include <logdepthbuf_fragment>
  float a = 1.0;
  if (uRound > 0.5) { vec2 q = gl_PointCoord - 0.5; a = smoothstep(0.5, 0.15, length(q)); }
  gl_FragColor = vec4(vCol * a, 1.0);
}`;
  const mat = (vert, round) => new THREE.ShaderMaterial({
    uniforms: { ...U, uRound: { value: round ? 1 : 0 } }, vertexShader: head + vert, fragmentShader: frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  // gwiazdy (kierunki + temperatura + jasność)
  const rnd = seededRandom('srstars'), N = 7000;
  const pos = new Float32Array(N * 3), temp = new Float32Array(N), mag = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(th); pos[i * 3 + 1] = u; pos[i * 3 + 2] = r * Math.sin(th);
    const k = rnd();
    temp[i] = k < 0.55 ? 3200 + rnd() * 1800 : k < 0.85 ? 5000 + rnd() * 2500 : 7500 + rnd() * 17000;
    mag[i] = Math.pow(rnd(), 3) * 0.9 + 0.12;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const stars = new THREE.Points(g, mat(`
attribute float temp;
attribute float mag;
void main() {
  float D;
  vec3 a = srAberrate(normalize(position), D);
  vCol = srBlackbody(temp * D) * mag * 0.55 * clamp(pow(D, 1.6), 0.03, 2.2);   // jaśniej z przodu, ale bez przepalenia barwy
  vec4 mv = modelViewMatrix * vec4(a * 900.0, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 2.0 + 2.5 * mag * clamp(D, 0.5, 2.5);
  #include <logdepthbuf_vertex>
}`, true));
  stars.frustumCulled = false;
  srShip.group.add(stars);
  // bramki (białe ramki 6×6 m co 40 m na trasie) i kolorowe lampki (jedna długość fali: 460, 530, 650 nm)
  const gp = [], lp = [], lw = [];
  const S = 3, SEG = 24, GAP = 40, COUNT = 11;
  for (let k = 0; k < COUNT; k++) {
    const z = -k * GAP;
    const corners = [[-S, -S], [S, -S], [S, S], [-S, S]];
    for (let e = 0; e < 4; e++) {
      const [x0, y0] = corners[e], [x1, y1] = corners[(e + 1) % 4];
      for (let i = 0; i < SEG; i++) {
        const a = i / SEG, b = (i + 1) / SEG;
        gp.push(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, z, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, z);
      }
      lp.push(x0, y0, z);
      lw.push([460, 530, 650, 580][(e + k) % 4]);
    }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const wrap = `
  vec3 p = position;
  p.z = mod(p.z + uShift + ${(COUNT - 1) * GAP + 20}.0, ${COUNT * GAP}.0) - ${(COUNT - 1) * GAP + 20}.0;
  float dist = length(p);
  float D;
  vec3 a = srAberrate(p / dist, D);`;
  const gates = new THREE.LineSegments(gg, mat(`
void main() {${wrap}
  vCol = srBlackbody(6500.0 * D) * clamp(pow(D, 1.6), 0.03, 2.0) * 0.6 * smoothstep(${COUNT * GAP}.0, ${COUNT * GAP * 0.6}.0, dist);
  vec4 mv = modelViewMatrix * vec4(a * dist, 1.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`, false));
  gates.frustumCulled = false;
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('wl', new THREE.Float32BufferAttribute(lw, 1));
  const lamps = new THREE.Points(lg, mat(`
attribute float wl;
void main() {${wrap}
  vCol = srWavelength(wl / D) * clamp(pow(D, 1.6), 0.05, 2.2) * smoothstep(${COUNT * GAP}.0, ${COUNT * GAP * 0.6}.0, dist);
  vec4 mv = modelViewMatrix * vec4(a * dist, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(900.0 / dist, 4.0, 40.0);
  #include <logdepthbuf_vertex>
}`, true));
  lamps.frustumCulled = false;
  srShip.group.add(gates, lamps);
  srShip.board = makeTextBoard(1400, 3);
  srShip.group.add(srShip.board.sprite);
}
state.srShip = false;
function toggleSrShip() {
  state.srShip = !state.srShip;
  srShip.group.visible = state.srShip;
  for (const o of [sr.moving, sr.resting, sr.board.sprite, sr.restBoard.sprite, sr.ruler, sr.phMove.sprite, sr.phMove.trail, sr.phRest.sprite, sr.phRest.trail]) o.visible = !state.srShip;
  stars.visible = !state.srShip;
  if (state.srShip) {
    srShip.group.position.copy(eyePos);
    srShip.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), horizontalForward());
  }
  drawMenu();
}
function updateSrShip(dt) {
  const b = state.srBeta;
  srShip.uniforms.uBeta.value = b;
  if (!state.srPaused) srShip.uniforms.uShift.value += b * 30 * dt;      // w tym widoku "c" = 30 m/s
  srShip.group.position.copy(eyePos);
  const fmt = v => String(v).replace('.', ',');
  const D = Math.sqrt((1 + b) / (1 - b));
  srShip.board.setText([
    `Widok z pokładu: ${fmt(b)} c`,
    b < 0.05 ? 'Statek stoi – gwiazdy wyglądają zwyczajnie' : `Przed Tobą gwiazdy skupiają się i niebieszczeją (×${D.toFixed(1).replace('.', ',')}), za Tobą czerwienieją`,
    'Lampki: niebieska 460, zielona 530, żółta 580, czerwona 650 nm',
  ], ['#ffe9a8', '#ffffff', '#9fd0ff']);
  const p = _sr1.copy(srShip.group.position).addScaledVector(horizontalForward(), 1.4).addScaledVector(UP, -0.55);
  srShip.board.sprite.position.copy(p).sub(srShip.group.position).applyQuaternion(srShip.group.quaternion.clone().invert());
  const h = 1.45 * Math.tan(3.2 * DEG);
  srShip.board.sprite.scale.set(h * srShip.board.sprite.userData.aspect, h, 1);
}

// =====================================================================
//  TRYB 11: ATOM – chmury prawdopodobieństwa elektronów (orbitale)
//   Każdy punkt to jedno możliwe miejsce elektronu, losowane z |ψ|² (funkcje falowe atomu wodoru:
//   część radialna z wielomianów Laguerre'a, część kątowa – rzeczywiste harmoniki sferyczne).
//   Kolor: znak funkcji falowej (niebieski +, pomarańczowy −). Pierwiastki: orbitale zajęte wg konfiguracji,
//   rozmiary z efektywnym ładunkiem jądra (reguły Slatera). Dla porównania: stary, planetarny model Bohra.
// =====================================================================
const mode11Group = new THREE.Group();
mode11Group.visible = false;
scene.add(mode11Group);
const mode11Light = makeHeadlight(mode11Group);
const ATOM_ORBITALS = {
  '1s': { n: 1, l: 0, variants: ['s'] },
  '2s': { n: 2, l: 0, variants: ['s'] },
  '2p': { n: 2, l: 1, variants: ['pz', 'px', 'py'] },
  '3s': { n: 3, l: 0, variants: ['s'] },
  '3p': { n: 3, l: 1, variants: ['pz', 'px', 'py'] },
  '3d': { n: 3, l: 2, variants: ['dz²', 'dxz', 'dyz', 'dxy', 'dx²−y²'] },
  '4f': { n: 4, l: 3, variants: ['fz³', 'fxz²', 'fyz²', 'fxyz', 'fz(x²−y²)', 'fx(x²−3y²)', 'fy(3x²−y²)'] },
};
// część kątowa (rzeczywiste harmoniki sferyczne, bez stałych) dla kierunku (x, y, z)
const ATOM_ANGULAR = {
  s: () => 1, pz: (x, y, z) => z, px: x => x, py: (x, y) => y,
  'dz²': (x, y, z) => 3 * z * z - 1, dxz: (x, y, z) => x * z, dyz: (x, y, z) => y * z, dxy: (x, y) => x * y, 'dx²−y²': (x, y) => x * x - y * y,
  'fz³': (x, y, z) => z * (5 * z * z - 3), 'fxz²': (x, y, z) => x * (5 * z * z - 1), 'fyz²': (x, y, z) => y * (5 * z * z - 1), fxyz: (x, y, z) => x * y * z,
  'fz(x²−y²)': (x, y, z) => z * (x * x - y * y), 'fx(x²−3y²)': (x, y) => x * (x * x - 3 * y * y), 'fy(3x²−y²)': (x, y) => y * (3 * x * x - y * y),
};
const ATOM_FACTS = {
  s: 'Orbital s: kula – elektron może być w każdym kierunku jednakowo',
  p: 'Orbital p: dwie „krople” – w płaszczyźnie przez jądro elektronu nigdy nie ma (węzeł)',
  d: 'Orbital d: cztery płatki (albo „hantla” z pierścieniem) – dwie płaszczyzny węzłowe',
  f: 'Orbital f: sześć–osiem płatków – takie orbitale mają np. lantanowce',
};
// pierwiastki: [symbol, nazwa, Z, neutrony, konfiguracja [[n, l, elektrony], ...]]
const ATOM_ELEMENTS = [
  ['H', 'Wodór', 1, 0, [[1, 0, 1]]], ['He', 'Hel', 2, 2, [[1, 0, 2]]], ['Li', 'Lit', 3, 4, [[1, 0, 2], [2, 0, 1]]],
  ['C', 'Węgiel', 6, 6, [[1, 0, 2], [2, 0, 2], [2, 1, 2]]], ['O', 'Tlen', 8, 8, [[1, 0, 2], [2, 0, 2], [2, 1, 4]]],
  ['Ne', 'Neon', 10, 10, [[1, 0, 2], [2, 0, 2], [2, 1, 6]]], ['Na', 'Sód', 11, 12, [[1, 0, 2], [2, 0, 2], [2, 1, 6], [3, 0, 1]]],
];
const ATOM_POINTS = 26000;
state.atom = { kind: 'orbital', orb: '2p', variant: 0, el: 'C', bohr: false };

function laguerre(k, a, x) {                       // uogólniony wielomian Laguerre'a L_k^a(x)
  if (k === 0) return 1;
  let l0 = 1, l1 = 1 + a - x;
  for (let i = 1; i < k; i++) { const l2 = ((2 * i + 1 + a - x) * l1 - (i + a) * l0) / (i + 1); l0 = l1; l1 = l2; }
  return l1;
}
const atomRadial = (n, l, Z, r) => { const rho = 2 * Z * r / n; return Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho); };
// losowanie punktów z |ψ|²: promień z rozkładu r²R² (dystrybuanta), kierunek – metodą odrzucania z |Y|²
function sampleOrbital(n, l, variant, Z, count, rnd = Math.random) {
  const rMax = (2.5 * n * n + 6 * n) / Z, G = 1500, cdf = new Float64Array(G + 1);
  for (let i = 1; i <= G; i++) { const r = rMax * i / G, R = atomRadial(n, l, Z, r); cdf[i] = cdf[i - 1] + r * r * R * R; }
  const total = cdf[G];
  const Y = ATOM_ANGULAR[variant];
  let ymax = 0;
  for (let i = 0; i < 3000; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = Y(s * Math.cos(t), s * Math.sin(t), u);
    ymax = Math.max(ymax, v * v);
  }
  ymax *= 1.05;
  const out = [];
  let r90 = 0;
  for (let i = 0; i <= G; i++) if (cdf[i] >= 0.9 * total) { r90 = rMax * i / G; break; }
  while (out.length < count) {
    const q = rnd() * total;
    let lo = 0, hi = G;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m] < q) lo = m; else hi = m; }
    const r = rMax * (lo + rnd()) / G;
    let x, y, z, yv;
    for (;;) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      x = s * Math.cos(t); y = s * Math.sin(t); z = u;
      yv = Y(x, y, z);
      if (rnd() * ymax <= yv * yv) break;
    }
    const sign = Math.sign(atomRadial(n, l, Z, r) * yv) || 1;
    out.push({ x: x * r, y: z * r, z: y * r, sign });             // oś z orbitalu = pionowo
  }
  return { pts: out, r90 };
}
// efektywny ładunek jądra (reguły Slatera, uproszczone)
function slaterZ(Z, config, n) {
  const count = k => config.filter(c => c[0] === k).reduce((a, c) => a + c[2], 0);
  let sh = 0.35 * (count(n) - 1) * (n === 1 ? 0.3 / 0.35 : 1);   // ta sama powłoka
  if (n >= 2) sh += 0.85 * count(n - 1);                          // powłoka niżej
  for (let k = 1; k < n - 1; k++) sh += count(k);                 // jeszcze niżej – pełne ekranowanie
  return Math.max(1, Z - sh);
}
const atom = (() => {
  const group = new THREE.Group();
  mode11Group.add(group);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ATOM_POINTS * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ATOM_POINTS * 3), 3));
  const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
  cloud.frustumCulled = false;
  const nucleus = new THREE.Group();
  const electron = makeGlowSprite(0xffffff, 0.035, 1);
  const bohr = new THREE.Group();
  group.add(cloud, nucleus, electron, bohr);
  const label = makeTextBoard(1500, 2);
  mode11Group.add(label.sprite);
  return { group, cloud, geo, nucleus, electron, bohr, label, samples: [], scale: 1, flashT: 0, info: ['', ''] };
})();
const ATOM_COLORS = { pos: new THREE.Color(0x4fa8ff), neg: new THREE.Color(0xff9a3a), shell: [new THREE.Color(0xfff0c0), new THREE.Color(0x60b0ff), new THREE.Color(0x60ff90)] };
function buildNucleus(Z, N) {
  const g = atom.nucleus;
  while (g.children.length) g.remove(g.children[0]);
  const prot = new THREE.MeshStandardMaterial({ color: 0xe04030, roughness: 0.5 }), neut = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 0.5 });
  const total = Z + N, rnd = seededRandom('nuc' + Z);
  const R = 0.08 * Math.cbrt(total);
  for (let i = 0; i < total; i++) {
    const m = new THREE.Mesh(sphereGeometry, i < Z ? prot : neut);
    m.scale.setScalar(0.08);
    if (total > 1) { const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(R * Math.cbrt(rnd())); m.position.copy(v); }
    g.add(m);
  }
}
// zbuduj chmurę dla bieżącego wyboru
function rebuildAtom() {
  const A = state.atom;
  const samples = [];
  let rOuter = 1, title, line2;
  if (A.kind === 'orbital') {
    const o = ATOM_ORBITALS[A.orb], v = o.variants[A.variant % o.variants.length];
    const res = sampleOrbital(o.n, o.l, v, 1, ATOM_POINTS);
    for (const p of res.pts) samples.push({ ...p, col: p.sign > 0 ? ATOM_COLORS.pos : ATOM_COLORS.neg });
    rOuter = res.r90;
    buildNucleus(1, 0);
    title = `Orbital ${A.orb}${o.variants.length > 1 ? ' (' + v + ')' : ''} – atom wodoru`;
    line2 = ATOM_FACTS['spdf'[o.l]];
  } else {
    const e = ATOM_ELEMENTS.find(x => x[0] === A.el), [sym, name, Z, N, config] = e;
    const totalE = config.reduce((a, c) => a + c[2], 0);
    for (const [n, l, ne] of config) {
      const zEff = slaterZ(Z, config, n);
      const vars = l === 0 ? ['s'] : ['pz', 'px', 'py'];
      // elektrony p rozkładają się po orbitalach px, py, pz (reguła Hunda)
      const occ = l === 0 ? [ne] : [0, 1, 2].map(i => (ne > i ? 1 : 0) + (ne > i + 3 ? 1 : 0));
      vars.forEach((v, i) => {
        if (!occ[i]) return;
        const cnt = Math.round(ATOM_POINTS * occ[i] / totalE);
        const res = sampleOrbital(n, l, v, zEff, cnt);
        for (const p of res.pts) samples.push({ ...p, col: ATOM_COLORS.shell[n - 1] });
        rOuter = Math.max(rOuter, res.r90);
      });
    }
    buildNucleus(Z, N);
    const sup = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
    title = `${name} (${sym}): ${Z} protonów, ${N} neutronów, ${totalE} elektronów`;
    line2 = 'Konfiguracja: ' + config.map(([n, l, ne]) => `${n}${'spdf'[l]}${sup[ne]}`).join(' ') + '  ·  kolory: powłoka 1, 2, 3';
  }
  // skala: 90% chmury mieści się w kuli o promieniu ok. 0,32 m
  atom.scale = 0.32 / rOuter;
  const pos = atom.geo.attributes.position.array, col = atom.geo.attributes.color.array;
  for (let i = 0; i < ATOM_POINTS; i++) {
    const p = samples[i % samples.length];
    pos[i * 3] = p.x * atom.scale; pos[i * 3 + 1] = p.y * atom.scale; pos[i * 3 + 2] = p.z * atom.scale;
    col[i * 3] = p.col.r; col[i * 3 + 1] = p.col.g; col[i * 3 + 2] = p.col.b;
  }
  atom.geo.attributes.position.needsUpdate = atom.geo.attributes.color.needsUpdate = true;
  atom.samples = samples;
  atom.nucleus.scale.setScalar(0.08);                            // jądro powiększone – naprawdę jest ok. 100 000× mniejsze od atomu
  buildBohr(rOuter);
  atom.info = [title, line2];
  drawMenu();
}
// model Bohra: elektrony krążą po okręgach (stary, planetarny obraz atomu – dla porównania)
function buildBohr(rOuter) {
  const g = atom.bohr;
  while (g.children.length) g.remove(g.children[0]);
  const A = state.atom;
  const shells = A.kind === 'element'
    ? (() => { const cfg = ATOM_ELEMENTS.find(x => x[0] === A.el)[4], m = {}; for (const [n, , e] of cfg) m[n] = (m[n] || 0) + e; return Object.entries(m).map(([n, e]) => [+n, e]); })()
    : [[ATOM_ORBITALS[A.orb].n, 1]];
  const maxN = Math.max(...shells.map(s => s[0]));
  g.userData.electrons = [];
  g.rotation.set(1.0, 0, 0.15);                                    // pochylony do Ciebie – widać okręgi, nie kreski
  for (const [n, e] of shells) {
    const r = 0.32 * (n * n) / (maxN * maxN) * 0.9 + 0.04;
    g.add(makeCircleLineXZ(r, 96, 0x9fb8ff, 0.6));
    for (let k = 0; k < e; k++) {
      const el = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: ATOM_COLORS.shell[n - 1] }));
      el.scale.setScalar(0.012);
      el.userData = { r, a: k / e * Math.PI * 2, w: 2.2 / n, tilt: n * 0.6 };
      g.add(el);
      g.userData.electrons.push(el);
    }
  }
}
function layoutMode11() {
  const fwd = horizontalForward();
  atom.group.position.copy(eyePos).addScaledVector(fwd, 0.9);
  atom.group.position.y = eyePos.y - 0.08;
  atom.group.quaternion.identity();
  atom.group.scale.setScalar(1);
  rebuildAtom();
  if (!renderer.xr.isPresenting) orbitControls.target.copy(atom.group.position);
}
function atomSet(changes) { Object.assign(state.atom, changes); rebuildAtom(); }
const ATOM_GRAB = { minScale: 0.3, maxScale: 6, oneHand: 'remote' };
function updateMode11(dt) {
  const A = state.atom;
  atom.cloud.visible = !A.bohr;
  atom.bohr.visible = A.bohr;
  atom.electron.visible = !A.bohr;
  // "błysk" elektronu: co chwilę w innym miejscu chmury – tam, gdzie akurat byśmy go zmierzyli
  atom.flashT -= dt;
  if (atom.flashT <= 0 && atom.samples.length) {
    atom.flashT = 0.12;
    const p = atom.samples[Math.floor(Math.random() * atom.samples.length)];
    atom.electron.position.set(p.x * atom.scale, p.y * atom.scale, p.z * atom.scale);
  }
  // chmura "migocze": część punktów co klatkę dostaje nowe losowe położenie
  const pos = atom.geo.attributes.position.array, col = atom.geo.attributes.color.array, S = atom.samples;
  if (S.length && !A.bohr) {
    for (let k = 0; k < 400; k++) {
      const i = Math.floor(Math.random() * ATOM_POINTS), p = S[Math.floor(Math.random() * S.length)];
      pos[i * 3] = p.x * atom.scale; pos[i * 3 + 1] = p.y * atom.scale; pos[i * 3 + 2] = p.z * atom.scale;
      col[i * 3] = p.col.r; col[i * 3 + 1] = p.col.g; col[i * 3 + 2] = p.col.b;
    }
    atom.geo.attributes.position.needsUpdate = atom.geo.attributes.color.needsUpdate = true;
  }
  for (const el of atom.bohr.userData.electrons || []) {
    const u = el.userData;
    u.a += u.w * dt;
    el.position.set(Math.cos(u.a) * u.r, 0, Math.sin(u.a) * u.r);
  }
  if (!grabs.has(atom.group)) atom.group.rotateY(dt * 0.15);
  atom.label.setText(A.bohr ? [atom.info[0], 'Model Bohra (1913): elektrony na torach jak planety – dziś wiemy, że to chmury'] : atom.info, ['#ffe9a8', '#ffffff']);
  placeBoard(atom.label, _v1.copy(atom.group.position).addScaledVector(UP, -0.5 * atom.group.scale.x - 0.1), 0, 2.6);
}
function stickAtom(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(x) > STICK_DEADZONE) atom.group.rotateOnWorldAxis(UP, -x * 70 * DEG * dt);
  if (Math.abs(y) > STICK_DEADZONE) atom.group.scale.setScalar(THREE.MathUtils.clamp(atom.group.scale.x * Math.pow(2, -y * dt), 0.3, 6));
}

// =====================================================================
//  TRYB 12: HISTORIA ATOMU – od Wielkiego Wybuchu do Twojego ciała
//   Animacja na „scenie” przed Tobą (kamera się nie rusza). Suwak przewija czas, przyciski zmieniają tempo.
//   Bohater: jeden proton. Powstaje w pierwszej milionowej sekundy, w gwieździe staje się częścią jądra węgla,
//   a węgiel krąży przez gwiazdy, dysk wokół młodego Słońca, Ziemię, organizmy – aż do Ciebie.
// =====================================================================
const mode12Group = new THREE.Group();
mode12Group.visible = false;
scene.add(mode12Group);
const mode12Light = makeHeadlight(mode12Group);
const HIST_POINTS = 5000;                                  // ile punktów ma chmura (gaz, pył, cząstki)
const HIST_BRIGHTNESS = 0.6;                               // jasność chmury punktów
const HIST_SPEEDS = [0.25, 0.5, 1, 2, 4];                  // tempo animacji (×1 = ok. 4 minuty całości)
const HIST_DISTANCE_M = 1.25;                              // odległość sceny od oczu
const HIST_GRAB = { minScale: 0.4, maxScale: 3, oneHand: 'remote' };
state.hist = { p: 0, playing: true, speed: 1, menuT: 0, idx: -1 };
const hSm = THREE.MathUtils.smoothstep;                    // hSm(x, od, do): płynnie 0 → 1
const hMix = (a, b, f) => a + (b - a) * f;
const _hv = new THREE.Vector3(), _hw = new THREE.Vector3(), _hu = new THREE.Vector3();
function hSph(a, b, out) { const u = 2 * a - 1, ph = 2 * Math.PI * b, s = Math.sqrt(Math.max(0, 1 - u * u)); return out.set(s * Math.cos(ph), u, s * Math.sin(ph)); }
// punkt na łamanej z kluczami [[t, x, y, z], ...] (płynnie między kluczami)
function hPath(keys, t, out) {
  if (t <= keys[0][0]) return out.set(keys[0][1], keys[0][2], keys[0][3]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], f = hSm(t, a[0], b[0]);
      return out.set(hMix(a[1], b[1], f), hMix(a[2], b[2], f), hMix(a[3], b[3], f));
    }
  }
  const z = keys[keys.length - 1];
  return out.set(z[1], z[2], z[3]);
}
// pochylenie płaszczyzny (dysk, galaktyka): dalsza strona do góry, żeby było widać ją z góry
function hTilt(o, a) { const c = Math.cos(a), s = Math.sin(a), y = o.y, z = o.z; o.y = y * c - z * s; o.z = y * s + z * c; return o; }
const hBasic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
const hBall = (mat, r, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(sphereGeometry, mat); m.scale.setScalar(r); m.position.set(x, y, z); return m; };
const hOnTop = m => { m.material.depthTest = false; m.material.transparent = true; m.renderOrder = 13; return m; };
const histExpand = t => 0.1 + 0.45 * (1 - Math.exp(-2.5 * t)) / (1 - Math.exp(-2.5));

// tablica opisu: kilka linijek, tekst sam się zmniejsza, gdy jest za długi
function makeFitBoard(width, lines) {
  const H = 62 * lines + 30;
  const [canvas, ctx] = makeCanvas(width, H);
  const tex = canvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 1);                                 // zaczepienie u góry
  sprite.userData.aspect = width / H;
  sprite.renderOrder = 11;
  let last = '';
  return {
    sprite,
    setText(list, colors = []) {
      const key = list.join('|');
      if (key === last) return;
      last = key;
      ctx.clearRect(0, 0, width, H);
      ctx.fillStyle = 'rgba(6,10,26,0.8)'; roundRect(ctx, 0, 0, width, H, 30); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      list.forEach((t, i) => {
        let size = i === 0 ? 50 : 41;
        const font = () => `${i < 2 ? 'bold ' : ''}${size}px system-ui, sans-serif`;
        ctx.font = font();
        while (size > 22 && ctx.measureText(t).width > width - 50) { size -= 2; ctx.font = font(); }
        ctx.fillStyle = colors[i] || '#ffffff';
        ctx.fillText(t, width / 2, 15 + 62 * i + 33);
      });
      tex.needsUpdate = true;
    },
  };
}

const hist = (() => {
  const root = new THREE.Group();                            // środek sceny; lokalne +z = w stronę widza
  mode12Group.add(root);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HIST_POINTS * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(HIST_POINTS * 3), 3));
  const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.024, map: glowTexture, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  cloud.frustumCulled = false;
  root.add(cloud);
  const seeds = new Float32Array(HIST_POINTS * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const fog = makeGlowSprite(0xffa060, 1.7, 0);              // „mgła” gorącego Wszechświata / wnętrze gwiazdy
  fog.position.set(0, 0, -0.35);
  root.add(fog);
  // znacznik naszego atomu – zawsze widoczny (rysowany na wierzchu)
  const marker = new THREE.Group();
  root.add(marker);
  const core = hOnTop(hBall(hBasic(0xfff2a8), 0.009));
  const glow = makeGlowSprite(0xffc040, 0.1, 0.9);
  glow.material.depthTest = false; glow.renderOrder = 13;
  marker.add(core, glow);
  const ring = new THREE.Group();                            // powłoki elektronowe (gdy atom ma elektrony)
  ring.rotation.set(1.15, 0, 0.3);
  marker.add(ring);
  const shells = [0.024, 0.04].map(r => { const l = makeCircleLineXZ(r, 48, 0x8fc8ff, 0.7); l.material.depthTest = false; l.renderOrder = 13; ring.add(l); return l; });
  const eMat = hBasic(0x9fd4ff);
  const electrons = [];
  for (let i = 0; i < 6; i++) { const e = hOnTop(hBall(eMat, 0.0045)); ring.add(e); electrons.push(e); }
  const co2 = new THREE.Group();                             // dwa atomy tlenu – cząsteczka CO₂
  marker.add(co2);
  const oMat = hBasic(0xff5a48);
  for (const s of [-1, 1]) co2.add(hOnTop(hBall(oMat, 0.0078, s * 0.019, 0, 0)));
  const label = makeLabel('Twój atom');
  label.material.depthTest = false; label.renderOrder = 14;
  mode12Group.add(label);
  // ślad: skąd atom przyleciał
  const TRAIL = 140;
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(tGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false; trail.renderOrder = 12;
  root.add(trail);
  const board = makeFitBoard(2100, 5);
  board.sprite.material.depthTest = false;                   // zawsze na wierzchu (nie chowa się za podłogą sceny)
  mode12Group.add(board.sprite);
  return { root, cloud, geo, seeds, fog, marker, glow, ring, shells, electrons, co2, label, trail, tGeo, TRAIL, tPts: [], board, clock: 0 };
})();
const histCtx = { pos: new THREE.Vector3(), name: '', e: 0, co2: false, when: '', text: [], fog: 0, fogColor: 0xffa060 };
const _ho = { x: 0, y: 0, z: 0, r: 0, g: 0, b: 0 };
const HIST_TET = [V(1, 1, 1), V(1, -1, -1), V(-1, 1, -1), V(-1, -1, 1)].map(v => v.multiplyScalar(0.0105));
const HIST_DM = [V(0.15, 0.05, 0), V(-0.3, 0.15, -0.1), V(-0.15, -0.25, 0.15), V(0.35, -0.2, -0.2), V(0.05, 0.3, -0.25), V(-0.4, -0.1, 0.25)];
function histBase1(S, k, T, out) {                          // pozycja cząstki w gorącej zupie (Rozdział 2)
  hSph(S[k], S[k + 1], out).multiplyScalar(Math.cbrt(S[k + 2]) * 0.5);
  out.x += 0.012 * Math.sin(T * 5 + S[k + 3] * 50); out.y += 0.012 * Math.sin(T * 6 + S[k] * 50); out.z += 0.012 * Math.cos(T * 5.5 + S[k + 1] * 50);
  return out;
}
const hRGB = (o, r, g, b, k = 1) => { o.r = r * k; o.g = g * k; o.b = b * k; };

// --- modele do scen: paproć, dinozaur ---
function makeHistFern() {
  const g = new THREE.Group(), leafMat = stdMat(0x3f8f3a, { side: THREE.DoubleSide }), stem = stdMat(0x4a6a2a);
  const leafGeos = [];
  for (let f = 0; f < 8; f++) {
    const a = f * Math.PI * 2 / 8 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
    const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(ca * 0.1, 0.3, sa * 0.1), V(ca * 0.28, 0.18, sa * 0.28));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.004, 4), stem));
    if (f === 0) g.userData.leaf = curve.getPoint(0.62);
    const side = V(-sa, 0, ca);
    for (let s = 0.15; s < 0.97; s += 0.06) {
      const p = curve.getPoint(s), tan = curve.getTangent(s), len = 0.05 * (1 - s * 0.7);
      for (const sg of [-1, 1]) {
        const x = side.clone().multiplyScalar(sg), z = new THREE.Vector3().crossVectors(x, tan).normalize();
        const m = new THREE.Matrix4().makeBasis(x, tan, z).setPosition(p.clone().addScaledVector(x, len / 2).addScaledVector(UP, -len * 0.15));
        leafGeos.push(new THREE.PlaneGeometry(len, 0.012).applyMatrix4(m));
      }
    }
  }
  g.add(mergedMesh(leafGeos, leafMat));
  return g;
}
function makeHistDino() {                                    // roślinożerca z długą szyją (głowa w stronę −x)
  const g = new THREE.Group(), skin = stdMat(0x6f8f4a, { roughness: 0.8 }), dark = hBasic(0x111111);
  g.add(ellipsoid(skin, 0.15, 0.085, 0.08, 0, 0.17, 0));
  g.add(beam(V(0.12, 0.19, 0), V(0.25, 0.14, 0), 0.04, skin, 8), beam(V(0.25, 0.14, 0), V(0.38, 0.08, 0), 0.022, skin, 8));
  const legs = [];
  for (const [x, z] of [[-0.08, 0.05], [-0.08, -0.05], [0.08, 0.05], [0.08, -0.05]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.14, z);
    leg.add(beam(V(0, 0, 0), V(0, -0.14, 0), 0.025, skin, 8));
    g.add(leg); legs.push(leg);
  }
  const neck = new THREE.Group();
  neck.position.set(-0.11, 0.2, 0);
  g.add(neck);
  neck.add(beam(V(0, 0, 0), V(-0.12, 0.15, 0), 0.026, skin, 8));
  const head = ellipsoid(skin, 0.045, 0.028, 0.03, -0.14, 0.16, 0);
  neck.add(head);
  for (const s of [-1, 1]) neck.add(hBall(dark, 0.006, -0.16, 0.175, s * 0.024));
  g.userData = { neck, head, legs };
  return g;
}

// --- rozdziały: build(g) – raz, przy pierwszym pokazaniu; update(t, g, A, T, dt) – co klatkę (t = 0…1 w rozdziale);
//     cloud(i, S, k, t, o, T) – położenie i kolor punktu i (S[k..k+3] – jego stałe liczby losowe) ---
const HIST = [
  {
    title: 'Wielki Wybuch', dur: 14,
    build(g) { this.q = [0xff4a4a, 0x4aff6a, 0x5a8aff].map(c => { const m = hBall(hBasic(c), 0.011); g.add(m); return m; }); },
    update(t, g, A, T) {
      A.pos.set(0.13, 0.05, 0.12).multiplyScalar(histExpand(t) / 0.55);
      const r = 0.012 + 0.05 * (1 - hSm(t, 0.3, 0.6));
      this.q.forEach((m, k) => {
        const a = T * 3 + k * 2.094;
        m.position.set(A.pos.x + Math.cos(a) * r, A.pos.y + Math.sin(a * 0.7) * r * 0.5, A.pos.z + Math.sin(a) * r);
        m.visible = t < 0.6;
      });
      A.fog = 0.55 * (1 - 0.4 * t); A.fogColor = 0xffe0b0;
      A.name = t < 0.6 ? 'jeszcze go nie ma – są 3 kwarki' : 'proton';
      A.when = t < 0.5 ? '13,8 mld lat temu – pierwsze ułamki sekundy' : 'ok. 1 milionowa sekundy po Wielkim Wybuchu';
      A.text = ['Wszechświat jest niewyobrażalnie gorący i gęsty – i rozszerza się wszędzie naraz', '(nie wybucha z jednego punktu jak bomba). Na razie są tylko kwarki, elektrony i światło.',
        t > 0.55 ? 'Trzy kwarki (2 „górne” i 1 „dolny”) łączą się w proton – to nasz bohater!' : 'Kolorowe kulki to trzy kwarki – za chwilę się połączą.'];
    },
    cloud(i, S, k, t, o, T) {
      const a = histExpand(t), r = Math.cbrt(S[k + 2]) * a, j = 0.012 * (1 - 0.6 * t);
      hSph(S[k], S[k + 1], _hv);
      o.x = _hv.x * r + j * Math.sin(T * 9 + S[k + 3] * 40); o.y = _hv.y * r + j * Math.sin(T * 11 + S[k] * 40); o.z = _hv.z * r + j * Math.cos(T * 10 + S[k + 1] * 40);
      const q = hSm(t, 0.4, 0.65), br = 0.7 - 0.4 * t, m = i % 3;
      o.r = hMix(m === 0 ? 1 : 0.35, 1, q) * br; o.g = hMix(m === 1 ? 1 : 0.35, 0.9 - 0.35 * t, q) * br; o.b = hMix(m === 2 ? 1 : 0.4, 0.75 - 0.55 * t, q) * br;
    },
  },
  {
    title: 'Pierwsze minuty: jądra helu', dur: 14,
    update(t, g, A, T) {
      A.pos.set(0.14 * Math.cos(t * 2.5) + 0.01 * Math.sin(T * 6), 0.06 * Math.sin(t * 4), 0.14 * Math.sin(t * 2.5) + 0.06);
      A.fog = 0.45; A.fogColor = 0xff9a50;
      A.name = 'proton (czyli jądro wodoru)';
      A.when = 'od 1 sekundy do ok. 20 minut po Wielkim Wybuchu';
      A.text = ['Jest goręcej niż we wnętrzu Słońca. Protony (czerwone) i neutrony (szare) zderzają się', 'i sklejają w jądra helu: 2 protony + 2 neutrony. Po ok. 20 minutach jest już za zimno.',
        'Ok. 1/4 masy staje się helem, reszta zostaje pojedynczymi protonami – nasz też.'];
    },
    cloud(i, S, k, t, o, T) {
      const g4 = (i >> 2) * 16;
      histBase1(S, k, T, _hv);
      let red = true;
      if (S[g4 + 3] < 0.25) {                               // ta czwórka zlepia się w jądro helu
        histBase1(S, g4, T, _hw).add(HIST_TET[i & 3]);
        _hv.lerp(_hw, hSm(t, 0.1 + S[g4 + 2] * 0.5, 0.2 + S[g4 + 2] * 0.5));
        red = (i & 3) < 2;
      }
      o.x = _hv.x; o.y = _hv.y; o.z = _hv.z;
      if (red) hRGB(o, 0.95, 0.32, 0.28, 0.55); else hRGB(o, 0.72, 0.74, 0.8, 0.55);
    },
  },
  {
    title: 'Pierwsze atomy – Wszechświat staje się przezroczysty', dur: 13,
    update(t, g, A, T) {
      A.pos.set(0.12, 0.05, 0.1);
      A.e = t > 0.5 ? 1 : 0;
      A.fog = 0.55 * (1 - hSm(t, 0.35, 0.75)); A.fogColor = 0xff8a40;
      A.name = t > 0.5 ? 'atom wodoru (H): proton + elektron' : 'proton';
      A.when = '380 000 lat po Wielkim Wybuchu';
      A.text = ['Wszechświat ostygł do ok. 3000°C. Światło nie wybija już elektronów (niebieskie)', 'i zostają one przy jądrach – powstają pierwsze atomy. Nasz proton łapie elektron.',
        'Mgła znika, światło leci swobodnie – widzimy je do dziś jako mikrofalowe promieniowanie tła.'];
    },
    cloud(i, S, k, t, o, T) {
      const nk = (i & ~1) * 4;
      hSph(S[nk], S[nk + 1], _hw).multiplyScalar(Math.cbrt(S[nk + 2]) * 0.52);
      if ((i & 1) === 0) { o.x = _hw.x; o.y = _hw.y; o.z = _hw.z; hRGB(o, 0.95, 0.35, 0.3, 0.5); return; }
      const f = hSm(t, 0.3 + 0.3 * S[k + 3], 0.36 + 0.3 * S[k + 3]);
      const fr = 0.08 * (1 - f) + 0.011 * f, w = hMix(9, 5, f), a1 = T * w + S[k] * 30, a2 = T * w * 0.77 + S[k + 1] * 30;
      o.x = _hw.x + Math.cos(a1) * fr; o.y = _hw.y + Math.sin(a2) * fr * (1 - 0.6 * f); o.z = _hw.z + Math.sin(a1) * fr;
      hRGB(o, 0.35, 0.6, 1, 0.6);
    },
  },
  {
    title: 'Ciemne wieki', dur: 13,
    build(g) { this.halos = HIST_DM.map(c => { const s = makeGlowSprite(0x8a5aff, 0.32, 0); s.position.copy(c); g.add(s); return s; }); },
    update(t, g, A) {
      for (const s of this.halos) s.material.opacity = 0.3 * hSm(t, 0, 0.6);
      A.pos.set(0.4, 0.2, 0.15).lerp(_hv.copy(HIST_DM[0]).add(_hw.set(0.03, 0.01, 0.02)), hSm(t, 0, 1));
      A.e = 1;
      A.name = 'atom wodoru (H)';
      A.when = 'od 380 tys. do ok. 100 mln lat po Wielkim Wybuchu';
      A.text = ['Nie świeci jeszcze żadna gwiazda – to „ciemne wieki” Wszechświata.', 'Grawitacja – głównie niewidzialnej ciemnej materii (fioletowe plamy) – zbiera gaz w grudki i nitki.',
        'Nasz atom wodoru dryfuje razem z gazem do jednej z grudek.'];
    },
    cloud(i, S, k, t, o) {
      const c = Math.min(5, Math.floor(S[k + 3] * 6)), C = HIST_DM[c];
      if (i % 10 < 3) _hw.copy(C).lerp(HIST_DM[(c + 1) % 6], S[k]).add(_hu.set(S[k + 1] - 0.5, S[k + 2] - 0.5, S[k] - 0.5).multiplyScalar(0.04));
      else hSph(S[k], S[k + 1], _hw).multiplyScalar(0.08 * Math.pow(S[k + 2], 1.5)).add(C);
      _hv.set((S[k] - 0.5) * 1.1, (S[k + 1] - 0.5) * 0.75, (S[k + 2] - 0.5) * 0.75).lerp(_hw, 0.92 * hSm(t, 0, 1));
      o.x = _hv.x; o.y = _hv.y; o.z = _hv.z;
      hRGB(o, 0.45, 0.5, 0.68, 0.3 + 0.25 * t);
    },
  },
  {
    title: 'Pierwsza gwiazda', dur: 13,
    build(g) {
      this.star = hBall(hBasic(0xd8e6ff), 1); this.glow = makeGlowSprite(0x9fc0ff, 1, 0.9);
      g.add(this.star, this.glow);
    },
    update(t, g, A) {
      const s = hSm(t, 0.55, 0.8);
      this.star.scale.setScalar(0.07 * s + 1e-4); this.star.visible = s > 0;
      this.glow.scale.setScalar(0.7 * s + 1e-4);
      const f = hSm(t, 0.05, 0.8), r = hMix(0.45, 0.0, f), ang = 0.7 + t * 2 * (0.45 / Math.max(r, 0.08));
      A.pos.set(Math.cos(ang) * r, 0.3 * r * (1 - f * 0.7), Math.sin(ang) * r);
      A.e = t < 0.75 ? 1 : 0;
      A.name = t < 0.75 ? 'atom wodoru (H)' : 'proton (w gwieździe atomy tracą elektrony)';
      A.when = 'ok. 100–200 mln lat po Wielkim Wybuchu (13,6 mld lat temu)';
      A.text = ['Grudka gazu zapada się i kręci coraz szybciej – jak łyżwiarka, która przyciąga ręce.', 'W środku robi się tak gęsto i gorąco, że zaczyna się fuzja: zapala się jedna z pierwszych gwiazd,',
        'ok. 100 razy cięższa od Słońca. Nasz atom wpada do jej środka.'];
    },
    cloud(i, S, k, t, o) {
      hSph(S[k], S[k + 1], _hv);
      const r0 = 0.12 + 0.43 * S[k + 2], f = hSm(t, S[k + 3] * 0.5, S[k + 3] * 0.5 + 0.4), r = hMix(r0, 0.015 + 0.05 * S[k + 2], f);
      const ang = t * 2.5 * Math.pow(r0 / r, 0.8), c = Math.cos(ang), s = Math.sin(ang);
      o.x = (_hv.x * c - _hv.z * s) * r; o.y = _hv.y * r * (1 - 0.75 * f); o.z = (_hv.x * s + _hv.z * c) * r;
      const hot = f * (1 - Math.min(1, r / 0.25));
      hRGB(o, hMix(0.35, 1, hot), hMix(0.45, 0.8, hot), hMix(0.75, 0.55, hot), 0.4 + 0.3 * hot);
    },
  },
  {
    title: 'W środku gwiazdy: z wodoru hel, z helu węgiel', dur: 18,
    build(g) {
      const matP = stdMat(0xe04030, { emissive: 0x401008 }), matN = stdMat(0xb0b0b8, { emissive: 0x202024 });
      this.matN = matN;
      this.balls = Array.from({ length: 12 }, (_, k) => { const m = hBall(k % 4 < 2 || k < 4 ? matP.clone() : matN, 0.03); g.add(m); return m; });
      this.final = fibonacciDirs(12).sort((a, b) => b.z - a.z).map(d => d.multiplyScalar(0.062));
      this.tet = HIST_TET.map(v => v.clone().multiplyScalar(2));
      this.startA = [V(-0.3, 0.2, 0.1), V(0.3, 0.15, 0.05), V(0.1, -0.3, 0.1), V(-0.2, -0.2, -0.2)];
      this.far = [V(0, 0, 0), V(-0.38, 0.18, -0.1), V(0.36, -0.16, -0.05)];
      this.near = [V(0, 0.04, 0.024), V(-0.07, -0.02, -0.02), V(0.07, -0.024, -0.02)];
      this.flash = makeGlowSprite(0xfff4c0, 0.3, 0); g.add(this.flash);
    },
    update(t, g, A, T) {
      const merge = hSm(t, 0.74, 0.84);
      for (let k = 0; k < 12; k++) {
        const h = k >> 2, m = this.balls[k];
        if (h === 0) {                                      // nasza czwórka: 4 protony → hel
          const f = hSm(t, 0.04 * k, 0.25 + 0.02 * k);
          _hv.copy(this.startA[k]).add(_hw.set(Math.sin(T * 7 + k), Math.cos(T * 6 + k * 2), Math.sin(T * 5 + k * 3)).multiplyScalar(0.01 * (1 - f)));
          _hv.lerp(_hu.copy(this.tet[k]), f);
          _hv.add(_hw.copy(this.near[0]).multiplyScalar(hSm(t, 0.45, 0.74)));
          if (k >= 2) m.material = t > 0.27 + 0.02 * k ? this.matN : this.balls[0].material;
          m.visible = true;
        } else {                                            // dwa inne jądra helu przylatują
          const f = hSm(t, 0.45, 0.74);
          _hv.copy(this.far[h]).add(_hw.set(Math.sin(T * 4 + h), Math.cos(T * 3 + h), 0).multiplyScalar(0.015 * (1 - f))).lerp(this.near[h], f).add(this.tet[k & 3]);
          m.visible = t > 0.42;
        }
        m.position.copy(_hv).lerp(this.final[k], merge);
      }
      const fl = Math.max(hSm(t, 0.25, 0.29) * (1 - hSm(t, 0.29, 0.36)), hSm(t, 0.76, 0.8) * (1 - hSm(t, 0.8, 0.9)));
      this.flash.material.opacity = fl; this.flash.scale.setScalar(0.1 + 0.35 * fl);
      A.pos.copy(this.balls[0].position);
      A.fog = 0.38; A.fogColor = 0xffb070;
      A.name = t < 0.3 ? 'proton' : t < 0.8 ? 'jądro helu (2 protony + 2 neutrony)' : 'jądro węgla (6 protonów + 6 neutronów)';
      A.when = t < 0.42 ? 'w środku gwiazdy, przez ok. 2–3 mln lat' : 'pod koniec życia gwiazdy (ok. 100 mln °C)';
      A.text = t < 0.42
        ? ['Powiększenie: widzisz pojedyncze jądra atomów (naprawdę są bilion razy mniejsze od milimetra).', 'W ogromnej temperaturze 4 protony stapiają się w jądro helu – 2 z nich zamieniają się w neutrony.',
          'Uwolniona przy tym energia sprawia, że gwiazda świeci.']
        : ['Gdy wodór w środku się kończy, gwiazda kurczy się i grzeje jeszcze bardziej.', 'Wtedy trzy jądra helu łączą się w jedno jądro węgla.',
          'Nasz proton jest teraz jednym z 6 protonów węgla – i zostanie nim aż do dziś!'];
    },
    cloud(i, S, k, t, o, T) {
      if (i % 2) return;
      hSph(S[k], S[k + 1], _hv).multiplyScalar(0.15 + 0.4 * Math.cbrt(S[k + 2]));
      o.x = _hv.x + 0.03 * Math.sin(T * 6 + S[k + 3] * 40); o.y = _hv.y + 0.03 * Math.sin(T * 7 + S[k] * 40); o.z = _hv.z + 0.03 * Math.cos(T * 6.5 + S[k + 1] * 40);
      hRGB(o, 1, 0.65, 0.35, 0.22);
    },
  },
  {
    title: 'Supernowa', dur: 13,
    build(g) {
      this.star = hBall(hBasic(0xcfe0ff), 1); this.glow = makeGlowSprite(0xa8c8ff, 1, 0.8);
      this.flash = makeGlowSprite(0xffffff, 1, 0); this.rest = makeGlowSprite(0xa0d0ff, 0.05, 0.9);
      g.add(this.star, this.glow, this.flash, this.rest);
      this.dir = V(0.6, 0.35, 0.7).normalize();
    },
    update(t, g, A) {
      const boom = 0.3, grow = hSm(t, 0, boom), col = new THREE.Color(0xcfe0ff).lerp(new THREE.Color(0xff7040), grow);
      const R = t < boom ? hMix(0.12, 0.2, grow) : 0.2 * (1 - hSm(t, boom, boom + 0.03));
      this.star.scale.setScalar(R + 1e-4); this.star.visible = R > 0.002; this.star.material.color.copy(col);
      this.glow.scale.setScalar(3 * R + 1e-4); this.glow.material.color.copy(col);
      const fl = hSm(t, boom, boom + 0.02) * (1 - hSm(t, boom + 0.03, 0.5));
      this.flash.material.opacity = fl; this.flash.scale.setScalar(0.4 + 1.4 * fl);
      this.rest.visible = t > boom + 0.04;
      A.pos.copy(this.dir).multiplyScalar(t < boom ? 0.08 + 0.04 * grow : 0.12 + 0.38 * Math.pow(hSm(t, boom, 1), 0.7));
      A.name = 'jądro węgla (C)';
      A.when = 'kilka mln lat po narodzinach gwiazdy (ok. 13,5 mld lat temu)';
      A.text = t < boom
        ? ['Gwiazda zużywa paliwo i puchnie w ogromnego nadolbrzyma.', 'Tak ciężkie gwiazdy żyją krótko – zaledwie kilka milionów lat.', '']
        : ['Środek gwiazdy zapada się w ułamku sekundy (zostaje gwiazda neutronowa albo czarna dziura),', 'a reszta zostaje wyrzucona w gigantycznym wybuchu – supernowej.', 'Nasz węgiel leci w kosmos z prędkością tysięcy kilometrów na sekundę.'];
    },
    cloud(i, S, k, t, o) {
      if (t < 0.31) return;
      const f = (t - 0.31) / 0.69, layer = S[k + 3];
      hSph(S[k], S[k + 1], _hv);
      const finger = 1 + 0.12 * Math.sin(_hv.x * 13 + _hv.y * 7) * Math.sin(_hv.z * 11 + _hv.x * 5);
      const r = (0.04 + 0.55 * Math.pow(f, 0.6)) * (0.55 + 0.45 * layer) * finger;
      o.x = _hv.x * r; o.y = _hv.y * r; o.z = _hv.z * r;
      const b = 0.75 * (1 - 0.6 * f);
      if (layer < 0.33) hRGB(o, 0.55, 0.65, 1, b);          // żelazo, krzem
      else if (layer < 0.66) hRGB(o, 1, 0.85, 0.35, b);     // węgiel, tlen
      else hRGB(o, 1, 0.35, 0.3, b);                        // wodór, hel
    },
  },
  {
    title: 'Miliardy lat wędrówki po Galaktyce', dur: 15,
    update(t, g, A) {
      const ang = 0.9 - t * 1.2;
      A.pos.set(Math.cos(ang) * 0.3, 0, Math.sin(ang) * 0.3);
      hTilt(A.pos, 0.6);
      A.e = t > 0.08 ? 6 : 0;
      A.name = t > 0.08 ? 'atom węgla (C) w ziarenku pyłu' : 'jądro węgla (C)';
      A.when = 'od ok. 13 do 5 mld lat temu';
      A.text = ['Węgiel stygnie i łapie 6 elektronów – jest już pełnym atomem. Przykleja się do ziarenka pyłu.', 'Przez miliardy lat krąży po Galaktyce (jedno okrążenie trwa ok. 230 mln lat).',
        'Wokół rodzą się i wybuchają kolejne pokolenia gwiazd – każda dokłada nowe pierwiastki.'];
    },
    cloud(i, S, k, t, o, T) {
      if (i % 5 === 0) {                                    // zgrubienie centralne
        hSph(S[k], S[k + 1], _hv).multiplyScalar(0.09 * Math.cbrt(S[k + 2]));
        o.x = _hv.x; o.y = _hv.y * 0.6; o.z = _hv.z;
        hRGB(o, 1, 0.85, 0.6, 0.3);
      } else {
        const rr = 0.07 + 0.45 * Math.pow(S[k], 0.9), spread = (S[k + 1] - 0.5) * (1.3 - 0.8 * hSm(t, 0, 0.6));
        const ang = (i & 1) * Math.PI + Math.log(rr / 0.07) * 2 + spread - t * 1.2;
        o.x = Math.cos(ang) * rr; o.y = (S[k + 2] - 0.5) * 0.025; o.z = Math.sin(ang) * rr;
        let b = 0.38;
        if (S[k + 3] < 0.015) b += 1.8 * Math.pow(Math.max(0, Math.sin(T * 1.5 + S[k] * 60)), 20);   // błyski: nowe gwiazdy i supernowe
        hRGB(o, 0.6, 0.7, 1, b);
      }
      hTilt(o, 0.6);
    },
  },
  {
    title: 'Kolejna gwiazda', dur: 15,
    build(g) {
      this.star = hBall(hBasic(0xffd890, { transparent: true, opacity: 0.85, depthWrite: false }), 1); this.glow = makeGlowSprite(0xffc070, 1, 0.7);
      this.wd = makeGlowSprite(0xe8f0ff, 0.06, 0.95);
      g.add(this.star, this.glow, this.wd);
      this.dir = V(0.55, 0.45, 0.7).normalize();
    },
    R(t) {
      if (t < 0.15) return 0.12 * hSm(t, 0.02, 0.15);
      if (t < 0.72) return hMix(0.12, 0.3, hSm(t, 0.5, 0.7));
      return 0.3 * (1 - hSm(t, 0.72, 0.82));
    },
    update(t, g, A) {
      const R = this.R(t), col = new THREE.Color(0xffd890).lerp(new THREE.Color(0xff6a3a), hSm(t, 0.5, 0.7));
      this.star.scale.setScalar(R + 1e-4); this.star.visible = R > 0.003; this.star.material.color.copy(col);
      this.glow.scale.setScalar(3 * R + 1e-4); this.glow.material.color.copy(col);
      this.wd.visible = t > 0.78;
      const d = _hw.copy(this.dir).applyAxisAngle(UP, 0.6 * Math.sin(t * 9));
      if (t < 0.15) A.pos.set(0.4, 0.25, 0.25).lerp(_hv.copy(this.dir).multiplyScalar(Math.max(R, 0.02) * 0.9), hSm(t, 0, 0.15));
      else if (t < 0.72) A.pos.copy(d).multiplyScalar(R * (0.82 + 0.12 * Math.sin(t * 25)));
      else A.pos.copy(d).multiplyScalar(hMix(0.27, 0.5, hSm(t, 0.72, 1)));
      const inStar = t > 0.12 && t < 0.78;
      A.e = inStar ? 0 : 6;
      A.name = inStar ? 'jądro węgla w zewnętrznej warstwie gwiazdy' : 'atom węgla (C)';
      A.when = 'gdzieś między 10 a 5 mld lat temu';
      A.text = t < 0.5
        ? ['Nasz atom wpada do kolejnej, mniejszej gwiazdy – ale tylko do zewnętrznych warstw,', 'gdzie jest za zimno, żeby się przetopić. Krąży tam z prądami gorącego gazu.',
          'Wiele atomów przeszło przez kilka gwiazd – dokładnej drogi jednego atomu nikt nie zna.']
        : ['Gwiazda się starzeje: puchnie w czerwonego olbrzyma i łagodnie zdmuchuje swoje warstwy', '(tak powstaje mgławica planetarna). Zostaje mały, gorący biały karzeł.', 'Nasz węgiel znów jest wolny i dryfuje w chmurze gazu i pyłu.'];
    },
    cloud(i, S, k, t, o) {
      hSph(S[k], S[k + 1], _hv);
      if (t < 0.17) {
        const f = hSm(t, S[k + 3] * 0.08, 0.17);
        if (f >= 1) return;
        const r = hMix(0.15 + 0.4 * S[k + 2], 0.12, f);
        o.x = _hv.x * r; o.y = _hv.y * r; o.z = _hv.z * r;
        hRGB(o, 0.4, 0.45, 0.6, 0.4);
      } else if (t > 0.72) {
        const f = hSm(t, 0.72, 1), r = (0.05 + 0.45 * f) * (0.75 + 0.25 * S[k + 2]) * (1 + 0.35 * _hv.y * _hv.y);
        o.x = _hv.x * r; o.y = _hv.y * r; o.z = _hv.z * r;
        if (S[k + 3] < 0.5) hRGB(o, 0.3, 0.85, 0.95, 0.45 * (1 - 0.5 * f)); else hRGB(o, 1, 0.35, 0.35, 0.45 * (1 - 0.5 * f));
      }
    },
  },
  {
    title: 'Narodziny Słońca', dur: 15,
    build(g) { this.sun = hBall(hBasic(0xffe080), 1); this.glow = makeGlowSprite(0xffd060, 0.4, 0.9); g.add(this.sun, this.glow); },
    update(t, g, A) {
      const s = hSm(t, 0.5, 0.65);
      this.sun.scale.setScalar(0.035 * s + 1e-4); this.sun.visible = s > 0; this.glow.scale.setScalar(0.45 * s + 1e-4);
      const f = hSm(t, 0.25, 0.65), ang = 1.0 + t * 5 * Math.pow(0.15 / 0.22, 1.5);
      A.pos.set(0.25, 0.12, 0.2).lerp(hTilt(_hv.set(Math.cos(ang) * 0.22, 0, Math.sin(ang) * 0.22), 0.5), f);
      A.e = 6;
      A.name = 'atom węgla w ziarenku pyłu (lód i sadza)';
      A.when = '4,6 mld lat temu';
      A.text = t < 0.3
        ? ['Fala uderzeniowa – prawdopodobnie z pobliskiej supernowej – ściska chmurę gazu i pyłu.', 'W chmurze są atomy z wielu wcześniejszych gwiazd – także nasz.', '']
        : ['Chmura zapada się w wirujący dysk, a w środku zapala się nowa gwiazda – nasze Słońce.', 'Pył zlepia się w coraz większe grudki. Nasz atom krąży tam,', 'gdzie za chwilę powstanie Ziemia.'];
    },
    cloud(i, S, k, t, o) {
      if (i < 800) {                                        // czoło fali uderzeniowej
        if (t > 0.4) return;
        const Rs = hMix(0.9, 2.1, t / 0.4), th = Math.acos(1 - S[k] * (1 - Math.cos(0.42))), ph = S[k + 1] * 2 * Math.PI;
        o.x = -1.6 + Math.cos(th) * Rs; o.y = Math.sin(th) * Math.cos(ph) * Rs; o.z = Math.sin(th) * Math.sin(ph) * Rs;
        hRGB(o, 1, 0.55, 0.3, 0.55 * (1 - t / 0.4));
        return;
      }
      hSph(S[k], S[k + 1], _hv).multiplyScalar(0.12 + 0.33 * Math.cbrt(S[k + 2]));
      _hv.x += 0.06 * hSm(t, 0.05, 0.3) * (0.4 - _hv.x);
      const f = hSm(t, 0.25 + 0.1 * S[k + 3], 0.6 + 0.1 * S[k + 3]);
      const rd = 0.035 + 0.45 * Math.pow(S[k + 2], 0.8), ang = S[k + 1] * 6.283 + t * 5 * Math.pow(0.15 / rd, 1.5);
      _hw.set(Math.cos(ang) * rd, (S[k + 3] - 0.5) * 0.02 * (rd / 0.3), Math.sin(ang) * rd);
      hTilt(_hw, 0.5);
      _hv.lerp(_hw, f);
      o.x = _hv.x; o.y = _hv.y; o.z = _hv.z;
      let b = 0.5;
      if (t > 0.75 && ((rd > 0.165 && rd < 0.19) || (rd > 0.29 && rd < 0.32))) b *= 1 - hSm(t, 0.75, 0.9);   // przerwy – tam rosną planety
      const hot = rd < 0.1 ? f * (1 - rd / 0.1) : 0;
      hRGB(o, hMix(0.55, 1, hot), hMix(0.45, 0.8, hot), hMix(0.35, 0.5, hot), b);
    },
  },
  {
    title: 'Narodziny Ziemi i Księżyca', dur: 15,
    build(g) {
      this.earthMat = stdMat(0x4a3a30, { roughness: 0.9, emissive: 0xff5010 });
      this.earth = hBall(this.earthMat, 1);
      this.theia = hBall(stdMat(0x8a7a6a, { emissive: 0x401a08 }), 0.055);
      this.moon = hBall(stdMat(0x9a9a9a), 0.03);
      this.flash = makeGlowSprite(0xffd8a0, 0.5, 0);
      this.atmo = makeGlowSprite(0x6fa8ff, 0.4, 0);
      this.dir = V(0.45, 0.6, 0.66).normalize();
      this.volcano = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.035, 16), stdMat(0x2a2420));
      this.volcano.quaternion.setFromUnitVectors(UP, this.dir);
      this.lava = makeGlowSprite(0xff7020, 0.05, 0);
      g.add(this.earth, this.theia, this.moon, this.flash, this.atmo, this.volcano, this.lava);
    },
    update(t, g, A) {
      const R = 0.03 + 0.12 * hSm(t, 0, 0.55);
      this.earth.scale.setScalar(R);
      const heat = (t < 0.6 ? 0.9 : 0.9 * (1 - hSm(t, 0.65, 0.85))) + 0.6 * hSm(t, 0.58, 0.61) * (1 - hSm(t, 0.62, 0.72));
      this.earthMat.emissiveIntensity = heat;
      this.earthMat.color.setRGB(0.3, 0.25, 0.22).lerp(_c1.setRGB(0.18, 0.35, 0.7), hSm(t, 0.85, 1));
      this.theia.visible = t > 0.45 && t < 0.61;
      this.theia.position.set(-0.7, 0.3, -0.1).lerp(_hv.set(-0.15, 0.06, 0), hSm(t, 0.45, 0.6));
      const fl = hSm(t, 0.59, 0.61) * (1 - hSm(t, 0.62, 0.7));
      this.flash.material.opacity = fl; this.flash.position.set(-0.12, 0.05, 0.02); this.flash.scale.setScalar(0.2 + 0.5 * fl);
      this.moon.visible = t > 0.68;
      this.moon.scale.setScalar(0.03 * hSm(t, 0.66, 0.78) + 1e-4);
      this.moon.position.set(Math.cos(1 + t * 5) * 0.32, 0.05, Math.sin(1 + t * 5) * 0.32);
      this.atmo.material.opacity = 0.45 * hSm(t, 0.78, 0.95); this.atmo.scale.setScalar(2.8 * R);
      this.volcano.position.copy(this.dir).multiplyScalar(R * 0.98);
      this.volcano.visible = t > 0.65;
      this.lava.position.copy(this.dir).multiplyScalar(R + 0.03); this.lava.material.opacity = 0.9 * hSm(t, 0.7, 0.75);
      if (t < 0.3) A.pos.set(0.35, 0.25, 0.3).lerp(_hv.copy(this.dir).multiplyScalar(R), hSm(t, 0, 0.3));
      else if (t < 0.72) A.pos.copy(this.dir).multiplyScalar(R * 0.85);
      else A.pos.copy(this.dir).multiplyScalar(hMix(R * 0.85, R + 0.08, hSm(t, 0.72, 0.92))).add(_hv.set(0.04, 0.02, 0).multiplyScalar(hSm(t, 0.9, 1)));
      A.e = 6;
      A.co2 = t > 0.76;
      A.name = t < 0.3 ? 'atom węgla w ziarenku pyłu' : t < 0.76 ? 'atom węgla w gorącej skale' : 'dwutlenek węgla (CO₂) z wulkanu';
      A.when = '4,54 mld lat temu';
      A.text = t < 0.45
        ? ['Pył i kamienie zderzają się i zlepiają w coraz większe bryły, a z nich powstaje młoda Ziemia –', 'rozżarzona od zderzeń. Nasz atom ląduje na niej razem z ziarenkiem pyłu.', '']
        : t < 0.72 ? ['Ziemia zderza się z planetą wielkości Marsa (nazywamy ją Theia).', 'Z wyrzuconych odłamków powstaje Księżyc.', '']
          : ['Ziemia stygnie. Wulkany wypuszczają gazy – tak powstaje atmosfera, a para wodna skrapla się w oceany.', 'Nasz węgiel wydostaje się z wulkanu jako CO₂:', 'cząsteczka z 1 atomu węgla i 2 atomów tlenu (czerwone).'];
    },
    cloud(i, S, k, t, o) {
      if (i < 1500) {                                       // odłamki po zderzeniu → Księżyc
        if (t < 0.6 || t > 0.82) return;
        const rr = 0.2 + 0.15 * S[k], ang = S[k + 1] * 6.283 + t * 8;
        o.x = Math.cos(ang) * rr; o.y = 0.05 + (S[k + 2] - 0.5) * 0.03; o.z = Math.sin(ang) * rr;
        hRGB(o, 1, 0.55, 0.3, 0.1 * (1 - hSm(t, 0.66, 0.82)));
        return;
      }
      const R = 0.03 + 0.12 * hSm(t, 0, 0.55), f = hSm(t, S[k + 3] * 0.45, S[k + 3] * 0.45 + 0.12);
      if (f >= 1) return;
      hSph(S[k], S[k + 1], _hv).multiplyScalar(hMix(0.18 + 0.37 * S[k + 2], R, f));
      o.x = _hv.x; o.y = _hv.y; o.z = _hv.z;
      const hot = hSm(f, 0.7, 1);
      hRGB(o, hMix(0.55, 1, hot), hMix(0.5, 0.5, hot), hMix(0.45, 0.2, hot), 0.45);
    },
  },
  {
    title: 'Ocean i pierwsze życie', dur: 16,
    build(g) {
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 48), stdMat(0x3a3028, { roughness: 1 }));
      floor.position.y = -0.345;
      g.add(floor);
      const rock = stdMat(0x2a2622, { roughness: 1 });
      [[0.035, 0.06, 0.12, -0.27], [0.028, 0.045, 0.1, -0.16], [0.02, 0.032, 0.07, -0.075]].forEach(([a, b, h, y]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, 14), rock); m.position.set(-0.15, y, 0); g.add(m);
      });
      const water = makeGlowSprite(0x1a3a7a, 2.2, 0.75); water.position.set(0, 0, -0.45); g.add(water);
      const vent = makeGlowSprite(0xff8a40, 0.1, 0.8); vent.position.set(-0.15, -0.04, 0); g.add(vent);
      const cellMat = () => stdMat(0x7fd88f, { transparent: true, opacity: 0.35, depthWrite: false, emissive: 0x0a3a14 });
      this.cells = [hBall(cellMat(), 1), hBall(cellMat(), 1)];
      g.add(...this.cells);
    },
    cellPos(t, n, out) {
      const d = hSm(t, 0.7, 0.9);
      return out.set(0.12 + (n ? 0.065 : -0.065) * d, -0.08, 0.08);
    },
    update(t, g, A) {
      const appear = hSm(t, 0.35, 0.5), d = hSm(t, 0.7, 0.9);
      this.cells.forEach((c, n) => {
        this.cellPos(t, n, c.position);
        c.scale.setScalar(0.065 * (1 - 0.22 * d) * appear + 1e-4);
        c.visible = n === 0 ? appear > 0 : t > 0.7;
      });
      this.cellPos(t, 1, _hv).add(_hw.set(0.015, 0.012, 0.02));
      hPath([[0, 0.35, 0.22, 0.1], [0.3, -0.1, -0.02, 0.05], [0.45, _hv.x, _hv.y, _hv.z]], t, A.pos);
      if (t > 0.45) A.pos.copy(_hv);
      A.e = 6; A.co2 = t < 0.3;
      A.name = t < 0.3 ? 'CO₂ rozpuszczony w oceanie' : t < 0.45 ? 'węgiel w cząsteczce organicznej' : 'węgiel w jednej z pierwszych komórek';
      A.when = 'ok. 4–3,5 mld lat temu';
      A.text = t < 0.45
        ? ['W ciemnym oceanie, przy gorących źródłach na dnie (kominach hydrotermalnych),', 'z CO₂ i innych prostych cząsteczek powstają cząsteczki organiczne.', 'Nasz węgiel staje się częścią jednej z nich.']
        : ['Z takich cząsteczek powstają pierwsze proste komórki. Komórka rośnie i dzieli się na dwie –', 'nasz węgiel jest w jednej z nich. (Jak dokładnie powstało życie, naukowcy wciąż badają;', 'kominy na dnie oceanu to jedna z głównych hipotez.)'];
    },
    cloud(i, S, k, t, o, T) {
      if (i < 2500) {                                       // gorąca woda z komina
        if (i % 2) return;
        const age = (S[k] + T * 0.12) % 1;
        o.x = -0.15 + (S[k + 1] - 0.5) * 0.12 * age + 0.05 * age; o.y = -0.04 + age * 0.5; o.z = (S[k + 2] - 0.5) * 0.12 * age;
        hRGB(o, 0.6, 0.4, 0.3, 0.13 * (1 - age));
      } else if (i < 4000) {                                // drobne cząsteczki w wodzie
        hSph(S[k], S[k + 1], _hv).multiplyScalar(0.4 * Math.cbrt(S[k + 2]));
        o.x = -0.05 + _hv.x + 0.01 * Math.sin(T + S[k + 3] * 30); o.y = Math.max(-0.32, -0.1 + _hv.y * 0.6); o.z = _hv.z * 0.7;
        hRGB(o, 0.3, 0.7, 0.8, 0.12);
      } else {                                              // wnętrze komórek
        const appear = hSm(t, 0.35, 0.5);
        if (!appear) return;
        const n = t > 0.7 ? i & 1 : 0;
        this.cellPos(t, n, _hw);
        hSph(S[k], S[k + 1], _hv).multiplyScalar(0.05 * Math.cbrt(S[k + 2]) * appear).add(_hw);
        o.x = _hv.x; o.y = _hv.y; o.z = _hv.z;
        hRGB(o, 0.4, 0.95, 0.5, 0.35);
      }
    },
  },
  {
    title: 'Skały i wulkany – obieg węgla', dur: 15,
    build(g) {
      const D = 0.3;
      const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
      box(1.1, 0.4, D, 0, -0.35, 0, stdMat(0x7a2a10, { emissive: 0x3a0c00 }));               // płaszcz Ziemi
      box(0.7, 0.08, D, -0.2, -0.11, 0, stdMat(0x4a4a52));                                  // płyta oceaniczna
      const slab = box(0.42, 0.08, D + 0.01, 0.15 + Math.cos(0.8) * 0.21, -0.11 - Math.sin(0.8) * 0.21, 0, stdMat(0x4a4a52));
      slab.rotation.z = -0.8;
      box(0.4, 0.3, D, 0.35, 0, 0, stdMat(0x7a5a3a));                                      // kontynent
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 24), stdMat(0x4a3a30)); cone.position.set(0.35, 0.25, 0); g.add(cone);
      box(0.7, 0.22, D, -0.2, 0.04, 0, stdMat(0x2a6ac8, { transparent: true, opacity: 0.45, depthWrite: false }));   // ocean
      this.layers = [0, 1, 2].map(n => { const m = box(0.7, 0.012, D + 0.012, -0.2, -0.065 + 0.012 * n, 0, stdMat([0xe8dcc0, 0xd8c8a8, 0xeee4cc][n])); m.visible = false; return m; });
      g.add(beam(V(0.32, -0.3, 0.16), V(0.35, 0.33, 0.16), 0.01, hBasic(0xff6a20)));
      this.chamber = makeGlowSprite(0xff7020, 0.2, 0.8); this.chamber.position.set(0.33, -0.15, 0.16);
      this.vent = makeGlowSprite(0xff8030, 0.12, 0);
      this.vent.position.set(0.35, 0.36, 0.05);
      g.add(this.chamber, this.vent);
    },
    update(t, g, A) {
      this.layers.forEach((m, n) => { m.visible = t > 0.12 + 0.07 * n; });
      this.vent.material.opacity = 0.9 * hSm(t, 0.78, 0.84);
      hPath([[0, -0.2, 0.12, 0.17], [0.18, -0.2, -0.058, 0.17], [0.35, -0.2, -0.058, 0.17], [0.5, 0.12, -0.1, 0.17], [0.65, 0.31, -0.3, 0.17],
        [0.75, 0.33, -0.12, 0.17], [0.86, 0.35, 0.34, 0.17], [1, 0.2, 0.5, 0.17]], t, A.pos);
      A.e = 6; A.co2 = t > 0.84;
      A.name = t < 0.2 ? 'węgiel w martwej komórce' : t < 0.65 ? 'węglan wapnia (CaCO₃) – wapień' : t < 0.84 ? 'węgiel w stopionej skale (magmie)' : 'CO₂ z wulkanu';
      A.when = 'przez setki milionów lat (wiele razy)';
      A.text = t < 0.35
        ? ['Komórka umiera i opada na dno. Z resztek organizmów i muszelek powstaje skała – wapień.', 'Nasz węgiel zostaje w niej uwięziony na miliony lat.', '']
        : t < 0.65 ? ['Płyty skorupy ziemskiej przesuwają się (kilka cm na rok). Płyta oceaniczna wsuwa się', 'pod kontynent i zabiera skałę z naszym atomem w głąb Ziemi.', '']
          : ['W głębi skała się topi, a wulkan wyrzuca węgiel z powrotem do powietrza jako CO₂.', 'Taki obieg (powietrze → ocean → organizmy → skały → wulkany) nasz atom', 'mógł przejść wiele razy – jeden trwa miliony lat.'];
    },
    cloud(i, S, k, t, o, T) {
      if (i < 1500) {                                       // „śnieg morski” – resztki opadające na dno
        const b = 0.2 * (1 - hSm(t, 0.3, 0.4));
        if (!b || i % 3) return;
        o.x = -0.55 + 0.7 * S[k]; o.y = 0.15 - ((S[k + 1] + T * 0.05) % 1) * 0.22; o.z = (S[k + 2] - 0.5) * 0.28;
        hRGB(o, 1, 1, 1, b);
      } else if (t > 0.8) {                                 // erupcja
        const age = (S[k] + T * 0.4) % 1, b = hSm(t, 0.8, 0.88) * (1 - age);
        o.x = 0.35 + (S[k + 1] - 0.5) * age * 0.25; o.y = 0.35 + age * 0.35 * (0.6 + 0.4 * S[k + 3]); o.z = (S[k + 2] - 0.5) * age * 0.2;
        hRGB(o, hMix(1, 0.6, age), hMix(0.5, 0.55, age), hMix(0.15, 0.5, age), 0.6 * b);
      }
    },
  },
  {
    title: 'Paproć i dinozaur', dur: 16,
    build(g) {
      const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 48), stdMat(0x5a6a2e, { roughness: 1 }));
      ground.position.y = -0.36;
      this.fern = makeHistFern(); this.fern.position.set(-0.2, -0.35, 0);
      this.dino = makeHistDino();
      const sun = makeGlowSprite(0xfff0a0, 0.5, 0.8); sun.position.set(-0.45, 0.42, -0.3);
      g.add(ground, this.fern, this.dino, sun);
      this.leaf = this.fern.userData.leaf.clone().add(this.fern.position);
    },
    update(t, g, A, T) {
      const D = this.dino.userData, stopX = this.leaf.x + 0.11 + 0.212;
      const walk = hSm(t, 0.28, 0.5), leave = hSm(t, 0.88, 1);
      this.dino.position.set(hMix(0.85, stopX, walk) + leave * 0.15, -0.35, this.leaf.z);
      const moving = (walk > 0 && walk < 1) || (leave > 0 && leave < 1);
      D.legs.forEach((l, n) => { l.rotation.z = moving ? Math.sin(T * 8 + (n % 2) * Math.PI + (n >> 1) * 1.6) * 0.35 : 0; });
      D.neck.rotation.z = 0.9 * hSm(t, 0.5, 0.58) * (1 - hSm(t, 0.68, 0.76));
      this.dino.updateMatrixWorld(true);
      D.head.getWorldPosition(_hw); hist.root.worldToLocal(_hw);         // pysk dinozaura (w układzie sceny)
      const body = _hu.copy(this.dino.position).add(_hv.set(0, 0.17, 0));
      if (t < 0.25) A.pos.set(0.3, 0.35, 0.1).lerp(this.leaf, hSm(t, 0, 0.25));
      else if (t < 0.58) A.pos.copy(this.leaf);
      else if (t < 0.62) A.pos.copy(this.leaf).lerp(_hw, hSm(t, 0.58, 0.62));
      else if (t < 0.76) A.pos.copy(_hw).lerp(body, hSm(t, 0.62, 0.72));
      else if (t < 0.86) A.pos.copy(body).lerp(_hw, hSm(t, 0.78, 0.86));
      else A.pos.copy(_hw).add(_hv.set(-0.05, 0.25, 0.05).multiplyScalar(hSm(t, 0.86, 1)));
      A.e = 6; A.co2 = t < 0.25 || t > 0.84;
      A.name = t < 0.25 ? 'CO₂ w powietrzu' : t < 0.6 ? 'cukier (glukoza) w liściu paproci' : t < 0.84 ? 'cukier w ciele dinozaura' : 'CO₂ wydychany przez dinozaura';
      A.when = 'ok. 70 mln lat temu';
      A.text = t < 0.5
        ? ['Paproć pobiera CO₂ z powietrza i dzięki energii światła słonecznego robi z niego cukier,', 'a do powietrza oddaje tlen. To fotosynteza.', 'Nasz węgiel jest teraz częścią liścia.']
        : ['Roślinożerny dinozaur zjada liść. Cukier daje mu energię: w jego komórkach', '„spala się” z tlenem z powrotem na CO₂ i wodę.', 'Dinozaur wydycha nasz węgiel jako CO₂.'];
    },
    cloud(i, S, k, t, o, T) {
      if (i < 1200) {                                       // powietrze
        o.x = (S[k] - 0.5) * 1.0 + 0.02 * Math.sin(T * 0.5 + S[k + 3] * 20); o.y = -0.3 + S[k + 1] * 0.7; o.z = (S[k + 2] - 0.5) * 0.6;
        hRGB(o, 0.5, 0.6, 0.7, 0.12);
      } else if (i < 1800 && t > 0.1 && t < 0.55) {         // fotosynteza – iskierki światła na liściach
        hSph(S[k], S[k + 1], _hv); _hv.y = Math.abs(_hv.y);
        o.x = this.fern.position.x + _hv.x * 0.28 * S[k + 2]; o.y = -0.3 + _hv.y * 0.2; o.z = _hv.z * 0.28 * S[k + 2];
        hRGB(o, 0.9, 1, 0.5, 0.5 * Math.pow(Math.max(0, Math.sin(T * 3 + S[k + 3] * 40)), 6));
      }
    },
  },
  {
    title: 'Pszenica i chleb', dur: 15,
    build(g) {
      const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 48), stdMat(0x6a5030, { roughness: 1 }));
      ground.position.y = -0.36;
      g.add(ground);
      this.stalkMat = stdMat(0x5a9a3a); this.earMat = stdMat(0x7aa84a);
      this.field = new THREE.Group(); g.add(this.field);
      const rnd = seededRandom('pszenica');
      for (let i = 0; i < 44; i++) {
        const x = i === 0 ? 0.05 : (rnd() - 0.5) * 0.85, z = i === 0 ? 0.14 : (rnd() - 0.5) * 0.55, h = 0.32 + (i === 0 ? 0.05 : rnd() * 0.12);
        const s = new THREE.Group();
        s.position.set(x, 0, z);
        if (i) s.rotation.set((rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15);
        s.add(beam(V(0, 0, 0), V(0, h, 0), 0.004, this.stalkMat, 5), beam(V(0, 0.1, 0), V(0.06, 0.2, 0.01), 0.003, this.stalkMat, 4));
        s.add(ellipsoid(this.earMat, 0.012, 0.045, 0.012, 0, h + 0.04, 0));
        this.field.add(s);
        if (!i) this.s0 = { x, z, h };
      }
      this.field.position.y = -0.35;
      this.bread = new THREE.Group();
      this.bread.add(ellipsoid(stdMat(0xb8763a, { roughness: 0.8 }), 0.15, 0.075, 0.09, 0, 0.07, 0));
      this.bread.position.set(0.02, -0.35, 0.06);
      g.add(this.bread);
    },
    update(t, g, A) {
      const ripe = hSm(t, 0.4, 0.62);
      this.stalkMat.color.setHex(0x5a9a3a).lerp(_c1.setHex(0xd8b040), ripe);
      this.earMat.color.setHex(0x7aa84a).lerp(_c1.setHex(0xe0b850), ripe);
      const cut = 1 - hSm(t, 0.62, 0.72);
      this.field.scale.y = cut + 1e-3; this.field.visible = cut > 0.01;
      this.bread.scale.setScalar(hSm(t, 0.68, 0.8) + 1e-4); this.bread.visible = t > 0.68;
      const s = this.s0, ear = -0.35 + (s.h + 0.04) * cut;
      hPath([[0, 0.4, 0.32, 0.15], [0.3, s.x + 0.05, -0.17, s.z + 0.01], [0.5, s.x, -0.35 + s.h + 0.04, s.z], [0.62, s.x, -0.35 + s.h + 0.04, s.z]], t, A.pos);
      if (t > 0.62) A.pos.set(s.x, ear, s.z).lerp(_hv.set(0.03, -0.27, 0.1), hSm(t, 0.66, 0.8));
      A.e = 6; A.co2 = t < 0.3;
      A.name = t < 0.3 ? 'CO₂ w powietrzu' : t < 0.66 ? 'skrobia w ziarnie pszenicy' : 'skrobia w chlebie';
      A.when = t < 0.62 ? 'rok temu' : 'kilka dni temu';
      A.text = t < 0.35
        ? ['Przez kolejne 70 mln lat nasz atom przechodził przez powietrze, oceany, rośliny i zwierzęta', 'jeszcze wiele razy. Rok temu, jako CO₂, wleciał przez maleńki otwór (aparat szparkowy)', 'do liścia pszenicy.']
        : t < 0.64 ? ['Fotosynteza zamienia go w cukier, a roślina odkłada go w ziarnie jako skrobię.', 'Pszenica dojrzewa i złoci się.', '']
          : ['Zboże zebrano, ziarno zmielono na mąkę i upieczono z niej chleb.', 'Nasz atom jest teraz w kromce chleba.', ''];
    },
  },
  {
    title: 'W Tobie', dur: 18,
    build(g) {
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.015, 48), stdMat(0x30384a, { roughness: 1 }));
      floor.position.y = -0.53;
      this.human = SCALE_BUILDERS.human();
      this.human.scale.setScalar(0.85);
      this.human.position.set(0, -0.52, 0);
      this.mixer = this.human.userData.mixer || null;
      this.bread = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.012), stdMat(0xd9b07a));
      this.heart = makeGlowSprite(0xff3040, 0.06, 0.6);
      this.heart.material.depthTest = false; this.heart.renderOrder = 12;
      this.heart.position.set(0.03, 0.12, 0.06);
      g.add(floor, this.human, this.bread, this.heart);
    },
    update(t, g, A, T, dt) {
      if (this.mixer) this.mixer.update(dt);
      hPath([[0, 0.17, -0.14, 0.07], [0.1, 0.17, -0.14, 0.07], [0.2, 0, 0.225, 0.08], [0.35, 0, -0.01, 0.08], [0.5, 0.03, 0.12, 0.07], [0.62, 0.15, 0.09, 0.04]], t, A.pos);
      this.bread.position.copy(A.pos); this.bread.visible = t < 0.2;
      this.heart.scale.setScalar(0.06 * (1 + 0.25 * Math.pow(Math.max(0, Math.sin(T * 7)), 8)));
      A.e = 6;
      A.name = t < 0.2 ? 'skrobia w chlebie' : t < 0.35 ? 'cukier w Twoim jelicie' : t < 0.62 ? 'cząsteczka we krwi' : 'węgiel w białku Twojego mięśnia';
      A.when = 'teraz';
      A.text = t < 0.62
        ? ['Zjadasz kanapkę. Skrobia rozkłada się na cukier, który z krwią płynie po całym ciele.', 'Część węgla Twoje komórki „spalają” i wydychasz go jako CO₂ – ale nasz atom', 'zostaje wbudowany w Twoje ciało, np. w białko mięśnia ramienia.']
        : ['Ten atom ma ok. 13,8 mld lat – jego proton powstał w pierwszej milionowej sekundy Wszechświata.', 'Masz w sobie ok. 800 kwadrylionów (8·10²⁶) atomów węgla – każdy z podobnie długą historią.',
          'Kiedyś znów wydychasz go jako CO₂ – i jego podróż trwa dalej.'];
    },
  },
];
const _c1 = new THREE.Color();

function layoutMode12() {
  const fwd = horizontalForward();
  hist.root.position.copy(eyePos).addScaledVector(fwd, HIST_DISTANCE_M);
  hist.root.position.y = eyePos.y + 0.02;
  hist.root.quaternion.setFromAxisAngle(UP, Math.atan2(-fwd.x, -fwd.z));   // lokalne +z w stronę widza
  hist.root.scale.setScalar(1);
  hist.tPts.length = 0;
  if (!renderer.xr.isPresenting) orbitControls.target.copy(hist.root.position);
}
function histSeek(p) {
  const H = state.hist, N = HIST.length;
  H.p = THREE.MathUtils.clamp(p, 0, N);
  if (H.p >= N) H.playing = false;
  hist.tPts.length = 0;
  drawMenu();
}
function histStep(dir) {                                     // poprzedni / następny rozdział
  const H = state.hist, idx = Math.min(HIST.length - 1, Math.floor(H.p)), t = H.p - idx;
  if (dir < 0) histSeek(t > 0.15 ? idx : idx - 1);
  else histSeek(Math.min(HIST.length - 1, idx + 1));
}
function histSetPlaying(on) {
  const H = state.hist;
  if (on && H.p >= HIST.length) H.p = 0;
  H.playing = on;
  drawMenu();
}
function updateMode12(dt) {
  const H = state.hist, N = HIST.length;
  hist.clock += dt;
  if (H.playing) {
    H.p += dt * H.speed / HIST[Math.min(N - 1, Math.floor(H.p))].dur;
    if (H.p >= N) { H.p = N; H.playing = false; drawMenu(); }
  }
  const idx = Math.min(N - 1, Math.floor(H.p)), t = Math.min(1, H.p - idx), ch = HIST[idx], T = hist.clock;
  if (idx !== H.idx) {                                      // nowy rozdział: pokaż jego scenę
    if (!ch.g) { ch.g = new THREE.Group(); hist.root.add(ch.g); if (ch.build) ch.build(ch.g); }
    HIST.forEach((c, k) => { if (c.g) c.g.visible = k === idx; });
    hist.tPts.length = 0;
    H.idx = idx;
    drawMenu();
  }
  const A = histCtx;
  A.e = 0; A.co2 = false; A.fog = 0; A.fogColor = 0xffa060; A.text = ['', '', ''];
  ch.update(t, ch.g, A, T, dt);
  // chmura punktów
  if (ch.cloud) {
    const pos = hist.geo.attributes.position.array, col = hist.geo.attributes.color.array, S = hist.seeds, o = _ho;
    for (let i = 0; i < HIST_POINTS; i++) {
      o.x = o.y = o.z = o.r = o.g = o.b = 0;
      ch.cloud(i, S, i * 4, t, o, T);
      const j = i * 3;
      pos[j] = o.x; pos[j + 1] = o.y; pos[j + 2] = o.z;
      col[j] = o.r * HIST_BRIGHTNESS; col[j + 1] = o.g * HIST_BRIGHTNESS; col[j + 2] = o.b * HIST_BRIGHTNESS;
    }
    hist.geo.attributes.position.needsUpdate = hist.geo.attributes.color.needsUpdate = true;
  }
  hist.cloud.visible = !!ch.cloud;
  hist.fog.material.opacity = A.fog;
  hist.fog.material.color.setHex(A.fogColor);
  // nasz atom: znacznik, elektrony, CO₂, ślad
  hist.marker.position.copy(A.pos);
  hist.glow.scale.setScalar(0.09 * (1 + 0.15 * Math.sin(T * 4)));
  hist.ring.visible = A.e > 0;
  hist.shells[1].visible = A.e > 2;
  hist.electrons.forEach((e, n) => {
    const inner = n < 2, r = inner ? 0.024 : 0.04, a = T * (inner ? 4 : 2.6) + (inner ? n * Math.PI : (n - 2) * Math.PI / 2);
    e.visible = n < A.e && (inner || A.e > 2);
    e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  });
  hist.co2.visible = A.co2;
  hist.co2.rotation.set(0.3, T * 0.8, 0);
  const P = hist.tPts, last = P[P.length - 1];
  if (!last || last.distanceTo(A.pos) > 0.004) {
    if (last && last.distanceTo(A.pos) > 0.3) P.length = 0;
    P.push(A.pos.clone());
    if (P.length > hist.TRAIL) P.shift();
  }
  const tp = hist.tGeo.attributes.position.array, tc = hist.tGeo.attributes.color.array;
  P.forEach((p, n) => { const f = (n + 1) / P.length * 0.8; tp[n * 3] = p.x; tp[n * 3 + 1] = p.y; tp[n * 3 + 2] = p.z; tc[n * 3] = f; tc[n * 3 + 1] = 0.75 * f; tc[n * 3 + 2] = 0.3 * f; });
  hist.tGeo.setDrawRange(0, P.length);
  hist.tGeo.attributes.position.needsUpdate = hist.tGeo.attributes.color.needsUpdate = true;
  hist.marker.getWorldPosition(_hv);
  placeLabel(hist.label, _hv, 0.03 * hist.root.scale.x, 1.5);
  // tablica z opisem
  hist.board.setText([`Rozdział ${idx + 1} z ${N}: ${ch.title}`, `${A.when}  ·  Twój atom: ${A.name}`, ...A.text], ['#ffe9a8', '#9fd4ff']);
  placeBoard(hist.board, _hv.copy(hist.root.position).addScaledVector(UP, -0.63 * hist.root.scale.x), 0, 8);
  // suwak w menu nadąża za animacją
  H.menuT -= dt;
  if ((H.playing || H.dirty) && H.menuT <= 0 && !state.menuHidden) { H.menuT = 0.25; H.dirty = false; drawMenu(); }
}
// prawa gałka ◀ ▶ – przewijanie czasu
function stickHist(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS || ctrl.userData.handedness !== 'right') return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1];
  if (Math.abs(x) > STICK_DEADZONE) { state.hist.p = THREE.MathUtils.clamp(state.hist.p + x * dt * 0.8, 0, HIST.length); state.hist.dirty = true; }
}
// rysowanie suwaka czasu w menu
function drawHistTimeline(ctx, b) {
  const H = state.hist, N = HIST.length, idx = Math.min(N - 1, Math.floor(H.p));
  const x0 = b.x + 30, x1 = b.x + b.w - 30, yT = b.y + 80, f = H.p / N;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`Oś czasu  ·  ${idx + 1}/${N}: ${HIST[idx].title}`, b.x + b.w / 2, b.y + 34);
  ctx.fillStyle = '#1a2340'; roundRect(ctx, x0, yT - 7, x1 - x0, 14, 7); ctx.fill();
  ctx.fillStyle = '#7fb0ff'; roundRect(ctx, x0, yT - 7, Math.max(14, (x1 - x0) * f), 14, 7); ctx.fill();
  ctx.fillStyle = '#c8d4f0';
  for (let k = 1; k < N; k++) { const x = x0 + (x1 - x0) * k / N; ctx.fillRect(x - 1.5, yT - 16, 3, 32); }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * f, yT, 18, 0, Math.PI * 2); ctx.fill();
}

// =====================================================================
//  TRYB 13: CZWARTY WYMIAR – bryły 4D, które można wziąć do ręki
//   Każdy punkt bryły ma 4 współrzędne (x, y, z, w). Z naszego 3D świata można ją „oglądać” na dwa sposoby:
//   • PRZEKRÓJ – to, co naprawdę zobaczyłby człowiek: część bryły leżąca w naszej przestrzeni (w = 0),
//     jak płaski stwór widzi tylko przekrój sześcianu przechodzącego przez jego płaszczyznę;
//   • CIEŃ – rzut 4D → 3D (jak cień sześcianu na ścianie); kolor mówi, gdzie punkt leży w 4. wymiarze.
//   Obroty w płaszczyznach z W (XW, YW, ZW) nie mają odpowiednika w 3D – zmieniają kształt przekroju.
// =====================================================================
const mode13Group = new THREE.Group();
mode13Group.visible = false;
scene.add(mode13Group);
const mode13Light = makeHeadlight(mode13Group);
const T4_SIZE_M = 0.22;            // promień bryły 4D (od środka do wierzchołka) w goglach [m]
const T4_DISTANCE_M = 0.85;        // bryła tak daleko przed oczami [m]
const T4_EYE_W = 4;                // „oko” cienia w 4. wymiarze (w promieniach bryły): mniej = mocniejsza perspektywa
const T4_W_MAX = 1.5;              // zakres przesuwania w 4. wymiarze (w promieniach bryły)
const T4_SPIN = 0.6;               // prędkość obrotu z przycisków [rad/s]
const T4_STICK_ACCEL = 2.5;        // gałka rozpędza obrót 4D [rad/s²]
const T4_SPIN_DAMP = 0.35;         // jak szybko gaśnie obrót nadany gałką (rozpęd) [1/s]
const T4_GRAB = { minScale: 0.4, maxScale: 3, oneHand: 'remote' };
const T4_VIEWS = ['Przekrój', 'Cień', 'Oba'];
// płaszczyzny obrotu (w 4D obraca się WOKÓŁ PŁASZCZYZNY, a nie wokół osi): numery współrzędnych x=0, y=1, z=2, w=3
const T4_PLANES = { xy: [0, 1], xz: [0, 2], yz: [1, 2], xw: [0, 3], yw: [1, 3], zw: [2, 3] };
const T4_AUTO = { xw: { xw: 1 }, yw: { yw: 1 }, zw: { zw: 1 }, double: { xy: 1, zw: 1 } };
state.t4 = { shape: 0, view: 2, w: 0, M: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], auto: 'xw', om: { xw: 0, yw: 0, zw: 0 },
  demo: null, demoT: 0, demoAuto: true, faces: 0, dirty: false, menuT: 0 };

const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
const T4_SHAPES = (() => {
  const norm = list => { const r = Math.max(...list.map(v => Math.hypot(...v))); return list.map(v => v.map(x => x / r)); };
  const signs4 = () => { const out = []; for (let i = 0; i < 16; i++) out.push([0, 1, 2, 3].map(b => (i >> b & 1 ? 1 : -1))); return out; };
  const axes = []; for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = s; axes.push(v); }
  const s5 = 1 / Math.sqrt(5);
  const five = [[1, 1, 1, -s5], [1, -1, -1, -s5], [-1, 1, -1, -s5], [-1, -1, 1, -s5], [0, 0, 0, 4 * s5]];
  const c24 = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (const a of [1, -1]) for (const b of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = a; v[j] = b; c24.push(v); }
  const S = [
    { short: 'Tesserakt', name: 'Tesserakt (hipersześcian)', verts: norm(signs4()), cells: axes, squares: true,
      facts: '16 wierzchołków · 32 krawędzie · 24 kwadraty · 8 sześcianów (komórek)',
      note: 'Każda ściana przekroju to kawałek innego z 8 sześcianów, z których zbudowany jest tesserakt' },
    { short: '5-komórka', name: 'Hiperczworościan (5-komórka)', verts: norm(five), cells: five.map(v => v.map(x => -x)),
      facts: '5 wierzchołków · 10 krawędzi · 10 trójkątów · 5 czworościanów',
      note: 'Najprostsza bryła 4D: każdy wierzchołek jest połączony z każdym' },
    { short: '16-komórka', name: '16-komórka (hiperośmiościan)', verts: axes, cells: signs4(),
      facts: '8 wierzchołków · 24 krawędzie · 32 trójkąty · 16 czworościanów',
      note: 'Odpowiednik ośmiościanu: po dwa wierzchołki na każdej z 4 osi (x, y, z i w)' },
    { short: '24-komórka', name: '24-komórka', verts: norm(c24), cells: [...axes, ...signs4()],
      facts: '24 wierzchołki · 96 krawędzi · 96 trójkątów · 24 ośmiościany',
      note: 'Nie ma odpowiednika w 3D – taka foremna bryła istnieje tylko w 4 wymiarach' },
    { short: 'Hipersfera', name: 'Hipersfera (kula 4D)', sphere: true,
      facts: 'wszystkie punkty w tej samej odległości od środka – w 4 kierunkach',
      note: 'Okręgi Hopfa: każde dwa są splecione jak ogniwa łańcucha, choć żadne się nie przecinają' },
  ];
  const d4 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  for (const s of S) {
    if (s.sphere) continue;
    const V4 = s.verts, n = V4.length;
    let dmin = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) dmin = Math.min(dmin, d4(V4[i], V4[j]));
    const adj = new Set();
    s.edges = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d4(V4[i], V4[j]) < dmin * 1.001) { s.edges.push([i, j]); adj.add(i + ',' + j); }
    const nb = (i, j) => adj.has(Math.min(i, j) + ',' + Math.max(i, j));
    s.faces = [];                                                      // ściany 2D (do półprzezroczystego cienia)
    if (s.squares) {
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        const o = [0, 1, 2, 3].filter(k => k !== p && k !== q);
        for (const a of [1, -1]) for (const b of [1, -1]) {
          const find = (sp, sq) => V4.findIndex(v => Math.sign(v[p]) === sp && Math.sign(v[q]) === sq && Math.sign(v[o[0]]) === a && Math.sign(v[o[1]]) === b);
          s.faces.push([find(-1, -1), find(1, -1), find(1, 1), find(-1, 1)]);
        }
      }
    } else {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) if (nb(i, j) && nb(j, k) && nb(i, k)) s.faces.push([i, j, k]);
    }
    // komórki (ściany 3D): kierunek na zewnątrz i odległość od środka
    s.cells = s.cells.map(c => { const l = Math.hypot(...c), u = c.map(x => x / l); return { n: u, h: Math.max(...V4.map(v => dot4(u, v))) }; });
    s.colors = s.cells.map((c, i) => new THREE.Color().setHSL((i * 0.618 + 0.05) % 1, 0.62, 0.56));
  }
  return S;
})();

// okręgi Hopfa na hipersferze: 3 „torusy Clifforda” po 12 okręgów
const T4_FIB = 36, T4_FIB_SEG = 64;
const T4_FIB_PTS = (() => {
  const P = new Float32Array(T4_FIB * T4_FIB_SEG * 4);
  for (let f = 0; f < T4_FIB; f++) {
    const eta = [0.36, 0.785, 1.21][Math.floor(f / 12)], ph = (f % 12) / 12 * Math.PI * 2 + Math.floor(f / 12) * 0.26;
    for (let s = 0; s < T4_FIB_SEG; s++) {
      const t = s / T4_FIB_SEG * Math.PI * 2, o = (f * T4_FIB_SEG + s) * 4;
      P[o] = Math.cos(eta) * Math.cos(t); P[o + 1] = Math.cos(eta) * Math.sin(t);
      P[o + 2] = Math.sin(eta) * Math.cos(t + ph); P[o + 3] = Math.sin(eta) * Math.sin(t + ph);
    }
  }
  return P;
})();

const t4 = (() => {
  const root = new THREE.Group();                            // to chwytasz ręką
  mode13Group.add(root);
  const obj = new THREE.Group();                             // bryła: 1 jednostka = promień bryły
  obj.scale.setScalar(T4_SIZE_M);
  root.add(obj);
  const inst = (geo, mat, count) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    m.count = 0;
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    return m;
  };
  const tube = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  // cień: krawędzie, wierzchołki, półprzezroczyste ściany
  const edges = inst(tube, new THREE.MeshStandardMaterial({ roughness: 0.45, emissive: 0x222222 }), 96);
  const verts = inst(sphereGeometry, new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: 0x333333 }), 24);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  const faces = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  faces.frustumCulled = false;
  // przekrój: kolorowa bryła (każda ściana = kawałek innej komórki) + ciemne obrysy
  const SL = 3000;
  const sGeo = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'color']) sGeo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(SL * 3), 3));
  const slice = new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  slice.frustumCulled = false;
  const outline = inst(tube, new THREE.MeshBasicMaterial({ color: 0x141a2c }), 400);
  obj.add(faces, edges, verts, slice, outline);
  // hipersfera: przekrój = kula, cień = okręgi Hopfa, kropki = gdzie okręgi przebijają naszą przestrzeń
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0x4fb4f0, roughness: 0.4, transparent: true, opacity: 0.8, depthWrite: false }));
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T4_FIB * T4_FIB_SEG * 6), 3));
  hGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(T4_FIB * T4_FIB_SEG * 6), 3));
  const fibers = new THREE.LineSegments(hGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  fibers.frustumCulled = false;
  const dots = inst(sphereGeometry, new THREE.MeshBasicMaterial(), 96);
  obj.add(ball, fibers, dots);

  // pokaz „Pudełko”: kulka 4D wyjęta z zamkniętego pudełka bez otwierania go
  const box = new THREE.Group();
  root.add(box);
  const BOX = 0.36;
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(BOX, BOX, BOX), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
  const boxEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxMesh.geometry), new THREE.LineBasicMaterial({ color: 0xbfe6ff }));
  const pBall = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xffa040, roughness: 0.35 }));
  const ghost = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }));
  box.add(boxMesh, boxEdges, pBall, ghost);

  // pokaz „Świat 2D”: sześcian przechodzi przez płaszczyznę – płaski stwór widzi tylko wielokąt
  const flat = new THREE.Group();
  root.add(flat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a70c0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  const grid = new THREE.GridHelper(0.8, 8, 0x8fb0ff, 0x5a78b8);
  grid.material.transparent = true; grid.material.opacity = 0.35;
  const cube = new THREE.Group();
  const CUBE = 0.26;
  const cubeGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  cube.add(new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: 0xffd080, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })),
    new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), new THREE.LineBasicMaterial({ color: 0xffe0a0 })));
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3 * 3), 3));
  const poly = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xff6a4a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  poly.frustumCulled = false;
  flat.add(plane, grid, cube, poly);
  flat.position.y = -0.12;
  flat.rotation.x = 0.42;                                    // płaszczyzna pochylona do Ciebie – widać, co się na niej rysuje

  const board = makeFitBoard(2100, 5);
  mode13Group.add(board.sprite);
  return { root, obj, edges, verts, faces, fGeo, slice, sGeo, outline, ball, fibers, hGeo, dots, box, BOX, boxMesh, pBall, ghost, flat, cube, CUBE, poly, pGeo, board,
    R: new Float64Array(24 * 4), P: Array.from({ length: 24 }, () => new THREE.Vector3()), p3: new Float32Array(200 * 3), p4: new Float64Array(200 * 4) };
})();

const _t4c = new THREE.Color(), _t4d = new THREE.Color(), _t4m = new THREE.Matrix4(), _t4q = new THREE.Quaternion();
const _t4a = new THREE.Vector3(), _t4b = new THREE.Vector3(), _t4s = new THREE.Vector3(), _t4u = new THREE.Vector3(), _t4v = new THREE.Vector3(), _t4n = new THREE.Vector3();
const T4_Y = new THREE.Vector3(0, 1, 0), _t4e1 = new THREE.Vector3(), _t4e2 = new THREE.Vector3();
// kolor położenia w 4. wymiarze: czerwony = ana (+W), biały = nasza przestrzeń, niebieski = kata (−W)
function t4WColor(w, out) {
  const t = THREE.MathUtils.clamp(w / 1.1, -1, 1);
  return t >= 0 ? out.setRGB(1, 1 - 0.62 * t, 1 - 0.8 * t) : out.setRGB(1 + 0.72 * t, 1 + 0.4 * t, 1);
}
function t4Rotate(i, j, a) {                                  // obrót w płaszczyźnie (i, j) o kąt a
  const M = state.t4.M, c = Math.cos(a), s = Math.sin(a);
  for (let k = 0; k < 4; k++) { const x = M[i * 4 + k], y = M[j * 4 + k]; M[i * 4 + k] = c * x - s * y; M[j * 4 + k] = s * x + c * y; }
}
function t4Ortho() {                                          // usuwa drobne błędy zaokrągleń (macierz zostaje obrotem)
  const M = state.t4.M;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < i; j++) { let d = 0; for (let k = 0; k < 4; k++) d += M[i * 4 + k] * M[j * 4 + k]; for (let k = 0; k < 4; k++) M[i * 4 + k] -= d * M[j * 4 + k]; }
    let l = 0; for (let k = 0; k < 4; k++) l += M[i * 4 + k] ** 2;
    l = Math.sqrt(l); for (let k = 0; k < 4; k++) M[i * 4 + k] /= l;
  }
}
// odcinek (walec) od a do b w InstancedMesh
function t4Tube(mesh, i, a, b, r, color) {
  _t4s.subVectors(b, a);
  const len = _t4s.length();
  _t4q.setFromUnitVectors(T4_Y, len > 1e-9 ? _t4s.divideScalar(len) : T4_Y);
  _t4m.compose(_t4a.addVectors(a, b).multiplyScalar(0.5), _t4q, _t4b.set(r, len, r));
  mesh.setMatrixAt(i, _t4m);
  if (color) mesh.setColorAt(i, color);
}
function t4Ball(mesh, i, p, r, color) {
  _t4m.compose(p, _t4q.identity(), _t4b.setScalar(r));
  mesh.setMatrixAt(i, _t4m);
  if (color) mesh.setColorAt(i, color);
}
function t4Done(mesh, n) {
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function layoutMode13() {
  const fwd = horizontalForward();
  t4.root.position.copy(eyePos).addScaledVector(fwd, T4_DISTANCE_M);
  t4.root.position.y = eyePos.y - 0.12;
  t4.root.quaternion.setFromAxisAngle(UP, Math.atan2(-fwd.x, -fwd.z));
  t4.root.scale.setScalar(1);
  const T = state.t4;
  T.M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  t4Rotate(0, 2, 0.5); t4Rotate(1, 2, 0.35);                  // lekko z ukosa – od razu widać, że to bryła
  T.w = 0; T.om = { xw: 0, yw: 0, zw: 0 }; T.auto = 'xw'; T.demo = null;
  if (!renderer.xr.isPresenting) orbitControls.target.copy(t4.root.position);
}
function t4Menu(id) {
  const T = state.t4;
  if (id.startsWith('t4s')) { T.shape = +id.slice(3); if (T.demo !== 'pass') T.demo = null; }
  else if (id.startsWith('t4v')) T.view = +id.slice(3);
  else if (id.startsWith('t4r_')) { const a = id.slice(4); T.auto = T.auto === a ? null : a; if (T.demo === 'box' || T.demo === 'flat') T.demo = null; }
  else if (id === 't4halt') { T.auto = null; T.om = { xw: 0, yw: 0, zw: 0 }; }
  else if (id.startsWith('t4d_')) {
    const d = id.slice(4);
    T.demo = T.demo === d ? null : d;
    T.demoT = 0; T.demoAuto = true;
    if (T.demo === 'pass') { T.view = 0; T.w = -1.3; }
    if (T.demo === 'box' || T.demo === 'flat') T.view = 2;
    if (!T.demo) T.w = 0;
  } else if (id === 't4reset') { cancelAllGrabs(); layoutMode13(); }
  T.dirty = true;
}
function t4SetW(w) {
  const T = state.t4;
  T.w = Math.abs(w) < 0.04 ? 0 : THREE.MathUtils.clamp(w, -T4_W_MAX, T4_W_MAX);   // przy środku „wskakuje” w naszą przestrzeń
  T.demoAuto = false;
  T.dirty = true;
}

// bryła wielościenna: cień (rzut perspektywiczny 4D → 3D) i przekrój (część w naszej przestrzeni w = 0)
function t4UpdatePoly(S, T) {
  const M = T.M, R = t4.R, P = t4.P, D = T4_EYE_W, V4 = S.verts, n = V4.length;
  for (let k = 0; k < n; k++) {
    const v = V4[k];
    for (let i = 0; i < 4; i++) R[k * 4 + i] = M[i * 4] * v[0] + M[i * 4 + 1] * v[1] + M[i * 4 + 2] * v[2] + M[i * 4 + 3] * v[3];
    R[k * 4 + 3] += T.w;
    const f = D / (D - R[k * 4 + 3]);
    P[k].set(R[k * 4] * f, R[k * 4 + 1] * f, R[k * 4 + 2] * f);
  }
  const shadow = T.view !== 0, cut = T.view !== 1;
  t4.edges.visible = t4.verts.visible = t4.faces.visible = shadow;
  if (shadow) {
    for (let k = 0; k < n; k++) t4Ball(t4.verts, k, P[k], 0.034, t4WColor(R[k * 4 + 3], _t4c));
    t4Done(t4.verts, n);
    S.edges.forEach(([a, b], i) => t4Tube(t4.edges, i, P[a], P[b], cut ? 0.011 : 0.014, t4WColor((R[a * 4 + 3] + R[b * 4 + 3]) / 2, _t4c)));
    t4Done(t4.edges, S.edges.length);
    const pos = t4.fGeo.attributes.position.array, col = t4.fGeo.attributes.color.array;
    let o = 0;
    const put = k => { pos[o] = P[k].x; pos[o + 1] = P[k].y; pos[o + 2] = P[k].z; t4WColor(R[k * 4 + 3], _t4c); col[o] = _t4c.r; col[o + 1] = _t4c.g; col[o + 2] = _t4c.b; o += 3; };
    for (const f of S.faces) for (let m = 1; m < f.length - 1; m++) { put(f[0]); put(f[m]); put(f[m + 1]); }
    t4.fGeo.setDrawRange(0, o / 3);
    t4.fGeo.attributes.position.needsUpdate = t4.fGeo.attributes.color.needsUpdate = true;
  }
  // przekrój: punkty, w których krawędzie przebijają naszą przestrzeń (w = 0)
  t4.slice.visible = t4.outline.visible = cut;
  T.faces = 0;
  if (!cut) return;
  const p3 = t4.p3, p4 = t4.p4, eps = 1e-7;
  let np = 0;
  const add = (ka, kb, t) => {
    for (let i = 0; i < 3; i++) p3[np * 3 + i] = R[ka * 4 + i] + t * (R[kb * 4 + i] - R[ka * 4 + i]);
    for (let i = 0; i < 4; i++) p4[np * 4 + i] = V4[ka][i] + t * (V4[kb][i] - V4[ka][i]);
    np++;
  };
  for (let k = 0; k < n; k++) if (Math.abs(R[k * 4 + 3]) <= eps) add(k, k, 0);
  for (const [a, b] of S.edges) {
    const wa = R[a * 4 + 3], wb = R[b * 4 + 3];
    if ((wa > eps && wb < -eps) || (wa < -eps && wb > eps)) add(a, b, wa / (wa - wb));
  }
  const pos = t4.sGeo.attributes.position.array, nor = t4.sGeo.attributes.normal.array, col = t4.sGeo.attributes.color.array;
  let o = 0, nl = 0;
  const idx = [], ang = [];
  S.cells.forEach((c, ci) => {
    idx.length = 0;
    for (let q = 0; q < np; q++) {
      const d = c.n[0] * p4[q * 4] + c.n[1] * p4[q * 4 + 1] + c.n[2] * p4[q * 4 + 2] + c.n[3] * p4[q * 4 + 3];
      if (Math.abs(d - c.h) < 1e-5) idx.push(q);
    }
    if (idx.length < 3) return;
    // kierunek ściany w naszej przestrzeni = część xyz obróconego kierunku komórki
    _t4n.set(0, 0, 0);
    for (let i = 0; i < 3; i++) _t4n.setComponent(i, M[i * 4] * c.n[0] + M[i * 4 + 1] * c.n[1] + M[i * 4 + 2] * c.n[2] + M[i * 4 + 3] * c.n[3]);
    if (_t4n.length() < 1e-4) return;
    _t4n.normalize();
    _t4a.set(0, 0, 0);
    for (const q of idx) _t4a.x += p3[q * 3], _t4a.y += p3[q * 3 + 1], _t4a.z += p3[q * 3 + 2];
    _t4a.divideScalar(idx.length);
    _t4u.set(p3[idx[0] * 3], p3[idx[0] * 3 + 1], p3[idx[0] * 3 + 2]).sub(_t4a).normalize();
    _t4v.crossVectors(_t4n, _t4u);
    ang.length = 0;
    for (const q of idx) { _t4s.set(p3[q * 3], p3[q * 3 + 1], p3[q * 3 + 2]).sub(_t4a); ang[q] = Math.atan2(_t4s.dot(_t4v), _t4s.dot(_t4u)); }
    idx.sort((a, b) => ang[a] - ang[b]);
    const cc = S.colors[ci];
    const put = q => { pos[o] = p3[q * 3]; pos[o + 1] = p3[q * 3 + 1]; pos[o + 2] = p3[q * 3 + 2]; nor[o] = _t4n.x; nor[o + 1] = _t4n.y; nor[o + 2] = _t4n.z; col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b; o += 3; };
    for (let m = 1; m < idx.length - 1 && o < (3000 - 3) * 3; m++) { put(idx[0]); put(idx[m]); put(idx[m + 1]); }
    for (let m = 0; m < idx.length && nl < 400; m++) {
      const qa = idx[m], qb = idx[(m + 1) % idx.length];
      t4Tube(t4.outline, nl++, _t4e1.set(p3[qa * 3], p3[qa * 3 + 1], p3[qa * 3 + 2]), _t4e2.set(p3[qb * 3], p3[qb * 3 + 1], p3[qb * 3 + 2]), 0.007);
    }
    T.faces++;
  });
  t4Done(t4.outline, nl);
  t4.sGeo.setDrawRange(0, o / 3);
  for (const a of ['position', 'normal', 'color']) t4.sGeo.attributes[a].needsUpdate = true;
}

// hipersfera: przekrój = kula o promieniu √(1 − w²), cień = okręgi Hopfa
function t4UpdateSphere(T) {
  const M = T.M, D = T4_EYE_W, shadow = T.view !== 0, cut = T.view !== 1;
  const r2 = 1 - T.w * T.w;
  t4.ball.visible = cut && r2 > 1e-4;
  if (t4.ball.visible) t4.ball.scale.setScalar(Math.sqrt(r2));
  t4.ball.material.opacity = shadow ? 0.45 : 0.85;              // przy cieniu prześwituje – widać okręgi w środku
  t4.fibers.visible = shadow;
  const pos = t4.hGeo.attributes.position.array, col = t4.hGeo.attributes.color.array;
  let o = 0, nd = 0;
  const q = [0, 0, 0, 0], prev = [0, 0, 0, 0], first = [0, 0, 0, 0];
  const rot = (k, out) => {
    const x = T4_FIB_PTS[k], y = T4_FIB_PTS[k + 1], z = T4_FIB_PTS[k + 2], w = T4_FIB_PTS[k + 3];
    for (let i = 0; i < 4; i++) out[i] = M[i * 4] * x + M[i * 4 + 1] * y + M[i * 4 + 2] * z + M[i * 4 + 3] * w;
    out[3] += T.w;
  };
  const put = r => { const f = D / (D - r[3]); pos[o] = r[0] * f; pos[o + 1] = r[1] * f; pos[o + 2] = r[2] * f; t4WColor(r[3], _t4c); col[o] = _t4c.r; col[o + 1] = _t4c.g; col[o + 2] = _t4c.b; o += 3; };
  for (let f = 0; f < T4_FIB; f++) {
    rot(f * T4_FIB_SEG * 4, first);
    prev.splice(0, 4, ...first);
    for (let s = 1; s <= T4_FIB_SEG; s++) {
      if (s < T4_FIB_SEG) rot((f * T4_FIB_SEG + s) * 4, q); else q.splice(0, 4, ...first);
      if (shadow) { put(prev); put(q); }
      // tu okrąg przebija naszą przestrzeń: kropka na powierzchni przekroju
      if (cut && nd < 96 && (prev[3] > 0) !== (q[3] > 0)) {
        const t = prev[3] / (prev[3] - q[3]);
        t4Ball(t4.dots, nd++, _t4a.set(prev[0] + t * (q[0] - prev[0]), prev[1] + t * (q[1] - prev[1]), prev[2] + t * (q[2] - prev[2])), 0.03,
          _t4d.setHSL([0.12, 0.38, 0.62][Math.floor(f / 12)], 0.9, 0.62));
      }
      prev.splice(0, 4, ...q);
    }
  }
  t4Done(t4.dots, nd);
  t4.dots.visible = cut;
  t4.hGeo.setDrawRange(0, o / 3);
  t4.hGeo.attributes.position.needsUpdate = t4.hGeo.attributes.color.needsUpdate = true;
}

// pokaz „Pudełko”: [czas, x, w] – kulka idzie w 4. wymiar, przechodzi „nad” ścianą i wraca do naszej przestrzeni
const T4_BOX_KEYS = [[0, 0, 0], [2, 0, 0], [4.5, 0, 0.17], [7, 0.42, 0.17], [9.5, 0.42, 0], [12, 0.42, 0], [14.5, 0.42, -0.17], [17, 0, -0.17], [19.5, 0, 0], [21, 0, 0]];
const T4_BOX_TEXT = [
  [2, 'Kulka zamknięta w szczelnym pudełku', 'W 3D nie da się jej wyjąć bez otwierania pudełka'],
  [4.5, 'Przesuwam kulkę w 4. wymiarze (ana, +W)', 'Znika z naszej przestrzeni – zostaje tylko jej „cień” (siatka)'],
  [7, 'Teraz w bok – „nad” ścianą pudełka', 'Ściana jest tylko w naszej przestrzeni (w = 0), więc kulka jej nie dotyka'],
  [12, 'Wraca do naszej przestrzeni – już poza pudełkiem!', 'Dla istoty 4D nasze zamknięte pudełko jest otwarte jak dla nas kwadrat narysowany na kartce'],
  [19.5, 'I z powrotem do środka – tym razem przez kata (−W)', 'Pudełko ani na chwilę nie zostało otwarte'],
  [99, 'Kulka znów w środku', 'Tak samo istota 4D mogłaby wyjąć coś z sejfu albo z Twojego wnętrza bez cięcia'],
];
const T4_POLY_NAMES = { 3: 'trójkąt', 4: 'czworokąt', 5: 'pięciokąt', 6: 'sześciokąt' };
function t4UpdateBox(T) {
  const t = T.demoT % 21, K = T4_BOX_KEYS;
  let x = 0, w = 0;
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const f = THREE.MathUtils.smoothstep(t, K[i - 1][0], K[i][0]); x = hMix(K[i - 1][1], K[i][1], f); w = hMix(K[i - 1][2], K[i][2], f); break; }
  const r = 0.08, cut = T.view !== 1, sr = Math.sqrt(Math.max(0, r * r - w * w));
  t4.pBall.visible = cut && sr > 0.002;
  t4.pBall.position.set(x, 0, 0);
  t4.pBall.scale.setScalar(sr);
  t4.ghost.visible = T.view !== 0 && Math.abs(w) > 0.005;
  t4.ghost.position.set(x, 0, 0);
  t4.ghost.scale.setScalar(r);
  t4WColor(w / 0.17, t4.ghost.material.color);
  const tx = T4_BOX_TEXT.find(e => t < e[0]);
  return ['Wyjmowanie z zamkniętego pudełka', tx[1], tx[2], `Położenie kulki w 4. wymiarze: W = ${w >= 0 ? '+' : '−'}${Math.abs(w / 0.08).toFixed(2).replace('.', ',')} promienia`,
    'Kulka to hipersfera: w naszej przestrzeni widać jej przekrój – kulę, która maleje, gdy kulka odsuwa się w W'];
}
// pokaz „Świat 2D”: sześcian przechodzi przez płaszczyznę płaskiego świata
const _t4cube = [];
for (let i = 0; i < 8; i++) _t4cube.push(new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1));
const T4_CUBE_EDGES = [];
for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) T4_CUBE_EDGES.push([i, i | b]);
function t4UpdateFlat(T) {
  const c = t4.cube, h = t4.CUBE / 2;
  const y = T.demoAuto ? 0.24 * Math.sin(T.demoT * 0.45) : T.w / T4_W_MAX * 0.26;
  c.position.set(0, y, 0);
  c.rotation.set(0.62 + 0.13 * T.demoT, 0.4 + 0.21 * T.demoT, 0.17 + 0.07 * T.demoT);
  c.updateMatrix();
  const W = _t4cube.map(v => _t4a.copy(v).multiplyScalar(h).applyMatrix4(c.matrix).clone());
  const pts = [];
  for (const [a, b] of T4_CUBE_EDGES) {
    const ya = W[a].y, yb = W[b].y;
    if ((ya > 0) !== (yb > 0)) { const t = ya / (ya - yb); pts.push(new THREE.Vector3().lerpVectors(W[a], W[b], t)); }
  }
  const pos = t4.pGeo.attributes.position.array;
  let o = 0;
  if (pts.length >= 3) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    pts.sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
    for (let m = 1; m < pts.length - 1; m++) for (const p of [pts[0], pts[m], pts[m + 1]]) { pos[o++] = p.x; pos[o++] = 0.002; pos[o++] = p.z; }
  }
  t4.pGeo.setDrawRange(0, o / 3);
  t4.pGeo.attributes.position.needsUpdate = true;
  const name = pts.length >= 3 ? T4_POLY_NAMES[pts.length] || pts.length + '-kąt' : 'nic';
  return ['Analogia: świat 2D', 'Płaski stwór widzi tylko to, co leży w jego płaszczyźnie (niebieska)',
    `Sześcian przechodzący przez nią to dla niego zmieniający się kształt – teraz: ${name}`,
    'My tak samo widzimy bryły 4D: tylko ich przekrój (widok „Przekrój”)', 'Lewa gałka ↑↓ / suwak W: przesuwaj sześcian sam'];
}

function updateMode13(dt) {
  const T = state.t4;
  const sp = T.auto ? T4_AUTO[T.auto] : {};
  for (const p in T4_PLANES) {
    const a = ((sp[p] || 0) * T4_SPIN + (T.om[p] || 0)) * dt;
    if (a) t4Rotate(T4_PLANES[p][0], T4_PLANES[p][1], a);
  }
  for (const p in T.om) T.om[p] *= Math.exp(-T4_SPIN_DAMP * dt);
  t4Ortho();
  if (T.demo) T.demoT += dt;
  if (T.demo === 'pass' && T.demoAuto) {                    // bryła przelatuje przez naszą przestrzeń tam i z powrotem
    const ph = (T.demoT * 0.16) % 2;
    T.w = 1.3 * (ph < 1 ? 2 * ph - 1 : 3 - 2 * ph);
    T.dirty = true;
  }
  const S = T4_SHAPES[T.shape], demo = T.demo === 'box' || T.demo === 'flat';
  t4.obj.visible = !demo;
  t4.box.visible = T.demo === 'box';
  t4.flat.visible = T.demo === 'flat';
  for (const m of [t4.edges, t4.verts, t4.faces, t4.slice, t4.outline]) m.visible = false;
  t4.ball.visible = t4.fibers.visible = t4.dots.visible = false;
  let lines;
  if (T.demo === 'box') lines = t4UpdateBox(T);
  else if (T.demo === 'flat') lines = t4UpdateFlat(T);
  else {
    if (S.sphere) t4UpdateSphere(T); else t4UpdatePoly(S, T);
    const r = Math.sqrt(Math.max(0, 1 - T.w * T.w));
    const cutLine = T.view === 1 ? 'Przekrój ukryty – widzisz tylko cień całej bryły'
      : S.sphere ? (r > 0.01 ? `Przekrój (to widziałby człowiek): kula o promieniu ${r.toFixed(2).replace('.', ',')} – maleje, gdy bryła odsuwa się w W` : 'Przekrój: pusto – hipersfera jest całkiem poza naszą przestrzenią')
      : T.faces ? `Przekrój (to widziałby człowiek): bryła o ${T.faces} ścianach – każda w innym kolorze` : 'Przekrój: pusto – bryła jest całkiem poza naszą przestrzenią (przesuń W)';
    const viewLine = T.view === 0 ? 'Przekrój = część bryły, która leży w naszej przestrzeni (w = 0) – tylko tyle widzi człowiek'
      : 'Cień = rzut 4D → 3D · czerwone: ana (+W) · białe: nasza przestrzeń · niebieskie: kata (−W)';
    const note = T.demo === 'pass' ? 'Bryła przelatuje przez naszą przestrzeń: przekrój pojawia się z niczego, zmienia kształt i znika'
      : T.auto === 'double' ? 'Podwójny obrót (XY i ZW naraz): żaden punkt poza środkiem nie stoi w miejscu – w 3D niemożliwe'
      : T.auto ? `Obrót w płaszczyźnie ${T.auto.toUpperCase()}: bryła „przewraca się” przez 4. wymiar – dlatego przekrój zmienia kształt`
      : S.note;
    lines = [S.name, S.facts, cutLine, viewLine, note];
  }
  t4.board.setText(lines, ['#ffffff', '#ffd27a']);
  const sc = t4.root.scale.x;
  t4.board.sprite.position.copy(t4.root.position).addScaledVector(UP, -0.4 * sc);
  t4.board.sprite.scale.set(0.95 * sc, 0.95 * sc / t4.board.sprite.userData.aspect, 1);
  T.menuT -= dt;
  if (T.dirty && T.menuT <= 0 && !state.menuHidden) { T.menuT = 0.2; T.dirty = false; drawMenu(); }
}
// gałki: prawa – obrót w 4D (◀ ▶ XW, ▲ ▼ ZW, z rozpędem), lewa – ▲ ▼ ruch w 4. wymiarze, ◀ ▶ obrót YW
function stickT4(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS], T = state.t4, cl = v => THREE.MathUtils.clamp(v, -2.5, 2.5);
  if (ctrl.userData.handedness === 'right') {
    if (Math.abs(x) > STICK_DEADZONE) T.om.xw = cl(T.om.xw + x * T4_STICK_ACCEL * dt);
    if (Math.abs(y) > STICK_DEADZONE) T.om.zw = cl(T.om.zw - y * T4_STICK_ACCEL * dt);
  } else {
    if (Math.abs(y) > STICK_DEADZONE) t4SetW(T.w - y * 0.7 * dt);
    if (Math.abs(x) > STICK_DEADZONE) T.om.yw = cl(T.om.yw + x * T4_STICK_ACCEL * dt);
  }
}
// suwak „położenie w 4. wymiarze” w menu
function drawT4W(ctx, b) {
  const T = state.t4, x0 = b.x + 30, x1 = b.x + b.w - 30, yT = b.y + 80, f = (T.w + T4_W_MAX) / (2 * T4_W_MAX);
  ctx.font = 'bold 27px system-ui, sans-serif';
  ctx.fillText(`4. wymiar: W = ${T.w > 0 ? '+' : T.w < 0 ? '−' : ''}${Math.abs(T.w).toFixed(2).replace('.', ',')}  (◀ kata · ana ▶)`, b.x + b.w / 2, b.y + 32);
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#4799ff'); g.addColorStop(0.5, '#e8ecff'); g.addColorStop(1, '#ff6a3a');
  ctx.fillStyle = g; roundRect(ctx, x0, yT - 7, x1 - x0, 14, 7); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect((x0 + x1) / 2 - 2, yT - 18, 4, 36);
  ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * f, yT, 18, 0, Math.PI * 2); ctx.fill();
}

// =====================================================================
//  MENU (panel z przyciskami, rysowany na canvas) – przesuwane i chowane
// =====================================================================
const MENU_CANVAS_W = 1024, MENU_CANVAS_H = 730;
// wysokość narysowanej części panelu (tryby z dodatkowymi rzędami przycisków mają wyższy panel)
const menuUsedH = () => ({ 3: 716, 11: 716, 12: 716, 13: 716, 2: 588, 8: 588, 9: 588 }[state.mode] || 460);
const MENU_HEIGHT_M = MENU_WIDTH_M * MENU_CANVAS_H / MENU_CANVAS_W;
// kolejność trybów w menu (numer na przycisku = miejsce na tej liście; dawne Tryby 5 „Kosmos” i 7 „Galaktyka”
// są teraz częścią Podróży – od człowieka do całego kosmosu)
const MODE_ORDER = [1, 2, 3, 4, 10, 6, 8, 9, 11, 12, 13];
const MODE_NAMES = { 1: 'Model', 2: 'Planety', 3: 'Ludziki', 4: 'Obiekty', 5: 'Kosmos', 6: 'Skala', 7: 'Galaktyka', 8: 'Grawitacja', 9: 'Światło', 10: 'Podróż', 11: 'Atom', 12: 'Historia', 13: '4D' };
const menuButtons = [
  { id: 'hide', label: 'Schowaj ✕', x: 760, y: 18, w: 246, h: 70, small: true },
  ...MODE_ORDER.map((m, i) => ({ id: 'mode' + m, label: 'Tryb ' + (i + 1), sub: MODE_NAMES[m], x: 18 + i * 90, y: 196, w: 86, h: 120, small: true, font: 'bold 21px system-ui, sans-serif', subFont: '15px system-ui, sans-serif' })),
  // Tryb 13: bryły 4D, położenie w 4. wymiarze, widok, obroty, pokazy
  ...T4_SHAPES.map((sh, i) => ({ id: 't4s' + i, label: sh.short, x: 18 + i * 166, y: 332, w: 159, h: 112, modes: [13], small: true, font: 'bold 26px system-ui, sans-serif',
    active: () => state.t4.shape === i && state.t4.demo !== 'box' && state.t4.demo !== 'flat' })),
  { id: 't4reset', label: 'Reset', x: 848, y: 332, w: 158, h: 112, modes: [13], small: true, font: 'bold 28px system-ui, sans-serif' },
  { id: 't4W', draw: drawT4W, drag: f => t4SetW((f * 2 - 1) * T4_W_MAX), x: 18, y: 456, w: 610, h: 116, modes: [13] },
  ...T4_VIEWS.map((v, i) => ({ id: 't4v' + i, label: v, x: 640 + i * 124, y: 456, w: 118, h: 116, modes: [13], small: true, font: 'bold 25px system-ui, sans-serif', active: () => state.t4.view === i })),
  ...[['t4r_xw', 'Obrót XW'], ['t4r_yw', 'Obrót YW'], ['t4r_zw', 'Obrót ZW'], ['t4r_double', 'Podwójny'], ['t4halt', 'Stop'], ['t4d_pass', 'Przejście'], ['t4d_box', 'Pudełko'], ['t4d_flat', 'Świat 2D']]
    .map(([id, label], i) => ({ id, label, x: 18 + i * 124, y: 588, w: 118, h: 116, modes: [13], small: true, font: 'bold 23px system-ui, sans-serif',
      active: () => (id.startsWith('t4r_') ? state.t4.auto === id.slice(4) : id.startsWith('t4d_') ? state.t4.demo === id.slice(4) : false) })),
  // Tryb 12: oś czasu, odtwarzanie, tempo
  { id: 'histTime', draw: drawHistTimeline, drag: f => histSeek(f * HIST.length), x: 18, y: 332, w: 988, h: 112, modes: [12] },
  { id: 'histPrev', label: '◀◀ Poprzedni', x: 18, y: 456, w: 236, h: 116, modes: [12], small: true, font: 'bold 30px system-ui, sans-serif' },
  { id: 'histPlay', label: () => (state.hist.playing ? '❚❚ Pauza' : '▶ Start'), x: 266, y: 456, w: 236, h: 116, modes: [12], small: true },
  { id: 'histNext', label: 'Następny ▶▶', x: 514, y: 456, w: 236, h: 116, modes: [12], small: true, font: 'bold 30px system-ui, sans-serif' },
  { id: 'histRestart', label: '⟲ Od początku', x: 762, y: 456, w: 244, h: 116, modes: [12], small: true, font: 'bold 30px system-ui, sans-serif' },
  ...HIST_SPEEDS.map((v, i) => ({ id: 'hspd' + i, label: ['×¼ wolno', '×½', '×1', '×2', '×4 szybko'][i], x: 18 + i * 199, y: 588, w: 191, h: 116, modes: [12], small: true, active: () => state.hist.speed === v })),
  // Tryb 11: orbitale, warianty, pierwiastki, model Bohra
  ...Object.keys(ATOM_ORBITALS).map((o, i) => ({ id: 'orb_' + o, label: o, x: 18 + i * 141, y: 332, w: 135, h: 112, modes: [11], small: true, active: () => state.atom.kind === 'orbital' && state.atom.orb === o })),
  { id: 'atomVar', label: () => { const o = ATOM_ORBITALS[state.atom.orb]; return state.atom.kind === 'orbital' && o.variants.length > 1 ? 'Kształt: ' + o.variants[state.atom.variant % o.variants.length] : 'Kształt ↻'; },
    x: 18, y: 456, w: 200, h: 116, modes: [11], small: true, font: 'bold 24px system-ui, sans-serif' },
  ...ATOM_ELEMENTS.map((e, i) => ({ id: 'el_' + e[0], label: e[0], sub: e[1], x: 230 + i * 111, y: 456, w: 105, h: 116, modes: [11], small: true, subFont: '19px system-ui, sans-serif', active: () => state.atom.kind === 'element' && state.atom.el === e[0] })),
  { id: 'atomBohr', label: () => (state.atom.bohr ? 'Chmury (model kwantowy)' : 'Model Bohra (stary)'), x: 18, y: 588, w: 490, h: 116, modes: [11], small: true },
  { id: 'atomReset', label: 'Reset', x: 518, y: 588, w: 488, h: 116, modes: [11], small: true },
  // Tryb 3: temperatura i scenariusze
  ...M3_TEMPS.map((T, i) => ({ id: 'temp' + T, label: T === -30 ? 'Lód −30°C' : T + '°C', x: 18 + i * 199, y: 456, w: 191, h: 116, modes: [3], small: true, font: 'bold 32px system-ui, sans-serif', active: () => m3W.T === T })),
  ...M3_EVENTS.map((e, i) => ({ id: 'ev_' + e, label: { quake: 'Płyty', volcano: 'Wulkan', tornado: 'Tornado', tsunami: 'Tsunami', meteor: 'Meteoryt', rocket: 'Rakieta', astronaut: 'Astronauta', greenhouse: 'Cieplarnia' }[e],
    x: 18 + i * 124, y: 588, w: 118, h: 116, modes: [3], small: true, font: 'bold 22px system-ui, sans-serif', active: () => !!(m3W.event && m3W.event.type === e) })),
  { id: 'reset', label: 'Reset', x: 18, y: 332, w: 300, h: 112, modes: [2, 3, 4, 8] },
  { id: 'stSheet', label: () => (state.stSheet ? 'Pokaż siatkę 3D' : 'Pokaż płachtę 2D'), x: 330, y: 332, w: 676, h: 112, modes: [8] },
  { id: 'stInside', label: () => (state.stInside ? 'Siatka przed Tobą' : 'Wejdź do środka'), x: 18, y: 456, w: 320, h: 116, modes: [8], small: true },
  { id: 'stProbes', label: () => (state.stProbes ? 'Schowaj sondy' : 'Sondy-bliźniaki'), x: 350, y: 456, w: 320, h: 116, modes: [8], small: true },
  ...SR_SPEEDS.map((b, i) => ({ id: 'sr' + b, label: String(b).replace('.', ',') + ' c', x: 18 + i * 166, y: 332, w: 160, h: 112, modes: [9], small: true, active: () => state.srBeta === b })),
  { id: 'srReset', label: 'Wyzeruj zegary', x: 18, y: 456, w: 320, h: 116, modes: [9], small: true },
  { id: 'srPause', label: () => (state.srPaused ? '▶ Start' : '❚❚ Pauza'), x: 350, y: 456, w: 320, h: 116, modes: [9], small: true },
  { id: 'srShip', label: () => (state.srShip ? 'Widok z boku' : 'Widok z pokładu'), x: 682, y: 456, w: 324, h: 116, modes: [9], small: true },
  { id: 'stAge', label: 'Wyzeruj wiek sond', x: 682, y: 456, w: 324, h: 116, modes: [8], small: true },
  { id: 'pick', label: () => (state.follow ? 'Puść ludzika (B)' : state.m3Pick ? 'Wyceluj w ludzika, naciśnij spust…' : 'Kamera za ludzikiem (B)'),
    x: 330, y: 332, w: 676, h: 112, modes: [3] },
  { id: 'reset', label: 'Reset', x: 18, y: 332, w: 200, h: 112, modes: [1], small: true },
  { id: 'track', label: 'Planeta (B)', sub: () => (state.track ? 'trzymana' : 'puszczona'), x: 230, y: 332, w: 230, h: 112, modes: [1], small: true },
  { id: 'timeSlow', label: '◀◀ Wolniej', x: 472, y: 332, w: 172, h: 112, modes: [1], small: true },
  { id: 'timePlay', label: () => (state.timePaused ? '▶ Start' : '❚❚ Pauza'), x: 656, y: 332, w: 172, h: 112, modes: [1], small: true },
  { id: 'timeFast', label: 'Szybciej ▶▶', x: 840, y: 332, w: 166, h: 112, modes: [1], small: true },
  { id: 'prev', label: '◀ Mniejszy (B)', x: 18, y: 332, w: 262, h: 112, modes: [6], small: true },
  { id: 'speed', slider: true, x: 292, y: 332, w: 440, h: 112, modes: [6, 10] },
  { id: 'jAll', label: '◀ Cały kosmos', x: 18, y: 332, w: 262, h: 112, modes: [10], small: true },
  { id: 'jHuman', label: 'Człowiek ▶', x: 744, y: 332, w: 262, h: 112, modes: [10], small: true },
  { id: 'next', label: 'Większy (A) ▶', x: 744, y: 332, w: 262, h: 112, modes: [6], small: true },
  { id: 'knife', label: () => state.knife ? 'Nóż: WŁ (A)' : 'Nóż: wył (A)', x: 330, y: 332, w: 340, h: 112, modes: [2, 4] },
  { id: 'surf', label: () => (state.surf ? 'Wróć z powierzchni (X)' : state.surfPick ? 'Wyceluj w planetę i naciśnij spust…' : 'Stań na powierzchni planety (X)'),
    x: 18, y: 456, w: 988, h: 116, modes: [2] },
  { id: 'glue', label: 'Sklej (B)', x: 682, y: 332, w: 324, h: 112, modes: [2, 4] },
];
const MENU_HINTS = {
  1: 'Grip na planecie: leć · B: trzymaj/puść · prawa gałka: zoom/obrót · lewa: obrót w 2 osiach',
  2: 'Wyciągnij kulkę z galerii – urośnie · odłóż – zmaleje · A: nóż · B: sklej · X: stań na planecie',
  3: 'Spust: chwyć planetę · gałka/2 ręce: powiększ · B: kamera za ludzikiem',
  4: 'Obiekty NIE w skali – prawdziwe rozmiary na tabliczkach · A: nóż · B: sklej',
  5: 'Gałka góra/dół albo rozsuwanie dłoni (2 spusty): pomniejsz / powiększ kosmos',
  6: 'Gałka: zoom · A/B: skok · spust na obiekcie: obracaj się wokół niego (gałka lewo/prawo)',
  7: 'Gałka/2 ręce: Galaktyka → Słońce → Ziemia · suwak: prędkość lotu',
  8: 'Spust: chwyć obiekt i włóż w siatkę · gałka: obróć siatkę · sondy: porównaj upływ czasu',
  10: 'Gałka/2 ręce: od człowieka do całego kosmosu i z powrotem · suwak: prędkość',
  12: 'Suwak / prawa gałka ◀ ▶: czas · A: pauza · B: dalej · spust: obróć scenę',
  13: 'Spust: weź do ręki · prawa gałka: obrót 4D · lewa ▲▼: 4. wymiar · A: bryła · B: widok',
  11: 'Wybierz orbital albo pierwiastek · spust: obracaj atom · gałka/2 ręce: obrót i powiększenie',
  9: 'Prędkość: statek się skraca, jego zegar tyka wolniej · „Widok z pokładu”: tak widzi kosmos załoga',
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
  roundRect(ctx, 0, 0, MENU_CANVAS_W, menuUsedH(), 40); ctx.fill();
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
    const active = b.id === 'mode' + state.mode || (b.id === 'knife' && state.knife) || (b.active && b.active());
    ctx.fillStyle = active ? COLOR_MENU_BUTTON_ACTIVE
      : state.hoveredButton === b.id ? COLOR_MENU_BUTTON_HOVER
      : COLOR_MENU_BUTTON;
    roundRect(ctx, b.x, b.y, b.w, b.h, 24); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.draw) { b.draw(ctx, b); continue; }        // własny rysunek (oś czasu w Trybie 12)
    if (b.slider) {                                   // suwak prędkości zoomu (Tryb 6)
      const sl = speedSlider();
      const f = Math.log(sl.v / sl.min) / Math.log(sl.max / sl.min);
      const x0 = b.x + 30, x1 = b.x + b.w - 30, yT = b.y + 80;
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`${state.mode === 7 || state.mode === 10 ? 'Prędkość lotu' : 'Prędkość zoomu'}: ×10 w ${(1 / sl.v).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s`, b.x + b.w / 2, b.y + 34);
      ctx.fillStyle = '#1a2340'; roundRect(ctx, x0, yT - 7, x1 - x0, 14, 7); ctx.fill();
      ctx.fillStyle = '#7fb0ff'; roundRect(ctx, x0, yT - 7, (x1 - x0) * f, 14, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * f, yT, 18, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const label = typeof b.label === 'function' ? b.label() : b.label;
    ctx.font = b.font || (b.small ? 'bold 34px system-ui, sans-serif' : 'bold 40px system-ui, sans-serif');
    const sub = typeof b.sub === 'function' ? b.sub() : b.sub;
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 - (sub ? 18 : 0));
    if (sub) {
      ctx.font = b.subFont || '32px system-ui, sans-serif';
      ctx.fillText(sub, b.x + b.w / 2, b.y + b.h / 2 + 26);
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
  if (button.id.startsWith('sr') && !isNaN(+button.id.slice(2))) { setSrSpeed(+button.id.slice(2)); return; }
  if (button.id.startsWith('orb_')) { atomSet({ kind: 'orbital', orb: button.id.slice(4), variant: 0 }); return; }
  if (button.id.startsWith('el_')) { atomSet({ kind: 'element', el: button.id.slice(3) }); return; }
  if (button.id.startsWith('temp')) { setM3Temperature(+button.id.slice(4)); return; }
  if (button.id.startsWith('ev_')) { m3StartEvent(button.id.slice(3)); return; }
  if (button.id.startsWith('t4')) { t4Menu(button.id); drawMenu(); return; }
  if (button.id.startsWith('hspd')) { state.hist.speed = HIST_SPEEDS[+button.id.slice(4)]; histSetPlaying(true); return; }
  switch (button.id) {
    case 'hide': setMenuHidden(true); break;
    case 'mode1': setMode(1); break;
    case 'mode2': setMode(2); break;
    case 'mode3': setMode(3); break;
    case 'mode4': setMode(4); break;
    case 'mode5': setMode(5); break;
    case 'mode6': setMode(6); break;
    case 'mode7': setMode(7); break;
    case 'mode8': setMode(8); break;
    case 'stSheet': toggleSheet(); break;
    case 'stInside': toggleInside(); break;
    case 'stProbes': toggleProbes(); break;
    case 'stAge': resetProbeAges(); break;
    case 'mode9': setMode(9); break;
    case 'srReset': srResetClocks(); break;
    case 'srPause': state.srPaused = !state.srPaused; break;
    case 'srShip': toggleSrShip(); break;
    case 'surf': if (state.surf) exitSurface(); else { state.surfPick = !state.surfPick; } break;
    case 'mwAll': mwGoTo(Math.log10(MW_START_SIZE_M / 100000)); break;
    case 'mwSun': mwGoTo(MW_LOG_MAX); break;
    case 'jAll': mwGoTo(J_LOG_MIN); break;
    case 'jHuman': mwGoTo(J_LOG_MAX); break;
    case 'mode10': setMode(10); break;
    case 'mode11': setMode(11); break;
    case 'mode12': setMode(12); break;
    case 'mode13': setMode(13); break;
    case 'histPrev': histStep(-1); break;
    case 'histNext': histStep(1); break;
    case 'histPlay': histSetPlaying(!state.hist.playing); break;
    case 'histRestart': histSeek(0); histSetPlaying(true); break;
    case 'atomVar': if (state.atom.kind === 'orbital') atomSet({ variant: state.atom.variant + 1 }); break;
    case 'atomBohr': state.atom.bohr = !state.atom.bohr; break;
    case 'atomReset': resetCurrentMode(); break;
    case 'prev': scaleJump(-1); break;
    case 'timeSlow': state.timeIndex = Math.max(0, state.timeIndex - 1); state.timePaused = false; break;
    case 'timeFast': state.timeIndex = Math.min(TIME_SPEEDS.length - 1, state.timeIndex + 1); state.timePaused = false; break;
    case 'timePlay': state.timePaused = !state.timePaused; break;
    case 'track': toggleTrack(); break;
    case 'pick': togglePersonPick(); break;
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
  if (state.follow && mode !== 3) { state.follow = null; state.m3Pick = false; layoutMode3(); }
  if (state.surf && mode !== 2) exitSurface();
  if (state.srShip && mode !== 9) toggleSrShip();
  if (state.m3Ride && mode !== 3) m3EndEvent();
  state.surfPick = false;
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
  mode7Group.visible = mode === 7 || mode === 10;
  state.jCosmos = false;
  mwSkyUniforms.uDim.value = 1;                     // Podróż przyciemnia gwiazdy w dzień – w innych trybach normalnie
  stars.material.color.setScalar(1);
  mode8Group.visible = mode === 8;
  mode9Group.visible = mode === 9;
  mode11Group.visible = mode === 11;
  mode12Group.visible = mode === 12;
  mode13Group.visible = mode === 13;
  stars.visible = mode !== 5 && mode !== 7 && mode !== 10;
  if (mode === 7 && state.journey) { state.journey = false; layoutMode7(); }
  if (mode === 10 && !state.journey) { layoutMode10(); }                        // w przestrzeni międzygalaktycznej nie ma pobliskich gwiazd
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
  if (mode === 7) layoutMode7();
  if (mode === 8) layoutMode8();
  if (mode === 9) layoutMode9();
  if (mode === 10) layoutMode10();
  if (mode === 11) layoutMode11();
  if (mode === 12) layoutMode12();
  if (mode === 13) layoutMode13();
}

// Suwak: pozycja trafienia na pasku -> prędkość
function sliderFromUV(uv, b = menuButtons.find(x => x.id === 'speed')) {
  const x = uv.x * MENU_CANVAS_W, f = (x - (b.x + 30)) / (b.w - 60);
  if (b.drag) { b.drag(THREE.MathUtils.clamp(f, 0, 1)); return; }
  setScaleSpeedFromFraction(f);
}

// PC: przy powrocie do trybu obracaj kamerę wokół jego środka
function focusOrbitOnMode(mode) {
  if (mode === 1) orbitControls.target.copy(systemGroup.position);
  if (mode === 3) orbitControls.target.copy(m3Planet.position);
  if (mode === 6) orbitControls.target.copy(m6Origin).addScaledVector(m6Fwd, SCALE_DISTANCE_M + 0.3).setY(SCALE_BASELINE_Y_M + 0.3);
  if (mode === 7 || mode === 10) orbitControls.target.copy(mwPivot);
  if (mode === 8) orbitControls.target.copy(stRoot.position);
  if (mode === 9) orbitControls.target.copy(sr.origin);
  if (mode === 11) orbitControls.target.copy(atom.group.position);
  if (mode === 12) orbitControls.target.copy(hist.root.position);
  if (mode === 13) orbitControls.target.copy(t4.root.position);
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
    if (hit && hit.distance < 5 && (1 - hit.uv.y) * MENU_CANVAS_H <= menuUsedH()) {
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
    else if (ui.button && (ui.button.id === 'speed' || ui.button.drag)) { state.sliderCtrl = ctrl; state.sliderBtn = ui.button; sliderFromUV(ui.hit.uv, ui.button); }
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
  } else if (mode === 2 && (state.surf || state.surfPick)) {
    if (state.surfPick && source === 'select') surfaceAction(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    return;
  } else if (shelfFor(mode)) {
    if (isKnifeHand(ctrl)) { if (source === 'select') tryKnifeCut(); return; }
    grabShelf(shelfFor(mode), ctrl);
    grabbed = !!ctrl.userData.grabTarget;
  } else if (mode === 3) {
    if (state.m3Pick) {                          // wybór ludzika: spust celując w niego
      if (source === 'select') { const P = pickPerson(raycaster.ray.origin.clone(), raycaster.ray.direction.clone()); if (P) startFollow(P); }
      return;
    }
    if (state.follow || state.m3Ride) return;    // podczas śledzenia / lotu rakietą planety nie chwytamy
    grabbed = grabMode3(ctrl);
  }
  else if (mode === 5 || mode === 7 || mode === 10) { state.m5Hands.add(ctrl); state.m5Pinch = null; return; }
  else if (mode === 11) {
    // chwyć atom (z daleka też) – obraca się tak, jak obracasz dłoń; dwie ręce – powiększanie
    setRayFromController(ctrl);
    _sphere.set(atom.group.position, 0.4 * atom.group.scale.x);
    if (raycaster.ray.intersectsSphere(_sphere) || raycaster.ray.origin.distanceTo(atom.group.position) < 0.5 * atom.group.scale.x) grabbed = startGrab(atom.group, ctrl, ATOM_GRAB);
  }
  else if (mode === 12) {
    // chwyć scenę (z daleka też) – obróć ją albo przesuń
    _sphere.set(hist.root.position, 0.6 * hist.root.scale.x);
    if (raycaster.ray.intersectsSphere(_sphere)) grabbed = startGrab(hist.root, ctrl, HIST_GRAB);
  }
  else if (mode === 13) {
    // weź bryłę 4D do ręki (z daleka też) – obraca się tak jak dłoń (obroty 3D); dwie ręce – powiększanie
    _sphere.set(t4.root.position, 0.42 * t4.root.scale.x);
    if (raycaster.ray.intersectsSphere(_sphere)) grabbed = startGrab(t4.root, ctrl, T4_GRAB);
  }
  else if (mode === 6) { if (source === 'select') scaleFocusClick(raycaster.ray.origin.clone(), raycaster.ray.direction.clone()); return; }
  else if (mode === 8) {
    const o = pickST(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    if (o) grabbed = startGrab(o.group, ctrl, ST_GRAB);
  }
  if (grabbed || ctrl.userData.grabTarget) ctrl.userData.grabSource = source;
}

function onPressEnd(ctrl, source) {
  if (state.m5Hands.delete(ctrl)) state.m5Pinch = null;
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
  if (state.mode === 1 && hand === 'right' && index === RESET_BUTTON) toggleTrack();
  if (state.mode === 2 && hand === 'left' && index === SURFACE_BUTTON) { setRayFromController(ctrl); surfaceAction(raycaster.ray.origin.clone(), raycaster.ray.direction.clone()); }
  if (state.mode === 3 && hand === 'right' && index === RESET_BUTTON) togglePersonPick();
  if (state.mode === 6 && hand === 'right' && index === KNIFE_BUTTON) scaleJump(1);
  if (state.mode === 6 && hand === 'right' && index === RESET_BUTTON) scaleJump(-1);
  if (state.mode === 12 && hand === 'right' && index === KNIFE_BUTTON) histSetPlaying(!state.hist.playing);
  if (state.mode === 12 && hand === 'right' && index === RESET_BUTTON) histStep(1);
  if (state.mode === 13 && hand === 'right' && index === KNIFE_BUTTON) { t4Menu('t4s' + (state.t4.shape + 1) % T4_SHAPES.length); drawMenu(); }
  if (state.mode === 13 && hand === 'right' && index === RESET_BUTTON) { t4Menu('t4v' + (state.t4.view + 1) % 3); drawMenu(); }
}

// Gałka w Trybie 5: powiększanie/pomniejszanie całego kosmosu wokół głowy
function stickUniverse(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(y) < STICK_DEADZONE) return;
  zoomUniverse(Math.pow(STICK_ZOOM_RATE * 0.5, -y * dt));
}
function zoomUniverse(factor) { setUniverseScale(universe.scale.x * factor); }
// Skala kosmosu wokół stałego punktu przed Tobą (zoom wokół oka nic by nie zmienił – wszystko kurczyłoby się
// w stronę źrenicy). Położenie zależy tylko od skali, więc powrót do 1× zawsze wraca do punktu startu.
const m5Origin = new THREE.Vector3(), m5Pivot = new THREE.Vector3();
function setUniverseScale(s) {
  s = THREE.MathUtils.clamp(s, MODE5_SCALE_MIN, MODE5_SCALE_MAX);
  universe.scale.setScalar(s);
  universe.position.copy(m5Origin).sub(m5Pivot).multiplyScalar(s).add(m5Pivot);
  universe.updateMatrixWorld(true);
}
// Rozsuwanie/zsuwanie dłoni (oba spusty) = zoom
function updateMode5Pinch(getScale = () => universe.scale.x, setScale = setUniverseScale, power = 1) {
  if (state.m5Hands.size < 2) return;
  const [a, b] = [...state.m5Hands];
  const d = _v1.setFromMatrixPosition(a.matrixWorld).distanceTo(_v2.setFromMatrixPosition(b.matrixWorld));
  if (!state.m5Pinch) state.m5Pinch = { d0: Math.max(d, 0.02), s0: getScale() };
  setScale(state.m5Pinch.s0 * Math.pow(d / state.m5Pinch.d0, power));
}

// Gałka w Trybie 7: góra/dół = zoom do Słońca, lewo/prawo = obrót Galaktyki
function stickGalaxy(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(y) > STICK_DEADZONE) mwZoom(-y * state.mwSpeed * dt);   // tylko przybliżanie i oddalanie – bez obrotu
}

// Gałka w Trybie 6: góra/dół = zoom
function stickScale(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(y) > STICK_DEADZONE) scaleZoom(y * state.scaleSpeed * dt);
  if (Math.abs(x) > STICK_DEADZONE && state.m6Focus) turnAroundFocus(-x * 60 * DEG * dt);
}

// Gałka w Trybie 1: góra/dół = zoom, lewo/prawo = obrót całego układu wokół trzymanej planety
// (albo punktu przed Tobą) – żeby oglądać planetę ze wszystkich stron bez kręcenia się w miejscu
function stickZoom(ctrl, dt) {
  const gp = ctrl.userData.inputSource && ctrl.userData.inputSource.gamepad;
  if (!gp || gp.axes.length <= ZOOM_STICK_AXIS) return;
  const x = gp.axes[ZOOM_STICK_AXIS - 1], y = gp.axes[ZOOM_STICK_AXIS];
  if (Math.abs(x) > STICK_DEADZONE) turnSystem(-x * STICK_TURN_DEG_S * DEG * dt);
  // lewa gałka: góra/dół = obrót w drugiej osi (pochylenie) – planetę oglądasz z góry i z dołu
  if (ctrl.userData.handedness === 'left') { if (Math.abs(y) > STICK_DEADZONE) pitchSystem(y * STICK_TURN_DEG_S * DEG * dt); return; }
  if (Math.abs(y) < STICK_DEADZONE) return;
  state.focus = null;
  const pivot = state.track ? state.track.point : _v4.setFromMatrixPosition(ctrl.matrixWorld);
  zoomSystemAround(pivot.clone(), Math.pow(STICK_ZOOM_RATE, -y * dt), true);
}
function systemPivot() {
  if (state.track) return state.track.point;
  if (state.focus) return state.focus.P1;
  return _v4.copy(eyePos).addScaledVector(horizontalForward(), 1.0);
}
function turnSystem(angle, axis = UP) {
  const pivot = systemPivot().clone();
  _q1.setFromAxisAngle(axis, angle);
  systemGroup.position.sub(pivot).applyQuaternion(_q1).add(pivot);
  systemGroup.quaternion.premultiply(_q1);
  systemGroup.updateMatrixWorld(true);
  reinitGrab(systemGroup);
}
// obrót w osi poziomej (prostopadłej do kierunku patrzenia na planetę)
function pitchSystem(angle) {
  const dir = _v5.copy(systemPivot()).sub(eyePos);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.copy(horizontalForward());
  turnSystem(angle, _v6.crossVectors(dir.normalize(), UP).normalize().clone());
}
// B (lub przycisk w menu): trzymaj planetę przed sobą / puść ją (widok ogólny – planety odlatują po orbitach)
function toggleTrack() {
  if (state.track) state.track = null;
  else if (state.lastFocusBody) state.track = { body: state.lastFocusBody, point: state.lastFocusBody.worldPos.clone() };
  drawMenu();
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
  else if (!ui && state.mode === 6) scaleFocusClick(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
  else if (!ui && state.mode === 2 && state.surfPick) surfaceAction(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
  else if (!ui && state.mode === 3 && state.m3Pick) { const P = pickPerson(raycaster.ray.origin.clone(), raycaster.ray.direction.clone()); if (P) startFollow(P); }
  else if (ui && ui.button && (ui.button.id === 'speed' || ui.button.drag)) sliderFromUV(ui.hit.uv, ui.button);
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
  if (state.mode === 3 && key === 'l') togglePersonPick();
  if (state.mode === 8 && key === 's') toggleSheet();
  if (state.mode === 9 && '123456'.includes(e.key) && e.key !== '') setSrSpeed(SR_SPEEDS[+e.key - 1]);
  if (state.mode === 9 && key === 'w') toggleSrShip();
  if (state.mode === 11 && '1234567'.includes(e.key) && e.key !== '') atomSet({ kind: 'orbital', orb: Object.keys(ATOM_ORBITALS)[+e.key - 1], variant: 0 });
  if (state.mode === 12 && e.key === ' ') histSetPlaying(!state.hist.playing);
  if (state.mode === 13) {
    const T = state.t4, act = id => { t4Menu(id); drawMenu(); };
    if ('12345'.includes(e.key) && e.key !== '') act('t4s' + (+e.key - 1));
    if (key === 'v') act('t4v' + (T.view + 1) % 3);
    if (e.key === 'ArrowLeft') T.om.xw -= 0.6;
    if (e.key === 'ArrowRight') T.om.xw += 0.6;
    if (e.key === 'ArrowUp') t4SetW(T.w + 0.1);
    if (e.key === 'ArrowDown') t4SetW(T.w - 0.1);
    if (key === 'd') act('t4r_double');
    if (e.key === ' ') act('t4halt');
    if (key === 'p') act('t4d_pass');
    if (key === 'o') act('t4d_box');
    if (key === 'f') act('t4d_flat');
  }
  if (state.mode === 12 && e.key === 'ArrowLeft') histStep(-1);
  if (state.mode === 12 && e.key === 'ArrowRight') histStep(1);
  if (state.mode === 12 && e.key === 'Home') { histSeek(0); histSetPlaying(true); }
  if (state.mode === 12 && (e.key === '.' || e.key === ',')) { const i = HIST_SPEEDS.indexOf(state.hist.speed) + (e.key === '.' ? 1 : -1); state.hist.speed = HIST_SPEEDS[THREE.MathUtils.clamp(i, 0, HIST_SPEEDS.length - 1)]; drawMenu(); }
  if (state.mode === 11 && key === 'v') atomSet({ variant: state.atom.variant + 1 });
  if (state.mode === 11 && key === 'b') { state.atom.bohr = !state.atom.bohr; drawMenu(); }
  if (state.mode === 11 && e.key === 'ArrowLeft') atom.group.rotateOnWorldAxis(UP, 0.2);
  if (state.mode === 11 && e.key === 'ArrowRight') atom.group.rotateOnWorldAxis(UP, -0.2);
  if (state.mode === 9 && e.key === ' ') { state.srPaused = !state.srPaused; drawMenu(); }
  if (state.mode === 9 && key === 'r') srResetClocks();
  if (state.mode === 8 && key === 'i') toggleInside();
  if (state.mode === 8 && key === 'b') toggleProbes();
  if (state.mode === 8 && key === 'r') resetProbeAges();
  if (state.mode === 8 && e.key === 'ArrowLeft') stRoot.quaternion.premultiply(_q2.setFromAxisAngle(UP, 0.2));
  if (state.mode === 8 && e.key === 'ArrowRight') stRoot.quaternion.premultiply(_q2.setFromAxisAngle(UP, -0.2));
  if (state.mode === 2 && key === 'v') { setRayFromMouse(); surfaceAction(raycaster.ray.origin.clone(), raycaster.ray.direction.clone()); }
  if (state.mode === 3 && !state.follow && (e.key === '+' || e.key === '=')) setM3Zoom(m3Planet.scale.x * 1.5);
  if (state.mode === 3 && '12345678'.includes(e.key) && e.key !== '') m3StartEvent(M3_EVENTS[+e.key - 1]);
  if (state.mode === 3 && key === 't') setM3Temperature(M3_TEMPS[(M3_TEMPS.indexOf(m3W.T) + 1) % M3_TEMPS.length]);
  if (state.mode === 3 && !state.follow && e.key === '-') setM3Zoom(m3Planet.scale.x / 1.5);
  if (state.mode === 3 && e.key === 'ArrowLeft') rotateM3Planet(_q2.setFromAxisAngle(UP, -0.2));
  if (state.mode === 3 && e.key === 'ArrowRight') rotateM3Planet(_q2.setFromAxisAngle(UP, 0.2));
  if (state.mode === 1 && (e.key === '+' || e.key === '=')) zoomSystemAround(orbitControls.target.clone(), 2);
  if (state.mode === 1 && e.key === ' ') { state.timePaused = !state.timePaused; drawMenu(); }
  if (state.mode === 1 && key === 'b') toggleTrack();
  if (state.mode === 1 && e.key === 'ArrowLeft') turnSystem(0.2);
  if (state.mode === 1 && e.key === 'ArrowRight') turnSystem(-0.2);
  if (state.mode === 1 && e.key === 'ArrowUp') pitchSystem(0.2);
  if (state.mode === 1 && e.key === 'ArrowDown') pitchSystem(-0.2);
  if (state.mode === 1 && e.key === '.') { state.timeIndex = Math.min(TIME_SPEEDS.length - 1, state.timeIndex + 1); state.timePaused = false; }
  if (state.mode === 1 && e.key === ',') { state.timeIndex = Math.max(0, state.timeIndex - 1); state.timePaused = false; }
  if ((state.mode === 7 || state.mode === 10) && (e.key === '+' || e.key === '=')) mwZoom(0.5);
  if ((state.mode === 7 || state.mode === 10) && e.key === '-') mwZoom(-0.5);
  if ((state.mode === 7 || state.mode === 10) && key === ']') nudgeSpeed(1.5);
  if ((state.mode === 7 || state.mode === 10) && key === '[') nudgeSpeed(1 / 1.5);
  if (state.mode === 7 && e.key === 'ArrowLeft') state.mwYaw += 0.15;
  if (state.mode === 7 && e.key === 'ArrowRight') state.mwYaw -= 0.15;
  if (state.mode === 5 && (e.key === '+' || e.key === '=')) zoomUniverse(2);
  if (state.mode === 5 && e.key === '-') zoomUniverse(0.5);
  if (state.mode === 1 && e.key === '-') zoomSystemAround(orbitControls.target.clone(), 0.5);
  if (state.mode === 6) {
    if (e.key === '+' || e.key === '=') scaleZoom(-0.25);
    if (e.key === '-') scaleZoom(0.25);
    if (key === 'n') scaleJump(1);
    if (key === 'p') scaleJump(-1);
    if (key === ']') nudgeSpeed(1.5);
    if (key === '[') nudgeSpeed(1 / 1.5);
    if (e.key === 'ArrowLeft') turnAroundFocus(0.2);
    if (e.key === 'ArrowRight') turnAroundFocus(-0.2);
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
  } else if (mode === 2 && state.surf) {
    const sky = state.surf.sky.filter(o => o.def.type !== 'star' || state.surf.sky.length === 1).slice(0, 2)
      .map(o => `${o.def.name} ${o.deg < 1 ? o.deg.toFixed(2) : o.deg.toFixed(1)}°`).join(', ');
    text = `Stoisz na: ${state.surf.A.def.name}${sky ? '  ·  na niebie: ' + sky : ''}  ·  ${state.fps} FPS`;
  } else if (mode === 2 || mode === 4) {
    const extra = mode === 2 ? `1 cm = ${formatKm(EARTH_RADIUS_KM / MODE2_EARTH_RADIUS_M / 100)} km` : 'obiekty nie w skali';
    text = `Nóż: ${state.knife ? 'WŁĄCZONY' : 'wyłączony'}  ·  ${extra}  ·  ${state.fps} FPS`;
  } else if (mode === 3 && state.follow) {
    text = `Kamera za ludzikiem  ·  ${ACTION_NAMES[state.follow.action] || ''}  ·  powiększenie ×${state.followScale.toFixed(0)}  ·  ${state.fps} FPS`;
  } else if (mode === 3) {
    text = m3W.note ? `${m3W.note}  ·  ${state.fps} FPS`
      : `Skala ×${m3Planet.scale.x.toFixed(2)}  ·  ${m3W.T}°C  ·  rok planety: ${(MODE3_YEAR_S / 60).toLocaleString('pl-PL')} min  ·  ${state.fps} FPS`;
  } else if (mode === 5) {
    text = `1 m = ${formatLy(LY_MILLIONS_PER_M / universe.scale.x)} lat świetlnych  ·  galaktyk: ${galaxies.length + cosmos.web.geometry.attributes.position.count}  ·  ${state.fps} FPS`;
  } else if (mode === 6) {
    text = state.m6Focus ? `Obracasz się wokół: ${state.m6Focus.def.name} (gałka ◀ ▶, spust = puść)  ·  ${state.fps} FPS`
      : `1 m w goglach = ${formatMeters(Math.pow(10, state.scaleLog))}  ·  ${nearestScaleItem().def.name}  ·  ${state.fps} FPS`;
  } else if (mode === 11) {
    text = `${atom.info[0]}  ·  ${state.fps} FPS`;
  } else if (mode === 12) {
    const H = state.hist, i = Math.min(HIST.length - 1, Math.floor(H.p));
    text = `Historia atomu  ·  rozdział ${i + 1}/${HIST.length}  ·  tempo ×${String(H.speed).replace('.', ',')}${H.playing ? '' : '  ·  pauza'}  ·  ${state.fps} FPS`;
  } else if (mode === 13) {
    const T = state.t4, nm = T.demo === 'box' ? 'Pudełko' : T.demo === 'flat' ? 'Świat 2D' : T4_SHAPES[T.shape].short;
    text = `4D: ${nm}  ·  W = ${T.w.toFixed(2).replace('.', ',')}  ·  widok: ${T4_VIEWS[T.view]}  ·  ${state.fps} FPS`;
  } else if (mode === 10) {
    const L = state.mwLog;
    text = `1 m w goglach = ${formatMeters(M_PER_LY / Math.pow(10, L))}  ·  ${journeyFocusText(L)}  ·  ${state.fps} FPS`;
  } else if (mode === 9) {
    const g = srGamma();
    text = state.srShip ? `Widok z pokładu  ·  ${String(state.srBeta).replace('.', ',')} c  ·  aberracja światła i efekt Dopplera  ·  ${state.fps} FPS`
      : state.srBeta >= 0.999 ? `γ = ${g.toFixed(1)} – prędkości światła nie da się osiągnąć: im bliżej, tym więcej energii trzeba  ·  ${state.fps} FPS`
      : `Prędkość ${String(state.srBeta).replace('.', ',')} c  ·  statek ${g.toFixed(2)}× krótszy, jego czas ${g.toFixed(2)}× wolniej  ·  ${state.fps} FPS`;
  } else if (mode === 8) {
    const n = stObjects.filter(o => o.weight > 0.5).length;
    const [A, B] = stProbes;
    text = state.stProbes ? `Sonda A: ${A.age.toFixed(1)} lat  ·  Sonda B: ${B.age.toFixed(1)} lat  ·  różnica ${Math.abs(A.age - B.age).toFixed(1)} lat  ·  ${state.fps} FPS`
      : `Czasoprzestrzeń  ·  ${state.stSheet ? 'płachta 2D' : 'siatka 3D'}  ·  obiektów w siatce: ${n}  ·  ${state.fps} FPS`;
  } else {
    const { L, w } = mwPath(state.mwLog);
    text = `1 m w goglach = ${formatMeters(9.4607e15 / Math.pow(10, L))}${w > 0.03 && w < 0.97 ? '  ·  lecisz do Ziemi' : ''}  ·  ${state.fps} FPS`;
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
    if ((state.mode === 7 || state.mode === 10) && presenting) stickGalaxy(ctrl, dt);
    if (state.mode === 3 && presenting) stickFollow(ctrl, dt);
    if (state.mode === 8 && presenting) stickST(ctrl, dt);
    if (state.mode === 11 && presenting) stickAtom(ctrl, dt);
    if (state.mode === 12 && presenting) stickHist(ctrl, dt);
    if (state.mode === 13 && presenting) stickT4(ctrl, dt);
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
    if (ui && ui.kind === 'menu') sliderFromUV(ui.hit.uv, state.sliderBtn);
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
    if (state.mode === 2) updateGallery(dt);
    updateHalfPlanes(shelf);
    updateShelfAnimations(shelf, dt);
    updateKnife();
    updateShelfLabels(shelf);
    updateHeadlight(shelf.light);
  } else if (state.mode === 3) {
    updatePeople(dt);
    updateMode3Extras(dt);
    updateM3Frame(dt);
    updateM3World(dt);
    updateMode3World(dt);
    updateHeadlight(mode3Light);
  } else if (state.mode === 5) {
    updateMode5Pinch();
    updateGalaxies(dt);
  } else if (state.mode === 6) {
    updateScaleMode(dt);
    updateScaleFocus(dt);
    updateHeadlight(mode6Light);
  } else if (state.mode === 11) {
    updateMode11(dt);
    updateHeadlight(mode11Light);
  } else if (state.mode === 12) {
    updateMode12(dt);
    updateHeadlight(mode12Light);
  } else if (state.mode === 13) {
    updateMode13(dt);
    updateHeadlight(mode13Light);
  } else if (state.mode === 9) {
    updateMode9(dt);
    updateHeadlight(mode9Light);
  } else if (state.mode === 8) {
    updateMode8(dt);
    updateHeadlight(mode8Light);
  } else if (state.mode === 7 || state.mode === 10) {
    updateMode5Pinch(() => Math.pow(10, state.mwLog), mwSetScale, 4);   // mocniej – zakres to 11 rzędów wielkości
    if (state.mode === 10) journeyCosmos(dt); else updateMode7(dt);
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
  setKnife, updateKnife, tryKnifeCut, grabShelf, setMenuHidden, onPressStart, onPressEnd, startBehavior, startFollow, stopFollow, m3Extras, m3Features, setM3Zoom, rotateM3Planet, m3CosmosParts,
  m3W, m3StartEvent, m3EndEvent, setM3Temperature, m3Atmo, mwSkyUniforms, mwPivot, stars, makeGlobeSampler, mwQuatSol,
  models, scaleItems, scaleJump, scaleZoom, m3Surface, layoutMode, mwGoTo, mwZoom, mw, stObjects, stRoot, toggleSheet, mwPath, stProbes, toggleProbes, toggleInside, sr, setSrSpeed, toggleSrShip, srShip, journey, layoutMode10, surfaceAction, atom, atomSet, hist, HIST, histSeek, histSetPlaying, t4, T4_SHAPES, t4Menu, t4SetW, m3Ride, enterSurface, exitSurface, scaleFocusClick, turnAroundFocus, pitchSystem,
};
