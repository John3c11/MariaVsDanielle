// ⏳ Time Machine picker (v142): pick a season and a week, and the whole site reloads the way it looked
// right after that week. The data side (what gets left out) is ASOF in core.js; the banner is in main.js.
// Loaded on demand (loadScriptOnce). Part of the MariaVsDanielle site; shares the global scope.

    var TM = { data: null, loading: null, year: '', week: 0 };

    // Every season's finished weeks, with how each one went: [{ year, weeks: [{ n, u: {Maria, Danielle}, tot: {Maria, Danielle} }] }]
    // Reads the real sheets (not the Time Machine's cut-down copy), so you can go forward too.
    function tmLoad() {
      if (TM.data) return Promise.resolve(TM.data);
      if (TM.loading) return TM.loading;
      var get = window.ASOF_RAW_FETCH || window.fetch;
      TM.loading = Promise.all(SEASONS_ALL.map(function(s) {
        var url = betsUrl(s);
        return get(url).then(function(r) { return r.json(); }).then(function(d) {
          var W = {};
          readBets(d.values).forEach(function(b) {
            if ((b.picker !== 'Maria' && b.picker !== 'Danielle') || !b.home || !b.weekN || b.weekN > 23) return;
            var w = W[b.weekN] || (W[b.weekN] = { n: b.weekN, done: true, any: false, u: { Maria: 0, Danielle: 0 } });
            if (!(b.homePick || b.awayPick)) return;
            w.any = true;
            if (b.scored) w.u[b.picker] += b.units; else w.done = false;
          });
          var tot = { Maria: 0, Danielle: 0 }, weeks = [];
          Object.keys(W).map(Number).sort(function(a, b) { return a - b; }).forEach(function(n) {
            var w = W[n];
            if (!w.any || !w.done) return; // a week still being played (or not picked yet) isn't a stop
            tot = { Maria: tot.Maria + w.u.Maria, Danielle: tot.Danielle + w.u.Danielle };
            weeks.push({ n: n, u: w.u, tot: tot });
          });
          return { year: s.year, weeks: weeks };
        }).catch(function() { return { year: s.year, weeks: [] }; });
      })).then(function(list) {
        TM.data = list.filter(function(x) { return x.weeks.length; }).sort(function(a, b) { return parseInt(a.year, 10) - parseInt(b.year, 10); });
        TM.loading = null;
        return TM.data;
      });
      TM.loading.catch(function() { TM.loading = null; });
      return TM.loading;
    }
    // Every stop in order, oldest first: [{ year, n }]
    function tmStops(data) {
      var out = [];
      data.forEach(function(s) { s.weeks.forEach(function(w) { out.push({ year: s.year, n: w.n }); }); });
      return out;
    }
    function tmSeason(year) { return (TM.data || []).filter(function(s) { return s.year === year; })[0]; }
    function tmChip(n) { return n > 18 ? PLAYOFF_SHORT[n] : String(n); }

    // ‹ Earlier / Later › from the banner. Later than the last finished week = back to now.
    function tmStepGo(d) {
      tmLoad().then(function(data) {
        var st = tmStops(data), i = -1;
        st.forEach(function(x, j) { if (x.year === ASOF.year && x.n <= ASOF.week) i = j; });
        var j = i + d;
        if (d < 0 && i < 0) return;
        if (j < 0) { alert('That\'s the very first week. Nothing earlier to go back to.'); return; }
        if (j >= st.length) { asofGo(); return; }
        asofGo(st[j].year, st[j].n);
      });
    }

    function tmOpen() {
      var bk = document.getElementById('tm-back');
      if (!bk) {
        bk = document.createElement('div');
        bk.id = 'tm-back'; bk.className = 'lk-back';
        bk.innerHTML = '<div class="lk-card tm-card2" role="dialog" aria-label="Time Machine"></div>';
        bk.addEventListener('click', function(e) { if (e.target === bk) bk.classList.remove('open'); });
        document.body.appendChild(bk);
      }
      bk.classList.add('open');
      var card = bk.querySelector('.lk-card');
      card.innerHTML = '<div class="lk-top"><b>⏳ Time Machine</b><button class="lk-x" aria-label="Close">✕</button></div><div class="loading">Loading every week…</div>';
      card.querySelector('.lk-x').onclick = function() { bk.classList.remove('open'); };
      tmLoad().then(function(data) {
        if (!data.length) { card.querySelector('.loading').textContent = 'No finished weeks yet. Come back after Week 1.'; return; }
        if (ASOF) { TM.year = ASOF.year; TM.week = ASOF.week; }
        if (!tmSeason(TM.year)) { var last = data[data.length - 1]; TM.year = last.year; TM.week = last.weeks[last.weeks.length - 1].n; }
        tmDraw(card);
      });
    }

    function tmDraw(card) {
      var se = tmSeason(TM.year);
      if (!se.weeks.some(function(w) { return w.n === TM.week; })) TM.week = se.weeks[se.weeks.length - 1].n;
      var cur = se.weeks.filter(function(w) { return w.n === TM.week; })[0];
      var h = '<div class="lk-top"><b>⏳ Time Machine</b><button class="lk-x" aria-label="Close">✕</button></div>' +
        '<div class="tm-sub">See the whole site the way it looked right after any week: the scoreboard, records, profiles, everything.</div>';
      if (TM.data.length > 1) h += '<div class="lk-g"><div class="lk-h">Season</div><div class="lk-seg">' + TM.data.map(function(s) {
        return '<button data-tm-y="' + s.year + '" class="' + (s.year === TM.year ? 'on' : '') + '">' + s.year + '</button>';
      }).join('') + '</div></div>';
      h += '<div class="lk-g"><div class="lk-h">After which week? <small>the line under each = who won that week</small></div><div class="tm-weeks">' + se.weeks.map(function(w) {
        var win = w.u.Maria > w.u.Danielle ? 'Maria' : w.u.Danielle > w.u.Maria ? 'Danielle' : '';
        return '<button data-tm-w="' + w.n + '" class="' + (w.n === TM.week ? 'on' : '') + '" style="--wc:' + (win ? personColor(win) : 'var(--t4)') + '" title="' + weekName(w.n) + '">' + tmChip(w.n) + '</button>';
      }).join('') + '</div></div>';
      var t = cur.tot, lead = t.Maria > t.Danielle ? 'Maria' : t.Danielle > t.Maria ? 'Danielle' : '';
      h += '<div class="tm-prev"><div class="tm-prev-h">After ' + TM.year + ' ' + weekName(TM.week) + ' <small>' + tmWhen(TM.year, TM.week) + '</small></div>' +
        '<b style="color:' + SB_M + '">Maria ' + fmtU(t.Maria) + '</b> · <b style="color:' + SB_D + '">Danielle ' + fmtU(t.Danielle) + '</b>' +
        '<div class="tm-lead">' + (lead ? '<b style="color:' + personColor(lead) + '">' + lead + '</b> up ' + Math.abs(t.Maria - t.Danielle).toFixed(1) + ' units' : 'Dead even') + '</div></div>';
      var here = ASOF && ASOF.year === TM.year && ASOF.week === TM.week;
      h += '<div class="tm-go-row"><button class="tm-go" id="tm-go"' + (here ? ' disabled' : '') + '>' + (here ? '📍 You\'re here' : '⏳ Go back to then') + '</button>' +
        (ASOF ? '<button class="tm-go tm-go-now" onclick="asofGo()">✕ Back to now</button>' : '') + '</div>' +
        '<div class="lk-note">Nothing can be changed while you\'re back there. Share the link and it opens on the same week.</div>';
      card.innerHTML = h;
      card.querySelector('.lk-x').onclick = function() { document.getElementById('tm-back').classList.remove('open'); };
      card.querySelectorAll('[data-tm-y]').forEach(function(b) { b.onclick = function() { TM.year = b.getAttribute('data-tm-y'); TM.week = 0; tmDraw(card); }; });
      card.querySelectorAll('[data-tm-w]').forEach(function(b) { b.onclick = function() { TM.week = parseInt(b.getAttribute('data-tm-w'), 10); tmDraw(card); }; });
      var go = document.getElementById('tm-go');
      if (go && !here) go.onclick = function() { asofGo(TM.year, TM.week); };
    }
    // "Tue, Nov 4": the day after that week's last game
    function tmWhen(year, week) { return new Date(weekEnd(year, week)).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
