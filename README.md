# Układ Słoneczny VR (WebXR, Meta Quest 3 / 3S)

Interaktywny Układ Słoneczny w goglach VR, działający w przeglądarce **Meta Quest Browser**.
Nie trzeba nic instalować w goglach: wystarczy otworzyć stronę i kliknąć **ENTER VR**.

Trzy tryby (przełączane na panelu menu):

- **Tryb 1 – Model:** cały układ do orbity Plutona w prawdziwej skali, z księżycami i pierścieniami.
  Można go trzymać w dłoni albo dolecieć do pojedynczej planety i oglądać ją z bliska.
- **Tryb 2 – Planety:** Słońce i 8 planet obok siebie. Można je chwytać, skalować i **przecinać nożem**,
  żeby zobaczyć warstwy wnętrza.
- **Tryb 3 – Ludziki:** planeta o średnicy 1 m, po której chodzi 30 ludzików (1 cm wzrostu). Obracasz ją
  i powiększasz, a ludziki rosną razem z nią.

---

## Sterowanie

Wspólne dla wszystkich trybów:

| Akcja | Kontrolery | Dłonie (hand tracking) |
|---|---|---|
| Przycisk w menu | wyceluj promieniem w panel, naciśnij spust | wyceluj, uszczypnij |
| Przywołaj menu przed siebie | **Y** na lewym kontrolerze | – (menu samo wraca, gdy odejdziesz > 2,5 m) |
| Skaluj i obracaj (zoom) | spusty obu rąk, rozsuń/zsuń dłonie | uszczypnięcie obiema dłońmi |

### Tryb 1 – Model

| Akcja | Jak |
|---|---|
| Złap i przesuń/obróć cały układ | spust jednej ręki |
| Płynny zoom wokół dłoni | **gałka** w górę/dół |
| **Leć do planety / księżyca** | wyceluj promieniem w planetę (etykieta zrobi się żółta) i naciśnij **grip** (ściśnięcie) |
| Pokaż układ księżyców tej planety | po przylocie naciśnij **grip** na tej samej planecie jeszcze raz |

Skala: od ok. **15 cm** (cały układ w dłoni) do **5 mln ×** (wtedy Ziemia ma ok. 60 cm średnicy).
Planety i księżyce mają prawdziwe rozmiary, więc z daleka są niewidoczne. Pokazuje je świecąca kropka,
a gdy przybliżysz, pojawia się kula w kolorze planety. Księżyce (np. Księżyc, Io, Europa, Tytan, Charon)
i ich orbity pokazują się dopiero, gdy podlecisz do ich planety. Pierścienie mają Saturn (wyraźne)
oraz Jowisz, Uran i Neptun (słabe).

### Tryb 2 – Planety i nóż

| Akcja | Jak |
|---|---|
| Złap planetę z bliska | włóż kontroler w planetę i naciśnij spust |
| Złap planetę z daleka | wyceluj promieniem i naciśnij spust: planeta przyleci do ręki |
| Skaluj/obracaj planetę | złap ją obiema rękami |
| Tabliczka z ciekawostkami | pojawia się, gdy wskazujesz lub trzymasz planetę |
| Nóż wł./wył. | **A** na prawym kontrolerze (albo przycisk „Nóż” w menu) |
| **Cięcie** | lewą ręką trzymaj planetę, prawą ustaw tarczę noża; żółty okrąg pokazuje linię cięcia. Naciśnij **prawy spust** |
| Rozsuń połówki | każdą połówkę chwytasz osobno (lewa ręka trzyma swoją połówkę dalej) |
| Sklej planety | **B** na prawym kontrolerze (albo przycisk „Sklej” w menu) |

### Tryb 3 – Ludziki

| Akcja | Jak |
|---|---|
| Obracaj planetę jak globus | złap spustem dowolnie i przeciągnij |
| Skaluj i przesuwaj | spusty obu rąk (0,3× – 40×) |

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
   Skróty na PC: Tryb 1 – **podwójny klik** na planecie = przelot, **+ / −** = zoom układu;
   Tryb 2 – **C** = przetnij planetę pod kursorem, **G** = sklej.
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
| `TIME_SPEED_DAYS_PER_SEC` | prędkość czasu: 0 = model statyczny, np. 30 = planety krążą |
| `USE_REAL_POSITIONS` | planety w przybliżonych pozycjach z dnia uruchomienia |
| `MODE2_*` | Tryb 2: rozmiar Ziemi, skala „edukacyjna” (pierwiastek), łuk, limity skali |
| `KNIFE_*`, `CUT_*`, `LAYERS` | nóż, przekrój i proporcje warstw wnętrza każdej planety |
| `MODE3_*` | Tryb 3: średnica planety, liczba/wzrost/prędkość ludzików, kolory |
| `MENU_SUMMON_BUTTON`, `FOCUS_BUTTON`, `KNIFE_BUTTON`, `RESET_BUTTON` | przypisanie przycisków kontrolerów |
| `FRAMEBUFFER_SCALE`, `FOVEATION`, `SPHERE_SEGMENTS_*` | wydajność |
| `BODIES` | dane ciał: promienie, odległości, kolory, nazwy plików tekstur |

## Jak to działa

- Cały układ to jedna `THREE.Group`. 1 j.a. = 2,5 m / 39,48 przy skali 1. **Promienie i odległości są w tej samej,
  rzeczywistej skali**, dlatego planety są mikroskopijne (średnica Ziemi to ok. 0,005 mm przy skali 1).
- Co klatkę liczony jest rozmiar każdej bryły w pikselach (z kąta widzenia i rozdzielczości gogli).
  Jeśli bryła ma ponad 1 px, rysowana jest kula z teksturą, a jeśli mniej, świecąca kropka stałej wielkości.
- Orbity planet są okrągłe i leżą w jednej płaszczyźnie; księżyce krążą w płaszczyźnie równika swojej planety (np. przechylony Uran). Model jest statyczny.
- Etykiety mają stały rozmiar kątowy. Gdy kilka ciał nakłada się w polu widzenia, wygrywają ważniejsze
  (Słońce, potem planety zewnętrzne).
- Przelot do planety zmienia skalę logarytmicznie, więc zoom ×10 000 wygląda płynnie. Przy bardzo dużej skali orbity
  planet są ukrywane, bo z bliska i tak byłyby prostymi liniami.
- **Nóż (Tryb 2):** bez geometrii boolowskiej. Planeta jest zastępowana dwoma klonami z przeciwnymi płaszczyznami
  przycinającymi (`renderer.localClippingEnabled`). W miejscu cięcia leży płaska tarcza z koncentrycznymi warstwami
  (skorupa, płaszcz, jądro). Ich promienie są liczone dla odległości płaszczyzny od środka, więc cięcie z boku
  pokazuje tylko zewnętrzne warstwy.
- **Ludziki (Tryb 3):** 3 obiekty `InstancedMesh` (nogi, tułów, głowa) to 3 wywołania rysowania dla wszystkich
  ludzików. Każdy idzie po wielkim kole planety z lekkim losowym skręcaniem. Są dziećmi planety, więc skalują się
  i obracają razem z nią.
- Wydajność: `logarithmicDepthBuffer` (ogromny zakres skali), brak cieni, mało segmentów kul w Trybie 1,
  foveation, kilkadziesiąt wywołań rysowania na klatkę.

## Struktura plików

```
index.html          – strona startowa (przycisk ENTER VR, import three.js)
main.js             – cała aplikacja; konfiguracja na górze pliku
lib/                – three.js r170 (lokalna kopia, licencja MIT)
textures/           – tekstury planet (patrz textures/README.md)
```

## Źródła i licencje

- **three.js** r170, licencja MIT (`lib/LICENSE-three.txt`).
- **Tekstury:** Solar System Scope (<https://www.solarsystemscope.com/textures/>), licencja **CC BY 4.0**.
  Pluton: NASA/JHUAPL/SwRI (New Horizons), domena publiczna.
  Plików tekstur nie ma w repozytorium. Jak je pobrać i nazwać, opisuje [`textures/README.md`](textures/README.md).
  Bez nich aplikacja działa na kolorowych teksturach zastępczych.
- **Dane planet:** NASA Planetary Fact Sheet (<https://nssdc.gsfc.nasa.gov/planetary/factsheet/>).
