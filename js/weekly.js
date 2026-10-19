// 🗞️ The Weekly (v150): a magazine issue for every week of every season, written from the data, plus a
// bigger Season Issue for each season. The same "story engine" (wkIssue / wkSeason) feeds 🎬 Highlight Reels
// (js/reels.js), so the magazine and the reel always tell the same story.
// Everything comes from what the site already has (bets, every TD, the Machine, the Crowd, Trash Talk, the
// Museum's moments), so the archive goes back to the first week, and it works inside the ⏳ Time Machine.
// Loaded on demand (loadScriptOnce). Part of the MariaVsDanielle site; shares the global scope.

    var WK = { data: null, loading: null, view: null };
    var WK_MD = ['Maria', 'Danielle'];

    // ── Everything the issues are written from (loaded once) ──
    function wkLoad() {
      if (WK.data) return Promise.resolve(WK.data);
      if (WK.loading) return WK.loading;
      var soft = function(p) { return p.catch(function() { return null; }); };
      WK.loading = Promise.all([
        loadAllBets(),
        soft(typeof loadAllTDs === 'function' ? loadAllTDs() : Promise.resolve({})),
        soft(PICKS_URL ? loadScriptOnce('js/machine.js').then(function() { return loadMachine(); }) : Promise.resolve(null)),
        soft(PICKS_URL ? Promise.all(SEASONS.map(function(s) { return (s.year === CURRENT_YEAR ? getCrowd() : picksApi({ action: 'crowd', season: s.year })).then(function(d) { return { y: s.year, d: d || {} }; }).catch(function() { return { y: s.year, d: {} }; }); })) : Promise.resolve([])),
        soft(Promise.all(SEASONS.map(function(s) { return fetchChatRows(s).then(function(rows) { return { y: s.year, rows: rows }; }).catch(function() { return { y: s.year, rows: [] }; }); }))),
        soft(loadScriptOnly('js/museum.js').then(function() { return null; })),
      ]).then(function(r) {
        var bets = r[0] || [], D = { bets: bets, tds: r[1] || {}, machine: r[2], crowd: {}, chat: {}, years: [] };
        (r[3] || []).forEach(function(x) { D.crowd[x.y] = x.d; });
        (r[4] || []).forEach(function(x) {
          D.chat[x.y] = (x.rows || []).slice(1).map(function(row) {
            return { when: parseSheetTime(row[0]), who: row[1], text: row[2] || '', pinned: /pin/i.test(row[3] || ''), reactions: parseReactions(row[4]) };
          }).filter(function(m) { return m.when && (m.who === 'Maria' || m.who === 'Danielle') && m.text.trim(); });
        });
        D.moments = typeof museumAuto === 'function' ? museumAuto(bets) : [];
        D.years = wkYears(bets);
        WK.data = D; WK.loading = null;
        return D;
      });
      WK.loading.catch(function() { WK.loading = null; });
      return WK.loading;
    }
    // Just the bets (enough for headlines): the Home card and the 🔴 dot use this, not the whole load
    function wkLight() {
      if (WK.data) return Promise.resolve(WK.data);
      return loadAllBets().then(function(bets) { return { bets: bets, tds: {}, machine: null, crowd: {}, chat: {}, moments: [], years: wkYears(bets), light: true }; });
    }
    // Each season's finished weeks: every Maria/Danielle pick that week is decided
    function wkYears(bets) {
        var Y = {};
        bets.forEach(function(b) {
          if ((b.picker !== 'Maria' && b.picker !== 'Danielle') || !(b.homePick || b.awayPick)) return;
          var s = Y[b.year] || (Y[b.year] = {}), w = s[b.week] || (s[b.week] = { open: 0, n: 0 });
          w.n++; if (b.correct !== 'Yes' && b.correct !== 'No') w.open++;
        });
        return Object.keys(Y).sort().map(function(y) {
          return { year: y, weeks: Object.keys(Y[y]).map(Number).filter(function(w) { return !Y[y][w].open; }).sort(function(a, b) { return a - b; }) };
        }).filter(function(x) { return x.weeks.length; });
    }
    function wkLatest(D) { var s = D.years[D.years.length - 1]; return s ? { year: s.year, week: s.weeks[s.weeks.length - 1] } : null; }
    function wkKey(y, w) { return y + '-' + w; }
    function wkVolume(D, y) { return D.years.map(function(x) { return x.year; }).indexOf(String(y)) + 1; }
    function wkNotes() { return window.WEEKLY_NOTES || {}; }
    function wkOdds(r, name) { var home = playerKey(name) === playerKey(r.homePick); return oddsN(home ? r.homeOdds : r.awayOdds) * 100; }

    // ── 🧠 The story engine: one week ──
    function wkIssue(D, year, week) {
      year = String(year); week = parseInt(week, 10);
      var rows = D.bets.filter(function(b) { return b.year === year && (b.picker === 'Maria' || b.picker === 'Danielle'); });
      var wk = rows.filter(function(b) { return b.week === week && (b.homePick || b.awayPick); });
      // The games, in sheet order
      var G = {}, order = [];
      wk.forEach(function(b) {
        var k = b.game;
        if (!G[k]) { G[k] = { game: b.game, slot: b.slot, home: b.homeTeam, away: b.awayTeam, scorer: b.firstScorer, notOffered: false, side: b.side, picks: {} }; order.push(k); }
        if (b.notOffered) G[k].notOffered = true;
        var hit = b.correct === 'Yes' && !b.notOffered, name = hit ? b.firstScorer : '';
        G[k].picks[b.picker] = { home: b.homePick, away: b.awayPick, homeOdds: oddsN(b.homeOdds) * 100, awayOdds: oddsN(b.awayOdds) * 100, hit: hit, hitName: name, odds: hit ? wkOdds(b, name) : 0, u: b.netUnits };
      });
      var games = order.map(function(k) { return G[k]; });
      // The week and the season around it
      var u = { Maria: 0, Danielle: 0 }, hits = { Maria: 0, Danielle: 0 }, n = { Maria: 0, Danielle: 0 }, before = { Maria: 0, Danielle: 0 };
      rows.forEach(function(b) {
        if (b.correct !== 'Yes' && b.correct !== 'No') return;
        if (b.week < week) before[b.picker] += b.netUnits;
        if (b.week === week) { u[b.picker] += b.netUnits; if (!b.notOffered) { n[b.picker]++; if (b.correct === 'Yes') hits[b.picker]++; } }
      });
      var after = { Maria: before.Maria + u.Maria, Danielle: before.Danielle + u.Danielle };
      var lead = function(s) { return s.Maria > s.Danielle ? 'Maria' : s.Danielle > s.Maria ? 'Danielle' : ''; };
      var win = lead(u), leadB = lead(before), leadA = lead(after);
      var I = { year: year, week: week, name: weekName(week), when: weekEnd(year, week), games: games, u: u, hits: hits, n: n, before: before, after: after,
        winner: win, leadBefore: leadB, leadAfter: leadA, flip: !!(leadA && leadA !== leadB && week > 1), margin: Math.abs(after.Maria - after.Danielle) };
      // The biggest hit of the week
      var big = null;
      games.forEach(function(g) { WK_MD.forEach(function(w) { var p = g.picks[w]; if (p && p.hit && (!big || p.odds > big.odds)) big = { who: w, player: p.hitName, odds: p.odds, u: p.u, game: g }; }); });
      I.big = big;
      I.perfect = WK_MD.filter(function(w) { return n[w] >= 2 && hits[w] === n[w]; });
      I.blank = WK_MD.every(function(w) { return !hits[w]; });
      // 💔 Bad beats: a pick who scored later in the game (the script's Every TD list)
      I.beats = [];
      games.forEach(function(g) {
        var tds = D.tds && D.tds[tdKey(year, week, g.home, g.away)];
        if (!tds || !tds.length) return;
        WK_MD.forEach(function(w) {
          var p = g.picks[w]; if (!p) return;
          [p.home, p.away].forEach(function(name) {
            if (!name || playerKey(name) === playerKey(g.scorer)) return;
            var td = tds.filter(function(t, i) { return i > 0 && sameScorer(t.n, name); })[0];
            if (td) I.beats.push({ who: w, player: name, q: td.p > 4 ? 'OT' : 'Q' + td.p, clock: td.c, gap: Math.max(0, Math.round((td.t - tds[0].t) / 60)), first: g.scorer, game: g });
          });
        });
      });
      I.beats.sort(function(a, b) { return a.gap - b.gap; });
      // 🤖 The Machine's week (this season only: it started in 2026)
      var M = D.machine;
      if (M && String(M.year) === year && M.games) {
        var mg = M.games.filter(function(g) { return g.week === week && g.settled; });
        if (mg.length) {
          var mh = mg.filter(function(g) { return g.notOffered ? false : g.picks.some(function(x) { return playerKey(x.name) === playerKey(g.scorer); }); });
          I.machine = { n: mg.length, hits: mh.length, u: mg.reduce(function(a, g) { return a + (g.units || 0); }, 0),
            hitNames: mh.map(function(g) { return g.picks.filter(function(x) { return playerKey(x.name) === playerKey(g.scorer); })[0].name; }) };
        }
      }
      // 🏅 The Crowd's week
      var C = D.crowd[year];
      if (C && C.picks) {
        var cp = C.picks.filter(function(x) { return parseInt(x.week, 10) === week; });
        if (cp.length) {
          var who = {}, hitters = {}, picked = {};
          cp.forEach(function(x) {
            var g = G[x.game] || games.filter(function(gg) { return String(gg.game) === String(x.game); })[0];
            who[x.friend] = 1;
            [x.homePick, x.awayPick].forEach(function(nm) { if (nm) picked[nm] = (picked[nm] || 0) + 1; });
            if (g && g.scorer && [x.homePick, x.awayPick].some(function(nm) { return nm && playerKey(nm) === playerKey(g.scorer); })) (hitters[x.friend] = hitters[x.friend] || []).push(g.scorer);
          });
          var fav = Object.keys(picked).sort(function(a, b) { return picked[b] - picked[a]; })[0];
          I.crowd = { n: Object.keys(who).length, hitters: hitters, fav: fav, favN: fav ? picked[fav] : 0 };
        }
      }
      // 🗣️ Overheard: that week's Trash Talk (between last week's end and this one's), best reacted first
      var from = week > 1 ? weekEnd(year, week - 1) : Date.UTC(parseInt(year, 10), 6, 1), to = I.when;
      I.talk = (D.chat[year] || []).filter(function(m) { var t = m.when.getTime(); return t > from && t <= to; })
        .map(function(m) { return Object.assign({ score: Object.keys(m.reactions).length * 2 + (m.pinned ? 3 : 0) + Math.min(1, m.text.length / 120) }, m); })
        .sort(function(a, b) { return b.score - a.score; }).slice(0, 3);
      // 🏛️ Moments the Museum found that week
      I.moments = (D.moments || []).filter(function(m) { return String(m.season) === year && m.week === week && m.tag !== 'champ'; });
      I.note = wkNotes()[wkKey(year, week)] || '';
      // The headline
      I.head = wkHeadline(I); I.deck = wkDeck(I);
      return I;
    }
    function wkHeadline(I) {
      if (I.perfect.length === 2) return 'Both of them go perfect';
      if (I.perfect.length) return I.perfect[0] + ' goes ' + I.hits[I.perfect[0]] + '\u2011for\u2011' + I.n[I.perfect[0]]; // hyphens that don't break
      if (I.big && I.big.odds >= 1500) return I.big.player + ' cashes at +' + Math.round(I.big.odds) + ' for ' + I.big.who;
      if (I.flip) return I.leadAfter + ' takes the lead';
      if (I.blank) return 'Nobody hits';
      if (I.winner && Math.abs(I.u.Maria - I.u.Danielle) >= 15) return I.winner + ' runs away with ' + I.name;
      if (I.winner) return I.winner + ' takes ' + I.name;
      return 'A dead-even ' + I.name;
    }
    function wkDeck(I) {
      var p = function(w) { return w + ' went ' + I.hits[w] + '/' + I.n[w] + ' (' + fmtU(I.u[w]) + ')'; };
      var s = I.leadAfter ? I.leadAfter + (I.flip ? ' now leads' : ' leads') + ' the season by ' + I.margin.toFixed(1) + 'u.' : 'The season is dead even.';
      return p(I.winner || 'Maria') + ', ' + p(I.winner === 'Danielle' ? 'Maria' : 'Danielle') + '. ' + s;
    }

    // ── 🧠 The story engine: a whole season ──
    function wkSeason(D, year) {
      year = String(year);
      var S = D.years.filter(function(x) { return x.year === year; })[0] || { weeks: [] };
      var rows = D.bets.filter(function(b) { return b.year === year && (b.picker === 'Maria' || b.picker === 'Danielle') && (b.correct === 'Yes' || b.correct === 'No'); });
      var tot = { Maria: 0, Danielle: 0 }, hits = { Maria: 0, Danielle: 0 }, n = { Maria: 0, Danielle: 0 }, race = [], bestWeek = {}, bigHits = [], players = {};
      S.weeks.forEach(function(w) {
        var wu = { Maria: 0, Danielle: 0 };
        rows.filter(function(b) { return b.week === w; }).forEach(function(b) {
          wu[b.picker] += b.netUnits;
          if (!b.notOffered) { n[b.picker]++; if (b.correct === 'Yes') { hits[b.picker]++; var o = wkOdds(b, b.firstScorer); bigHits.push({ who: b.picker, player: b.firstScorer, odds: o, week: w, u: b.netUnits, team: playerKey(b.firstScorer) === playerKey(b.homePick) ? b.homeTeam : b.awayTeam }); players[b.firstScorer] = (players[b.firstScorer] || 0) + 1; } }
        });
        WK_MD.forEach(function(x) { tot[x] += wu[x]; if (!bestWeek[x] || wu[x] > bestWeek[x].u) bestWeek[x] = { week: w, u: wu[x] }; });
        race.push({ week: w, Maria: tot.Maria, Danielle: tot.Danielle, wu: wu });
      });
      // Lead changes and the biggest swing
      var changes = 0, prev = '', swing = null;
      race.forEach(function(r, i) {
        var l = r.Maria > r.Danielle ? 'Maria' : r.Danielle > r.Maria ? 'Danielle' : '';
        if (l && prev && l !== prev) changes++;
        if (l) prev = l;
        var d = r.wu.Maria - r.wu.Danielle;
        if (!swing || Math.abs(d) > Math.abs(swing.d)) swing = { week: r.week, d: d, who: d > 0 ? 'Maria' : 'Danielle' };
      });
      bigHits.sort(function(a, b) { return b.odds - a.odds; });
      var lead = tot.Maria > tot.Danielle ? 'Maria' : tot.Danielle > tot.Maria ? 'Danielle' : '';
      var done = year < CURRENT_YEAR; // a past season (in the ⏳ Time Machine, the season you're in is never done)
      var topPlayer = Object.keys(players).sort(function(a, b) { return players[b] - players[a]; })[0];
      var Z = { year: year, weeks: S.weeks, done: done, tot: tot, hits: hits, n: n, race: race, lead: lead, margin: Math.abs(tot.Maria - tot.Danielle), changes: changes, swing: swing,
        bestWeek: bestWeek, bigHits: bigHits.slice(0, 5), topPlayer: topPlayer ? { name: topPlayer, n: players[topPlayer] } : null };
      // 🤖 + 🏅 for the season
      var M = D.machine;
      if (M && String(M.year) === year && M.games) { var mg = M.games.filter(function(g) { return g.settled; }); Z.machine = { n: mg.length, u: mg.reduce(function(a, g) { return a + (g.units || 0); }, 0) }; }
      var C = D.crowd[year];
      if (C && C.picks) {
        var sc = {}; rows.forEach(function(b) { if (b.firstScorer) sc[b.week + '_' + b.game] = b.firstScorer; });
        var F = {};
        C.picks.forEach(function(x) { var s2 = sc[parseInt(x.week, 10) + '_' + x.game]; var f = F[x.friend] || (F[x.friend] = { n: 0, h: 0 }); f.n++; if (s2 && [x.homePick, x.awayPick].some(function(nm) { return nm && playerKey(nm) === playerKey(s2); })) f.h++; });
        var champ = Object.keys(F).sort(function(a, b) { return F[b].h - F[a].h || F[a].n - F[b].n; })[0];
        if (champ) Z.crowd = { champ: champ, h: F[champ].h, n: Object.keys(F).length };
      }
      var talk = (D.chat[year] || []).map(function(m) { return Object.assign({ score: Object.keys(m.reactions).length * 2 + (m.pinned ? 3 : 0) }, m); }).sort(function(a, b) { return b.score - a.score; });
      Z.talk = talk.slice(0, 3);
      Z.note = wkNotes()[String(year)] || '';
      Z.head = done ? (lead ? lead + ' wins ' + year : year + ' ends dead even') : (lead ? lead + ' leads ' + year : year + ' is dead even');
      Z.deck = (lead ? 'By ' + Z.margin.toFixed(1) + ' units' : 'Not a unit between them') + ' after ' + S.weeks.length + ' week' + (S.weeks.length === 1 ? '' : 's') + (changes ? ', with ' + changes + ' lead change' + (changes === 1 ? '' : 's') : '') + '.';
      return Z;
    }

    // ── The page: the archive, a week's issue, or a season issue ──
    function loadWeeklyTab() {
      var el = document.getElementById('weekly-content');
      if (!el.innerHTML || el.querySelector('.loading')) el.innerHTML = '<div class="loading">Printing The Weekly…</div>';
      wkLoad().then(function(D) {
        var m = /^#weekly\/(\d{4})(?:-(\d{1,2}))?/.exec(location.hash || '');
        if (m) WK.view = { year: m[1], week: m[2] ? parseInt(m[2], 10) : 0 };
        drawWeekly(el, D);
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load The Weekly. <button class="link-btn" onclick="loadWeeklyTab()">Try again</button></div>'; });
    }
    function wkGo(year, week) { WK.view = year ? { year: String(year), week: week || 0 } : null; var el = document.getElementById('weekly-content'); if (el && WK.data) { drawWeekly(el, WK.data); window.scrollTo(0, 0); } }
    function drawWeekly(el, D) {
      var V = WK.view;
      try { history.replaceState(null, '', location.pathname + location.search + (V ? '#weekly/' + V.year + (V.week ? '-' + V.week : '') : '')); } catch (e) {}
      if (!D.years.length) { el.innerHTML = '<div class="ui-empty">The first issue comes out once Week 1 is finished.</div>'; return; }
      if (V && V.week && D.years.some(function(s) { return s.year === V.year && s.weeks.indexOf(V.week) >= 0; })) { el.innerHTML = wkIssueHtml(D, wkIssue(D, V.year, V.week)); wkSeen(V.year, V.week); }
      else if (V && !V.week && D.years.some(function(s) { return s.year === V.year; })) el.innerHTML = wkSeasonHtml(D, wkSeason(D, V.year));
      else el.innerHTML = wkArchiveHtml(D);
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      wkBind(el);
    }
    function wkSeen(y, w) { try { localStorage.setItem('mvd-weekly-seen', wkKey(y, w)); } catch (e) {} wkBadge(); }

    function wkArchiveHtml(D) {
      var L = wkLatest(D), seen = ''; try { seen = localStorage.getItem('mvd-weekly-seen') || ''; } catch (e) {}
      var h = '<div class="wk-mast"><div class="wk-mast-t">The Weekly</div><div class="wk-mast-s">Maria vs Danielle · every week, every season</div></div>';
      D.years.slice().reverse().forEach(function(s) {
        var Z = wkSeason(D, s.year);
        h += '<div class="pf-h">' + s.year + ' <small>Vol. ' + wkVolume(D, s.year) + ' · ' + s.weeks.length + ' issue' + (s.weeks.length === 1 ? '' : 's') + '</small></div>';
        h += '<button class="wk-sea" data-wk-go="' + s.year + '-0"><span class="wk-sea-k">' + (Z.done ? '📕 The ' + s.year + ' Season Issue' : '📗 ' + s.year + ' so far') + '</span><b>' + escHtml(Z.head) + '</b><span>' + escHtml(Z.deck) + '</span></button>';
        h += '<div class="wk-list">' + s.weeks.slice().reverse().map(function(w) {
          var I = wkIssue(D, s.year, w), isNew = !ASOF && L && L.year === s.year && L.week === w && seen !== wkKey(s.year, w);
          return '<button class="wk-item" data-wk-go="' + s.year + '-' + w + '"><span class="wk-no">' + escHtml(wkShort(w)) + '</span><span class="wk-it"><b>' + escHtml(I.head) + (isNew ? ' <i class="wk-new">NEW</i>' : '') + '</b>' +
            '<small><span style="color:' + SB_M + '">' + fmtU(I.u.Maria) + '</span> · <span style="color:' + SB_D + '">' + fmtU(I.u.Danielle) + '</span></small></span></button>';
        }).join('') + '</div>';
      });
      return h;
    }

    function wkIssueHtml(D, I) {
      var S = D.years.filter(function(s) { return s.year === I.year; })[0], i = S.weeks.indexOf(I.week);
      var prev = S.weeks[i - 1], next = S.weeks[i + 1];
      var dateTxt = new Date(I.when).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      var h = '<div class="wk-top"><button class="link-btn" data-wk-go="">← All issues</button><span>' + (prev ? '<button class="link-btn" data-wk-go="' + I.year + '-' + prev + '">‹ ' + escHtml(wkName(prev)) + '</button>' : '') +
        (next ? ' · <button class="link-btn" data-wk-go="' + I.year + '-' + next + '">' + escHtml(wkName(next)) + ' ›</button>' : '') + '</span></div>';
      h += '<article class="wk-issue"><div class="wk-mast sm"><div class="wk-mast-t">The Weekly</div><div class="wk-mast-s">Vol. ' + wkVolume(D, I.year) + ' · No. ' + (i + 1) + ' · ' + escHtml(dateTxt) + '</div></div>';
      // Cover
      var wc = I.winner ? personColor(I.winner) : '#E5E7EB';
      h += '<div class="wk-cover" style="--wc:' + wc + '"><div class="wk-kick">' + escHtml(I.year + ' · ' + I.name) + '</div><h2 class="wk-head">' + escHtml(I.head) + '</h2><p class="wk-deck">' + escHtml(I.deck) + '</p>' +
        '<div class="wk-score">' + WK_MD.map(function(w) {
          var mx = Math.max(4, Math.abs(I.u.Maria), Math.abs(I.u.Danielle)), pct = Math.round(Math.abs(I.u[w]) / mx * 100);
          return '<div class="wk-sr"><b style="color:' + personColor(w) + '">' + w + '</b><span class="wk-bar"><i style="width:' + pct + '%;background:' + (I.u[w] >= 0 ? personColor(w) : 'var(--t4)') + '"></i></span><span class="wk-su">' + I.hits[w] + '/' + I.n[w] + ' · ' + fmtU(I.u[w]) + '</span></div>';
        }).join('') + '</div><div class="wk-btns"><button class="os-btn" data-wk-reel="' + I.year + '-' + I.week + '">🎬 Play the week reel</button></div></div>';
      // The games
      h += '<section class="wk-sec"><h3>🏈 The games</h3>' + I.games.map(function(g) {
        return '<div class="wk-g"><div class="wk-gh">' + teamLogo(g.away) + escHtml(teamNick(g.away)) + ' @ ' + teamLogo(g.home) + escHtml(teamNick(g.home)) + (g.slot ? ' <small>' + escHtml(g.slot) + '</small>' : '') +
          '<span class="wk-gs">' + (g.scorer ? '🏈 ' + escHtml(g.scorer) + (g.notOffered ? ' <small>(not offered)</small>' : '') : '') + '</span></div>' +
          WK_MD.map(function(w) {
            var p = g.picks[w]; if (!p) return '';
            var nm = function(n2, o) { if (!n2) return ''; var hit = p.hit && playerKey(n2) === playerKey(p.hitName); return '<span class="' + (hit ? 'wk-hit' : '') + '">' + (hit ? '✅ ' : '') + escHtml(n2) + (o ? ' <small>+' + Math.round(o) + '</small>' : '') + '</span>'; };
            return '<div class="wk-gp"><b style="color:' + personColor(w) + '">' + w + '</b><span class="wk-gn">' + [nm(p.home, p.homeOdds), nm(p.away, p.awayOdds)].filter(Boolean).join(' · ') + '</span><span class="wk-gu">' + fmtU(p.u) + '</span></div>';
          }).join('') + '</div>';
      }).join('') + '</section>';
      // Bad beat
      if (I.beats.length) {
        var b = I.beats[0];
        h += '<section class="wk-sec"><h3>💔 Bad beat of the week</h3><p><b style="color:' + personColor(b.who) + '">' + b.who + '</b> had <b>' + escHtml(b.player) + '</b>, who scored in the ' + b.q + (b.clock ? ' (' + escHtml(b.clock) + ')' : '') + ', ' +
          (b.gap ? b.gap + ' minutes of game time' : 'right') + ' after ' + escHtml(b.first) + ' got the first one.' + (I.beats.length > 1 ? ' <span class="u-faint">Plus ' + (I.beats.length - 1) + ' more like it.</span>' : '') + '</p></section>';
      }
      // The Machine
      if (I.machine) {
        var mm = I.machine, best = WK_MD.slice().sort(function(a, c) { return I.u[c] - I.u[a]; })[0];
        h += '<section class="wk-sec wk-col"><h3>🤖 The Machine\'s column</h3><p>I went <b>' + mm.hits + ' for ' + mm.n + '</b> this week (' + fmtU(mm.u) + ')' + (mm.hitNames.length ? ', thanks to ' + mm.hitNames.map(escHtml).join(' and ') : '') + '. ' +
          (mm.u > I.u[best] ? 'That beats both of them. I\'m just saying.' : mm.u > Math.min(I.u.Maria, I.u.Danielle) ? 'Better than ' + (I.u.Maria < I.u.Danielle ? 'Maria' : 'Danielle') + ', not as good as ' + best + '.' : 'They both beat me. I\'ll be back.') + '</p></section>';
      }
      // The Crowd
      if (I.crowd) {
        var hk = Object.keys(I.crowd.hitters);
        h += '<section class="wk-sec"><h3>🏅 The Crowd</h3><p>' + I.crowd.n + ' friend' + (I.crowd.n === 1 ? '' : 's') + ' picked. ' +
          (hk.length ? hk.map(function(f) { return fName(f) + ' hit ' + escHtml(I.crowd.hitters[f].join(' and ')); }).join(', ') + '.' : 'Nobody hit.') +
          (I.crowd.fav && I.crowd.favN > 1 ? ' The crowd\'s favorite: ' + escHtml(I.crowd.fav) + ' (' + I.crowd.favN + ' picks).' : '') + '</p></section>';
      }
      // Futures check (the newest issue of this season only)
      var L = wkLatest(D);
      if (!ASOF && L && L.year === I.year && L.week === I.week && I.year === CURRENT_YEAR && typeof FUTURES_ON !== 'undefined' && FUTURES_ON && FUTURES_ON.state !== 'open') h += '<section class="wk-sec"><h3>🔮 Futures watch</h3><div id="wk-fut" class="u-faint">Checking…</div></section>';
      // Overheard
      if (I.talk.length) h += '<section class="wk-sec"><h3>🗣️ Overheard</h3>' + I.talk.map(function(m) {
        var R = Object.keys(m.reactions).map(function(k) { return m.reactions[k]; }).join('');
        return '<blockquote class="wk-q" style="--pc:' + personColor(m.who) + '">“' + escHtml(m.text) + '”<cite>— ' + m.who + (R ? ' · ' + R : '') + '</cite></blockquote>';
      }).join('') + '</section>';
      // Moments
      if (I.moments.length) h += '<section class="wk-sec"><h3>🏛️ For the Museum</h3>' + I.moments.map(function(m) { return '<p><b>' + escHtml(m.title) + '.</b> ' + escHtml(m.caption || '') + '</p>'; }).join('') + '</section>';
      // Editor's note
      h += wkNoteHtml(I.note, wkKey(I.year, I.week));
      h += '<div class="wk-foot"><button class="adm-btn" onclick="asofGo(\'' + I.year + '\',' + I.week + ')">⏳ The whole site after this week</button> <button class="adm-btn" data-wk-share="' + I.year + '-' + I.week + '">🔗 Share this issue</button></div></article>';
      return h;
    }
    function wkSeasonHtml(D, Z) {
      var h = '<div class="wk-top"><button class="link-btn" data-wk-go="">← All issues</button></div>';
      h += '<article class="wk-issue"><div class="wk-mast sm"><div class="wk-mast-t">The Weekly</div><div class="wk-mast-s">' + (Z.done ? 'The ' + Z.year + ' Season Issue' : 'The ' + Z.year + ' season so far') + ' · Vol. ' + wkVolume(D, Z.year) + '</div></div>';
      var wc = Z.lead ? personColor(Z.lead) : '#E5E7EB';
      h += '<div class="wk-cover big" style="--wc:' + wc + '"><div class="wk-kick">' + (Z.done ? '🏆 Final' : '📈 ' + Z.weeks.length + ' weeks in') + '</div><h2 class="wk-head">' + escHtml(Z.head) + '</h2><p class="wk-deck">' + escHtml(Z.deck) + '</p>' +
        '<div class="wk-score">' + WK_MD.map(function(w) { return '<div class="wk-sr"><b style="color:' + personColor(w) + '">' + w + '</b><span class="wk-su">' + Z.hits[w] + '/' + Z.n[w] + ' hits (' + pct(Z.hits[w], Z.n[w]) + ') · <b>' + fmtU(Z.tot[w]) + '</b></span></div>'; }).join('') + '</div>' +
        '<div class="wk-btns"><button class="os-btn" data-wk-reel="' + Z.year + '-0">🎬 Play the season reel</button></div></div>';
      // The race
      if (Z.race.length > 1) {
        var W = 320, H = 120, all = []; Z.race.forEach(function(r) { all.push(r.Maria, r.Danielle); }); all.push(0);
        var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1) hi = lo + 1;
        var x = function(i) { return 6 + i / (Z.race.length - 1) * (W - 12); }, y = function(v) { return 8 + (hi - v) / (hi - lo) * (H - 16); };
        var path = function(w) { return Z.race.map(function(r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[w]).toFixed(1); }).join(' '); };
        h += '<section class="wk-sec"><h3>🏁 The race</h3><svg class="wk-race" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" class="wk-zero"/>' +
          WK_MD.map(function(w) { return '<path d="' + path(w) + '" fill="none" stroke="' + personColor(w) + '" stroke-width="2.4" stroke-linejoin="round"/>'; }).join('') + '</svg>' +
          '<p class="u-faint">' + (Z.changes ? Z.changes + ' lead change' + (Z.changes === 1 ? '' : 's') + '. ' : 'Never a lead change. ') + (Z.swing ? 'Biggest swing: ' + escHtml(weekName(Z.swing.week)) + ', ' + Math.abs(Z.swing.d).toFixed(1) + 'u toward ' + Z.swing.who + '.' : '') + '</p></section>';
      }
      if (Z.bigHits.length) h += '<section class="wk-sec"><h3>💰 The biggest hits</h3>' + Z.bigHits.map(function(b) {
        return '<div class="wk-gp"><b style="color:' + personColor(b.who) + '">' + b.who + '</b><span class="wk-gn">' + escHtml(b.player) + ' <small>' + escHtml(wkShort(b.week)) + '</small></span><span class="wk-gu">+' + Math.round(b.odds) + '</span></div>';
      }).join('') + '</section>';
      h += '<section class="wk-sec"><h3>📋 The season in short</h3>' + WK_MD.map(function(w) {
        var bw = Z.bestWeek[w];
        return '<p><b style="color:' + personColor(w) + '">' + w + '</b>: best week ' + (bw ? escHtml(weekName(bw.week)) + ' (' + fmtU(bw.u) + ')' : '—') + '.</p>';
      }).join('') + (Z.topPlayer ? '<p>Player of the year: <b>' + escHtml(Z.topPlayer.name) + '</b>, first TD in ' + Z.topPlayer.n + ' of their games.</p>' : '') +
        (Z.machine ? '<p>🤖 The Machine: ' + fmtU(Z.machine.u) + ' over ' + Z.machine.n + ' games.</p>' : '') + (Z.crowd ? '<p>🏅 Crowd champion: ' + fName(Z.crowd.champ) + ', ' + Z.crowd.h + ' hits.</p>' : '') + '</section>';
      if (Z.talk.length) h += '<section class="wk-sec"><h3>🗣️ Quotes of the season</h3>' + Z.talk.map(function(m) { return '<blockquote class="wk-q" style="--pc:' + personColor(m.who) + '">“' + escHtml(m.text) + '”<cite>— ' + m.who + '</cite></blockquote>'; }).join('') + '</section>';
      h += wkNoteHtml(Z.note, String(Z.year));
      h += '<div class="wk-list">' + Z.weeks.slice().reverse().map(function(w) { var I = wkIssue(D, Z.year, w); return '<button class="wk-item" data-wk-go="' + Z.year + '-' + w + '"><span class="wk-no">' + escHtml(wkShort(w)) + '</span><span class="wk-it"><b>' + escHtml(I.head) + '</b></span></button>'; }).join('') + '</div>';
      return h + '<div class="wk-foot"><button class="adm-btn" data-wk-share="' + Z.year + '-0">🔗 Share this issue</button></div></article>';
    }
    // ✍️ From the editor: John's note (admin can write it right here)
    function wkNoteHtml(note, key) {
      var admin = typeof SUB !== 'undefined' && SUB.role === 'admin' && !ASOF;
      if (!note && !admin) return '';
      return '<section class="wk-sec wk-ed"><h3>✍️ From the editor</h3>' + (note ? '<p>' + escHtml(note) + '</p>' : '') +
        (admin ? '<textarea class="adm-input" id="wk-note" maxlength="280" placeholder="A line from you for this issue (everyone sees it)">' + escHtml(note) + '</textarea><button class="adm-btn" data-wk-note="' + key + '">Save note</button> <span class="submit-msg" id="wk-note-msg"></span>' : '') + '</section>';
    }
    function wkBind(el) {
      el.querySelectorAll('[data-wk-go]').forEach(function(b) { b.addEventListener('click', function() { var v = b.getAttribute('data-wk-go'); if (!v) return wkGo(null); var p = v.split('-'); wkGo(p[0], parseInt(p[1], 10)); }); });
      el.querySelectorAll('[data-wk-reel]').forEach(function(b) { b.addEventListener('click', function() { var p = b.getAttribute('data-wk-reel').split('-'); openReel(p[0], parseInt(p[1], 10)); }); });
      el.querySelectorAll('[data-wk-share]').forEach(function(b) { b.addEventListener('click', function() { var p = b.getAttribute('data-wk-share').split('-'), w = parseInt(p[1], 10); shareUrl(b, location.origin + location.pathname + location.search + '#weekly/' + p[0] + (w ? '-' + w : ''), 'The Weekly · ' + (w ? p[0] + ' ' + weekName(w) : 'The ' + p[0] + ' season')); }); });
      var nb = el.querySelector('[data-wk-note]');
      if (nb) nb.addEventListener('click', function() {
        var key = nb.getAttribute('data-wk-note'), text = document.getElementById('wk-note').value.trim(), msg = document.getElementById('wk-note-msg');
        nb.disabled = true;
        picksApi({ pin: SUB.pin, action: 'weeklynote', key: key, text: text }).then(function(x) {
          nb.disabled = false;
          if (x.error) { msg.style.color = '#F87171'; msg.textContent = x.error; return; }
          window.WEEKLY_NOTES = x.notes || {}; msg.style.color = '#6EE7B7'; msg.textContent = 'Saved.';
        }).catch(function() { nb.disabled = false; msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the script.'; });
      });
      var fu = document.getElementById('wk-fut');
      if (fu) loadScriptOnce('js/futures.js').then(function() { return futLoad(); }).then(function(F) {
        var S = (F.standings || []).filter(function(s) { return s.md; });
        fu.className = ''; fu.innerHTML = S.length ? 'If the season ended today: ' + S.map(function(s) { return '<b style="color:' + personColor(s.name) + '">' + s.name + ' ' + s.pts + '</b>'; }).join(' · ') + '. <button class="link-btn" onclick="switchTab(\'futures\')">See the board</button>' : 'No calls yet.';
      }).catch(function() { fu.textContent = ''; });
    }

    // ── 🔴 New issue: a dot on Rivalry and a card on Home until it's been read ──
    function wkBadge(D) {
      D = D || WK.data; if (!D) return;
      var L = wkLatest(D), seen = ''; try { seen = localStorage.getItem('mvd-weekly-seen') || ''; } catch (e) {}
      var fresh = L && seen !== wkKey(L.year, L.week) && Date.now() - weekEnd(L.year, L.week) < 8 * 864e5 && !ASOF;
      document.querySelectorAll('.tab-btn[data-hub="rivalry"]').forEach(function(b) { b.classList.toggle('wk-dot', !!fresh); });
      var el = document.getElementById('wk-home');
      if (!el) return;
      if (!fresh) { el.style.display = 'none'; return; }
      var I = wkIssue(D, L.year, L.week);
      el.innerHTML = '<span>🗞️ <b>The Weekly</b> · ' + escHtml(I.name) + ' issue: “' + escHtml(I.head) + '”</span><button class="adm-btn" onclick="openWeekly(\'' + L.year + '\',' + L.week + ')">Read it</button>';
      el.style.display = '';
    }
