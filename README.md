# Arpie — sito con Stella

Sito statico per GitHub Pages. Una scena illustrata al giorno: Stella parla nella
vignetta stile gioco, a fine dialogo alcuni oggetti nascosti nella scena diventano
cliccabili e aprono un overlay.

## Come funziona

- `index.html` + `style.css` + `main.js` → il motore, non si tocca mai.
- `days/index.json` → l'elenco delle date pubblicate.
- `days/AAAA-MM-GG/` → una cartella per ogni giorno.
- `assets/speakers.json` + `assets/faces/` → i personaggi che parlano (una faccia ciascuno).

Il sito legge la data di oggi (fuso Italia) e carica il giorno corrispondente.
Se oggi non c'è, mostra **l'ultimo giorno disponibile**: saltare un giorno non rompe nulla.
I giorni futuri presenti nel repo non sono raggiungibili dalla navigazione.
Dal pulsante ✴ in alto a destra si apre l'archivio dei giorni passati.

## Aggiungere un nuovo giorno (il lavoro quotidiano)

1. Crea la cartella `days/AAAA-MM-GG/` con dentro:
   - `scene.png` — l'illustrazione, **1920×1080** (16:9, sempre).
   - un PNG per ogni oggetto interattivo, **stesse dimensioni della scena
     (1920×1080), tutto trasparente tranne l'oggetto al suo posto**.
     Da Figma/Photoshop: esporta il livello dell'oggetto con il canvas intero.
   - `day.json` (copia quello di un giorno precedente e modificalo):

```json
{
  "scene": "scene.png",
  "dialogue": [
    { "speaker": "stella", "text": "Prima battuta..." },
    { "speaker": "stella", "text": "Seconda battuta..." }
  ],
  "objects": [
    {
      "id": "nome-oggetto",
      "image": "obj-nome.png",
      "overlay": { "html": "<h2>Titolo</h2><p>Contenuto...</p>" }
    }
  ]
}
```

   - `objects` può essere vuoto (`[]`): giorno senza oggetti, va benissimo.
   - In alternativa a `"html"` si può usare `"file": "contenuto.html"` per
     tenere il contenuto dell'overlay in un file separato nella cartella del giorno.
   - Le immagini dentro l'overlay vanno riferite con il percorso completo,
     es. `<img src="days/2026-07-06/foto.jpg">`.

2. Aggiungi la data a `days/index.json`.

3. Commit e push. Fatto.

## Aggiungere un personaggio che parla

In `assets/speakers.json`:

```json
"milla": { "name": "milla", "face": "assets/faces/milla.png" }
```

e metti la faccia (quadrata, ~240×240) in `assets/faces/`.

## Testare in locale

Serve un piccolo server (i `fetch` non funzionano aprendo il file direttamente):

```
cd cartella-del-sito
python3 -m http.server 8000
```

poi apri `http://localhost:8000`. Per vedere un giorno specifico:
`http://localhost:8000/?day=2026-07-05` (solo date già pubblicate).

## Pubblicare su GitHub Pages

Una volta sola:

1. Crea un repo su GitHub (es. `arpie-sito`).
2. Nella cartella del sito:
   ```
   git init
   git add .
   git commit -m "primo giorno"
   git branch -M main
   git remote add origin https://github.com/TUOUSER/arpie-sito.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Source: Deploy from a branch → main / root**.
4. L'URL sarà `https://TUOUSER.github.io/arpie-sito/`.

Da lì in poi: aggiungi la cartella del giorno, aggiorna `index.json`, push.

## Nota sulla privacy dei giorni futuri

Con GitHub Pages gratuito il repo è pubblico: chi guarda il codice vede anche i
giorni caricati in anticipo (il sito non li mostra, ma i file esistono).
Opzioni, dalla più semplice:

1. **Accettarlo** — chi va a frugare nel repo si merita lo spoiler.
2. **Non caricare in anticipo** — push la mattina stessa.
3. **Repo privato + GitHub Pro** (~4€/mese) — Pages da repo privato.
4. **Due repo** (privato per i contenuti + pubblico per il sito, con una GitHub
   Action che pubblica ogni giorno a mezzanotte) — la soluzione pulita, ma va
   configurata; da fare in un secondo momento se serve davvero.
