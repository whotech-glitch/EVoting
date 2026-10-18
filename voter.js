/* VOTER PAGE LOGIC */
let me = null, done = false, msg = '', tab = 'vote';
const app = document.getElementById('app'), nav = document.getElementById('nav');

function render() {
  S = load();
  nav.innerHTML = [['vote', '🗳️ Vote'], ['results', '🏆 Results']]
    .map(([v, l]) => `<button class="${tab === v ? 'on' : ''}" onclick="tab='${v}';msg='';render()">${l}</button>`).join('');
  app.innerHTML = tab === 'vote' ? vVote() : vResults();
}

function vVote() {
  if (done) return `<div class="card thanks"><div class="big">🎉</div><h2>Thank you for voting!</h2>
    <p class="mut">Your vote has been recorded. Check the Results tab after the admin publishes the results.</p>
    <button class="btn" onclick="done=false;me=null;render()">Done</button></div>`;
  if (!S.open) return `<div class="card thanks"><div class="big">${S.published ? '🔒' : '⏳'}</div>
    <h2>Voting is ${S.published ? 'closed' : 'not open yet'}</h2>
    <p class="mut">${S.published ? 'Results have been published. Open the Results tab.' : 'Please wait for the election officer to open voting.'}</p></div>`;
    if (!me) {
    const cls = S.classes || [], dps = S.depts || [];
    if (!cls.length || !dps.length) return `<div class="card thanks"><div class="big">🛠️</div><h2>Election not fully set up</h2>
      <p class="mut">Please wait for the admin to finish setup.</p></div>`;
    return `<div class="steps"><span class="on"></span><span></span></div>
    <div class="card"><h2>Step 1: Verify yourself</h2><p class="mut">Enter your details to get your ballot.</p>
    <label class="f">Index Number</label><input id="ix" placeholder="e.g. 0123456789" autocomplete="off">
    <label class="f">Class</label><select id="cl">${cls.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
    <label class="f">Department</label><select id="dp">${dps.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
    <button class="btn" onclick="login()">Continue →</button>${msg ? `<div class="err">${msg}</div>` : ''}</div>`;
  }
  const ps = positions();
  if (!ps.length) return `<div class="card"><p>No candidates have been added yet.</p></div>`;
  return `<div class="steps"><span class="on"></span><span class="on"></span></div>
    <div class="card"><h2>Step 2: Cast your vote</h2><p class="mut">Index ${esc(me.idx)} · ${esc(me.cls)} · ${esc(me.dept)}<br>Tap one candidate for each position.</p></div>` +
    ps.map((p, i) => `<div class="card"><h3>${esc(p)}</h3><div class="cands">${S.cands.filter(c => c.pos === p).map(c =>
      `<label class="cand">${av(c)}<b>${esc(c.name)}</b><input type="radio" name="p${i}" value="${c.id}"></label>`).join('')}</div></div>`).join('') +
    `${msg ? `<div class="err">${msg}</div>` : ''}<button class="btn gold" onclick="submitVote()">Submit My Vote</button>
    <button class="btn ghost" onclick="me=null;msg='';render()">Cancel</button>`;
}

function login() {
  S = load();
  const idx = document.getElementById('ix').value.trim().toUpperCase();
  if (idx.length < 3) { msg = 'Please enter a valid index number.'; return render(); }
  if (S.voted[idx]) { msg = 'This index number has already voted. Each student can vote only once.'; return render(); }
  me = { idx, cls: document.getElementById('cl').value, dept: document.getElementById('dp').value };
  msg = ''; render();
}

function submitVote() {
  S = load();
  if (!S.open) { msg = 'Voting has been closed.'; return render(); }
  if (S.voted[me.idx]) { msg = 'This index number has already voted.'; return render(); }
  const v = {}, ps = positions();
  for (let i = 0; i < ps.length; i++) {
    const r = document.querySelector(`input[name=p${i}]:checked`);
    if (!r) { msg = 'Please choose a candidate for: ' + esc(ps[i]); return render(); }
    v[ps[i]] = r.value;
  }
  S.votes.push(v);
  S.voted[me.idx] = { cls: me.cls, dept: me.dept, t: Date.now() };
  save(); msg = ''; done = true; render();
}

function vResults() {
  if (!S.published) return `<div class="card thanks"><div class="big">📭</div><h2>Results not published yet</h2>
    <p class="mut">The admin will publish the results after the votes are collated.</p></div>`;
  return `<div class="card thanks"><h2>Official Results</h2><p class="mut">Total voters: ${Object.keys(S.voted).length}</p></div>` +
    positions().map(p => {
      const { cs, t } = tally(p), top = cs[0] ? cs[0].n : 0;
      return `<div class="card"><h3>${esc(p)}</h3>` + cs.map(c => {
        const pc = t ? Math.round(c.n * 100 / t) : 0, win = top > 0 && c.n === top;
        return `<div class="res ${win ? 'win' : ''}">${av(c)}<div class="g"><div class="nm">${esc(c.name)}${win ? '<span class="crown">👑 WINNER</span>' : ''}</div>
          <div class="track"><i style="width:${pc}%"></i></div></div><b>${c.n}<br><small class="mut">${pc}%</small></b></div>`;
      }).join('') + `</div>`;
    }).join('');
}

render();
window.addEventListener('storage', e => { if (e.key === K && !me) render(); });
