# Tekstury planet

Wrzuć tu pliki tekstur o **dokładnie takich nazwach** (wielkość liter ma znaczenie na GitHub Pages).
Jeśli któregoś pliku brakuje, aplikacja działa dalej i używa prostej, kolorowej tekstury zastępczej.

| Plik                        | Ciało              | Skąd pobrać |
|-----------------------------|--------------------|-------------|
| `2k_sun.jpg`                | Słońce             | Solar System Scope |
| `2k_mercury.jpg`            | Merkury            | Solar System Scope |
| `2k_venus_atmosphere.jpg`   | Wenus (chmury)     | Solar System Scope |
| `2k_earth_daymap.jpg`       | Ziemia             | Solar System Scope |
| `2k_mars.jpg`               | Mars               | Solar System Scope |
| `2k_jupiter.jpg`            | Jowisz             | Solar System Scope |
| `2k_saturn.jpg`             | Saturn             | Solar System Scope |
| `2k_saturn_ring_alpha.png`  | Pierścienie Saturna| Solar System Scope |
| `2k_uranus.jpg`             | Uran               | Solar System Scope |
| `2k_neptune.jpg`            | Neptun             | Solar System Scope |
| `2k_pluto.jpg`              | Pluton             | NASA (patrz niżej) |
| `2k_moon.jpg`               | Księżyc            | Solar System Scope |

## Solar System Scope (CC BY 4.0)
1. Wejdź na <https://www.solarsystemscope.com/textures/>.
2. Przy każdej planecie kliknij wersję **2K** (2048×1024). Pliki mają już właściwe nazwy (np. `2k_mars.jpg`).
3. Licencja CC BY 4.0 wymaga podania autora. W README projektu jest już wpis:
   „Tekstury: Solar System Scope (solarsystemscope.com), CC BY 4.0”.

Chcesz powierzchnię Wenus zamiast chmur? Pobierz `2k_venus_surface.jpg` i zmień nazwę na `2k_venus_atmosphere.jpg`
albo popraw nazwę w tablicy `BODIES` w `main.js`.

## Pluton (NASA)
Solar System Scope nie ma Plutona. Użyj mapy z misji New Horizons (NASA/JHUAPL/SwRI, domena publiczna), np.
z <https://science.nasa.gov/> (szukaj „Pluto global map”) albo z USGS Astrogeology
(„Pluto New Horizons Global Mosaic”). Zmniejsz ją do 2048×1024 (np. w darmowym <https://www.photopea.com/>),
zapisz jako JPG i nazwij `2k_pluto.jpg`.

## Jak wrzucić pliki na GitHub (bez wiersza poleceń)
Otwórz repozytorium na github.com, wejdź do folderu `textures`, kliknij **Add file → Upload files**,
przeciągnij pliki i kliknij **Commit changes** (na tej samej gałęzi, z której działa GitHub Pages).
