# Modele 3D

| Plik | Do czego | Skąd |
|---|---|---|
| `earth.glb` | Ziemia we wszystkich trybach (1, 2, 4, 6) | Meshy AI („Earth from Space”), uproszczony: 340 tys. → 30 tys. trójkątów, 3,6 MB |
| `small_planet.glb` | planeta z ludzikami (Tryb 3) | Meshy AI („small planet”), uproszczony: 636 tys. → 76 tys. trójkątów, 4,6 MB |
| `person.glb` | ludzik ze szkieletem: chód (Tryb 3) i stanie (człowiek w Trybie 6) | Meshy AI „Industrial Technician” (release `ludz`), 83 MB → 1,1 MB: tekstura 8192² PNG → 1024² JPEG, 33 tys. → 10 tys. trójkątów, zostawione animacje `Walking` i `Idle_11`, materiał matowy (było: metal) |

Jeśli któregoś pliku brakuje, aplikacja działa dalej: rysuje proste kształty z kodu.

## Ludzik (`person.glb`)
- Format: `.glb` ze szkieletem (rig) i animacją chodu. Animacja jest wybierana po nazwie zawierającej „walk”
  (stała `PERSON_ANIMATION` w `main.js`); jeśli takiej nie ma, użyta zostanie pierwsza.
- Wzrost i ustawienie stóp na ziemi są dopasowywane automatycznie. Jeśli ludzik „idzie bokiem”, zmień
  `PERSON_MODEL_YAW_DEG` (np. 90 lub 180).
- Na planecie chodzi 30 kopii, więc model musi być lekki: najlepiej **do ~10 tys. trójkątów** i tekstura 1K.
- Nowego ludzika najłatwiej podmienić, dodając plik do Release na GitHubie (jak `ludz`) – przygotuję go tak samo.

## Jak zmniejszyć model (Quest ma ograniczoną moc)
Użyłem darmowego narzędzia **gltf-transform** (wymaga Node.js):
```
npx @gltf-transform/cli simplify wejście.glb uproszczony.glb --ratio 0.1 --error 0.004
npx @gltf-transform/cli jpeg uproszczony.glb wynik.glb --quality 82
npx @gltf-transform/cli resize wynik.glb wynik-1k.glb --width 1024 --height 1024   # opcjonalnie: mniejsze tekstury
```
Bez instalowania czegokolwiek można to zrobić w przeglądarce na <https://gltf.report/> (zakładka „Script”).
