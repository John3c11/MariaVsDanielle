// Crowd: friend picks data, the Crowd tab leaderboard, and the "friends picked" line on Live Picks.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Crowd data (shared by the Crowd tab, Live Picks and friend profiles) ──
    var CROWD = { data: null, at: 0 };
    function getCrowd() {
      if (!PICKS_URL) return Promise.resolve({ friends: [], picks: [], counts: {} });
      if (CROWD.data && Date.now() - CROWD.at < 60000) return Promise.resolve(CROWD.data);
      return picksApi({ action: 'crowd' }).then(function(d) { CROWD.data = d; CROWD.at = Date.now(); return d; });
    }

    // One entry per game from this season's public sheet
    function crowdGames(values) {
      var G = {};
      values.slice(1).forEach(function(r) {
        var picker = (r[3] || '').trim();
        if (!r[0] || !r[4]) return;
        var k = (r[1] || '') + '_' + r[0];
        var g = G[k] || (G[k] = { key: k, week: parseInt(r[1]) || 0, game: parseInt(r[0]) || 0, slot: (r[2] || '').trim(), home: resolveTeam(r[4]), away: resolveTeam(r[5]),
          scorer: '', notOffered: false, md: {}, mdCorrect: {} });
        if ((r[11] || '').trim()) g.scorer = r[11].trim();
        if ((r[14] || '').trim() === 'No' && (parseFloat(r[15]) || 0) === 0 && (r[11] || '').trim()) g.notOffered = true;
        if (picker === 'Maria' || picker === 'Danielle') {
          g.md[picker] = [(r[6] || '').trim(), (r[7] || '').trim()];
          g.mdCorrect[picker] = (r[12] || '').trim();
        }
      });
      return G;
    }

    // Stats for one friend. rows: [{week, game, homePick, awayPick}], others: every revealed friend pick (for Lone Wolf)
    function friendStats(name, rows, G, others) {
      var list = rows.map(function(r) { return { r: r, g: G[r.week + '_' + r.game] }; })
        .filter(function(x) { return x.g; })
        .sort(function(a, b) { return a.g.week - b.g.week || a.g.game - b.g.game; });
      var S = { name: name, history: [], h2h: { Maria: { me: 0, them: 0, both: 0, neither: 0, n: 0, theirW: 0 }, Danielle: { me: 0, them: 0, both: 0, neither: 0, n: 0, theirW: 0 } }, picks: list.length, w: 0, n: 0, heater: { n: 0 }, drought: { n: 0 }, cur: { type: '', n: 0 }, lone: [], hits: [], weeks: {}, players: {}, playerHits: {}, upcoming: [] };
      var cw = 0, cl = 0;
      list.forEach(function(x) {
        var r = x.r, g = x.g;
        [r.homePick, r.awayPick].filter(Boolean).forEach(function(p) { S.players[p] = (S.players[p] || 0) + 1; });
        if (!g.scorer) {
          if (r.revealed === false) S.upcoming.push(x); else S.history.push({ r: r, g: g, status: 'live' });
          return;
        }
        if (g.notOffered) { S.history.push({ r: r, g: g, status: 'void' }); return; }
        var hit = playerKey(g.scorer) === playerKey(r.homePick) || playerKey(g.scorer) === playerKey(r.awayPick);
        S.history.push({ r: r, g: g, status: hit ? 'hit' : 'miss' });
        ['Maria', 'Danielle'].forEach(function(who) {
          var c = g.mdCorrect[who]; if (c !== 'Yes' && c !== 'No') return;
          var H = S.h2h[who], them = c === 'Yes';
          H.n++; if (them) H.theirW++;
          if (hit && !them) H.me++; else if (them && !hit) H.them++; else if (hit) H.both++; else H.neither++;
        });
        S.n++;
        var W = S.weeks[g.week] || (S.weeks[g.week] = { w: 0, n: 0 });
        W.n++;
        if (hit) {
          S.w++; W.w++; cw++; cl = 0;
          S.playerHits[g.scorer] = true;
          S.hits.push(x);
          if (cw > S.heater.n) S.heater = { n: cw, at: g.week };
          var k = playerKey(g.scorer);
          var mdHad = ['Maria', 'Danielle'].some(function(n) { return (g.md[n] || []).some(function(p) { return playerKey(p) === k; }); });
          var friendHad = others.some(function(o) { return o.friend !== name && (o.week + '_' + o.game) === g.key && (playerKey(o.homePick) === k || playerKey(o.awayPick) === k); });
          if (!mdHad && !friendHad) S.lone.push(x);
        } else { cl++; cw = 0; if (cl > S.drought.n) S.drought = { n: cl, at: g.week }; }
      });
      S.cur = cw ? { type: 'W', n: cw } : cl ? { type: 'L', n: cl } : { type: '', n: 0 };
      S.pct = S.n ? S.w / S.n : 0;
      return S;
    }

    function mdStats(who, G) {
      var keys = Object.keys(G).map(function(k) { return G[k]; }).sort(function(a, b) { return a.week - b.week || a.game - b.game; });
      var S = { name: who, w: 0, n: 0 }, cw = 0, cl = 0;
      keys.forEach(function(g) {
        var c = g.mdCorrect[who];
        if (!g.scorer || g.notOffered || (c !== 'Yes' && c !== 'No')) return;
        S.n++;
        if (c === 'Yes') { S.w++; cw++; cl = 0; } else { cl++; cw = 0; }
      });
      S.cur = cw ? { type: 'W', n: cw } : cl ? { type: 'L', n: cl } : { type: '', n: 0 };
      S.pct = S.n ? S.w / S.n : 0;
      return S;
    }

    var CROWD_MIN = 5; // games picked to be ranked
    function pctTxt(p) { return Math.round(p * 100) + '%'; }
    function streakTxt(c) { return c.n ? (c.type === 'W' ? '🔥 W' : '🧊 L') + c.n : '—'; }

    function rankFriends(crowd, G) {
      var byFriend = {};
      crowd.friends.forEach(function(n) { byFriend[n] = []; });
      crowd.picks.forEach(function(p) { if (byFriend[p.friend]) byFriend[p.friend].push(p); });
      var stats = crowd.friends.map(function(n) { return friendStats(n, byFriend[n], G, crowd.picks); });
      var ranked = stats.filter(function(s) { return s.n >= CROWD_MIN; }).sort(function(a, b) { return b.pct - a.pct || b.n - a.n; });
      var unranked = stats.filter(function(s) { return s.n < CROWD_MIN; }).sort(function(a, b) { return b.n - a.n; });
      return { stats: stats, ranked: ranked, unranked: unranked };
    }

    // ── 🏅 Crowd tab ────────────────────────────────────────────────────────
    function loadCrowdTab() {
      var el = document.getElementById('crowd-content');
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading the crowd…</div>';
      Promise.all([getCrowd(), fetchSheet('Winnings', 'A1:Q400')]).then(function(res) {
        var crowd = res[0], G = crowdGames(res[1]);
        var h = '<div style="text-align:center;margin-bottom:18px"><div style="font-size:22px;font-weight:800">🏅 The Crowd</div>' +
          '<div style="font-size:12px;color:#A1A9B6;margin-top:4px">Friends make their own picks each game. Ranked by win % (' + CROWD_MIN + '+ games to qualify). Picks show at kickoff.</div></div>';
        if (!crowd.friends || !crowd.friends.length) { el.innerHTML = h + '<div class="loading">No friends have joined yet.</div>'; return; }
        var R = rankFriends(crowd, G);
        var ref = ['Maria', 'Danielle'].map(function(n) { var s = mdStats(n, G); s.ref = true; return s; });

        // Leaderboard, with Maria and Danielle slotted in as reference rows
        var board = R.ranked.concat(ref).sort(function(a, b) { return b.pct - a.pct || b.n - a.n; });
        var rank = 0;
        h += '<div style="font-size:11px;color:#A1A9B6;text-align:right;margin-bottom:4px">Tap a name to see their profile</div><table class="cr-table"><tr><th>#</th><th>Name</th><th>Record</th><th>Win %</th><th>Streak</th></tr>';
        board.forEach(function(s) {
          var c = s.ref ? (s.name === 'Maria' ? SB_M : SB_D) : FRIEND_COLOR;
          if (!s.ref) rank++;
          h += '<tr class="' + (s.ref ? 'ref' : '') + '"><td>' + (s.ref ? '' : (rank === 1 ? '👑' : rank)) + '</td>' +
            '<td style="font-weight:700;color:' + c + '">' + (s.ref ? '<a class="fr-link" data-fname="' + s.name + '" style="color:' + c + '">' + s.name + '</a> <span style="font-size:10px;color:#A1A9B6">(for reference)</span>' : fName(s.name)) + '</td>' +
            '<td>' + s.w + '–' + (s.n - s.w) + '</td><td style="font-weight:800">' + pctTxt(s.pct) + '</td><td>' + streakTxt(s.cur) + '</td></tr>';
        });
        h += '</table>';
        if (R.unranked.length) {
          h += '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:16px 0 6px">UNRANKED (UNDER ' + CROWD_MIN + ' GAMES)</div>' +
            R.unranked.map(function(s) {
              return '<div class="adm-row"><span style="font-weight:700">' + fName(s.name) + '</span><span style="color:#A1A9B6">' + s.w + '–' + (s.n - s.w) + ' · ' + s.n + ' game' + (s.n === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }

        // Weekly best
        var weeks = {};
        R.stats.forEach(function(s) {
          Object.keys(s.weeks).forEach(function(w) {
            var W = weeks[w] || (weeks[w] = { best: 0, who: [] });
            if (s.weeks[w].w > W.best) { W.best = s.weeks[w].w; W.who = [s.name]; }
            else if (s.weeks[w].w === W.best && W.best > 0) W.who.push(s.name);
          });
        });
        var wkKeys = Object.keys(weeks).filter(function(w) { return weeks[w].best > 0; }).sort(function(a, b) { return b - a; });
        if (wkKeys.length) {
          h += '<div class="pf-h" style="margin-top:22px">🗓️ Weekly Best</div>' + wkKeys.map(function(w) {
            return '<div class="adm-row"><span style="color:#A1A9B6">Week ' + w + '</span><span><b>' + weeks[w].who.map(fName).join(' & ') + '</b> · ' + weeks[w].best + ' hit' + (weeks[w].best > 1 ? 's' : '') + '</span></div>';
          }).join('');
        }

        // Game by game (only games that have kicked off)
        var byGame = {};
        crowd.picks.forEach(function(p) { (byGame[p.week + '_' + p.game] = byGame[p.week + '_' + p.game] || []).push(p); });
        var gKeys = Object.keys(byGame).filter(function(k) { return G[k]; }).sort(function(a, b) { return G[b].week - G[a].week || G[b].game - G[a].game; });
        if (gKeys.length) {
          h += '<div class="pf-h" style="margin-top:22px">🏈 Game by Game</div>';
          gKeys.forEach(function(k, i) {
            var g = G[k], sk = playerKey(g.scorer);
            function pk(p, team) {
              var hit = g.scorer && playerKey(p) === sk;
              return '<span style="' + (hit ? 'color:#34D399;font-weight:800' : '') + '">' + escHtml(p) + (hit ? ' ✅' : '') + '</span>';
            }
            h += '<div class="sch-game" style="' + (i >= 6 ? 'display:none' : '') + '" data-cg="1"><div class="sch-top"><span class="sch-slot">Week ' + g.week + ' · ' + escHtml(g.slot) + '</span>' +
              '<span class="sch-ko">' + (g.scorer ? '🏈 ' + escHtml(g.scorer) : '⏳ In progress') + '</span></div>' +
              '<div class="sch-teams">' + teamPill(g.home, g.home) + ' <span style="color:rgba(255,255,255,0.45)">vs</span> ' + teamPill(g.away, g.away) + '</div>' +
              byGame[k].map(function(p) {
                return '<div style="font-size:12px;padding:3px 0"><b>' + fName(p.friend) + '</b> · ' + pk(p.homePick) + ' / ' + pk(p.awayPick) + '</div>';
              }).join('') + '</div>';
          });
          if (gKeys.length > 6) h += '<div style="text-align:center"><button class="link-btn" id="cr-more">Show all ' + gKeys.length + ' games</button></div>';
        }
        el.innerHTML = h;
        var more = document.getElementById('cr-more');
        if (more) more.addEventListener('click', function() { el.querySelectorAll('[data-cg]').forEach(function(d) { d.style.display = ''; }); more.remove(); });
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the crowd right now.</div>'; });
    }

    // Live Picks: "👥 N friends have picked"
    function addCrowdLines(root) {
      getCrowd().then(function(crowd) {
        root.querySelectorAll('.live-game[data-wg]').forEach(function(g) {
          var n = (crowd.counts || {})[g.getAttribute('data-wg')] || 0;
          var old = g.querySelector('.cr-line'); if (old) old.remove();
          if (!n) return;
          var title = g.querySelector('.live-game-title');
          title.insertAdjacentHTML('afterend', '<div class="cr-line">👥 ' + n + ' friend' + (n > 1 ? 's have' : ' has') + ' picked this game</div>');
        });
      }).catch(function() {});
    }
