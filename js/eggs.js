// 🥚 Easter eggs. Nothing here does anything useful, on purpose. Shhh.
// Loaded a few seconds after the page opens (main.js). Each egg found is remembered on this phone.
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var EGGS = ['campbell', 'kelce', 'rivalry', 'retro', 'roll'];
    function eggFound(k) {
      var got = {};
      try { got = JSON.parse(localStorage.getItem('mvd-eggs') || '{}'); } catch (e) {}
      var fresh = !got[k];
      got[k] = got[k] || Date.now();
      try { localStorage.setItem('mvd-eggs', JSON.stringify(got)); } catch (e) {}
      var n = EGGS.filter(function(x) { return got[x]; }).length;
      return fresh ? '🥚 Easter egg ' + n + ' of ' + EGGS.length + ' found!' + (n === EGGS.length ? ' You found them all. 🏆' : '') : '';
    }
    function eggToast(text, sub) {
      var t = document.createElement('div');
      t.className = 'egg-toast';
      t.innerHTML = '<div>' + text + '</div>' + (sub ? '<small>' + sub + '</small>' : '');
      document.body.appendChild(t);
      setTimeout(function() { t.classList.add('out'); }, 3400);
      setTimeout(function() { t.remove(); }, 4000);
    }
    // Things falling from the top of the screen: emoji, or an image
    function eggRain(what, n, img) {
      var box = document.createElement('div');
      box.className = 'egg-rain';
      var h = '';
      for (var i = 0; i < n; i++) {
        var size = img ? 34 + Math.random() * 30 : 22 + Math.random() * 16;
        var style = 'left:' + (Math.random() * 96).toFixed(1) + '%;animation-delay:' + (Math.random() * 1.4).toFixed(2) + 's;animation-duration:' + (2.4 + Math.random() * 1.8).toFixed(2) + 's;';
        h += img ? '<img src="' + img + '" alt="" style="' + style + 'width:' + size + 'px;height:' + size + 'px">'
          : '<i style="' + style + 'font-size:' + size + 'px">' + what[i % what.length] + '</i>';
      }
      box.innerHTML = h;
      document.body.appendChild(box);
      setTimeout(function() { box.remove(); }, 5200);
    }
    function typing(e) { var t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }

    (function() {
      // 1. Campbell Dingus: tap him five times, quickly
      var taps = [];
      document.addEventListener('click', function(e) {
        var c = e.target.closest && e.target.closest('.campbell-bottom img');
        if (!c) return;
        var now = Date.now();
        taps = taps.filter(function(t) { return now - t < 2500; });
        taps.push(now);
        if (taps.length >= 5) {
          taps = [];
          eggRain(null, 26, c.getAttribute('src'));
          eggToast('Campbell Dingus has entered the chat.', eggFound('campbell'));
        }
      });

      // 2. Type K-E-L-C-E (computers) and 4. the Konami code
      var keys = '', KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], seq = [];
      document.addEventListener('keydown', function(e) {
        if (typing(e)) return;
        keys = (keys + (e.key || '').toLowerCase()).slice(-5);
        if (keys === 'kelce') {
          keys = '';
          eggRain(['🏈', '8️⃣7️⃣', '🏈', '❤️'], 34);
          eggToast('🏈 87 🏈', eggFound('kelce'));
        }
        seq.push(e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
        seq = seq.slice(-KONAMI.length);
        if (seq.join(',') === KONAMI.join(',')) { seq = []; retroMode(); }
      });

      // 3. Hold the VS badge for a second and a half: the all-time head-to-head
      var hold = null;
      document.addEventListener('pointerdown', function(e) {
        if (!(e.target.closest && e.target.closest('.vs-badge'))) return;
        hold = setTimeout(function() {
          hold = null;
          var badge = document.querySelector('.vs-badge');
          if (badge) { badge.classList.remove('egg-vs'); void badge.offsetWidth; badge.classList.add('egg-vs'); }
          loadAllBets().then(function(all) {
            var u = { Maria: 0, Danielle: 0 }, yrs = {};
            all.forEach(function(r) { if (u[r.picker] !== undefined && (r.correct === 'Yes' || r.correct === 'No')) { u[r.picker] += r.netUnits; yrs[r.year] = 1; } });
            var lead = u.Maria >= u.Danielle ? 'Maria' : 'Danielle';
            eggToast('⚔️ All-time: <b style="color:' + SB_M + '">Maria ' + fmtU(u.Maria) + '</b> vs <b style="color:' + SB_D + '">Danielle ' + fmtU(u.Danielle) + '</b>',
              Object.keys(yrs).length + ' seasons and counting. ' + lead + ' leads it. ' + eggFound('rivalry'));
          });
        }, 1500);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function(ev) { document.addEventListener(ev, function() { if (hold) { clearTimeout(hold); hold = null; } }); });

      // 5. Tap the season title three times: a barrel roll
      var tt = [];
      document.addEventListener('click', function(e) {
        if (!(e.target.closest && e.target.closest('#season-title'))) return;
        var now = Date.now();
        tt = tt.filter(function(t) { return now - t < 1200; });
        tt.push(now);
        if (tt.length >= 3) {
          tt = [];
          var h = document.getElementById('season-title');
          h.classList.remove('egg-roll'); void h.offsetWidth; h.classList.add('egg-roll');
          var msg = eggFound('roll');
          if (msg) eggToast('Do a barrel roll!', msg);
        }
      });
    })();

    // 🕹️ Retro mode: pixel font and scanlines until the page reloads
    function retroMode() {
      if (!document.getElementById('egg-retro-font')) {
        var l = document.createElement('link');
        l.id = 'egg-retro-font'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
        document.head.appendChild(l);
      }
      document.documentElement.classList.toggle('egg-retro');
      var on = document.documentElement.classList.contains('egg-retro');
      eggToast(on ? '🕹️ INSERT COIN. Retro mode on.' : 'Retro mode off.', on ? eggFound('retro') || 'Do the code again (or reload) to turn it off.' : '');
    }
