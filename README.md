# Stella Daily — sito del collettivo Arpie

Documento unico del progetto: cos'è, come funziona, come si aggiorna, come si pubblica e a che punto siamo. Aggiornato all'**11 luglio 2026**.

- Repo GitHub: https://github.com/paulore00/Stella (remote collegato, manca il primo push)
- Figma contenuti: https://www.figma.com/design/yVcNQVvis5Gr4ELnMdQBol/Stella-Daily-Sito — la pagina "giornate" è troppo grande per la lettura automatica via connettore: testi e immagini vanno passati a mano, oppure mandando i **link ai singoli frame** (tasto destro → Copy link to selection)
- Musiche: cartella Drive "musiche" di Sara — https://drive.google.com/drive/folders/1Clkwmm17gbc3DFdZIhJisfwlTpXz0JRv

## Cos'è

Un sito statico: ogni giornata è una scena illustrata fissa 16:9 (1920×1080) in cui **Stella** (e altri personaggi) parlano in una vignetta stile videogioco con effetto typewriter. A fine dialogo alcuni **oggetti nascosti** nella scena diventano cliccabili: il click apre un'**illustrazione** che si sovrappone alla scena e si chiude cliccando ovunque. Ogni giornata ha la **sua canzone in loop**.

## Regola numero uno

**I testi delle ragazze non si toccano.** Le battute nei `day.json` vanno incollate esattamente come scritte su Figma, senza riformulazioni. I segnaposto sono sempre marcati `[... DA FIGMA]`.

## Struttura delle cartelle

- `index.html`, `style.css`, `main.js` — il motore, non si tocca.
- `Days/` — i contenuti (è la cartella che il motore legge).
  - `index.json` — elenco delle giornate pubblicate (`giorno_1`, `giorno_2`, …).
  - `giorno_N/` — una cartella per giornata. **I nomi dei file seguono la convenzione ed è il motore a trovarli da solo**:
    - `giorno_N_illustrazione.png` — la scena, 1920×1080.
    - `giorno_N_illustrazione_1.png` + `giorno_N_illustrazione_2.png` — giornata a **due illustrazioni**: il dialogo si svolge sulla `_1`, a fine dialogo la scena passa alla `_2` ed è lì che gli oggetti compaiono e diventano cliccabili (nel `day.json` vanno indicate con `"scene"` e `"sceneEnd"`).
    - `giorno_N_musica.mp3` — la canzone della giornata (loop).
    - `giorno_N_<oggetto>.png` — un PNG per oggetto interattivo, **full-frame 1920×1080, trasparente tranne l'oggetto al suo posto**.
    - `giorno_N_illustrazione_<oggetto>.png` — l'illustrazione che appare cliccando l'oggetto, full-frame 1920×1080.
    - `day.json` — dialoghi ed elenco oggetti (vedi sotto).
  - `Giorno_1.png`, `Giorno_2.png`, `Giorno_2_Oggetti.png` — export grezzi originali, backup non usati dal sito.
- `assets/`
  - `logo.png` — logo Stella Daily, fisso in alto a sinistra sopra tutto.
  - `STELLADAILY-REGULAR.TTF` — font del progetto.
  - `speakers.json` — personaggi → box di dialogo.
  - `speak_tab/<nome>_tab.png` — box di dialogo per personaggio (faccia + nome + freccetta, tutto nel PNG). Ci sono già: stella, francesca, giovanni, delia, nicolò, edoardo, daniela, r.
  - `fine_discorso.png` — riquadro di fine dialogo.

## Formato day.json

```json
{
  "title": "Giorno 2",
  "dialogue": [
    { "speaker": "stella", "text": "Prima battuta..." },
    { "speaker": "francesca", "text": "Battuta di un altro personaggio..." }
  ],
  "objects": [
    { "id": "diario" },
    { "id": "collanina" }
  ]
}
```

- Per ogni oggetto basta l'`id`: il motore cerca da solo `giorno_N_<id>.png` (l'oggetto) e `giorno_N_illustrazione_<id>.png` (il click). Stessa cosa per scena e musica. **Quindi: i file esportati con i nomi giusti si buttano nella cartella e fine, senza rinominare niente.**
- **Due o più persone che parlano**: basta cambiare `"speaker"` battuta per battuta, il box si scambia da solo. I nomi validi sono le chiavi di `assets/speakers.json`.
- `objects` può essere `[]` (giornata senza oggetti).
- Se manca `giorno_N_musica.mp3` la giornata è muta e il pulsante ♪ non compare. Se manca l'illustrazione di un oggetto, il click non apre nulla (e avvisa nella console).
- Volendo si può forzare un nome diverso con `"scene"`, `"music"`, `"image"` o `"overlay": { "image": ... }` — normalmente non serve.
- **Giornata a due illustrazioni**: aggiungere `"scene": "giorno_N_illustrazione_1.png"` e `"sceneEnd": "giorno_N_illustrazione_2.png"`. Con `sceneEnd` gli oggetti restano nascosti durante il dialogo e compaiono solo sulla seconda scena (es. giorno_6, giorno_10, giorno_12).
- **`"speechEnd": false`**: nei giorni senza interazioni dopo il discorso il riquadro `fine_discorso.png` non compare (decisione ragazze: giorni 1, 5, 7, 9, 10, 11, 14, 15, 16, 18).
- **`"speechEndImage": "fine_discorso_speciale.png"`**: riquadro di fine discorso dedicato, preso dalla cartella della giornata al posto di quello standard (giorni 12 e 21).
- **Giornata senza dialogo** (`"dialogue": []`): si passa subito agli oggetti cliccabili (es. giorno_13, giorno_19).
- **Oggetto bistabile** (giorno_12): un oggetto con `"dialogue": [...]` apre la sua illustrazione E un dialogo dedicato; cliccando si avanza nel discorso senza chiudere, e si torna alla scena principale solo con la freccetta ↩ in basso a sinistra. Così si può poi cliccare l'altro oggetto.
- **Stanze** (giorno_21): `"rooms": [{"image": ...}, ...]` aggiunge due freccette blu sotto quelle delle giornate (sinistra → rooms[0], destra → rooms[1]); dentro una stanza la ↩ riporta alla scena principale. `"roomSound"` è il suono riprodotto a ogni cambio stanza; `"music": false` = nessuna musica di sottofondo. Un oggetto con `"room": N` esiste solo in quella stanza (es. lettera in camera, rooms[1]).

## Come si comporta il sito (deciso con le ragazze)

- Tutte le giornate in `index.json` sono visibili subito; si naviga con le **frecce ‹ ›** ai lati o i tasti freccia. Archivio dal pulsante ✴ (etichette "Giorno 1", "Giorno 2", …). Deep-link: `?day=giorno_2`.
- Il dialogo avanza **cliccando ovunque** sullo schermo.
- Gli oggetti sono cliccabili **solo a fine dialogo**; all'hover si ingrandiscono (nessun altro indizio visivo). Click → illustrazione sovrapposta → **si chiude cliccando ovunque**.
- Cursore: freccia normale ovunque; **manina solo** su cose davvero cliccabili (oggetti, dialogo attivo, pulsanti, illustrazione aperta).
- Musica: parte appena possibile. I browser bloccano l'autoplay con audio, quindi al peggio parte **al primo click** (che sul nostro sito avviene subito, col dialogo). Loop automatico, pulsante ♪ accanto all'archivio per spegnerla.
- Logo sempre visibile in alto a sinistra, sopra ogni schermata.
- Mobile: desktop-first; in verticale chiede di ruotare il telefono.
- Il click sugli oggetti usa l'**alpha-test sul pixel** del PNG: le zone trasparenti non sono cliccabili. Per questo i "buchi" (es. il cappio del nastro) devono essere davvero trasparenti nel PNG, non bianchi.

## Convenzione dei nomi su Figma e Drive

Figma, Drive e cartelle del sito usano **gli stessi identici nomi** — niente rinomine. Esempio col giorno 2:

- `giorno_2` — frame con testi e descrizioni della giornata
- `giorno_2_illustrazione.png` — illustrazione home della giornata
- `giorno_2_sigarette.png` — un oggetto
- `giorno_2_illustrazione_sigarette.png` — illustrazione dell'oggetto aperto
- `giorno_2_musica.mp3` — canzone (sul Drive e nella cartella)

Per l'export automatico da Figma basta il link al singolo frame della giornata (tasto destro → *Copy link to selection*): la pagina intera è troppo grande per la lettura via connettore.

## Lavoro quotidiano: aggiungere una giornata

1. Butta nella cartella `Days/giorno_N/` (le 3, 4 e 5 sono già create con day.json segnaposto) i file esportati coi loro nomi: `giorno_N_illustrazione.png`, `giorno_N_musica.mp3`, eventuali oggetti e illustrazioni-oggetto.
2. Compila `day.json`: testi incollati da Figma + elenco degli `id` degli oggetti.
3. Se il numero non è già in `Days/index.json`, aggiungilo.
4. Commit e push.

## Aggiungere un personaggio

1. Esporta il suo box `assets/speak_tab/<nome>_tab.png` con lo stesso impianto di quello di Stella (se l'area del testo è in una posizione diversa, va ritoccata `#dialogue-text` nel CSS: le coordinate attuali sono x 20,5–95,5% / y 78–94%).
2. Aggiungi in `assets/speakers.json`: `"<nome>": { "name": "Nome", "box": "assets/speak_tab/<nome>_tab.png" }`.

## Testare in locale

I `fetch` non funzionano aprendo il file col doppio click; serve un server:

```
cd cartella-del-sito
python3 -m http.server 8000
```

poi `http://localhost:8000` (giornata specifica: `?day=giorno_2`).

## Pubblicare su GitHub

Il repo locale è già inizializzato e collegato a https://github.com/paulore00/Stella. Manca solo il push.

**Strada A — GitHub Desktop (senza terminale):** installa https://desktop.github.com, login come paulore00, *File → Add local repository* → questa cartella → **Publish branch**. Per gli aggiornamenti: Summary → *Commit to main* → *Push origin*.

**Strada B — Terminale:** `git push -u origin main` (se rifiutato: prima `git pull --rebase origin main`). Aggiornamenti: `git add -A && git commit -m "..." && git push`.

**Attivare il sito (una volta sola):** repo → Settings → Pages → *Deploy from a branch* → main / root. URL: `https://paulore00.github.io/Stella/`. Il file `.nojekyll` è già presente e serve a Pages.

**Dominio stelladaily.com:** va comprato da un registrar (~10–15 €/anno). Poi: file `CNAME` nel repo con `stelladaily.com` + 4 record DNS A verso GitHub Pages + Settings → Pages → Custom domain. Configurazione da fare quando il dominio c'è.

**Privacy dei giorni futuri:** con Pages gratuito il repo è pubblico, chi fruga vede i contenuti caricati in anticipo. Opzioni: accettarlo, pushare la mattina stessa, repo privato con GitHub Pro (~4 €/mese), o doppio repo con Action programmata.

## Note tecniche

- Su GitHub Pages i nomi file sono **case-sensitive** (`STELLADAILY-REGULAR.TTF` maiuscolo, identico nel CSS; `Days` con la D maiuscola).
- Il font non ha alcuni segni (`*`, `—`): il browser usa un ripiego, va bene così.
- Oltre i ~46px la battuta più lunga sfonda il box: battute molto lunghe vanno spezzate.
- I PNG degli oggetti con zone chiuse (tipo il cappio del nastro): controllare che l'interno sia trasparente, non bianco — il bianco opaco copre la scena.

## Diario delle modifiche — sessione 11/07/2026

- Motore riparato: legge `Days/` (dopo la rinomina da `New_days`) e le cartelle `giorno_N` al posto delle date; archivio con etichette "Giorno N".
- `speakers.json` riscritto con gli 8 personaggi reali → dialoghi a più voci già funzionanti.
- **Nuovo modello oggetti**: click → illustrazione `ill-*.png` sovrapposta, chiusura cliccando ovunque (prima c'era il box di testo).
- Riparato `obj-nastro.png`: il buco del cappio era bianco opaco (658 px), ora trasparente.
- Logo in alto a sinistra sopra tutto; pulsante audio; musica per giornata in loop con partenza al primo gesto; cursori corretti; titolo pagina "Stella Daily".
- Create `giorno_3/4/5` con day.json segnaposto.

## DA FARE

- [ ] **Illustrazioni oggetti giorno 2**: mancano i 6 `ill-*.png` (makeup, collanina, foto, nastro, diario, libro). Servono i link Figma ai singoli frame, o l'export a mano.
- [ ] **Musiche**: la cartella Drive risulta vuota via connettore — scaricare gli mp3 e metterli come `Days/giorno_N/music.mp3`.
- [ ] **Contenuti giorni 3–5**: scene, testi, oggetti da Figma.
- [ ] **Primo push su GitHub** + attivazione Pages.
- [ ] **Dominio stelladaily.com**: acquisto + CNAME/DNS.
- [ ] **Counter dei click sugli oggetti** (punto 9, rimandato): da decidere se locale o globale — quello globale richiede un servizio esterno tipo CountAPI/Firebase, il repo statico non basta.
- [ ] Prima di pubblicare: togliere da `Days/index.json` i giorni ancora vuoti, o i visitatori ci navigano dentro.
