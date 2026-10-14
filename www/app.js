'use strict';

/* ================================================================
   Radar Uyarı — iPhone'da Capacitor ile, tarayıcıda test modunda çalışır.
   ================================================================ */

const Cap = window.Capacitor;
const CapCore = window.capacitorExports; // lib/capacitor.js
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const registerPlugin = (CapCore && CapCore.registerPlugin) || (Cap && Cap.registerPlugin);
const plugin = (name) => {
  if (!isNative) return null;
  try {
    if (registerPlugin) return registerPlugin(name);
    return (Cap.Plugins && Cap.Plugins[name]) || null;
  } catch (e) {
    console.warn('eklenti yok: ' + name, e);
    return null;
  }
};

const BgGeo = plugin('BackgroundGeolocation');
const Prefs = plugin('Preferences');
const Fs = plugin('Filesystem');
const ShareP = plugin('Share');
const Haptics = plugin('Haptics');
const Notif = plugin('LocalNotifications');
const Tts = plugin('TextToSpeech');
const AppP = plugin('App');
const Http = isNative ? ((CapCore && CapCore.CapacitorHttp) || plugin('CapacitorHttp')) : null;

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const USER_AGENT = 'RadarUyari/1.0 (kisisel kullanim)';
const MAX_OFFLINE_ZOOM = 16;
const MAX_OFFLINE_TILES = 2500;
const DUPLICATE_RADIUS = 150;   // m: bu kadar yakında radar varsa tekrar sor
const HEADING_TOLERANCE = 60;   // derece
const REARM_EXTRA = 500;        // m: uyarı mesafesinin bu kadar dışına çıkınca tekrar uyarabilir

/* ---------------- Durum ---------------- */
const state = {
  radars: [],
  settings: { distance: 2000, voice: true, heading: true },
  pos: null,          // { lat, lng, acc, speed, heading }
  lastPos: null,
  heading: null,
  follow: true,
  alerted: new Map(), // radar id -> en küçük mesafe
  active: null,       // şu an uyarılan radar id
  appActive: true,
  started: false,
};

/* ---------------- Yardımcılar ---------------- */
const $ = (id) => document.getElementById(id);
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function distance(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(aLat, aLng, bLat, bLng) {
  const y = Math.sin(toRad(bLng - aLng)) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
            Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLng - aLng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function fmtDist(m) {
  if (m >= 950) return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  return Math.max(0, Math.round(m / 10) * 10) + ' m';
}

function spokenDist(m) {
  if (m >= 950) {
    const km = Math.round(m / 100) / 10;
    return (Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.', ' virgül ')) + ' kilometre';
  }
  return Math.round(m / 100) * 100 + ' metre';
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ''; }
}

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------- Kalıcı kayıt ----------------
   Radarlar iOS'un kalıcı ayar deposunda (Preferences/UserDefaults) tutulur,
   localStorage'a ve Dosyalar uygulamasına da yedeklenir. Sadece kullanıcı silerse silinir. */
const store = {
  async get(key) {
    if (Prefs) {
      try { const r = await Prefs.get({ key }); if (r && r.value != null) return r.value; } catch (e) { console.warn(e); }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    if (Prefs) { try { await Prefs.set({ key, value }); } catch (e) { console.warn(e); } }
    try { localStorage.setItem(key, value); } catch { /* yok say */ }
  },
};

async function loadData() {
  try {
    const raw = await store.get('radars');
    if (raw) state.radars = JSON.parse(raw).filter((r) => isFinite(r.lat) && isFinite(r.lng));
  } catch (e) { console.warn('radarlar okunamadı', e); }

  // Ana kayıt boşsa Dosyalar'daki otomatik yedekten geri yükle.
  if (!state.radars.length && Fs) {
    try {
      const f = await Fs.readFile({ path: 'radarlar-yedek.json', directory: 'DOCUMENTS', encoding: 'utf8' });
      const data = JSON.parse(f.data);
      const list = Array.isArray(data) ? data : data.radars;
      if (Array.isArray(list) && list.length) {
        state.radars = list;
        await store.set('radars', JSON.stringify(state.radars));
        toast(list.length + ' radar yedekten geri yüklendi');
      }
    } catch { /* yedek yok */ }
  }

  try {
    const s = await store.get('settings');
    if (s) Object.assign(state.settings, JSON.parse(s));
  } catch { /* varsayılanlar */ }
}

function backupPayload() {
  return JSON.stringify({ app: 'RadarUyari', version: 1, exported: new Date().toISOString(), radars: state.radars }, null, 1);
}

async function saveRadars() {
  await store.set('radars', JSON.stringify(state.radars));
  if (Fs) {
    try {
      await Fs.writeFile({ path: 'radarlar-yedek.json', data: backupPayload(), directory: 'DOCUMENTS', encoding: 'utf8' });
    } catch (e) { console.warn('yedek yazılamadı', e); }
  }
  renderRadars();
}

const saveSettings = () => store.set('settings', JSON.stringify(state.settings));

/* ---------------- Harita döşemeleri (önbellekli) ---------------- */
const tileDb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const req = indexedDB.open('harita', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('t');
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => rej(req.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('t', mode);
      const r = fn(t.objectStore('t'));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  },
  get: (k) => tileDb.tx('readonly', (s) => s.get(k)).catch(() => null),
  put: (k, v) => tileDb.tx('readwrite', (s) => s.put(v, k)).catch(() => null),
  count: () => tileDb.tx('readonly', (s) => s.count()).catch(() => 0),
  clear: () => tileDb.tx('readwrite', (s) => s.clear()),
};

const tileUrl = (z, x, y) => TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);

async function downloadTile(z, x, y) {
  const url = tileUrl(z, x, y);
  if (Http) {
    const r = await Http.get({ url, responseType: 'blob', headers: { 'User-Agent': USER_AGENT }, connectTimeout: 8000, readTimeout: 15000 });
    if (r.status !== 200 || !r.data) throw new Error('HTTP ' + r.status);
    return 'data:image/png;base64,' + r.data;
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const blob = await resp.blob();
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function getTile(z, x, y) {
  const key = z + '/' + x + '/' + y;
  const cached = await tileDb.get(key);
  if (cached) return cached;
  const data = await downloadTile(z, x, y);
  tileDb.put(key, data);
  return data;
}

let tileErrorAt = 0;     // son başarısız parça zamanı
let tileRetryAt = 0;

// İnternet koptuysa (tünel vb.) boş kalan parçaları 20 sn'de bir yeniden dene.
function retryTilesIfNeeded() {
  if (!tileErrorAt || !state.appActive || Date.now() - tileRetryAt < 20000) return;
  tileRetryAt = Date.now();
  tileErrorAt = 0;
  tileLayer.redraw();
}

const CachedTiles = L.TileLayer.extend({
  createTile(coords, done) {
    const img = document.createElement('img');
    img.alt = '';
    img.onload = () => done(null, img);
    img.onerror = (e) => done(e, img);
    getTile(coords.z, coords.x, coords.y)
      .then((src) => { img.src = src; })
      .catch(() => {
        // İnternet yok ve önbellekte de yok: boş bırak, internet gelince yeniden denenir.
        tileErrorAt = Date.now();
        if (!isNative) img.src = tileUrl(coords.z, coords.x, coords.y);
        else done(new Error('tile'), img);
      });
    return img;
  },
});

/* ---------------- Harita ---------------- */
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([39.0, 35.2], 6);
map.attributionControl.setPrefix(false);
const tileLayer = new CachedTiles(TILE_URL, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

// İnternet geri gelince boş kalan parçaları yeniden iste.
window.addEventListener('online', () => tileLayer.redraw());

const radarLayer = L.layerGroup().addTo(map);
const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"><div class="cone"></div></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const meMarker = L.marker([0, 0], { icon: meIcon, interactive: false, zIndexOffset: 1000 });
const accCircle = L.circle([0, 0], { radius: 0, weight: 0, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false });

function radarIcon(r) {
  const arrow = r.heading != null
    ? `<div class="arrow" style="transform-origin:6px 24px;transform:rotate(${r.heading}deg)"></div>` : '';
  return L.divIcon({ className: '', html: `<div class="radar-pin">${arrow}📷</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function drawRadars() {
  radarLayer.clearLayers();
  for (const r of state.radars) {
    const m = L.marker([r.lat, r.lng], { icon: radarIcon(r) });
    const div = document.createElement('div');
    div.innerHTML = `<b>Radar</b><br>Eklendi: ${fmtDate(r.created)}` +
      (r.heading != null ? `<br>Yön: ${Math.round(r.heading)}°` : '<br>Yön: her iki yön');
    const del = document.createElement('button');
    del.className = 'popup-del';
    del.textContent = 'Bu radarı sil';
    del.onclick = () => deleteRadar(r.id);
    div.appendChild(del);
    m.bindPopup(div);
    radarLayer.addLayer(m);
  }
}

// Haritayı elle kaydırınca takip kapanır.
map.on('dragstart', () => setFollow(false));

function setFollow(on) {
  state.follow = on;
  $('btn-follow').classList.toggle('active', on);
  if (on && state.pos) map.setView([state.pos.lat, state.pos.lng], Math.max(map.getZoom(), 15));
}

/* Uzun basma ile radar ekleme (iPhone'da contextmenu olayı gelmediği için elle). */
(function longPress() {
  const el = map.getContainer();
  let timer = null, start = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return cancel();
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    cancel();
    timer = setTimeout(() => {
      timer = null;
      const ll = map.containerPointToLatLng(map.mouseEventToContainerPoint({ clientX: start.x, clientY: start.y }));
      addRadarAt(ll.lat, ll.lng, null, true);
    }, 650);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!start || !timer) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 12) cancel();
  }, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  map.on('contextmenu', (e) => addRadarAt(e.latlng.lat, e.latlng.lng, null, true)); // bilgisayarda sağ tık
})();

/* ---------------- Radar ekle / sil ---------------- */
function nearestRadar(lat, lng) {
  let best = null, bestD = Infinity;
  for (const r of state.radars) {
    const d = distance(lat, lng, r.lat, r.lng);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best ? { radar: best, d: bestD } : null;
}

async function addRadarAt(lat, lng, heading, ask) {
  if (ask && !confirm('Buraya radar eklensin mi?\n(Haritadan eklenen radar her iki yönde de uyarır.)')) return;
  const near = nearestRadar(lat, lng);
  if (near && near.d < DUPLICATE_RADIUS &&
      !confirm(`${Math.round(near.d)} m yakında zaten bir radar var. Yine de eklensin mi?`)) return;

  const r = {
    id: uid(),
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    heading: heading == null ? null : Math.round(heading),
    created: new Date().toISOString(),
  };
  state.radars.push(r);
  state.alerted.set(r.id, 0); // az önce eklediğin radar için hemen ötmesin
  await saveRadars();
  drawRadars();
  haptic('SUCCESS');
  toast('✅ Radar kaydedildi (toplam ' + state.radars.length + ')');
}

async function markHere() {
  if (!state.pos) { toast('Konum bekleniyor… GPS bulununca tekrar dene.'); return; }
  const h = state.pos.speed != null && state.pos.speed > 2 ? state.heading : null;
  await addRadarAt(state.pos.lat, state.pos.lng, h, false);
}

async function deleteRadar(id) {
  const r = state.radars.find((x) => x.id === id);
  if (!r) return;
  if (!confirm('Bu radar kalıcı olarak silinsin mi?')) return;
  state.radars = state.radars.filter((x) => x.id !== id);
  state.alerted.delete(id);
  if (state.active === id) hideAlert();
  map.closePopup();
  await saveRadars();
  drawRadars();
  toast('Radar silindi');
}

/* ---------------- Uyarı ---------------- */
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* ses yok */ }
}

function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.25, 0.5].forEach((dt, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = i === 2 ? 1320 : 990;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.22);
  });
}

function haptic(type) {
  if (Haptics) Haptics.notification({ type }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}

async function speak(text) {
  if (!state.settings.voice) return;
  if (Tts) {
    try { await Tts.speak({ text, lang: 'tr-TR', rate: 1.0, volume: 1.0, category: 'playback' }); return; }
    catch (e) { console.warn('tts', e); }
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

let notifId = 1;
function notify(body) {
  if (!Notif) return;
  Notif.schedule({ notifications: [{ id: notifId++, title: '⚠️ RADAR', body }] }).catch(() => {});
}

function triggerAlert(r, d) {
  state.active = r.id;
  showAlert(d);
  beep();
  haptic('WARNING');
  speak(`Dikkat! ${spokenDist(d)} ileride radar var.`);
  if (!state.appActive) notify(`${fmtDist(d)} ileride radar var`);
}

function showAlert(d) {
  $('alert-dist').textContent = fmtDist(d);
  $('alert').classList.remove('hidden');
}

function hideAlert() {
  state.active = null;
  $('alert').classList.add('hidden');
}

function headingOk(r, d) {
  if (!state.settings.heading || state.heading == null) return true;
  // Radar önümüzde mi? (yanından/arkasından geçtiysek uyarma)
  if (d > 80 && angleDiff(state.heading, bearing(state.pos.lat, state.pos.lng, r.lat, r.lng)) > 90) return false;
  // Radar yönlü işaretlendiyse aynı yönde mi gidiyoruz?
  if (r.heading != null && angleDiff(state.heading, r.heading) > HEADING_TOLERANCE) return false;
  return true;
}

function checkRadars() {
  const p = state.pos;
  if (!p) return;
  const limit = state.settings.distance;
  let nearest = Infinity;

  for (const r of state.radars) {
    const d = distance(p.lat, p.lng, r.lat, r.lng);
    if (d < nearest) nearest = d;

    if (d <= limit) {
      if (!state.alerted.has(r.id)) {
        if (headingOk(r, d)) {
          state.alerted.set(r.id, d);
          triggerAlert(r, d);
        }
      } else {
        const min = Math.min(state.alerted.get(r.id), d);
        state.alerted.set(r.id, min);
        if (state.active === r.id) {
          // Radarı geçtik: mesafe en yakın noktadan belirgin şekilde arttı.
          if (d > min + 60 && min < 300) hideAlert();
          else showAlert(d);
        }
      }
    } else {
      if (state.active === r.id) hideAlert();
      if (d > limit + REARM_EXTRA) state.alerted.delete(r.id);
    }
  }
  $('nearest').textContent = nearest === Infinity ? '--' : fmtDist(nearest);
}

/* ---------------- Konum ---------------- */
function onLocation(loc) {
  const p = {
    lat: loc.latitude,
    lng: loc.longitude,
    acc: loc.accuracy,
    speed: loc.speed != null && loc.speed >= 0 ? loc.speed : null,
    heading: loc.bearing != null && loc.bearing >= 0 ? loc.bearing : null,
  };

  // Yön: GPS verdiyse onu, vermediyse son iki noktadan hesapla.
  if (p.heading != null && (p.speed == null || p.speed > 1.5)) {
    state.heading = p.heading;
  } else if (state.lastPos && distance(state.lastPos.lat, state.lastPos.lng, p.lat, p.lng) > 15) {
    state.heading = bearing(state.lastPos.lat, state.lastPos.lng, p.lat, p.lng);
  }
  if (!state.lastPos || distance(state.lastPos.lat, state.lastPos.lng, p.lat, p.lng) > 15) state.lastPos = p;

  const first = !state.pos;
  state.pos = p;

  $('gps').className = 'gps on';
  $('speed').textContent = p.speed != null ? Math.round(p.speed * 3.6) : '--';

  meMarker.setLatLng([p.lat, p.lng]);
  accCircle.setLatLng([p.lat, p.lng]).setRadius(p.acc || 0);
  if (first) { meMarker.addTo(map); accCircle.addTo(map); }
  const cone = meMarker.getElement() && meMarker.getElement().querySelector('.cone');
  if (cone) {
    cone.style.display = state.heading == null ? 'none' : '';
    cone.style.transformOrigin = '7px 24px';
    cone.style.transform = `rotate(${state.heading || 0}deg)`;
  }

  if (state.appActive && (state.follow || first)) {
    map.setView([p.lat, p.lng], first ? 15 : map.getZoom(), { animate: !first });
  }

  checkRadars();
  retryTilesIfNeeded();
}

function onLocationError(err) {
  $('gps').className = 'gps off';
  if (err && err.code === 'NOT_AUTHORIZED') {
    if (confirm('Konum izni yok. Radar uyarısı için konum izni gerekli.\nAyarlar açılsın mı? (Konum › “Her Zaman” seç)')) {
      BgGeo.openSettings().catch(() => {});
    }
  }
}

async function startTracking() {
  if (BgGeo) {
    await BgGeo.addWatcher({
      backgroundTitle: 'Radar Uyarı çalışıyor',
      backgroundMessage: 'Radarlara yaklaşınca uyaracak.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 10,
    }, (loc, err) => (err ? onLocationError(err) : onLocation(loc)));
  } else if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (p) => onLocation({ ...p.coords, bearing: p.coords.heading }),
      () => { $('gps').className = 'gps off'; toast('Konum alınamadı'); },
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  } else {
    toast('Bu cihazda konum yok');
  }
}

/* ---------------- Menü ---------------- */
function renderRadars() {
  $('radar-count').textContent = state.radars.length;
  const list = $('radar-list');
  list.innerHTML = '';
  if (!state.radars.length) {
    list.innerHTML = '<div class="empty">Henüz radar yok. Yolda “RADAR İŞARETLE”ye bas ya da haritaya uzun bas.</div>';
    return;
  }
  const p = state.pos;
  const items = state.radars.map((r) => ({ r, d: p ? distance(p.lat, p.lng, r.lat, r.lng) : null }));
  if (p) items.sort((a, b) => a.d - b.d);
  else items.sort((a, b) => (b.r.created || '').localeCompare(a.r.created || ''));

  items.forEach(({ r, d }, i) => {
    const row = document.createElement('div');
    row.className = 'radar-item';
    row.innerHTML = `<div class="info"><div class="t">Radar ${i + 1}${d != null ? ' · ' + fmtDist(d) : ''}</div>` +
      `<div class="s">${fmtDate(r.created)} · ${r.heading != null ? 'tek yön' : 'iki yön'} · ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</div></div>`;
    const go = document.createElement('button');
    go.textContent = 'Göster';
    go.onclick = () => { closeMenu(); setFollow(false); map.setView([r.lat, r.lng], 16); };
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'Sil';
    del.onclick = () => deleteRadar(r.id);
    row.append(go, del);
    list.appendChild(row);
  });
}

function openMenu() {
  renderRadars();
  tileDb.count().then((n) => { $('tile-count').textContent = n; });
  $('menu').classList.remove('hidden');
}
function closeMenu() { $('menu').classList.add('hidden'); }

async function exportRadars() {
  const name = 'radarlar-' + new Date().toISOString().slice(0, 10) + '.json';
  const data = backupPayload();
  if (Fs && ShareP) {
    try {
      const w = await Fs.writeFile({ path: name, data, directory: 'CACHE', encoding: 'utf8' });
      await ShareP.share({ title: 'Radar yedeği', files: [w.uri] });
    } catch (e) {
      if (!String(e && e.message).toLowerCase().includes('cancel')) toast('Paylaşılamadı: ' + (e.message || e));
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = name;
  a.click();
}

async function importRadars(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.radars;
    if (!Array.isArray(list)) throw new Error('Geçersiz dosya');
    let added = 0;
    for (const r of list) {
      if (!isFinite(r.lat) || !isFinite(r.lng)) continue;
      if (state.radars.some((x) => x.id === r.id || distance(x.lat, x.lng, r.lat, r.lng) < 30)) continue;
      state.radars.push({
        id: r.id || uid(), lat: +r.lat, lng: +r.lng,
        heading: r.heading == null ? null : +r.heading,
        created: r.created || new Date().toISOString(),
      });
      added++;
    }
    await saveRadars();
    drawRadars();
    toast(added + ' radar eklendi (' + (list.length - added) + ' zaten vardı)');
  } catch (e) {
    toast('İçe aktarılamadı: ' + e.message);
  }
}

/* Görünen alanı çevrimdışı kullanım için indir. */
let offlineRunning = false;
async function downloadVisibleArea() {
  if (offlineRunning) { offlineRunning = false; return; }
  const b = map.getBounds();
  const z0 = Math.min(map.getZoom(), MAX_OFFLINE_ZOOM);
  const tiles = [];
  for (let z = Math.max(z0, 8); z <= MAX_OFFLINE_ZOOM; z++) {
    const p1 = map.project(b.getNorthWest(), z).divideBy(256).floor();
    const p2 = map.project(b.getSouthEast(), z).divideBy(256).floor();
    for (let x = p1.x; x <= p2.x; x++) for (let y = p1.y; y <= p2.y; y++) tiles.push([z, x, y]);
    if (tiles.length > MAX_OFFLINE_TILES) break;
  }
  if (tiles.length > MAX_OFFLINE_TILES) {
    toast('Alan çok büyük. Haritayı biraz daha yakınlaştırıp tekrar dene.', 4000);
    return;
  }
  if (!confirm(`${tiles.length} harita parçası indirilecek (yaklaşık ${Math.round(tiles.length * 15 / 1024)} MB). Wi-Fi önerilir. Devam?`)) return;

  offlineRunning = true;
  $('btn-offline').textContent = 'Durdur';
  let done = 0, fail = 0, i = 0;
  const prog = $('offline-progress');
  const worker = async () => {
    while (offlineRunning && i < tiles.length) {
      const [z, x, y] = tiles[i++];
      try {
        const key = z + '/' + x + '/' + y;
        if (!(await tileDb.get(key))) await tileDb.put(key, await downloadTile(z, x, y));
      } catch { fail++; }
      done++;
      prog.textContent = `İndiriliyor: ${done} / ${tiles.length}` + (fail ? ` (${fail} hata)` : '');
    }
  };
  await Promise.all([worker(), worker()]);
  prog.textContent = offlineRunning ? `Tamamlandı: ${done - fail} parça kaydedildi` + (fail ? `, ${fail} hata` : '') : 'Durduruldu';
  offlineRunning = false;
  $('btn-offline').textContent = 'Görünen alanı indir';
  tileDb.count().then((n) => { $('tile-count').textContent = n; });
}

/* ---------------- Olaylar ---------------- */
function bindUi() {
  $('btn-mark').onclick = markHere;
  $('btn-follow').onclick = () => setFollow(!state.follow);
  $('btn-menu').onclick = openMenu;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = closeMenu; });
  $('menu').addEventListener('click', (e) => { if (e.target.id === 'menu') closeMenu(); });

  const sd = $('set-distance'), sv = $('set-voice'), sh = $('set-heading');
  sd.value = String(state.settings.distance);
  sv.checked = state.settings.voice;
  sh.checked = state.settings.heading;
  sd.onchange = () => { state.settings.distance = +sd.value; state.alerted.clear(); saveSettings(); };
  sv.onchange = () => { state.settings.voice = sv.checked; saveSettings(); };
  sh.onchange = () => { state.settings.heading = sh.checked; saveSettings(); };

  $('btn-test').onclick = () => {
    unlockAudio();
    const d = state.settings.distance;
    showAlert(d);
    beep();
    haptic('WARNING');
    speak(`Dikkat! ${spokenDist(d)} ileride radar var.`);
    setTimeout(() => { if (!state.active) $('alert').classList.add('hidden'); }, 4000);
  };

  $('btn-export').onclick = exportRadars;
  $('btn-import').onclick = () => $('file-import').click();
  $('file-import').onchange = (e) => { const f = e.target.files[0]; if (f) importRadars(f); e.target.value = ''; };
  $('btn-offline').onclick = downloadVisibleArea;
  $('btn-clear-tiles').onclick = async () => {
    if (!confirm('Kayıtlı harita parçaları silinsin mi? (Radarların silinmez.)')) return;
    await tileDb.clear();
    $('tile-count').textContent = '0';
    toast('Harita önbelleği temizlendi');
  };

  $('btn-start').onclick = async () => {
    unlockAudio();
    $('start').classList.add('hidden');
    if (state.started) return;
    state.started = true;
    if (Notif) { try { await Notif.requestPermissions(); } catch { /* izin verilmedi */ } }
    try { await startTracking(); } catch (e) { toast('Konum başlatılamadı: ' + (e.message || e)); }
  };

  if (AppP) {
    Promise.resolve().then(() => AppP.addListener('appStateChange', ({ isActive }) => {
      state.appActive = isActive;
      if (isActive) {
        unlockAudio();
        if (state.follow && state.pos) map.setView([state.pos.lat, state.pos.lng]);
      }
    })).catch((e) => console.warn('appStateChange', e));
  } else {
    document.addEventListener('visibilitychange', () => { state.appActive = !document.hidden; });
  }
}

(async function init() {
  // Kayıt okuma takılırsa bile 4 sn sonra arayüz çalışsın.
  try {
    await Promise.race([loadData(), new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) {
    showFatal('Kayıt okunamadı: ' + (e.message || e));
  }
  bindUi();
  drawRadars();
  renderRadars();
})();
