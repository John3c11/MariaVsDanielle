// 🎬 Highlight Reels (v150): a week's or a season's story as a short vertical video, drawn on a canvas.
// It plays right here, and 💾 records the same thing into a real video file (MediaRecorder) that the phone can
// share to the group chat. Phones that can't record get a share image of the final frame instead.
// The story comes from The Weekly's engine (js/weekly.js: wkIssue / wkSeason), so both always agree.
// Nothing here draws a picture from another site (that would block recording), so teams are color bars.
// Loaded on demand (openReel in main.js). Part of the MariaVsDanielle site; shares the global scope.

    var RL = { scenes: null, dur: 0, t0: 0, t: 0, raf: 0, playing: false, rec: null, title: '', file: '' };
    var RL_W = 1080, RL_H = 1920, RL_PX = 720; // drawn in 1080×1920 units, rendered at 720×1280
    var RL_GOLD = '#FBBF24';

    function rlEase(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
    function rlIn(p, a, b) { return rlEase((p - a) / ((b || a + 0.15) - a)); }
    function rlFont(size, weight) { return (weight || 800) + ' ' + size + 'px Inter, system-ui, -apple-system, "Segoe UI", sans-serif'; }
    function rlText(c, s, x, y, size, o) {
      o = o || {};
      c.save();
      c.globalAlpha = o.alpha == null ? 1 : o.alpha;
      c.font = rlFont(size, o.weight); c.fillStyle = o.color || '#F3F4F6'; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
      if (o.spacing) { try { c.letterSpacing = o.spacing + 'px'; } catch (e) {} }
      var max = o.max || 960, w = c.measureText(s).width;
      if (w > max) { c.font = rlFont(Math.max(18, Math.floor(size * max / w)), o.weight); }
      c.fillText(s, x, y);
      c.restore();
    }
    function rlRound(c, x, y, w, h, r, fill) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fillStyle = fill; c.fill(); }
    function rlTeamColor(t) { var tc = TEAM_COLORS[resolveTeam(t)]; return tc ? (tc.bg === '#FFFFFF' ? tc.primary : tc.bg) : '#374151'; }
    function rlBackdrop(c, T, tint) {
      var g = c.createLinearGradient(0, 0, RL_W, RL_H);
      g.addColorStop(0, '#0B0D12'); g.addColorStop(1, '#151821');
      c.fillStyle = g; c.fillRect(0, 0, RL_W, RL_H);
      if (tint) { var r = c.createRadialGradient(RL_W / 2, RL_H * 0.42, 50, RL_W / 2, RL_H * 0.42, 900); r.addColorStop(0, hexA(tint, 0.28)); r.addColorStop(1, hexA(tint, 0)); c.fillStyle = r; c.fillRect(0, 0, RL_W, RL_H); }
      c.save(); c.globalAlpha = 0.05; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3;
      var off = (T * 40) % 80;
      for (var x = -RL_H; x < RL_W; x += 80) { c.beginPath(); c.moveTo(x + off, 0); c.lineTo(x + off + RL_H, RL_H); c.stroke(); }
      c.restore();
      rlText(c, 'THE WEEKLY · MARIA VS DANIELLE', RL_W / 2, 90, 30, { color: 'rgba(255,255,255,0.55)', spacing: 6 });
    }

    // ── A week: title, every game (picks → the first TD → who cashed), the week's score, the winner ──
    function rlWeekScenes(I) {
      var S = [];
      S.push({ d: 2.6, draw: function(c, p) {
        rlText(c, I.year, RL_W / 2, 700, 56, { color: RL_GOLD, alpha: rlIn(p, 0, 0.2), spacing: 12 });
        rlText(c, I.name.toUpperCase(), RL_W / 2, 860 - 40 * (1 - rlIn(p, 0.05, 0.35)), I.name.length > 8 ? 130 : 190, { alpha: rlIn(p, 0.05, 0.35) });
        rlText(c, I.games.length + ' game' + (I.games.length === 1 ? '' : 's') + ' · ' + 'here\'s how it went', RL_W / 2, 1010, 44, { color: '#A1A9B6', weight: 600, alpha: rlIn(p, 0.35, 0.6) });
      } });
      I.games.slice(0, 5).forEach(function(g) {
        S.push({ d: 4.8, tint: rlTeamColor(g.home), draw: function(c, p) {
          // Matchup bar
          var a = rlIn(p, 0, 0.12);
          rlRound(c, 90, 300, 430, 150, 26, hexA(rlTeamColor(g.away), 0.92 * a));
          rlRound(c, 560, 300, 430, 150, 26, hexA(rlTeamColor(g.home), 0.92 * a));
          rlText(c, teamNick(g.away).toUpperCase(), 305, 375, 58, { color: '#FFFFFF', alpha: a, max: 400 });
          rlText(c, teamNick(g.home).toUpperCase(), 775, 375, 58, { color: '#FFFFFF', alpha: a, max: 400 });
          rlText(c, '@', RL_W / 2, 375, 40, { color: '#E5E7EB', alpha: a });
          if (g.slot) rlText(c, g.slot, RL_W / 2, 250, 36, { color: '#A1A9B6', alpha: a, spacing: 6 });
          // The picks
          var hitP = rlIn(p, 0.62, 0.72);
          WK_MD.forEach(function(w, i) {
            var pk = g.picks[w]; if (!pk) return;
            var x = i ? 775 : 305, y0 = 620, ap = rlIn(p, 0.12 + i * 0.06, 0.3 + i * 0.06);
            rlText(c, w.toUpperCase(), x, y0, 44, { color: personColor(w), alpha: ap, spacing: 4 });
            [[pk.home, pk.homeOdds], [pk.away, pk.awayOdds]].filter(function(z) { return z[0]; }).forEach(function(z, j) {
              var hit = pk.hit && playerKey(z[0]) === playerKey(pk.hitName), y = y0 + 100 + j * 120;
              if (hit && hitP > 0) rlRound(c, x - 230, y - 52, 460, 104, 22, hexA(RL_GOLD, 0.22 * hitP));
              rlText(c, z[0], x, y - 10, 46, { alpha: ap * (pk.hit && !hit && hitP > 0 ? 1 - 0.55 * hitP : 1) * (!pk.hit && hitP > 0 ? 1 - 0.4 * hitP : 1), max: 430, weight: 700 });
              if (z[1]) rlText(c, '+' + Math.round(z[1]), x, y + 34, 32, { color: hit && hitP > 0 ? RL_GOLD : '#A1A9B6', alpha: ap, weight: 700 });
            });
            if (hitP > 0) rlText(c, (pk.hit ? '✅ ' : '❌ ') + fmtU(pk.u), x, y0 + 380, 50, { color: pk.u > 0 ? '#34D399' : '#F87171', alpha: hitP });
          });
          // The first TD
          var tp = rlIn(p, 0.42, 0.56);
          if (tp > 0) {
            var sc = 1 + 0.35 * (1 - tp);
            c.save(); c.translate(RL_W / 2, 1420); c.scale(sc, sc);
            rlText(c, 'FIRST TD', 0, -80, 40, { color: RL_GOLD, alpha: tp, spacing: 10 });
            rlText(c, '🏈 ' + (g.scorer || 'No TD'), 0, 10, 84, { alpha: tp, max: 980 });
            if (g.notOffered) rlText(c, 'not offered: the bets don\'t count', 0, 100, 36, { color: '#A1A9B6', alpha: tp, weight: 600 });
            c.restore();
          }
        } });
      });
      S.push({ d: 3.6, draw: function(c, p) {
        rlText(c, 'THE WEEK', RL_W / 2, 520, 48, { color: '#A1A9B6', spacing: 10, alpha: rlIn(p, 0, 0.15) });
        var mx = Math.max(4, Math.abs(I.u.Maria), Math.abs(I.u.Danielle));
        WK_MD.forEach(function(w, i) {
          var y = 760 + i * 330, g2 = rlIn(p, 0.12 + i * 0.08, 0.6 + i * 0.08), v = I.u[w] * g2;
          rlText(c, w, 120, y - 80, 58, { color: personColor(w), align: 'left' });
          rlRound(c, 120, y, 840, 70, 35, 'rgba(255,255,255,0.08)');
          rlRound(c, 120, y, Math.max(70, 840 * Math.abs(I.u[w]) / mx * g2), 70, 35, I.u[w] >= 0 ? personColor(w) : '#4B5563');
          rlText(c, (v >= 0 ? '+' : '') + v.toFixed(1) + 'u', 960, y - 80, 58, { align: 'right' });
          rlText(c, I.hits[w] + ' of ' + I.n[w] + ' hit', 120, y + 120, 36, { color: '#A1A9B6', align: 'left', weight: 600 });
        });
      } });
      S.push({ d: 4, tint: I.winner ? personColor(I.winner) : RL_GOLD, draw: function(c, p) {
        var a = rlIn(p, 0, 0.25), wc = I.winner ? personColor(I.winner) : '#F3F4F6';
        rlText(c, I.winner ? I.winner.toUpperCase() : 'DEAD EVEN', RL_W / 2, 760, 170, { color: wc, alpha: a });
        rlText(c, I.winner ? 'TAKES ' + I.name.toUpperCase() : I.name.toUpperCase(), RL_W / 2, 920, 64, { alpha: rlIn(p, 0.15, 0.4), spacing: 4 });
        rlText(c, I.head, RL_W / 2, 1090, 46, { color: '#D1D5DB', weight: 600, alpha: rlIn(p, 0.35, 0.6) });
        rlText(c, I.leadAfter ? I.leadAfter + ' leads ' + I.year + ' by ' + I.margin.toFixed(1) + 'u' : I.year + ' is dead even', RL_W / 2, 1260, 44, { color: RL_GOLD, alpha: rlIn(p, 0.5, 0.75) });
        rlConfetti(c, p, wc);
      } });
      return S;
    }
    function rlConfetti(c, p, color) {
      if (document.documentElement.getAttribute('data-motion') === 'less') return;
      var seed = 7; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var i = 0; i < 70; i++) {
        var x = r() * RL_W, sp = 600 + r() * 900, y = -60 + ((p * sp + r() * RL_H) % (RL_H + 120)), s = 10 + r() * 16;
        c.save(); c.globalAlpha = 0.75; c.fillStyle = [color, RL_GOLD, '#F3F4F6'][i % 3]; c.translate(x, y); c.rotate(p * 6 + i); c.fillRect(-s / 2, -s / 4, s, s / 2); c.restore();
      }
    }

    // ── A season: title, the race drawing itself, the biggest hits, the numbers, the champion ──
    function rlSeasonScenes(Z) {
      var S = [];
      S.push({ d: 3, draw: function(c, p) {
        rlText(c, Z.done ? 'THE SEASON' : 'THE SEASON SO FAR', RL_W / 2, 700, 52, { color: RL_GOLD, spacing: 10, alpha: rlIn(p, 0, 0.2) });
        rlText(c, Z.year, RL_W / 2, 880, 240, { alpha: rlIn(p, 0.05, 0.35) });
        rlText(c, Z.weeks.length + ' weeks · ' + (Z.hits.Maria + Z.hits.Danielle) + ' hits', RL_W / 2, 1060, 44, { color: '#A1A9B6', weight: 600, alpha: rlIn(p, 0.35, 0.6) });
      } });
      if (Z.race.length > 1) S.push({ d: 12, draw: function(c, p) {
        rlText(c, '🏁 THE RACE', RL_W / 2, 300, 52, { color: '#A1A9B6', spacing: 8 });
        var all = [0]; Z.race.forEach(function(r) { all.push(r.Maria, r.Danielle); });
        var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1) hi = lo + 1;
        var L = 110, R = 970, T = 480, B = 1500, n = Z.race.length;
        var X = function(i) { return L + i / (n - 1) * (R - L); }, Y = function(v) { return B - (v - lo) / (hi - lo) * (B - T); };
        c.save(); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 3; c.setLineDash([12, 12]); c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(R, Y(0)); c.stroke(); c.restore();
        var prog = rlIn(p, 0.04, 0.9) * (n - 1), k = Math.floor(prog), f = prog - k;
        WK_MD.forEach(function(w) {
          c.beginPath(); c.strokeStyle = personColor(w); c.lineWidth = 10; c.lineJoin = 'round'; c.lineCap = 'round';
          for (var i = 0; i <= k; i++) { var x = X(i), y = Y(Z.race[i][w]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
          var hx = X(k), hy = Y(Z.race[k][w]);
          if (k < n - 1) { hx = X(k) + (X(k + 1) - X(k)) * f; hy = Y(Z.race[k][w] + (Z.race[k + 1][w] - Z.race[k][w]) * f); c.lineTo(hx, hy); }
          c.stroke();
          c.beginPath(); c.arc(hx, hy, 18, 0, Math.PI * 2); c.fillStyle = personColor(w); c.fill();
          var v = k < n - 1 ? Z.race[k][w] + (Z.race[k + 1][w] - Z.race[k][w]) * f : Z.race[k][w];
          rlText(c, (v >= 0 ? '+' : '') + v.toFixed(1), Math.min(hx + 20, 940), hy - 50, 44, { color: personColor(w), align: hx > 800 ? 'right' : 'left' });
        });
        var wk = Z.race[Math.min(n - 1, Math.round(prog))].week;
        rlText(c, weekName(wk).toUpperCase(), RL_W / 2, 1640, 56, { spacing: 4 });
      } });
      Z.bigHits.slice(0, 4).forEach(function(b, i) {
        S.push({ d: 2.6, tint: personColor(b.who), draw: function(c, p) {
          rlText(c, '💰 BIGGEST HIT No. ' + (i + 1), RL_W / 2, 560, 44, { color: '#A1A9B6', spacing: 6, alpha: rlIn(p, 0, 0.2) });
          var sc = 1 + 0.25 * (1 - rlIn(p, 0.05, 0.35));
          c.save(); c.translate(RL_W / 2, 820); c.scale(sc, sc); rlText(c, '+' + Math.round(b.odds), 0, 0, 230, { color: RL_GOLD, alpha: rlIn(p, 0.05, 0.3) }); c.restore();
          rlText(c, b.player, RL_W / 2, 1060, 80, { alpha: rlIn(p, 0.2, 0.45) });
          rlText(c, b.who + ' · ' + weekName(b.week) + ' · ' + fmtU(b.u), RL_W / 2, 1190, 46, { color: personColor(b.who), alpha: rlIn(p, 0.35, 0.6) });
        } });
      });
      S.push({ d: 4, draw: function(c, p) {
        rlText(c, 'BY THE NUMBERS', RL_W / 2, 420, 52, { color: '#A1A9B6', spacing: 8 });
        WK_MD.forEach(function(w, i) {
          var y = 640 + i * 520, a = rlIn(p, 0.08 + i * 0.12, 0.4 + i * 0.12);
          rlText(c, w.toUpperCase(), RL_W / 2, y, 64, { color: personColor(w), alpha: a, spacing: 6 });
          rlText(c, fmtU(Z.tot[w]), RL_W / 2, y + 140, 130, { alpha: a });
          rlText(c, Z.hits[w] + ' of ' + Z.n[w] + ' hit (' + pct(Z.hits[w], Z.n[w]) + ')', RL_W / 2, y + 270, 44, { color: '#A1A9B6', weight: 600, alpha: a });
        });
      } });
      S.push({ d: 4.6, tint: Z.lead ? personColor(Z.lead) : RL_GOLD, draw: function(c, p) {
        var wc = Z.lead ? personColor(Z.lead) : '#F3F4F6';
        rlText(c, Z.done ? '👑 ' + Z.year + ' CHAMPION' : '📈 LEADING ' + Z.year, RL_W / 2, 640, 52, { color: RL_GOLD, spacing: 6, alpha: rlIn(p, 0, 0.2) });
        rlText(c, Z.lead ? Z.lead.toUpperCase() : 'DEAD EVEN', RL_W / 2, 840, 190, { color: wc, alpha: rlIn(p, 0.08, 0.35) });
        rlText(c, Z.lead ? 'by ' + Z.margin.toFixed(1) + ' units' : '', RL_W / 2, 1010, 60, { alpha: rlIn(p, 0.3, 0.55), weight: 600 });
        rlText(c, Z.changes ? Z.changes + ' lead change' + (Z.changes === 1 ? '' : 's') + ' along the way' : 'Wire to wire', RL_W / 2, 1150, 44, { color: '#A1A9B6', weight: 600, alpha: rlIn(p, 0.45, 0.7) });
        if (Z.done) rlConfetti(c, p, wc);
      } });
      return S;
    }

    // ── The player ──
    function startReel(year, week) {
      wkLight().then(function(D) {
        var isWeek = !!week;
        RL.scenes = isWeek ? rlWeekScenes(wkIssue(D, year, week)) : rlSeasonScenes(wkSeason(D, year));
        RL.dur = RL.scenes.reduce(function(a, s) { return a + s.d; }, 0);
        RL.title = 'Maria vs Danielle · ' + (isWeek ? year + ' ' + weekName(week) : 'the ' + year + ' season');
        RL.file = 'MvD-' + year + (isWeek ? '-' + wkShort(week).replace(/\s+/g, '') : '-season');
        rlOpen();
        rlPlay(0);
      });
    }
    function rlOpen() {
      var root = document.getElementById('rl-root');
      if (!root) {
        root = document.createElement('div'); root.id = 'rl-root'; root.className = 'rl-root dk';
        root.innerHTML = '<div class="rl-stage"><canvas id="rl-cv" width="' + RL_PX + '" height="' + Math.round(RL_PX * RL_H / RL_W) + '"></canvas></div>' +
          '<div class="rl-bar"><button id="rl-pp" aria-label="Pause">⏸</button><button id="rl-re" aria-label="Replay">↺</button><button id="rl-save">💾 Save video</button><button id="rl-x" aria-label="Close">✕</button></div><div class="rl-msg" id="rl-msg"></div>';
        document.body.appendChild(root);
        document.getElementById('rl-pp').onclick = function() { if (RL.rec) return; RL.playing ? rlPause() : rlPlay(RL.t >= RL.dur ? 0 : RL.t); };
        document.getElementById('rl-re').onclick = function() { if (!RL.rec) rlPlay(0); };
        document.getElementById('rl-save').onclick = rlRecord;
        document.getElementById('rl-x').onclick = rlClose;
      }
      root.style.display = 'flex';
      document.getElementById('rl-msg').textContent = '';
      document.body.style.overflow = 'hidden';
    }
    function rlClose() {
      cancelAnimationFrame(RL.raf); RL.playing = false;
      if (RL.rec) { try { RL.rec.cancel = true; RL.rec.r.stop(); } catch (e) {} RL.rec = null; }
      var root = document.getElementById('rl-root'); if (root) root.style.display = 'none';
      document.body.style.overflow = '';
    }
    function rlPlay(from) {
      cancelAnimationFrame(RL.raf);
      RL.playing = true; RL.t0 = performance.now() - from * 1000;
      document.getElementById('rl-pp').textContent = '⏸';
      var tick = function(now) {
        RL.t = Math.min(RL.dur, (now - RL.t0) / 1000);
        rlDraw(RL.t);
        if (RL.t < RL.dur) RL.raf = requestAnimationFrame(tick);
        else { RL.playing = false; document.getElementById('rl-pp').textContent = '▶'; if (RL.rec) rlStopRec(); }
      };
      RL.raf = requestAnimationFrame(tick);
    }
    function rlPause() { cancelAnimationFrame(RL.raf); RL.playing = false; document.getElementById('rl-pp').textContent = '▶'; }
    function rlDraw(T) {
      var cv = document.getElementById('rl-cv'), c = cv.getContext('2d');
      c.setTransform(cv.width / RL_W, 0, 0, cv.height / RL_H, 0, 0);
      var acc = 0, sc = RL.scenes[RL.scenes.length - 1], p = 1;
      for (var i = 0; i < RL.scenes.length; i++) { if (T < acc + RL.scenes[i].d) { sc = RL.scenes[i]; p = (T - acc) / sc.d; break; } acc += RL.scenes[i].d; }
      rlBackdrop(c, T, sc.tint);
      // Scene fade in/out
      c.save(); c.globalAlpha = Math.min(1, p / 0.06, (1 - p) / 0.06 + (sc === RL.scenes[RL.scenes.length - 1] ? 1 : 0));
      sc.draw(c, p, T);
      c.restore();
      // Progress
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(80, RL_H - 70, RL_W - 160, 8);
      c.fillStyle = RL_GOLD; c.fillRect(80, RL_H - 70, (RL_W - 160) * Math.min(1, T / RL.dur), 8);
    }

    // ── 💾 Record the reel into a video file (or a share image if this phone can't) ──
    function rlRecord() {
      if (RL.rec) return;
      var cv = document.getElementById('rl-cv'), msg = document.getElementById('rl-msg');
      var types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      var type = typeof MediaRecorder !== 'undefined' && cv.captureStream ? types.filter(function(t) { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } })[0] : null;
      if (!type) return rlImage();
      var stream, r;
      try { stream = cv.captureStream(30); r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5000000 }); } catch (e) { return rlImage(); }
      var chunks = [];
      RL.rec = { r: r, type: type, cancel: false };
      r.ondataavailable = function(e) { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = function() {
        var rec = RL.rec; RL.rec = null;
        document.getElementById('rl-save').textContent = '💾 Save video';
        if (!rec || rec.cancel || !chunks.length) return;
        var mime = type.split(';')[0], ext = /mp4/.test(mime) ? 'mp4' : 'webm';
        rlDeliver(new Blob(chunks, { type: mime }), RL.file + '.' + ext, 'video');
      };
      document.getElementById('rl-save').textContent = '⏺ Recording…';
      msg.textContent = 'Recording the whole reel (' + Math.round(RL.dur) + ' seconds). Keep this screen open.';
      r.start(250);
      rlPlay(0);
    }
    function rlStopRec() { try { RL.rec.r.stop(); } catch (e) { RL.rec = null; } }
    function rlImage() {
      rlPause(); rlDraw(RL.dur - 0.05);
      var cv = document.getElementById('rl-cv');
      cv.toBlob(function(b) { if (b) rlDeliver(b, RL.file + '.png', 'image'); }, 'image/png');
    }
    function rlDeliver(blob, name, kind) {
      var msg = document.getElementById('rl-msg');
      var file = null; try { file = new File([blob], name, { type: blob.type }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|iPhone|iPad|Android/i.test(navigator.userAgent)) {
        msg.textContent = kind === 'video' ? '✅ Video ready.' : 'This phone can\'t record video, so here\'s the final frame as a picture.';
        navigator.share({ files: [file], title: RL.title }).catch(function() { rlDownload(blob, name); });
        return;
      }
      rlDownload(blob, name);
      msg.textContent = kind === 'video' ? '✅ Saved ' + name + '.' : 'This browser can\'t record video, so it saved the final frame as a picture (' + name + ').';
    }
    function rlDownload(blob, name) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && document.getElementById('rl-root') && document.getElementById('rl-root').style.display !== 'none') rlClose(); });
