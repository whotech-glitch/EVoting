/* VOTER PAGE LOGIC (animated edition) */
let view = 'home', lastVote = 'home', me = null, step = 0, dir = 1, pick = {}, msg = '', sending = false, sig = '', animNext = true;
const app = $('#app'), nav = $('#nav');
const VOTING = ['home', 'login', 'ballot', 'review', 'thanks'];

const lists = () => ({
  cls: S.classes.length ? S.classes.map(c => c.name) : DEFAULT_CLASSES,
  dps: S.depts.length ? S.depts.map(d => d.name) : DEFAULT_DEPTS
});
function liveInfo() {
  if (!loaded) return netErr ? ['off', 'Offline'] : ['wait', 'Connecting'];
  return { setup: ['wait', 'Waiting for admin'], open: ['open', 'Voting open'], closed: ['shut', 'Voting closed'] }[S.phase];
}
function render() {
  $('#ttl').textContent = S.title;
  const [c, t] = liveInfo(), lp = $('#live'); lp.className = 'livepill ' + c; lp.innerHTML = '<i></i>' + t;
  nav.innerHTML = `<button class="${VOTING.includes(view) ? 'on' : ''}" onclick="tabVote()"><span>🗳️</span>Vote</button><button class="${view === 'results' ? 'on' : ''}" onclick="go('results')"><span>🏆</span>Results</button>`;
  const enter = animNext; animNext = false;
  app.className = enter ? 'enter' : '';
  app.innerHTML = ({ home: vHome, login: vLogin, ballot: vBallot, review: vReview, thanks: vThanks, results: vResults })[view]();
  countUps(enter);
  if (view === 'thanks' && enter) confetti();
}
function go(v) { view = v; msg = ''; animNext = true; if (VOTING.includes(v)) lastVote = v; render(); }
function tabVote() { go(lastVote === 'thanks' ? 'home' : lastVote); }
function retry() { netErr = ''; render(); tick(); }

function confetti() {
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  const col = ['#fbbf24', '#22d3ee', '#a78bfa', '#f472b6', '#34d399'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${col[i % 5]};animation-delay:${Math.random() * .7}s;animation-duration:${2.2 + Math.random() * 1.8}s;transform:rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  setTimeout(() => box.remove(), 5200);
}

/* ---------- connection / status screens ---------- */
function connecting() {
  return netErr
    ? `<section class="glass stage"><div class="radar stop"><i></i><i></i><i></i><span class="hg">⚠️</span></div><h2>Cannot connect</h2><p class="mut">${esc(netErr)} Please check your internet connection.</p><button class="cta" onclick="retry()">Try again</button></section>`
    : `<section class="glass stage"><div class="radar wait"><i></i><i></i><i></i><span class="hg">📡</span></div><h2>Connecting…</h2><div class="dots3"><i></i><i></i><i></i></div></section>`;
}

/* ---------- Home: always says clearly whether voting is open ---------- */
function vHome() {
  if (!loaded) return connecting();
  if (S.phase === 'open') return `<section class="glass stage"><div class="radar go"><i></i><i></i><i></i><span class="hg">🗳️</span></div>
    <h2>Voting is open</h2><p class="mut">Every student has one vote. Have your index number, class and department ready.</p>
    <span class="badge open">VOTING OPEN</span><br><button class="cta" onclick="go('login')">Start Voting →</button></section>`;
  if (S.phase === 'closed') return `<section class="glass stage"><div class="radar stop"><i></i><i></i><i></i><span class="hg">🔒</span></div>
    <h2>Voting has ended</h2><p class="mut">${S.published ? 'The results have been published.' : 'The results will appear here once the admin publishes them.'}</p>
    <span class="badge shut">VOTING CLOSED</span>${S.published ? '<br><button class="cta" onclick="go(\'results\')">View Results →</button>' : ''}</section>`;
  return `<section class="glass stage"><div class="radar wait"><i></i><i></i><i></i><span class="hg">⏳</span></div>
    <h2>Voting has not been opened yet</h2>
    <p>The admin has not opened voting. Please wait. This page updates by itself the moment voting starts, so you do not need to refresh.</p>
    <div class="dots3"><i></i><i></i><i></i></div><span class="badge wait">NOT OPEN YET</span></section>`;
}

const stepper = n => `<div class="stepper">${['Verify', 'Vote', 'Review'].map((t, i) => `<div class="st ${i < n ? 'on' : ''} ${i === n - 1 ? 'cur' : ''}"><b>${i < n - 1 ? '✓' : i + 1}</b><small>${t}</small></div>`).join('<em></em>')}</div>`;

/* ---------- Step 1: verify ---------- */
function vLogin() {
  const L = lists();
  return stepper(1) + `<section class="glass"><h2>Verify yourself</h2><p class="mut">Enter your details to get your ballot.</p>
    <label class="fld"><span>Index Number</span><input id="ix" placeholder="e.g. 0123456789" autocomplete="off"></label>
    <label class="fld"><span>Class</span><select id="cl">${L.cls.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
    <label class="fld"><span>Department</span><select id="dp">${L.dps.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
    <div class="btnrow"><button class="ghostb" onclick="go('home')">← Back</button><button class="cta" onclick="login()">Continue →</button></div>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</section>`;
}
async function login() {
  const idx = fbKey($('#ix').value), cl = $('#cl').value, dp = $('#dp').value;
  if (idx.length < 3) { msg = 'Please enter a valid index number.'; return render(); }
  try { await pull(); } catch (e) { msg = 'Cannot reach the server. Check your internet and try again.'; return render(); }
  if (S.phase !== 'open') { go('home'); return; }
  if (!positions().length) { msg = 'No candidates have been added yet.'; return render(); }
  if (await hasVoted(idx)) { msg = 'This index number has already voted. Each student can vote only once.'; return render(); }
  me = { idx, cls: cl, dept: dp }; pick = {}; step = 0; dir = 1; go('ballot');
}

/* ---------- Step 2: ballot, one position at a time ---------- */
function vBallot() {
  const ps = positions(), p = ps[step], cs = S.cands.filter(c => c.pos === p);
  return stepper(2) + `<section class="glass ${dir > 0 ? 'fromR' : 'fromL'}"><p class="kick">Position ${step + 1} of ${ps.length}</p><h2>${esc(p)}</h2><p class="mut">Tap one candidate.</p>
    <div class="cgrid">${cs.map((c, i) => `<div class="cand ${pick[p] === c.id ? 'sel' : ''}" style="--i:${i}" onclick="choose('${c.id}')"><div class="ph">${av(c)}<span class="tick">✓</span></div><b>${esc(c.name)}</b></div>`).join('')}</div>
    <div class="btnrow"><button class="ghostb" onclick="back()">← Back</button><button class="cta" onclick="next()">${step === ps.length - 1 ? 'Review →' : 'Next →'}</button></div>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</section>`;
}
function choose(id) { pick[positions()[step]] = id; msg = ''; render(); }
function back() { msg = ''; if (step) { step--; dir = -1; animNext = true; render(); } else go('login'); }
function next() {
  const ps = positions();
  if (!pick[ps[step]]) { msg = 'Please select a candidate to continue.'; return render(); }
  msg = '';
  if (step < ps.length - 1) { step++; dir = 1; animNext = true; render(); } else go('review');
}

/* ---------- Step 3: review & submit ---------- */
function vReview() {
  return stepper(3) + `<section class="glass"><h2>Review your vote</h2>
    ${positions().map((p, i) => { const c = S.cands.find(x => x.id === pick[p]); return `<div class="rev" style="--i:${i}"><span class="mut">${esc(p)}</span><b>${esc(c ? c.name : '-')}</b></div>`; }).join('')}
    <p class="mut" style="margin-top:12px">You cannot change your vote after submitting.</p>
    <div class="btnrow"><button class="ghostb" onclick="step=0;dir=-1;go('ballot')" ${sending ? 'disabled' : ''}>Change</button>
    <button class="cta" onclick="submitVote()" ${sending ? 'disabled' : ''}>${sending ? 'Submitting…' : 'Confirm & Submit'}</button></div>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}</section>`;
}
async function submitVote() {
  if (sending) return; sending = true; msg = ''; render();
  const ballot = {}; positions().forEach(p => ballot[p] = pick[p]);
  try {
    const ok = await castVote(me.idx, { cls: me.cls, dept: me.dept, t: Date.now() }, ballot);
    if (!ok) msg = 'This index number has already voted.';
    else { me = null; sending = false; go('thanks'); return; }
  } catch (e) {
    msg = e.closed ? 'Voting has been closed.' : 'Could not submit your vote. Check your internet and try again.';
    if (e.closed) tick();
  }
  sending = false; render();
}
function vThanks() {
  return `<section class="glass stage"><svg class="check" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M28 52 L44 67 L73 35"/></svg>
    <h2>Thank you for voting!</h2><p class="mut">Your vote has been recorded. Check the Results tab after the admin publishes the results.</p>
    <button class="cta" onclick="go('home')">Done</button></section>`;
}

/* ---------- Results ---------- */
function vResults() {
  if (!loaded) return connecting();
  if (!S.published) return `<section class="glass stage"><div class="radar wait"><i></i><i></i><i></i><span class="hg">📭</span></div><h2>Results not published yet</h2>
    <p class="mut">The admin will publish the results after the votes are counted.</p></section>`;
  return `<section class="glass stage"><h2>🏆 Official Results</h2><p class="mut">Total voters: <b data-count="${Object.keys(S.voted).length}" data-key="rv">${Object.keys(S.voted).length}</b></p></section>` +
    positions().map(p => {
      const { cs, t } = tally(p), top = cs[0] ? cs[0].n : 0, ties = cs.filter(c => c.n === top).length;
      return `<section class="glass rcard"><h2>${esc(p)}</h2>` + cs.map(c => {
        const pc = t ? Math.round(c.n * 100 / t) : 0, win = top > 0 && c.n === top;
        return `<div class="rrow ${win ? 'win' : ''}"><div class="ph">${av(c)}</div><div class="rg"><div class="rn">${esc(c.name)}${win ? `<span class="crown">👑 ${ties > 1 ? 'TIE' : 'WINNER'}</span>` : ''}</div>
          <div class="track"><i class="fill" style="width:${pc}%"></i></div></div><b class="cnt"><span data-count="${c.n}" data-key="rc${c.id}">${c.n}</span><small>${pc}%</small></b></div>`;
      }).join('') + `</section>`;
    }).join('');
}

/* the page updates itself; it never wipes a form someone is filling in */
function onChange() {
  const s = JSON.stringify([loaded, netErr, S.phase, S.published, S.title, S.cands.length, view === 'results' ? S.votes.length : 0]);
  if (s === sig) return; sig = s;
  if (view === 'home' || view === 'results') { animNext = view === 'home'; render(); }
  else { const [c, t] = liveInfo(), lp = $('#live'); lp.className = 'livepill ' + c; lp.innerHTML = '<i></i>' + t; }
}
render();
