# Guida: mettere il sito su GitHub

Il repo è già pronto in questa cartella: l'ho inizializzato, ho fatto il primo
commit e ho collegato il remote a **https://github.com/paulore00/Stella**.
Ti resta solo da caricare (push). Scegli una delle due strade.

---

## Strada A — GitHub Desktop (consigliata, senza terminale)

1. Scarica e installa **GitHub Desktop**: https://desktop.github.com
2. Aprilo e fai login col tuo account GitHub (paulore00).
3. Menu **File → Add local repository...** e scegli questa cartella
   (`Documents/_Claude/Sito ragazze`).
4. In alto vedrai il pulsante **Publish branch** (o **Push origin**). Cliccalo.
5. Fatto: il codice è online su github.com/paulore00/Stella.

Da qui in poi, ogni volta che io (o tu) modifichiamo dei file:
- apri GitHub Desktop → vedrai le modifiche a sinistra
- scrivi due parole nel campo **Summary** in basso
- clicca **Commit to main**, poi **Push origin**.

---

## Strada B — Terminale (più veloce se te la cavi)

Apri il Terminale **dentro** questa cartella ed esegui:

```
git push -u origin main
```

Ti verrà chiesto di autenticarti con GitHub (si apre il browser).

Se il push viene rifiutato perché online c'è già un README:
```
git pull --rebase origin main
git push -u origin main
```

Per gli aggiornamenti successivi, ogni volta:
```
git add -A
git commit -m "descrizione delle modifiche"
git push
```

---

## Pubblicare il sito online (GitHub Pages)

Dopo il primo push, per rendere il sito visitabile da un link:

1. Vai su https://github.com/paulore00/Stella → **Settings** → **Pages**
2. In *Source* scegli **Deploy from a branch**
3. Branch: **main**, cartella: **/ (root)** → **Save**
4. Dopo un minuto il sito sarà a:
   `https://paulore00.github.io/Stella/`

Nota: il file `.nojekyll` è già presente e serve proprio perché Pages
carichi correttamente le cartelle (New_days, assets).

---

## Note utili

- La cartella `days_test` è la vecchia demo: puoi lasciarla o cancellarla,
  il sito non la usa (il motore legge da `New_days`).
- Le immagini grezze `New_days/Giorno_1.png`, `Giorno_2.png`,
  `Giorno_2_Oggetti.png` sono i tuoi export originali: non servono al sito
  (usa gli `scene.png` e `obj-*.png` dentro le cartelle dei giorni), ma le
  ho tenute come backup. Se vuoi alleggerire il repo puoi spostarle altrove.
