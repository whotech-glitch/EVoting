/* ADMIN PAGE LOGIC (animated edition) */
let authed = false, view = 'dash', msg = '', q = '', focusQ = false, seen = false, animNext = true;
try { authed = sessionStorage.getItem(SK) === '1'; } catch (e) {}
const root = $('#root');
const adminPass = () => { try { return localStorage.getItem(PK) || DEFAULT_PASS; } catch (e) { return DEFAULT_PASS; } };
const PH = { setup: ['NOT OPENED YET', 'na'], open: ['OPEN', 'ok'], closed: ['CLOSED', 'bad'] };
const phasePill = () => `<span class="pill ${PH[S.phase][1]}">${PH[S.phase][0]}</span>`;
const flash = () => msg ? `<div class="err">${esc(msg)}</div>` : '';

function toast(t, bad) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = t; box.appendChild(d);
  setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3100);
}
function render() {
  const enter = animNext; animNext = false;
  root.innerHTML = authed ? shell(enter) : loginV();
  if (focusQ) { const el = $('#q'); if (el) { el.focus(); el.setSelectionRange(q.length, q.length); } }
  countUps(enter);
}
/* runs after every refresh from the database */
function onChange() {
  if (!seen) { seen = true; render(); return; }
  if (authed && (view === 'dash' || view === 'res')) render();
}
function go(k) { view = k; msg = ''; q = ''; focusQ = false; animNext = true; render(); }
/* run a database action, then show a toast (success) or a clear error */
async function act(fn, ok) {
  try { await fn(); msg = ''; if (ok) toast(ok); }
  catch (e) { msg = 'Failed: ' + (e.message || e) + '. Check your internet and try again.'; toast('Something went wrong', true); }
  render();
}

/* ---------- Login ---------- */
function loginV() {
  return `<div class="lg"><div class="lgbox"><div class="logo">🗳️</div><h1>Admin </h1><p class="mut">${esc(S.title)}</p>
    <label>Password</label><input id="ap" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')doLogin()">
    <button class="btn" onclick="doLogin()">Sign in</button>${flash()}</div></div>`;
}
function doLogin() {
  if ($('#ap').value.trim() === adminPass()) {
    authed = true; msg = ''; animNext = true;
    try { sessionStorage.setItem(SK, '1'); } catch (e) {}
  } else msg = 'Wrong password.';
  render();
}
function logout() { authed = false; try { sessionStorage.removeItem(SK); } catch (e) {} render(); }

function shell(enter) {
  const items = [['dash', '📊 Live Progress'], ['cands', '👥 Candidates'], ['setup', '🏫 Setup'], ['voters', '🧾 Voters'], ['res', '🏆 Results'], ['ctl', '⚙️ Control']];
  const v = { dash: vDash, cands: vCands, setup: vSetup, voters: vVoters, res: vRes, ctl: vCtl }[view];
  return `<header class="bar"><div class="brand"><span class="logo">🗳️</span><div><b>${esc(S.title)}</b><small>Admin </small></div></div>
    <div class="barR"><span class="live"><i></i><span class="on">Live</span><span class="offt">Offline</span></span><button class="btn ghost sm" onclick="logout()">Logout</button></div></header>
    <nav class="tabs">${items.map(([k, l]) => `<button class="${view === k ? 'on' : ''}" onclick="go('${k}')">${l}</button>`).join('')}</nav>
    <main class="page ${enter ? 'enter' : ''}">${loaded ? v() : `<div class="card">${netErr ? '⚠️ ' + esc(netErr) + ' Check your internet connection.' : 'Loading…'}</div>`}</main>`;
}

/* ---------- Live progress ---------- */
const RC = 2 * Math.PI * 52;
function ring(pct) {
  const to = RC * (1 - Math.min(100, pct) / 100), from = pv('ring', to, RC), r = Math.round(pct);
  return `<svg class="ring" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
    <circle class="rb" cx="60" cy="60" r="52"/><circle class="rf" cx="60" cy="60" r="52" style="--c:${RC};--from:${from};--to:${to}"/>
    <text class="rt" x="60" y="68" text-anchor="middle" data-count="${r}" data-key="ringpct" data-suf="%">${r}%</text></svg>`;
}
function chart(p) {
  const { cs, t } = tally(p), top = cs[0] ? cs[0].n : 0, leaders = cs.filter(c => c.n === top).length;
  const final = S.phase === 'closed' && t > 0;
  return `<div class="card"><h3>${esc(p)} <span class="mut">· ${t} vote(s)</span></h3><div class="race">` + cs.map((c, i) => {
    const w = t ? Math.round(c.n * 100 / t) : 0, lead = top > 0 && c.n === top;
    const label = lead ? (leaders > 1 ? '🤝 Tied' : final ? '🏆 Winner' : '🏆 Leading') : (final ? 'Lost' : 'Trailing');
    return `<div class="rw ${!top ? 'na' : lead ? 'lead' : 'lag'}"><span class="rank">${i + 1}</span><div class="ph">${av(c)}</div>
      <div class="rg"><div class="rn">${esc(c.name)} <span class="tag ${!top ? 'na' : lead ? 'ok' : 'bad'}">${!top ? 'No votes' : label}</span></div>
      <div class="track"><i class="fill" style="width:${w}%;--from:${pv('b' + c.id, w, 0)}%"></i></div></div>
      <div class="cnt"><span data-count="${c.n}" data-key="c${c.id}">${c.n}</span><small>${w}%</small></div></div>`;
  }).join('') + `</div></div>`;
}
function groupBars(title, list, field) {
  const vs = Object.values(S.voted), cast = vs.length;
  let counted = 0;
  const rows = list.map(g => {
    const c = vs.filter(v => norm(v[field]) === norm(g.name)).length; counted += c;
    const w = g.n ? Math.min(100, Math.round(c * 100 / g.n)) : (cast ? Math.round(c * 100 / cast) : 0);
    const lab = g.n ? `${c} / ${g.n} (${Math.round(c * 100 / g.n)}%)` : `${c}`;
    return `<div class="bar"><span>${esc(g.name)}</span><div class="t"><i style="width:${w}%;--from:${pv(field + g.name, w, 0)}%"></i></div><b>${lab}</b></div>`;
  });
  if (cast - counted > 0) rows.push(`<div class="bar"><span>Not in list</span><div class="t"><i style="width:0"></i></div><b>${cast - counted}</b></div>`);
  return `<div class="card"><h3>${title}</h3>${rows.join('') || '<p class="mut">Add them in the Setup tab.</p>'}</div>`;
}
function vDash() {
  const cast = Object.keys(S.voted).length, tot = S.total, pct = tot ? Math.min(100, cast * 100 / tot) : 0;
  return `<h1>Live Voting Progress</h1><div class="hero4">
    <div class="stat ringcard">${ring(pct)}<span>Turnout</span></div>
    <div class="stat"><b><span data-count="${cast}" data-key="cast">${cast}</span>${tot ? ` <small class="mut">/ ${tot}</small>` : ''}</b><span>Votes cast</span></div>
    <div class="stat"><b>${tot ? `<span data-count="${Math.max(tot - cast, 0)}" data-key="left">${Math.max(tot - cast, 0)}</span>` : '—'}</b><span>Yet to vote</span></div>
    <div class="stat"><b style="font-size:1rem;padding:6px 0">${phasePill()}</b><span>Voting status</span></div></div>` +
    (!tot ? `<div class="card"><span class="mut">Set the total number of students in the <a href="#" style="color:#22d3ee" onclick="go('setup');return false">Setup tab</a> to see turnout.</span></div>` : '') +
    (tot && cast > tot ? `<div class="err">Votes cast (${cast}) exceed registered students (${tot}). Check the total in Setup.</div>` : '') +
    (positions().map(chart).join('') || '<div class="card">Add candidates to see the live race.</div>') +
    `<div class="grid2">${groupBars('Turnout by class', S.classes, 'cls')}${groupBars('Turnout by department', S.depts, 'dept')}</div>`;
}

/* ---------- Candidates ---------- */
function vCands() {
  const opts = [...new Set(['SRC President', 'Vice President', 'General Secretary', 'Financial Secretary', 'Organizer', ...positions()])];
  return `<h1>Candidates</h1><div class="card"><h3>Add a candidate</h3><div class="grid2">
    <div><label>Full name</label><input id="cn"></div>
    <div><label>Position</label><input id="cps" list="pl" placeholder="e.g. SRC President"><datalist id="pl">${opts.map(x => `<option>${esc(x)}</option>`).join('')}</datalist></div>
    <div><label>Profile picture</label><input id="cp" type="file" accept="image/*"></div></div>
    <button class="btn" onclick="addC()">Add candidate</button>${flash()}</div>
    <div class="card"><h3>All candidates (${S.cands.length})</h3><div class="cgrid">
    ${S.cands.map(c => `<div class="cc"><div class="ph">${av(c)}</div><b>${esc(c.name)}</b><div class="mut">${esc(c.pos)} · ${S.votes.filter(v => v[c.pos] === c.id).length} vote(s)</div>
      <button class="btn red sm" onclick="delC('${c.id}')">Delete</button></div>`).join('') || '<p class="mut">No candidates yet.</p>'}</div></div>`;
}
function addC() {
  const f = $('#cp').files[0], n = $('#cn').value.trim(), p = $('#cps').value.trim();
  if (!n || !p) { msg = 'Name and position are required.'; return render(); }
  if (S.cands.some(c => norm(c.name) === norm(n) && norm(c.pos) === norm(p))) { msg = 'That candidate is already added for this position.'; return render(); }
  if (S.phase === 'open' && Object.keys(S.voted).length && !confirm('Voting is open and votes exist. Adding a candidate now is unfair to earlier voters. Continue?')) return;
  const fin = ph => act(() => addCand({ name: n, pos: p, photo: ph }), 'Candidate added ✓');
  if (!f) return fin('');
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 160 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * s; c.height = im.height * s;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      fin(c.toDataURL('image/jpeg', .8));
    };
    im.onerror = () => { msg = 'That picture could not be read. Try a different image.'; render(); };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}
function delC(id) {
  const c = S.cands.find(x => x.id === id); if (!c) return;
  const n = S.votes.filter(v => v[c.pos] === id).length;
  if (!confirm(`Delete ${c.name}?` + (n ? ` They already have ${n} vote(s), which will no longer count.` : ''))) return;
  act(() => delCand(id), 'Candidate deleted');
}

/* ---------- Setup ---------- */
function groupPanel(kind, label) {
  const L = S[kind], sum = L.reduce((a, g) => a + (g.n || 0), 0);
  return `<div class="card"><h3>${label}</h3><div class="grid2">
    <div><label>Name</label><input id="gn_${kind}" placeholder="${kind === 'classes' ? 'e.g. JHS 3A' : 'e.g. Science'}"></div>
    <div><label>Number of students</label><input id="gc_${kind}" type="number" min="0"></div></div>
    <button class="btn" onclick="addGroup('${kind}')">Add</button>
    <div class="tw"><table><tr><th>Name</th><th>Students</th><th></th></tr>
    ${L.map((g, i) => `<tr><td>${esc(g.name)}</td><td>${g.n || 0}</td><td><button class="btn sm ghost" onclick="editGroup('${kind}',${i})">Edit count</button>
      <button class="btn red sm" onclick="delGroup('${kind}',${i})">Delete</button></td></tr>`).join('') || '<tr><td colspan="3" class="mut">None added yet.</td></tr>'}</table></div>
    ${L.length ? `<p class="mut">Total across ${label.toLowerCase()}: ${sum}${S.total && sum !== S.total ? ` — does not match the registered total (${S.total})` : ''}</p>` : ''}</div>`;
}
function vSetup() {
  return `<h1>Setup</h1>${flash()}
    <div class="grid2"><div class="card"><h3>Election</h3><label>Election title</label><input id="et" value="${esc(S.title)}">
    <label>Total registered students (eligible voters)</label><input id="tt" type="number" min="0" value="${S.total || ''}">
    <button class="btn" onclick="saveBasics()">Save</button></div>
    <div class="card"><h3>Quick start</h3><p class="mut">Add JHS 1–3 and the usual departments (with 0 students). You can edit the counts afterwards.</p>
    <button class="btn" onclick="fillDefaults()">Add default classes &amp; departments</button></div></div>
    ${groupPanel('classes', 'Classes')}${groupPanel('depts', 'Departments')}
    <div class="card"><h3>Change admin password</h3><p class="mut">The new password is kept on this device only.</p>
    <label>Current password</label><input id="pw0" type="password">
    <label>New password (min 6 characters)</label><input id="pw1" type="password">
    <label>Confirm new password</label><input id="pw2" type="password">
    <button class="btn" onclick="changePass()">Update password</button></div>`;
}
function saveBasics() {
  const t = parseInt($('#tt').value, 10), title = $('#et').value.trim();
  if (isNaN(t) || t < 0) { msg = 'Enter a valid number of students.'; return render(); }
  act(() => saveCfg({ total: t, title: title || S.title }), 'Saved ✓');
}
function addGroup(k) {
  const n = $('#gn_' + k).value.trim(), c = parseInt($('#gc_' + k).value, 10);
  if (!n || isNaN(c) || c < 0) { msg = 'Enter a name and a valid number of students.'; return render(); }
  if (S[k].some(g => norm(g.name) === norm(n))) { msg = `"${n}" already exists.`; return render(); }
  act(() => saveCfg({ [k]: [...S[k], { name: n, n: c }] }), 'Added ✓');
}
function editGroup(k, i) {
  const v = prompt(`Number of students in ${S[k][i].name}:`, S[k][i].n || 0);
  if (v === null) return;
  const c = parseInt(v, 10);
  if (isNaN(c) || c < 0) { msg = 'Invalid number.'; return render(); }
  const L = S[k].map(g => ({ ...g })); L[i].n = c;
  act(() => saveCfg({ [k]: L }), 'Updated ✓');
}
function delGroup(k, i) {
  if (!confirm(`Delete "${S[k][i].name}"? Voters already recorded under it will show as "Not in list".`)) return;
  act(() => saveCfg({ [k]: S[k].filter((_, j) => j !== i) }), 'Deleted');
}
function fillDefaults() {
  const add = (L, names) => [...L, ...names.filter(n => !L.some(g => norm(g.name) === norm(n))).map(n => ({ name: n, n: 0 }))];
  act(() => saveCfg({ classes: add(S.classes, DEFAULT_CLASSES), depts: add(S.depts, DEFAULT_DEPTS) }), 'Defaults added ✓');
}
function changePass() {
  const a = $('#pw0').value, b = $('#pw1').value, c = $('#pw2').value;
  if (a !== adminPass()) msg = 'Current password is wrong.';
  else if (b.length < 6) msg = 'New password must be at least 6 characters.';
  else if (b !== c) msg = 'New passwords do not match.';
  else { try { localStorage.setItem(PK, b); msg = ''; toast('Password updated ✓'); } catch (e) { msg = 'Could not save the password on this device.'; } return render(); }
  render();
}

/* ---------- Voters (who voted, never what they voted for) ---------- */
function vVoters() {
  const all = Object.entries(S.voted).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)), s = norm(q);
  const rows = all.filter(([id, v]) => !s || norm(id).includes(s) || norm(v.cls).includes(s) || norm(v.dept).includes(s));
  return `<h1>Voters</h1><div class="card"><h3>${all.length} voted${S.total ? ` of ${S.total}` : ''}</h3>
    <input id="q" placeholder="Search index number, class or department" value="${esc(q)}" oninput="q=this.value;focusQ=true;render()">
    <button class="btn sm" style="margin-top:12px" onclick="exportVoters()">Download CSV</button>
    <div class="tw"><table><tr><th>#</th><th>Index number</th><th>Class</th><th>Department</th><th>Time</th></tr>
    ${rows.map(([id, v], i) => `<tr style="animation-delay:${Math.min(i, 12) * 30}ms"><td>${i + 1}</td><td>${esc(id)}</td><td>${esc(v.cls || '')}</td><td>${esc(v.dept || '')}</td>
      <td>${v.t ? new Date(v.t).toLocaleString() : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No voters found.</td></tr>'}</table></div>
    <p class="mut">Ballots are not linked to voters, so a vote cannot be traced or undone per person.</p></div>`;
}

/* ---------- Results ---------- */
function vRes() {
  const ps = positions(), cast = Object.keys(S.voted).length;
  return `<h1>Results</h1><div class="card"><p>Voting: ${phasePill()} &nbsp; Results: <span class="pill ${S.published ? 'ok' : 'na'}">${S.published ? 'PUBLISHED' : 'HIDDEN'}</span></p>
    <p>Turnout: <b>${cast}${S.total ? ' / ' + S.total + ' (' + Math.round(cast * 1000 / S.total) / 10 + '%)' : ''}</b></p>
    <button class="btn" onclick="exportResults()">Download CSV</button><button class="btn" onclick="window.print()">Print</button>
    ${S.phase === 'open' ? '<p class="mut">Voting is still open. These are provisional results.</p>' : ''}</div>` +
    (ps.map(p => {
      const { cs, t } = tally(p), top = cs[0] ? cs[0].n : 0, leaders = cs.filter(c => c.n === top).length;
      return `<div class="card"><h3>${esc(p)}</h3>
        ${top ? `<div class="winbanner"><div class="ph">${av(cs[0])}</div><div><b>${leaders > 1 ? '🤝 TIE at the top' : '👑 ' + esc(cs[0].name)}</b><div class="mut">${leaders > 1 ? cs.filter(c => c.n === top).map(c => esc(c.name)).join(' & ') : (S.phase === 'open' ? 'Currently leading' : 'WINNER')} · ${top} vote(s)</div></div></div>` : ''}
        <div class="tw"><table><tr><th>Candidate</th><th>Votes</th><th>%</th><th></th></tr>
        ${cs.map(c => `<tr><td>${esc(c.name)}</td><td>${c.n}</td><td>${t ? Math.round(c.n * 1000 / t) / 10 : 0}%</td>
        <td>${top && c.n === top ? `<span class="pill ok">${leaders > 1 ? 'TIE' : 'WINNER'}</span>` : ''}</td></tr>`).join('')}</table></div>
        <p class="mut">${t} vote(s) for this position${cast > t ? ` · ${cast - t} voter(s) skipped it` : ''}</p></div>`;
    }).join('') || '<div class="card">No candidates yet.</div>');
}

/* ---------- Control ---------- */
const voterLink = () => new URL('./', location.href).href;
function vCtl() {
  const icon = { setup: '⏳', open: '🟢', closed: '🔒' }[S.phase];
  return `<h1>Election Control</h1>${flash()}
    <div class="grid2"><div class="card"><h3>Voting</h3><div class="switch"><div class="orbit ${S.phase}">${icon}</div><div>${phasePill()}
    <div class="mut">${S.phase === 'setup' ? 'Voters see "Voting has not been opened yet".' : S.phase === 'open' ? 'Voters can vote now.' : 'Voters see that voting has ended.'}</div></div></div>
    ${S.phase !== 'open' ? `<button class="btn ok" onclick="setPhase('open')">${S.phase === 'closed' ? 'Re-open voting' : 'Open voting'}</button>` : `<button class="btn red" onclick="setPhase('closed')">Close voting</button>`}</div>
    <div class="card"><h3>Results</h3><p>Status: <span class="pill ${S.published ? 'ok' : 'na'}">${S.published ? 'PUBLISHED' : 'HIDDEN'}</span></p>
    <p class="mut">Close voting first, then collate and publish so students can see the results.</p>
    <button class="btn" onclick="togglePub()">${S.published ? 'Unpublish results' : 'Collate & publish results'}</button></div></div>
    <div class="grid2"><div class="card"><h3>Voters' link</h3><p class="mut">Share this link with students:</p><div class="link">${esc(voterLink())}</div>
    <button class="btn" onclick="copyLink()">Copy link</button></div>
    
    <div class="card"><h3>Backup</h3><p class="mut">Download a backup before and after the election.</p>
    <button class="btn" onclick="backup()">Download backup</button>
    <label>Restore from backup file</label><input type="file" accept=".json" onchange="restore(this)"></div>
    <div class="card"><h3>Danger zone</h3>
    <button class="btn red" onclick="doResetVotes()">Reset votes</button><button class="btn red" onclick="doResetAll()">Reset everything</button>
    <p class="mut">Reset everything deletes candidates and votes but keeps your setup (students, classes, departments).</p></div>`;
}
function setPhase(p) {
  if (p === 'open' && !positions().length) { msg = 'Add candidates before opening voting.'; return render(); }
  if (p === 'closed' && !confirm('Close voting now?')) return;
  act(() => saveCfg(p === 'open' ? { phase: p, published: false } : { phase: p }), p === 'open' ? 'Voting is now open 🟢' : 'Voting is now closed 🔒');
}
function togglePub() {
  if (S.phase !== 'closed' && !S.published) return alert('Close voting before publishing results.');
  act(() => saveCfg({ published: !S.published }), S.published ? 'Results hidden' : 'Results published 🏆');
}
function copyLink() {
  const l = voterLink();
  if (navigator.clipboard) navigator.clipboard.writeText(l).then(() => toast('Link copied ✓'), () => prompt('Copy this link:', l));
  else prompt('Copy this link:', l);
}
function doResetVotes() {
  if (prompt('This deletes ALL votes and voter records. Type RESET to confirm.') !== 'RESET') return;
  act(resetVotes, 'Votes reset');
}
function doResetAll() {
  if (prompt('This deletes ALL candidates and votes. Type RESET to confirm.') !== 'RESET') return;
  act(resetAll, 'Everything reset');
}
function importFirst() {
  if (!confirm('Replace everything in this election with the setup and candidates from the first election?')) return;
  act(async () => {
    const r = await fetch(FIRST_DB + '/election.json');
    if (!r.ok) throw new Error('Could not read the first election (' + r.status + ')');
    const d = await r.json();
    if (!d) throw new Error('The first election has no data yet');
    const s = fromRemote(d);
    await write(() => fb('/election', 'PUT', fullBody({ ...s, voted: {}, votes: [], phase: 'setup', published: false })));
  }, 'Imported from the first election ✓');
}

/* ---------- Export / backup ---------- */
function dl(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
const csv = rows => rows.map(r => r.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(',')).join('\n');
function exportResults() {
  const rows = [['Position', 'Candidate', 'Votes', 'Percent']];
  positions().forEach(p => { const { cs, t } = tally(p); cs.forEach(c => rows.push([p, c.name, c.n, t ? Math.round(c.n * 1000 / t) / 10 : 0])); });
  dl('election-results.csv', csv(rows));
}
function exportVoters() {
  const rows = [['Index number', 'Class', 'Department', 'Time']];
  Object.entries(S.voted).forEach(([id, v]) => rows.push([id, v.cls, v.dept, v.t ? new Date(v.t).toLocaleString() : '']));
  dl('voters.csv', csv(rows));
}
function backup() { dl('election-backup.json', JSON.stringify(S), 'application/json'); }
function restore(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let d;
    try { d = JSON.parse(r.result); if (!d || !Array.isArray(d.cands) || !Array.isArray(d.votes)) throw 0; }
    catch (e) { msg = 'That is not a valid backup file.'; return render(); }
    if (!confirm('Replace ALL current data with this backup?')) return;
    act(() => restoreAll(d), 'Backup restored ✓');
  };
  r.readAsText(f);
}

render();
