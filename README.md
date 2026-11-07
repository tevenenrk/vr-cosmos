# Układ Słoneczny VR (WebXR, Meta Quest 3 / 3S)

Interaktywny Układ Słoneczny w goglach VR, działający w przeglądarce **Meta Quest Browser**.
Nie trzeba nic instalować w goglach: wystarczy otworzyć stronę i kliknąć **ENTER VR**.

**Etap 1 (gotowy):** Tryb 1 – model całego układu do orbity Plutona.
**Etap 2 (w przygotowaniu):** Tryb 2 – duże modele planet + „nóż” do przecinania.

---

## Sterowanie (Tryb 1)

| Akcja | Kontrolery | Dłonie (hand tracking) |
|---|---|---|
| Złap i przesuń/obróć cały układ | spust jednej ręki | uszczypnięcie (kciuk + palec wskazujący) |
| Skaluj i obracaj (zoom) | spusty obu rąk, rozsuń/zsuń dłonie | uszczypnięcie obiema dłońmi |
| Przycisk w menu | wyceluj promieniem w panel, naciśnij spust | wyceluj, uszczypnij |
| Przywołaj menu przed siebie | **Y** na lewym kontrolerze | – (menu samo wraca, gdy odejdziesz > 2,5 m) |

Skala: od ok. **15 cm** (cały układ w dłoni) do **500×** (orbita Plutona ma 2,5 km, a Ty stoisz w środku).
Jak „wlecieć” do planety: zmniejsz układ, przyłóż wybraną planetę między dłonie i rozsuń ręce.
Powiększanie działa wokół punktu między dłońmi.

Na panelu menu widać aktualną skalę, średnicę orbity Plutona i **FPS** (cel: 72).

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
| `SYSTEM_SCALE_MIN / MAX` | zakres skali (0,03 = 15 cm, 500 = 2,5 km) |
| `MARKER_SIZE_PX`, `BODY_SWITCH_PX` | rozmiar kropek-markerów; od ilu pikseli rysować prawdziwą bryłę |
| `TIME_SPEED_DAYS_PER_SEC` | prędkość czasu: 0 = model statyczny, np. 30 = planety krążą |
| `USE_REAL_POSITIONS` | planety w przybliżonych pozycjach z dnia uruchomienia |
| `MENU_SUMMON_BUTTON`, `KNIFE_BUTTON`, `RESET_BUTTON` | przypisanie przycisków kontrolerów |
| `FRAMEBUFFER_SCALE`, `FOVEATION`, `SPHERE_SEGMENTS_*` | wydajność |
| `BODIES` | dane ciał: promienie, odległości, kolory, nazwy plików tekstur |

## Jak to działa (Tryb 1)

- Cały układ to jedna `THREE.Group`. 1 j.a. = 2,5 m / 39,48 przy skali 1. **Promienie i odległości są w tej samej,
  rzeczywistej skali**, dlatego planety są mikroskopijne (średnica Ziemi to ok. 0,005 mm przy skali 1).
- Co klatkę liczony jest rozmiar każdej bryły w pikselach (z kąta widzenia i rozdzielczości gogli).
  Jeśli bryła ma ponad 1 px, rysowana jest kula z teksturą, a jeśli mniej, świecąca kropka stałej wielkości.
- Orbity są okrągłe i leżą w jednej płaszczyźnie. Model jest statyczny.
- Etykiety mają stały rozmiar kątowy. Gdy kilka ciał nakłada się w polu widzenia, wygrywają ważniejsze
  (Słońce, potem planety zewnętrzne).
- Wydajność: `logarithmicDepthBuffer` (ogromny zakres skali), brak cieni, kule 32×16 segmentów, foveation,
  kilkadziesiąt wywołań rysowania na klatkę.

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
