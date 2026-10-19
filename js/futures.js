// 🔮 Futures (v149): season-long calls, sealed until the deadline, settled from the data (Futures.gs).
// The Picks hub's 🔮 Futures tab and the little card on Home. Loaded on demand (loadScriptOnce).
// Part of the MariaVsDanielle site; shares the global scope.

    var FUT = { data: null, at: 0, mine: null, msg: '' };
    function futLoad(fresh) {
      if (!fresh && FUT.data && Date.now() - FUT.at < 60000) return Promise.resolve(FUT.data);
      return picksApi({ action: 'futures' }).then(function(d) { FUT.data = d || { state: 'off' }; FUT.at = Date.now(); return FUT.data; });
    }
    function futWhen(iso) { return iso ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
    function futColor(n) { return n === 'Maria' || n === 'Danielle' ? personColor(n) : fStyle(n).color; }
    function futName(n) { var st = n === 'Maria' || n === 'Danielle' ? null : fStyle(n); return '<b style="color:' + futColor(n) + '">' + (st && st.emoji ? st.emoji + ' ' : '') + escHtml(n) + '</b>'; }
    function futOrd(n) { return n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'); }

    function loadFuturesTab() {
      var el = document.getElementById('futures-content');
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading Futures…</div>';
      var me = SUB.pin && SUB.role !== 'admin';
      Promise.all([futLoad(true), me ? picksApi({ pin: SUB.pin, action: 'futmine' }).catch(function() { return null; }) : Promise.resolve(null), loadNFL().catch(function() {})]).then(function(r) {
        FUT.mine = r[1] && !r[1].error ? r[1] : null;
        drawFutures(el);
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load Futures. <button class="link-btn" onclick="loadFuturesTab()">Try again</button></div>'; });
    }

    function drawFutures(el) {
      var D = FUT.data || {};
      if (!D.state || D.state === 'off') { el.innerHTML = '<div class="ui-empty">No Futures right now. They open before the season (or when John starts a rest-of-the-season round).</div>'; return; }
      var h = '<div class="fu-hero"><div class="fu-kick">🔮 ' + escHtml(D.season) + ' Futures</div><div class="fu-t">' + escHtml(D.label || '') + '</div>' +
        '<div class="fu-d">' + (D.state === 'open' ? '🔒 Calls are sealed until <b>' + futWhen(D.lockAt) + '</b>. Nobody sees anyone\'s calls before then.' : D.state === 'final' ? '🏁 Final.' : 'Locked ' + futWhen(D.lockAt) + '. Counting from ' + weekName(D.fromWeek || 1) + '.') + '</div>' +
        '<div class="fu-s">3 points for the winner (ties all count), 1 for 2nd or 3rd. Super Bowl: 3 for the champ, 1 for the other team in it.</div></div>';
      if (D.state === 'open') h += futOpenHtml(D);
      else h += futBoardHtml(D);
      el.innerHTML = h;
      futBind(el);
    }

    // ── Before the deadline: who has called, and your own calls ──
    function futOpenHtml(D) {
      var E = D.entrants || [], fr = E.filter(function(n) { return n !== 'Maria' && n !== 'Danielle'; });
      var h = '<div class="fu-ent">' + ['Maria', 'Danielle'].map(function(n) { return futName(n) + (E.indexOf(n) >= 0 ? ' ✅' : ' ⏳'); }).join(' · ') +
        (fr.length ? ' · ' + fr.length + ' friend' + (fr.length === 1 ? '' : 's') + ' ✅' : '') + '</div>';
      var M = FUT.mine;
      if (!SUB.pin || SUB.role === 'admin' || !M) {
        return h + '<div class="fu-login"><button class="os-btn" onclick="switchTab(\'submit\')">👤 Log in to make your calls</button><div class="ui-note">Maria, Danielle and every friend with a PIN can play.</div></div>';
      }
      var mine = M.mine || {}, seen = {};
      // Every skill player on an NFL roster, plus anyone on the Rosters tab or ever picked here
      Object.keys(NFL).forEach(function(k) { if (SKILL_POS[NFL[k].pos]) seen[NFL[k].name] = 1; });
      Object.keys(ROSTER_INFO).forEach(function(k) { if (ROSTER_INFO[k] && ROSTER_INFO[k].name) seen[ROSTER_INFO[k].name] = 1; });
      if (PLAYER_DB) Object.keys(PLAYER_DB).forEach(function(k) { seen[PLAYER_DB[k].name] = 1; });
      var players = Object.keys(seen).sort();
      h += '<datalist id="fu-players">' + players.map(function(n) { return '<option value="' + escHtml(n) + '">'; }).join('') + '</datalist>';
      h += '<div class="fu-form">' + (D.cats || []).filter(function(c) { return !c.md || M.md; }).map(function(c) {
        var v = mine[c.id] || '';
        var input = c.kind === 'team'
          ? '<select class="adm-input" data-fu="' + c.id + '"><option value="">Pick a team</option>' + (D.teams || []).map(function(t) { return '<option' + (t === v ? ' selected' : '') + '>' + escHtml(t) + '</option>'; }).join('') + '</select>'
          : '<input class="adm-input" data-fu="' + c.id + '" list="fu-players" placeholder="Type a player" value="' + escHtml(v) + '">';
        return '<label class="fu-f"><span class="fu-fl">' + c.ic + ' ' + escHtml(c.t) + (c.d ? ' <small>' + escHtml(c.d) + '</small>' : '') + '</span>' + input + '</label>';
      }).join('') + '</div><button class="os-btn fu-save" id="fu-save">' + (M.mine ? 'Update my calls' : '🔒 Lock in my calls') + '</button>' +
        '<div class="submit-msg" id="fu-msg">' + escHtml(FUT.msg || (M.mine ? 'Saved ' + futWhen(M.mine.at) + '. You can change them until the deadline.' : '')) + '</div>';
      return h;
    }

    // ── After the deadline: the standings and every call against the data ──
    function futBoardHtml(D) {
      if (D.error) return '<div class="inj-warn">' + escHtml(D.error) + '</div>';
      var S = D.standings || [], B = D.board || {}, R = D.rank || {}, P = D.picks || {};
      var h = '<div class="pf-h">' + (D.state === 'final' ? '🏁 Final standings' : '📊 If the season ended today') + '</div><div class="fu-st">' + S.map(function(s, i) {
        return '<div class="fu-sr' + (s.md ? ' md' : '') + '"><span class="fu-rk">' + (i + 1) + '</span>' + futName(s.name) + '<span class="fu-pts">' + s.pts + ' pt' + (s.pts === 1 ? '' : 's') + '</span></div>';
      }).join('') + '</div>';
      (D.cats || []).forEach(function(c) {
        var who = Object.keys(P).filter(function(n) { return P[n][c.id] && (!c.md || n === 'Maria' || n === 'Danielle'); });
        if (!who.length) return;
        h += '<div class="fu-card"><div class="fu-ch">' + c.ic + ' ' + escHtml(c.t) + (D.fix && D.fix[c.id] ? ' <small>✔︎ ' + escHtml(D.fix[c.id]) + '</small>' : '') + '</div>';
        if (c.id === 'sb') {
          var sb = B.sb || {};
          h += '<div class="fu-note">' + (sb.champ ? '🏆 <b>' + escHtml(sb.champ) + '</b> beat the ' + escHtml(teamNick(sb.other)) + '.' : (sb.field || []).length ? 'Playoffs: ' + ((sb.field || []).length - (sb.out || []).length) + ' teams still alive.' : 'Decided in February.') + '</div>';
        } else if (c.id === 'mvp') {
          ['Maria', 'Danielle'].forEach(function(n) {
            var L = (B.mvp || {})[n] || [];
            h += '<div class="fu-note">' + futName(n) + '\'s top earners: ' + (L.length ? L.slice(0, 3).map(function(x) { return escHtml(x.name) + ' <span class="u-good">+' + x.n + 'u</span>'; }).join(' · ') : 'no hits yet') + '</div>';
          });
        } else {
          var L2 = B[c.id] || [];
          h += '<div class="fu-lb">' + (L2.length ? L2.slice(0, 5).map(function(x, i) {
            var mark = who.filter(function(n) { return futSame(c, P[n][c.id], x.name); });
            return '<div class="fu-lr"><span class="fu-rk">' + (1 + L2.filter(function(y) { return y.n > x.n; }).length) + '</span>' + (x.team ? teamLogo(x.team) : '') + '<span class="fu-ln">' + escHtml(x.name) + '</span>' +
              mark.map(function(n) { return '<i class="fu-chip" style="--fc:' + futColor(n) + '">' + escHtml(n.charAt(0)) + '</i>'; }).join('') + '<b>' + x.n + '</b></div>';
          }).join('') : '<div class="fu-note">Nothing counted yet.</div>') + '</div>';
        }
        h += '<div class="fu-calls">' + who.map(function(n) {
          var r = (R[n] || {})[c.id] || {}, v = P[n][c.id];
          var st = c.id === 'sb' ? (r.champ ? '🏆 champ' : r.pts === 1 ? 'made the Super Bowl' : r.alive === false ? 'out' : 'alive') : r.rank ? futOrd(r.rank) + ' · ' + r.n + (c.id === 'mvp' ? 'u' : '') + (r.lead && r.n < r.lead ? ' <small>(leader ' + r.lead + ')</small>' : '') : 'not on the board yet';
          return '<div class="fu-call">' + futName(n) + '<span>' + (c.kind === 'team' ? teamLogo(v) : '') + escHtml(v) + '</span><span class="fu-cs">' + st + '</span><span class="fu-cp' + (r.pts ? ' on' : '') + '">' + (r.pts ? '+' + r.pts : '0') + '</span></div>';
        }).join('') + '</div></div>';
      });
      if (B.at) h += '<div class="ui-note u-center">Counted ' + futWhen(B.at) + ' from every NFL game since ' + weekName(D.fromWeek || 1) + '.</div>';
      return h;
    }
    function futSame(c, a, b) { return c.kind === 'team' ? resolveTeam(a) === resolveTeam(b) : playerKey(a) === playerKey(b); }

    function futBind(el) {
      var b = document.getElementById('fu-save');
      if (!b) return;
      b.addEventListener('click', function() {
        var data = {};
        el.querySelectorAll('[data-fu]').forEach(function(i) { data[i.getAttribute('data-fu')] = i.value.trim(); });
        var miss = Object.keys(data).filter(function(k) { return !data[k]; });
        var msg = document.getElementById('fu-msg');
        if (miss.length) { msg.style.color = 'var(--bad)'; msg.textContent = 'Make every call first.'; return; }
        b.disabled = true; b.textContent = 'Saving…';
        picksApi({ pin: SUB.pin, action: 'futsave', data: JSON.stringify(data) }).then(function(x) {
          if (x.error) { b.disabled = false; b.textContent = '🔒 Lock in my calls'; msg.style.color = 'var(--bad)'; msg.textContent = x.error; return; }
          FUT.mine = Object.assign({}, FUT.mine, { mine: x.mine }); FUT.msg = '✅ Saved. You can change them until the deadline.';
          if (FUT.data && FUT.data.entrants && FUT.data.entrants.indexOf(SUB.name) < 0) FUT.data.entrants.push(SUB.name);
          drawFutures(el); FUT.msg = '';
        }).catch(function() { b.disabled = false; b.textContent = '🔒 Lock in my calls'; msg.style.color = 'var(--bad)'; msg.textContent = 'Couldn\'t reach the script. Try again.'; });
      });
    }

    // ── The card on Home ──
    function drawFuturesHome(el) {
      var F = FUTURES_ON;
      if (!F) { el.style.display = 'none'; return; }
      if (F.state === 'open') {
        el.innerHTML = '<span>🔮 <b>Futures are open</b> · season-long calls, sealed until ' + futWhen(F.lockAt) + '.</span><button class="adm-btn" onclick="switchTab(\'futures\')">Make my calls</button>';
        el.style.display = '';
        return;
      }
      futLoad().then(function(D) {
        var S = (D.standings || []).filter(function(s) { return s.md; });
        if (!S.length) { el.style.display = 'none'; return; }
        el.innerHTML = '<span>🔮 <b>Futures</b> · ' + (D.state === 'final' ? 'final: ' : 'if the season ended today: ') + S.map(function(s) { return futName(s.name) + ' ' + s.pts; }).join(' · ') + '</span><button class="adm-btn" onclick="switchTab(\'futures\')">See the board</button>';
        el.style.display = '';
      }).catch(function() {});
    }
