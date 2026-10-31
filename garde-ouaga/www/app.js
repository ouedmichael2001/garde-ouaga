/* Garde Ouaga — logique de l'application (web, PWA et Android) */
(function () {
"use strict";

// ================== RÉGLAGES (modifiables) ==================
const CONFIG = {
  // Un samedi à 12h00 où l'on connaît le groupe de garde (programme officiel de l'Ordre)
  ancre: Date.UTC(2026, 9, 10, 12, 0),   // samedi 10/10/2026 12h00
  groupeAncre: 1,                         // → groupe 1 cette semaine-là
  // Horaires des pharmacies ordinaires, en minutes depuis minuit, par jour (0 = dimanche)
  horaires: {
    0: [],               // dimanche : fermé (garde uniquement)
    1: [[450, 1200]],    // lundi    7h30–20h00
    2: [[450, 1200]],
    3: [[450, 1200]],
    4: [[450, 1200]],
    5: [[450, 1200]],
    6: [[450, 1200]]     // samedi   7h30–20h00
  },
  // Jours fériés à date fixe (MM-JJ). Ajoutez les fêtes mobiles au format AAAA-MM-JJ.
  feries: ["01-01", "01-03", "03-08", "05-01", "08-05", "08-15", "11-01", "12-11", "12-25"],
  // Pharmacies d'appui le week-end et les jours fériés (8h–20h) jusqu'à cette date
  appuiJusquau: Date.UTC(2026, 10, 15, 23, 59)
};
// =============================================================

const Q = window.QUARTIERS, P = window.PHARMACIES;
const WEEK = 7 * 864e5;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const pad = n => String(n).padStart(2, "0");
const fmtMin = m => `${Math.floor(m / 60)}h${pad(m % 60)}`;
// Ouagadougou est à UTC+0 : les champs UTC sont l'heure locale, quel que soit le réglage du téléphone.
const hm = d => `${d.getUTCHours()}h${pad(d.getUTCMinutes())}`;
const dayStr = d => `${JOURS[d.getUTCDay()].slice(0, 3)}. ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;

function gardeInfo(t, override) {
  const k = Math.floor((t - CONFIG.ancre) / WEEK);
  const auto = (((k + CONFIG.groupeAncre - 1) % 4) + 4) % 4 + 1;
  const start = CONFIG.ancre + k * WEEK;
  const g = override === "auto" ? auto : +override;
  return { g, start: new Date(start), end: new Date(start + WEEK), nextG: g % 4 + 1 };
}
function isFerie(d) {
  const md = `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return CONFIG.feries.includes(md) || CONFIG.feries.includes(`${d.getUTCFullYear()}-${md}`);
}
function slots(d) { return isFerie(d) ? [] : (CONFIG.horaires[d.getUTCDay()] || []); }
function regularStatus(t) {
  const d = new Date(t), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  for (const [a, b] of slots(d)) if (m >= a && m < b) return { open: true, until: fmtMin(b) };
  for (let i = 0; i < 10; i++) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i));
    for (const [a] of slots(day)) {
      if (i === 0 && a <= m) continue;
      const when = i === 0 ? "aujourd'hui" : i === 1 ? "demain" : dayStr(day);
      return { open: false, next: `${when} ${fmtMin(a)}` };
    }
  }
  return { open: false, next: "—" };
}

// ---------- Distances ----------
function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dl = r(b[0] - a[0]), dn = r(b[1] - a[1]);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearestQ(lat, lon) {
  let best = null, bd = 1e9;
  for (const k in Q) { const d = km([lat, lon], Q[k]); if (d < bd) { bd = d; best = k; } }
  return { k: best, d: bd };
}
const posOf = p => (p.lat != null && p.lon != null) ? [p.lat, p.lon] : (p.q ? Q[p.q] : null);

// ---------- État ----------
const S = { filter: "open", q: "", here: null, herePt: null, gps: false, when: null, grp: "auto" };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const now = () => S.when ?? Date.now();

(function initSelects() {
  const sel = $("quartier");
  const o = document.createElement("option"); o.value = ""; o.textContent = "Choisir mon quartier…"; sel.appendChild(o);
  Object.entries(Q).sort((a, b) => a[1][2].localeCompare(b[1][2], "fr")).forEach(([k, v]) => {
    const op = document.createElement("option"); op.value = k; op.textContent = v[2]; sel.appendChild(op);
  });
  const saved = store.get("quartier");
  if (saved && Q[saved]) { sel.value = saved; S.here = saved; S.herePt = Q[saved]; }
  const g = store.get("grp"); if (g) { S.grp = g; $("grp").value = g; }
})();

function render() {
  const t = now(), d = new Date(t);
  const gi = gardeInfo(t, S.grp), reg = regularStatus(t);
  $("headline").innerHTML = `Groupe <b>${gi.g}</b> de garde`;
  $("subline").textContent = `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} · ${hm(d)}${S.when ? " (simulé)" : ""}`;
  $("until").textContent = `${dayStr(gi.end)} 12h → groupe ${gi.nextG}`;
  $("regular").textContent = reg.open ? `Ouvertes jusqu'à ${reg.until}` : `Fermées · ${reg.next}`;

  const day = d.getUTCDay(), we = day === 0 || day === 6 || isFerie(d), hh = d.getUTCHours();
  const ap = $("appui");
  if (we && t <= CONFIG.appuiJusquau) {
    ap.hidden = false;
    ap.innerHTML = `<strong>Week-end${isFerie(d) ? " / jour férié" : ""} :</strong> environ 60 pharmacies d'appui sont aussi ouvertes de 8h à 20h jusqu'à mi-novembre${hh >= 8 && hh < 20 ? " (en ce moment)" : ""}. Leur liste n'est pas encore dans l'application.`;
  } else ap.hidden = true;

  const q = S.q.trim().toLowerCase();
  let rows = P.map(p => {
    const garde = p.g === gi.g;
    const st = garde ? { open: true, garde: true } : reg.open ? { open: true, until: reg.until } : { open: false, next: reg.next };
    const pt = posOf(p);
    const dist = (S.herePt && pt) ? km(S.herePt, pt) : null;
    return Object.assign({}, p, { st, dist });
  });
  if (S.filter === "open") rows = rows.filter(r => r.st.open);
  if (S.filter === "garde") rows = rows.filter(r => r.st.garde);
  if (q) rows = rows.filter(r => (r.name + " " + r.addr + " " + (r.q ? Q[r.q][2] : "")).toLowerCase().includes(q));
  rows.sort((a, b) => {
    if (S.herePt) { const da = a.dist ?? 999, db = b.dist ?? 999; if (da !== db) return da - db; }
    if (a.st.garde !== b.st.garde) return a.st.garde ? -1 : 1;
    return a.name.localeCompare(b.name, "fr");
  });

  $("listTitle").textContent = S.filter === "open" ? "Ouvertes maintenant" : S.filter === "garde" ? `Groupe ${gi.g} de garde` : "Toutes les pharmacies";
  $("n").textContent = `${rows.length} pharmacie${rows.length > 1 ? "s" : ""}${S.herePt ? " · les plus proches d'abord" : ""}`;
  const ul = $("list"); ul.innerHTML = "";
  if (!rows.length) { ul.innerHTML = `<li class="empty">Aucune pharmacie ne correspond. Essayez « Toutes » ou une autre recherche.</li>`; return; }

  const frag = document.createDocumentFragment();
  rows.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "ph" + (S.herePt && i < 3 && r.dist != null ? " near" : "");
    const telIntl = "+226" + r.tel, telPretty = r.tel.replace(/(\d{2})(?=\d)/g, "$1 ");
    const badge = r.st.garde ? `<span class="badge garde">De garde 24h/24 · groupe ${r.g}</span>`
      : r.st.open ? `<span class="badge open">Ouverte · ferme à ${r.st.until}</span>`
      : `<span class="badge closed">Fermée · rouvre ${r.st.next}</span>`;
    let dist = "";
    if (S.herePt) {
      const lab = r.q ? Q[r.q][2] : "";
      if (r.dist == null) dist = `<div class="dist">?<small>position inconnue</small></div>`;
      else if ((!S.gps && r.q === S.here) || r.dist < 1) dist = `<div class="dist">&lt; 1 km<small>${S.gps ? lab : "votre quartier"}</small></div>`;
      else dist = `<div class="dist">≈ ${r.dist < 10 ? r.dist.toFixed(1).replace(".", ",") : Math.round(r.dist)} km<small>${lab}</small></div>`;
    }
    const pt = posOf(r);
    const maps = (r.lat != null)
      ? `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`
      : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Pharmacie " + r.name + " Ouagadougou");
    li.innerHTML = `<div class="top"><h3 class="name"></h3>${dist}</div>${badge}
      <p class="addr"></p>
      <div class="actions"><a class="act call" href="tel:${telIntl}">Appeler</a><span class="tel">${telPretty}</span>
      <button class="act" type="button" data-copy="${telIntl}">Copier</button>
      <a class="act" href="${maps}" target="_blank" rel="noopener">Itinéraire</a></div>`;
    li.querySelector(".name").textContent = "Pharmacie " + r.name;
    li.querySelector(".addr").textContent = r.addr || "Adresse non communiquée par l'Ordre";
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

// ---------- Localisation (GPS) ----------
function setHint(msg) { $("lochint").textContent = msg; }
async function getPosition() {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Geolocation) {
    const G = cap.Plugins.Geolocation;
    try { const perm = await G.checkPermissions(); if (perm.location !== "granted") await G.requestPermissions(); } catch (e) {}
    const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return p.coords;
  }
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no-geo"));
    navigator.geolocation.getCurrentPosition(p => res(p.coords), rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}
async function locate(silent) {
  if (!silent) setHint("Recherche de votre position…");
  try {
    const c = await getPosition();
    const n = nearestQ(c.latitude, c.longitude);
    if (n.d > 25) { setHint("Vous semblez hors de Ouagadougou. Choisissez un quartier dans la liste."); return; }
    S.here = n.k; S.herePt = [c.latitude, c.longitude]; S.gps = true;
    $("quartier").value = n.k; store.set("quartier", n.k); store.set("autoloc", "1");
    setHint(`Position GPS trouvée, près de ${Q[n.k][2]}.`);
    render();
  } catch (e) {
    if (!silent) setHint("Position introuvable. Autorisez la localisation, activez le GPS, ou choisissez votre quartier dans la liste.");
  }
}

// ---------- Événements ----------
$("quartier").addEventListener("change", e => {
  const k = e.target.value; S.here = k || null; S.herePt = k ? Q[k] : null; S.gps = false; store.set("quartier", k);
  setHint(k ? `Distances calculées depuis ${Q[k][2]}.` : "Touchez « Me localiser » ou choisissez votre quartier.");
  render();
});
$("locate").addEventListener("click", () => locate(false));
$("q").addEventListener("input", e => { S.q = e.target.value; render(); });
document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
  S.filter = b.dataset.f;
  document.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  render();
}));
$("when").addEventListener("change", e => {
  const v = e.target.value; if (!v) { S.when = null; render(); return; }
  const [D, T] = v.split("T"), [y, mo, da] = D.split("-").map(Number), [h, mi] = T.split(":").map(Number);
  S.when = Date.UTC(y, mo - 1, da, h, mi); render();
});
$("nowbtn").addEventListener("click", () => { S.when = null; $("when").value = ""; render(); });
$("grp").addEventListener("change", e => { S.grp = e.target.value; store.set("grp", S.grp); render(); });

function toast(m) { const el = $("toast"); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2200); }
function selectTel(b) { const s = b.parentElement.querySelector(".tel"); const r = document.createRange(); r.selectNodeContents(s); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
$("list").addEventListener("click", e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const v = b.dataset.copy;
  try { navigator.clipboard.writeText(v).then(() => toast("Numéro copié : " + v), () => { selectTel(b); toast("Numéro sélectionné"); }); }
  catch (err) { selectTel(b); toast("Numéro sélectionné"); }
});

// ---------- Installation (PWA) et hors-ligne ----------
let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("installBar").hidden = false; });
$("installBtn").addEventListener("click", async () => {
  if (!deferred) return; deferred.prompt();
  try { await deferred.userChoice; } catch (e) {}
  deferred = null; $("installBar").hidden = true;
});
window.addEventListener("appinstalled", () => { $("installBar").hidden = true; toast("Garde Ouaga est installée"); });
function netState() { $("netstate").textContent = navigator.onLine ? "" : "Hors connexion : les listes enregistrées restent disponibles."; }
window.addEventListener("online", netState); window.addEventListener("offline", netState); netState();

const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
if ("serviceWorker" in navigator && !isNative && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Démarrage ----------
if (S.here) setHint(`Distances calculées depuis ${Q[S.here][2]}.`);
render();
if (store.get("autoloc") === "1" || isNative) locate(true);
setInterval(() => { if (!S.when) render(); }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.when) render(); });

// Exposé pour les tests
window.GardeOuaga = { gardeInfo, regularStatus, CONFIG };
})();
