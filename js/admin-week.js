// Admin, ✅ This Week: Checklist, Games, Machine Lines (Odds stays in admin.js, it opens first)
// Loaded by admin.js (showAdmin) the first time you open this section. Part of the MariaVsDanielle site; shares the global scope.

    // ── 🏈 Games: add a game (two rows, Maria + Danielle) or take out one nobody has picked ──
    var GAMES = { showAll: false, edit: null }; // edit = the game loaded into the form for editing
    function adminGames() {
      GAMES.edit = null;
      var body = adminScreen('games', '<div class="loading">Loading games…</div>');
      picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r) {
        if (r.error) { body.innerHTML = '<div class="loading">' + escHtml(r.error) + '</div>'; return; }
        if (!r.games) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version. In Apps Script: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>, then reload.</div>'; return; }
        drawGames(body, r);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawGames(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var teams = Object.keys(TEAM_ABBR).sort();
      function teamSel(id) {
        return '<select class="adm-input" id="' + id + '"><option value="">Pick a team</option>' + teams.map(function(t) { return '<option>' + escHtml(t) + '</option>'; }).join('') + '</select>';
      }
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      var E = GAMES.edit;
      var h = '<div class="u-mt-xs pf-h">' + (E ? '✏️ Edit ' + weekName(E.week) + ': ' + nick(E.home) + ' vs ' + nick(E.away) : '➕ Add a game') + ' <small>' + CURRENT_YEAR + ' sheet</small></div>' +
        '<div class="ag-form">' +
          '<label>Week <span class="ag-hint">playoffs: 19 WC · 20 DIV · 21 CONF · 23 SB</span><input class="adm-input" id="ag-week" type="number" min="1" max="30" value="' + (r.lastWeek || 1) + '"></label>' +
          '<label>Time<input class="adm-input" id="ag-slot" list="ag-slots" placeholder="TNF, SNF…"><datalist id="ag-slots">' + (r.slots || []).map(function(x) { return '<option value="' + escHtml(x) + '">'; }).join('') + '</datalist></label>' +
          '<label>Home team' + teamSel('ag-home') + '</label>' +
          '<label>Away team' + teamSel('ag-away') + '</label>' +
          '<label>Amount bet<input class="adm-input" id="ag-amt" type="number" min="1" step="any" value="' + escHtml(r.amount || '5') + '"></label>' +
        '</div>' +
        '<div class="ag-note" id="ag-note"></div>' +
        '<button class="u-p-10px-20px primary-btn" id="ag-add">' + (E ? 'Save changes' : 'Add game') + '</button>' +
        (E ? ' <button class="u-ml-s link-btn" id="ag-cancel">Cancel</button>' : '') +
        '<div class="u-ta-left submit-msg" id="adm-msg"></div>' +
        '<div class="u-fs-11px u-c-faint u-m-8px-0-20px">' + (E
          ? 'Changes both rows (' + E.rows.join(' and ') + '), Maria\'s and Danielle\'s. Only works while nobody has picked in it. If friends already picked it, only the time can change.'
          : 'Adds two rows right below the last game (game ' + r.nextGame + '), one for Maria and one for Danielle, with the formulas, dropdowns and team colors. Odds start as "+" like always.') + '</div>';
      // Game list: the latest two weeks, the rest behind a button
      var weeks = [], byWeek = {};
      r.games.forEach(function(g) { if (!byWeek[g.week]) { byWeek[g.week] = []; weeks.push(g.week); } byWeek[g.week].push(g); });
      weeks.sort(function(a, b) { return b - a; });
      var shown = GAMES.showAll ? weeks : weeks.slice(0, 2);
      h += '<div class="pf-h">📋 Games in the sheet <small>' + r.games.length + ' games</small></div>';
      if (!weeks.length) h += '<div class="u-fs-13px u-c-muted">No games yet.</div>';
      shown.forEach(function(w) {
        h += '<div class="ag-wk">' + weekName(w) + '</div>';
        byWeek[w].forEach(function(g) {
          var state = g.scorer ? '<span class="ag-st">🏈 ' + escHtml(g.scorer) + '</span>' : g.picked ? '<span class="ag-st">picked</span>' : '';
          h += '<div class="adm-row"><div class="u-minw-0"><b>' + nick(g.home) + '</b> vs <b>' + nick(g.away) + '</b> <span class="u-muted">· ' + escHtml(g.slot || '—') + ' · game ' + escHtml(g.game) + ' · rows ' + g.rows.join(', ') + '</span></div>' +
            (g.picked || g.scorer ? state : '<span class="u-ws-nowrap"><button class="adm-btn" data-edg="' + g.week + '|' + escHtml(g.game) + '">Edit</button> ' +
              '<button class="adm-btn red" data-rmg="' + g.week + '|' + escHtml(g.game) + '|' + nick(g.home) + ' vs ' + nick(g.away) + '">Remove</button></span>') + '</div>';
        });
      });
      if (weeks.length > 2) h += '<button class="u-mt-10px link-btn" id="ag-all">' + (GAMES.showAll ? 'Show only the latest weeks' : 'Show all ' + weeks.length + ' weeks') + '</button>';
      body.innerHTML = h;

      var wk = document.getElementById('ag-week'), note = document.getElementById('ag-note');
      if (E) { // load the game into the form
        wk.value = E.week; document.getElementById('ag-slot').value = E.slot || '';
        document.getElementById('ag-home').value = resolveTeam(E.home) || E.home; document.getElementById('ag-away').value = resolveTeam(E.away) || E.away;
        document.getElementById('ag-amt').value = E.amount || r.amount || '5';
      }
      function warnOrder() {
        var w = parseInt(wk.value, 10);
        var t = [];
        if (isPlayoffWeek(w)) t.push('🏆 Week ' + w + ' = ' + weekName(w) + (w === 22 ? ' (there are no games that week; the Super Bowl is 23)' : '') + '.');
        if (!E && w && w < r.lastWeek) t.push('Heads-up: this goes at the bottom of the sheet, after the ' + weekName(r.lastWeek) + ' games. Picking still goes in week order, so it comes up when it should.');
        note.textContent = t.join(' ');
      }
      wk.addEventListener('input', warnOrder); warnOrder();
      function reload(msg, ok) {
        clearSheetCache(); ALL_BETS_PROMISE = null;
        picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) { drawGames(body, r2); adminMsg(msg, ok); });
      }
      var cancel = document.getElementById('ag-cancel');
      if (cancel) cancel.addEventListener('click', function() { GAMES.edit = null; drawGames(body, r); });
      document.getElementById('ag-add').addEventListener('click', function() {
        var btn = this;
        var p = { pin: SUB.pin, action: E ? 'editgame' : 'addgame', week: E ? E.week : wk.value, slot: document.getElementById('ag-slot').value.trim(),
          home: document.getElementById('ag-home').value, away: document.getElementById('ag-away').value, amount: document.getElementById('ag-amt').value };
        if (E) { p.game = E.game; p.newweek = wk.value; }
        if (!p.home || !p.away) return adminMsg('Pick both teams.');
        if (p.home === p.away) return adminMsg('Home and away are the same team.');
        if (!p.slot && !confirm('No time (TNF, SNF…) filled in. ' + (E ? 'Save' : 'Add') + ' it anyway?')) return;
        btn.disabled = true; adminMsg(E ? 'Saving…' : 'Adding…', true);
        picksApiOnce(p).then(function(x) { // once: a retry could add it twice
          btn.disabled = false;
          if (x.error) return adminMsg(x.error);
          if (E) { GAMES.edit = null; return reload('✅ Saved ' + weekName(x.week) + ': ' + x.home + ' vs ' + x.away + (x.slot ? ' (' + x.slot + ')' : '') + ', rows ' + x.rows.join(' and ') + '.', true); }
          reload('✅ Added ' + weekName(x.week) + ': ' + x.home + ' vs ' + x.away + ' (rows ' + x.rows.join(' and ') + ').' + (x.warn ? ' ⚠️ ' + x.warn : ''), !x.warn);
        }).catch(function() { btn.disabled = false; adminMsg('Couldn\'t reach the script. Check the sheet before trying again, it may have gone through.'); });
      });
      body.querySelectorAll('[data-edg]').forEach(function(b) {
        b.addEventListener('click', function() {
          var k = b.getAttribute('data-edg').split('|');
          GAMES.edit = r.games.filter(function(g) { return String(g.week) === k[0] && String(g.game) === k[1]; })[0] || null;
          drawGames(body, r);
          var top = document.getElementById('adm-body'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      var all = document.getElementById('ag-all');
      if (all) all.addEventListener('click', function() { GAMES.showAll = !GAMES.showAll; drawGames(body, r); });
      body.querySelectorAll('[data-rmg]').forEach(function(b) {
        b.addEventListener('click', function() {
          var parts = b.getAttribute('data-rmg').split('|');
          if (!confirm('Remove ' + weekName(parts[0]) + ' ' + parts[2] + '? Both rows go (Maria and Danielle). Nobody has picked in it yet.')) return;
          b.disabled = true; b.textContent = 'Removing…'; GAMES.edit = null;
          picksApiOnce({ pin: SUB.pin, action: 'rmgame', week: parts[0], game: parts[1] }).then(function(x) {
            if (x.error) { b.disabled = false; b.textContent = 'Remove'; return adminMsg(x.error); }
            clearSheetCache(); ALL_BETS_PROMISE = null;
            picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) {
              drawGames(body, r2);
              adminMsg(x.how === 'gap' ? 'Removed, but the sheet wouldn\'t let the rows below move up, so rows ' + x.rows.join(' and ') + ' are blank now. Delete them in the sheet if you want.' : '✅ Removed ' + weekName(parts[0]) + ' ' + parts[2] + '.', x.how !== 'gap');
            });
          }).catch(function() { b.disabled = false; b.textContent = 'Remove'; adminMsg('Couldn\'t reach the script.'); });
        });
      });
    }

    // ── 🎯 Machine Lines: real FanDuel odds for the Machine's correct picks ──
    function adminMachineLines() {
      var body = adminScreen('mlines', '<div class="loading">Loading its correct picks…</div>');
      picksApi({ pin: SUB.pin, action: 'mlines' }).then(function(r) { drawMachineLines(body, r); })
        .catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawMachineLines(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
      if (!r.lines) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy, then reload.</div>'; return; }
      var need = r.lines.filter(function(x) { return !x.real && !x.mine; }).length;
      var h = '<div class="ui-note u-mb">The Machine\'s correct picks in ' + escHtml(r.season) + '. A miss costs 1 unit at any price, so only these need real odds. ' +
        'Type FanDuel\'s price to replace its estimate. Clear the box to go back to the estimate.</div>';
      if (!r.lines.length) {
        body.innerHTML = h + '<div class="u-ta-center u-m-18px-0 mc-note">No correct picks yet this season.</div>';
        return;
      }
      h += '<div class="mll-sum">' + (need ? '⚠️ <b>' + need + '</b> still on an estimate' : '✅ Every correct pick has real odds') + '</div><div class="u-ta-left submit-msg" id="adm-msg"></div>';
      r.lines.forEach(function(x, i) {
        var src = x.real ? '<span class="mll-src">Real · same pick as Maria/Danielle</span>' : x.mine ? '<span class="mll-src ok">Real · you entered it</span>' : '<span class="mll-src est">Estimate +' + x.est + '</span>';
        h += '<div class="mll-row"><div class="mll-l"><div class="mll-p">✅ ' + escHtml(x.player) + ' <small>' + escHtml(x.team) + '</small></div>' +
          '<div class="mll-g">' + wkName(parseInt(x.week, 10)) + ' · ' + escHtml(x.away) + ' @ ' + escHtml(x.home) + (x.retro ? ' · after the fact' : '') + '</div>' + src + '</div>' +
          (x.real ? '<b class="mll-odds">+' + x.real + '</b>' :
            '<div class="mll-in"><input class="u-w-96px u-ta-center adm-input" data-mll="' + i + '" inputmode="decimal" autocomplete="off" placeholder="+' + x.est + ' est" value="' + (x.mine ? '+' + x.mine : '') + '">' +
            '<button class="adm-btn green" data-mll-save="' + i + '">Save</button></div>') + '</div>';
      });
      body.innerHTML = h;
      body.querySelectorAll('[data-mll-save]').forEach(function(b) {
        b.addEventListener('click', function() {
          var i = +b.getAttribute('data-mll-save'), x = r.lines[i], inp = body.querySelector('[data-mll="' + i + '"]');
          var val = inp.value.trim();
          if (val && !(parseFloat(val.replace('+', '')) > 0)) { adminMsg('Odds should look like +475.'); return; }
          b.disabled = true; b.textContent = 'Saving…';
          picksApi({ pin: SUB.pin, action: 'mlineset', game: x.game, side: x.side, player: x.player, odds: val }).then(function(res) {
            if (res.error) { b.disabled = false; b.textContent = 'Save'; adminMsg(res.error); return; }
            if (typeof MACHINE !== 'undefined' && MACHINE) { MACHINE.data = null; MACHINE.loading = null; } // the Machine tab reloads with the new price
            drawMachineLines(body, res);
            adminMsg(val ? 'Saved. ' + x.player + ' now pays at the real price.' : 'Cleared. Back to the estimate.', true);
          }).catch(function() { b.disabled = false; b.textContent = 'Save'; adminMsg('Couldn\'t reach the script.'); });
        });
      });
    }

    // ── ✅ Checklist: what's left this week (opens first on Tuesdays) ──
    function adminChecklist() {
      var body = adminScreen('check', '<div class="loading">Checking the sheet and ESPN…</div>');
      picksApi({ pin: SUB.pin, action: 'checklist' }).then(function(r) { drawChecklist(body, r); })
        .catch(function() { if (document.body.contains(body)) body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawChecklist(body, r) {
      if (!document.body.contains(body)) return;
      if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
      if (r.items && ADMIN.ckTodo !== (r.todo || 0)) { ADMIN.ckTodo = r.todo || 0; adminRefreshNav(); }
      if (!r.items) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is older. Paste the new PicksAPI.gs, then Deploy → Manage deployments → ✏️ → New version → Deploy.</div>'; return; }
      var go = { graded: 'status', odds: 'odds', mlines: 'mlines', jobs: 'status', join: 'friends', nextweek: 'plan' };
      var h = '<div class="ck-head"><div class="ck-big">' + (r.todo ? r.todo + ' thing' + (r.todo === 1 ? '' : 's') + ' to do' : 'All done ✅') + '</div>' +
        '<div class="st-d">' + (r.lastWeek ? weekName(r.lastWeek) + ' is done, ' + weekName(r.nextWeek) + ' is next.' : 'Before Week 1.') + ' <button class="link-btn" id="ck-again">Check again</button></div></div>';
      h += r.items.map(function(it, i) {
        var props = it.proposals || [];
        return '<div class="ck-item ' + it.state + '"><span class="ck-ic">' + (it.state === 'ok' ? '✅' : '⬜') + '</span><div class="ck-m"><div class="ck-t">' + escHtml(it.title) + '</div><div class="ck-d">' + escHtml(it.detail) + '</div>' +
          (props.length ? '<div class="ck-props">' + props.map(function(p, k) {
            var ko = new Date(p.kickoff);
            return '<label class="ck-prop"><input type="checkbox" data-ck-p="' + k + '" checked><span class="ck-slot">' + escHtml(p.slot) + '</span><span class="ck-match">' + teamLogo(p.away) + escHtml(teamNick(p.away)) + ' <i>@</i> ' + escHtml(teamNick(p.home)) + teamLogo(p.home) + '</span>' +
              '<span class="ck-ko">' + ko.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '</span></label>';
          }).join('') + '<div class="ck-add"><label>$ per unit <input class="u-w-64px u-ta-center adm-input" id="ck-amt" value="' + escHtml(it.amount || '5') + '" inputmode="decimal"></label>' +
            '<button class="adm-btn green" id="ck-addbtn" data-ck-i="' + i + '">Add these to the sheet</button></div><div class="u-ta-left submit-msg" id="ck-msg"></div></div>' : '') +
          (it.state === 'todo' && go[it.key] ? '<button class="link-btn ck-go" data-adm="' + go[it.key] + '">Open ' + { status: '🩺 Status', odds: '💲 Odds', mlines: '🎯 Machine Lines', friends: '👥 Friends', plan: '🗓️ Planner' }[go[it.key]] + ' →</button>' : '') +
          '</div></div>';
      }).join('');
      body.innerHTML = h;
      bindAdminNav();
      document.getElementById('ck-again').addEventListener('click', adminChecklist);
      var add = document.getElementById('ck-addbtn');
      if (add) add.addEventListener('click', function() {
        var it = r.items[+add.getAttribute('data-ck-i')], amt = document.getElementById('ck-amt').value.trim(), msg = document.getElementById('ck-msg');
        var picked = it.proposals.filter(function(p, k) { var c = body.querySelector('[data-ck-p="' + k + '"]'); return c && c.checked; });
        if (!picked.length) { msg.style.color = '#F87171'; msg.textContent = 'Tick at least one game.'; return; }
        add.disabled = true; add.textContent = 'Adding…';
        var done = [], fail = [];
        picked.reduce(function(chain, p) {
          return chain.then(function() {
            return picksApi({ pin: SUB.pin, action: 'addgame', week: p.week, slot: p.slot, home: p.home, away: p.away, amount: amt }).then(function(res) {
              if (res.error) fail.push(teamNick(p.away) + ' @ ' + teamNick(p.home) + ': ' + res.error); else done.push(teamNick(p.away) + ' @ ' + teamNick(p.home));
            }).catch(function() { fail.push(teamNick(p.away) + ' @ ' + teamNick(p.home) + ': couldn\'t reach the script'); });
          });
        }, Promise.resolve()).then(function() {
          msg.style.color = fail.length ? '#FCD34D' : '#6EE7B7';
          msg.innerHTML = (done.length ? '✅ Added ' + done.map(escHtml).join(', ') + '.' : '') + (fail.length ? '<br>⚠️ ' + fail.map(escHtml).join('<br>⚠️ ') : '');
          add.textContent = 'Done';
          if (done.length) setTimeout(adminChecklist, 2500);
        });
      });
    }

// ── 🗓️ Season Planner (v137) ────────────────────────────────────────────────
// The whole schedule from ESPN; tick the games to bet each week (and the $ per unit). The ✅ Checklist then
// offers that week's planned games when it isn't in the sheet yet. Saves as you go.
var PLAN = { r: null, open: {}, past: false, t: null };
function adminPlanner() {
  var body = adminScreen('plan', '<div class="loading">Getting the whole season from ESPN…</div>');
  picksApi({ pin: SUB.pin, action: 'plan' }).then(function(r) {
    if (!document.body.contains(body)) return;
    if (r.error || !r.weeks) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error || 'The Planner needs the newest PicksAPI.gs (' + DEPLOY_STEPS + ').') + '</div>'; return; }
    r.plan.weeks = r.plan.weeks || {};
    PLAN.r = r; PLAN.open = {};
    var up = r.weeks.filter(function(w) { return planState(w).up && !r.inSheet[w.week]; });
    up.slice(0, 2).forEach(function(w) { PLAN.open[w.week] = true; });
    drawPlanner(body);
  }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
}
// up = has a game that hasn't finished (or no games known yet)
function planState(w) { var g = w.games || []; return { up: !g.length || g.some(function(x) { return !x.done; }), n: g.length }; }
function planWeek(w) { var P = PLAN.r.plan; return P.weeks[w] || (P.weeks[w] = { g: [] }); }
function planSave(msg) {
  var el = document.getElementById('pl-msg');
  if (el) { el.style.color = '#A1A9B6'; el.textContent = 'Saving…'; }
  clearTimeout(PLAN.t);
  PLAN.t = setTimeout(function() {
    picksApi({ pin: SUB.pin, action: 'planset', data: JSON.stringify(PLAN.r.plan) }).then(function(x) {
      var m = document.getElementById('pl-msg'); if (!m) return;
      if (x.error) { m.style.color = '#F87171'; m.textContent = x.error; return; }
      PLAN.r.plan = x.plan; PLAN.r.plan.weeks = PLAN.r.plan.weeks || {};
      m.style.color = '#6EE7B7'; m.textContent = '✓ Saved' + (msg ? ': ' + msg : '');
    }).catch(function() { var m = document.getElementById('pl-msg'); if (m) { m.style.color = '#F87171'; m.textContent = 'Couldn\'t save. Check your connection.'; } });
  }, 600);
}
function drawPlanner(body) {
  var r = PLAN.r, P = r.plan, all = {};
  r.weeks.forEach(function(w) { (w.games || []).forEach(function(g) { all[g.home] = 1; all[g.away] = 1; }); });
  var teams = Object.keys(all);
  var upcoming = r.weeks.filter(function(w) { return planState(w).up; }), past = r.weeks.filter(function(w) { return !planState(w).up; });
  var total = 0, wk = 0;
  upcoming.forEach(function(w) { var x = P.weeks[w.week]; if (!r.inSheet[w.week] && x && x.g && x.g.length) { total += x.g.length; wk++; } });
  function day(d) { return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
  function weekHtml(w) {
    var games = w.games || [], x = P.weeks[w.week] || { g: [] }, sheet = r.inSheet[w.week], open = !!PLAN.open[w.week];
    var dates = games.length ? day(games[0].kickoff) + (games.length > 1 ? ' – ' + day(games[games.length - 1].kickoff) : '') : 'Schedule not out yet';
    var playing = {}; games.forEach(function(g) { playing[g.home] = 1; playing[g.away] = 1; });
    var byes = w.week <= 18 && games.length && games.length < 16 ? teams.filter(function(t) { return !playing[t]; }).sort() : [];
    var chip = sheet ? '<span class="pl-chip in">✓ In the sheet</span>' : x.g.length ? '<span class="pl-chip on">' + x.g.length + ' planned</span>' : '<span class="pl-chip">Nothing planned</span>';
    var h = '<div class="pl-wk' + (open ? ' open' : '') + (sheet ? ' sheet' : '') + '"><button class="pl-head" data-pl-open="' + w.week + '"><span class="pl-name">' + escHtml(w.name) + '</span><span class="pl-dates">' + dates + '</span>' + chip + '<span class="pl-car">' + (open ? '▾' : '▸') + '</span></button>';
    if (!open) return h + '</div>';
    h += '<div class="pl-body">';
    if (sheet) h += '<div class="st-d u-mb-6px">Already in the sheet: ' + sheet.map(escHtml).join(' · ') + '. Change these on 🏈 Games.</div>';
    else if (!games.length) h += '<div class="st-d">ESPN hasn\'t posted these games yet. Check back closer to the week.</div>';
    else {
      h += '<div class="pl-quick"><button class="adm-btn" data-pl-fill="' + w.week + '">Usual slots (' + r.usual.join(', ') + ')</button><button class="adm-btn" data-pl-none="' + w.week + '">None</button>' +
        '<label class="pl-amt">$ per unit <input class="adm-input" data-pl-amt="' + w.week + '" value="' + escHtml(x.amt || '') + '" placeholder="' + escHtml(P.amt || r.amount) + '" inputmode="decimal"></label></div>';
      h += games.map(function(g) {
        var on = x.g.indexOf(g.k) >= 0;
        return '<label class="pl-g' + (on ? ' on' : '') + (g.done ? ' done' : '') + '"><input type="checkbox" data-pl-g="' + w.week + '|' + g.k + '"' + (on ? ' checked' : '') + (g.done ? ' disabled' : '') + '>' +
          '<span class="ck-slot">' + escHtml(g.slot) + '</span><span class="ck-match">' + teamLogo(g.away) + escHtml(teamNick(g.away)) + ' <i>@</i> ' + escHtml(teamNick(g.home)) + teamLogo(g.home) + '</span>' +
          '<span class="ck-ko">' + (g.done ? 'Final' : new Date(g.kickoff).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '</span></label>';
      }).join('');
    }
    if (byes.length) h += '<div class="pl-byes">😴 Byes: ' + byes.map(function(t) { return escHtml(teamNick(t)); }).join(', ') + '</div>';
    return h + '</div></div>';
  }
  var h = '<div class="ui-note u-mb">Tick the games to bet for the rest of the season. When a week isn\'t in the sheet yet, ✅ Checklist offers that week\'s planned games (you still tap Add). Saves as you go.</div>' +
    '<div class="pl-top"><label class="pl-amt">Default $ per unit <input class="adm-input" id="pl-amt-all" value="' + escHtml(P.amt || '') + '" placeholder="' + escHtml(r.amount) + '" inputmode="decimal"></label>' +
    '<button class="adm-btn" id="pl-fill-all">Fill empty weeks with usual slots</button><button class="adm-btn red" id="pl-clear">Clear the plan</button></div>' +
    '<div class="pl-sum"><b>' + total + '</b> game' + (total === 1 ? '' : 's') + ' planned across <b>' + wk + '</b> week' + (wk === 1 ? '' : 's') + ' still to come <span class="u-ta-left submit-msg" id="pl-msg"></span></div>';
  h += upcoming.map(weekHtml).join('');
  if (past.length) {
    h += '<div class="u-center u-mt-s"><button class="link-btn" id="pl-past">' + (PLAN.past ? 'Hide' : 'Show') + ' ' + past.length + ' finished week' + (past.length === 1 ? '' : 's') + '</button></div>';
    if (PLAN.past) h += past.map(weekHtml).join('');
  }
  body.innerHTML = h;
  if (typeof fillHeadshots === 'function') fillHeadshots(body);
  function usualFor(w) { return (w.games || []).filter(function(g) { return !g.done && (w.week > 18 || r.usual.indexOf(g.slot) >= 0); }).map(function(g) { return g.k; }); }
  function byWeek(n) { return r.weeks.filter(function(w) { return w.week === n; })[0]; }
  body.querySelectorAll('[data-pl-open]').forEach(function(b) { b.addEventListener('click', function() { var n = +b.getAttribute('data-pl-open'); PLAN.open[n] = !PLAN.open[n]; drawPlanner(body); }); });
  body.querySelectorAll('[data-pl-g]').forEach(function(c) {
    c.addEventListener('change', function() {
      var p = c.getAttribute('data-pl-g').split('|'), x = planWeek(p[0]), i = x.g.indexOf(p[1]);
      if (c.checked && i < 0) x.g.push(p[1]); else if (!c.checked && i >= 0) x.g.splice(i, 1);
      c.closest('.pl-g').classList.toggle('on', c.checked);
      planSave(); drawPlanner(body);
    });
  });
  body.querySelectorAll('[data-pl-fill]').forEach(function(b) { b.addEventListener('click', function() { var n = +b.getAttribute('data-pl-fill'); planWeek(n).g = usualFor(byWeek(n)); planSave(); drawPlanner(body); }); });
  body.querySelectorAll('[data-pl-none]').forEach(function(b) { b.addEventListener('click', function() { planWeek(+b.getAttribute('data-pl-none')).g = []; planSave(); drawPlanner(body); }); });
  body.querySelectorAll('[data-pl-amt]').forEach(function(inp) { inp.addEventListener('change', function() { planWeek(+inp.getAttribute('data-pl-amt')).amt = inp.value.replace(/[^0-9.]/g, ''); planSave(); }); });
  document.getElementById('pl-amt-all').addEventListener('change', function() { P.amt = this.value.replace(/[^0-9.]/g, ''); planSave('default $ per unit'); drawPlanner(body); });
  document.getElementById('pl-fill-all').addEventListener('click', function() {
    var n = 0;
    upcoming.forEach(function(w) { if (r.inSheet[w.week]) return; var x = planWeek(w.week); if (!x.g.length) { x.g = usualFor(w); if (x.g.length) n++; } });
    planSave(n + ' week' + (n === 1 ? '' : 's') + ' filled'); drawPlanner(body);
  });
  document.getElementById('pl-clear').addEventListener('click', function() {
    if (!confirm('Clear every planned game? (Weeks already in the sheet aren\'t touched.)')) return;
    P.weeks = {}; planSave('plan cleared'); drawPlanner(body);
  });
  var pb = document.getElementById('pl-past');
  if (pb) pb.addEventListener('click', function() { PLAN.past = !PLAN.past; drawPlanner(body); });
}
