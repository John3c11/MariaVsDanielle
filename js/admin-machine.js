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

    // ── 🧪 Machine Lab (v144): try other settings on the same backtest, saved side by side ──
    // Nothing here touches the live Machine: each run fits fresh copies on the seasons before each test season
    // (Machine.gs machineLab_), exactly like the accuracy report.
    var MLAB = { k: null, data: null, busy: false };
    var MLAB_KNOBS = [
      { id: 'decay', t: 'Form memory', d: 'how fast old games fade (lower = only the last few games count)', lo: 0.7, hi: 0.95, st: 0.01 },
      { id: 'seasonDecay', t: 'Offseason carry-over', d: 'how much of last season a team keeps (0 = fresh start)', lo: 0, hi: 1, st: 0.05 },
    ];
    var MLAB_W = [
      { id: 'a', t: 'Recent TD share', lo: 0, hi: 3, st: 0.25 }, { id: 'b', t: 'Goal-line touches', lo: 0, hi: 3, st: 0.25 },
      { id: 'c', t: 'All touches', lo: 0, hi: 3, st: 0.25 }, { id: 'tau', t: 'Sharpness', lo: 0.5, hi: 2.5, st: 0.05 },
    ];
    function adminMachineLab() {
      var body = adminScreen('mlab', '<div class="loading">Loading the Lab…</div>');
      picksApi({ pin: SUB.pin, action: 'mlab' }).then(function(r) {
        if (!document.body.contains(body)) return;
        if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
        if (!r.defaults) { body.innerHTML = '<div class="inj-warn">⚠️ Paste the new Machine.gs and PicksAPI.gs, then Deploy → Manage deployments → ✏️ → New version → Deploy.</div>'; return; }
        MLAB.data = r;
        if (!MLAB.k) MLAB.k = JSON.parse(JSON.stringify(r.live || r.defaults));
        drawMachineLab(body);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawMachineLab(body) {
      var D = MLAB.data, K = MLAB.k, def = D.defaults;
      function num(v, st) { return st < 0.05 ? Number(v).toFixed(2) : st < 0.25 ? Number(v).toFixed(2).replace(/0$/, '') : String(v); }
      function slider(o, val) {
        return '<div class="ml-k"><div class="ml-kh"><b>' + o.t + '</b> <span class="ml-kv" id="mlv-' + o.id + '">' + num(val, o.st) + '</span>' +
          (val !== def[o.id] ? ' <small>standard ' + def[o.id] + '</small>' : '') + '</div>' + (o.d ? '<div class="ml-kd">' + o.d + '</div>' : '') +
          '<input type="range" class="ml-range" data-mlk="' + o.id + '" min="' + o.lo + '" max="' + o.hi + '" step="' + o.st + '" value="' + val + '"></div>';
      }
      function seg(id, opts, val) {
        return '<div class="lk-seg ml-seg">' + opts.map(function(o) { return '<button data-mls="' + id + '" data-v="' + o[0] + '" class="' + (String(val) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
      }
      var h = '<div class="ui-note u-mb">Try other settings on the same test as the accuracy report: every 2025–26 game, each one predicted by a model that never saw it. <b>Nothing here changes the live Machine.</b></div>';
      h += '<div class="pf-h">🎛️ Knobs <small>live: ' + escHtml(D.liveLabel || 'Standard settings') + '</small></div><div class="ml-knobs">';
      MLAB_KNOBS.forEach(function(o) { h += slider(o, K[o.id]); });
      h += '<div class="ml-k"><div class="ml-kh"><b>Vegas spread</b></div><div class="ml-kd">which team scores first: the spread plus recent form, or recent form alone</div>' + seg('spread', [[true, 'Use it'], [false, 'Ignore it']], K.spread) + '</div>';
      h += '<div class="ml-k"><div class="ml-kh"><b>Who scores for his team</b></div><div class="ml-kd">Auto = it searches 256 mixes for the one that fits best</div>' + seg('weights', [['auto', 'Auto'], ['fixed', 'Set my own']], K.weights) +
        (K.weights === 'fixed' ? '<div class="ml-sub">' + MLAB_W.map(function(o) { return slider(o, K[o.id]); }).join('') + '</div>' : '') + '</div>';
      h += '<div class="ml-k"><div class="ml-kh"><b>Defense / return first TDs</b></div><div class="ml-kd">the share of first TDs nobody can pick</div>' + seg('nonoff', [['auto', 'Learn it'], ['fixed', 'Set it']], K.nonoff) +
        (K.nonoff === 'fixed' ? '<div class="ml-sub">' + slider({ id: 'nonoffP', t: 'Share', lo: 0, hi: 0.15, st: 0.01 }, K.nonoffP) + '</div>' : '') + '</div>';
      h += '</div><div class="ml-run"><input class="adm-input" id="ml-name" maxlength="40" placeholder="Name it (optional)"><button class="adm-btn green" id="ml-go"' + (MLAB.busy ? ' disabled' : '') + '>' + (MLAB.busy ? '⏳ Running… (about a minute)' : '▶ Run the test') + '</button>' +
        '<button class="adm-btn" id="ml-reset">↺ Standard</button></div><div class="u-ta-left submit-msg" id="adm-msg"></div>';
      h += mlabTable(D);
      body.innerHTML = h;
      // knobs
      body.querySelectorAll('[data-mlk]').forEach(function(inp) {
        inp.addEventListener('input', function() { var id = inp.getAttribute('data-mlk'); K[id] = parseFloat(inp.value); var v = document.getElementById('mlv-' + id); if (v) v.textContent = num(K[id], parseFloat(inp.step)); });
      });
      body.querySelectorAll('[data-mls]').forEach(function(b) {
        b.addEventListener('click', function() { var id = b.getAttribute('data-mls'), v = b.getAttribute('data-v'); K[id] = v === 'true' ? true : v === 'false' ? false : v; drawMachineLab(body); });
      });
      document.getElementById('ml-reset').addEventListener('click', function() { MLAB.k = JSON.parse(JSON.stringify(def)); drawMachineLab(body); });
      document.getElementById('ml-go').addEventListener('click', function() {
        MLAB.busy = true;
        var name = document.getElementById('ml-name').value;
        drawMachineLab(body);
        picksApi({ pin: SUB.pin, action: 'mlabrun', k: JSON.stringify(K), name: name }).then(function(x) {
          MLAB.busy = false;
          if (x.error) { drawMachineLab(body); adminMsg(x.error, false); return; }
          MLAB.data.list = x.list;
          drawMachineLab(body);
          adminMsg('Done in ' + Math.round((x.exp.ms || 0) / 1000) + ' seconds. It\'s the first column below.', true);
        }).catch(function() { MLAB.busy = false; drawMachineLab(body); adminMsg('It took too long to answer. Wait a minute and reload this screen: it was probably saved.', false); });
      });
      body.querySelectorAll('[data-ml-rm]').forEach(function(b) {
        b.addEventListener('click', function() {
          if (!confirm('Delete this experiment?')) return;
          picksApi({ pin: SUB.pin, action: 'mlabrm', id: b.getAttribute('data-ml-rm') }).then(function(x) { if (x.list) { MLAB.data.list = x.list; drawMachineLab(body); } });
        });
      });
      body.querySelectorAll('[data-ml-load]').forEach(function(b) {
        b.addEventListener('click', function() {
          var e = MLAB.data.list.filter(function(x) { return x.id === b.getAttribute('data-ml-load'); })[0];
          if (e) { MLAB.k = JSON.parse(JSON.stringify(e.k)); drawMachineLab(body); window.scrollTo(0, 0); adminMsg('Loaded "' + e.name + '" into the knobs.', true); }
        });
      });
    }
    // Every experiment next to the live Machine's report; the best number in each row is green
    function mlabTable(D) {
      var L = D.report, cols = [];
      if (L) cols.push({ live: true, name: '🤖 Live', sub: L.at ? 'report ' + new Date(L.at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '', r: L });
      (D.list || []).forEach(function(e) { cols.push({ e: e, name: e.name, sub: new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), r: e.r }); });
      if (!cols.length) return '';
      if (cols.length === 1 && cols[0].live) return '<div class="pf-h">📊 Results</div><div class="ui-note">No experiments yet. Press ▶ Run the test: first with the live settings (that also fills in 💰 units), then change a knob and run it again.</div>';
      var years = {};
      cols.forEach(function(c) { Object.keys((c.r && c.r.seasons) || {}).forEach(function(y) { years[y] = 1; }); });
      function pc(x) { return x == null ? '—' : (x * 100).toFixed(1) + '%'; }
      function un(x) { return x == null ? '—' : (x >= 0 ? '+' : '') + Number(x).toFixed(1) + 'u'; }
      var rows = [
        ['🎯 Hit on their games', function(r) { return r.their; }, pc, function(r) { return r.theirN ? r.theirN + ' games' : ''; }],
        ['💰 Units on their games', function(r) { return r.units; }, un, function(r) { return r.bets ? 'at its est. prices' : ''; }],
        ['🏈 Hit on every game', function(r) { return r.two; }, pc, function(r) { return r.tested ? r.tested + ' games' : ''; }],
        ['🥇 Top pick scored first', function(r) { return r.top1; }, pc],
        ['⚖️ Called the team', function(r) { return r.team; }, pc],
        ['🧠 Sharper than guessing', function(r) { return r.sharp; }, pc],
      ];
      Object.keys(years).sort().forEach(function(y) {
        rows.push([y + ': hit on their games', function(r) { return r.seasons && r.seasons[y] ? r.seasons[y].their : null; }, pc, function(r) { return r.seasons && r.seasons[y] ? r.seasons[y].theirN + ' games' : ''; }]);
        rows.push([y + ': units', function(r) { return r.seasons && r.seasons[y] ? r.seasons[y].units : null; }, un]);
      });
      var h = '<div class="pf-h">📊 Results <small>best in each row is green · differences are vs 🤖 Live</small></div><div class="ml-tw"><table class="ml-t"><thead><tr><th></th>' + cols.map(function(c) {
        return '<th class="' + (c.live ? 'ml-live' : '') + '"><div class="ml-cn">' + escHtml(c.name) + '</div><div class="ml-cs">' + escHtml(c.sub) + '</div>' +
          (c.e ? '<div class="ml-ca"><button class="link-btn" data-ml-load="' + c.e.id + '">Load</button> · <button class="link-btn" data-ml-rm="' + c.e.id + '">🗑</button></div>' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function(row) {
        var vals = cols.map(function(c) { var v = c.r ? row[1](c.r) : null; return v == null || isNaN(v) ? null : row[2] === pc ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10; });
        var nums = vals.filter(function(v) { return v != null; }), best = nums.length > 1 ? Math.max.apply(null, nums) : null;
        var base = cols[0].live ? vals[0] : null;
        return '<tr><td class="ml-rl">' + row[0] + '</td>' + vals.map(function(v, i) {
          var d = base != null && v != null && i > 0 ? v - base : null;
          var dTxt = d == null || Math.abs(d) < (row[2] === pc ? 0.0005 : 0.05) ? '' : '<small class="' + (d > 0 ? 'u-good' : 'u-bad') + '">' + (row[2] === pc ? (d > 0 ? '+' : '') + (d * 100).toFixed(1) : (d > 0 ? '+' : '') + d.toFixed(1)) + '</small>';
          var note = row[3] && cols[i].r ? row[3](cols[i].r) : '';
          return '<td class="' + (best != null && v === best ? 'ml-best' : '') + '">' + row[2](v) + dTxt + (note ? '<div class="ml-cs">' + note + '</div>' : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
        '<div class="mc-note">Small differences (under a point or two) are mostly luck: a few hundred games is not a lot. Units use its estimated FanDuel price for each pick, so they\'re a rough guide.</div>';
      return h;
    }
