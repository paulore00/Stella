/* ============================================================
   ARPIE — motore del sito
   - carica le giornate da New_days/index.json
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

  const BASE = "New_days";          // cartella dei contenuti
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
  const advanceArrow = $("advance-arrow");
  const speechEnd = $("speech-end");
  const overlay = $("overlay");
  const overlayContent = $("overlay-content");
  const archive = $("archive");
  const archiveList = $("archive-list");
  const navPrev = $("nav-prev");
  const navNext = $("nav-next");

  // ---------- stato ----------
  let speakers = {};
  let days = [];           // elenco date ordinato
  let dayIndex = 0;        // giornata corrente (indice in days)
  let day = null;          // day.json corrente
  let dayPath = "";        // es. "New_days/2026-07-07/"
  let objects = [];        // { def, img, ctx, w, h, cx, cy }
  let hovered = null;      // oggetto attualmente ingrandito
  let dialogueDone = false;
  let lineIndex = -1;
  let typing = false;
  let typeTimer = null;

  speechEnd.src = END_IMG;

  // ---------- data di oggi in Italia (YYYY-MM-DD) ----------
  function todayInItaly() {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    return fmt.format(new Date());
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

    days = [...index.days].sort();
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

    // azzera lo stato della giornata precedente
    clearInterval(typeTimer);
    typing = false;
    dialogueDone = false;
    lineIndex = -1;
    hovered = null;
    overlay.classList.add("hidden");
    speechEnd.classList.add("hidden");
    stage.style.cursor = "";

    try {
      day = await fetchJson(dayPath + "day.json");
    } catch (e) {
      showEmpty();
      return;
    }

    sceneImg.src = dayPath + (day.scene || "scene.png");

    await prepareObjects(day.objects || []);
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
      img.src = dayPath + def.image;
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
    advanceArrow.classList.add("hidden");

    typing = true;
    dialogueText.textContent = "";
    let i = 0;
    const text = line.text || "";
    typeTimer = setInterval(() => {
      dialogueText.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        typing = false;
        advanceArrow.classList.remove("hidden");
      }
    }, TYPE_SPEED_MS);
  }

  function skipTyping() {
    clearInterval(typeTimer);
    typing = false;
    dialogueText.textContent = day.dialogue[lineIndex].text || "";
    advanceArrow.classList.remove("hidden");
  }

  function finishDialogue() {
    dialogueDone = true;
    advanceArrow.classList.add("hidden");
    dialogueBox.classList.add("hidden");
    speechEnd.classList.remove("hidden");   // "Se hai finito puoi anche andare..."
    // da qui gli oggetti sono cliccabili, senza indizi oltre all'hover.
  }

  dialogueBox.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dialogueDone) {
      if (typing) skipTyping();
      else nextLine();
    }
  });

  // ---------- click + hover sulla scena ----------
  stage.addEventListener("click", (e) => {
    if (!dialogueDone) return;
    const o = objectAt(e.clientX, e.clientY);
    if (o) openOverlay(o.def);
  });

  stage.addEventListener("mousemove", (e) => {
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
    const today = todayInItaly();
    [...days].map((d, i) => [d, i]).reverse().forEach(([d, i]) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "?day=" + d;
      a.textContent = formatDate(d);
      a.addEventListener("click", (e) => { e.preventDefault(); archive.classList.add("hidden"); goTo(i); });
      if (i === dayIndex) a.style.fontWeight = "bold";
      li.appendChild(a);
      if (d === today) {
        const tag = document.createElement("span");
        tag.className = "today-tag";
        tag.textContent = "(oggi)";
        li.appendChild(tag);
      }
      archiveList.appendChild(li);
    });
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
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
