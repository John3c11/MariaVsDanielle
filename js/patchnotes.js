// 📜 Patch Notes (v150): how the site got here, version by version, in eras.
// Versions before v68 aren't itemized (there's no record of each one), and small fix-up versions are left out.
// Loaded on demand (openPatchNotes in main.js). Part of the MariaVsDanielle site; shares the global scope.

    var PATCH_ERAS = [
      { t: '🧹 The cleanup', r: 'v151–', d: 'Making the whole site look and work like one thing.', v: [
        [151, 'One system: a set text-size scale, four corner sizes, and named colors everywhere so light mode follows along'],
      ] },
      { t: '🌗 MvD 2.0', r: 'v140–v150', d: 'Light mode, a Time Machine, a smarter Machine, Futures, and a magazine.', v: [
        [150, '🗞️ The Weekly: a magazine issue for every week and season · 🎬 Highlight Reels you can save as a video · 📜 these Patch Notes · the 150 reveal'],
        [149, '🔮 Futures: season-long sealed calls (rest-of-2026 edition), a live board and standings, a card on Home'],
        [148, '🧠 Machine 2.0: opponent defense, who\'s missing, prime-time tilt and hot hand as Lab settings, with new Why reasons'],
        [147, '📟 Commissioner Mode: a Game Night console, one-tap scorer fixes and announcements, the week wrap, "needs you" emails'],
        [146, '🧱 The big tidy: shared helpers, charts load only when needed, dead code out, and a fix for odds typed as +1600'],
        [145, '🚀 Make Lab settings live (retrain + new picks), ↩ revert, Machine settings on Status'],
        [144, '🧪 Machine Lab: backtest with knobs, saved experiments, side-by-side compare'],
        [143, '🃏 Player card 2.0: #player links, card art and rarity, bad beats, the Machine\'s chances, friends\' picks'],
        [142, '⏳ Time Machine: the whole site as of any week, with shareable links'],
        [141, '⚙️ Display panel (theme, text size, less motion), better contrast, Bracket and Replay fixed'],
        [140, '🌗 Light mode'],
      ] },
      { t: '🏗️ The rebuild', r: 'v120–v139', d: 'Five hubs, Game Pages, and a much faster, cleaner site.', v: [
        [139, '📊 A dashboard inside the season sheet'],
        [138, '🧠 Machine Brain: why it picked who it picked'],
        [137, '🗓️ Season Planner'],
        [136, '🔮 Every TD of every bet game, and the Anytime TD What-If'],
        [135, 'One "Show all" for every list, and links between the pages'],
        [134, '📊 Numbers = 📖 Stories + 🧪 Explore'],
        [133, 'Admin split into parts, faster startup'],
        [132, 'CSS diet: each screen\'s styles load with it'],
        [131, 'Admin in five sections'],
        [130, 'Friend profiles 2.0, Crowd champions, the Crowd line on Home'],
        [129, '📨 Invite links, Trends, and a check for an old style.css'],
        [128, 'Profiles 2.0'],
        [127, 'Style utilities; the Market in its own file'],
        [126, 'One look across the whole site'],
        [125, '✅ The Tuesday checklist, with next week\'s games suggested'],
        [124, '🩺 Status 2.0: background job log, alerts and Google\'s limits'],
        [122, '🏈 Game Pages go full screen, plus the Games list'],
        [121, '🏈 Game Pages'],
        [120, 'Five hubs with sub-tabs'],
      ] },
      { t: '🎆 The big features', r: 'v100–v119', d: 'The Story, Game Day, cards, the Museum, the Bracket, and the birth of the Machine.', v: [
        [119, 'The Machine\'s picks freeze once they\'ve been seen'],
        [118, 'Discoveries in the Stat Lab, and share cards'],
        [117, '🧪 Stat Lab'],
        [114, 'FanDuel price model for the Machine'],
        [112, '🤖 The Machine tab'],
        [109, '🤖 The Machine begins: a library of every NFL game since 2023'],
        [108, 'This Week in History'],
        [107, '🔮 The Chalk Team and ⏪ Replay'],
        [106, 'The script files combined (Automation, Features)'],
        [105, '🏆 Playoff Bracket Challenge'],
        [104, '🏛️ The Museum'],
        [103, 'Admin moved into its own file'],
        [102, '🃏 Trading cards, 🥚 easter eggs, the 🏖️ offseason card'],
        [100, '📖 Season Story, 📺 Game Day, 📈 the Crowd Market'],
      ] },
      { t: '📊 Stats and polish', r: 'v84–v99', d: 'Insights, a real phone layout, and admin tools.', v: [
        [97, 'An admin heads-up after login, and error reports from phones'],
        [96, '🏈 Add and remove games from the site'],
        [95, 'Wide desktop layout'],
        [94, 'The phone tab bar along the bottom; sheet tidy-up'],
        [89, 'Insights: records, chances to win and more'],
        [86, 'Team colors in the sheet'],
        [84, 'Cleanup'],
      ] },
      { t: '🧩 The split', r: 'v68–v83', d: 'One page became a real site, and the sheet started filling itself.', v: [
        [80, 'Automatic injuries'],
        [79, 'The NFL Players list from ESPN'],
        [74, 'Picks by PIN, the First TD tracker filling the sheet by itself, and the Tuesday recap email'],
        [71, 'Charts'],
        [68, 'One page split into style.css and a js/ file per tab, and it works offline'],
      ] },
      { t: '🌱 The early days', r: 'v1–v67', d: 'It started as a single page reading the season sheet: the scoreboard, everyone\'s picks and the bet history. These versions aren\'t itemized: there\'s no record of each one.', v: [] },
    ];

    function openPatchNotesTab() {
      var el = document.getElementById('patch-content'), q = (PATCH_Q || '').toLowerCase();
      var n = PATCH_ERAS.reduce(function(a, e) { return a + e.v.length; }, 0), top = PATCH_ERAS[0].v[0][0];
      var h = '<div class="pn-head"><div class="pn-k">📜 Patch Notes</div><div class="pn-t">' + top + ' versions of Maria vs Danielle</div>' +
        '<div class="pn-d">' + n + ' of them written up here, in eras, newest first. The little fix-up versions in between are left out.</div>' +
        '<input class="adm-input pn-q" id="pn-q" placeholder="Search (Machine, Bracket, cards…)" value="' + escHtml(PATCH_Q) + '"></div>';
      PATCH_ERAS.forEach(function(e) {
        var V = e.v.filter(function(x) { return !q || x[1].toLowerCase().indexOf(q) >= 0 || ('v' + x[0]) === q; });
        if (q && !V.length) return;
        h += '<section class="pn-era"><div class="pn-eh"><b>' + e.t + '</b><span>' + e.r + '</span></div><div class="pn-ed">' + escHtml(e.d) + '</div>' +
          V.map(function(x) { return '<div class="pn-v' + (x[0] === top ? ' now' : '') + '"><span class="pn-n">v' + x[0] + '</span><span class="pn-x">' + escHtml(x[1]) + '</span></div>'; }).join('') + '</section>';
      });
      el.innerHTML = h;
      var inp = document.getElementById('pn-q');
      inp.addEventListener('input', function() { PATCH_Q = inp.value; var pos = inp.selectionStart; openPatchNotesTab(); var i2 = document.getElementById('pn-q'); i2.focus(); try { i2.setSelectionRange(pos, pos); } catch (e2) {} });
    }
    var PATCH_Q = '';
