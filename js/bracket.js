// 🏆 Playoff Bracket Challenge (Bracket.gs keeps the data).
// Everyone picks the winner AND the first TD scorer of all 13 playoff games before Wild Card
// kickoff. Brackets stay secret until then. Loaded when the 🏆 Bracket page opens (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var BR = { data: null, pin: '', name: '', picks: null, tb: '', dirty: false, view: '', rules: false };
    var BR_ROUNDS = [null, { t: 'Wild Card', s: 'WC', m: 1 }, { t: 'Divisional', s: 'DIV', m: 2 }, { t: 'Conference', s: 'CONF', m: 3 }, { t: 'Super Bowl', s: 'SB', m: 5 }];
    var BR_ORDER = ['A-WC1', 'A-WC2', 'A-WC3', 'N-WC1', 'N-WC2', 'N-WC3', 'A-DIV1', 'A-DIV2', 'N-DIV1', 'N-DIV2', 'A-CONF', 'N-CONF', 'SB'];
    var BR_WIN = 1, BR_TD = 3; // points × the round's multiplier (1, 2, 3, 5): a perfect bracket is 100

    function brSame(a, b) { return !!a && !!b && resolveTeam(a) === resolveTeam(b); }
    function brNick(t) { return t ? resolveTeam(t).split(' ').pop() : 'TBD'; }

    // ── The bracket's shape, from the seeds and someone's winner picks ──
    // NFL format: 2v7, 3v6, 4v5 (1 has a bye). Then 1 hosts the lowest seed left, the other two play.
    function brSlots(seeds, picks) {
      var S = {};
      function seedOf(conf, t) { var i = seeds[conf].indexOf(t); return i < 0 ? 99 : i + 1; }
      function w(k) { return picks[k] && picks[k].w; }
      ['A', 'N'].forEach(function(c) {
        var conf = c === 'A' ? 'AFC' : 'NFC', sd = seeds[conf];
        S[c + '-WC1'] = { round: 1, conf: conf, teams: [sd[1], sd[6]] };
        S[c + '-WC2'] = { round: 1, conf: conf, teams: [sd[2], sd[5]] };
        S[c + '-WC3'] = { round: 1, conf: conf, teams: [sd[3], sd[4]] };
        var wc = [w(c + '-WC1'), w(c + '-WC2'), w(c + '-WC3')];
        if (wc.every(Boolean)) {
          wc.sort(function(a, b) { return seedOf(conf, a) - seedOf(conf, b); });
          S[c + '-DIV1'] = { round: 2, conf: conf, teams: [sd[0], wc[2]] };
          S[c + '-DIV2'] = { round: 2, conf: conf, teams: [wc[0], wc[1]] };
        } else {
          S[c + '-DIV1'] = { round: 2, conf: conf, teams: [sd[0], null] };
          S[c + '-DIV2'] = { round: 2, conf: conf, teams: [null, null] };
        }
        var dv = [w(c + '-DIV1'), w(c + '-DIV2')];
        if (dv.every(Boolean)) dv.sort(function(a, b) { return seedOf(conf, a) - seedOf(conf, b); });
        S[c + '-CONF'] = { round: 3, conf: conf, teams: dv.every(Boolean) ? dv : [dv[0] || null, dv[1] || null] };
      });
      S.SB = { round: 4, conf: '', teams: [w('A-CONF') || null, w('N-CONF') || null] };
      Object.keys(S).forEach(function(k) { S[k].id = k; S[k].seed = function(t) { return t ? seedOf(seeds.AFC.indexOf(t) >= 0 ? 'AFC' : 'NFC', t) : ''; }; });
      return S;
    }
    // After a change, drop any later pick whose team isn't in that game anymore
    function brClean(seeds, picks) {
      BR_ORDER.forEach(function(k) {
        var sl = brSlots(seeds, picks)[k], p = picks[k];
        if (!p) return;
        if (p.w && sl.teams.indexOf(p.w) < 0) delete p.w;
        if (p.st && sl.teams.indexOf(p.st) < 0) { delete p.s; delete p.st; }
        if (!p.w && !p.s) delete picks[k];
      });
      return picks;
    }

    // ── Scoring against the real results ──
    function brGameFor(games, round, team) { return games.filter(function(g) { return g.round === round && g.teams.some(function(t) { return brSame(t, team); }); })[0] || null; }
    function brOutBefore(games, round, team) {
      return games.some(function(g) { return g.round < round && g.winner && g.teams.some(function(t) { return brSame(t, team); }) && !brSame(g.winner, team); });
    }
    function brNameMatch(actual, pick) {
      if (!actual || !pick) return false;
      if (playerKey(actual) === playerKey(pick)) return true;
      var m = actual.match(/^([A-Za-z]{1,2})\.\s?(.+)$/), parts = pick.replace(/\b(Jr|Sr|II|III|IV|V)\b\.?/g, '').trim().split(/\s+/);
      return !!m && parts.length > 1 && playerKey(parts.slice(1).join(' ')) === playerKey(m[2]) && parts[0].toLowerCase().indexOf(m[1].toLowerCase()) === 0;
    }
    function brScore(games, picks) {
      var out = { pts: 0, max: 0, dead: 0, hits: 0, slots: {} };
      BR_ORDER.forEach(function(k) {
        var p = picks[k] || {}, round = k === 'SB' ? 4 : /WC/.test(k) ? 1 : /DIV/.test(k) ? 2 : 3, m = BR_ROUNDS[round].m;
        var r = { w: '', s: '', wg: null, sg: null };
        if (p.w) {
          var g = brGameFor(games, round, p.w);
          r.wg = g;
          r.w = g && g.winner ? (brSame(g.winner, p.w) ? 'hit' : 'miss') : brOutBefore(games, round, p.w) ? 'dead' : 'live';
        }
        if (p.s) {
          var g2 = brGameFor(games, round, p.st);
          r.sg = g2;
          r.s = g2 && (g2.ftd || g2.state === 'post') ? (brNameMatch(g2.ftd, p.s) ? 'hit' : 'miss') : brOutBefore(games, round, p.st) ? 'dead' : 'live';
        }
        [['w', BR_WIN], ['s', BR_TD]].forEach(function(x) {
          var st = r[x[0]], v = x[1] * m;
          if (st === 'hit') { out.pts += v; out.max += v; out.hits++; }
          if (st === 'live') out.max += v;
          if (st === 'dead') out.dead++;
        });
        r.wv = BR_WIN * m; r.sv = BR_TD * m;
        out.slots[k] = r;
      });
      return out;
    }

    // ── The page ────────────────────────────────────────────────────────────
    function loadBracketTab(fresh) {
      var el = document.getElementById('bracket-content');
      if (!el) return;
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading the bracket…</div>';
      // Logged in on the Log In tab already? Use that.
      if (!BR.pin && SUB.pin && (SUB.role === 'friend' || SUB.role === 'player')) { BR.pin = SUB.pin; BR.name = SUB.name; }
      var mine = BR.pin && BR.picks === null ? picksApi({ pin: BR.pin, action: 'brmine' }) : Promise.resolve(null);
      Promise.all([fresh || !BR.data ? picksApi({ action: 'bracket' }) : Promise.resolve(BR.data), mine, (typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY : Promise.resolve()).catch(function() {})]).then(function(res) {
        BR.data = res[0];
        if (res[1] && !res[1].error) { BR.picks = res[1].picks || {}; BR.tb = res[1].tb || ''; BR.name = res[1].name; }
        drawBracketPage(el);
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the bracket. Check your connection. <button class="link-btn" onclick="loadBracketTab(true)">Try again</button></div>'; });
    }

    function brWhoColor(n) {
      if (n === 'Maria' || n === 'Danielle') return personColor(n);
      var s = ((BR.data && BR.data.styles) || {})[n] || {};
      return s.color || FRIEND_COLOR;
    }
    function brWhoName(n) {
      var s = ((BR.data && BR.data.styles) || {})[n] || {};
      return (s.emoji ? s.emoji + ' ' : '') + '<b style="color:' + brWhoColor(n) + '">' + escHtml(n) + '</b>';
    }
    function brWhen(iso) { return iso ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
    function brLeft(iso) {
      var ms = new Date(iso).getTime() - Date.now();
      if (!(ms > 0)) return '';
      var d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
      return d ? d + 'd ' + h + 'h left' : h ? h + 'h ' + m + 'm left' : m + 'm left';
    }

    function drawBracketPage(el) {
      var B = BR.data || {};
      if (B.state === 'off' || !B.seeds) {
        el.innerHTML = '<div class="br-hero"><div class="br-hero-ic">🏆</div><div><div class="br-hero-t">Playoff Bracket Challenge</div><div class="br-hero-s">Opens once the playoff field is set, right after Week 18.</div></div></div>';
        return;
      }
      var games = B.games || [], open = B.state === 'open';
      var played = games.filter(function(g) { return g.state === 'post'; }).length;
      var sb = games.filter(function(g) { return g.round === 4 && g.winner; })[0];
      var sub = open ? 'Pick the winner and the first TD scorer of all 13 playoff games. Locks at Wild Card kickoff' + (B.lockAt ? ': <b>' + brWhen(B.lockAt) + '</b> <span class="br-left">' + brLeft(B.lockAt) + '</span>' : '.')
        : B.state === 'done' ? 'Final. ' + (sb ? escHtml(brNick(sb.winner)) + ' won the Super Bowl.' : '')
        : 'Locked. ' + played + ' of 13 games played.';
      var h = '<div class="br-hero"><div class="br-hero-ic">🏆</div><div style="min-width:0"><div class="br-hero-t">Playoff Bracket Challenge <span class="br-yr">' + escHtml(B.season) + '</span></div>' +
        '<div class="br-hero-s">' + sub + '</div>' +
        '<button class="link-btn br-rules-btn" id="br-rules">' + (BR.rules ? 'Hide scoring' : 'How scoring works') + '</button></div></div>';
      if (BR.rules) h += brRulesHtml();

      if (open) {
        h += '<div class="pf-h">✍️ Your bracket' + (BR.name ? ' <small>' + escHtml(BR.name) + ' · <button class="link-btn" id="br-out">not you?</button></small>' : '') + '</div>';
        h += BR.pin && BR.picks ? '<div id="br-edit"></div>' : brPinHtml();
        var E = B.entries || [];
        h += '<div class="pf-h" style="margin-top:20px">👥 Who\'s in <small>' + E.length + ' bracket' + (E.length === 1 ? '' : 's') + ' · secret until kickoff</small></div>' +
          (E.length ? '<div class="br-in">' + E.map(function(e) {
            var full = e.filled === 13 && e.scorers === 13;
            return '<span class="br-chip">' + brWhoName(e.who) + ' <small>' + (full ? '✓ done' : e.filled + '/13') + '</small></span>';
          }).join('') + '</div>' : '<div class="ch-empty">Nobody yet. Be first.</div>');
      } else {
        // Standings
        var rows = (B.entries || []).map(function(e) { var s = brScore(games, e.picks || {}); s.e = e; return s; });
        var sbG = games.filter(function(g) { return g.round === 4 && g.state === 'post' && g.total != null; })[0];
        function tbOff(r) { return sbG && r.e.tb !== '' && r.e.tb != null ? Math.abs(r.e.tb - sbG.total) : 999; }
        rows.sort(function(a, b) { return b.pts - a.pts || tbOff(a) - tbOff(b) || b.max - a.max || b.hits - a.hits || a.e.who.localeCompare(b.e.who); });
        if (!BR.view) BR.view = (BR.name && rows.some(function(r) { return r.e.who === BR.name; })) ? BR.name : rows.length ? rows[0].e.who : '';
        h += '<div class="pf-h">📊 Standings <small>' + rows.length + ' brackets · tap one to see it</small></div>';
        h += rows.length ? '<div class="br-table"><div class="br-tr br-th"><span>#</span><span>Bracket</span><span>Champ</span><span>Pts</span><span>Max</span><span>💀</span></div>' + rows.map(function(r, i) {
          var champ = (r.e.picks.SB || {}).w, cs = r.slots.SB.w;
          return '<button class="br-tr' + (r.e.who === BR.view ? ' on' : '') + '" data-br-view="' + escHtml(r.e.who) + '"><span>' + (i && rows[i - 1].pts === r.pts ? '' : i + 1) + '</span><span class="br-nm">' + brWhoName(r.e.who) + '</span>' +
            '<span class="br-champ' + (cs === 'dead' || cs === 'miss' ? ' dead' : '') + '">' + (champ ? teamLogo(champ) : '—') + '</span><b>' + r.pts + '</b><span>' + r.max + '</span><span>' + r.dead + '</span></button>';
        }).join('') + '</div>' : '<div class="ch-empty">Nobody filled one out this year.</div>';
        var v = (B.entries || []).filter(function(e) { return e.who === BR.view; })[0];
        if (v) {
          var vs = brScore(games, v.picks || {});
          h += '<div class="pf-h" style="margin-top:20px"><span>' + brWhoName(v.who) + '\'s bracket</span> <small>' + vs.pts + ' pts · ' + vs.max + ' max' + (v.tb ? ' · tiebreaker ' + v.tb : '') + '</small></div>';
          h += brBoardHtml(B.seeds, v.picks || {}, false, vs, games);
        }
      }
      el.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      document.getElementById('br-rules').addEventListener('click', function() { BR.rules = !BR.rules; drawBracketPage(el); });
      var out = document.getElementById('br-out');
      if (out) out.addEventListener('click', function() { BR.pin = ''; BR.name = ''; BR.picks = null; drawBracketPage(el); });
      el.querySelectorAll('[data-br-view]').forEach(function(b) { b.addEventListener('click', function() { BR.view = b.getAttribute('data-br-view'); drawBracketPage(el); }); });
      bindBrPin(el);
      if (document.getElementById('br-edit')) drawBrEditor(document.getElementById('br-edit'));
    }

    function brRulesHtml() {
      return '<div class="br-rules"><div class="br-rt"><span></span><b>Wild Card</b><b>Divisional</b><b>Conference</b><b>Super Bowl</b></div>' +
        '<div class="br-rt"><span>Right winner</span><i>1</i><i>2</i><i>3</i><i>5</i></div>' +
        '<div class="br-rt"><span>Right first TD</span><i>3</i><i>6</i><i>9</i><i>15</i></div>' +
        '<div class="br-rnote">A perfect bracket is 100. A first-TD pick counts if he scores the first TD of his team\'s game that round, even if you had the wrong opponent. Once his team is out, the pick is dead (💀). A tie at the end goes to whoever is closest on the Super Bowl\'s total points.</div></div>';
    }
    function brPinHtml() {
      return '<div class="br-pin"><div style="font-size:13px;color:#C4C9D2;margin-bottom:8px">Maria, Danielle and every friend can play. Enter your PIN to fill yours out.</div>' +
        '<div style="display:flex;gap:8px"><input class="adm-input" id="br-pin" type="password" inputmode="numeric" maxlength="4" placeholder="PIN" style="width:110px;text-align:center;letter-spacing:0.3em">' +
        '<button class="primary-btn" id="br-go" style="padding:9px 18px">Open my bracket</button></div><div class="submit-msg" id="br-pin-msg" style="text-align:left"></div></div>';
    }
    function bindBrPin(el) {
      var go = document.getElementById('br-go'), inp = document.getElementById('br-pin');
      if (!go) return;
      function tryPin() {
        var pin = inp.value.trim(), msg = document.getElementById('br-pin-msg');
        if (!/^\d{4}$/.test(pin)) { msg.style.color = '#F87171'; msg.textContent = 'PINs are 4 digits.'; return; }
        go.disabled = true; msg.style.color = '#9CA3AF'; msg.textContent = 'Checking…';
        picksApi({ pin: pin, action: 'brmine' }).then(function(r) {
          go.disabled = false;
          if (r.error) { msg.style.color = '#F87171'; msg.textContent = r.error; return; }
          BR.pin = pin; BR.name = r.name; BR.picks = r.picks || {}; BR.tb = r.tb || '';
          if (r.bracket) BR.data = r.bracket;
          drawBracketPage(el);
        }).catch(function() { go.disabled = false; msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the script. Try again.'; });
      }
      go.addEventListener('click', tryPin);
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') tryPin(); });
    }

    // ── One bracket, by round. edit = the owner filling it out ──
    function brBoardHtml(seeds, picks, edit, score, games) {
      var S = brSlots(seeds, picks);
      var h = '<div class="br-board">';
      [1, 2, 3, 4].forEach(function(round) {
        var ks = BR_ORDER.filter(function(k) { return S[k].round === round; });
        h += '<div class="br-round"><div class="br-rh">' + BR_ROUNDS[round].t + ' <small>' + BR_ROUNDS[round].m * BR_WIN + ' + ' + BR_ROUNDS[round].m * BR_TD + ' pts</small></div>';
        ks.forEach(function(k) { h += brGameHtml(S[k], picks[k] || {}, edit, score ? score.slots[k] : null, games); });
        h += '</div>';
      });
      return h + '</div>';
    }
    var BR_ICON = { hit: '✅', miss: '❌', dead: '💀', live: '' };
    function brGameHtml(sl, p, edit, sc, games) {
      var lab = (sl.conf ? sl.conf + ' · ' : '') + BR_ROUNDS[sl.round].t;
      var h = '<div class="br-g' + (edit ? ' edit' : '') + '" data-slot="' + sl.id + '"><div class="br-gl">' + lab + '</div>';
      sl.teams.forEach(function(t) {
        var on = t && p.w === t, tc = TEAM_COLORS[resolveTeam(t)] || {};
        var st = on && sc ? sc.w : '';
        h += '<' + (edit && t ? 'button' : 'div') + ' class="br-team' + (on ? ' on' : '') + (t ? '' : ' tbd') + (st ? ' ' + st : '') + '"' + (edit && t ? ' data-br-w="' + escHtml(t) + '"' : '') + ' style="--tc:' + (tc.primary || '#6B7280') + '">' +
          (t ? teamLogo(t) : '<span class="br-q">?</span>') + '<span class="br-sd">' + (t ? sl.seed(t) : '') + '</span><span class="br-tn">' + escHtml(t ? brNick(t) : 'TBD') + '</span>' +
          (on ? '<span class="br-ck">' + (st && st !== 'live' ? BR_ICON[st] + (st === 'hit' ? ' +' + sc.wv : '') : '✓') + '</span>' : '') +
          '</' + (edit && t ? 'button' : 'div') + '>';
      });
      // First TD pick
      if (edit) {
        var ready = sl.teams[0] && sl.teams[1];
        h += '<div class="br-td"><span>🏈 First TD</span>' + (ready ? brScorerSelect(sl, p) : '<em>Pick the earlier games first</em>') + '</div>';
      } else {
        var ss = sc ? sc.s : '';
        h += '<div class="br-td ' + ss + '"><span>🏈</span>' + (p.s ? '<b>' + escHtml(p.s) + '</b>' + (ss && ss !== 'live' ? ' ' + BR_ICON[ss] + (ss === 'hit' ? ' +' + sc.sv : '') : '') : '<em>no first-TD pick</em>') + '</div>';
        var g = sc && (sc.sg || sc.wg);
        if (g && g.ftd) h += '<div class="br-act">Actual first TD: ' + escHtml(g.ftd) + '</div>';
        else if (g && g.state === 'post') h += '<div class="br-act">No touchdowns in that one</div>';
      }
      return h + '</div>';
    }
    function brScorerSelect(sl, p) {
      var POS = { WR1: 1, RB1: 2, WR2: 3, TE: 4, WR3: 5, QB: 6 };
      var h = '<select class="adm-input br-sel" data-br-s="' + sl.id + '"><option value="">Who scores first?</option>';
      sl.teams.forEach(function(t) {
        var list = Object.keys(typeof ROSTER_INFO !== 'undefined' ? ROSTER_INFO : {}).map(function(k) { return ROSTER_INFO[k]; })
          .filter(function(x) { return x && x.name && brSame(x.team, t); })
          .sort(function(a, b) { return (POS[a.pos] || 9) - (POS[b.pos] || 9) || a.name.localeCompare(b.name); });
        if (p.s && brSame(p.st, t) && !list.some(function(x) { return x.name === p.s; })) list.unshift({ name: p.s, pos: '' });
        h += '<optgroup label="' + escHtml(brNick(t)) + '">' + list.map(function(x) {
          var out = typeof INJURED !== 'undefined' && playerKey(x.name) in INJURED;
          return '<option value="' + escHtml(t + '|' + x.name) + '"' + (p.s === x.name && brSame(p.st, t) ? ' selected' : '') + '>' + escHtml(x.name) + (x.pos ? ' · ' + x.pos : '') + (out ? ' (out)' : '') + '</option>';
        }).join('') + '</optgroup>';
      });
      return h + '</select>';
    }

    function drawBrEditor(box) {
      var B = BR.data, picks = BR.picks;
      var nW = BR_ORDER.filter(function(k) { return picks[k] && picks[k].w; }).length, nS = BR_ORDER.filter(function(k) { return picks[k] && picks[k].s; }).length;
      var h = brBoardHtml(B.seeds, picks, true, null, B.games || []);
      h += '<label class="br-tb">🎯 Tiebreaker: total points scored in the Super Bowl <input class="adm-input" id="br-tb" type="number" min="0" max="150" inputmode="numeric" value="' + escHtml(String(BR.tb || '')) + '" placeholder="e.g. 47"></label>';
      h += '<div class="br-save"><div class="br-prog">' + nW + '/13 winners · ' + nS + '/13 first TDs' + (BR.dirty ? '<br><b style="color:#FCD34D">Not saved yet</b>' : '') + '</div>' +
        '<button class="primary-btn" id="br-save">Save</button></div><div class="submit-msg" id="br-msg" style="text-align:left"></div>';
      box.innerHTML = h;
      box.querySelectorAll('[data-br-w]').forEach(function(b) {
        b.addEventListener('click', function() {
          var k = b.closest('[data-slot]').getAttribute('data-slot');
          picks[k] = picks[k] || {};
          picks[k].w = b.getAttribute('data-br-w');
          brClean(B.seeds, picks); BR.dirty = true; drawBrEditor(box);
        });
      });
      box.querySelectorAll('[data-br-s]').forEach(function(s) {
        s.addEventListener('change', function() {
          var k = s.getAttribute('data-br-s'), v = s.value;
          picks[k] = picks[k] || {};
          if (v) { picks[k].st = v.split('|')[0]; picks[k].s = v.slice(v.indexOf('|') + 1); } else { delete picks[k].s; delete picks[k].st; }
          BR.dirty = true;
          var pr = box.querySelector('.br-prog');
          if (pr) pr.innerHTML = BR_ORDER.filter(function(x) { return picks[x] && picks[x].w; }).length + '/13 winners · ' + BR_ORDER.filter(function(x) { return picks[x] && picks[x].s; }).length + '/13 first TDs<br><b style="color:#FCD34D">Not saved yet</b>';
        });
      });
      document.getElementById('br-tb').addEventListener('input', function() { BR.tb = this.value; BR.dirty = true; });
      document.getElementById('br-save').addEventListener('click', function() {
        var btn = this, msg = document.getElementById('br-msg');
        btn.disabled = true; btn.textContent = 'Saving…';
        picksApi({ pin: BR.pin, action: 'brsave', picks: JSON.stringify(picks), tb: BR.tb || '' }).then(function(r) {
          btn.disabled = false; btn.textContent = 'Save';
          if (r.error) { msg.style.color = '#F87171'; msg.textContent = r.error; return; }
          BR.picks = r.picks; BR.tb = r.tb; BR.dirty = false;
          var me = (BR.data.entries || []).filter(function(e) { return e.who === BR.name; })[0];
          var nw = BR_ORDER.filter(function(k) { return r.picks[k] && r.picks[k].w; }).length, ns = BR_ORDER.filter(function(k) { return r.picks[k] && r.picks[k].s; }).length;
          if (me) { me.filled = nw; me.scorers = ns; } else (BR.data.entries = BR.data.entries || []).push({ who: BR.name, filled: nw, scorers: ns });
          drawBracketPage(document.getElementById('bracket-content'));
          var m2 = document.querySelector('.br-prog');
          if (m2) m2.innerHTML = nw + '/13 winners · ' + ns + '/13 first TDs<br><b style="color:#6EE7B7">' + (nw === 13 && ns === 13 ? '✅ Saved and complete. Change it any time before kickoff.' : '✅ Saved') + '</b>';
        }).catch(function() { btn.disabled = false; btn.textContent = 'Save'; msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the script. Try again.'; });
      });
    }
