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
  const dayLabelEl = $("day-label");
  const roomPrev = $("room-prev");
  const roomNext = $("room-next");
  const backBtn = $("back-btn");

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
  let dlgLines = [];       // battute del dialogo attivo (giornata o oggetto)
  let dlgOnEnd = null;     // cosa fare a fine dialogo attivo
  let stickyDef = null;    // oggetto "bistabile" aperto (illustrazione + dialogo, giorno 12)
  let currentRoom = -1;    // -1 = stanza principale (giornate con "rooms", giorno 21)
  let roomSfx = null;      // suono del cambio stanza

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
    stickyDef = null;
    currentRoom = -1;
    overlay.classList.add("hidden");
    illustration.classList.add("hidden");
    speechEnd.classList.add("hidden");
    backBtn.classList.add("hidden");
    dialogueBox.classList.remove("over-ill");
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
    // riquadro di fine discorso dedicato della giornata (es. fine_discorso_speciale.png)
    speechEnd.src = day.speechEndImage ? dayPath + day.speechEndImage : END_IMG;
    // "music": false = giornata senza musica di sottofondo (es. giorno 21)
    setMusic(day.music === false ? null : (day.music || dayFolder + "_musica.mp3"));
    // suono riprodotto a ogni cambio stanza (giornate con "rooms")
    roomSfx = day.roomSound ? dayPath + day.roomSound : null;

    dayLabelEl.textContent = dayLabel(dayFolder);   // "Giorno N" sotto il logo

    await prepareObjects(day.objects || []);
    // con sceneEnd gli oggetti appartengono alla seconda scena:
    // restano nascosti finché il dialogo non finisce
    layersDiv.classList.toggle("hidden", !!day.sceneEnd);
    updateObjectVisibility();
    updateRoomArrows();
    buildArchive();
    updateNav();

    startDialogue(day.dialogue, finishDialogue);
  }

  // ---------- stanze (giornate con "rooms": giorno 21) ----------
  function playRoomSfx() {
    if (!roomSfx) return;
    new Audio(roomSfx).play().catch(() => {});
  }

  function updateRoomArrows() {
    const show = !!(day && day.rooms && day.rooms.length && currentRoom === -1);
    roomPrev.classList.toggle("hidden", !show);
    roomNext.classList.toggle("hidden", !show);
  }

  // gli oggetti legati a una stanza ("room": indice) si vedono solo lì
  function updateObjectVisibility() {
    objects.forEach((o) => {
      const room = o.def.room === undefined ? -1 : o.def.room;
      o.img.classList.toggle("hidden", room !== currentRoom);
    });
  }

  function enterRoom(i) {
    if (!day || !day.rooms || !day.rooms[i]) return;
    currentRoom = i;
    playRoomSfx();
    sceneImg.src = dayPath + day.rooms[i].image;
    speechEnd.classList.add("hidden");
    backBtn.classList.remove("hidden");
    updateRoomArrows();
    updateObjectVisibility();
  }

  function leaveRoom() {
    currentRoom = -1;
    playRoomSfx();
    sceneImg.src = dayPath + (day.scene || dayFolder + "_illustrazione.png");
    backBtn.classList.add("hidden");
    if (dialogueDone && day.speechEnd !== false) speechEnd.classList.remove("hidden");
    updateRoomArrows();
    updateObjectVisibility();
  }

  roomPrev.addEventListener("click", (e) => { e.stopPropagation(); enterRoom(0); });
  roomNext.addEventListener("click", (e) => { e.stopPropagation(); enterRoom(1); });

  backBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (stickyDef) closeSticky();
    else if (currentRoom >= 0) leaveRoom();
  });

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
      if (o.img.classList.contains("hidden")) continue; // oggetto di un'altra stanza
      const px = Math.floor(relX * o.w);
      const py = Math.floor(relY * o.h);
      if (px < 0 || py < 0 || px >= o.w || py >= o.h) continue;
      const alpha = o.ctx.getImageData(px, py, 1, 1).data[3];
      if (alpha > ALPHA_THRESHOLD) return o;
    }
    return null;
  }

  // ---------- dialogo typewriter (della giornata o di un oggetto) ----------
  function startDialogue(lines, onEnd) {
    dlgLines = lines || [];
    dlgOnEnd = onEnd || null;
    lineIndex = -1;
    dialogueText.textContent = "";
    if (dlgLines.length > 0) {
      dialogueBox.classList.remove("hidden");
      nextLine();
    } else {
      dialogueBox.classList.add("hidden");
      if (dlgOnEnd) dlgOnEnd();
    }
  }

  function nextLine() {
    lineIndex++;
    if (lineIndex >= dlgLines.length) { if (dlgOnEnd) dlgOnEnd(); return; }

    const line = dlgLines[lineIndex];
    const sp = speakers[line.speaker] || {};
    if (sp.box) {                        // box PNG del personaggio
      speakBox.src = sp.box;
      speakBox.style.visibility = "";
    } else {
      speakBox.style.visibility = "hidden";  // personaggio senza box: solo testo
    }

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

  // box PNG mancante (es. tab non ancora esportata): niente immagine rotta
  speakBox.addEventListener("error", () => { speakBox.style.visibility = "hidden"; });

  function skipTyping() {
    clearInterval(typeTimer);
    typing = false;
    dialogueText.textContent = dlgLines[lineIndex].text || "";
  }

  function finishDialogue() {
    dialogueDone = true;
    dialogueBox.classList.add("hidden");
    // "Se hai finito puoi anche andare..." — ma nei giorni senza
    // interazioni dopo il discorso ("speechEnd": false) non compare
    if (!day || day.speechEnd !== false) speechEnd.classList.remove("hidden");
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
    if (dialogueBox.classList.contains("hidden")) return;
    if (typing) skipTyping();
    else nextLine();
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
    if (!illustration.classList.contains("hidden")) {
      // oggetto bistabile: durante il dialogo i click li gestisce la vignetta;
      // a discorso finito il primo click riporta alla home della giornata
      // (in alternativa c'è sempre la freccetta ↩)
      if (stickyDef) { closeSticky(); return; }
      // illustrazione normale: qualsiasi click la chiude
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
      if (def.dialogue && def.dialogue.length > 0) {
        // oggetto bistabile: illustrazione + dialogo dedicato, resta aperto
        // finché non si torna indietro con la freccetta (giorno 12)
        stickyDef = def;
        speechEnd.classList.add("hidden");
        backBtn.classList.remove("hidden");
        dialogueBox.classList.add("over-ill");
        stage.style.cursor = "";
        // il click sull'ultima battuta chiude tutto e riporta alla home,
        // senza click extra (la ↩ resta come uscita anticipata)
        startDialogue(def.dialogue, closeSticky);
      } else {
        stage.style.cursor = "pointer";   // qualsiasi click chiude
      }
    };
    probe.onerror = () => openHtmlOverlay(def); // illustrazione mancante: fallback
    probe.src = src;
  }

  // chiude un oggetto bistabile e torna alla scena principale
  function closeSticky() {
    stickyDef = null;
    clearInterval(typeTimer);
    typing = false;
    dialogueBox.classList.add("hidden");
    dialogueBox.classList.remove("over-ill");
    illustration.classList.add("hidden");
    backBtn.classList.add("hidden");
    stage.style.cursor = "";
    if (dialogueDone && (!day || day.speechEnd !== false)) speechEnd.classList.remove("hidden");
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
    // ordine crescente verso il basso: Giorno 1 in cima
    days.map((d, i) => [d, i]).forEach(([d, i]) => {
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
      if (stickyDef) closeSticky();
      else illustration.classList.add("hidden");
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
