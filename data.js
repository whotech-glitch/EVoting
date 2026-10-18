/* Shared data layer used by BOTH the voter page and the admin page */
const K = 'adubia_src_v1';
const CLASSES = ['JHS 1', 'JHS 2', 'JHS 3'];
const DEPTS = ['General Arts', 'Science', 'Business', 'Visual Arts', 'Home Economics', 'Agriculture'];

function load() {
  try { const r = localStorage.getItem(K); if (r) return JSON.parse(r); } catch (e) {}
  return { cands: [], votes: [], voted: {}, open: false, published: false };
}
function save() { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} }
let S = load();

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const positions = () => [...new Set(S.cands.map(c => c.pos))];
function tally(p) {
  const cs = S.cands.filter(c => c.pos === p).map(c => ({ ...c, n: S.votes.filter(v => v[p] === c.id).length }));
  cs.sort((a, b) => b.n - a.n);
  return { cs, t: cs.reduce((a, c) => a + c.n, 0) };
}
const av = c => c.photo
  ? `<img class="av" src="${c.photo}" alt="">`
  : `<span class="av">${esc(c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>`;
