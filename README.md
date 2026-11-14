# Układ Słoneczny VR (WebXR, Meta Quest 3 / 3S)

Interaktywny Układ Słoneczny w goglach VR, działający w przeglądarce **Meta Quest Browser**.
Nie trzeba nic instalować w goglach: wystarczy otworzyć stronę i kliknąć **ENTER VR**.

Osiem trybów (przełączane na panelu menu):

- **Tryb 1 – Model:** cały układ do orbity Plutona w prawdziwej skali, z księżycami i pierścieniami.
  Planety krążą po eliptycznych orbitach (prawa Keplera) i obracają się wokół osi, księżyce krążą wokół planet.
  Czas można przyspieszać, zwalniać i zatrzymać. Układ da się trzymać w dłoni albo dolecieć do pojedynczej
  planety; po przelocie planeta jest „trzymana” przed Tobą (B puszcza/łapie ją z powrotem), a gałką lewo/prawo
  obracasz cały układ wokół niej, żeby oglądać ją ze wszystkich stron bez kręcenia się w miejscu.
- **Tryb 2 – Planety:** Słońce, 8 planet, Pluton i 9 największych księżyców **w prawdziwych proporcjach**
  (1 cm = 1274 km, więc Słońce ma ok. 11 m średnicy i „wschodzi” za planetami). Obiekty można chwytać,
  rzucać, skalować i **przecinać nożem**: warstwy wnętrza są w proporcjach zgodnych z obecną wiedzą naukową.
- **Tryb 3 – Ludziki:** planeta generowana w kodzie (średnica 1 m): kontynenty, góry, plaże, śnieżne szczyty
  i czapy polarne, ocean, 450 drzewek i chmurki. Chodzi po niej 30 ludzików z modelu 3D (1 cm wzrostu):
  chodzą, biegają, rozglądają się, machają w Twoją stronę, kucają, podchodzą do siebie i rozmawiają w parach
  i grupkach. Planeta krąży po swojej orbicie wokół Słońca, a Ty lecisz razem z nią: ona zostaje przed Tobą,
  a daleko w tle (kilkaset metrów) przesuwają się Słońce, inne planety z kontynentami i linie ich orbit. Planetę
  można tylko obracać i przybliżać się do niej – nie da się jej wyrzucić z orbity. Jest dzień i noc.
  Ludziki idą po rzeźbie terenu (góry, doliny) i omijają morza. Na planecie są 3 wioski z domkami (większość
  ludzików w nich mieszka i do nich wraca), wulkan z lawą w kraterze i dymem, chmura burzowa z deszczem
  i błyskawicami, a wokół krąży księżyc i sztuczny satelita (na sztywno związane z planetą).
  **Kamera za ludzikiem:** wybierz ludzika, a planeta ustawi się tak, że stoi on przed Tobą (powiększony),
  a świat kręci się pod jego stopami. Słońce i planety na niebie widać także wtedy (i zachodzi Słońce!).
- **Tryb 4 – Obiekty:** czarna dziura, pulsar, biały karzeł, Ziemia (dla porównania) i kometa. Są w wygodnych rozmiarach, a prawdziwe
  rozmiary podają tabliczki. Pulsar i białego karła można przeciąć.
- **Tryb 5 – Kosmos:** stoisz w miejscu, zanurzony w ponad tysiącu miniaturowych galaktyk (1200, gęstość
  zwiększona dla efektu – naprawdę w okolicy Drogi Mlecznej jest ich mniej). Droga Mleczna i Andromeda są w prawdziwej skali (1 m = 1 mln lat świetlnych).
  Jedyne sterowanie to zoom (gałka lub rozsuwanie dłoni ze spustami): po pomniejszeniu widać trójwymiarowy
  fragment sieci kosmicznej, ok. 80 tys. galaktyk we włóknach i gromadach (w prawdziwym fragmencie tej
  wielkości jest ich jeszcze więcej, licząc karłowate); po powiększeniu do 1× wracasz
  dokładnie do punktu startu. Tło to sfera z obrazem dalszej części sieci.
- **Tryb 6 – Skala:** podróż przez 33 rzędy wielkości, od atomu (0,1 nm) przez DNA, wirusa, bakterię, włos,
  mrówkę, człowieka, autobus, płetwala, wieżę Eiffla, Everest, księżyce, Ziemię, Jowisza, Słońce, Betelgezę,
  Układ Słoneczny, heliosferę, obłok Oorta, najbliższe gwiazdy, Plejady, Bąbel Lokalny i ramię Oriona po Drogę
  Mleczną i Grupę Lokalną galaktyk (39 obiektów).
- **Tryb 7 – Galaktyka:** Droga Mleczna ze 140 tys. gwiazd (4 ramiona spiralne, poprzeczka, zgrubienie
  centralne). Zoom (gałka, dwie ręce albo przycisk „Do Ziemi”) prowadzi płynnie przez 13 rzędów
  wielkości: Galaktyka → sąsiedztwo Słońca (gwiazdy pojawiają się stopniowo, bez „kuli” gęstszych gwiazd) →
  obłok Oorta i orbity planet → Słońce (podlatujesz, aż ma ok. 3 m) → przelot obok Słońca → Ziemia z Księżycem.
  Z wnętrza Galaktyki na niebie cały czas widać pas Drogi Mlecznej – tworzą go te same gwiazdy, które z daleka
  tworzą spiralę. **Suwak** w menu reguluje prędkość lotu.
- **Tryb 8 – Grawitacja (czasoprzestrzeń):** siatka cienkich linii w przestrzeni (albo „gumowa płachta” 2D),
  wyginana przez Słońce, Ziemię (krąży wokół Słońca), gwiazdę neutronową, czarną dziurę i parę czarnych dziur,
  które krążą wokół siebie i wysyłają fale grawitacyjne. Obiekty chwytasz i przesuwasz – siatka wygina się na
  żywo. Kolor linii: niebieski = płasko, żółty/czerwony = mocne zakrzywienie (tam czas płynie wolniej; podpisy
  mówią o ile). Efekt jest mocno przesadzony, żeby było go widać.

Ziemia we wszystkich trybach to model 3D z teksturą (`models/earth.glb`).

---

## Sterowanie

Wspólne dla wszystkich trybów:

| Akcja | Kontrolery | Dłonie (hand tracking) |
|---|---|---|
| Przycisk w menu | wyceluj promieniem w panel, naciśnij spust | wyceluj, uszczypnij |
| **Przesuń menu** | wyceluj w tło panelu (nie w przycisk), przytrzymaj spust lub grip i przesuń | wyceluj w tło, uszczypnij i przesuń |
| **Schowaj / pokaż menu** | **Y** na lewym kontrolerze albo przycisk „Schowaj ✕”; schowane menu zostawia małą zakładkę „☰ Menu” w rogu widoku | zakładka „☰ Menu” |
| Chwyć | **spust lub grip** (oba działają tak samo, poza Trybem 1) | uszczypnięcie |
| Skaluj i obracaj (zoom) | chwyć obiema rękami, rozsuń/zsuń dłonie | uszczypnięcie obiema dłońmi |

### Tryb 1 – Model

| Akcja | Jak |
|---|---|
| Złap i przesuń/obróć cały układ | spust jednej ręki |
| Płynny zoom wokół dłoni | **gałka** w górę/dół |
| **Leć do planety / księżyca** | wyceluj promieniem w planetę (etykieta zrobi się żółta) i naciśnij **grip**; potem planeta jest trzymana przed Tobą |
| Puść / złap z powrotem planetę | **B** albo przycisk „Planeta” w menu (puszczona = widok ogólny, planety odlatują po orbitach) |
| Obrót widoku wokół planety | **gałka w lewo/prawo** |
| Czas | przyciski w menu: **◀◀ Wolniej**, **❚❚ Pauza / ▶ Start**, **Szybciej ▶▶** (0,1–365 dni na sekundę); data w statusie |
| Pokaż układ księżyców tej planety | po przylocie naciśnij **grip** na tej samej planecie jeszcze raz |

Skala: od ok. **15 cm** (cały układ w dłoni) do **5 mln ×** (wtedy Ziemia ma ok. 60 cm średnicy).

### Tryby 2 i 4 – Planety, Obiekty i nóż

| Akcja | Jak |
|---|---|
| Złap obiekt z bliska | włóż kontroler w obiekt, naciśnij spust lub grip |
| Złap obiekt z daleka | wyceluj promieniem, naciśnij spust lub grip: obiekt przyleci do ręki |
| **Rzuć** | puść obiekt w ruchu: poleci chwilę i zatrzyma się jak w gęstej cieczy (bez grawitacji) |
| Skaluj/obracaj | złap obiekt obiema rękami (Europę można powiększyć z 2,4 cm do ~1 m) |
| Obróć Słońce | wyceluj w Słońce i obracaj dłonią (za duże, by je przyciągnąć) |
| Tabliczka z danymi i warstwami | pojawia się, gdy wskazujesz lub trzymasz obiekt |
| Nóż wł./wył. | **A** na prawym kontrolerze (albo przycisk „Nóż” w menu) |
| **Cięcie** | lewą ręką trzymaj obiekt, prawą ustaw tarczę noża; żółty okrąg pokazuje linię cięcia. Naciśnij **prawy spust** |
| Sklej | **B** na prawym kontrolerze (albo przycisk „Sklej”) |

### Tryb 3 – Ludziki

| Akcja | Jak |
|---|---|
| **Obracaj planetę** | spust/grip celując w planetę i przeciągnij (jak globus) – złapany punkt idzie za promieniem; albo **gałka lewo/prawo** |
| **Przybliż się / oddal** | **gałka** góra/dół albo obie ręce; planeta rośnie i podchodzi do Ciebie, a Słońce i planety w tle zostają daleko |
| **Kamera za ludzikiem** | **B** (albo przycisk w menu), potem wyceluj promieniem w ludzika i naciśnij **spust** |
| W trybie kamery | **gałka** góra/dół = zoom (4× – 80×), lewo/prawo = obejście ludzika dookoła; **B** = puść ludzika |

### Tryb 5 – Kosmos

| Akcja | Jak |
|---|---|
| Rozglądaj się | galaktyki są wszędzie wokół, także nad i pod Tobą |
| **Pomniejsz / powiększ kosmos** | **gałka** góra/dół albo oba spusty i rozsuwanie dłoni; przy najmocniejszym pomniejszeniu fragment sieci kosmicznej (~300 mln lat św.) jest bryłą ok. 2 m przed Tobą |

### Tryb 6 – Skala

| Akcja | Jak |
|---|---|
| Płynny zoom | **prawa gałka** w górę (przybliżanie) / w dół (oddalanie) |
| Skok do następnego większego / mniejszego obiektu | **A** / **B** (albo przyciski w menu) |
| Prędkość zoomu i skoków | **suwak** w menu (przeciągnij promieniem) |

Napis pod obiektami podaje skalę, np. „1 m w goglach = 2,9 m naprawdę”.

### Tryb 7 – Galaktyka

| Akcja | Jak |
|---|---|
| Lot Galaktyka → Słońce → Ziemia / z powrotem | **gałka** góra/dół, oba spusty i rozsuwanie dłoni, albo przyciski **Do Ziemi** / **Cała Galaktyka** |
| Gdzie jest Ziemia w czasie przelotu? | po prawej (podpis „Ziemia – tu jesteśmy”); Słońce mijasz z lewej strony |
| Obrót Galaktyki | **gałka w lewo/prawo** |
| **Prędkość lotu** | **suwak** w menu (przeciągnij promieniem) |

### Tryb 8 – Grawitacja

| Akcja | Jak |
|---|---|
| Włóż obiekt w siatkę | spust/grip na obiekcie (półka przed Tobą, na dole) i przenieś go w siatkę; poza siatką obiekty jej nie wyginają |
| Siatka 3D / płachta 2D | przycisk w menu (na PC: **S**) |
| Ziemia na orbicie | puść Ziemię blisko Słońca – zacznie je okrążać |

Na panelu menu widać skalę i **FPS** (cel: 72).

---

## Uruchomienie krok po kroku

### A. Szybki test na PC (bez gogli)

1. Zainstaluj **Python 3** (<https://www.python.org/downloads/>, w instalatorze zaznacz „Add Python to PATH”).
2. Pobierz projekt: na stronie repozytorium **Code → Download ZIP** i rozpakuj (albo `git clone`).
3. Otwórz terminal (Windows: w folderze projektu kliknij pasek adresu, wpisz `cmd`, Enter) i wpisz:
   ```
   python -m http.server 8000
   ```
4. W Chrome/Edge otwórz <http://localhost:8000>.
   Zobaczysz układ: myszą obracasz widok, kółkiem przybliżasz, klikasz w przyciski panelu.
   Skróty na PC: **M** = pokaż/schowaj menu; Tryb 1 – **podwójny klik** na planecie = przelot, **+ / −** = zoom układu;
   Tryby 2 i 4 – **C** = przetnij obiekt pod kursorem, **G** = sklej, **T** = rzuć obiekt pod kursorem;
   Tryb 6 – **+ / −** = zoom, **N / P** = następny/poprzedni obiekt, **[ / ]** = prędkość;
   Tryb 7 – **[ / ]** = prędkość lotu; Tryb 3 – **L** = kamera za ludzikiem (potem klik w ludzika), **+ / −** = przybliż, **strzałki** = obrót planety;
   Tryb 8 – **S** = siatka 3D / płachta 2D;
   Tryb 1 – **spacja** = pauza, **, / .** = wolniej/szybciej; Tryb 5 – **+ / −** = zoom.
   > Nie otwieraj `index.html` podwójnym kliknięciem: przeglądarka zablokuje moduły JavaScript, bo plik nie idzie przez serwer.
5. *(Opcjonalnie)* Żeby przetestować VR na PC, zainstaluj w Chrome rozszerzenie
   **Immersive Web Emulator** (od Meta). Pojawi się przycisk ENTER VR i wirtualne kontrolery Questa
   w narzędziach deweloperskich (F12 → zakładka WebXR).

### B. Publikacja na GitHub Pages (WebXR wymaga HTTPS)

1. Repozytorium musi być **publiczne** (GitHub Pages dla prywatnych repo wymaga płatnego planu).
2. Na github.com otwórz repozytorium → **Settings** → **Pages**.
3. W „Build and deployment” wybierz **Source: Deploy from a branch**.
4. **Branch:** wybierz gałąź z kodem (np. `main` po zmergowaniu albo `ccr-b8e0a69c-pyaa3a`), folder **`/ (root)`** → **Save**.
5. Po 1–3 minutach strona będzie pod adresem:
   **`https://tevenenrk.github.io/vr-cosmos/`**
   (status publikacji: zakładka **Actions**).

### C. Test na Meta Quest 3S

1. Załóż gogle, otwórz aplikację **Przeglądarka (Meta Quest Browser)**.
2. Wpisz adres `https://tevenenrk.github.io/vr-cosmos/` (najłatwiej: dodaj zakładkę na PC w tym samym koncie Meta
   albo wpisz ręcznie wirtualną klawiaturą).
3. Kliknij **ENTER VR** na dole strony. Pozwól na dostęp do VR, jeśli przeglądarka zapyta.
4. Układ pojawi się przed Tobą, a panel menu nieco niżej. Złap spustem i baw się.
5. Po zmianach w kodzie odśwież stronę. Jeśli widzisz starą wersję, wyczyść pamięć podręczną przeglądarki
   albo dopisz do adresu `?v=2`.

> **Tip (zaawansowane):** gogle podłączone kablem z włączonym trybem dewelopera mogą otworzyć serwer z PC przez
> `adb reverse tcp:8000 tcp:8000` i adres `http://localhost:8000` (localhost nie wymaga HTTPS).

---

## Konfiguracja

Wszystkie ustawienia są na samej górze pliku **`main.js`** (sekcja `KONFIGURACJA`), m.in.:

| Stała | Znaczenie |
|---|---|
| `SYSTEM_DIAMETER_M` | średnica orbity Plutona przy skali 1 (domyślnie 5 m) |
| `SYSTEM_SCALE_MIN / MAX` | zakres skali Trybu 1 (0,03 = 15 cm, 5e6 = planety jak piłki) |
| `FOCUS_*`, `STICK_ZOOM_RATE` | przelot do planety, zoom gałką |
| `MOONS`, `MOON_*` | księżyce: rozmiary, orbity, kolory; od kiedy są widoczne |
| `MARKER_SIZE_PX`, `BODY_SWITCH_PX` | rozmiar kropek-markerów; od ilu pikseli rysować prawdziwą bryłę |
| `TIME_SPEEDS`, `TIME_SPEED_DEFAULT_INDEX`, `TIME_START_PAUSED` | prędkości czasu w Trybie 1 (dni na sekundę) |
| `ORBIT_ELEMENTS`, `MOON_PERIODS` | mimośrody, peryhelia, doby planet, okresy obiegu księżyców |
| `SPIN_MAX_DEG_S`, `MOON_MAX_DEG_S` | ograniczenie widocznej prędkości obrotu (przy szybkim czasie byłoby migotanie) |
| `USE_REAL_POSITIONS` | planety w przybliżonych pozycjach z dnia uruchomienia |
| `THROW_*` | rzucanie: opór „gęstej cieczy”, maksymalna prędkość |
| `MODE2_*` | Tryb 2: rozmiar Ziemi (reszta w tej samej skali), łuk, położenie Słońca, limity skali |
| `KNIFE_*`, `CUT_*`, `LAYERS` | nóż, przekrój i warstwy wnętrza każdego ciała |
| `MODE3_*` | Tryb 3: średnica planety, liczba/wzrost/prędkość ludzików, kolory |
| `OBJECTS`, `MODE4_*`, `PULSAR_*`, `BLACK_HOLE_*` | Tryb 4: lista obiektów, rozmiary, animacje |
| `GALAXY_*`, `WEB_*`, `WEB3D_*`, `MODE5_*` | Tryb 5: galaktyki wokół, tło, trójwymiarowy fragment sieci, zakres zoomu |
| `MODE3_BEHAVIOR`, `MODE3_CLOUD_*`, `MODE3_MINI_COSMOS`, `MODE3_YEAR_S` | Tryb 3: czynności ludzików (szanse, czasy), chmurki, Słońce i planetki w tle, długość „roku” |
| `MODE3_VILLAGES`, `MODE3_HOUSES_PER_VILLAGE`, `MODE3_HOME_SHARE`, `MODE3_VOLCANO`, `MODE3_STORM`, `MODE3_MOON` | Tryb 3: wioski z domkami, wulkan, burza, księżyc i satelita (`false` = wyłącz) |
| `MODE3_FOLLOW_SCALE`, `MODE3_FOLLOW_DISTANCE_M`, `MODE3_FOLLOW_DROP_M` | Tryb 3: kamera za ludzikiem (powiększenie, odległość ludzika od Ciebie) |
| `MODE3_PLANET_DETAIL`, `MODE3_SEA_LEVEL`, `MODE3_MOUNTAIN_HEIGHT`, `MODE3_TREE_COUNT` | Tryb 3: wygląd planety generowanej w kodzie (`MODE3_USE_MODEL_PLANET_FILE = true` – planeta z pliku) |
| `MW_*` | Tryb 7: liczba gwiazd, rozmiar na starcie, pochylenie, prędkość zoomu (`MW_SPEED_MIN/MAX` – zakres suwaka), `MW_FLY_LOG`/`MW_FLY_LENGTH` – przelot obok Słońca, `MW_NEAR_*` – gwiazdy sąsiedztwa, `MW_SKY_M` – sfera nieba |
| `MODE3_ORBIT_RADIUS_M`, `MODE3_SUN_RADIUS_M`, `MODE3_YEAR_S` | Tryb 3: jak daleko jest Słońce, jak duże, ile trwa rok planety |
| `ST_*` | Tryb 8: rozmiar i gęstość siatki, jasność linii, wysokość płachty, okres orbity Ziemi |
| `MODEL_FILES`, `PERSON_*` | pliki modeli 3D; nazwa animacji chodu i obrót modelu ludzika |
| `SCALE_*`, `SCALE_OBJECTS` | Tryb 6: lista obiektów (rozmiar, opis), progi znikania, prędkość zoomu |
| `MENU_*` | panel menu: rozmiar, odległość, położenie zakładki schowanego menu |
| `MENU_TOGGLE_BUTTON`, `FOCUS_BUTTON`, `KNIFE_BUTTON`, `RESET_BUTTON` | przypisanie przycisków kontrolerów |
| `FRAMEBUFFER_SCALE`, `FOVEATION`, `SPHERE_SEGMENTS_*` | wydajność |
| `BODIES` | dane ciał: promienie, odległości, kolory, nazwy plików tekstur |

## Jak to działa

- Cały układ to jedna `THREE.Group`. 1 j.a. = 2,5 m / 39,48 przy skali 1. **Promienie i odległości są w tej samej,
  rzeczywistej skali**, dlatego planety są mikroskopijne (średnica Ziemi to ok. 0,005 mm przy skali 1).
- Co klatkę liczony jest rozmiar każdej bryły w pikselach (z kąta widzenia i rozdzielczości gogli).
  Jeśli bryła ma ponad 1 px, rysowana jest kula z teksturą, a jeśli mniej, świecąca kropka stałej wielkości.
- Orbity planet są elipsami (Słońce w ognisku, położenie z równania Keplera) w jednej płaszczyźnie; księżyce
  krążą w płaszczyźnie równika swojej planety (np. przechylony Uran). Przy przyspieszonym czasie prędkości
  obrotu i obiegu księżyców są ograniczone do kilkudziesięciu stopni na sekundę, żeby nie migotały.
- Etykiety mają stały rozmiar kątowy. Gdy kilka ciał nakłada się w polu widzenia, wygrywają ważniejsze
  (Słońce, potem planety zewnętrzne).
- Przelot do planety zmienia skalę logarytmicznie, więc zoom ×10 000 wygląda płynnie. Przy bardzo dużej skali orbity
  planet są ukrywane, bo z bliska i tak byłyby prostymi liniami.
- **Warstwy wnętrza** są w prawdziwych proporcjach, np. skorupa Ziemi ma ok. 0,5% promienia, dlatego na przekroju
  jest cienką linią. Źródła: sejsmologia Ziemi, Księżyca (Apollo) i Marsa (InSight 2023: ciekłe jądro ~1675 km
  z warstwą stopionych krzemianów), Juno i Cassini (rozmyte jądra Jowisza i Saturna), Galileo i Cassini (oceany
  Europy, Ganimedesa, Tytana, Enceladusa), New Horizons (Pluton). Warstwy niepewne mają w nazwie „(?)”.
  Tabliczka podaje głębokość każdej warstwy w km.
- **Rzucanie:** z ruchu obiektu w ostatnich 0,1 s liczona jest prędkość i obrót. Potem prędkość maleje
  wykładniczo (`THROW_DRAG`), co daje wrażenie gęstej cieczy bez grawitacji.
- **Kosmos (Tryb 5):** galaktyki to obrazki narysowane w kodzie, po 1 wywołaniu rysowania na rodzaj (spiralne,
  z poprzeczką, eliptyczne, nieregularne). Tło to jedna kula z teksturą 4096×2048. Sieć kosmiczna (90 gromad,
  ~90 000 punktów) jest wygenerowana w 3D i raz „sfotografowana” na niebo przy starcie, więc w goglach to tylko
  obrazek i nic nie kosztuje.
- **Nóż (Tryby 2 i 4):** bez geometrii boolowskiej. Planeta jest zastępowana dwoma klonami z przeciwnymi płaszczyznami
  przycinającymi (`renderer.localClippingEnabled`). W miejscu cięcia leży płaska tarcza z koncentrycznymi warstwami
  (skorupa, płaszcz, jądro). Ich promienie są liczone dla odległości płaszczyzny od środka, więc cięcie z boku
  pokazuje tylko zewnętrzne warstwy.
- **Ludziki (Tryb 3):** 3 obiekty `InstancedMesh` (nogi, tułów, głowa) to 3 wywołania rysowania dla wszystkich
  ludzików. Każdy idzie po wielkim kole planety z lekkim losowym skręcaniem. Są dziećmi planety, więc skalują się
  i obracają razem z nią.
- Wydajność: `logarithmicDepthBuffer` (ogromny zakres skali), brak cieni, mało segmentów kul w Trybie 1,
  foveation, kilkadziesiąt wywołań rysowania na klatkę.

- **Tryb 6:** zamiast przesuwać kamerę, aplikacja skaluje obiekty. `log10(ile metrów naprawdę = 1 m w goglach)`
  zmienia się płynnie. Obiekty stoją na łuku: każdy zajmuje tyle stopni, ile wynosi jego rozmiar kątowy, więc się
  nie zasłaniają, a większe stoją dalej. Obiekty mniejsze niż 4 mm i większe niż 60 m (w goglach) płynnie znikają.
- **Planeta w Trybie 3** to ikosfera (~83 tys. trójkątów) wypchnięta szumem fraktalnym: wysokość decyduje o kolorze
  (plaża, łąka, las, skały, śnieg), poniżej poziomu morza jest ocean. Wysokość gruntu pod ludzikami liczy się
  wprost z tego samego wzoru. Machanie, kucanie i gestykulacja przy rozmowie to obroty kości szkieletu Mixamo
  dokładane do animacji stania (plik nie ma takich animacji).
- **Tryb 7:** każda warstwa (Galaktyka, sąsiedztwo Słońca, Układ Słoneczny z Ziemią) ma własną skalę i jest ustawiona tak,
  żeby punkt zoomu (Słońce, a po przelocie Ziemia) był przed Tobą, więc liczby zmiennoprzecinkowe nie tracą dokładności
  przy zoomie ×10¹³. Gwiazdy dalej niż 3 km (w goglach) shader rysuje na sferze nieba w tym samym kierunku – stąd pas
  Drogi Mlecznej z bliska Ziemi. Gwiazdy sąsiedztwa mają „rangę”: przy przybliżaniu pokazuje się ich coraz więcej,
  a brzeg obszaru jest rozmyty, więc ich gęstość płynnie przechodzi w gęstość reszty Galaktyki.
- **Tryb 8:** linie siatki są wyginane w shaderze wierzchołków (do 6 mas naraz): w 3D punkty przestrzeni są
  ściągane w stronę mas, na płachcie głębokość lejka to potencjał grawitacyjny; fale grawitacyjne to dwuramienna
  spirala rozchodząca się od pary czarnych dziur.
- **Ludziki na planecie z modelu (opcjonalnie):** trójkąty planety są posortowane w siatkę 128 × 64 kierunków, więc „promień od
  środka” sprawdza tylko kilkadziesiąt trójkątów. Model jest dwuwarstwową skorupą, więc grunt to drugie trafienie.
  Woda jest rozpoznawana po kolorze tekstury (niebieskie = morze).

## Struktura plików

```
index.html          – strona startowa (przycisk ENTER VR, import three.js)
main.js             – cała aplikacja; konfiguracja na górze pliku
lib/                – three.js r170 + dodatki (VRButton, OrbitControls, GLTFLoader, SkeletonUtils), licencja MIT
models/             – modele 3D .glb (patrz models/README.md)
textures/           – tekstury planet (patrz textures/README.md)
```

## Źródła i licencje

- **three.js** r170, licencja MIT (`lib/LICENSE-three.txt`).
- **Tekstury:** Solar System Scope (<https://www.solarsystemscope.com/textures/>), licencja **CC BY 4.0**.
  Pluton: NASA/JHUAPL/SwRI (New Horizons), domena publiczna.
  Plików tekstur nie ma w repozytorium. Jak je pobrać i nazwać, opisuje [`textures/README.md`](textures/README.md).
  Bez nich aplikacja działa na kolorowych teksturach zastępczych.
- **Modele 3D:** Ziemia, mała planeta i ludzik (animacje Mixamo) wygenerowane w Meshy AI (pliki od autora projektu), uproszczone
  narzędziem gltf-transform.
- **Dane planet:** NASA Planetary Fact Sheet (<https://nssdc.gsfc.nasa.gov/planetary/factsheet/>).
