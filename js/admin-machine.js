// Admin, 🤖 Machine: settings and retrain
// Loaded by admin.js (showAdmin) the first time you open this section. Part of the MariaVsDanielle site; shares the global scope.

    // ── 🤖 The Machine (admin only until step 3): the game library + the model's accuracy report ──
    function adminMachine() {
      var body = adminScreen('machine', '<div class="loading">Loading the Machine…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'machine' }), loadAllBets().catch(function() { return []; })]).then(function(res) {
        drawAdminMachine(body, res[0], res[1]);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawAdminMachine(body, r, bets) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
      if (!r.library) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy, then reload.</div>'; return; }
      var L = r.library, ll = L.last || {}, R = r.report;
      function pc(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + '%'; }
      function ago(iso) { if (!iso) return 'never'; var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : Math.round(m / 1440) + ' days ago'; }
      var h = '<div class="ui-note u-mb">Only you can see this report. Everyone else sees the 🤖 Machine tab, where its picks only show up after kickoff.</div>';
      h += '<div class="st-row"><span class="st-ic">' + (!L.on ? '❌' : ll.caught ? '✅' : '⏳') + '</span><div class="u-grow"><div class="st-l">Game library: ' + (ll.total || 0) + ' games</div><div class="st-d">' +
        (!L.on ? 'Not running. In Apps Script, run setupGameLibrary.' : ll.caught ? 'Every NFL game since 2023, up to date. Checks hourly for new ones.' : 'Still filling in (about ' + L.estimate + ' games total), up to ' + escHtml(ll.cursor || '…') + '.') +
        '</div></div></div>';
      h += '<div class="st-row"><span class="st-ic">' + (R ? '🧠' : '⏳') + '</span><div class="u-grow"><div class="st-l">' + (R ? 'Model trained ' + ago(R.at) : 'Model not trained yet') + '</div><div class="st-d">' +
        (R ? 'On ' + R.games + ' games. It retrains itself when new games come in.' : 'It trains itself once the library is caught up, or press Train now (needs 100+ games).') +
        '</div><button class="u-mt-8px adm-btn" id="mc-train">' + (R ? 'Retrain now' : 'Train now') + '</button>' +
        (R ? ' <button class="u-mt-8px adm-btn" id="mc-picks">Make its picks now</button>' : '') + '</div></div><div class="u-ta-left submit-msg" id="adm-msg"></div>' +
        (R ? '<div class="u-m-4px-0-6px mc-note">Its picks for upcoming games refresh every hour on their own and lock at kickoff. The 2026 games already played got "after the fact" picks once, and those never change. <button class="link-btn" onclick="switchTab(\'machine\')">See the 🤖 Machine tab →</button></div>' : '');
      if (R) {
        // Their real hit rate in the same format (two picks a game), for comparison
        function rate(who) {
          var x = bets.filter(function(b) { return b.picker === who && (b.correct === 'Yes' || b.correct === 'No') && !b.notOffered && R.testSeasons.indexOf(parseInt(b.year, 10)) >= 0; });
          return x.length ? { r: x.filter(function(b) { return b.correct === 'Yes'; }).length / x.length, n: x.length } : null;
        }
        var rm = rate('Maria'), rd = rate('Danielle');
        h += '<div class="u-mt-18px pf-h">📋 Accuracy report <small>tested on ' + R.tested + ' games it never trained on (' + R.testSeasons.join(' & ') + ')</small></div>';
        h += '<div class="mc-tiles">' +
          (R.theirN >= 10
            ? '<div class="mc-tile big"><div class="mc-k">On their ' + R.theirN + ' games, its picks hit (one per team, like theirs)</div><div class="mc-v">' + pc(R.their, 1) + '</div>' +
              '<div class="mc-s">' + (rm ? '<b style="color:' + SB_M + '">Maria ' + pc(rm.r) + '</b> · ' : '') + (rd ? '<b style="color:' + SB_D + '">Danielle ' + pc(rd.r) + '</b> · ' : '') + 'every NFL game: ' + pc(R.two, 1) + ' (most-touches pick ' + pc(R.twoBase, 1) + ')</div></div>'
            : '<div class="mc-tile big"><div class="mc-k">Its picks hit (one per team, like theirs)</div><div class="mc-v">' + pc(R.two, 1) + '</div>' +
              '<div class="mc-s">' + (rm ? '<b style="color:' + SB_M + '">Maria ' + pc(rm.r) + '</b> · ' : '') + (rd ? '<b style="color:' + SB_D + '">Danielle ' + pc(rd.r) + '</b> · ' : '') + 'most-touches pick ' + pc(R.twoBase, 1) + '</div></div>') +
          '<div class="mc-tile"><div class="mc-k">Top pick of the game scored first</div><div class="mc-v">' + pc(R.top1, 1) + '</div></div>' +
          '<div class="mc-tile"><div class="mc-k">Called which team scores first</div><div class="mc-v">' + pc(R.team) + '</div><div class="mc-s">a coin flip is 50%</div></div>' +
          '<div class="mc-tile"><div class="mc-k">Sharper than guessing</div><div class="mc-v">' + (R.llBase ? Math.round((1 - R.ll / R.llBase) * 100) : 0) + '%</div><div class="mc-s">how much less surprised it is by the real scorer than an even guess</div></div>' +
        '</div>';
        // Calibration
        var top = Math.max.apply(null, R.cal.map(function(c) { return Math.max(c.pred, c.act); }).concat([0.05]));
        h += '<div class="pf-h">🎯 Are its percentages honest? <small>players grouped by the chance it gave them</small></div><div class="mc-cal">' +
          R.cal.filter(function(c) { return c.n >= 15; }).map(function(c) {
            return '<div class="mc-row"><div class="mc-lab">' + Math.round(c.lo * 100) + '–' + (c.hi >= 1 ? '100' : Math.round(c.hi * 100)) + '%<small>' + c.n + ' players</small></div><div class="mc-bars">' +
              '<div class="mc-bar pred"><i style="width:' + (c.pred / top * 100).toFixed(1) + '%"></i><span>said ' + pc(c.pred, 1) + '</span></div>' +
              '<div class="mc-bar act"><i style="width:' + (c.act / top * 100).toFixed(1) + '%"></i><span>scored ' + pc(c.act, 1) + '</span></div></div></div>';
          }).join('') + '</div><div class="mc-note">If the two bars in a row are close, its percentages mean what they say.</div>';
        // What it learned
        var W = R.W || {}, wsum = (W.a || 0) + (W.b || 0) + (W.c || 0) || 1;
        h += '<div class="pf-h">🧠 What it learned</div><ul class="mc-list">' +
          '<li>A 7-point home favorite scores the first TD <b>' + R.home7 + '%</b> of the time, an even game <b>' + R.homeEven + '%</b> (when a defense or return TD doesn\'t come first).</li>' +
          '<li><b>' + pc(R.nonoff, 1) + '</b> of first TDs are a defense or special-teams score that nobody can pick.</li>' +
          '<li>Who scores for his team: <b>' + Math.round((W.b || 0) / wsum * 100) + '%</b> goal-line touches, <b>' + Math.round((W.a || 0) / wsum * 100) + '%</b> recent TD share, <b>' + Math.round((W.c || 0) / wsum * 100) + '%</b> overall touches' + (W.tau > 1 ? ', with extra weight on the team\'s top options' : '') + '.</li>' +
          '<li>ESPN had a point spread for <b>' + pc(R.spreadShare) + '</b> of games. The rest use each offense\'s recent form.</li></ul>';
        // Prices
        var P = R.price || {};
        h += '<div class="pf-h">💲 Estimated FanDuel prices <small>for picks without real odds</small></div><div class="u-mb-6px mc-note">' +
          (P.n >= 20 ? 'Learned from <b>' + P.n + '</b> real FanDuel prices you typed into the sheets. Typical miss: <b>±' + Math.round(P.err * 100) + '%</b> of the real price.' : 'Not enough real prices matched yet (' + (P.n || 0) + '), so it uses the fair price with a 20% cut for now.') + '</div>' +
          '<div class="mc-prices"><span>5% chance → <b>+' + P.p05 + '</b></span><span>10% → <b>+' + P.p10 + '</b></span><span>20% → <b>+' + P.p20 + '</b></span>' +
            (P.margin != null ? '<span>FanDuel\'s cut: <b>' + Math.round(P.margin * 100) + '%</b></span>' : '') + '</div>';
        // 🔍 Price check: real prices you typed vs its estimates
        if (P.ranges && P.ranges.length) {
          h += '<div class="pf-h">🔍 Price check <small>its estimate for every pick Maria and Danielle made</small></div>' +
            '<div class="mc-pc"><div class="mc-pc-r mc-pc-h"><span>Real price</span><span>Picks</span><span>Typical real</span><span>Its estimate</span></div>' +
            P.ranges.filter(function(r) { return r.n; }).map(function(r) {
              var off = r.est && r.real ? Math.round((r.est - r.real) / r.real * 100) : 0;
              return '<div class="mc-pc-r"><span>' + r.label + '</span><span>' + r.n + '</span><span>+' + r.real + '</span><span>+' + r.est + ' <small style="color:' + (Math.abs(off) <= 20 ? '#6EE7B7' : '#FCA5A5') + '">' + (off > 0 ? '+' : '') + off + '%</small></span></div>';
            }).join('') + '</div>';
          if (P.check && P.check.length) h += '<details class="u-mt-8px an-more"><summary>Biggest misses (' + P.check.length + ')</summary>' +
            '<div class="mc-pc">' + P.check.map(function(c) {
              return '<div class="mc-pc-r"><span>' + escHtml(c.n) + ' <small>' + c.y + ' ' + wkName(c.w) + '</small></span><span>' + c.p + '%</span><span>+' + c.real + '</span><span>+' + c.est + '</span></div>';
            }).join('') + '</div><div class="mc-note">Its chance, the real price, and its estimate. If the misses are mostly stars it rates too low (a low chance with a short real price), the chance is off, not the pricing.</div></details>';
        }
      }
      body.innerHTML = h;
      var mp = document.getElementById('mc-picks');
      if (mp) mp.addEventListener('click', function() {
        mp.disabled = true; mp.textContent = 'Picking… (about a minute)';
        picksApi({ pin: SUB.pin, action: 'mpicks' }).then(function(x) {
          mp.disabled = false; mp.textContent = 'Make its picks now';
          if (x.error) { adminMsg(x.error, false); return; }
          if (typeof MACHINE !== 'undefined') MACHINE.data = null;
          adminMsg(x.made ? 'Made or refreshed ' + x.made + ' pick' + (x.made === 1 ? '' : 's') + '.' : 'Nothing new to pick right now.', true);
        }).catch(function() { mp.disabled = false; mp.textContent = 'Make its picks now'; adminMsg('It took too long to answer. Wait a minute and check the 🤖 Machine tab.', false); });
      });
      document.getElementById('mc-train').addEventListener('click', function() {
        var b = this; b.disabled = true; b.textContent = 'Training… (about a minute)';
        picksApi({ pin: SUB.pin, action: 'mtrain' }).then(function(x) {
          if (x.error) { b.disabled = false; b.textContent = 'Train now'; adminMsg(x.error, false); return; }
          adminMachine();
        }).catch(function() { b.disabled = false; b.textContent = 'Train now'; adminMsg('It took too long to answer. Wait a minute and reload: it probably finished.', false); });
      });
    }
