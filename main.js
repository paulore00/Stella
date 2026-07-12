/* ============================================================
   STELLA DAILY — motore del sito
   - carica le giornate da Days/index.json (cartelle "giorno_N")
   - TUTTE le giornate sono visibili: si scorre con le frecce
     avanti / indietro (nessun blocco per data)
   - dialogo: box PNG per personaggio (icona+nome+area testo),
     testo typewriter sopra l'area interna del box
   - a fine dialogo compare fine_discorso.png e gli oggetti
     diventano cliccabili (con ingrandimento all'hover)
   - oggetti = PNG full-frame trasparenti, click con alpha-test
   ============================================================ */

(() => {
  "use strict";

  const BASE = "Days";              // cartella dei contenuti
  const END_IMG = "assets/fine_discorso.png";
  const TYPE_SPEED_MS = 28;         // velocità typewriter
  const ALPHA_THRESHOLD = 10;       // 0-255: sopra questa soglia il pixel è "pieno"

  // ---------- riferimenti DOM ----------
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const sceneImg = $("scene");
  const layersDiv = $("object-layers");
  const dialogueBox = $("dialogue");
  const speakBox = $("speak-box");
  const dialogueText = $("dialogue-text");
  const speechEnd = $("speech-end");
  const overlay = $("overlay");
  const overlayContent = $("overlay-content");
  const illustration = $("illustration");
  const bgm = $("bgm");
  const audioBtn = $("audio-btn");
  const archive = $("archive");
  const archiveList = $("archive-list");
  const navPrev = $("nav-prev");
  const navNext = $("nav-next");

  // ---------- stato ----------
  let speakers = {};
  let days = [];           // elenco date ordinato
  let dayIndex = 0;        // giornata corrente (indice in days)
  let day = null;          // day.json corrente
  let dayPath = "";        // es. "Days/giorno_1/"
  let dayFolder = "";      // es. "giorno_1" — prefisso dei nomi file per convenzione
  let objects = [];        // { def, img, ctx, w, h, cx, cy }
  let hovered = null;      // oggetto attualmente ingrandito
  let dialogueDone = false;
  let lineIndex = -1;
  let typing = false;
  let typeTimer = null;

  speechEnd.src = END_IMG;

  // ---------- numero ed etichetta delle giornate (cartelle "giorno_N") ----------
  function dayNum(folder) {
    const m = String(folder).match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  function dayLabel(folder) {
    const n = dayNum(folder);
    return n ? "Giorno " + n : folder;
  }

  // ---------- avvio ----------
  async function init() {
    let index, speakersJson;
    try {
      [index, speakersJson] = await Promise.all([
        fetchJson(BASE + "/index.json"),
        fetchJson("assets/speakers.json"),
      ]);
    } catch (e) {
      showEmpty();
      return;
    }
    speakers = speakersJson;

    days = [...index.days].sort((a, b) => dayNum(a) - dayNum(b));
    if (days.length === 0) { showEmpty(); return; }

    const param = new URLSearchParams(location.search).get("day");
    const start = param && days.includes(param) ? days.indexOf(param) : 0;

    await loadDay(start);
  }

  async function loadDay(idx) {
    if (idx < 0 || idx >= days.length) return;
    dayIndex = idx;
    const date = days[idx];
    dayPath = `${BASE}/${date}/`;
    dayFolder = date;

    // azzera lo stato della giornata precedente
    clearInterval(typeTimer);
    typing = false;
    dialogueDone = false;
    lineIndex = -1;
    hovered = null;
    overlay.classList.add("hidden");
    illustration.classList.add("hidden");
    speechEnd.classList.add("hidden");
    stage.style.cursor = "";

    try {
      day = await fetchJson(dayPath + "day.json");
    } catch (e) {
      showEmpty();
      return;
    }

    // convenzione dei nomi: giorno_N_illustrazione.png, giorno_N_musica.mp3
    // giornate a DUE illustrazioni: "scene" = giorno_N_illustrazione_1.png (dialogo),
    // "sceneEnd" = giorno_N_illustrazione_2.png (a fine dialogo, con gli oggetti)
    sceneImg.src = dayPath + (day.scene || dayFolder + "_illustrazione.png");
    setMusic(day.music || dayFolder + "_musica.mp3");

    await prepareObjects(day.objects || []);
    // con sceneEnd gli oggetti appartengono alla seconda scena:
    // restano nascosti finché il dialogo non finisce
    layersDiv.classList.toggle("hidden", !!day.sceneEnd);
    buildArchive();
    updateNav();

    dialogueText.textContent = "";
    if (day.dialogue && day.dialogue.length > 0) {
      dialogueBox.classList.remove("hidden");
      nextLine();
    } else {
      dialogueBox.classList.add("hidden");
      finishDialogue();
    }
  }

  function showEmpty() {
    $("empty-state").classList.remove("hidden");
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  }

  // ---------- navigazione fra le giornate ----------
  function updateNav() {
    navPrev.classList.toggle("hidden", dayIndex <= 0);
    navNext.classList.toggle("hidden", dayIndex >= days.length - 1);
  }

  function goTo(idx) {
    if (idx < 0 || idx >= days.length) return;
    const url = new URL(location);
    url.searchParams.set("day", days[idx]);
    history.replaceState(null, "", url);
    loadDay(idx);
  }

  navPrev.addEventListener("click", (e) => { e.stopPropagation(); goTo(dayIndex - 1); });
  navNext.addEventListener("click", (e) => { e.stopPropagation(); goTo(dayIndex + 1); });

  // ---------- oggetti: layer PNG + canvas per l'alpha test ----------
  function prepareObjects(defs) {
    layersDiv.innerHTML = "";
    objects = [];
    const jobs = defs.map((def) => new Promise((resolve) => {
      const img = new Image();
      // convenzione: giorno_N_<oggetto>.png (sovrascrivibile con "image")
      img.src = dayPath + (def.image || dayFolder + "_" + def.id + ".png");
      img.draggable = false;
      img.alt = "";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { cx, cy } = centroid(ctx, canvas.width, canvas.height);
        // l'ingrandimento all'hover parte dal centro dell'oggetto
        img.style.transformOrigin = `${cx}% ${cy}%`;
        objects.push({ def, img, ctx, w: canvas.width, h: canvas.height });
        resolve();
      };
      img.onerror = () => resolve();
      layersDiv.appendChild(img);
    }));
    return Promise.all(jobs);
  }

  // centroide dei pixel opachi, in percentuale sul frame
  function centroid(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    let sx = 0, sy = 0, n = 0;
    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) { sx += x; sy += y; n++; }
      }
    }
    if (!n) return { cx: 50, cy: 50 };
    return { cx: (sx / n) / w * 100, cy: (sy / n) / h * 100 };
  }

  function objectAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      const px = Math.floor(relX * o.w);
      const py = Math.floor(relY * o.h);
      if (px < 0 || py < 0 || px >= o.w || py >= o.h) continue;
      const alpha = o.ctx.getImageData(px, py, 1, 1).data[3];
      if (alpha > ALPHA_THRESHOLD) return o;
    }
    return null;
  }

  // ---------- dialogo typewriter ----------
  function nextLine() {
    lineIndex++;
    if (lineIndex >= day.dialogue.length) { finishDialogue(); return; }

    const line = day.dialogue[lineIndex];
    const sp = speakers[line.speaker] || {};
    if (sp.box) speakBox.src = sp.box;   // box PNG del personaggio

    typing = true;
    dialogueText.textContent = "";
    let i = 0;
    const text = line.text || "";
    typeTimer = setInterval(() => {
      dialogueText.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        typing = false;
      }
    }, TYPE_SPEED_MS);
  }

  function skipTyping() {
    clearInterval(typeTimer);
    typing = false;
    dialogueText.textContent = day.dialogue[lineIndex].text || "";
  }

  function finishDialogue() {
    dialogueDone = true;
    dialogueBox.classList.add("hidden");
    speechEnd.classList.remove("hidden");   // "Se hai finito puoi anche andare..."
    // giornate a due illustrazioni: si passa alla seconda scena
    // e solo qui compaiono gli oggetti
    if (day && day.sceneEnd) {
      sceneImg.src = dayPath + day.sceneEnd;
      layersDiv.classList.remove("hidden");
    }
    // da qui gli oggetti sono cliccabili, senza indizi oltre all'hover.
  }

  dialogueBox.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dialogueDone) {
      if (typing) skipTyping();
      else nextLine();
    }
  });

  // ---------- musica della giornata (in loop) ----------
  let musicWanted = false;   // c'è una canzone per questa giornata
  let musicMuted = false;    // scelta dell'utente col pulsante

  function setMusic(file) {
    if (!file) {
      musicWanted = false;
      bgm.pause();
      bgm.removeAttribute("src");
      audioBtn.classList.add("hidden");
      return;
    }
    musicWanted = true;
    bgm.src = dayPath + file;
    audioBtn.classList.remove("hidden");
    updateAudioBtn();
    tryPlay();
  }

  function tryPlay() {
    if (!musicWanted || musicMuted) return;
    bgm.play().catch(() => { /* autoplay bloccato: riproveremo al primo gesto */ });
  }

  // i browser bloccano l'autoplay con audio: al primo gesto utile la musica parte
  ["pointerdown", "keydown"].forEach((ev) =>
    document.addEventListener(ev, () => tryPlay(), { passive: true })
  );

  // mp3 mancante: niente pulsante audio
  bgm.addEventListener("error", () => {
    musicWanted = false;
    audioBtn.classList.add("hidden");
  });

  function updateAudioBtn() {
    audioBtn.textContent = "♪";
    audioBtn.classList.toggle("muted", musicMuted);
    audioBtn.title = musicMuted ? "Riattiva la musica" : "Spegni la musica";
  }

  audioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    musicMuted = !musicMuted;
    if (musicMuted) bgm.pause(); else tryPlay();
    updateAudioBtn();
  });

  // ---------- click + hover sulla scena ----------
  stage.addEventListener("click", (e) => {
    // illustrazione aperta: qualsiasi click la chiude
    if (!illustration.classList.contains("hidden")) {
      illustration.classList.add("hidden");
      stage.style.cursor = "";
      return;
    }
    if (!dialogueDone) return;
    const o = objectAt(e.clientX, e.clientY);
    if (o) openOverlay(o.def);
  });

  stage.addEventListener("mousemove", (e) => {
    if (!illustration.classList.contains("hidden")) { setHovered(null); return; }
    if (!dialogueDone || !overlay.classList.contains("hidden")) { setHovered(null); return; }
    setHovered(objectAt(e.clientX, e.clientY));
  });
  stage.addEventListener("mouseleave", () => setHovered(null));

  function setHovered(o) {
    if (o === hovered) return;
    if (hovered) hovered.img.classList.remove("hovered");
    hovered = o;
    if (hovered) hovered.img.classList.add("hovered");
    stage.style.cursor = hovered ? "pointer" : "";
  }

  // ---------- overlay contenuto ----------
  async function openOverlay(def) {
    // nuovo modello: illustrazione PNG sovrapposta alla scena.
    // convenzione: giorno_N_illustrazione_<oggetto>.png (sovrascrivibile con overlay.image)
    const name = (def.overlay && def.overlay.image) ||
                 dayFolder + "_illustrazione_" + def.id + ".png";
    const src = dayPath + name;
    const probe = new Image();
    probe.onload = () => {
      illustration.src = src;
      setHovered(null);
      illustration.classList.remove("hidden");
      stage.style.cursor = "pointer";   // qualsiasi click chiude
    };
    probe.onerror = () => openHtmlOverlay(def); // illustrazione mancante: fallback
    probe.src = src;
  }

  async function openHtmlOverlay(def) {
    // niente illustrazione e niente testo: il click non apre nulla
    if (!def.overlay || (!def.overlay.html && !def.overlay.file)) {
      console.warn("Oggetto '" + def.id + "': manca " + dayFolder + "_illustrazione_" + def.id + ".png");
      return;
    }
    let html = "";
    if (def.overlay && def.overlay.html) {
      html = def.overlay.html;
    } else if (def.overlay && def.overlay.file) {
      try {
        const r = await fetch(dayPath + def.overlay.file, { cache: "no-cache" });
        html = await r.text();
      } catch (e) { html = "<p>Contenuto non trovato.</p>"; }
    }
    overlayContent.innerHTML = html;
    setHovered(null);
    overlay.classList.remove("hidden");
  }

  $("overlay-close").addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });

  // ---------- archivio ----------
  function buildArchive() {
    archiveList.innerHTML = "";
    [...days].map((d, i) => [d, i]).reverse().forEach(([d, i]) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "?day=" + d;
      a.textContent = dayLabel(d);
      a.addEventListener("click", (e) => { e.preventDefault(); archive.classList.add("hidden"); goTo(i); });
      if (i === dayIndex) a.style.fontWeight = "bold";
      li.appendChild(a);
      archiveList.appendChild(li);
    });
  }

  $("archive-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    archive.classList.remove("hidden");
  });
  $("archive-close").addEventListener("click", () => archive.classList.add("hidden"));
  archive.addEventListener("click", (e) => {
    if (e.target === archive) archive.classList.add("hidden");
  });

  // ---------- tastiera: Esc chiude, frecce navigano ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      overlay.classList.add("hidden");
      archive.classList.add("hidden");
      illustration.classList.add("hidden");
    } else if (e.key === "ArrowRight") {
      if (!overlay.classList.contains("hidden")) return;
      goTo(dayIndex + 1);
    } else if (e.key === "ArrowLeft") {
      if (!overlay.classList.contains("hidden")) return;
      goTo(dayIndex - 1);
    }
  });

  init();
})();
