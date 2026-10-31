

const DB_URL = 'https://adubiase-jhs-2-default-rtdb.europe-west1.firebasedatabase.app';


const DB = DB_URL.trim().replace(/\/+$/, '');
const PK = 'adubia2_admin_pass', SK = 'adubia2_adm', DEFAULT_PASS = 'admin123';
const DEFAULT_CLASSES = ['JHS 1', 'JHS 2', 'JHS 3'];
const DEFAULT_DEPTS = ['General Arts', 'Science', 'Business', 'Visual Arts', 'Home Economics', 'Agriculture'];
const IS_ADMIN = document.body.dataset.page === 'admin';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').trim().toLowerCase();
const fbKey = s => String(s).trim().toUpperCase().replace(/[.$#\[\]\/\s]/g, '_');
const arr = x => Array.isArray(x) ? x.filter(Boolean) : Object.values(x || {});

/* ---------- on-screen error bar + connection badge (problems are visible, never silent) ---------- */
function showErr(m) {
  let b = document.getElementById('errbar');
  if (!b) {
    b = document.createElement('div'); b.id = 'errbar';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#be123c;color:#fff;font:14px system-ui,sans-serif;padding:8px 12px';
    (document.body || document.documentElement).appendChild(b);
  }
  b.textContent = m;
}
window.addEventListener('error', e => showErr('Error: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ' line ' + e.lineno + ')'));
window.addEventListener('unhandledrejection', e => showErr('Error: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
function setStatus(ok) { document.body.dataset.net = ok ? 'live' : 'off'; }

/* ---------- animation helpers shared by both pages ---------- */
const cprev = {}, pprev = {};
/* floating background particles */
(function () {
  const bg = document.querySelector('.bg'); if (!bg) return;
  for (let i = 0; i < 16; i++) {
    const d = document.createElement('i'); d.className = 'dot'; const s = 3 + Math.random() * 5;
    d.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${14 + Math.random() * 18}s;animation-delay:${-Math.random() * 20}s`;
    bg.appendChild(d);
  }
})();
/* previous value of an animated thing, so bars and rings glide from old to new instead of jumping */
function pv(key, to, dflt) { const f = pprev[key] == null ? dflt : pprev[key]; pprev[key] = to; return f; }
/* numbers count up: elements marked data-count / data-key (and optional data-suf) */
function countUps(enter) {
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, suf = el.dataset.suf || '', key = el.dataset.key;
    const from = enter ? 0 : (cprev[key] == null ? to : cprev[key]); cprev[key] = to;
    if (from === to) { el.textContent = to + suf; return; }
    el.textContent = from + suf;
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- state ---------- */
const emptyState = () => ({ phase: 'setup', published: false, title: 'Adubia JHS E-Election', total: 0, classes: [], depts: [], cands: [], voted: {}, votes: [] });
let S = emptyState(), loaded = false, netErr = '', ver = 0, busy = 0, ticking = false, lastFull = 0;

function fromRemote(d) {
  const cands = Object.entries(d.cands || {}).map(([id, c]) => ({ ...c, id })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const votes = Object.values(d.votes || {}).map(r => Object.fromEntries(arr(r && r.b)));
  return {
    phase: d.phase || 'setup', published: !!d.published, title: d.title || 'Adubia JHS E-Election',
    total: parseInt(d.total, 10) || 0, classes: arr(d.classes), depts: arr(d.depts), cands, voted: d.voted || {}, votes
  };
}

/* ---------- Firebase REST ---------- */
async function fb(path, method, body, headers, q) {
  const r = await fetch(DB + path + '.json' + (q || ''), { method: method || 'GET', headers: headers || {}, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) { const e = new Error('Server said ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function pull() {
  const v = ver, d = await fb('/election');
  if (v !== ver) return;                       // something was saved meanwhile: this copy is stale
  S = fromRemote(d || {}); loaded = true; netErr = ''; lastFull = Date.now(); setStatus(true);
  if (typeof onChange === 'function') onChange();
}
async function tick() {
  if (ticking || busy) return;
  ticking = true;
  try {
    let need = IS_ADMIN || !loaded || Date.now() - lastFull > 30000;
    if (!need) {   // voters: tiny check; download everything only when something important changed
      const m = (await fb('/election', 'GET', undefined, undefined, '?shallow=true')) || {};
      need = (m.phase || 'setup') !== S.phase || !!m.published !== S.published;
      setStatus(true);
    }
    if (need) await pull();
  } catch (e) {
    netErr = 'Cannot reach the election server.'; setStatus(false);
    if (typeof onChange === 'function') onChange();
  } finally { ticking = false; }
}
tick(); setInterval(tick, IS_ADMIN ? 3000 : 4000);

/* ---------- writes (admin) ---------- */
async function write(fn) {
  busy++; ver++;
  try { await fn(); } finally { busy--; }
  try { await pull(); } catch (e) {}
}
const saveCfg = p => write(() => fb('/election', 'PATCH', p));
const addCand = c => write(() => fb('/election/cands/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), 'PUT',
  { name: c.name, pos: c.pos, photo: c.photo || '', ts: Date.now() }));
const delCand = id => write(() => fb('/election/cands/' + id, 'DELETE'));
const resetVotes = () => write(async () => {
  await fb('/election/votes', 'DELETE'); await fb('/election/voted', 'DELETE'); await fb('/election', 'PATCH', { published: false });
});
const resetAll = () => write(async () => {
  await fb('/election/cands', 'DELETE'); await fb('/election/votes', 'DELETE'); await fb('/election/voted', 'DELETE');
  await fb('/election', 'PATCH', { published: false, phase: 'setup' });
});
function fullBody(d) {
  const cands = {}; (d.cands || []).forEach((c, i) => cands[c.id || ('c' + i)] = { name: c.name, pos: c.pos, photo: c.photo || '', ts: c.ts || i });
  const voted = {}; Object.entries(d.voted || {}).forEach(([k, v]) => voted[fbKey(k)] = v);
  const votes = {}; (d.votes || []).forEach((v, i) => votes['v' + i.toString(36) + Math.random().toString(36).slice(2, 5)] = { b: Object.entries(v) });
  return { phase: d.phase || 'setup', published: !!d.published, title: d.title, total: d.total || 0, classes: d.classes || [], depts: d.depts || [], cands, voted, votes };
}
const restoreAll = d => write(() => fb('/election', 'PUT', fullBody(d)));

/* ---------- voting: one vote per index number (the database enforces it) ---------- */
async function hasVoted(idx) {
  try { return (await fb('/election/voted/' + idx)) !== null; } catch (e) { return false; }   // the server re-checks when the vote is submitted
}
async function claim(idx, rec) {
  try { await fb('/election/voted/' + idx, 'PUT', rec, { 'if-match': 'null_etag' }); return true; }
  catch (e) {
    if (e.status === 412) return false;                       // already voted
    if (e.status === undefined) {                             // browser blocked the conditional header: safe fallback
      if ((await fb('/election/voted/' + idx)) !== null) return false;
      await fb('/election/voted/' + idx, 'PUT', rec); return true;
    }
    throw e;
  }
}
async function castVote(idx, rec, ballot) {
  if ((await fb('/election/phase')) !== 'open') { const e = new Error('closed'); e.closed = true; throw e; }
  if (!(await claim(idx, rec))) return false;
  const row = { b: Object.entries(ballot) };
  try { await fb('/election/votes', 'POST', row); }
  catch (e1) {
    try { await fb('/election/votes', 'POST', row); }
    catch (e2) { try { await fb('/election/voted/' + idx, 'DELETE'); } catch (e3) {} throw e2; }
  }
  return true;
}

/* ---------- helpers ---------- */
const positions = () => [...new Set(S.cands.map(c => c.pos))];
function tally(p) {
  const cs = S.cands.filter(c => c.pos === p).map(c => ({ ...c, n: S.votes.filter(v => v[p] === c.id).length }));
  cs.sort((a, b) => b.n - a.n);
  return { cs, t: cs.reduce((a, c) => a + c.n, 0) };
}
const av = c => c.photo
  ? `<img class="av" src="${c.photo}" alt="">`
  : `<span class="av">${esc(String(c.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>`;
