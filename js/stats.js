// Stats tab: the scoreboard, running units chart, weekly recap, sharing as an image, Live Picks and the live game tracker.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Weekly recap (Stats tab) ─────────────────────────────────────────────
    function weeklyRecap(rows) {
      var weeks = {};
      rows.forEach(function(b) {
        var wk = b.week, p = b.picker, hp = b.homePick, ap = b.awayPick;
        if (!wk || (p !== 'Maria' && p !== 'Danielle') || (!hp && !ap)) return;
        if (!weeks[wk]) weeks[wk] = { Maria: { w: 0, t: 0, u: 0 }, Danielle: { w: 0, t: 0, u: 0 }, pending: 0, best: null };
        var W = weeks[wk];
        var c = b.correct, nu = b.units, scorer = b.scorer;
        if (!b.scored) { W.pending++; return; }
        W[p].u += nu;
        if (b.notOffered) return;
        W[p].t++;
        if (c === 'Yes') {
          W[p].w++;
          if (!W.best || nu > W.best.u) {
            var team = scorer === hp ? b.home : scorer === ap ? b.away : '';
            var odds = scorer === hp ? b.homeOdds : scorer === ap ? b.awayOdds : '';
            W.best = { p: p, u: nu, player: scorer, team: team, odds: odds };
          }
        }
      });

      // Previous week = latest fully-scored week that comes before the current (highest) week
      var allWeeks = Object.keys(weeks).map(Number);
      if (!allWeeks.length) return '';
      var currentWeek = Math.max.apply(null, allWeeks);
      var keys = Object.keys(weeks).filter(function(k) {
        var w = weeks[k];
        return parseInt(k) < currentWeek && w.pending === 0 && w.Maria.t + w.Danielle.t > 0;
      }).sort(function(a, b) { return parseInt(b) - parseInt(a); });
      if (!keys.length) return '';

      var wk = keys[0], W = weeks[wk], M = W.Maria, D = W.Danielle;
      var live = false;
      var u = fmtU;
      var mName = '<span style="color:' + SB_M + ';font-weight:700">Maria</span>';
      var dName = '<span style="color:' + SB_D + ';font-weight:700">Danielle</span>';

      var text, accent;
      if (M.w === D.w) {
        accent = 'rgba(255,255,255,0.35)';
        if (M.w === 0) {
          text = 'Nobody hit' + (live ? ' yet' : '') + '. ' + mName + ' went 0/' + M.t + ' (' + u(M.u) + '), ' + dName + ' went 0/' + D.t + ' (' + u(D.u) + ').';
        } else {
          text = (live ? 'All square so far' : 'A tie') + ' at ' + M.w + ' correct each. ' + mName + ' went ' + M.w + '/' + M.t + ' (' + u(M.u) + '), ' + dName + ' went ' + D.w + '/' + D.t + ' (' + u(D.u) + ').';
        }
      } else {
        var mWins = M.w > D.w;
        var win = mWins ? M : D, lose = mWins ? D : M;
        accent = mWins ? SB_M : SB_D;
        text = (mWins ? mName : dName) + (live ? ' is leading the week' : ' took the week') + ', going ' + win.w + '/' + win.t + ' (' + u(win.u) + '). ' +
          (mWins ? dName : mName) + ' went ' + lose.w + '/' + lose.t + ' (' + u(lose.u) + ').';
      }
      if (W.best) {
        var pc = personColor(W.best.p);
        var player = W.best.team ? teamPill(W.best.player, W.best.team) : '<b>' + W.best.player + '</b>';
        text += ' Biggest hit: ' + player + (W.best.odds ? ' at ' + formatOdds(W.best.odds) : '') +
          ' for <span style="color:' + pc + ';font-weight:600">' + W.best.p + '</span>.';
      }

      return '<div class="sb-glass" data-share="recap-week-' + wk + '" style="position:relative;border-left:3px solid ' + accent + ';padding:12px 16px;margin-bottom:20px">' +
        '<button class="share-btn" onclick="shareCard(this)" title="Share as image">Share</button>' +
        '<div class="sb-dim" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">' + weekName(wk) + ' Recap' + (live ? ' · in progress' : '') + '</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.8">' + text + '</div></div>';
    }

    function formatOdds(val) {
      if (!val) return '—';
      const n = parseFloat(val);
      if (isNaN(n)) return '—';
      return '+' + Math.round(n * 100);
    }

    function getPickAndOdds(b) {
      if (!b) return { player: '—', odds: '—' };
      const { homePick, awayPick, homeOdds, awayOdds } = b;
      // Both picks present — show both
      if (homePick && awayPick) return { player: `${homePick} / ${awayPick}`, odds: `${formatOdds(homeOdds)} / ${formatOdds(awayOdds)}` };
      if (homePick) return { player: homePick, odds: formatOdds(homeOdds) };
      if (awayPick) return { player: awayPick, odds: formatOdds(awayOdds) };
      return { player: '—', odds: '—' };
    }

    async function load() {
      try {
        const rows = readBets(await fetchSheet('Winnings', 'A1:Q400')).filter(b => b.game && b.picker);
        const counts = (b) => b.scored && !b.notOffered; // a real win or loss

        let mCorrect = 0, mTotal = 0, dCorrect = 0, dTotal = 0;
        for (const b of rows) {
          if (!counts(b)) continue;
          if (b.picker === 'Maria') { mTotal++; if (b.correct === 'Yes') mCorrect++; }
          else if (b.picker === 'Danielle') { dTotal++; if (b.correct === 'Yes') dCorrect++; }
        }

        // Current streak per person (not-offered games skipped)
        function getCurrentStreak(picker) {
          const personBets = rows.filter(b => b.picker === picker && (b.homePick || b.awayPick) && counts(b));
          if (!personBets.length) return { count: 0, type: null };
          const type = personBets[personBets.length - 1].correct === 'Yes' ? 'win' : 'loss';
          let count = 0;
          for (let i = personBets.length - 1; i >= 0; i--) {
            if ((personBets[i].correct === 'Yes' ? 'win' : 'loss') === type) count++;
            else break;
          }
          return { count, type };
        }
        const mariaStreak = getCurrentStreak('Maria');
        const danielleStreak = getCurrentStreak('Danielle');

        // Combined streak: increases when at least one person wins, breaks only when BOTH lose
        function getCombinedStreak() {
          const gameMap = {};
          rows.forEach(b => {
            if (!b.homePick || !counts(b)) return;
            const gameKey = b.game + '_' + b.week + '_' + b.home + '_' + b.away;
            if (!gameMap[gameKey]) gameMap[gameKey] = { order: Object.keys(gameMap).length };
            gameMap[gameKey][b.picker] = b.correct;
          });
          const both = Object.values(gameMap)
            .filter(g => g.Maria && g.Danielle)
            .sort((a, b) => a.order - b.order);
          if (!both.length) return { count: 0, type: null };
          // A game is a "combined win" if at least one person got it right; "combined loss" only if both wrong
          const gameType = g => (g.Maria === 'Yes' || g.Danielle === 'Yes') ? 'win' : 'loss';
          const lastType = gameType(both[both.length - 1]);
          let count = 0;
          for (let i = both.length - 1; i >= 0; i--) {
            if (gameType(both[i]) === lastType) count++;
            else break;
          }
          return { count, type: lastType };
        }
        const combinedStreak = getCombinedStreak();

        // Units/dollars from scored games
        let mariaUnits = 0, danielleUnits = 0, mariaDollars = 0, danielleDollars = 0;
        for (const b of rows) {
          if (!b.scored) continue;
          if (b.picker === 'Maria') { mariaUnits += b.units; mariaDollars += b.dollars; }
          else if (b.picker === 'Danielle') { danielleUnits += b.units; danielleDollars += b.dollars; }
        }

        // Leader banner
        const banner = document.getElementById('leader-banner');
        banner.style.display = 'block';
        document.getElementById('sb-main').className = 'sb ' +
          (mariaUnits > danielleUnits ? 'sb-maria' : danielleUnits > mariaUnits ? 'sb-danielle' : '');
        if (mariaUnits > danielleUnits) {
          banner.innerHTML = `<span>Maria</span> is leading by ${(mariaUnits - danielleUnits).toFixed(1)} units`;
        } else if (danielleUnits > mariaUnits) {
          banner.innerHTML = `<span>Danielle</span> is leading by ${(danielleUnits - mariaUnits).toFixed(1)} units`;
        } else {
          banner.innerHTML = `It's <span>tied</span>`;
        }
        renderWinProb(rows); // insights.js

        // Stats
        const statsEl = document.getElementById('stats-section');
        // Weeks won: only complete weeks count
        const weekWins = {};
        for (const b of rows) {
          const correct = b.correct, picker = b.picker, homePick = b.homePick, wk = b.week;
          if (!wk) continue;
          if (!weekWins[wk]) weekWins[wk] = { Maria: 0, Danielle: 0, total: 0, incomplete: false };
          if (homePick && !correct) weekWins[wk].incomplete = true;
          if (correct === 'Yes') { weekWins[wk][picker] = (weekWins[wk][picker] || 0) + 1; }
          if ((correct === 'Yes' || correct === 'No') && homePick) weekWins[wk].total++;
        }
        let mariaWeeksWon = 0, danielleWeeksWon = 0, tiedWeeks = 0;
        Object.values(weekWins).forEach(function(w) {
          if (w.total === 0 || w.incomplete) return;
          if (w.Maria > w.Danielle) mariaWeeksWon++;
          else if (w.Danielle > w.Maria) danielleWeeksWon++;
          else tiedWeeks++;
        });

        statsEl.innerHTML = `
          ${weeklyRecap(rows)}
          <div class="streak-line">${[
            mariaStreak.count > 0 ? '<span style="color:' + SB_M + '">Maria ' + (mariaStreak.type === 'win' ? '🔥' : '❄️') + ' ' + mariaStreak.count + (mariaStreak.type === 'win' ? 'W' : 'L') + '</span>' : '',
            danielleStreak.count > 0 ? '<span style="color:' + SB_D + '">Danielle ' + (danielleStreak.type === 'win' ? '🔥' : '❄️') + ' ' + danielleStreak.count + (danielleStreak.type === 'win' ? 'W' : 'L') + '</span>' : '',
            combinedStreak.count > 0 ? '<span title="At least one of them right">Combined ' + (combinedStreak.type === 'win' ? '🔥' : '❄️') + ' ' + combinedStreak.count + (combinedStreak.type === 'win' ? 'W' : 'L') + '</span>' : ''
          ].filter(Boolean).join('<i>·</i>')}</div>

          <div class="sb-weeks" style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;background:rgba(255,255,255,0.07);border-radius:12px;padding:12px;flex-wrap:wrap">
            <div style="text-align:center"><div style="font-size:24px;font-weight:800;color:${SB_M}">${mariaWeeksWon}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.08em">Maria weeks won</div></div>
            <div style="text-align:center"><div style="font-size:24px;font-weight:800;color:rgba(255,255,255,0.75)">${tiedWeeks}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.08em">Tied</div></div>
            <div style="text-align:center"><div style="font-size:24px;font-weight:800;color:${SB_D}">${danielleWeeksWon}</div><div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.08em">Danielle weeks won</div></div>
          </div>
          <div class="sb-grid">
          ${statBlock('Correct', mCorrect, dCorrect, `${mCorrect}/${mTotal}`, `${dCorrect}/${dTotal}`)}
          ${statBlock('Accuracy', mCorrect / (mTotal || 1), dCorrect / (dTotal || 1), pct(mCorrect, mTotal), pct(dCorrect, dTotal))}
          ${statBlock('Units', mariaUnits, danielleUnits, shortU(mariaUnits).replace('u', ''), shortU(danielleUnits).replace('u', ''))}
          ${statBlock('Dollars', mariaDollars, danielleDollars, shortD(mariaDollars), shortD(danielleDollars))}
          </div>`;

        // Live picks — show all pending games
        const liveEl = document.getElementById('live-picks');
        const pendingRows = rows.filter(b => !b.scorer && b.homePick && b.awayPick);
        if (pendingRows.length === 0) {
          liveEl.innerHTML = '<div class="no-live">No pending picks — all games have been scored.</div>';
        } else {
          // Group by game number
          const pendingGames = [...new Set(pendingRows.map(b => b.game))];
          let html = '';
          for (const gameNum of pendingGames) {
            const gameRows = pendingRows.filter(b => b.game === gameNum);
            const mariaRow = gameRows.find(b => b.picker === 'Maria');
            const danielleRow = gameRows.find(b => b.picker === 'Danielle');
            const homeTeamName = (mariaRow || danielleRow || {}).home || '';
            const awayTeamName = (mariaRow || danielleRow || {}).away || '';
            const homeC = teamColor(homeTeamName);
            const awayC = teamColor(awayTeamName);

            // Only one person has picked: keep their picks secret until the other submits
            if (!mariaRow || !danielleRow) {
              const done = mariaRow ? 'Maria' : 'Danielle';
              const waiting = mariaRow ? 'Danielle' : 'Maria';
              const doneC = personColor(done);
              const waitC = personColor(waiting);
              html += `<div class="live-game" data-wg="${(mariaRow || danielleRow).week}_${gameNum}" style="margin-top:${html ? '22px' : '0'}">
              <div class="live-game-title">
                ${teamPill(homeTeamName, homeTeamName)}
                <span style="color:rgba(255,255,255,0.45)"> vs </span>
                ${teamPill(awayTeamName, awayTeamName)}
              </div>
              <div class="live-strip" data-home="${homeTeamName}" data-away="${awayTeamName}"></div>
              <div style="background:rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px;font-size:13px;color:rgba(255,255,255,0.7)">
                🔒 <span style="color:${doneC};font-weight:600">${done}</span> has picked. Waiting on
                <span style="color:${waitC};font-weight:600">${waiting}</span>. Picks show once both are in.
              </div></div>`;
              continue;
            }
            const mariaPick = getPickAndOdds(mariaRow);
            const daniellePick = getPickAndOdds(danielleRow);

            function coloredPick(pickStr) {
              if (!pickStr || pickStr === '—') return pickStr;
              var parts = pickStr.split(' / ');
              var colored = parts.map(function(p, i) {
                return '<span class="lp-pick" data-player="' + p.replace(/"/g, '&quot;') + '">' + headshot(p, i === 0 ? homeTeamName : awayTeamName, 26) + teamPill(p, i === 0 ? homeTeamName : awayTeamName) + '</span>';
              });
              return colored.join('<br>');
            }

            const revealKey = mariaRow.week + '_' + gameNum + '_' + homeTeamName;
            html += `<div class="live-game" data-reveal="${revealKey}" data-wg="${mariaRow.week}_${gameNum}" style="margin-top:${html ? '22px' : '0'}">
              <div class="live-game-title">
                ${teamPill(homeTeamName, homeTeamName)}
                <span style="color:rgba(255,255,255,0.45)"> vs </span>
                ${teamPill(awayTeamName, awayTeamName)}
              </div>
              <div class="live-strip" data-home="${homeTeamName}" data-away="${awayTeamName}"></div>
              <div class="live-picks-grid">
                <div class="live-pick-card maria">
                  <div class="picker-label">Maria</div>
                  <div class="pick-player">${coloredPick(mariaPick.player)}</div>
                  <div class="pick-odds">${mariaPick.odds}</div>
                </div>
                <div class="live-pick-card danielle">
                  <div class="picker-label">Danielle</div>
                  <div class="pick-player">${coloredPick(daniellePick.player)}</div>
                  <div class="pick-odds">${daniellePick.odds}</div>
                </div>
              </div></div>`;
          }
          liveEl.innerHTML = html;
          fillHeadshots(liveEl);
          playPickReveals(liveEl);
          addCrowdLines(liveEl);
          if (typeof addPickPreview === 'function') addPickPreview(liveEl);
          startLiveTracker();
          // A game is still waiting on someone's picks: check back every minute so the reveal can happen live
          clearInterval(window.REVEAL_POLL);
          if (html.indexOf('has picked. Waiting on') >= 0) {
            window.REVEAL_POLL = setInterval(function() {
              if (document.visibilityState === 'visible' && document.getElementById('tab-stats').classList.contains('active')) { clearSheetCache(); load(); }
            }, 60000);
          }
        }



        renderFirstTDs(rows);
        renderHistory(rows);
        renderVisitBanner(rows);
        if (!VISIT.trophiesChecked) { VISIT.trophiesChecked = true; setTimeout(checkNewTrophies, 400); }

        if (navigator.onLine) {
          try { localStorage.setItem('mvd-last-online', String(Date.now())); } catch (e) {}
          document.getElementById('last-updated').textContent = `Last refreshed ${new Date().toLocaleString()}`;
        } else {
          showOfflineNote();
        }

      } catch (e) {
        console.error(e);
        document.getElementById('last-updated').textContent = 'Error loading data — check console';
      }
    }



    // ── Share as image (weekly recap + Season Wrapped) ──────────────────────
    function loadHtml2Canvas() {
      if (window.html2canvas) return Promise.resolve();
      return new Promise(function(resolve, reject) {
        var sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        sc.onload = resolve;
        sc.onerror = function() { reject(new Error('Could not load the image tool')); };
        document.head.appendChild(sc);
      });
    }

    async function shareCard(btn) {
      var card = btn.closest('[data-share]');
      if (!card || btn.disabled) return;
      var name = 'maria-vs-danielle-' + card.getAttribute('data-share') + '.png';
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await loadHtml2Canvas();
        // The recap sits on a see-through panel, so give the picture the scoreboard's background
        var sb = card.closest('.sb');
        var bg = sb ? getComputedStyle(sb).backgroundImage : 'none';
        var canvas = await html2canvas(card, {
          backgroundColor: '#0B0C10',
          scale: 2,
          useCORS: true,
          ignoreElements: function(n) { return n.classList && (n.classList.contains('share-btn') || n.classList.contains('no-share')); },
          onclone: function(doc) {
            var c = doc.querySelector('[data-share="' + card.getAttribute('data-share') + '"]');
            if (c && sb) { c.style.backgroundImage = bg; c.style.margin = '0'; }
          },
        });
        var blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png'); });
        var file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Maria vs Danielle' });
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);
        }
        btn.textContent = 'Saved ✓';
      } catch (e) {
        if (e && e.name === 'AbortError') btn.textContent = label; // closed the share sheet
        else { console.error(e); btn.textContent = 'Try again'; }
      }
      setTimeout(function() { btn.textContent = label; btn.disabled = false; }, 1800);
    }

    // ── Pick reveal ─────────────────────────────────────────────────────────
    // ── This Week's First TDs ─────────────────────────────────────────────────
    // Shows the latest week that has a first scorer. It flips to the next week once
    // that week's first game is scored, so last week stays up until Thursday night.
    var FTD = { rows: null, week: 0, picked: false };
    // A tappable team (opens the team card)
    function tmTag(team, inner) { var r = resolveTeam(team); return TEAM_COLORS[r] ? '<span class="tm-link" data-team="' + escHtml(r) + '">' + inner + '</span>' : inner; }
    function renderFirstTDs(rows, pickWeek) {
      var wrap = document.getElementById('ftd-wrap');
      if (!wrap) return;
      var weeks = rows.filter(function(b) { return b.scorer; }).map(function(b) { return b.weekN; });
      if (!weeks.length) { wrap.style.display = 'none'; return; }
      var latest = Math.max.apply(null, weeks);
      var allWeeks = rows.filter(function(b) { return b.home; }).map(function(b) { return b.weekN; })
        .filter(function(w, i, a) { return w && a.indexOf(w) === i; }).sort(function(a, b) { return a - b; });
      FTD.rows = rows;
      if (pickWeek) { FTD.week = pickWeek; FTD.picked = pickWeek !== latest; }
      // Auto-refreshes keep the week you're looking at; otherwise follow the latest week
      var week = (FTD.picked && allWeeks.indexOf(FTD.week) >= 0) ? FTD.week : latest;
      FTD.week = week;
      var G = {}, order = [];
      rows.forEach(function(b) {
        if (b.weekN !== week || !b.home) return;
        var k = b.game;
        var g = G[k] || (G[k] = (order.push(k), { game: k, slot: b.slot, home: b.home, away: b.away, scorer: '', side: '', md: {}, notOffered: false }));
        if (b.scorer) { g.scorer = b.scorer; g.side = b.side; }
        if (b.notOffered) g.notOffered = true;
        if (b.picker === 'Maria' || b.picker === 'Danielle') g.md[b.picker] = b.correct;
      });
      var done = order.filter(function(k) { return G[k].scorer; }).length;
      var wi = allWeeks.indexOf(week);
      var prevW = wi > 0 ? allWeeks[wi - 1] : 0, nextW = wi >= 0 && wi < allWeeks.length - 1 ? allWeeks[wi + 1] : 0;
      var title = document.getElementById('ftd-title');
      title.innerHTML = '<div class="ftd-nav"><button data-ftd-w="' + prevW + '"' + (prevW ? '' : ' disabled') + ' aria-label="Previous week">‹</button>' +
        '<span>🏈 ' + weekName(week) + ' First Touchdowns' + (week !== latest ? '<button class="ftd-latest" data-ftd-w="' + latest + '">Latest</button>' : '') + '</span>' +
        '<button data-ftd-w="' + nextW + '"' + (nextW ? '' : ' disabled') + ' aria-label="Next week">›</button></div>';
      title.querySelectorAll('[data-ftd-w]').forEach(function(b) {
        b.addEventListener('click', function() { var w = +b.getAttribute('data-ftd-w'); if (w) renderFirstTDs(FTD.rows, w); });
      });
      var h = '<div class="ftd-sub">' + done + ' of ' + order.length + ' game' + (order.length === 1 ? '' : 's') + ' scored</div>';
      order.forEach(function(k) {
        var g = G[k];
        var ab = function(t) { return (TEAM_ABBR[resolveTeam(t)] || resolveTeam(t).split(' ').pop()).toUpperCase(); };
        h += '<div class="ftd-row" data-ftd="' + escHtml(k) + '" data-ctx-year="' + CURRENT_YEAR + '" data-ctx-week="' + week + '"><div class="ftd-top"><span class="ftd-slot">' + escHtml(g.slot) + '</span>' +
          '<span class="ftd-teams">' + tmTag(g.home, teamLogo(g.home) + ab(g.home)) + ' <span style="color:rgba(255,255,255,0.4)">vs</span> ' + tmTag(g.away, teamLogo(g.away) + ab(g.away)) + '</span></div>';
        if (g.scorer) {
          var team = /^home$/i.test(g.side) ? g.home : /^away$/i.test(g.side) ? g.away : '';
          var hits = ['Maria', 'Danielle'].filter(function(n) { return g.md[n] === 'Yes'; });
          var who = g.notOffered ? 'Not offered, so no bet counted'
            : hits.length ? hits.map(function(n) { return '<span class="hit" style="color:' + (personColor(n)) + '">✅ ' + n + '</span>'; }).join(' & ') + ' had him'
            : 'Nobody had him';
          h += '<div class="ftd-scorer">' + (team ? headshot(g.scorer, team, 34) : '🏈 ') + '<div class="ftd-sc-txt">' + (team ? teamPill(escHtml(g.scorer), team) : '<b>' + escHtml(g.scorer) + '</b>') +
            '<div class="ftd-who">' + who + '<span class="ftd-friends"></span></div></div></div>';
        } else {
          h += '<div class="ftd-wait" data-home="' + escHtml(g.home) + '" data-away="' + escHtml(g.away) + '">⏳ Not played yet</div>';
        }
        h += '</div>';
      });
      document.getElementById('ftd-list').innerHTML = h;
      fillHeadshots(document.getElementById('ftd-list'));
      wrap.style.display = '';

      // Friends who had the scorer (only picks revealed at kickoff are public)
      if (typeof getCrowd === 'function') getCrowd().then(function(crowd) {
        order.forEach(function(k) {
          var g = G[k]; if (!g.scorer) return;
          var sk = playerKey(g.scorer);
          var n = (crowd.picks || []).filter(function(p) { return String(p.week) === String(week) && String(p.game) === k && (playerKey(p.homePick) === sk || playerKey(p.awayPick) === sk); }).length;
          var el = document.querySelector('[data-ftd="' + k + '"] .ftd-friends');
          if (el && n) el.textContent = ' · 👥 ' + n + ' friend' + (n > 1 ? 's' : '') + ' had him';
        });
      }).catch(function() {});

      // Kickoff times for games not played yet
      var waits = document.querySelectorAll('#ftd-list .ftd-wait');
      if (!waits.length) return;
      var path = week > 18 ? 'scoreboard?dates=' + CURRENT_YEAR + '&seasontype=3&week=' + (week - 18) : 'scoreboard?dates=' + CURRENT_YEAR + '&seasontype=2&week=' + week;
      espnGet(path).then(function(board) {
        var events = board.events || [];
        waits.forEach(function(el) {
          var hk = espnTeamKey(el.getAttribute('data-home')), ak = espnTeamKey(el.getAttribute('data-away'));
          var ev = events.filter(function(e) {
            var ts = (((e.competitions || [])[0] || {}).competitors || []).map(function(c) { return espnTeamKey(c.team && c.team.displayName); });
            return ts.indexOf(hk) >= 0 && ts.indexOf(ak) >= 0;
          })[0];
          if (!ev) return;
          var state = ev.status && ev.status.type && ev.status.type.state;
          if (state === 'in') el.textContent = '🔴 Live now, no touchdown yet';
          else if (state === 'post') el.textContent = '⏳ Final, waiting on the sheet';
          else el.textContent = '⏳ ' + new Date(ev.date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        });
      }).catch(function() {});
    }

    // ── 📅 This Week in History: the same week number in every past season ──
    var HIST = { week: 0 };
    function renderHistory(rows) {
      var wrap = document.getElementById('hist-wrap');
      if (!wrap || typeof loadAllBets !== 'function') return;
      // "This week" = the earliest week that still has games to score, else the latest week
      var open = rows.filter(function(b) { return b.home && !b.scorer; }).map(function(b) { return b.weekN; }).filter(Boolean);
      var all = rows.map(function(b) { return b.weekN; }).filter(Boolean);
      var week = open.length ? Math.min.apply(null, open) : all.length ? Math.max.apply(null, all) : 0;
      if (!week || week === HIST.week) return;
      HIST.week = week;
      loadAllBets().then(function(bets) {
        var years = {};
        bets.forEach(function(b) {
          if (b.year === CURRENT_YEAR || parseInt(b.year, 10) > parseInt(CURRENT_YEAR, 10) || b.week !== week) return;
          if (b.picker !== 'Maria' && b.picker !== 'Danielle') return;
          (years[b.year] = years[b.year] || []).push(b);
        });
        var ys = Object.keys(years).sort(function(a, b) { return b - a; });
        if (!ys.length) { wrap.style.display = 'none'; var w0 = document.getElementById('hist-wrap2'); if (w0) w0.classList.remove('on'); return; }
        function c(n) { return personColor(n); }
        var u = fmtU; // +5.0u, same as everywhere else
        var h = '';
        ys.forEach(function(y) {
          var list = years[y], ago = parseInt(CURRENT_YEAR, 10) - parseInt(y, 10);
          var units = { Maria: 0, Danielle: 0 }, hits = [], scorers = {};
          list.forEach(function(b) {
            units[b.picker] += b.netUnits;
            if (b.firstScorer) scorers[b.firstScorer] = b.slot;
            if (b.correct === 'Yes' && !b.notOffered) {
              var odds = b.firstScorer === b.homePick ? b.homeOdds : b.firstScorer === b.awayPick ? b.awayOdds : Math.max(b.homeOdds, b.awayOdds);
              var team = b.firstScorer === b.homePick ? b.homeTeam : b.firstScorer === b.awayPick ? b.awayTeam : '';
              hits.push({ who: b.picker, name: b.firstScorer, odds: odds, team: team, slot: b.slot });
            }
          });
          hits.sort(function(a, b) { return b.odds - a.odds; });
          var winner = units.Maria > units.Danielle ? 'Maria' : units.Danielle > units.Maria ? 'Danielle' : '';
          h += '<div class="hist-yr" data-ctx-year="' + y + '" data-ctx-week="' + week + '"><div class="hist-ago">' + (ago === 1 ? '1 year ago' : ago + ' years ago') + ' · ' + y + ' ' + weekName(week) + '</div>';
          if (hits.length) {
            h += hits.slice(0, 3).map(function(x) {
              return '<div class="hist-hit">' + (x.team ? headshot(x.name, x.team, 30) : '') + '<span><b style="color:' + c(x.who) + '">' + x.who + '</b> hit ' +
                (x.team ? teamPill(escHtml(x.name), x.team) : '<b>' + escHtml(x.name) + '</b>') + ' <span class="hist-odds">+' + Math.round(x.odds * 100) + (x.slot ? ' · ' + escHtml(x.slot) : '') + '</span></span></div>';
            }).join('');
          } else {
            var sc = Object.keys(scorers);
            h += '<div class="hist-miss">Nobody hit.' + (sc.length ? ' First TDs: ' + sc.slice(0, 4).map(escHtml).join(', ') + '.' : '') + '</div>';
          }
          h += '<div class="hist-wk">' + (winner ? '<b style="color:' + c(winner) + '">' + winner + '</b> won the week · ' : 'Even week · ') +
            '<span style="color:' + SB_M + '">Maria ' + u(units.Maria) + '</span> · <span style="color:' + SB_D + '">Danielle ' + u(units.Danielle) + '</span></div></div>';
        });
        document.getElementById('hist-title').textContent = '📅 ' + weekName(week) + ' in History';
        var list = document.getElementById('hist-list');
        list.innerHTML = h;
        fillHeadshots(list);
        wrap.style.display = '';
        // Same card on the Stats tab, shown only on big screens (CSS)
        var w2 = document.getElementById('hist-wrap2');
        if (w2) {
          document.getElementById('hist-title2').textContent = '📅 ' + weekName(week) + ' in History';
          var l2 = document.getElementById('hist-list2');
          l2.innerHTML = h; fillHeadshots(l2);
          w2.classList.add('on');
        }
      }).catch(function() {});
    }

    // ── Big screens: keep the two Stats columns about the same height ───────
    // Tries the stat boxes stacked or 2×2, and This Week in History on the right or under the scoreboard,
    // and keeps whichever leaves the smallest difference. The last card of the shorter column stretches
    // to cover what's left (its content centered). Phones and laptops are never touched.
    var BAL = { busy: false, timer: 0, key: '' };
    function balanceStats() {
      var tab = document.getElementById('tab-stats'), main = tab && tab.querySelector('.stats-main'), side = tab && tab.querySelector('.stats-side');
      var hist = document.getElementById('hist-wrap2');
      if (!main || !side || !hist) return;
      var wide = window.matchMedia('(min-width: 1440px)').matches;
      BAL.busy = true;
      try {
        if (!wide || !tab.classList.contains('active')) {
          if (!wide) { // back to the plain layout
            tab.classList.remove('tiles-2x2', 'measuring');
            if (hist.parentNode !== side) side.appendChild(hist);
            tab.querySelectorAll('.sb.grow').forEach(function(x) { x.classList.remove('grow'); });
          }
          return;
        }
        tab.querySelectorAll('.sb.grow').forEach(function(x) { x.classList.remove('grow'); });
        tab.classList.add('measuring');
        var histOn = hist.classList.contains('on');
        var opts = [];
        [false, true].forEach(function(grid) {
          (histOn ? ['right', 'left'] : ['right']).forEach(function(where) {
            tab.classList.toggle('tiles-2x2', grid);
            if (where === 'left' && hist.parentNode !== main) main.appendChild(hist);
            if (where === 'right' && hist.parentNode !== side) side.appendChild(hist);
            var d = Math.abs(main.getBoundingClientRect().height - side.getBoundingClientRect().height);
            opts.push({ grid: grid, where: where, d: d, key: grid + where });
          });
        });
        // Best fit, but stay put unless another layout is clearly better (so live updates don't make it jump)
        opts.sort(function(a, b) { return a.d - b.d; });
        var pick = opts[0], cur = opts.filter(function(o) { return o.key === BAL.key; })[0];
        if (cur && cur.d - pick.d < 40) pick = cur;
        BAL.key = pick.key;
        tab.classList.toggle('tiles-2x2', pick.grid);
        if (pick.where === 'left' && hist.parentNode !== main) main.appendChild(hist);
        if (pick.where === 'right' && hist.parentNode !== side) side.appendChild(hist);
        var mh = main.getBoundingClientRect().height, sh = side.getBoundingClientRect().height;
        tab.classList.remove('measuring');
        var shorter = mh < sh ? main : side;
        var cards = [].filter.call(shorter.children, function(x) { return x.classList.contains('sb') && x.offsetHeight > 0; });
        if (cards.length) cards[cards.length - 1].classList.add('grow');
      } finally {
        if (BAL.obs) BAL.obs.takeRecords(); // ignore our own changes
        if (BAL.obs2) BAL.obs2.takeRecords();
        BAL.busy = false;
      }
    }
    function queueBalance() { clearTimeout(BAL.timer); BAL.timer = setTimeout(balanceStats, 150); }
    (function() {
      var tab = document.getElementById('tab-stats');
      if (!tab || typeof MutationObserver === 'undefined') return;
      BAL.obs = new MutationObserver(function() { if (!BAL.busy) queueBalance(); });
      BAL.obs.observe(tab, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'src'] });
      // Switching to Stats (it can't be measured while hidden)
      BAL.wasActive = tab.classList.contains('active');
      BAL.obs2 = new MutationObserver(function() {
        var on = tab.classList.contains('active');
        if (on && !BAL.wasActive) queueBalance();
        BAL.wasActive = on;
      });
      BAL.obs2.observe(tab, { attributes: true, attributeFilter: ['class'] });
      window.addEventListener('resize', queueBalance);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueBalance);
      tab.addEventListener('load', queueBalance, true); // headshots finishing can change heights
    })();

    // ── "Since your last visit" ──────────────────────────────────────────────
    // Each phone remembers which games were already scored the last time it opened the site.
    var VISIT = { shown: false, parts: [], chat: 0 };
    function renderVisitBanner(rows) {
      var G = {}, order = [];
      rows.forEach(function(b) {
        var sc = b.scorer; if (!sc) return;
        var k = CURRENT_YEAR + '_' + b.week + '_' + b.game;
        var g = G[k] || (G[k] = (order.push(k), { week: b.weekN, scorer: sc, hits: [] }));
        var who = b.picker;
        if ((who === 'Maria' || who === 'Danielle') && b.correct === 'Yes' && !b.notOffered) {
          g.hits.push({ who: who, odds: formatOdds(sc === b.homePick ? b.homeOdds : b.awayOdds) });
        }
      });
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('mvd-visit') || 'null'); } catch (e) {}
      try { localStorage.setItem('mvd-visit', JSON.stringify({ scored: order, at: Date.now() })); } catch (e) {}
      if (VISIT.shown) return;          // only once per page view
      VISIT.shown = true;
      if (!saved || !saved.scored) return; // first visit on this phone: nothing to compare yet
      var fresh = order.filter(function(k) { return saved.scored.indexOf(k) < 0; });
      var hits = [];
      fresh.forEach(function(k) { G[k].hits.forEach(function(h) { hits.push('<b style="color:' + (personColor(h.who)) + '">' + h.who + '</b> hit <b>' + escHtml(G[k].scorer) + '</b> (' + h.odds + ')'); }); });
      var parts = hits.slice(0, 3);
      if (hits.length > 3) parts.push('+' + (hits.length - 3) + ' more hits');
      if (fresh.length) parts.push(fresh.length + ' game' + (fresh.length > 1 ? 's' : '') + ' scored' + (hits.length ? '' : ', nobody hit'));
      VISIT.parts = parts;
      VISIT.since = saved.at;
      drawVisitBanner();
    }
    // ── 🏆 New trophy alert: badges Maria or Danielle unlocked since this phone last looked ──
    // (The two bad-beat badges need ESPN lookups, so they're left out here.)
    function checkNewTrophies() {
      if (typeof loadAllBets !== 'function') return;
      loadAllBets().then(function(all) {
        var jx = computeJinxes(all), now = {};
        ['Maria', 'Danielle'].forEach(function(who) {
          now[who] = achievementsFor(profileStats(who, all, jx, null))
            .filter(function(a) { return a.got && a.n !== 'Heartbreaker' && a.n !== 'Snakebitten'; })
            .map(function(a) { return { k: a.n, ic: a.ic, shame: !!a.shame }; });
        });
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem('mvd-trophies') || 'null'); } catch (e) {}
        try { localStorage.setItem('mvd-trophies', JSON.stringify({ Maria: now.Maria.map(function(a) { return a.k; }), Danielle: now.Danielle.map(function(a) { return a.k; }) })); } catch (e) {}
        if (!saved) return; // first look on this phone
        var news = [];
        ['Maria', 'Danielle'].forEach(function(who) {
          now[who].forEach(function(a) {
            if ((saved[who] || []).indexOf(a.k) >= 0) return;
            news.push('<b style="color:' + (personColor(who)) + '">' + who + '</b> ' + (a.shame ? 'earned' : 'unlocked') + ' ' + a.ic + ' <b>' + a.k + '</b>' + (a.shame ? ' 🤡' : ''));
          });
        });
        if (news.length > 3) news = news.slice(0, 3).concat(['+' + (news.length - 3) + ' more trophies (see Profiles)']);
        if (typeof checkNewRecords === 'function') news = checkNewRecords(all).concat(news); // 🚨 records broken
        if (!news.length) return;
        VISIT.parts = VISIT.parts.concat(news);
        if (!VISIT.since) VISIT.since = Date.now();
        drawVisitBanner();
      }).catch(function() {});
    }

    // ── 📣 Announcement (posted by admin) ───────────────────────────────────
    function loadAnnouncement() {
      var el = document.getElementById('announce-banner');
      if (!el) return;
      function draw(a) {
        var closed = ''; try { closed = localStorage.getItem('mvd-announce-closed') || ''; } catch (e) {}
        if (!a || !a.text || closed === a.id) { el.style.display = 'none'; return; }
        el.innerHTML = '📣 ' + escHtml(a.text) + '<button class="vb-x" aria-label="Dismiss">✕</button>';
        el.style.display = '';
        el.querySelector('.vb-x').addEventListener('click', function() {
          try { localStorage.setItem('mvd-announce-closed', a.id); } catch (e) {}
          el.style.display = 'none';
        });
      }
      var cached = null; try { cached = JSON.parse(localStorage.getItem('mvd-announce') || 'null'); } catch (e) {}
      if (cached) draw(cached);
      if (!PICKS_URL) return;
      picksApi({ action: 'site' }).then(function(r) {
        try { localStorage.setItem('mvd-announce', JSON.stringify(r.announce || null)); } catch (e) {}
        draw(r.announce);
        applyMyTheme(r.themes || {});
      }).catch(function() {});
    }

    // ── Theme admin gave this phone's person ─────────────────────────────────
    function rememberMe(name) {
      var before = ''; try { before = localStorage.getItem('mvd-me') || ''; localStorage.setItem('mvd-me', name); } catch (e) {}
      if (before !== name) { var r = SITE_CACHE.themes; if (r) applyMyTheme(r); }
    }
    var SITE_CACHE = { themes: null };
    function applyMyTheme(themes) {
      SITE_CACHE.themes = themes;
      var me = '', had = '';
      try { me = localStorage.getItem('mvd-me') || ''; had = localStorage.getItem('mvd-theme-mine') || ''; } catch (e) {}
      var want = (me && themes[me]) || '';
      if (want === had) return;
      try { if (want) localStorage.setItem('mvd-theme-mine', want); else localStorage.removeItem('mvd-theme-mine'); } catch (e) {}
      // Reload once so the new theme takes over (skipped while admin is previewing a theme)
      if (window.HOLIDAY_FORCED || /[?&]theme=/.test(location.search)) return;
      var guard = ''; try { guard = sessionStorage.getItem('mvd-theme-reload') || ''; } catch (e) {}
      if (guard === want + '|' + me) return;
      try { sessionStorage.setItem('mvd-theme-reload', want + '|' + me); } catch (e) {}
      if (!SUB.pin) location.reload();
    }

    function drawVisitBanner() {
      var el = document.getElementById('visit-banner');
      if (!el || VISIT.closed) return;
      var parts = VISIT.parts.slice();
      if (VISIT.chat) parts.push('<span class="vb-chat" data-vb-chat="1">' + VISIT.chat + ' new Trash Talk message' + (VISIT.chat > 1 ? 's' : '') + '</span>');
      if (!parts.length) { el.style.display = 'none'; return; }
      var since = VISIT.since ? new Date(VISIT.since).toLocaleDateString([], { weekday: 'long' }) : '';
      var today = new Date().toLocaleDateString([], { weekday: 'long' });
      el.innerHTML = '<div class="vb-k">👋 Since your last visit' + (since && since !== today ? ' (' + since + ')' : '') + '</div>' + parts.join(' · ') +
        '<button class="vb-x" aria-label="Dismiss">✕</button>';
      el.style.display = '';
      el.querySelector('.vb-x').addEventListener('click', function() { VISIT.closed = true; el.style.display = 'none'; });
      var c = el.querySelector('[data-vb-chat]');
      if (c) c.addEventListener('click', function() { switchTab('chat'); });
    }

    function playPickReveals(root) {
      var seen = {};
      try { seen = JSON.parse(localStorage.getItem('mvd-revealed') || '{}'); } catch (e) {}
      var changed = false;
      root.querySelectorAll('.live-game[data-reveal]').forEach(function(g) {
        var k = g.getAttribute('data-reveal');
        if (seen[k]) return;
        seen[k] = Date.now();
        changed = true;
        g.classList.add('revealing');
        g.querySelector('.live-picks-grid').insertAdjacentHTML('beforebegin', '<div class="reveal-banner">🔓 PICKS REVEALED</div>');
        setTimeout(function() {
          g.classList.remove('revealing');
          var b = g.querySelector('.reveal-banner'); if (b) b.remove();
        }, 2800);
      });
      if (changed) { try { localStorage.setItem('mvd-revealed', JSON.stringify(seen)); } catch (e) {} }
    }

    // ── Live game tracker (Live Picks) ──────────────────────────────────────
    // Reads ESPN's public scoreboard in the browser. If ESPN can't be reached,
    // the strips simply stay hidden and Live Picks works as before.
    var LIVE = { timer: null, firstTD: {}, celebrated: {} };
    var ESPN_HOSTS = [
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/',
      'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/',
    ];

    async function espnGet(path) {
      for (var i = 0; i < ESPN_HOSTS.length; i++) {
        try {
          var res = await fetch(ESPN_HOSTS[i] + path, { cache: 'no-store' });
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      throw new Error('ESPN unreachable');
    }

    function espnTeamKey(name) {
      var n = (resolveTeam(name) || '').toLowerCase();
      if (/buc|tampa/.test(n)) return 'buccaneers';
      if (/niner|49/.test(n)) return '49ers';
      return n.trim().split(/\s+/).pop();
    }

    function normName(n) {
      return (n || '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
    }

    // Does ESPN's scorer name ("Jaylen Warren" or "J.Warren") match a pick?
    function sameScorer(espnName, pick) {
      if (normName(espnName) === normName(pick)) return true;
      var m = (espnName || '').match(/^([A-Za-z]{1,2})\.\s?(.+)$/);
      if (!m) return false;
      var parts = pick.replace(/\b(Jr|Sr|II|III|IV|V)\b\.?/g, '').trim().split(/\s+/);
      return parts.length > 1 && normName(parts.slice(1).join(' ')) === normName(m[2]) &&
        parts[0].toLowerCase().indexOf(m[1].toLowerCase()) === 0;
    }

    function tdPlay(p) {
      var t = [(p.type && p.type.text) || '', (p.scoringType && (p.scoringType.name + ' ' + p.scoringType.abbreviation)) || '', p.text || ''].join(' ');
      return /touchdown/i.test(t) || / Yd (pass|run|rush)\b/i.test(p.text || '') || / Yd .*Return/i.test(p.text || '');
    }

    function tdScorerName(text) {
      var t = (text || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      var m = t.match(/^(.+?)\s+\d+\s+Yd\b/i);
      if (m) return m[1].trim();
      m = t.match(/^(.+?)\s+(Fumble Recovery|Fumble Return|Interception Return|Blocked|Punt Return|Kickoff Return)/i);
      if (m) return m[1].trim();
      var s = t.split(/\.\s+/).filter(function(x) { return /TOUCHDOWN/i.test(x); }).pop() || t;
      if (!/INTERCEPTED|FUMBLE|MUFF|BLOCKED|RECOVERED/i.test(s)) {
        m = s.match(/pass .*?\bto\s+([A-Z][a-zA-Z]?\.\s?[A-Z][A-Za-z'\-]+)/);
        if (m) return m[1];
      }
      var names = s.match(/[A-Z][a-zA-Z]?\.\s?[A-Z][A-Za-z'\-]+/g);
      return names ? names[0] : t;
    }

    async function firstTouchdown(eventId) {
      var s = await espnGet('summary?event=' + eventId);
      var sp = (s.scoringPlays || []).filter(tdPlay);
      if (sp.length) return tdScorerName(sp[0].text);
      var drives = (s.drives && s.drives.previous) || [];
      for (var i = 0; i < drives.length; i++) {
        var plays = drives[i].plays || [];
        for (var j = 0; j < plays.length; j++) if (plays[j].scoringPlay && tdPlay(plays[j])) return tdScorerName(plays[j].text);
      }
      return null;
    }

    function startLiveTracker() {
      clearTimeout(LIVE.timer);
      updateLive();
    }

    async function updateLive() {
      var strips = document.querySelectorAll('.live-strip');
      if (!strips.length) return;
      var board;
      try { board = await espnGet('scoreboard'); } catch (e) { return; }
      var events = board.events || [];
      var nextIn = 0; // ms until the next refresh (0 = none needed)

      for (var i = 0; i < strips.length; i++) {
        var strip = strips[i];
        var hk = espnTeamKey(strip.getAttribute('data-home')), ak = espnTeamKey(strip.getAttribute('data-away'));
        var ev = null, comp = null;
        events.forEach(function(e) {
          var c = e.competitions && e.competitions[0];
          if (!c) return;
          var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
          if (keys.indexOf(hk) >= 0 && keys.indexOf(ak) >= 0) { ev = e; comp = c; }
        });
        if (!ev) { strip.innerHTML = ''; continue; }

        var state = ev.status.type.state;
        var find = function(k) { return comp.competitors.filter(function(x) { return espnTeamKey(x.team.displayName) === k; })[0]; };
        var H = find(hk), A = find(ak);
        var team = function(c) {
          var tc = TEAM_COLORS[resolveTeam(c.team.displayName)];
          return '<span style="color:' + (tc ? tc.dark : '#F3F4F6') + '">' + c.team.abbreviation + '</span>';
        };

        var scoreHtml, statusHtml;
        if (state === 'pre') {
          var ko = new Date(ev.date);
          var mins = (ko - Date.now()) / 60000;
          scoreHtml = team(H) + '<span class="ls-dash">vs</span>' + team(A);
          statusHtml = 'Kickoff ' + ko.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
          if (mins < 15) nextIn = Math.min(nextIn || Infinity, 60000);
          else if (mins < 240) nextIn = Math.min(nextIn || Infinity, 5 * 60000);
        } else {
          scoreHtml = team(H) + ' ' + (H.score || 0) + '<span class="ls-dash">–</span>' + (A.score || 0) + ' ' + team(A);
          statusHtml = state === 'in'
            ? '<span class="ls-dot"></span><span class="ls-live">LIVE</span> ' + (ev.status.type.shortDetail || '')
            : 'Final';
          if (state === 'in') nextIn = Math.min(nextIn || Infinity, 45000);
        }

        // First TD (cached once found; it can't change after that)
        var tdHtml = '';
        if (state !== 'pre') {
          if (!LIVE.firstTD[ev.id]) {
            try { var name = await firstTouchdown(ev.id); if (name) LIVE.firstTD[ev.id] = name; } catch (e) {}
          }
          var scorer = LIVE.firstTD[ev.id];
          var game = strip.closest('.live-game');
          var picks = game ? game.querySelectorAll('.lp-pick') : [];
          if (scorer) {
            var hitBy = [];
            picks.forEach(function(el) {
              var hit = sameScorer(scorer, el.getAttribute('data-player'));
              el.classList.toggle('lp-hit', hit);
              el.classList.toggle('lp-miss', !hit);
              if (hit) {
                var card = el.closest('.live-pick-card');
                if (card) hitBy.push(card.classList.contains('maria') ? 'Maria' : 'Danielle');
              }
            });
            // Celebrate once per game (cards pulse, scoreboard flashes)
            if (hitBy.length && !LIVE.celebrated[ev.id]) {
              LIVE.celebrated[ev.id] = true;
              picks.forEach(function(el) {
                if (!el.classList.contains('lp-hit')) return;
                var card = el.closest('.live-pick-card');
                if (card) { card.classList.remove('lp-celebrate'); void card.offsetWidth; card.classList.add('lp-celebrate'); }
              });
              strip.classList.add('ls-celebrate');
              setTimeout(function(s) { s.classList.remove('ls-celebrate'); }, 4200, strip);
            }
            var who = hitBy.map(function(n) { return '<span style="color:' + (personColor(n)) + ';font-weight:700">' + n + '</span>'; });
            tdHtml = '<div class="ls-td">🏈 First TD: <b>' + scorer + '</b>' +
              (picks.length ? (who.length ? ' · 🎉 ' + who.join(' & ') + (who.length > 1 ? ' both' : '') + ' hit it!' : ' · Nobody had him') : '') +
              '</div>';
          } else if (state === 'in') {
            tdHtml = '<div class="ls-td" style="color:rgba(255,255,255,0.55)">🏈 No touchdowns yet</div>';
          }
        }
        // 📺 Game Day for live games both of them picked
        var gdBtn = '';
        if (state === 'in' && strip.closest('.live-game') && strip.closest('.live-game').querySelector('.lp-pick')) {
          var q = function(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); };
          gdBtn = '<button class="gd-open" onclick="openGameDay(\'' + q(strip.getAttribute('data-home')) + '\', \'' + q(strip.getAttribute('data-away')) + '\')">📺 Watch on Game Day</button>';
        }
        strip.innerHTML = '<div class="ls-row"><div class="ls-score">' + scoreHtml + '</div><div class="ls-status">' + statusHtml + '</div></div>' + tdHtml + gdBtn;
      }
      if (nextIn) LIVE.timer = setTimeout(updateLive, nextIn);
    }

    // ── Pull to refresh (Stats, phones) ─────────────────────────────────────
    // At the top of Stats, drag down and let go to fetch the latest picks and first TDs.
    (function() {
      var startY = null, dist = 0, busy = false, el = null, PULL = 70;
      function ind() { if (!el) { el = document.createElement('div'); el.className = 'ptr'; document.body.appendChild(el); } return el; }
      function hide() { var i = ind(); i.style.opacity = 0; i.style.transform = 'translate(-50%,-60px)'; }
      function onStats() { var p = document.getElementById('tab-stats'); return p && p.classList.contains('active'); }
      document.addEventListener('touchstart', function(e) {
        startY = (!busy && onStats() && window.scrollY <= 0 && !document.getElementById('pc-backdrop')) ? e.touches[0].clientY : null;
        dist = 0;
      }, { passive: true });
      document.addEventListener('touchmove', function(e) {
        if (startY === null) return;
        dist = e.touches[0].clientY - startY;
        if (dist <= 0 || window.scrollY > 0) { hide(); return; }
        var d = Math.min(dist, 130), i = ind();
        i.textContent = d >= PULL ? '↻ Release to refresh' : '↓ Pull to refresh';
        i.style.opacity = Math.min(1, d / 50);
        i.style.transform = 'translate(-50%,' + Math.round(d * 0.6 - 40) + 'px)';
      }, { passive: true });
      document.addEventListener('touchend', function() {
        if (startY === null) return;
        var go = dist >= PULL && window.scrollY <= 0;
        startY = null;
        if (!go) { hide(); return; }
        busy = true;
        var i = ind();
        i.textContent = '↻ Refreshing…'; i.style.opacity = 1; i.style.transform = 'translate(-50%,14px)';
        clearSheetCache();
        Promise.resolve(load()).then(function() { i.textContent = '✓ Up to date'; }, function() { i.textContent = 'Couldn\'t refresh'; })
          .then(function() { setTimeout(function() { hide(); busy = false; }, 900); });
      });
    })();
