# Modele 3D

| Plik | Do czego | Skąd |
|---|---|---|
| `earth.glb` | Ziemia we wszystkich trybach (1, 2, 4, 6) | Meshy AI („Earth from Space”), uproszczony: 340 tys. → 30 tys. trójkątów, 3,6 MB |
| `small_planet.glb` | planeta z ludzikami (Tryb 3) | Meshy AI („small planet”), uproszczony: 636 tys. → 76 tys. trójkątów, 4,6 MB |
| `person.glb` | ludzik ze szkieletem i animacją chodu (Tryb 3 i człowiek w Trybie 6) | **jeszcze nie ma** – patrz niżej |

Jeśli któregoś pliku brakuje, aplikacja działa dalej: rysuje proste kształty z kodu.

## Ludzik (`person.glb`)
- Format: `.glb` ze szkieletem (rig) i animacją chodu. Animacja jest wybierana po nazwie zawierającej „walk”
  (stała `PERSON_ANIMATION` w `main.js`); jeśli takiej nie ma, użyta zostanie pierwsza.
- Wzrost i ustawienie stóp na ziemi są dopasowywane automatycznie. Jeśli ludzik „idzie bokiem”, zmień
  `PERSON_MODEL_YAW_DEG` (np. 90 lub 180).
- Na planecie chodzi 30 kopii, więc model musi być lekki: najlepiej **do ~10 tys. trójkątów** i tekstura 1K.

## Jak zmniejszyć model (Quest ma ograniczoną moc)
Użyłem darmowego narzędzia **gltf-transform** (wymaga Node.js):
```
npx @gltf-transform/cli simplify wejście.glb uproszczony.glb --ratio 0.1 --error 0.004
npx @gltf-transform/cli jpeg uproszczony.glb wynik.glb --quality 82
npx @gltf-transform/cli resize wynik.glb wynik-1k.glb --width 1024 --height 1024   # opcjonalnie: mniejsze tekstury
```
Bez instalowania czegokolwiek można to zrobić w przeglądarce na <https://gltf.report/> (zakładka „Script”).
