// Profiles tab: Maria and Danielle career profiles, friend profiles, and the friend emoji/color picker.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Profiles: career stats + trophy case ────────────────────────────────
    // loadAllBets() lives in core.js (Analytics uses it too)

    var PROFILE_WHO = 'Maria';
    function openProfile(name) { PROFILE_WHO = name; switchTab('profiles'); }
    // Every profile is public. Friends' upcoming picks are only shown to them and admin.
    function loadProfilesTab() {
      if (PROFILE_WHO === 'Maria' || PROFILE_WHO === 'Danielle') {
        renderProfile(PROFILE_WHO);
        if (!CROWD.data) getCrowd().then(function() { if (PROFILE_WHO === 'Maria' || PROFILE_WHO === 'Danielle') { var sw = document.querySelector('#profiles-content .pf-switch'); if (sw) { sw.outerHTML = profileSwitchHtml(PROFILE_WHO); bindProfileSwitch(document.getElementById('profiles-content')); } } }).catch(function() {});
      } else if (PROFILE_WHO === 'Machine') {
        var el = document.getElementById('profiles-content');
        loadScriptOnce('js/machine.js').then(function() { renderMachineProfile(el); }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the Machine.</div>'; });
      } else renderFriendProfile(PROFILE_WHO);
    }
    // Maria / Danielle buttons, plus "you" for a logged-in friend, plus every friend for admin
    function profileSwitchHtml(active) {
      var h = '<div class="pf-switch">' + ['Maria', 'Danielle'].map(function(n) {
        return '<button data-pf="' + n + '" class="' + (n === active ? 'on-' + n.toLowerCase() : '') + '">' + n + '</button>';
      }).join('') + '<button data-pf="Machine" class="' + (active === 'Machine' ? 'on-machine' : '') + '">🤖</button>';
      if (SUB.role === 'friend') h += '<button data-pf="' + escHtml(SUB.name) + '" class="' + (SUB.name === active ? 'on-friend' : '') + '"' + (SUB.name === active ? ' style="border-color:' + fStyle(SUB.name).color + ';background:' + hexA(fStyle(SUB.name).color, 0.25) + '"' : '') + '>' + (fStyle(SUB.name).emoji ? fStyle(SUB.name).emoji + ' ' : '') + escHtml(SUB.name) + '</button>';
      var others = ((CROWD.data && CROWD.data.friends) || []).filter(function(n) { return !(SUB.role === 'friend' && n === SUB.name); });
      if (others.length) {
        var onOther = others.indexOf(active) >= 0;
        h += '<select class="adm-input pf-select' + (onOther ? ' on' : '') + '" id="pf-friend" style="' + (onOther ? 'border-color:' + fStyle(active).color + ';color:#FFFFFF' : '') + '"><option value="">The Crowd…</option>' +
          others.map(function(n) { var st = fStyle(n); return '<option value="' + escHtml(n) + '"' + (n === active ? ' selected' : '') + '>' + (st.emoji ? st.emoji + ' ' : '') + escHtml(n) + '</option>'; }).join('') + '</select>';
      }
      return h + '</div>';
    }
    function bindProfileSwitch(root) {
      root.querySelectorAll('[data-pf]').forEach(function(b) {
        b.addEventListener('click', function() { PROFILE_WHO = b.getAttribute('data-pf'); loadProfilesTab(); });
      });
      var sel = root.querySelector('#pf-friend');
      if (sel) sel.addEventListener('change', function() { if (sel.value) { PROFILE_WHO = sel.value; loadProfilesTab(); } });
    }

    // Earned badges show; locked ones sit behind a "Show N locked" toggle
    function lockedBadges(list, draw) {
      var got = list.filter(function(a) { return a.got; }), locked = list.filter(function(a) { return !a.got; });
      var h = got.length ? '<div class="pf-badges">' + got.map(draw).join('') + '</div>' : '<div class="u-mb-s st-d">None yet.</div>';
      if (locked.length) h += '<details class="pf-locked"><summary>Show ' + locked.length + ' locked</summary><div class="pf-badges">' + locked.map(draw).join('') + '</div></details>';
      return h;
    }

    function profileStats(who, rows, jx, bb) {
      var other = who === 'Maria' ? 'Danielle' : 'Maria';
      function wk(r) { return r.year + ' ' + wkName(r.week); }
      function hitOdds(r) {
        var o = r.firstScorer === r.homePick ? r.homeOdds : r.firstScorer === r.awayPick ? r.awayOdds : Math.max(r.homeOdds, r.awayOdds);
        return Math.abs(o);
      }
      var mine = rows.filter(function(r) { return r.picker === who && (r.homePick || r.awayPick); });
      var scored = mine.filter(function(r) { return (r.correct === 'Yes' || r.correct === 'No') && !isNotOffered(r); });
      var allScored = mine.filter(function(r) { return r.correct === 'Yes' || r.correct === 'No'; });
      var S = { who: who, picks: mine.length, w: 0, n: scored.length, units: 0, dollars: 0 };
      allScored.forEach(function(r) { S.units += r.netUnits; S.dollars += r.netDollars; });
      scored.forEach(function(r) { if (r.correct === 'Yes') S.w++; });

      // Streaks
      var cw = 0, cl = 0; S.heater = { n: 0 }; S.drought = { n: 0 };
      scored.forEach(function(r) {
        if (r.correct === 'Yes') { cw++; cl = 0; if (cw > S.heater.n) S.heater = { n: cw, at: wk(r) }; }
        else { cl++; cw = 0; if (cl > S.drought.n) S.drought = { n: cl, at: wk(r) }; }
      });

      // Hits
      S.hits = scored.filter(function(r) { return r.correct === 'Yes'; }).map(function(r) { return { r: r, odds: hitOdds(r) }; });
      S.best = S.hits.slice().sort(function(a, b) { return b.odds - a.odds; })[0];
      S.payday = mine.filter(function(r) { return r.netDollars >= 100; })[0];

      // Weeks: who got more correct, complete weeks only
      var weeks = {};
      rows.forEach(function(r) {
        if ((r.picker !== 'Maria' && r.picker !== 'Danielle') || !(r.homePick || r.awayPick)) return;
        var k = r.year + '_' + r.week;
        var W = weeks[k] || (weeks[k] = { year: r.year, week: r.week, done: true, c: { Maria: 0, Danielle: 0 }, g: { Maria: 0, Danielle: 0 } });
        if (r.correct !== 'Yes' && r.correct !== 'No') { W.done = false; return; }
        if (isNotOffered(r)) return;
        W.g[r.picker]++;
        if (r.correct === 'Yes') W.c[r.picker]++;
      });
      S.weeksWon = 0; S.sweep = null;
      Object.keys(weeks).forEach(function(k) {
        var W = weeks[k];
        if (!W.done) return;
        if (W.c[who] > W.c[other]) S.weeksWon++;
        if (W.g[who] >= 2 && W.c[who] === W.g[who] && !S.sweep) S.sweep = W.year + ' ' + wkName(W.week);
      });

      // Seasons (finished seasons only for titles)
      S.seasons = {};
      rows.forEach(function(r) {
        if ((r.correct !== 'Yes' && r.correct !== 'No') || (r.picker !== 'Maria' && r.picker !== 'Danielle')) return;
        var Y = S.seasons[r.year] || (S.seasons[r.year] = { Maria: 0, Danielle: 0 });
        Y[r.picker] += r.netUnits;
      });
      S.titles = Object.keys(S.seasons).filter(function(y) { return y !== CURRENT_YEAR && S.seasons[y][who] > S.seasons[y][other]; });
      S.inBlack = Object.keys(S.seasons).filter(function(y) { return y !== CURRENT_YEAR && S.seasons[y][who] > 0; });

      // Players
      var count = {}, hitBy = {};
      mine.forEach(function(r) {
        [r.homePick, r.awayPick].filter(Boolean).forEach(function(p) { count[p] = (count[p] || 0) + 1; });
        if (r.correct === 'Yes' && r.firstScorer) hitBy[r.firstScorer] = true;
      });
      var players = Object.keys(count).sort(function(a, b) { return count[b] - count[a]; });
      S.fav = players[0] ? { name: players[0], n: count[players[0]] } : null;
      var cursed = players.filter(function(p) { return !hitBy[p]; });
      S.cursed = cursed[0] ? { name: cursed[0], n: count[cursed[0]] } : null;

      S.holiday = S.hits.filter(function(h) { return /thanksgiving|black friday|christmas/i.test(h.r.slot); })[0];
      S.intl = S.hits.filter(function(h) { return /international/i.test(h.r.slot); })[0];
      S.jinxes = jx.jinxes[who];
      var L = jx.loyalty[who], lt = L.kept + L.dropped;
      S.loyalty = lt ? Math.round(L.kept / lt * 100) + '%' : '—';
      S.beats = bb && bb.anyData ? bb.beats.filter(function(b) { return b.who === who; }) : null;
      S.beatsState = !bb ? 'loading' : bb.anyData ? 'ok' : 'down';
      S.closest = S.beats ? S.beats.slice().sort(function(a, b) { return a.gap - b.gap; })[0] : null;
      return S;
    }

    // Trophies whose number is already on a tile above (Longest Heater, Weeks Won, Ride or Die, Jinxes,
    // Bad Beats) don't repeat it: they just show what it takes, unlocked or with progress.
    function achievementsFor(S) {
      function hitAt(min) { return S.hits.filter(function(h) { return h.odds >= min; })[0]; }
      function hitLabel(h) { return h ? h.r.year + ' ' + wkName(h.r.week) + ' · ' + h.r.firstScorer + ' ' + fmtOdds(h.odds) : ''; }
      var sniper = hitAt(20), moon = hitAt(30);
      var beats = S.beats;
      var heart = beats ? beats.filter(function(b) { return b.gap <= 2; })[0] : null;
      var A = [
        { ic: '🎯', n: 'Sniper', d: 'Hit a pick at +2000 or longer', got: !!sniper, w: hitLabel(sniper), p: [S.best ? Math.min(S.best.odds, 20) : 0, 20], pl: S.best ? 'Best so far ' + fmtOdds(S.best.odds) : '' },
        { ic: '🚀', n: 'Moonshot', d: 'Hit a pick at +3000 or longer', got: !!moon, w: hitLabel(moon), p: [S.best ? Math.min(S.best.odds, 30) : 0, 30], pl: S.best ? 'Best so far ' + fmtOdds(S.best.odds) : '' },
        { ic: '🔥', n: 'Heater', d: '3 correct picks in a row', got: S.heater.n >= 3, w: '', p: [Math.min(S.heater.n, 3), 3] },
        { ic: '🌋', n: 'On Fire', d: '5 correct picks in a row', got: S.heater.n >= 5, w: '', p: [Math.min(S.heater.n, 5), 5] },
        { ic: '🧹', n: 'Clean Sweep', d: 'Go perfect in a week (2+ games)', got: !!S.sweep, w: S.sweep || '' },
        { ic: '👑', n: 'Weekly Champ', d: 'Win 5 weeks', got: S.weeksWon >= 5, w: '', p: [Math.min(S.weeksWon, 5), 5] },
        { ic: '💰', n: 'Big Payday', d: 'Win $100+ on one bet', got: !!S.payday, w: S.payday ? S.payday.year + ' ' + wkName(S.payday.week) + ' · +$' + S.payday.netDollars : '' },
        { ic: '📈', n: 'In the Black', d: 'Finish a season up in units', got: S.inBlack.length > 0, w: S.inBlack.join(', ') },
        { ic: '🏆', n: 'Champion', d: 'Win a season', got: S.titles.length > 0, w: S.titles.length ? S.titles.join(', ') + ' champ' : '' },
        { ic: '❤️', n: 'Ride or Die', d: 'Pick the same player 10 times', got: !!(S.fav && S.fav.n >= 10), w: '', p: [S.fav ? Math.min(S.fav.n, 10) : 0, 10] },
        { ic: '🦃', n: 'Holiday Hero', d: 'Hit on Thanksgiving, Black Friday or Christmas', got: !!S.holiday, w: hitLabel(S.holiday) },
        { ic: '🌍', n: 'Globetrotter', d: 'Hit in an International game', got: !!S.intl, w: hitLabel(S.intl) },
        { ic: '💯', n: 'Century', d: 'Make 100 picks', got: S.picks >= 100, w: S.picks + ' picks', p: [Math.min(S.picks, 100), 100] },
        // Hall of Shame
        { shame: true, ic: '🧊', n: 'Ice Cold', d: '5 misses in a row', got: S.drought.n >= 5, w: S.drought.n >= 5 ? 'Worst run: ' + S.drought.n + ' · ' + S.drought.at : '', p: [Math.min(S.drought.n, 5), 5] },
        { shame: true, ic: '💀', n: 'Cursed', d: 'Pick a player 5 times who never hits for you', got: !!(S.cursed && S.cursed.n >= 5), w: S.cursed && S.cursed.n >= 5 ? S.cursed.name + ' · 0 for ' + S.cursed.n : '', p: [S.cursed ? Math.min(S.cursed.n, 5) : 0, 5] },
        { shame: true, ic: '🪄', n: 'Jinx Master', d: '3 jinxes', got: S.jinxes.length >= 3, w: '', p: [Math.min(S.jinxes.length, 3), 3] },
        { shame: true, ic: '💔', n: 'Heartbreaker', d: 'A bad beat within 2 minutes', got: !!heart, w: heart ? heart.year + ' ' + wkName(heart.week) + ' · ' + heart.player : '' },
        { shame: true, ic: '🐍', n: 'Snakebitten', d: '5 bad beats', got: !!(beats && beats.length >= 5), w: '', p: beats ? [Math.min(beats.length, 5), 5] : null },
      ];
      return A;
    }

    // ── Profiles 2.0 (v128): a career page with a trading-card header and four tabs ──
    var PROFILE_TAB = 'overview';
    var PF_TABS = [['overview', 'Overview'], ['seasons', 'Seasons'], ['cards', 'Cards'], ['trophies', 'Trophies']];

    // One row per season: games, hit rate, units, $, best hit, longest heater, weeks won, result
    function profileSeasons(who, rows) {
      var other = who === 'Maria' ? 'Danielle' : 'Maria', Y = {};
      rows.forEach(function(r) {
        if (!isMD(r.picker) || !(r.homePick || r.awayPick)) return;
        var y = Y[r.year] || (Y[r.year] = { year: r.year, games: 0, n: 0, h: 0, u: 0, d: 0, ou: 0, best: null, heat: 0, cur: 0, W: {} });
        var done = r.correct === 'Yes' || r.correct === 'No';
        if (r.picker === other) { if (done) y.ou += r.netUnits; }
        else {
          if (done) { y.games++; y.u += r.netUnits; y.d += r.netDollars; }
          if (done && !isNotOffered(r)) {
            y.n++;
            if (r.correct === 'Yes') {
              y.h++; y.cur++; y.heat = Math.max(y.heat, y.cur);
              var o = r.firstScorer === r.homePick ? oddsN(r.homeOdds) : r.firstScorer === r.awayPick ? oddsN(r.awayOdds) : 0;
              if (!y.best || o > y.best.o) y.best = { o: o, name: r.firstScorer, week: r.week, game: r.game };
            } else y.cur = 0;
          }
        }
        if (done && !isNotOffered(r)) { var w = y.W[r.week] || (y.W[r.week] = { me: 0, them: 0 }); if (r.correct === 'Yes') w[r.picker === who ? 'me' : 'them']++; }
      });
      return Object.keys(Y).sort().reverse().map(function(k) {
        var y = Y[k]; y.weeksWon = Object.keys(y.W).filter(function(w) { return y.W[w].me > y.W[w].them; }).length;
        y.final = k !== CURRENT_YEAR; y.champ = y.final && y.u > y.ou;
        return y;
      });
    }

    async function renderProfile(who) {
      PROFILE_WHO = who;
      var el = document.getElementById('profiles-content');
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading profile…</div>';
      var rows = await loadAllBets();
      var jx = computeJinxes(rows);
      draw(null);
      var bb = null;
      try { bb = await computeBadBeats(rows); } catch (e) {}
      if (PROFILE_WHO === who) draw(bb);

      function draw(bb) {
        if (PROFILE_WHO !== who) return;
        var S = profileStats(who, rows, jx, bb), pc = personColor(who), Y = profileSeasons(who, rows);
        // Signature pick: the player who's hit for her the most (ties: the longest odds)
        var sig = {}; S.hits.forEach(function(x) { var n = x.r.firstScorer; (sig[n] = sig[n] || { n: 0, best: 0 }); sig[n].n++; sig[n].best = Math.max(sig[n].best, x.odds); });
        var sigName = Object.keys(sig).sort(function(a, b) { return sig[b].n - sig[a].n || sig[b].best - sig[a].best; })[0];
        var h = profileSwitchHtml(who);
        h += '<div class="pf-card" style="--pc:' + pc + '">' +
          '<div class="pf-card-top"><img src="pics/' + who + '.jpeg" alt="' + who + '"><div class="pf-card-id"><div class="pf-name">' + who + '</div>' +
          '<div class="pf-sub">' + Y.length + ' season' + (Y.length === 1 ? '' : 's') + ' · ' + S.picks + ' picks' + (S.titles.length ? ' · 🏆 ' + S.titles.join(', ') : '') + '</div>' +
          (sigName ? '<div class="pf-sig">✍️ Signature pick: <b>' + escHtml(sigName) + '</b> <span>' + sig[sigName].n + ' hit' + (sig[sigName].n === 1 ? '' : 's') + '</span></div>' : '') + '</div></div>' +
          '<div class="pf-big">' +
            '<div><b>' + S.w + '/' + S.n + '</b><span>Record · ' + (S.n ? Math.round(S.w / S.n * 100) : 0) + '%</span></div>' +
            '<div title="' + fmtU(S.units) + '"><b class="' + (S.units >= 0 ? 'u-good' : 'u-bad') + '">' + shortU(S.units) + '</b><span>Units</span></div>' +
            '<div title="' + fmtD(S.dollars) + '"><b class="' + (S.dollars >= 0 ? 'u-good' : 'u-bad') + '">' + shortD(S.dollars) + '</b><span>Money</span></div>' +
          '</div></div>';
        h += '<div class="pf-tabs">' + PF_TABS.map(function(t) { return '<button class="hub-sub-btn' + (PROFILE_TAB === t[0] ? ' on' : '') + '" data-pf-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
        h += '<div class="pf-pane">' + profilePane(who, S, Y, rows) + '</div>';
        el.innerHTML = h;
        bindProfileSwitch(el);
        el.querySelectorAll('[data-pf-tab]').forEach(function(b) { b.addEventListener('click', function() { PROFILE_TAB = b.getAttribute('data-pf-tab'); draw(bb); }); });
        profileAfter(el, who, rows);
      }
    }

    function profilePane(who, S, Y, rows) {
      var h = '';
      if (PROFILE_TAB === 'overview') {
        function tile(l, v, sub, pane) { return '<div class="pf-tile' + (pane ? ' pf-tile-go" role="button" tabindex="0" title="See the full list in Analytics" onclick="openAnalyticsPane(\'' + pane + '\')' : '') + '"><div class="l">' + l + (pane ? ' ›' : '') + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
        h += '<div class="pf-tiles">' +
          tile('Best Hit', S.best ? S.best.r.firstScorer + ' ' + fmtOdds(S.best.odds) : '—', S.best ? '<span ' + gameLinkAttr(S.best.r.year, S.best.r.game) + '>' + S.best.r.year + ' ' + wkName(S.best.r.week) + ' ›</span>' : '') +
          tile('Weeks Won', S.weeksWon, 'Most correct that week') +
          tile('Longest Heater', S.heater.n + ' straight', S.heater.at || '') +
          tile('Ride or Die', S.fav ? S.fav.name : '—', S.fav ? 'picked ' + S.fav.n + 'x' : '') +
          tile('Bad Beats', S.beats ? S.beats.length : (S.beatsState === 'down' ? '—' : '…'), S.closest ? 'Closest: ' + S.closest.player + ' (' + S.closest.gap + ' min)' : (S.beats ? 'None yet' : S.beatsState === 'down' ? 'Couldn\'t reach ESPN' : 'Checking ESPN…'), 'pain') +
          tile('Jinxes', S.jinxes.length, 'Loyalty ' + S.loyalty, 'pain') +
          '</div>';
        h += '<div class="pf-h">⚔️ Rivalry ledger <small>games where only one side hit</small></div><div class="pf-ledger" id="pf-ledger"><div class="loading">Adding it up…</div></div>';
        h += '<div class="pf-h">🗓️ Career timeline <small>tap a moment for its game</small></div><div class="pf-tl" id="pf-tl"><div class="loading">Building the timeline…</div></div>';
        if (typeof scoutingReportHtml === 'function') h += '<div class="sr-wrap">' + scoutingReportHtml(who, rows) + '</div>';
      }
      if (PROFILE_TAB === 'seasons') {
        h += '<div class="pf-h">📅 Season by season <small>the back of the card</small></div><div class="pf-seas"><div class="pf-seas-r pf-seas-head"><span>Season</span><span>Games</span><span>Hit %</span><span>Units</span><span>$</span><span>Best hit</span><span>Heater</span><span>Wks won</span></div>' +
          Y.map(function(y) {
            return '<div class="pf-seas-r"><span class="pf-seas-y">' + y.year + (y.champ ? ' 🏆' : !y.final ? ' <small>so far</small>' : '') + '</span><span>' + y.games + '</span><span>' + (y.n ? Math.round(y.h / y.n * 100) + '%' : '—') + ' <small>' + y.h + '/' + y.n + '</small></span>' +
              '<span class="' + (y.u >= 0 ? 'u-good' : 'u-bad') + '">' + fmtU(y.u) + '</span><span class="' + (y.d >= 0 ? 'u-good' : 'u-bad') + '">' + fmtDWhole(y.d) + '</span>' +
              '<span>' + (y.best ? '<span ' + gameLinkAttr(y.year, y.best.game) + '>' + escHtml(y.best.name) + ' ' + fmtOdds(y.best.o) + '</span>' : '—') + '</span><span>' + y.heat + '</span><span>' + y.weeksWon + '</span></div>';
          }).join('') +
          '<div class="pf-seas-r pf-seas-tot"><span>Career</span><span>' + Y.reduce(function(a, y) { return a + y.games; }, 0) + '</span><span>' + (S.n ? Math.round(S.w / S.n * 100) : 0) + '% <small>' + S.w + '/' + S.n + '</small></span>' +
          '<span class="' + (S.units >= 0 ? 'u-good' : 'u-bad') + '">' + fmtU(S.units) + '</span><span class="' + (S.dollars >= 0 ? 'u-good' : 'u-bad') + '">' + fmtDWhole(S.dollars) + '</span><span>' + (S.best ? escHtml(S.best.r.firstScorer) + ' ' + fmtOdds(S.best.odds) : '—') + '</span><span>' + S.heater.n + '</span><span>' + S.weeksWon + '</span></div></div>' +
          '<div class="ui-note u-mt-s">Games counts every graded bet; hit % leaves out games where the first TD scorer wasn\'t offered. Heater is the longest run of straight hits that season.</div>';
      }
      if (PROFILE_TAB === 'cards') h += '<div class="tcd-slot" data-who="' + who + '"></div>';
      if (PROFILE_TAB === 'trophies') {
        var A = achievementsFor(S);
        function badges(list) {
          return lockedBadges(list, function(a) {
            var prog = (!a.got && a.p) ? '<div class="pf-bar"><i style="width:' + Math.round(a.p[0] / a.p[1] * 100) + '%"></i></div><div class="pg">' + (a.pl || (a.p[0] + ' / ' + a.p[1])) + '</div>' : '';
            return '<div class="pf-badge ' + (a.got ? 'got' : 'locked') + (a.shame ? ' shame' : '') + '" title="' + a.d + '">' +
              '<div class="ic">' + a.ic + '</div><div class="n">' + a.n + '</div><div class="d">' + a.d + '</div>' +
              (a.got && a.w ? '<div class="w">' + a.w + '</div>' : '') + prog + '</div>';
          });
        }
        var glory = A.filter(function(a) { return !a.shame; }), shame = A.filter(function(a) { return a.shame; });
        glory.sort(function(a, b) { return (b.got ? 1 : 0) - (a.got ? 1 : 0); });
        shame.sort(function(a, b) { return (b.got ? 1 : 0) - (a.got ? 1 : 0); });
        h += '<div class="pf-h">🏆 Trophy Case <small>' + glory.filter(function(a) { return a.got; }).length + ' / ' + glory.length + ' unlocked</small></div>' + badges(glory);
        h += '<div class="pf-h">🤡 Hall of Shame <small>' + shame.filter(function(a) { return a.got; }).length + ' / ' + shame.length + '</small></div>' + badges(shame);
      }
      return h;
    }

    // The parts that load after: card album, rivalry ledger, career timeline
    function profileAfter(el, who, rows) {
      var slot = el.querySelector('.tcd-slot');
      if (slot) loadScriptOnce('js/cards.js').then(function() { renderCardAlbum(slot, who); }).catch(function() {});
      var led = document.getElementById('pf-ledger');
      if (led) profileLedger(who, rows).then(function(L) { if (document.body.contains(led)) led.innerHTML = L; }).catch(function() { led.innerHTML = ''; });
      var tl = document.getElementById('pf-tl');
      if (tl) profileTimeline(who, rows).then(function(T) { if (document.body.contains(tl)) tl.innerHTML = T; if (typeof fillHeadshots === 'function') fillHeadshots(tl); }).catch(function() { tl.innerHTML = ''; });
    }

    // ⚔️ Against the other one, the Machine and every friend: games where only one side hit
    function profileLedger(who, rows) {
      var other = who === 'Maria' ? 'Danielle' : 'Maria', out = [];
      var G = {}; // year_game -> { by: {Maria: row, Danielle: row}, scorer, vd }
      rows.forEach(function(r) {
        if (!isMD(r.picker) || !(r.homePick || r.awayPick)) return;
        var k = r.year + '_' + r.game, g = G[k] || (G[k] = { by: {}, scorer: '', vd: false, year: r.year, game: r.game });
        g.by[r.picker] = r; if (r.firstScorer) g.scorer = r.firstScorer; if (isNotOffered(r)) g.vd = true;
      });
      function hitRow(r) { return !!r && r.correct === 'Yes' && !isNotOffered(r); }
      function line(label, color, me, them, both, n, note) {
        var lead = me > them ? 'lead' : me < them ? 'trail' : '';
        return '<div class="pf-led-r ' + lead + '"><span class="pf-led-w" style="color:' + color + '">' + label + '</span><span class="pf-led-s"><b>' + me + '</b>–<b>' + them + '</b></span>' +
          '<span class="pf-led-n">' + (both ? both + ' both hit · ' : '') + n + ' game' + (n === 1 ? '' : 's') + (note ? ' · ' + note : '') + '</span></div>';
      }
      // vs the other one
      var a = { me: 0, them: 0, both: 0, n: 0 };
      Object.keys(G).forEach(function(k) {
        var g = G[k], m = g.by[who], o = g.by[other];
        if (!m || !o || !(m.correct === 'Yes' || m.correct === 'No') || g.vd) return;
        a.n++; var x = hitRow(m), y = hitRow(o);
        if (x && !y) a.me++; else if (y && !x) a.them++; else if (x && y) a.both++;
      });
      out.push(line('vs ' + other, personColor(other), a.me, a.them, a.both, a.n));
      var ps = [];
      // vs the Machine (this season, from kickoff on)
      if (PICKS_URL) ps.push(loadScriptOnce('js/machine.js').then(function() { return loadMachine(); }).then(function(D) {
        var b = { me: 0, them: 0, both: 0, n: 0 };
        D.games.forEach(function(g) {
          var r = g.rows[who]; if (!r || !g.settled || g.notOffered) return;
          b.n++; var x = hitRow(r), y = !!g.hit;
          if (x && !y) b.me++; else if (y && !x) b.them++; else if (x && y) b.both++;
        });
        if (b.n) out.push(line('vs 🤖 The Machine', '#A78BFA', b.me, b.them, b.both, b.n, D.year));
      }).catch(function() {}));
      // vs each friend, every season
      if (PICKS_URL) ps.push(Promise.all(SEASONS.map(function(s) { return (s.year === CURRENT_YEAR ? getCrowd() : picksApi({ action: 'crowd', season: s.year })).then(function(d) { return { y: s.year, d: d || {} }; }).catch(function() { return { y: s.year, d: {} }; }); })).then(function(list) {
        var F = {};
        list.forEach(function(x) {
          (x.d.picks || []).forEach(function(p) {
            var g = G[x.y + '_' + p.game]; if (!g || g.vd || !g.scorer) return;
            var m = g.by[who]; if (!m || !(m.correct === 'Yes' || m.correct === 'No')) return;
            var f = F[p.friend] || (F[p.friend] = { me: 0, them: 0, both: 0, n: 0 });
            var x2 = hitRow(m), y = [p.homePick, p.awayPick].some(function(n) { return n && playerKey(n) === playerKey(g.scorer); });
            f.n++; if (x2 && !y) f.me++; else if (y && !x2) f.them++; else if (x2 && y) f.both++;
          });
        });
        Object.keys(F).sort(function(a, b) { return F[b].n - F[a].n; }).forEach(function(n) { var f = F[n]; out.push(line('vs ' + (fStyle(n).emoji ? fStyle(n).emoji + ' ' : '') + escHtml(n), fStyle(n).color || '#FCD34D', f.me, f.them, f.both, f.n)); });
      }));
      return Promise.all(ps).then(function() {
        return out.join('') + '<div class="ui-note u-mt-s">Her wins – theirs, counting only games where one side hit and the other didn\'t.</div>';
      });
    }

    // 🗓️ Seasons newest first: how each one ended, and her Museum moments in it (each opens its game)
    function profileTimeline(who, rows) {
      var Y = profileSeasons(who, rows);
      return loadScriptOnce('js/museum.js').then(function() { return museumData(); }).catch(function() { return []; }).then(function(list) {
        var mine = (list || []).filter(function(m) { return !m.hidden && (m.who === who || m.who === 'Both'); });
        return Y.map(function(y) {
          var ms = mine.filter(function(m) { return String(m.season) === y.year; }).sort(function(a, b) { return (b.week || 0) - (a.week || 0); });
          var head = '<div class="pf-tl-y"><span class="pf-tl-dot big"></span><div><b>' + y.year + '</b> ' +
            (y.final ? (y.champ ? '🏆 Champion · ' : '') + 'finished ' + fmtU(y.u) : 'so far ' + fmtU(y.u)) + ' · ' + y.h + ' hit' + (y.h === 1 ? '' : 's') + '</div></div>';
          return head + ms.map(function(m) {
            var tag = (typeof MU_TAGS !== 'undefined' && (MU_TAGS[m.tag] || MU_TAGS.custom)) || { ic: '⭐', t: '' };
            var link = m.gameNo ? ' ' + gameLinkAttr(m.season, m.gameNo) : '';
            return '<div class="pf-tl-m"' + link + '><span class="pf-tl-dot"></span><span class="pf-tl-ic">' + tag.ic + '</span><div class="pf-tl-t"><b>' + escHtml(m.title) + '</b>' +
              '<small>' + (m.week && m.week !== 99 ? wkName(m.week) + (m.game ? ' · ' + escHtml(m.game) : '') : '') + (m.gameNo ? ' ›' : '') + '</small></div></div>';
          }).join('');
        }).join('') || '<div class="ui-empty">No seasons yet.</div>';
      });
    }

    // ── Friend profiles (only that friend, or admin) ────────────────────────
    function renderFriendProfile(name) {
      var el = document.getElementById('profiles-content');
      var owner = SUB.role === 'friend' && SUB.name === name, admin = SUB.role === 'admin';
      el.innerHTML = profileSwitchHtml(name) + '<div class="loading">Loading profile…</div>';
      bindProfileSwitch(el);
      var priv = owner ? picksApi({ pin: SUB.pin, action: 'fmine' }) : admin ? picksApi({ pin: SUB.pin, action: 'fall' }) : Promise.resolve(null);
      Promise.all([priv, getCrowd(), fetchSheet('Winnings', 'A1:Q400')]).then(function(res) {
        var crowd = res[1], G = crowdGames(res[2]);
        if (res[0] && res[0].error) { PROFILE_WHO = 'Maria'; renderProfile('Maria'); return; }
        if ((crowd.friends || []).indexOf(name) < 0 && !owner) { PROFILE_WHO = 'Maria'; renderProfile('Maria'); return; }
        // Public view: only picks for games that have kicked off. Owner and admin also see upcoming ones.
        var rows = res[0]
          ? (res[0].rows || []).filter(function(r) { return r.friend === name && String(r.season) === String(CURRENT_YEAR); })
          : crowd.picks.filter(function(p) { return p.friend === name; });
        if (res[0]) rows.forEach(function(r) {
          r.revealed = crowd.picks.some(function(p) { return p.friend === r.friend && String(p.week) === String(r.week) && String(p.game) === String(r.game); });
        });
        var S = friendStats(name, rows, G, crowd.picks);
        var R = rankFriends(crowd, G);
        var rank = R.ranked.map(function(s) { return s.name; }).indexOf(name) + 1;
        var st = fStyle(name), col = st.color;
        var favs = Object.keys(S.players).sort(function(a, b) { return S.players[b] - S.players[a]; });
        var fav = favs[0];
        var cursed = favs.filter(function(p) { return !S.playerHits[p] && S.players[p] >= 5; })[0];
        var sweep = Object.keys(S.weeks).filter(function(w) { return S.weeks[w].n >= 2 && S.weeks[w].w === S.weeks[w].n; })[0];
        var holiday = S.hits.filter(function(x) { return /thanksgiving|black friday|christmas/i.test(x.g.slot); })[0];
        var intl = S.hits.filter(function(x) { return /international/i.test(x.g.slot); })[0];
        var playerPicks = Object.keys(S.players).reduce(function(a, p) { return a + S.players[p]; }, 0);
        function hitW(x) { return x ? wkName(x.g.week) + ' · ' + x.g.scorer : ''; }

        var h = profileSwitchHtml(name);
        h += '<div class="pf-hero" style="--pc:' + col + ';background:linear-gradient(140deg,#0F0F12 0%,' + hexA(col, 0.16) + ' 55%,' + hexA(col, 0.45) + ' 100%)">' +
          (owner ? '<button class="fr-cust" id="fr-style-btn">🎨 Customize</button>' : '') +
          '<div class="fr-avatar" style="border-color:' + col + ';box-shadow:0 0 30px -4px ' + col + ';' + (st.emoji ? 'font-size:46px' : 'color:' + col) + '">' + (st.emoji || escHtml(name.charAt(0).toUpperCase())) + '</div>' +
          '<div class="pf-name" style="color:' + col + '">' + escHtml(name) + '</div>' +
          '<div class="pf-sub">' + CURRENT_YEAR + ' Crowd · ' + (rank ? 'Ranked #' + rank + ' of ' + R.ranked.length : 'Unranked (' + S.n + '/' + CROWD_MIN + ' games)') + (admin ? ' · 🔒 Admin view' : '') + '</div>' +
          '<div class="pf-big"><div><b>' + S.w + '–' + (S.n - S.w) + '</b><span>Record</span></div>' +
          '<div><b class="u-good">' + pctTxt(S.pct) + '</b><span>Win %</span></div>' +
          '<div><b>' + streakTxt(S.cur) + '</b><span>Streak</span></div></div></div>';
        if (owner) h += '<div id="fr-style" style="display:none"></div>';

        function tile(l, v, sub) { return '<div class="pf-tile"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
        var last = S.hits[S.hits.length - 1];
        h += '<div class="pf-tiles">' +
          tile('Latest Hit', last ? escHtml(last.g.scorer) : '—', last ? weekName(last.g.week) : '') +
          tile('Lone Wolves', S.lone.length, 'Hits nobody else had') +
          tile('Longest Heater', S.heater.n + ' straight', S.heater.n ? 'through ' + wkName(S.heater.at) : '') +
          tile('Ride or Die', fav ? escHtml(fav) : '—', fav ? 'picked ' + S.players[fav] + 'x' : '') +
          tile('Games Picked', S.picks, (owner || admin) ? S.upcoming.length + ' still to play' : 'that have kicked off') +
          tile('Best Week', (function() { var b = Object.keys(S.weeks).sort(function(a, c) { return S.weeks[c].w - S.weeks[a].w; })[0]; return b && S.weeks[b].w ? S.weeks[b].w + ' hit' + (S.weeks[b].w > 1 ? 's' : '') : '—'; })(),
            (function() { var b = Object.keys(S.weeks).sort(function(a, c) { return S.weeks[c].w - S.weeks[a].w; })[0]; return b && S.weeks[b].w ? weekName(b) : ''; })()) +
          '</div>';

        // ⚔️ Head to head vs Maria and Danielle: games where only one of them hit
        h += '<div class="pf-h">⚔️ Head to Head <small>games where only one side hit</small></div>';
        ['Maria', 'Danielle'].forEach(function(who) {
          var x = S.h2h[who], c2 = personColor(who), tot = x.me + x.them;
          var verdict = !tot ? 'No decided games yet' : x.me > x.them ? escHtml(name) + ' leads' : x.them > x.me ? who + ' leads' : 'All square';
          h += '<div class="h2h"><div class="h2h-top"><span><b style="color:' + col + '">' + escHtml(name) + ' ' + x.me + '</b></span>' +
            '<span class="h2h-mid">vs ' + who + ' · ' + verdict + '</span><span><b style="color:' + c2 + '">' + x.them + ' ' + who + '</b></span></div>' +
            '<div class="h2h-bar"><i style="width:' + (tot ? x.me / tot * 100 : 50) + '%;background:' + col + '"></i><i style="flex:1;background:' + c2 + '"></i></div>' +
            '<div class="h2h-foot">Both hit ' + x.both + ' · Both missed ' + x.neither + ' · ' + escHtml(name) + ' ' + pctTxt(x.n ? (x.me + x.both) / x.n : 0) + ' vs ' + who + ' ' + pctTxt(x.n ? x.theirW / x.n : 0) + ' on the same games</div></div>';
        });

        if ((owner || admin) && S.upcoming.length) {
          h += '<div class="pf-h">⏳ Upcoming Picks <small>🔒 only ' + (owner ? 'you' : escHtml(name)) + ' and admin can see these</small></div>' + S.upcoming.map(function(x) {
            return '<div class="adm-row"><span class="u-muted">' + wkName(x.g.week) + ' · ' + escHtml(x.g.slot) + '</span><span>' + coloredText(x.r.homePick, x.g.home) + ' / ' + coloredText(x.r.awayPick, x.g.away) + '</span></div>';
          }).join('') + '<div class="u-h-18px"></div>';
        }

        // 📜 Pick history (kicked-off games, newest first)
        var hist = S.history.slice().reverse();
        if (hist.length) {
          h += '<div class="pf-h">📜 Pick History <small>' + hist.length + ' game' + (hist.length > 1 ? 's' : '') + '</small></div>';
          hist.forEach(function(x, i) {
            var g = x.g, sk = playerKey(g.scorer);
            function pk(p, team) { var hit = g.scorer && playerKey(p) === sk; return '<span class="' + (hit ? 'hist-hit' : '') + '">' + coloredText(p, team) + (hit ? ' ✅' : '') + '</span>'; }
            var tag = x.status === 'hit' ? '<span class="hist-tag hit">HIT</span>' : x.status === 'miss' ? '<span class="hist-tag miss">MISS</span>' :
              x.status === 'void' ? '<span class="hist-tag">NOT OFFERED</span>' : '<span class="hist-tag live">LIVE</span>';
            h += '<div class="hist-row" style="display:none"' + (i >= 8 ? ' data-hist' : '') + '>' +
              '<div class="hist-l"><div class="hist-wk">' + wkName(g.week) + ' · ' + escHtml(g.slot) + '</div>' +
              '<div>' + pk(x.r.homePick, g.home) + ' <span class="u-faint">/</span> ' + pk(x.r.awayPick, g.away) + '</div>' +
              (g.scorer ? '<div class="hist-sc">🏈 ' + escHtml(g.scorer) + '</div>' : '') + '</div>' + tag + '</div>';
          });
          if (hist.length > 8) h += '<div class="u-center u-mt-s"><button class="link-btn" id="hist-more">Show all ' + hist.length + '</button></div>';
          h += '<div class="u-h-18px"></div>';
        }

        var A = [
          { ic: '🐺', n: 'Lone Wolf', d: 'Hit a scorer nobody else had', got: S.lone.length > 0, w: hitW(S.lone[0]) },
          { ic: '🔥', n: 'Heater', d: '3 hits in a row', got: S.heater.n >= 3, w: 'Best run: ' + S.heater.n, p: [Math.min(S.heater.n, 3), 3] },
          { ic: '🌋', n: 'On Fire', d: '5 hits in a row', got: S.heater.n >= 5, w: 'Best run: ' + S.heater.n, p: [Math.min(S.heater.n, 5), 5] },
          { ic: '🧹', n: 'Clean Sweep', d: 'Hit every game in a week (2+)', got: !!sweep, w: sweep ? weekName(sweep) : '' },
          { ic: '❤️', n: 'Ride or Die', d: 'Pick the same player 10 times', got: !!(fav && S.players[fav] >= 10), w: fav ? escHtml(fav) + ' · ' + S.players[fav] + 'x' : '', p: [fav ? Math.min(S.players[fav], 10) : 0, 10] },
          { ic: '🦃', n: 'Holiday Hero', d: 'Hit on Thanksgiving, Black Friday or Christmas', got: !!holiday, w: hitW(holiday) },
          { ic: '🌍', n: 'Globetrotter', d: 'Hit in an International game', got: !!intl, w: hitW(intl) },
          { ic: '💯', n: 'Century', d: 'Pick 100 players', got: playerPicks >= 100, w: playerPicks + ' players', p: [Math.min(playerPicks, 100), 100] },
          { shame: true, ic: '🧊', n: 'Ice Cold', d: '5 misses in a row', got: S.drought.n >= 5, w: 'Worst run: ' + S.drought.n, p: [Math.min(S.drought.n, 5), 5] },
          { shame: true, ic: '💀', n: 'Cursed', d: 'Pick a player 5 times who never hits for you', got: !!cursed, w: cursed ? escHtml(cursed) + ' · 0 for ' + S.players[cursed] : '' },
        ];
        function badges(list) {
          list.sort(function(a, b) { return (b.got ? 1 : 0) - (a.got ? 1 : 0); });
          return lockedBadges(list, function(a) {
            var prog = (!a.got && a.p) ? '<div class="pf-bar"><i style="width:' + Math.round(a.p[0] / a.p[1] * 100) + '%"></i></div><div class="pg">' + a.p[0] + ' / ' + a.p[1] + '</div>' : '';
            return '<div class="pf-badge ' + (a.got ? 'got' : 'locked') + (a.shame ? ' shame' : '') + '"><div class="ic">' + a.ic + '</div><div class="n">' + a.n + '</div><div class="d">' + a.d + '</div>' +
              (a.got && a.w ? '<div class="w">' + a.w + '</div>' : '') + prog + '</div>';
          });
        }
        var glory = A.filter(function(a) { return !a.shame; }), shame = A.filter(function(a) { return a.shame; });
        h += '<div class="pf-h">🏆 Trophy Case <small>' + glory.filter(function(a) { return a.got; }).length + ' / ' + glory.length + ' unlocked</small></div>' + badges(glory);
        h += '<div class="pf-h">🤡 Hall of Shame <small>' + shame.filter(function(a) { return a.got; }).length + ' / ' + shame.length + '</small></div>' + badges(shame);
        h += '<div class="tcd-slot"></div>'; // 🃏 Card Collection (js/cards.js)
        el.innerHTML = h;
        bindProfileSwitch(el);
        var fslot = el.querySelector('.tcd-slot');
        if (fslot) loadScriptOnce('js/cards.js').then(function() {
          renderFriendCards(fslot, name, S.hits.map(function(x) {
            return { name: x.g.scorer, team: playerKey(x.g.scorer) === playerKey(x.r.homePick) ? x.g.home : x.g.away, year: CURRENT_YEAR, week: x.g.week };
          }), col);
        }).catch(function() {});
        var more = document.getElementById('hist-more');
        if (more) more.addEventListener('click', function() { el.querySelectorAll('[data-hist]').forEach(function(d) { d.style.display = ''; }); more.remove(); });
        if (owner) document.getElementById('fr-style-btn').addEventListener('click', function() { openStylePicker(name); });
      }).catch(function() { el.innerHTML = profileSwitchHtml('Maria') + '<div class="loading">Couldn\'t load this profile.</div>'; bindProfileSwitch(el); });
    }

    // 🎨 A friend picks their own emoji + color (shows on the Crowd tab and their profile)
    function openStylePicker(name) {
      var box = document.getElementById('fr-style');
      if (box.style.display !== 'none') { box.style.display = 'none'; return; }
      var cur = fStyle(name), sel = { emoji: cur.emoji, color: (CROWD.data.styles[name] || {}).color || '' };
      box.style.display = '';
      function paint() {
        box.innerHTML = '<div class="fr-style">' +
          '<div class="fr-style-h">Your emoji</div><div class="fr-emojis">' +
            '<button data-em="" class="ui-title ' + (!sel.emoji ? 'on' : '') + '">' + escHtml(name.charAt(0).toUpperCase()) + '</button>' +
            FRIEND_EMOJI.map(function(e) { return '<button data-em="' + e + '" class="' + (sel.emoji === e ? 'on' : '') + '">' + e + '</button>'; }).join('') + '</div>' +
          '<div class="fr-style-h">Your color</div><div class="fr-colors">' +
            FRIEND_COLORS.map(function(c) { return '<button data-col="' + c + '" class="' + ((sel.color || FRIEND_COLOR) === c ? 'on' : '') + '" style="background:' + c + '"></button>'; }).join('') + '</div>' +
          '<div class="u-center u-mt"><span style="font-size:20px;font-weight:800;color:' + (sel.color || FRIEND_COLOR) + '">' + (sel.emoji ? sel.emoji + ' ' : '') + escHtml(name) + '</span></div>' +
          '<div class="u-center u-mt"><button class="primary-btn" id="fr-style-save">Save</button> <button class="u-ml-s link-btn" id="fr-style-cancel">Cancel</button>' +
          '<div class="submit-msg" id="fr-style-msg"></div></div></div>';
        box.querySelectorAll('[data-em]').forEach(function(b) { b.addEventListener('click', function() { sel.emoji = b.getAttribute('data-em'); paint(); }); });
        box.querySelectorAll('[data-col]').forEach(function(b) { b.addEventListener('click', function() { sel.color = b.getAttribute('data-col'); paint(); }); });
        document.getElementById('fr-style-cancel').addEventListener('click', function() { box.style.display = 'none'; });
        document.getElementById('fr-style-save').addEventListener('click', function() {
          var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
          picksApi({ pin: SUB.pin, action: 'fstyle', emoji: sel.emoji, color: sel.color }).then(function(r) {
            if (r.error) { btn.disabled = false; btn.textContent = 'Save'; var m = document.getElementById('fr-style-msg'); m.style.color = '#F87171'; m.textContent = r.error; return; }
            CROWD.data.styles = CROWD.data.styles || {};
            CROWD.data.styles[name] = { emoji: r.emoji, color: r.color };
            renderFriendProfile(name);
          }).catch(function() { btn.disabled = false; btn.textContent = 'Save'; });
        });
      }
      paint();
    }
