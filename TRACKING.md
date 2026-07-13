# Tracking dei click — Stella Daily ("Strada B")

Sistema fatto in casa per vedere **dove clicca la gente**, giorno per giorno, senza servizi di analytics esterni, senza cookie e senza banner. Costo: 0 €.

## Come funziona (in una frase)

Il sito, a ogni click, manda una riga anonima ("giorno 5, click al 43% da sinistra e 27% dall'alto, oggetto: diario") a un database gratuito online (Supabase); una pagina privata sul tuo computer legge quelle righe e le disegna come puntini di calore sopra l'illustrazione del giorno scelto.

```
Visitatore clicca → main.js calcola posizione % sul palco → POST a Supabase
                                                                 ↓
Tu apri heatmap.html (privata) → scegli il giorno → puntini sopra l'illustrazione
```

## Cosa viene registrato (e cosa NO)

Registrato per ogni click: **giorno** (es. `giorno_5`), **posizione** in percentuale rispetto al palco (così mobile e desktop combaciano), **cosa** è stato cliccato (`oggetto:diario`, `dialogo`, `sfondo`…), **quando** (data/ora).

NON registrato: IP, nome, dispositivo, cookie, identificativi di alcun tipo. Per questo **non serve il banner cookie**. (Se un domani volessimo contare i "visitatori unici" servirebbe un identificativo → a quel punto sì, banner.)

---

## Fase 1 — Setup Supabase (LA FAI TU, ~10 minuti, una volta sola)

1. Vai su https://supabase.com → **Sign up** (puoi entrare col login GitHub).
2. **New project**: nome `stella-analytics`, regione **EU (Frankfurt)**, genera la password del database e salvala (serve solo a te, non al sito).
3. Menu a sinistra → **SQL Editor** → incolla e lancia questo (crea la tabella):

```sql
create table clicks (
  id bigint generated always as identity primary key,
  day text not null,
  x_pct real not null,
  y_pct real not null,
  target text,
  created_at timestamptz default now()
);

alter table clicks enable row level security;
create policy "insert_pubblico" on clicks for insert with check (true);
create policy "select_pubblico" on clicks for select using (true);
```

4. Menu → **Settings → API** → copia due valori e passameli:
   - **Project URL** (tipo `https://xxxx.supabase.co`)
   - **anon public key** (una stringa lunga)

Queste due chiavi sono pensate per stare nel codice pubblico: da sole permettono solo di scrivere click e di leggerli. Nota onesta: chiunque trovasse l'URL potrebbe leggere le coordinate dei click — sono dati innocui, per questo è accettabile.

## Fase 2 — Codice nel sito (LA FACCIO IO, ~30 righe in main.js)

- Listener sui click che calcola la posizione **in % rispetto al palco** (non allo schermo) e individua giorno corrente + oggetto.
- Invio "spara e dimentica": se il database non risponde o un adblocker blocca, il sito **non rallenta e non mostra errori** — si perde solo quel dato.
- Esclusioni automatiche: niente tracking quando il sito gira in locale (nostri test) e con l'URL `?notrack` (per quando lo aprite voi dopo il lancio).
- Non tocco nulla del resto: testi, day.json, grafica restano identici.

## Fase 3 — Pagina heatmap (LA FACCIO IO)

Un singolo file `heatmap.html`:

- menu a tendina con i giorni → carica l'illustrazione di quel giorno → sovrappone i click come puntini con intensità di colore;
- contatore dei click per oggetto (il "counter" che avevamo rimandato);
- filtro per periodo (es. solo oggi / ultima settimana).

**Resta fuori dal repo pubblico**: vive solo sul tuo computer, si apre col doppio click, nessun server. Così nessuno scopre che esiste.

## Stato al 13/07 (sera)

Fasi 1, 2, 3 **fatte**. Progetto Supabase `stella-analytics` creato (EU Frankfurt), tabella `clicks` attiva. Tracker inserito in `main.js` (chiave = *publishable key* `sb_publishable_…`, non più "anon"). `heatmap.html` creata e messa in `.gitignore` (resta privata). Manca solo pubblicare e verificare (Fase 4).

## Fase 4 — Pubblica e verifica

1. **Pubblica** le modifiche (il tracking è spento in locale, si accende solo sul sito online):
   ```
   git add main.js index.html .gitignore TRACKING.md
   git commit -m "Tracking anonimo dei click + heatmap privata"
   git push
   ```
2. Aspetta ~1 minuto che GitHub Pages aggiorni, apri https://paulatolorenzo.github.io/stelladaily/ e fai **qualche click** (sfondo, un oggetto, il dialogo).
3. Su Supabase → **Table Editor → clicks**: devono comparire le righe. Se ci sono, funziona.
4. Apri `heatmap.html` (doppio click): scegli il giorno → vedi i puntini.
5. Prima del **lancio vero** svuota i click di prova: SQL Editor → `delete from clicks;`
6. Da lì in poi raccoglie da solo, nulla da fare.

---

## Limiti da sapere

- **Adblocker**: una parte dei visitatori (stima 10–30%) blocca le richieste verso domini di terze parti → quei click non li vediamo. Vale per qualunque analytics, Clarity compreso.
- **Piano gratuito Supabase**: 500 MB di database (i click sono minuscoli: bastano per anni) ma il progetto **va in pausa dopo ~1 settimana senza traffico** — si riattiva con un click dal pannello Supabase. Col sito online e visitato non succede.
- Serve che il sito sia **pubblicato** (GitHub Pages): in locale il tracking è spento apposta.

## Prossimo passo

Fai la Fase 1 e mandami **Project URL + anon key**: al resto (Fasi 2 e 3) penso io.
