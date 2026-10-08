// 🧪 Stat Lab: build any question about every bet since 2023 and get the answer right away.
// Who (Maria, Danielle, both side by side, the Machine or a friend) × filters (season, weeks, slot,
// team, player, position, home/away, odds, same pick, hit or miss) -> record, units, chart and the bets.
// Questions can be saved on this phone and shared as links (#lab?who=…). Loaded on demand (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var LAB = { picks: null, extra: {}, q: null, more: false, shown: 25, loading: null, friends: null };
    var LAB_ODDS = [ // decimal-style odds bands (5 = +500)
      { k: 0, lo: 0, hi: 5, t: 'Under +500' }, { k: 1, lo: 5, hi: 10, t: '+500 to +999' }, { k: 2, lo: 10, hi: 15, t: '+1000 to +1499' },
      { k: 3, lo: 15, hi: 25, t: '+1500 to +2499' }, { k: 4, lo: 25, hi: 1e9, t: '+2500 and up' },
    ];
    var LAB_POS = ['QB', 'RB', 'WR', 'TE', 'Other'];
    var LAB_PRESETS = [
      { t: '⚖️ Who\'s better on TEs?', q: { who: 'both', pos: ['TE'] } },
      { t: '🌙 Primetime road picks', q: { who: 'both', slot: ['TNF', 'SNF', 'MNF'], side: 'away' } },
      { t: '🚀 Longshots, +2500 and up', q: { who: 'both', odds: [4] } },
      { t: '👯 When they picked the same guy', q: { who: 'both', same: 'same' } },
      { t: '🏈 Running backs', q: { who: 'both', pos: ['RB'] } },
      { t: '🤖 The Machine', q: { who: 'Machine' } },
      { t: '📊 By position', q: { who: 'both', split: 'pos' } },
      { t: '🗓️ By game slot', q: { who: 'both', split: 'slot' } },
      { t: '🎲 By odds', q: { who: 'both', split: 'odds' } },
      { t: '🏠 Home vs road', q: { who: 'both', split: 'side' } },
    ];
    var LAB_SPLITS = [['', 'None'], ['pos', 'Position'], ['slot', 'Slot'], ['odds', 'Odds'], ['side', 'Home/Road'], ['team', 'Team'], ['yr', 'Season'], ['player', 'Player']];
    function labBlank() { return { who: 'both', yr: [], slot: [], pos: [], odds: [], side: '', team: '', player: '', wk1: 0, wk2: 0, same: '', res: '', split: '' }; }

    // ── Every pick as one record ──
    // Units: a hit pick gets the bet's whole result; a miss splits the bet's loss between its picks.
    // So the units of any filter add up exactly to the real totals.
    function labPicksMD(all) {
      var out = [], byGame = {};
      all.forEach(function(r) { if (isMD(r.picker)) (byGame[gameKey(r)] = byGame[gameKey(r)] || {})[r.picker] = r; });
      all.forEach(function(r) {
        if (!isMD(r.picker) || (r.correct !== 'Yes' && r.correct !== 'No')) return;
        var sides = [];
        if (r.homePick) sides.push({ name: r.homePick, team: r.homeTeam, opp: r.awayTeam, home: true, odds: r.homeOdds });
        if (r.awayPick) sides.push({ name: r.awayPick, team: r.awayTeam, opp: r.homeTeam, home: false, odds: r.awayOdds });
        if (!sides.length) return;
        var vd = isNotOffered(r), sk = playerKey(r.firstScorer || '');
        var win = r.correct === 'Yes' ? sides.filter(function(s) { return playerKey(s.name) === sk; })[0] || sides[0] : null;
        var other = (byGame[gameKey(r)] || {})[r.picker === 'Maria' ? 'Danielle' : 'Maria'];
        var otherKeys = other ? [other.homePick, other.awayPick].filter(Boolean).map(playerKey) : [];
        sides.forEach(function(s) {
          var hit = !vd && win === s;
          out.push({ who: r.picker, year: r.year, week: parseInt(r.week, 10) || 0, game: r.game, idx: r.idx, slot: r.slot || '', home: s.home, team: s.team, opp: s.opp,
            homeTeam: r.homeTeam, awayTeam: r.awayTeam, name: s.name, odds: oddsN(s.odds), hit: hit, void: vd, scorer: r.firstScorer || '',
            units: vd ? 0 : win ? (hit ? r.netUnits : 0) : r.netUnits / sides.length,
            dollars: vd ? 0 : win ? (hit ? r.netDollars : 0) : r.netDollars / sides.length,
            same: otherKeys.indexOf(playerKey(s.name)) >= 0, est: false });
        });
      });
      return out;
    }
    // Game facts (slot, teams, first scorer) from Maria's/Danielle's rows, for the Machine and friends
    function labGameMap(all) {
      var G = {};
      all.forEach(function(r) {
        if (!isMD(r.picker)) return;
        var k = r.year + '_' + r.game, g = G[k] || (G[k] = { year: r.year, week: parseInt(r.week, 10) || 0, game: r.game, idx: r.idx, slot: r.slot || '', home: r.homeTeam, away: r.awayTeam, scorer: '', void: false, scored: false, picks: {} });
        if (r.firstScorer) g.scorer = r.firstScorer;
        if (r.correct === 'Yes' || r.correct === 'No') g.scored = true;
        if (isNotOffered(r)) g.void = true;
        [r.homePick, r.awayPick].filter(Boolean).forEach(function(p) { g.picks[playerKey(p)] = 1; });
      });
      return G;
    }
    function labPicksMachine(all) {
      return loadScriptOnce('js/machine.js').then(function() { return loadMachine(); }).then(function(D) {
        var G = labGameMap(all), out = [];
        // Dollars per unit, from their bets that season
        var per = 5; all.forEach(function(r) { if (r.year === D.year && r.netUnits) per = Math.abs(r.netDollars / r.netUnits) || per; });
        D.games.forEach(function(g) {
          if (!g.settled) return;
          var info = G[D.year + '_' + g.game] || {};
          g.picks.forEach(function(x) {
            var hit = !g.notOffered && !!g.hit && g.hit === x, u = g.notOffered ? 0 : hit ? x.price / 100 : -1;
            out.push({ who: 'Machine', year: D.year, week: g.week, game: g.game, idx: info.idx || 0, slot: info.slot || '', home: x.side === 'home', team: x.team, opp: x.side === 'home' ? g.away : g.home,
              homeTeam: g.home, awayTeam: g.away, name: x.name, odds: x.price / 100, hit: hit, void: g.notOffered, scorer: g.scorer, units: u, dollars: u * per,
              same: !!(info.picks && info.picks[playerKey(x.name)]), est: !x.real });
          });
        });
        return out;
      });
    }
    function labPicksFriend(all, name) {
      var G = labGameMap(all);
      var years = SEASONS.map(function(s) { return s.year; });
      return Promise.all(years.map(function(y) {
        return (y === CURRENT_YEAR ? getCrowd() : picksApi({ action: 'crowd', season: y })).then(function(d) { return { y: y, d: d || {} }; }).catch(function() { return { y: y, d: {} }; });
      })).then(function(list) {
        var out = [];
        list.forEach(function(x) {
          (x.d.picks || []).forEach(function(p) {
            if (p.friend !== name) return;
            var g = G[x.y + '_' + p.game];
            if (!g || !g.scored) return;
            [[p.homePick, true], [p.awayPick, false]].forEach(function(s) {
              if (!s[0]) return;
              out.push({ who: name, year: x.y, week: g.week, game: g.game, idx: g.idx, slot: g.slot, home: s[1], team: s[1] ? g.home : g.away, opp: s[1] ? g.away : g.home,
                homeTeam: g.home, awayTeam: g.away, name: s[0], odds: 0, hit: !g.void && playerKey(s[0]) === playerKey(g.scorer), void: g.void, scorer: g.scorer,
                units: null, dollars: null, same: !!g.picks[playerKey(s[0])], est: false });
            });
          });
        });
        return out;
      });
    }
    function labFriendNames() {
      if (LAB.friends) return Promise.resolve(LAB.friends);
      if (!PICKS_URL) return Promise.resolve([]);
      return getCrowd().then(function(d) { LAB.friends = (d && d.friends) || []; return LAB.friends; }).catch(function() { return []; });
    }

    // Position: the NFL Players list first, then the Rosters tab
    function labPos(name) {
      var k = playerKey(name), n = typeof NFL !== 'undefined' ? NFL[k] : null;
      var p = n && n.pos ? n.pos : '';
      if (!LAB_POS.slice(0, 4).concat(['FB']).some(function(x) { return x === p; })) { var r = ROSTER_INFO[k]; p = r && r.pos ? r.pos.replace(/\d+/g, '') : ''; }
      if (p === 'FB') p = 'RB';
      return LAB_POS.indexOf(p) >= 0 ? p : 'Other';
    }

    // ── The tab ──
    function loadLabTab() {
      var el = document.getElementById('lab-content');
      if (!el) return;
      LAB.q = labFromHash() || LAB.q || labBlank();
      if (!LAB.picks) el.innerHTML = '<div class="loading">Loading every bet…</div>';
      LAB.loading = LAB.loading || Promise.all([loadAllBets(), typeof loadNFL === 'function' ? loadNFL().catch(function() {}) : null, typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY.catch(function() {}) : null, labFriendNames()]).then(function(res) {
        LAB.all = res[0];
        LAB.picks = labPicksMD(res[0]);
        LAB.picks.forEach(function(p) { p.pos = labPos(p.name); });
      });
      LAB.loading.then(function() { labDraw(); }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the bets. <button class="link-btn" onclick="loadLabTab()">Try again</button></div>'; });
    }

    // Picks for the "who" (extra sources load the first time they're asked for)
    function labSource(who) {
      if (who === 'Maria' || who === 'Danielle' || who === 'both') return Promise.resolve(LAB.picks);
      if (LAB.extra[who]) return LAB.extra[who];
      var pr = (who === 'Machine' ? labPicksMachine(LAB.all) : labPicksFriend(LAB.all, who.slice(2))).then(function(list) {
        list.forEach(function(p) { p.pos = labPos(p.name); });
        return list;
      });
      pr.catch(function() { delete LAB.extra[who]; });
      return (LAB.extra[who] = pr);
    }

    function labMatch(p, q) {
      if (q.yr.length && q.yr.indexOf(p.year) < 0) return false;
      if (q.wk1 && p.week < q.wk1) return false;
      if (q.wk2 && p.week > q.wk2) return false;
      if (q.slot.length && q.slot.indexOf(p.slot) < 0) return false;
      if (q.pos.length && q.pos.indexOf(p.pos) < 0) return false;
      if (q.side && (q.side === 'home') !== p.home) return false;
      if (q.team && resolveTeam(q.team) !== resolveTeam(p.team)) return false;
      if (q.player && playerKey(q.player) !== playerKey(p.name)) return false;
      if (q.odds.length && !q.odds.some(function(k) { var b = LAB_ODDS[k]; return p.odds >= b.lo && p.odds < b.hi && p.odds > 0; })) return false;
      if (q.same === 'same' && !p.same) return false;
      if (q.same === 'own' && p.same) return false;
      if (q.res === 'hit' && !p.hit) return false;
      if (q.res === 'miss' && (p.hit || p.void)) return false;
      return true;
    }
    function labOrder(a, b) { return parseInt(a.year, 10) - parseInt(b.year, 10) || a.week - b.week || (parseInt(a.game, 10) || 0) - (parseInt(b.game, 10) || 0) || a.idx - b.idx; }

    function labStats(list) {
      var S = { n: 0, h: 0, v: 0, u: 0, d: 0, money: true, oddsSum: 0, oddsN: 0, best: null, players: {}, games: {}, list: list };
      list.forEach(function(p) {
        S.games[p.year + '_' + p.game] = 1;
        if (p.units === null) S.money = false; else { S.u += p.units; S.d += p.dollars; }
        if (p.void) { S.v++; return; }
        S.n++; if (p.hit) S.h++;
        if (p.odds > 0) { S.oddsSum += p.odds; S.oddsN++; }
        if (p.hit && (!S.best || p.odds > S.best.odds)) S.best = p;
        var pl = S.players[p.name] || (S.players[p.name] = { n: 0, h: 0, team: p.team });
        pl.n++; if (p.hit) pl.h++;
      });
      var fav = null; Object.keys(S.players).forEach(function(k) { var x = S.players[k]; if (!fav || x.n > fav.n || (x.n === fav.n && x.h > fav.h)) fav = { name: k, n: x.n, h: x.h, team: x.team }; });
      S.fav = fav; S.gamesN = Object.keys(S.games).length;
      return S;
    }

    // ── Words: "Danielle · TE · SNF/MNF · 2025–2026" ──
    function labWhoName(w) { return w === 'both' ? 'Maria vs Danielle' : w === 'Machine' ? 'The Machine' : w.indexOf('f:') === 0 ? w.slice(2) : w; }
    function labWhoColor(w) { return w === 'Machine' ? '#A78BFA' : w === 'Maria' || w === 'Danielle' ? personColor(w) : '#FCD34D'; }
    function labDescribe(q) {
      var parts = [];
      if (q.pos.length) parts.push(q.pos.join('/') + (q.pos.length === 1 && q.pos[0] !== 'Other' ? ' picks' : ''));
      if (q.player) parts.push(q.player);
      if (q.team) parts.push(teamNick(q.team) + ' players');
      if (q.side) parts.push(q.side === 'home' ? 'home picks' : 'road picks');
      if (q.slot.length) parts.push(q.slot.join('/'));
      if (q.odds.length) parts.push(q.odds.map(function(k) { return LAB_ODDS[k].t; }).join(', '));
      if (q.same) parts.push(q.same === 'same' ? 'same pick as the other' : 'picks only they had');
      if (q.res) parts.push(q.res === 'hit' ? 'hits only' : 'misses only');
      if (q.wk1 || q.wk2) parts.push(q.wk1 && q.wk2 ? (q.wk1 === q.wk2 ? weekName(q.wk1) : wkShort(q.wk1) + '–' + wkShort(q.wk2)) : q.wk1 ? weekName(q.wk1) + ' on' : 'through ' + weekName(q.wk2));
      var yrs = q.yr.slice().sort();
      parts.push(!yrs.length ? 'every season' : yrs.length > 2 && +yrs[yrs.length - 1] - +yrs[0] === yrs.length - 1 ? yrs[0] + '–' + yrs[yrs.length - 1] : yrs.join(', '));
      return parts;
    }
    function labHeadline(S) {
      if (!S.n && !S.v) return 'No picks match.';
      return S.h + ' for ' + S.n + (S.n ? ' (' + Math.round(S.h / S.n * 100) + '%)' : '') + (S.money ? ' · ' + fmtU(S.u) : '') +
        (S.best ? ' · best hit ' + S.best.name.split(' ').slice(-1)[0] + (S.best.odds ? ' ' + fmtOdds(S.best.odds) : '') : '');
    }

    // ── Drawing ──
    function labDraw() {
      var el = document.getElementById('lab-content');
      if (!el || !LAB.picks) return;
      var q = LAB.q, yrs = SEASONS.map(function(s) { return s.year; });
      var slots = {}; LAB.picks.forEach(function(p) { if (p.slot) slots[p.slot] = (slots[p.slot] || 0) + 1; });
      var slotList = Object.keys(slots).sort(function(a, b) { return slots[b] - slots[a]; });
      function chip(group, val, label, on, cls) { return '<button class="filter-btn' + (on ? ' active' : '') + (cls ? ' ' + cls : '') + '" data-lab="' + group + '" data-v="' + escHtml(String(val)) + '">' + label + '</button>'; }
      function row(label, inner, cls) { return '<div class="lab-row' + (cls ? ' ' + cls : '') + '"><span class="lab-l">' + label + '</span><div class="lab-chips">' + inner + '</div></div>'; }
      var saved = labSaved();
      var nMore = (q.side ? 1 : 0) + (q.team ? 1 : 0) + (q.player ? 1 : 0) + q.odds.length + (q.same ? 1 : 0) + (q.res ? 1 : 0) + (q.wk1 || q.wk2 ? 1 : 0);
      var players = {}; LAB.picks.forEach(function(p) { players[p.name] = 1; });
      var h = '<div class="lab-hero"><div class="lab-title">🧪 Stat Lab</div><div class="lab-sub">Build a question. The answer comes from every bet since ' + (yrs.slice().sort()[0] || '2023') + '.</div></div>';
      h += '<div class="lab-try"><span class="lab-l">Try</span>' + LAB_PRESETS.map(function(p, i) { return '<button class="lab-pre" data-lab-pre="' + i + '">' + p.t + '</button>'; }).join('') +
        saved.map(function(s, i) { return '<span class="lab-saved"><button class="lab-pre mine" data-lab-saved="' + i + '">⭐ ' + escHtml(s.name) + '</button><button class="lab-unsave" data-lab-unsave="' + i + '" aria-label="Remove">✕</button></span>'; }).join('') + '</div>';
      h += '<div id="lab-disc"></div>';
      h += '<div class="lab-q">' +
        row('Who', chip('who', 'both', '⚖️ Maria vs Danielle', q.who === 'both') + chip('who', 'Maria', 'Maria', q.who === 'Maria', 'lab-m') + chip('who', 'Danielle', 'Danielle', q.who === 'Danielle', 'lab-d') +
          (PICKS_URL ? chip('who', 'Machine', '🤖 Machine', q.who === 'Machine') : '') +
          ((LAB.friends || []).length ? '<select class="adm-input lab-sel' + (q.who.indexOf('f:') === 0 ? ' on' : '') + '" id="lab-friend"><option value="">👥 A friend…</option>' + LAB.friends.map(function(f) { return '<option value="' + escHtml(f) + '"' + (q.who === 'f:' + f ? ' selected' : '') + '>' + escHtml(f) + '</option>'; }).join('') + '</select>' : '')) +
        row('Season', chip('yr', '', 'All', !q.yr.length) + yrs.map(function(y) { return chip('yr', y, y, q.yr.indexOf(y) >= 0); }).join('')) +
        row('Slot', chip('slot', '', 'All', !q.slot.length) + slotList.map(function(s) { return chip('slot', s, escHtml(s), q.slot.indexOf(s) >= 0); }).join('')) +
        row('Position', chip('pos', '', 'All', !q.pos.length) + LAB_POS.map(function(p) { return chip('pos', p, p, q.pos.indexOf(p) >= 0); }).join('')) +
        row('Split by', LAB_SPLITS.map(function(x) { return chip('split', x[0], x[1], q.split === x[0], 'lab-split'); }).join(''), 'lab-row-split') +
        '<button class="link-btn lab-more-btn" data-lab-more="1">' + (LAB.more ? '▴ Fewer filters' : '▾ More filters') + (nMore ? ' (' + nMore + ' on)' : '') + '</button>' +
        (LAB.more ?
          row('Odds', chip('odds', '', 'Any', !q.odds.length) + LAB_ODDS.map(function(b) { return chip('odds', b.k, b.t, q.odds.indexOf(b.k) >= 0); }).join('')) +
          row('Side', chip('side', '', 'Any', !q.side) + chip('side', 'home', 'Home team', q.side === 'home') + chip('side', 'away', 'Road team', q.side === 'away')) +
          row('Same pick', chip('same', '', 'Any', !q.same) + chip('same', 'same', '👯 Both had him', q.same === 'same') + chip('same', 'own', 'Only they had him', q.same === 'own')) +
          row('Result', chip('res', '', 'Any', !q.res) + chip('res', 'hit', '✅ Hits', q.res === 'hit') + chip('res', 'miss', '❌ Misses', q.res === 'miss')) +
          row('Team', '<select class="adm-input lab-sel" id="lab-team"><option value="">Any team</option>' + Object.keys(TEAM_COLORS).sort().map(function(t) { return '<option' + (resolveTeam(q.team) === t ? ' selected' : '') + '>' + escHtml(t) + '</option>'; }).join('') + '</select>') +
          row('Player', '<input class="adm-input lab-sel" id="lab-player" list="lab-players" placeholder="Any player" autocomplete="off" value="' + escHtml(q.player) + '"><datalist id="lab-players">' + Object.keys(players).sort().map(function(n) { return '<option value="' + escHtml(n) + '">'; }).join('') + '</datalist>' +
            (q.player ? ' <button class="link-btn" data-lab-clear="player">✕</button>' : '')) +
          row('Weeks', '<select class="adm-input lab-sel" id="lab-wk1"><option value="0">From the start</option>' + labWeekOpts(q.wk1) + '</select><select class="adm-input lab-sel" id="lab-wk2"><option value="0">To the end</option>' + labWeekOpts(q.wk2) + '</select>')
          : '') +
        '</div>';
      h += '<div id="lab-ans"><div class="loading">Working it out…</div></div>';
      el.innerHTML = h;
      labBind(el);
      labAnswer();
      labDiscoveries();
    }
    function labWeekOpts(sel) { var h = ''; for (var w = 1; w <= 23; w++) { if (w === 22) continue; h += '<option value="' + w + '"' + (sel === w ? ' selected' : '') + '>' + weekName(w) + '</option>'; } return h; }

    function labAnswer() {
      var box = document.getElementById('lab-ans'), q = LAB.q, token = (LAB.token = (LAB.token || 0) + 1);
      if (!box) return;
      labToHash();
      var whos = q.who === 'both' ? ['Maria', 'Danielle'] : [q.who];
      labSource(q.who).then(function(src) {
        if (token !== LAB.token || !document.body.contains(box)) return;
        var R = whos.map(function(w) {
          var name = w.indexOf('f:') === 0 ? w.slice(2) : w;
          var list = src.filter(function(p) { return p.who === name && labMatch(p, q); }).sort(labOrder);
          return { who: w, S: labStats(list) };
        });
        box.innerHTML = labAnswerHtml(R);
        labBindAnswer(box, R);
        if (typeof fillHeadshots === 'function') fillHeadshots(box);
      }).catch(function() { if (token === LAB.token) box.innerHTML = '<div class="loading">Couldn\'t load those picks. <button class="link-btn" onclick="labAnswer()">Try again</button></div>'; });
    }

    function labAnswerHtml(R) {
      var q = LAB.q, desc = labDescribe(q), side = R.length === 2;
      var h = '<div class="lab-card" data-share="stat-lab"><div class="lab-ans-h"><div class="lab-ask">🧪 ' + escHtml(labWhoName(q.who)) + ' · ' + desc.map(escHtml).join(' · ') +
        (q.split ? ' · split by ' + LAB_SPLITS.filter(function(x) { return x[0] === q.split; })[0][1].toLowerCase() : '') + '</div>' +
        '<div class="lab-acts no-share"><button class="adm-btn" data-lab-act="save">☆ Save</button><button class="adm-btn" data-lab-act="link">🔗 Share link</button>' +
        '<button class="adm-btn" data-lab-act="img">📷 Share image</button><button class="adm-btn" data-lab-act="reset">↺ Reset</button></div></div>';
      // Headline answer(s)
      h += '<div class="lab-heads' + (side ? ' two' : '') + '">' + R.map(function(x) {
        var c = labWhoColor(x.who);
        return '<div class="lab-head" style="--pc:' + c + '"><div class="lab-head-who" style="color:' + c + '">' + escHtml(labWhoName(x.who)) + '</div><div class="lab-head-v">' + escHtml(labHeadline(x.S)) + '</div></div>';
      }).join('') + '</div>';
      if (R.every(function(x) { return !x.S.n && !x.S.v; })) return h + '</div><div class="mc-note" style="text-align:center;margin:20px 0 30px">Nothing matches that. Try taking a filter off.</div>';
      if (q.split) h += labSplitHtml(R, q.split);
      if (side) {
        var A = R[0].S, B = R[1].S;
        var avg = function(S) { return S.oddsN ? S.oddsSum / S.oddsN : 0; };
        var longs = function(S) { return S.list.filter(function(p) { return p.hit && p.odds >= 10; }).length; };
        h += '<div class="sb-grid lab-grid">' +
          statBlock('Correct', A.h, B.h, A.h + '/' + A.n, B.h + '/' + B.n) +
          statBlock('Hit rate', A.n ? A.h / A.n : 0, B.n ? B.h / B.n : 0, A.n ? Math.round(A.h / A.n * 100) + '%' : '—', B.n ? Math.round(B.h / B.n * 100) + '%' : '—') +
          statBlock('Units', A.u, B.u, fmtUResp(A.u), fmtUResp(B.u)) +
          statBlock('Dollars', A.d, B.d, fmtDResp(A.d), fmtDResp(B.d)) +
          statBlock('Avg odds', avg(A), avg(B), avg(A) ? fmtOdds(avg(A)) : '—', avg(B) ? fmtOdds(avg(B)) : '—') +
          statBlock('+1000 hits', longs(A), longs(B), String(longs(A)), String(longs(B))) +
          '</div>';
        h += '<div class="pf-tiles lab-tiles two">' + R.map(function(x) { return labTile('Best hit · ' + labWhoName(x.who), x.S.best ? escHtml(x.S.best.name) + ' ' + (x.S.best.odds ? fmtOdds(x.S.best.odds) : '') : '—', x.S.best ? x.S.best.year + ' ' + wkName(x.S.best.week) : '', labWhoColor(x.who)); }).join('') +
          R.map(function(x) { return labTile('Most picked · ' + labWhoName(x.who), x.S.fav ? escHtml(x.S.fav.name) : '—', x.S.fav ? x.S.fav.n + '× · hit ' + x.S.fav.h + '×' : '', labWhoColor(x.who)); }).join('') + '</div>';
      } else {
        var S = R[0].S, c = labWhoColor(R[0].who);
        h += '<div class="pf-tiles lab-tiles">' +
          labTile('Correct', S.h + '/' + S.n, (S.n ? Math.round(S.h / S.n * 100) + '% hit rate' : '') + (S.v ? ' · ' + S.v + ' void' : ''), c) +
          (S.money ? labTile('Units', '<span style="color:' + (S.u >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(S.u) + '</span>', fmtD(S.d) + (R[0].who === 'Machine' && R[0].S.list.some(function(p) { return p.est && p.hit; }) ? ' · some est. odds' : ''), c) :
            labTile('Units', '—', 'friends don\'t have odds', c)) +
          labTile('Avg odds', S.oddsN ? fmtOdds(S.oddsSum / S.oddsN) : '—', S.gamesN + ' game' + (S.gamesN === 1 ? '' : 's'), c) +
          labTile('Best hit', S.best ? escHtml(S.best.name) : '—', S.best ? (S.best.odds ? fmtOdds(S.best.odds) + ' · ' : '') + S.best.year + ' ' + wkName(S.best.week) : '', c) +
          labTile('Most picked', S.fav ? escHtml(S.fav.name) : '—', S.fav ? S.fav.n + '× · hit ' + S.fav.h + '×' : '', c) +
          '</div>';
      }
      // Units over time
      var money = R.every(function(x) { return x.S.money; });
      var len = Math.max.apply(null, R.map(function(x) { return x.S.list.length; }));
      if (money && len >= 3 && typeof chLineChart === 'function') {
        var series = R.map(function(x) {
          var t = 0, v = [0]; x.S.list.forEach(function(p) { t += p.units; v.push(Math.round(t * 10) / 10); });
          while (v.length < len + 1) v.push(null);
          return { name: labWhoName(x.who), color: labWhoColor(x.who), vals: v };
        });
        var dv = [];
        if (!side) { var L = R[0].S.list; L.forEach(function(p, i) { if (i && p.year !== L[i - 1].year) dv.push({ i: i + 1, label: p.year }); }); }
        h += '<div class="pf-h">📈 Units, pick by pick <small>' + len + ' pick' + (len === 1 ? '' : 's') + '</small></div><div class="ch-box">' +
          chLineChart({ n: len + 1, series: series, xLabels: [], dividers: dv, tips: labTips(R, series, len), fmt: function(v, axis) { return axis ? (v > 0 ? '+' : '') + v : chU(v); }, height: 210 }) + '</div>';
      }
      h += '<div class="lab-brand">Maria vs Danielle · Stat Lab</div></div>';
      // The picks
      var all = [];
      R.forEach(function(x) { x.S.list.forEach(function(p) { all.push(p); }); });
      all.sort(function(a, b) { return -labOrder(a, b); });
      h += '<div class="pf-h">🧾 The picks <small>newest first</small></div><div class="lab-list">' + all.slice(0, LAB.shown).map(labPickHtml).join('') + '</div>' +
        (all.length > LAB.shown ? '<div class="af-more"><button class="link-btn" data-lab-act="more">Show ' + Math.min(50, all.length - LAB.shown) + ' more (' + (all.length - LAB.shown) + ' left)</button></div>' : '');
      return h;
    }
    // ── Split by: one row per position / slot / odds band / … with each person's record ──
    function labSplitKey(p, key) {
      if (key === 'pos') return p.pos;
      if (key === 'slot') return p.slot || '—';
      if (key === 'odds') { var b = LAB_ODDS.filter(function(x) { return p.odds > 0 && p.odds >= x.lo && p.odds < x.hi; })[0]; return b ? String(b.k) : ''; }
      if (key === 'side') return p.home ? 'home' : 'away';
      if (key === 'team') return resolveTeam(p.team);
      if (key === 'yr') return p.year;
      if (key === 'player') return p.name;
      return '';
    }
    function labSplitLabel(k, key) {
      if (key === 'odds') return LAB_ODDS[+k].t;
      if (key === 'side') return k === 'home' ? '🏠 Home team' : '✈️ Road team';
      if (key === 'team') return teamLogo(k) + ' ' + escHtml(teamNick(k));
      return escHtml(k);
    }
    function labSplitHtml(R, key) {
      var G = {};
      R.forEach(function(x, wi) {
        x.S.list.forEach(function(p) {
          var k = labSplitKey(p, key); if (k === '') return;
          var g = G[k] || (G[k] = { k: k, by: R.map(function() { return { n: 0, h: 0, u: 0, money: true }; }), tot: 0 });
          var b = g.by[wi];
          if (p.units === null) b.money = false; else b.u += p.units;
          if (!p.void) { b.n++; g.tot++; if (p.hit) b.h++; }
        });
      });
      var keys = Object.keys(G);
      var order = { pos: LAB_POS, odds: ['0', '1', '2', '3', '4'], side: ['home', 'away'] }[key];
      if (order) keys.sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });
      else if (key === 'yr') keys.sort();
      else keys.sort(function(a, b) { return G[b].tot - G[a].tot; });
      var cut = key === 'player' || key === 'team' ? 15 : 99, more = keys.length - cut;
      var cols = 'grid-template-columns:minmax(0,1.3fr) repeat(' + R.length + ',minmax(0,1fr))';
      keys = keys.slice(0, cut);
      var h = '<div class="pf-h">📊 Split by ' + LAB_SPLITS.filter(function(x) { return x[0] === key; })[0][1].toLowerCase() + ' <small>tap a row to dig in</small></div><div class="lab-split-t">' +
        '<div class="lab-st-r lab-st-h" style="' + cols + '"><span></span>' + R.map(function(x) { return '<span style="color:' + labWhoColor(x.who) + '">' + escHtml(labWhoName(x.who)) + '</span>'; }).join('') + '</div>';
      keys.forEach(function(k) {
        var g = G[k], best = -1, bi = -1;
        g.by.forEach(function(b, i) { var rt = b.n ? b.h / b.n : -1; if (b.n >= 3 && rt > best) { best = rt; bi = i; } });
        h += '<button class="lab-st-r" style="' + cols + '" data-lab-split="' + escHtml(k) + '"><span class="lab-st-l">' + labSplitLabel(k, key) + '</span>' + g.by.map(function(b, i) {
          if (!b.n) return '<span class="lab-st-c dim">—</span>';
          return '<span class="lab-st-c' + (R.length > 1 && i === bi ? ' lead' : '') + '"><b>' + b.h + '/' + b.n + '</b> <i>' + Math.round(b.h / b.n * 100) + '%</i>' +
            (b.money ? '<em style="color:' + (b.u > 0 ? '#34D399' : b.u < 0 ? '#F87171' : '#9CA3AF') + '">' + fmtU(b.u) + '</em>' : '') + '</span>';
        }).join('') + '</button>';
      });
      return h + '</div>' + (more > 0 ? '<div class="mc-note" style="margin:-2px 0 12px">Top ' + cut + ' by picks. ' + more + ' more aren\'t shown.</div>' : '');
    }
    function labTips(R, series, len) {
      var t = [''];
      for (var i = 0; i < len; i++) {
        t.push(R.map(function(x, j) {
          var p = x.S.list[i]; if (!p) return '';
          return (R.length > 1 ? labWhoName(x.who) + ': ' : '') + p.year + ' ' + wkName(p.week) + ' ' + p.name + (p.void ? ' (void)' : p.hit ? ' ✅' : ' ❌') + ' → ' + chU(series[j].vals[i + 1]);
        }).filter(Boolean).join(' · '));
      }
      return t;
    }
    function labTile(l, v, s, c) { return '<div class="pf-tile" style="border-top:2px solid ' + c + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
    function labPickHtml(p) {
      var c = labWhoColor(p.who);
      var res = p.void ? '<span class="lab-r void">void</span>' : p.hit ? '<span class="lab-r hit">✅</span>' : '<span class="lab-r miss">❌</span>';
      var u = p.units === null ? '' : '<b class="lab-u" style="color:' + (p.units > 0 ? '#34D399' : p.units < 0 ? '#F87171' : '#9CA3AF') + '">' + (p.units ? fmtU(p.units) : '0') + '</b>';
      return '<div class="lab-pk" style="--pc:' + c + '"><div class="lab-pk-m"><div class="lab-pk-n">' + res + ' ' + escHtml(p.name) + (p.odds ? ' <small>' + fmtOdds(p.odds) + (p.est ? ' est' : '') + '</small>' : '') + '</div>' +
        '<div class="lab-pk-s"><span style="color:' + c + ';font-weight:700">' + escHtml(p.who) + '</span> · ' + p.year + ' ' + wkName(p.week) + (p.slot ? ' · ' + escHtml(p.slot) : '') + ' · ' +
        (typeof gameLinkAttr === 'function' ? '<span ' + gameLinkAttr(p.year, p.game) + '>' + escHtml(teamNick(p.awayTeam)) + ' @ ' + escHtml(teamNick(p.homeTeam)) + ' ›</span>' : escHtml(teamNick(p.awayTeam)) + ' @ ' + escHtml(teamNick(p.homeTeam))) + (!p.hit && p.scorer ? ' · 🏈 ' + escHtml(p.scorer) : '') + '</div></div>' + u +
        '<button class="lab-rp" title="Replay this game" data-lab-rp="' + p.year + '|' + p.week + '|' + escHtml(String(p.game)) + '">⏪</button></div>';
    }

    // ── Clicks ──
    function labSet(change) { Object.keys(change).forEach(function(k) { LAB.q[k] = change[k]; }); LAB.shown = 25; }
    function labBind(el) {
      el.querySelectorAll('[data-lab]').forEach(function(b) {
        b.addEventListener('click', function() {
          var g = b.getAttribute('data-lab'), v = b.getAttribute('data-v'), q = LAB.q;
          if (g === 'who' || g === 'side' || g === 'same' || g === 'res' || g === 'split') { var c = {}; c[g] = q[g] === v && g !== 'who' && g !== 'split' ? '' : v; labSet(c); }
          else { // multi-pick rows: "All" clears, others toggle
            var arr = q[g].slice(), val = g === 'odds' ? (v === '' ? '' : parseInt(v, 10)) : v;
            if (val === '') arr = []; else { var i = arr.indexOf(val); if (i >= 0) arr.splice(i, 1); else arr.push(val); }
            var ch = {}; ch[g] = arr; labSet(ch);
          }
          labDraw();
        });
      });
      el.querySelectorAll('[data-lab-pre]').forEach(function(b) {
        b.addEventListener('click', function() { LAB.q = Object.assign(labBlank(), JSON.parse(JSON.stringify(LAB_PRESETS[+b.getAttribute('data-lab-pre')].q))); LAB.shown = 25; labDraw(); });
      });
      el.querySelectorAll('[data-lab-saved]').forEach(function(b) {
        b.addEventListener('click', function() { var s = labSaved()[+b.getAttribute('data-lab-saved')]; if (s) { LAB.q = Object.assign(labBlank(), s.q); LAB.shown = 25; labDraw(); } });
      });
      el.querySelectorAll('[data-lab-unsave]').forEach(function(b) {
        b.addEventListener('click', function() { var s = labSaved(); s.splice(+b.getAttribute('data-lab-unsave'), 1); labSaveList(s); labDraw(); });
      });
      var more = el.querySelector('[data-lab-more]');
      if (more) more.addEventListener('click', function() { LAB.more = !LAB.more; labDraw(); });
      var fr = document.getElementById('lab-friend');
      if (fr) fr.addEventListener('change', function() { labSet({ who: fr.value ? 'f:' + fr.value : 'both' }); labDraw(); });
      var tm = document.getElementById('lab-team');
      if (tm) tm.addEventListener('change', function() { labSet({ team: tm.value }); labDraw(); });
      var pl = document.getElementById('lab-player');
      if (pl) {
        var go = function() { var v = pl.value.trim(); if (v !== LAB.q.player) { labSet({ player: v }); labDraw(); } };
        pl.addEventListener('change', go);
        pl.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
      var cl = el.querySelector('[data-lab-clear]');
      if (cl) cl.addEventListener('click', function() { labSet({ player: '' }); labDraw(); });
      ['wk1', 'wk2'].forEach(function(k) {
        var s = document.getElementById('lab-' + k);
        if (s) s.addEventListener('change', function() { var c = {}; c[k] = parseInt(s.value, 10) || 0; labSet(c); labDraw(); });
      });
    }
    function labBindAnswer(box) {
      box.querySelectorAll('[data-lab-act]').forEach(function(b) {
        b.addEventListener('click', function() {
          var a = b.getAttribute('data-lab-act');
          if (a === 'reset') { LAB.q = labBlank(); LAB.shown = 25; labDraw(); }
          if (a === 'more') { LAB.shown += 50; labAnswer(); }
          if (a === 'save') {
            var def = labWhoName(LAB.q.who) + ' · ' + labDescribe(LAB.q).join(' · ');
            var name = prompt('Name this question', def.length > 40 ? def.slice(0, 40) : def);
            if (!name) return;
            var s = labSaved(); s.unshift({ name: name.slice(0, 40), q: JSON.parse(JSON.stringify(LAB.q)) }); labSaveList(s.slice(0, 12)); labDraw();
          }
          if (a === 'link') labShare(b);
          if (a === 'img' && typeof shareCard === 'function') shareCard(b);
        });
      });
      box.querySelectorAll('[data-lab-split]').forEach(function(b) {
        b.addEventListener('click', function() {
          var k = b.getAttribute('data-lab-split'), key = LAB.q.split, c = { split: '' };
          if (key === 'pos' || key === 'slot' || key === 'yr') c[key] = [k];
          else if (key === 'odds') c.odds = [parseInt(k, 10)];
          else c[key] = k;
          labSet(c); labDraw();
          var a = document.getElementById('lab-ans'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      box.querySelectorAll('[data-lab-rp]').forEach(function(b) {
        b.addEventListener('click', function() { var x = b.getAttribute('data-lab-rp').split('|'); replayGame(x[0], parseInt(x[1], 10), x[2]); });
      });
    }

    // ── Saved questions (this phone) ──
    function labSaved() { try { return JSON.parse(localStorage.getItem('mvd-lab-saved') || '[]') || []; } catch (e) { return []; } }
    function labSaveList(s) { try { localStorage.setItem('mvd-lab-saved', JSON.stringify(s)); } catch (e) {} }

    // ── Links: #lab?who=Danielle&pos=TE&slot=SNF,MNF ──
    function labQuery(q) {
      var p = [];
      if (q.who !== 'both') p.push('who=' + encodeURIComponent(q.who));
      ['yr', 'slot', 'pos', 'odds'].forEach(function(k) { if (q[k].length) p.push(k + '=' + encodeURIComponent(q[k].join(','))); });
      ['side', 'team', 'player', 'same', 'res', 'split'].forEach(function(k) { if (q[k]) p.push(k + '=' + encodeURIComponent(q[k])); });
      if (q.wk1) p.push('wk1=' + q.wk1); if (q.wk2) p.push('wk2=' + q.wk2);
      return p.join('&');
    }
    function labToHash() {
      var s = labQuery(LAB.q);
      try { history.replaceState(null, '', location.pathname + location.search + '#lab' + (s ? '?' + s : '')); } catch (e) {}
    }
    function labFromHash() {
      var h = location.hash || '';
      if (h.indexOf('#lab') !== 0) return null;
      var q = labBlank(), s = h.split('?')[1] || '';
      s.split('&').forEach(function(kv) {
        if (!kv) return;
        var i = kv.indexOf('='), k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
        if (k === 'yr' || k === 'slot' || k === 'pos') q[k] = v.split(',').filter(Boolean);
        else if (k === 'odds') q.odds = v.split(',').map(Number).filter(function(n) { return LAB_ODDS[n]; });
        else if (k === 'wk1' || k === 'wk2') q[k] = parseInt(v, 10) || 0;
        else if (k in q) q[k] = v;
      });
      if (q.who !== 'both' && q.who !== 'Maria' && q.who !== 'Danielle' && q.who !== 'Machine' && q.who.indexOf('f:') !== 0) q.who = 'both';
      return q;
    }
    function labShare(btn) {
      var url = location.origin + location.pathname + '#lab' + (labQuery(LAB.q) ? '?' + labQuery(LAB.q) : '');
      var title = '🧪 ' + labWhoName(LAB.q.who) + ' · ' + labDescribe(LAB.q).join(' · ');
      function done(t) { var o = btn.textContent; btn.textContent = t; setTimeout(function() { btn.textContent = o; }, 1800); }
      if (navigator.share && /Mobi|iPhone|Android/i.test(navigator.userAgent)) { navigator.share({ title: title, url: url }).catch(function() {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function() { done('✓ Link copied'); }).catch(function() { prompt('Copy this link', url); });
      else prompt('Copy this link', url);
    }

    // ── 💡 Discoveries: the Lab checks thousands of questions on its own and keeps the surprising ones ──
    // "Surprising" = far from what the odds said. Each pick's chance comes from its odds (+900 -> 10%),
    // so a group's expected hits and spread are known, and only big gaps count (a z-score of 2+, stricter
    // for two-filter combos). Needs 6+ picks; cold streaks need 2.5+ hits more expected than they got.
    var LAB_DIMS = {
      pos: function(p) { return p.pos === 'Other' ? '' : p.pos; }, slot: function(p) { return p.slot; }, side: function(p) { return p.home ? 'home' : 'away'; },
      odds: function(p) { return labSplitKey(p, 'odds'); }, team: function(p) { return resolveTeam(p.team); }, yr: function(p) { return p.year; },
      player: function(p) { return p.name; }, same: function(p) { return p.same ? 'same' : ''; },
    };
    var LAB_PAIRS = [['slot', 'side'], ['pos', 'side'], ['pos', 'slot'], ['pos', 'odds'], ['slot', 'odds'], ['pos', 'yr'], ['side', 'odds'], ['slot', 'yr'], ['team', 'side']];
    function labDiscFind() {
      if (LAB.disc) return LAB.disc;
      var found = [];
      ['Maria', 'Danielle'].forEach(function(who) {
        var groups = {};
        LAB.picks.forEach(function(p) {
          if (p.who !== who || p.void) return;
          function add(key, f) {
            var g = groups[key] || (groups[key] = { f: f, n: 0, h: 0, e: 0, v: 0, u: 0, noOdds: false });
            g.n++; if (p.hit) g.h++; g.u += p.units;
            if (p.odds > 0) { var c = 1 / (p.odds + 1); g.e += c; g.v += c * (1 - c); } else g.noOdds = true;
          }
          Object.keys(LAB_DIMS).forEach(function(d) { var k = LAB_DIMS[d](p); if (k) add(d + '=' + k, [[d, k]]); });
          LAB_PAIRS.forEach(function(pr) { var a = LAB_DIMS[pr[0]](p), b = LAB_DIMS[pr[1]](p); if (a && b) add(pr[0] + '=' + a + '|' + pr[1] + '=' + b, [[pr[0], a], [pr[1], b]]); });
        });
        Object.keys(groups).forEach(function(key) {
          var g = groups[key];
          if (g.n < 6 || g.noOdds || g.v <= 0) return;
          var z = (g.h - g.e) / Math.sqrt(g.v), pair = g.f.length > 1;
          var hot = z >= (pair ? 2.6 : 2.0) && g.h >= 3;
          var cold = !hot && g.e - g.h >= (pair ? 3 : 2.5) && z <= -1.5;
          if (!hot && !cold) return;
          found.push({ who: who, key: who + '|' + key + '|' + (hot ? 'h' : 'c'), f: g.f, n: g.n, h: g.h, e: g.e, u: g.u, hot: hot, score: Math.abs(z) - (pair ? 0.5 : 0) + (hot ? 0.2 : 0) });
        });
      });
      found.sort(function(a, b) { return b.score - a.score; });
      // Skip near-repeats: a combo whose part is already on the list (same person, same direction)
      var keep = [];
      found.forEach(function(d) {
        var dup = keep.some(function(k) {
          if (k.who !== d.who || k.hot !== d.hot) return false;
          if (k.n === d.n && k.h === d.h && Math.abs(k.u - d.u) < 0.01) return true; // the very same picks, said two ways
          var a = k.f.map(function(x) { return x.join('='); }), b = d.f.map(function(x) { return x.join('='); });
          return a.every(function(x) { return b.indexOf(x) >= 0; }) || b.every(function(x) { return a.indexOf(x) >= 0; });
        });
        if (!dup && keep.length < 12) keep.push(d);
      });
      return (LAB.disc = keep);
    }
    function labDiscText(d) {
      var f = {}; d.f.forEach(function(x) { f[x[0]] = x[1]; });
      var subject = f.player ? 'picking ' + escHtml(f.player) :
        'on ' + (f.side ? (f.side === 'home' ? 'home ' : 'road ') : '') + (f.pos ? f.pos + ' ' : '') + (f.team && !f.player ? escHtml(teamNick(f.team)) + ' ' : '') + 'picks';
      var q = [];
      if (f.slot) q.push('on ' + escHtml(f.slot));
      if (f.odds) q.push('at ' + LAB_ODDS[+f.odds].t);
      if (f.yr) q.push('in ' + f.yr);
      if (f.same) q.push('when they both had the same guy');
      return '<b style="color:' + personColor(d.who) + '">' + d.who + '</b> is <b>' + d.h + ' for ' + d.n + '</b> ' + subject + (q.length ? ' ' + q.join(' ') : '') + '.';
    }
    function labDiscQuery(d) {
      var q = labBlank(); q.who = d.who;
      d.f.forEach(function(x) {
        var k = x[0], v = x[1];
        if (k === 'pos' || k === 'slot' || k === 'yr') q[k] = [v];
        else if (k === 'odds') q.odds = [+v];
        else q[k] = v;
      });
      return q;
    }
    function labDiscoveries() {
      var el = document.getElementById('lab-disc');
      if (!el || !LAB.picks) return;
      var D = labDiscFind();
      if (!D.length) { el.innerHTML = ''; return; }
      // What this phone had seen before this visit (read once, so NEW tags last the whole visit)
      if (!LAB.discSeen) { LAB.discSeen = {}; try { (JSON.parse(localStorage.getItem('mvd-lab-disc-seen') || '[]') || []).forEach(function(k) { LAB.discSeen[k] = 1; }); } catch (e) {} }
      var seen = LAB.discSeen;
      var first = !Object.keys(seen).length; // first visit: nothing is "new" yet
      var show = LAB.discAll ? D : D.slice(0, 4);
      el.innerHTML = '<div class="pf-h">💡 Discoveries <small>patterns the odds didn\'t see coming · tap one to open it</small></div><div class="lab-disc">' +
        show.map(function(d, i) {
          return '<button class="lab-dc ' + (d.hot ? 'hot' : 'cold') + '" style="--pc:' + personColor(d.who) + '" data-lab-disc="' + i + '">' +
            '<span class="lab-dc-ic">' + (d.hot ? '🔥' : '🧊') + '</span><span class="lab-dc-m"><span class="lab-dc-t">' + labDiscText(d) + (!first && !seen[d.key] ? ' <span class="lab-new">NEW</span>' : '') + '</span>' +
            '<span class="lab-dc-s">The odds said about ' + d.e.toFixed(1) + ' hit' + (Math.abs(d.e - 1) < 0.05 ? '' : 's') + ' · ' + fmtU(d.u) + '</span></span></button>';
        }).join('') + '</div>' +
        (D.length > 4 ? '<div class="af-more" style="padding-top:0"><button class="link-btn" id="lab-disc-all">' + (LAB.discAll ? 'Show fewer' : 'Show all ' + D.length) + '</button></div>' : '');
      el.querySelectorAll('[data-lab-disc]').forEach(function(b) {
        b.addEventListener('click', function() {
          LAB.q = labDiscQuery(show[+b.getAttribute('data-lab-disc')]); LAB.shown = 25; labDraw();
          var a = document.getElementById('lab-ans'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      var all = document.getElementById('lab-disc-all');
      if (all) all.addEventListener('click', function() { LAB.discAll = !LAB.discAll; labDiscoveries(); });
      setTimeout(function() { try { localStorage.setItem('mvd-lab-disc-seen', JSON.stringify(D.map(function(d) { return d.key; }).concat(Object.keys(seen)).slice(0, 400))); } catch (e) {} }, 4000);
    }
