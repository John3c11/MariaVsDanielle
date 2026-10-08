// 🏈 Game Pages: one page for every game Maria and Danielle bet on, at #game/<season>-<game number>.
// Everything about that game in one place: the score, the first TD, both picks and odds, the Machine's
// picks and chances, friends' picks, the first-TD drive (with ⏪ Replay), Trash Talk from game time,
// and any Museum moments. Opened by openGame(year, game) in main.js. Loaded on demand (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var GP = { token: 0 };

    function gpFromHash() {
      var m = /^#game\/(\d{4})-([0-9A-Za-z]+)/.exec(location.hash || '');
      return m ? { year: m[1], game: m[2] } : null;
    }

    function renderGamePage() {
      var el = document.getElementById('game-content');
      if (!el) return;
      var want = gpFromHash() || GP.last;
      if (!want) { el.innerHTML = '<div class="loading">Pick a game from the Bet Log, Schedule or Stat Lab.</div>'; return; }
      GP.last = want;
      var token = ++GP.token;
      el.innerHTML = '<div class="loading">Loading the game…</div>';
      loadAllBets().then(function(all) {
        if (token !== GP.token) return;
        var rows = all.filter(function(r) { return r.year === want.year && String(r.game) === String(want.game) && isMD(r.picker); });
        if (!rows.length) { el.innerHTML = '<div class="loading">Couldn\'t find that game. <button class="link-btn" onclick="switchTab(GAME_FROM)">Go back</button></div>'; return; }
        gpDraw(el, want, rows, all, token);
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the game. <button class="link-btn" onclick="renderGamePage()">Try again</button></div>'; });
    }

    // Every game they bet on, in order (for ‹ previous / next ›)
    function gpOrder(all) {
      var seen = {}, out = [];
      all.forEach(function(r) {
        if (!isMD(r.picker) || !r.game) return;
        var k = r.year + '-' + r.game;
        if (!seen[k]) { seen[k] = 1; out.push({ year: r.year, game: String(r.game), week: parseInt(r.week, 10) || 0 }); }
      });
      return out;
    }

    function gpDraw(el, want, rows, all, token) {
      var g = rows[0], by = {};
      rows.forEach(function(r) { by[r.picker] = r; if (r.firstScorer) g = r; });
      var home = g.homeTeam, away = g.awayTeam, scorer = g.firstScorer || '', week = parseInt(g.week, 10) || 0;
      var settled = rows.some(function(r) { return r.correct === 'Yes' || r.correct === 'No'; });
      var vd = rows.some(isNotOffered);
      var order = gpOrder(all), at = order.findIndex(function(x) { return x.year === want.year && x.game === String(want.game); });
      var prev = order[at - 1], next = order[at + 1];
      var hc = (TEAM_COLORS[home] || {}).primary || '#374151', ac = (TEAM_COLORS[away] || {}).primary || '#374151';
      function nick(t) { return escHtml(teamNick(t)); }
      function isScorer(n) { return !!scorer && !!n && (playerKey(n) === playerKey(scorer) || (typeof sameScorer === 'function' && sameScorer(scorer, n))); }
      // Who had the scorer
      var hitBy = ['Maria', 'Danielle'].filter(function(w) { var r = by[w]; return r && !vd && (isScorer(r.homePick) || isScorer(r.awayPick)); });
      var scorerTeam = by.Maria && isScorer(by.Maria.homePick) || by.Danielle && isScorer(by.Danielle.homePick) ? home :
        by.Maria && isScorer(by.Maria.awayPick) || by.Danielle && isScorer(by.Danielle.awayPick) ? away :
        (typeof nowTeam === 'function' ? nowTeam(scorer) : '') || '';

      var h = '<div class="gp">';
      h += '<div class="gp-top"><button class="link-btn" onclick="switchTab(GAME_FROM)">‹ Back</button>' +
        '<span class="gp-when">' + want.year + ' · ' + weekName(week) + (g.slot ? ' · ' + escHtml(g.slot) : '') + '</span>' +
        '<span class="gp-pn">' + (prev ? '<button class="adm-btn" onclick="openGame(\'' + prev.year + '\',\'' + prev.game + '\')" title="Previous game">‹</button>' : '') +
        (next ? '<button class="adm-btn" onclick="openGame(\'' + next.year + '\',\'' + next.game + '\')" title="Next game">›</button>' : '') + '</span></div>';
      // Hero: matchup + score (score filled in from ESPN)
      h += '<div class="gp-hero" style="background:linear-gradient(120deg,' + hexA(ac, 0.55) + ' 0%,#111318 50%,' + hexA(hc, 0.55) + ' 100%)">' +
        '<div class="gp-team">' + teamLogo(away, 'gp-logo') + '<div class="gp-tn">' + nick(away) + '</div><div class="gp-pts" id="gp-as">–</div></div>' +
        '<div class="gp-mid"><div class="gp-at">@</div><div class="gp-status" id="gp-status">' + (settled ? 'Final' : '') + '</div><div class="gp-date" id="gp-date"></div></div>' +
        '<div class="gp-team">' + teamLogo(home, 'gp-logo') + '<div class="gp-tn">' + nick(home) + '</div><div class="gp-pts" id="gp-hs">–</div></div></div>';
      // First TD
      if (scorer) {
        h += '<div class="gp-ftd' + (hitBy.length ? ' hit' : '') + '" style="' + (hitBy.length ? '--pc:' + personColor(hitBy[0]) : '') + '">' +
          (scorerTeam ? headshot(scorer, scorerTeam, 64) : '') + '<div><div class="gp-k">🏈 First touchdown</div><div class="gp-ftd-n">' + escHtml(scorer) + '</div>' +
          '<div class="gp-ftd-s">' + (vd ? 'He wasn\'t on the board, so the bets didn\'t count.' : hitBy.length ? '🎉 ' + hitBy.map(function(w) { return '<b style="color:' + personColor(w) + '">' + w + '</b>'; }).join(' & ') + ' had him!' : 'Nobody had him 😩') + '</div></div></div>';
      } else {
        h += '<div class="gp-ftd"><div><div class="gp-k">🏈 First touchdown</div><div class="gp-ftd-s">Not scored yet.</div></div></div>';
      }
      // Their picks
      h += '<div class="pf-h">🎯 The picks</div><div class="gp-cols">' + ['Maria', 'Danielle'].map(function(w) {
        var r = by[w], c = personColor(w);
        if (!r || !(r.homePick || r.awayPick)) return '<div class="gp-col" style="--pc:' + c + '"><div class="gp-col-h" style="color:' + c + '">' + w + '</div><div class="gp-dim">Didn\'t pick this one</div></div>';
        var grade = window.MACHINE_GRADES && MACHINE_GRADES[want.year + '|' + r.game + '|' + w];
        var picks = [[r.homePick, r.homeOdds, home], [r.awayPick, r.awayOdds, away]].filter(function(x) { return x[0]; }).map(function(x) {
          var hit = settled && !vd && isScorer(x[0]);
          return '<div class="gp-pick' + (hit ? ' hit' : settled ? ' miss' : '') + '">' + headshot(x[0], x[2], 40) + '<div class="gp-pk-m"><div class="gp-pk-n">' + (hit ? '✅ ' : '') + escHtml(x[0]) + '</div>' +
            '<div class="gp-pk-s">' + nick(x[2]) + (x[1] ? ' · ' + fmtOdds(x[1]) : '') + '</div></div></div>';
        }).join('');
        var u = settled ? '<div class="gp-u"><b style="color:' + (r.netUnits > 0 ? '#34D399' : r.netUnits < 0 ? '#F87171' : '#9CA3AF') + '">' + fmtU(r.netUnits) + '</b> <span>' + fmtD(r.netDollars) + '</span>' +
          (grade ? ' <span class="mc-grade g-' + grade.g.replace('+', 'p') + '" title="Pick grade from the Machine: the price vs the players\' real chances">' + grade.g + '</span>' : '') + '</div>' : '';
        return '<div class="gp-col" style="--pc:' + c + '"><div class="gp-col-h" style="color:' + c + '">' + w + '</div>' + picks + u + '</div>';
      }).join('') + '</div>';
      h += '<div id="gp-machine"></div><div id="gp-friends"></div><div id="gp-drive"></div><div id="gp-chat"></div><div id="gp-museum"></div>';
      h += '<div class="gp-foot"><button class="adm-btn" id="gp-share">🔗 Share this game</button> <button class="adm-btn" onclick="replayGame(\'' + want.year + '\',' + week + ',\'' + escHtml(String(want.game)) + '\')">⏪ Replay it</button></div></div>';
      el.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      document.getElementById('gp-share').addEventListener('click', function() { gpShare(this, want, away, home); });
      window.scrollTo(0, 0);

      var ctx = { want: want, week: week, home: home, away: away, scorer: scorer, settled: settled, vd: vd, by: by, isScorer: isScorer, token: token };
      gpEspn(ctx);
      gpMachine(ctx);
      gpFriends(ctx);
      gpMuseum(ctx);
    }
    function gpLive(ctx) { return ctx.token === GP.token && document.getElementById('gp-machine'); }

    // ── ESPN: final score, kickoff time, the first-TD drive, then Trash Talk from game time ──
    function gpEspn(ctx) {
      var w = ctx.week, path = 'scoreboard?dates=' + ctx.want.year + '&seasontype=' + (w > 18 ? 3 : 2) + '&week=' + (w > 18 ? w - 18 : w);
      espnGet(path).then(function(board) {
        var hk = espnTeamKey(ctx.home), ak = espnTeamKey(ctx.away), ev = null;
        (board.events || []).forEach(function(e) {
          var c = e.competitions && e.competitions[0]; if (!c) return;
          var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
          if (keys.indexOf(hk) >= 0 && keys.indexOf(ak) >= 0) ev = e;
        });
        if (!ev || !gpLive(ctx)) throw new Error('no game');
        var c = ev.competitions[0];
        var H = c.competitors.filter(function(x) { return x.homeAway === 'home'; })[0], A = c.competitors.filter(function(x) { return x.homeAway === 'away'; })[0];
        var hs = document.getElementById('gp-hs'), as = document.getElementById('gp-as'), st = document.getElementById('gp-status'), dt = document.getElementById('gp-date');
        var done = ev.status && ev.status.type && ev.status.type.completed;
        if (H && A && (done || (ev.status && ev.status.type && ev.status.type.state === 'in'))) { hs.textContent = H.score; as.textContent = A.score; var hw = +H.score > +A.score; (hw ? hs : as).classList.add('win'); }
        st.textContent = done ? 'Final' : ev.status && ev.status.type ? ev.status.type.shortDetail || '' : '';
        var ko = new Date(ev.date);
        if (!isNaN(ko)) dt.textContent = ko.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        ctx.kickoff = ko;
        gpChat(ctx);
        return espnGet('summary?event=' + ev.id);
      }).then(function(sum) {
        if (!gpLive(ctx)) return;
        gpDrive(ctx, sum);
      }).catch(function() {
        var d = document.getElementById('gp-drive');
        if (d && gpLive(ctx)) d.innerHTML = '';
      });
    }
    function gpDrive(ctx, sum) {
      var box = document.getElementById('gp-drive');
      if (!box) return;
      var drives = (sum.drives && sum.drives.previous) || [], drive = null, tdIdx = -1;
      drives.some(function(d) {
        var i = (d.plays || []).findIndex(function(p) { return p.scoringPlay && tdPlay(p); });
        if (i >= 0) { drive = d; tdIdx = i; return true; }
        return false;
      });
      if (!drive) { box.innerHTML = ''; return; }
      var plays = (drive.plays || []).slice(0, tdIdx + 1).filter(function(p) { return p.text; });
      var team = drive.team ? resolveTeam(drive.team.displayName || '') : '';
      var tc = (TEAM_COLORS[team] || {}).primary || '#9CA3AF';
      var summary = drive.description || (plays.length + ' plays');
      var h = '<div class="pf-h">🏟️ The first-TD drive <small>' + escHtml(teamNick(team)) + ' · ' + escHtml(summary) + '</small></div><div class="gp-drive" style="--tc:' + tc + '">';
      plays.forEach(function(p, i) {
        var last = i === plays.length - 1, togo = p.start && p.start.yardsToEndzone != null ? p.start.yardsToEndzone : null;
        h += '<div class="gp-play' + (last ? ' td' : '') + '"><span class="gp-play-t">' + (p.period ? (p.period.number > 4 ? 'OT' : 'Q' + p.period.number) : '') + ' ' + escHtml((p.clock && p.clock.displayValue) || '') +
          (togo != null ? '<i>' + togo + ' to go</i>' : '') + '</span><span class="gp-play-x">' + escHtml(p.text) + '</span></div>';
      });
      h += '</div><button class="link-btn gp-rp" onclick="replayGame(\'' + ctx.want.year + '\',' + ctx.week + ',\'' + escHtml(String(ctx.want.game)) + '\')">⏪ Watch the whole game play by play →</button>';
      box.innerHTML = h;
    }

    // ── The Machine: its two picks and its chances for every player Maria and Danielle had ──
    function gpMachine(ctx) {
      if (!PICKS_URL || ctx.want.year !== CURRENT_YEAR) return;
      loadScriptOnce('js/machine.js').then(function() { return loadMachine(); }).then(function(D) {
        var box = document.getElementById('gp-machine');
        if (!box || !gpLive(ctx)) return;
        var mg = D.games.filter(function(x) { return String(x.game) === String(ctx.want.game); })[0];
        if (!mg) {
          var sealed = !ctx.settled && D.sealed;
          box.innerHTML = sealed ? '<div class="pf-h">🤖 The Machine</div><div class="gp-dim" style="margin-bottom:14px">🔒 Its pick is sealed until kickoff.</div>' : '';
          return;
        }
        var ch = mg.p.chances || {};
        var theirs = {};
        ['Maria', 'Danielle'].forEach(function(w) { var r = ctx.by[w]; if (r) [r.homePick, r.awayPick].forEach(function(n) { if (n) theirs[n] = (theirs[n] || []).concat(w); }); });
        mg.picks.forEach(function(x) { theirs[x.name] = (theirs[x.name] || []).concat('Machine'); });
        function chanceOf(n) { var k = Object.keys(ch).filter(function(c) { return playerKey(c) === playerKey(n); })[0]; return k ? ch[k] : null; }
        var list = Object.keys(theirs).map(function(n) { return { n: n, who: theirs[n], c: chanceOf(n) }; }).sort(function(a, b) { return (b.c || 0) - (a.c || 0); });
        var h = '<div class="pf-h">🤖 The Machine <small>' + (mg.retro ? 'picked after the fact, using only what was known before kickoff' : 'picked before kickoff') + '</small></div>' +
          '<div class="gp-mc">' + mg.picks.map(function(x) {
            var hit = ctx.settled && !ctx.vd && ctx.isScorer(x.name);
            return '<div class="gp-pick' + (hit ? ' hit' : ctx.settled ? ' miss' : '') + '" style="--pc:#A78BFA">' + headshot(x.name, x.team, 40) + '<div class="gp-pk-m"><div class="gp-pk-n">' + (hit ? '✅ ' : '') + escHtml(x.name) + '</div>' +
              '<div class="gp-pk-s">' + escHtml(teamNick(x.team)) + ' · +' + Math.round(x.price) + (x.real ? '' : ' est') + (x.pct ? ' · ' + Math.round(x.pct * 100) + '% chance' : '') + '</div></div></div>';
          }).join('') + (mg.settled ? '<div class="gp-u"><b style="color:' + (mg.units > 0 ? '#34D399' : mg.units < 0 ? '#F87171' : '#9CA3AF') + '">' + fmtU(mg.units) + '</b></div>' : '') + '</div>';
        if (list.some(function(x) { return x.c !== null; })) {
          var top = Math.max.apply(null, list.map(function(x) { return x.c || 0; })) || 1;
          h += '<div class="gp-ch"><div class="gp-k">Its chances for every pick in this game</div>' + list.map(function(x) {
            return '<div class="gp-ch-r"><span class="gp-ch-n">' + (ctx.isScorer(x.n) ? '🏈 ' : '') + escHtml(x.n) + ' <small>' + x.who.map(function(w) { return '<b style="color:' + (w === 'Machine' ? '#A78BFA' : personColor(w)) + '">' + (w === 'Machine' ? '🤖' : w.charAt(0)) + '</b>'; }).join('') + '</small></span>' +
              '<span class="gp-ch-bar"><i style="width:' + Math.round((x.c || 0) / top * 100) + '%"></i></span><span class="gp-ch-v">' + (x.c !== null ? (x.c * 100).toFixed(1) + '%' : '—') + '</span></div>';
          }).join('') + '</div>';
        }
        box.innerHTML = h;
        if (typeof fillHeadshots === 'function') fillHeadshots(box);
      }).catch(function() {});
    }

    // ── Friends' picks for this game (only ones already revealed) ──
    function gpFriends(ctx) {
      if (!PICKS_URL) return;
      var y = ctx.want.year;
      (y === CURRENT_YEAR ? getCrowd() : picksApi({ action: 'crowd', season: y })).then(function(d) {
        var box = document.getElementById('gp-friends');
        if (!box || !gpLive(ctx)) return;
        var picks = ((d && d.picks) || []).filter(function(p) { return String(p.game) === String(ctx.want.game); });
        if (!picks.length) return;
        box.innerHTML = '<div class="pf-h">👥 Friends\' picks <small>' + picks.length + ' friend' + (picks.length === 1 ? '' : 's') + '</small></div><div class="gp-fr">' + picks.map(function(p) {
          var hit = ctx.settled && !ctx.vd && (ctx.isScorer(p.homePick) || ctx.isScorer(p.awayPick));
          return '<div class="gp-fr-r' + (hit ? ' hit' : '') + '"><b>' + (hit ? '✅ ' : '') + escHtml(p.friend) + '</b><span>' + [p.homePick, p.awayPick].filter(Boolean).map(function(n) {
            return ctx.isScorer(n) ? '<u>' + escHtml(n) + '</u>' : escHtml(n);
          }).join(' · ') + '</span></div>';
        }).join('') + '</div>';
      }).catch(function() {});
    }

    // ── Trash Talk sent from 30 minutes before kickoff to 4 hours after ──
    function gpChat(ctx) {
      var season = SEASONS.filter(function(s) { return s.year === ctx.want.year; })[0];
      if (!season || !ctx.kickoff || isNaN(ctx.kickoff) || typeof fetchChatRows !== 'function') return;
      var from = ctx.kickoff.getTime() - 30 * 60000, to = ctx.kickoff.getTime() + 4 * 3600000;
      fetchChatRows(season).then(function(rows) {
        var box = document.getElementById('gp-chat');
        if (!box || !gpLive(ctx)) return;
        var msgs = [];
        rows.forEach(function(r, i) {
          if (!i || !(r[1] === 'Maria' || r[1] === 'Danielle') || !(r[2] || '').trim()) return;
          var t = parseSheetTime(r[0]);
          if (t && t.getTime() >= from && t.getTime() <= to) msgs.push({ t: t, who: r[1], text: r[2] });
        });
        if (!msgs.length) return;
        box.innerHTML = '<div class="pf-h">🗣️ Trash Talk during the game <small>' + msgs.length + ' message' + (msgs.length === 1 ? '' : 's') + '</small></div><div class="gp-chat">' + msgs.map(function(m) {
          return '<div class="gp-msg" style="--pc:' + personColor(m.who) + '"><span class="gp-msg-h"><b style="color:' + personColor(m.who) + '">' + m.who + '</b> ' +
            m.t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</span><span>' + escHtml(m.text) + '</span></div>';
        }).join('') + '</div>';
      }).catch(function() {});
    }

    // ── Museum moments from this game ──
    function gpMuseum(ctx) {
      loadScriptOnce('js/museum.js').then(function() { return museumData(); }).then(function(list) {
        var box = document.getElementById('gp-museum');
        if (!box || !gpLive(ctx)) return;
        var label = teamNick(ctx.away) + ' @ ' + teamNick(ctx.home);
        var mine = (list || []).filter(function(m) {
          if (String(m.season) !== ctx.want.year) return false;
          if (m.gameNo != null) return String(m.gameNo) === String(ctx.want.game);
          return parseInt(m.week, 10) === ctx.week && m.game === label;
        });
        if (!mine.length) return;
        box.innerHTML = '<div class="pf-h">🏛️ In the Museum</div><div class="mu-grid gp-mu">' + mine.map(museumCard).join('') + '</div>';
        if (typeof fillHeadshots === 'function') fillHeadshots(box);
      }).catch(function() {});
    }

    function gpShare(btn, want, away, home) {
      var url = location.origin + location.pathname + '#game/' + want.year + '-' + want.game;
      var title = '🏈 ' + teamNick(away) + ' @ ' + teamNick(home) + ' · Maria vs Danielle';
      if (navigator.share && /Mobi|iPhone|Android/i.test(navigator.userAgent)) { navigator.share({ title: title, url: url }).catch(function() {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function() { var o = btn.textContent; btn.textContent = '✓ Link copied'; setTimeout(function() { btn.textContent = o; }, 1800); }).catch(function() { prompt('Copy this link', url); });
      else prompt('Copy this link', url);
    }
