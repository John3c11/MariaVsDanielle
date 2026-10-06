// 📖 Season Story: a full-screen, tap-through story of a season (this one so far, or any past one).
// Loaded on demand by openStory() in core.js. Every slide can be shared as an image (shareCard in stats.js).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var STORY = { year: '', slides: [], i: 0, t: 0, paused: false, timer: null, last: 0, all: null };
    var STORY_MS = 7000; // how long each slide stays up

    function startStory(year) {
      year = String(year || CURRENT_YEAR);
      var root = document.getElementById('story');
      if (!root) {
        root = document.createElement('div');
        root.id = 'story';
        root.className = 'st-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Season Story');
        document.body.appendChild(root);
        storyBind(root);
      }
      root.innerHTML = '<div class="st-loading">Loading the story…</div>';
      root.classList.add('open');
      document.documentElement.classList.add('st-lock');
      loadAllBets().then(function(all) {
        STORY.all = all;
        storyLoad(year);
      }).catch(function() { root.innerHTML = '<div class="st-loading">Couldn\'t load the season. <button class="link-btn" onclick="closeStory()">Close</button></div>'; });
    }
    function closeStory() {
      clearInterval(STORY.timer);
      var root = document.getElementById('story');
      if (root) { root.classList.remove('open'); root.innerHTML = ''; }
      document.documentElement.classList.remove('st-lock');
    }

    function storyYears() {
      var have = {};
      (STORY.all || []).forEach(function(r) { if (isMD(r.picker) && (r.correct === 'Yes' || r.correct === 'No')) have[r.year] = 1; });
      return SEASONS.map(function(s) { return s.year; }).filter(function(y) { return have[y]; });
    }

    function storyLoad(year) {
      STORY.year = year;
      STORY.slides = buildStory(year, STORY.all);
      STORY.i = 0;
      var root = document.getElementById('story');
      var years = storyYears();
      root.innerHTML =
        '<div class="st-frame">' +
          '<div class="st-bars">' + STORY.slides.map(function() { return '<i><b></b></i>'; }).join('') + '</div>' +
          '<div class="st-top"><select class="st-year" aria-label="Season">' + years.map(function(y) {
            return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + (y === CURRENT_YEAR ? ' (so far)' : '') + '</option>';
          }).join('') + '</select>' +
          '<button class="st-pause" aria-label="Pause">❚❚</button><button class="st-x" aria-label="Close">✕</button></div>' +
          '<div class="st-stage"></div>' +
          '<button class="st-nav st-prev" aria-label="Previous"></button><button class="st-nav st-next" aria-label="Next"></button>' +
        '</div>';
      storyShow(0);
      clearInterval(STORY.timer);
      STORY.last = Date.now();
      STORY.timer = setInterval(storyTick, 60);
    }

    function storyTick() {
      var now = Date.now(), dt = now - STORY.last;
      STORY.last = now;
      if (STORY.paused || document.hidden) return;
      STORY.t += dt;
      var bar = document.querySelectorAll('#story .st-bars b')[STORY.i];
      if (bar) bar.style.width = Math.min(100, STORY.t / STORY_MS * 100) + '%';
      if (STORY.t >= STORY_MS) { if (STORY.i < STORY.slides.length - 1) storyShow(STORY.i + 1); else STORY.paused = true; }
    }

    function storyShow(i) {
      var root = document.getElementById('story');
      if (!root || !STORY.slides.length) return;
      i = Math.max(0, Math.min(STORY.slides.length - 1, i));
      STORY.i = i; STORY.t = 0;
      root.querySelectorAll('.st-bars b').forEach(function(b, k) { b.style.width = k < i ? '100%' : '0%'; });
      var s = STORY.slides[i];
      var stage = root.querySelector('.st-stage');
      stage.innerHTML = '<div class="st-card st-in" data-share="story-' + STORY.year + '-' + (i + 1) + '" style="background:' + s.bg + '">' +
        '<button class="share-btn" onclick="shareCard(this)" title="Share this slide">Share</button>' +
        '<div class="st-kick">' + s.kick + '</div>' + s.html +
        '<div class="st-brand">Maria vs Danielle · ' + STORY.year + '</div></div>';
      var card = stage.firstChild;
      if (typeof fillHeadshots === 'function') fillHeadshots(card);
      storyAnimate(card);
      if (s.after) s.after(card);
      var last = i === STORY.slides.length - 1;
      root.querySelector('.st-next').classList.toggle('st-end', last);
    }

    // Count-ups and chart drawing
    function storyAnimate(card) {
      card.querySelectorAll('[data-count]').forEach(function(el) {
        var to = parseFloat(el.getAttribute('data-count')), fmt = el.getAttribute('data-fmt') || 'int', t0 = performance.now();
        function f(v) { return fmt === 'u' ? fmtU(v) : fmt === 'd' ? fmtD(v) : fmt === 'pct' ? Math.round(v) + '%' : fmt === 'odds' ? '+' + Math.round(v) : String(Math.round(v)); }
        (function step(now) {
          var k = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
          el.textContent = f(to * e);
          if (k < 1) requestAnimationFrame(step);
        })(t0);
      });
      card.querySelectorAll('.st-chart svg path').forEach(function(p) {
        if (!p.getAttribute('stroke') || p.getAttribute('stroke') === 'none' || !p.getTotalLength) return;
        var len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.3,.7,.2,1)';
        p.style.strokeDashoffset = '0';
      });
    }

    function storyBind(root) {
      root.addEventListener('click', function(e) {
        var t = e.target;
        if (t === root || t.closest('.st-x')) return closeStory(); // the dark background outside the card, or ✕
        if (t.closest('.st-pause')) { STORY.paused = !STORY.paused; t.closest('.st-pause').textContent = STORY.paused ? '▶' : '❚❚'; return; }
        if (t.closest('.st-nav') && STORY.skipClick) { STORY.skipClick = false; return; } // that was a hold-to-pause
        if (t.closest('.st-next')) { if (STORY.i < STORY.slides.length - 1) storyShow(STORY.i + 1); return; }
        if (t.closest('.st-prev')) { storyShow(STORY.i - 1); return; }
        var go = t.closest('[data-st-year]');
        if (go) { storyLoad(go.getAttribute('data-st-year')); return; }
        if (t.closest('[data-st-replay]')) { storyShow(0); STORY.paused = false; return; }
      });
      root.addEventListener('change', function(e) { if (e.target.classList.contains('st-year')) storyLoad(e.target.value); });
      // Hold to pause (like other stories)
      var held = null;
      root.addEventListener('pointerdown', function(e) {
        if (!e.target.closest('.st-stage, .st-nav') || e.target.closest('.st-btn, .share-btn')) return;
        held = setTimeout(function() { STORY.paused = true; STORY.held = true; }, 260);
      });
      root.addEventListener('pointerup', function() { clearTimeout(held); if (STORY.held) { STORY.held = false; STORY.paused = false; STORY.skipClick = true; } });
      document.addEventListener('keydown', function(e) {
        if (!root.classList.contains('open')) return;
        if (e.key === 'Escape') closeStory();
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (STORY.i < STORY.slides.length - 1) storyShow(STORY.i + 1); }
        if (e.key === 'ArrowLeft') storyShow(STORY.i - 1);
      });
      // Swipe down to close on phones
      var y0 = null;
      root.addEventListener('touchstart', function(e) { y0 = e.touches[0].clientY; }, { passive: true });
      root.addEventListener('touchend', function(e) { if (y0 !== null && e.changedTouches[0].clientY - y0 > 110) closeStory(); y0 = null; }, { passive: true });
    }

    // ── The slides ─────────────────────────────────────────────────────────────
    function buildStory(year, all) {
      var cur = year === CURRENT_YEAR;
      var rows = all.filter(function(r) { return r.year === year && isMD(r.picker); });
      var scored = rows.filter(function(r) { return (r.correct === 'Yes' || r.correct === 'No') && (r.homePick || r.awayPick); });
      var counted = scored.filter(function(r) { return !isNotOffered(r); });
      var S = [];
      var who = ['Maria', 'Danielle'];
      function pc(n) { return personColor(n); }
      function nm(n) { return '<b style="color:' + pc(n) + '">' + n + '</b>'; }
      function grad(n, alt) {
        return n === 'Maria' ? 'linear-gradient(160deg,#0B0B0F 0%,#3B0D0D 50%,' + (alt || '#B91C1C') + ' 100%)'
          : n === 'Danielle' ? 'linear-gradient(160deg,#0B0B0F 0%,#0C1A3D 50%,' + (alt || '#1D4ED8') + ' 100%)'
          : 'linear-gradient(160deg,#0B0B0F 0%,#1F2937 55%,' + (alt || '#374151') + ' 100%)';
      }
      var P = { Maria: { u: 0, d: 0, w: 0, t: 0 }, Danielle: { u: 0, d: 0, w: 0, t: 0 } };
      counted.forEach(function(r) { var p = P[r.picker]; p.u += r.netUnits; p.d += r.netDollars; p.t++; if (r.correct === 'Yes') p.w++; });
      scored.forEach(function(r) { if (isNotOffered(r)) { P[r.picker].u += r.netUnits; P[r.picker].d += r.netDollars; } });
      var lead = P.Maria.u > P.Danielle.u ? 'Maria' : P.Danielle.u > P.Maria.u ? 'Danielle' : null;
      var lastWeek = scored.reduce(function(a, r) { return Math.max(a, r.week); }, 0);

      if (!scored.length) {
        S.push({ kick: 'Season Story', bg: grad(null), html: '<div class="st-big">' + year + '</div><div class="st-line">Nothing to tell yet. Check back after the first games are scored.</div>' });
        S.push(storyOutro(year, cur, null, grad));
        return S;
      }

      // 1. Cover
      S.push({ kick: 'Season Story', bg: grad(lead), html:
        '<div class="st-year-big">' + year + '</div>' +
        '<div class="st-faces"><img src="pics/Maria.jpeg" alt="Maria" style="--pc:' + SB_M + '"><span>vs</span><img src="pics/Danielle.jpeg" alt="Danielle" style="--pc:' + SB_D + '"></div>' +
        '<div class="st-line">' + (cur ? 'The story so far, through ' + weekName(lastWeek) + '.' : 'The whole season, start to finish.') + '</div>' +
        '<div class="st-hint">Tap the right side to go on →</div>' });

      // 2. The scoreboard
      S.push({ kick: cur ? 'Where it stands' : 'Final score', bg: grad(lead), html:
        '<div class="st-duel">' + who.map(function(n) {
          var p = P[n];
          return '<div class="st-side"><div class="st-who" style="color:' + pc(n) + '">' + n + (lead === n ? ' 👑' : '') + '</div>' +
            '<div class="st-num" style="color:' + pc(n) + '" data-count="' + p.u.toFixed(1) + '" data-fmt="u">' + fmtU(0) + '</div>' +
            '<div class="st-small">' + p.w + '/' + p.t + ' correct · ' + fmtD(p.d) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="st-line">' + (lead ? nm(lead) + (cur ? ' is up by ' : ' won by ') + '<b>' + Math.abs(P.Maria.u - P.Danielle.u).toFixed(1) + ' units</b>.' : 'Dead even.') + '</div>' });

      // 3. The race
      var G = gamesOf(scored), m = 0, d = 0, changes = 0, prev = null, big = { n: 0 };
      G.forEach(function(g) {
        m += g.by.Maria ? g.by.Maria.netUnits : 0; d += g.by.Danielle ? g.by.Danielle.netUnits : 0;
        var l = m > d ? 'Maria' : d > m ? 'Danielle' : prev;
        if (prev && l !== prev) changes++;
        prev = l;
        if (Math.abs(m - d) > big.n) big = { n: Math.abs(m - d), who: m > d ? 'Maria' : 'Danielle', week: g.week };
      });
      if (G.length >= 2) S.push({ kick: 'The race', bg: grad(lead), html:
        '<div class="st-chart">' + seasonRaceChart(all, year) + '</div>' +
        '<div class="st-line">' + (changes ? 'The lead changed hands <b>' + changes + ' time' + (changes === 1 ? '' : 's') + '</b>.' : (prev ? nm(prev) + ' led wire to wire.' : '')) +
        (big.n ? ' Biggest lead: ' + nm(big.who) + ' by <b>' + big.n.toFixed(1) + 'u</b> in ' + weekName(big.week) + '.' : '') + '</div>' });

      // 4. Weeks won (most hits that week)
      var WK = {};
      scored.forEach(function(r) { var w = WK[r.week] || (WK[r.week] = { Maria: 0, Danielle: 0, u: { Maria: 0, Danielle: 0 } }); if (r.correct === 'Yes') w[r.picker]++; w.u[r.picker] += r.netUnits; });
      var ww = { Maria: 0, Danielle: 0, tie: 0 };
      Object.keys(WK).forEach(function(k) { var w = WK[k]; if (w.Maria > w.Danielle) ww.Maria++; else if (w.Danielle > w.Maria) ww.Danielle++; else ww.tie++; });
      var wwLead = ww.Maria > ww.Danielle ? 'Maria' : ww.Danielle > ww.Maria ? 'Danielle' : null;
      S.push({ kick: 'Weeks won', bg: grad(wwLead), html:
        '<div class="st-duel">' + who.map(function(n) {
          return '<div class="st-side"><div class="st-who" style="color:' + pc(n) + '">' + n + '</div><div class="st-num" style="color:' + pc(n) + '" data-count="' + ww[n] + '">0</div><div class="st-small">week' + (ww[n] === 1 ? '' : 's') + ' won</div></div>';
        }).join('') + '</div>' +
        '<div class="st-line">' + (ww.tie ? '<b>' + ww.tie + '</b> week' + (ww.tie === 1 ? ' ended' : 's ended') + ' in a tie. ' : '') + 'A week goes to whoever hits more first TDs.</div>' });

      // 5. Biggest hit (longest odds that cashed)
      var hit = null;
      counted.forEach(function(r) {
        if (r.correct !== 'Yes') return;
        var home = r.firstScorer === r.homePick, o = oddsN(home ? r.homeOdds : r.awayOdds);
        if (!hit || o > hit.o) hit = { o: o, r: r, team: home ? r.homeTeam : r.awayTeam };
      });
      if (hit) S.push({ kick: 'Biggest hit', bg: grad(hit.r.picker), html:
        '<div class="st-hero">' + headshot(hit.r.firstScorer, hit.team, 132) + '</div>' +
        '<div class="st-name">' + escHtml(hit.r.firstScorer) + '</div>' +
        '<div class="st-num st-gold" data-count="' + Math.round(hit.o * 100) + '" data-fmt="odds">+0</div>' +
        '<div class="st-line">' + nm(hit.r.picker) + ' cashed him in ' + weekName(hit.r.week) + ', ' + teamNick(hit.r.homeTeam) + ' vs ' + teamNick(hit.r.awayTeam) + ', for <b>' + fmtU(hit.r.netUnits) + '</b>.</div>' });

      // 6. Best and worst week
      var wkU = [];
      Object.keys(WK).forEach(function(k) { who.forEach(function(n) { wkU.push({ week: +k, who: n, u: WK[k].u[n] }); }); });
      wkU.sort(function(a, b) { return b.u - a.u; });
      var best = wkU[0], worst = wkU[wkU.length - 1];
      if (best && best.u > 0) S.push({ kick: 'Best week', bg: grad(best.who), html:
        '<div class="st-emoji">📈</div><div class="st-num" style="color:' + pc(best.who) + '" data-count="' + best.u.toFixed(1) + '" data-fmt="u">+0.0u</div>' +
        '<div class="st-line">' + nm(best.who) + ' in ' + weekName(best.week) + '.' + (worst && worst.u < 0 ? '<br><span class="st-dim">The other end: ' + nm(worst.who) + ' went ' + fmtU(worst.u) + ' in ' + weekName(worst.week) + '. 📉</span>' : '') + '</div>' });

      // 7. Streaks
      function streak(n, want) {
        var bestN = 0, curN = 0, at = 0;
        counted.forEach(function(r) { if (r.picker !== n) return; curN = r.correct === want ? curN + 1 : 0; if (curN > bestN) { bestN = curN; at = r.week; } });
        return { n: bestN, at: at };
      }
      var heat = who.map(function(n) { return { who: n, s: streak(n, 'Yes') }; }).sort(function(a, b) { return b.s.n - a.s.n; })[0];
      var cold = who.map(function(n) { return { who: n, s: streak(n, 'No') }; }).sort(function(a, b) { return b.s.n - a.s.n; })[0];
      if (heat.s.n >= 2 || cold.s.n >= 3) S.push({ kick: 'Hot and cold', bg: grad(heat.who), html:
        '<div class="st-pair"><div><div class="st-emoji">🔥</div><div class="st-num" style="color:' + pc(heat.who) + '" data-count="' + heat.s.n + '">0</div><div class="st-small">straight hits<br>' + nm(heat.who) + ', through ' + weekName(heat.s.at) + '</div></div>' +
        '<div><div class="st-emoji">🧊</div><div class="st-num" style="color:' + pc(cold.who) + '" data-count="' + cold.s.n + '">0</div><div class="st-small">straight misses<br>' + nm(cold.who) + ', through ' + weekName(cold.s.at) + '</div></div></div>' });

      // 8. Luck
      var L = luckData(all, year);
      if (L.out.Maria.n + L.out.Danielle.n >= 6) {
        var lucky = (L.out.Maria.hits - L.out.Maria.exp) >= (L.out.Danielle.hits - L.out.Danielle.exp) ? 'Maria' : 'Danielle';
        S.push({ kick: 'Luck meter', bg: grad(lucky), html:
          '<div class="st-duel">' + who.map(function(n) {
            var o = L.out[n], v = luckVerdict(o);
            return '<div class="st-side"><div class="st-who" style="color:' + pc(n) + '">' + n + '</div><div class="st-num" style="color:' + v.c + '">' + luckTxt(o.hits - o.exp) + '</div>' +
              '<div class="st-small">' + o.hits + ' hits vs ' + o.exp.toFixed(1) + ' expected<br>' + v.t + '</div></div>';
          }).join('') + '</div><div class="st-line">The odds said how many first TDs each should have hit. ' + nm(lucky) + ' beat them by more.</div>' });
      }

      // 9. Ride or die (most-picked player each)
      var picks = { Maria: {}, Danielle: {} }, teamOf = {};
      rows.forEach(function(r) {
        [[r.homePick, r.homeTeam], [r.awayPick, r.awayTeam]].forEach(function(x) { if (x[0]) { var p = picks[r.picker][x[0]] || (picks[r.picker][x[0]] = { n: 0, h: 0 }); p.n++; teamOf[x[0]] = x[1]; if (r.firstScorer === x[0]) p.h++; } });
      });
      var fav = who.map(function(n) {
        var b = null; Object.keys(picks[n]).forEach(function(k) { if (!b || picks[n][k].n > b.p.n) b = { name: k, p: picks[n][k] }; });
        return b ? { who: n, name: b.name, n: b.p.n, h: b.p.h } : null;
      }).filter(function(x) { return x && x.n >= 3; });
      if (fav.length) S.push({ kick: 'Ride or die', bg: grad(null, '#4C1D95'), html:
        '<div class="st-pair">' + fav.map(function(f) {
          return '<div>' + headshot(f.name, teamOf[f.name], 88) + '<div class="st-name sm">' + escHtml(f.name) + '</div><div class="st-small">' + nm(f.who) + ' picked him <b>' + f.n + '×</b><br>' + (f.h ? 'he paid off ' + f.h + '×' : 'he never paid off 💀') + '</div></div>';
        }).join('') + '</div>' });

      // 10. The jinx
      var JX = computeJinxes(all.filter(function(r) { return parseInt(r.year, 10) <= parseInt(year, 10); }));
      var jx = JX.jinxes.Maria.concat(JX.jinxes.Danielle).filter(function(j) { return j.year === year; })
        .sort(function(a, b) { return (b.cashed ? b.cashed.units : 0) - (a.cashed ? a.cashed.units : 0); })[0];
      if (jx) S.push({ kick: 'The jinx', bg: grad(jx.picker, '#7C2D12'), html:
        '<div class="st-hero">' + headshot(jx.player, jx.team, 110) + '</div>' +
        '<div class="st-line big">' + nm(jx.picker) + ' dropped <b>' + escHtml(jx.player) + '</b> after ' + wkName(jx.fromWeek) + '.<br>He scored first in ' + weekName(jx.week) + '.' +
        (jx.cashed ? '<br>And ' + nm(jx.other) + ' had him, for <b>' + fmtU(jx.cashed.units) + '</b>. 😬' : '') + '</div>' });

      // 11. Cursed pick: picked the most without ever scoring first
      var allP = {}, scoredFirst = {};
      rows.forEach(function(r) { [r.homePick, r.awayPick].forEach(function(p) { if (p) allP[p] = (allP[p] || 0) + 1; }); if (r.firstScorer) scoredFirst[r.firstScorer] = 1; });
      var cursed = null;
      Object.keys(allP).forEach(function(k) { if (!scoredFirst[k] && allP[k] >= 3 && (!cursed || allP[k] > cursed.n)) cursed = { name: k, n: allP[k] }; });
      if (cursed) S.push({ kick: 'Cursed pick', bg: grad(null, '#3F3F46'), html:
        '<div class="st-hero">' + headshot(cursed.name, teamOf[cursed.name], 110) + '</div><div class="st-name">' + escHtml(cursed.name) + '</div>' +
        '<div class="st-line">Picked <b>' + cursed.n + ' times</b>. Scored first <b>zero</b>. 💀</div>' });

      // 12. Teams
      var TU = teamUnits(all, year, 'all'), tk = Object.keys(TU).sort(function(a, b) { return TU[b] - TU[a]; });
      if (tk.length >= 2 && TU[tk[0]] > 0) {
        var bt = tk[0], wt = tk[tk.length - 1];
        S.push({ kick: 'Team of the year', bg: 'linear-gradient(160deg,#0B0B0F 0%,' + hexA((TEAM_COLORS[resolveTeam(bt)] || {}).primary || '#374151', 0.55) + ' 60%,' + ((TEAM_COLORS[resolveTeam(bt)] || {}).primary || '#374151') + ' 100%)', html:
          '<div class="st-logo">' + teamLogo(bt, 'st-tlogo') + '</div><div class="st-name">' + escHtml(resolveTeam(bt)) + '</div>' +
          '<div class="st-num st-gold" data-count="' + TU[bt].toFixed(1) + '" data-fmt="u">+0.0u</div>' +
          '<div class="st-line">picking their players.' + (TU[wt] < 0 ? '<br><span class="st-dim">The money pit: ' + escHtml(teamNick(wt)) + ', ' + fmtU(TU[wt]) + '.</span>' : '') + '</div>' });
      }

      // 13. Chaos
      var C = chaosGames(all, year), weird = C.filter(function(c) { return c.tags.length; });
      if (C.length >= 4) S.push({ kick: 'Chaos', bg: grad(null, '#6D28D9'), html:
        '<div class="st-emoji">🌀</div><div class="st-num" data-count="' + weird.length + '">0</div><div class="st-small">of ' + C.length + ' first TDs came from off the board</div>' +
        (weird.length ? '<div class="st-line">Like <b>' + escHtml(weird[weird.length - 1].name) + '</b> (' + weird[weird.length - 1].tags[0] + ') in ' + weekName(weird[weird.length - 1].g.week) + '.</div>' : '') });

      // 14. Records set this season
      var R = computeRecords(all.filter(function(r) { return parseInt(r.year, 10) <= parseInt(year, 10); }));
      var set = RECORDS.filter(function(dd) { return R[dd.k] && R[dd.k].year === year; });
      if (set.length) S.push({ kick: 'Records set', bg: grad(null, '#92400E'), html:
        '<div class="st-recs">' + set.map(function(dd) { var r = R[dd.k]; return '<div class="st-rec"><span>' + dd.ic + '</span><div><b>' + dd.t + '</b><small>' + escHtml(r.sub) + '</small></div><em style="color:' + pc(r.who) + '">' + r.who + '<br>' + r.txt + '</em></div>'; }).join('') + '</div>' });

      // 15. How it ends
      if (cur) {
        var curRows = rows.map(function(r) { return { picker: r.picker, home: r.homeTeam, scored: r.correct === 'Yes' || r.correct === 'No', units: r.netUnits, scorer: r.firstScorer }; });
        var wp = winProbability(curRows, all);
        if (wp) {
          var mp = Math.max(1, Math.min(99, Math.round(wp.maria * 100)));
          S.push({ kick: 'How it ends', bg: grad(mp >= 50 ? 'Maria' : 'Danielle'), html:
            '<div class="st-line">5,000 simulated finishes to the season say:</div>' +
            '<div class="st-duel"><div class="st-side"><div class="st-who" style="color:' + SB_M + '">Maria</div><div class="st-num" style="color:' + SB_M + '" data-count="' + mp + '" data-fmt="pct">0%</div></div>' +
            '<div class="st-side"><div class="st-who" style="color:' + SB_D + '">Danielle</div><div class="st-num" style="color:' + SB_D + '" data-count="' + (100 - mp) + '" data-fmt="pct">0%</div></div></div>' +
            '<div class="wp-bar st-wp"><i style="width:' + mp + '%;background:' + SB_M + '"></i><i style="width:' + (100 - mp) + '%;background:' + SB_D + '"></i></div>' +
            '<div class="st-small">' + (wp.left.Maria + wp.left.Danielle) + ' bets still to play.</div>' });
        }
      } else if (lead) {
        S.push({ kick: 'Champion', bg: grad(lead), html:
          '<div class="st-crown">👑</div><img class="st-champ" src="pics/' + lead + '.jpeg" alt="' + lead + '" style="--pc:' + pc(lead) + '">' +
          '<div class="st-name" style="color:' + pc(lead) + '">' + lead + '</div><div class="st-line">' + year + ' champion, by ' + Math.abs(P.Maria.u - P.Danielle.u).toFixed(1) + ' units.</div>',
          after: storyConfetti });
      }

      S.push(storyOutro(year, cur, lead, grad));
      return S;
    }

    function storyOutro(year, cur, lead, grad) {
      var others = storyYears().filter(function(y) { return y !== year; });
      return { kick: "That's the story", bg: grad(lead), html:
        '<div class="st-emoji">🏈</div><div class="st-line big">' + (cur ? 'More chapters every week.' : 'What a season.') + '</div>' +
        '<div class="st-btns"><button class="st-btn no-share" data-st-replay="1">↺ Watch again</button>' +
        others.map(function(y) { return '<button class="st-btn no-share" data-st-year="' + y + '">▶ ' + y + (y === CURRENT_YEAR ? ' so far' : ' story') + '</button>'; }).join('') + '</div>' +
        '<div class="st-small">Tap Share on any slide to send it to the group chat.</div>' };
    }

    function storyConfetti(card) {
      var colors = [SB_M, SB_D, '#FCD34D', '#F3F4F6'];
      var h = '';
      for (var i = 0; i < 40; i++) {
        h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + colors[i % 4] + ';animation-delay:' + (Math.random() * 1.2).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 1.6).toFixed(2) + 's;transform:rotate(' + Math.round(Math.random() * 360) + 'deg)"></i>';
      }
      card.insertAdjacentHTML('beforeend', '<div class="st-confetti no-share">' + h + '</div>');
    }
