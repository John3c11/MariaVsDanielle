// Admin, 🏈 Season: New Season, Bracket, Injuries, Museum
// Loaded by admin.js (showAdmin) the first time you open this section. Part of the MariaVsDanielle site; shares the global scope.

    // ── 🏆 Bracket: set the playoff field, open/lock it, fix a first TD ──────────
    var BRA = { seeds: null };
    function adminBracket() {
      var body = adminScreen('bracket', '<div class="loading">Loading the bracket…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'bradmin' }), loadScriptOnce('js/bracket.js')]).then(function(res) {
        var r = res[0];
        if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + (/Bracket\.gs/.test(r.error) ? '' : '') + '</div>'; return; }
        if (!r.bracket) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version. In Apps Script: <b>Deploy → Manage deployments → ✏️ → New version → Deploy</b>, then reload.</div>'; return; }
        BRA.seeds = r.seeds ? { AFC: r.seeds.AFC.slice(), NFC: r.seeds.NFC.slice() } : (BRA.seeds || { AFC: ['', '', '', '', '', '', ''], NFC: ['', '', '', '', '', '', ''] });
        drawAdminBracket(body, r);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawAdminBracket(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var B = r.bracket, S = r.seeds, st = B.state;
      var teams = Object.keys(TEAM_ABBR).sort();
      var stateTxt = { off: S ? 'Field saved, not open yet' : 'Not set up', open: 'Open: people can fill out brackets', locked: 'Locked: games are on', done: 'Finished' }[st] || st;
      var h = '<div class="ui-note u-mb">Everyone picks the winner and first TD of all 13 playoff games before Wild Card kickoff. It locks by itself at the first kickoff, and results come from ESPN. Set the field right after Week 18.</div>';
      h += '<div class="st-row"><span class="st-ic">' + (st === 'open' ? '🟢' : st === 'locked' ? '🔒' : st === 'done' ? '🏁' : '⚪') + '</span><div class="u-grow"><div class="st-l">' + stateTxt + '</div>' +
        '<div class="st-d">' + (B.lockAt ? 'Locks ' + new Date(B.lockAt).toLocaleString() : 'Lock time: the first Wild Card kickoff, once ESPN lists the games') + ' · ' + (r.entries || []).length + ' brackets</div>' +
        '<div class="u-d-flex u-gap-6px u-fwrap-wrap u-mt-8px">' +
          (S ? '<button class="adm-btn ' + (S.opened ? '' : 'green') + '" id="bra-open">' + (S.opened ? 'Close it (hide from the site)' : 'Open it') + '</button>' : '') +
          (S && S.opened && st === 'open' ? '<button class="adm-btn" id="bra-lock">Lock now</button>' : '') +
          (S && S.lockAt ? '<button class="adm-btn" id="bra-unlock">Undo manual lock</button>' : '') +
          (st !== 'off' ? '<button class="adm-btn" id="bra-see">See the page →</button>' : '') +
        '</div></div></div>';
      h += '<div class="u-mt pf-h">🏈 The field <small>seed 1 gets the bye</small></div>' +
        '<div class="u-d-flex u-gap-8px u-fwrap-wrap u-mb-8px"><button class="adm-btn" id="bra-pull">Fill from ESPN standings</button></div>' +
        '<div class="bra-seeds">' + ['AFC', 'NFC'].map(function(c) {
          return '<div><div class="bra-conf">' + c + '</div>' + BRA.seeds[c].map(function(t, i) {
            return '<label class="bra-seed"><span>' + (i + 1) + '</span><select class="adm-input" data-bra="' + c + '|' + i + '"><option value="">—</option>' + teams.map(function(x) {
              return '<option value="' + escHtml(x) + '"' + (resolveTeam(t) === x ? ' selected' : '') + '>' + escHtml(x.split(' ').pop()) + '</option>'; }).join('') + '</select></label>';
          }).join('') + '</div>';
        }).join('') + '</div>' +
        '<button class="u-p-10px-20px primary-btn" id="bra-save">' + (S && S.opened ? 'Save the field' : 'Save and open the bracket') + '</button>' +
        (S && !S.opened ? ' <button class="u-ml-8px link-btn" id="bra-save-only">Save without opening</button>' : '') +
        '<div class="u-ta-left submit-msg" id="adm-msg"></div>';
      var E = r.entries || [];
      h += '<div class="u-mt-18px pf-h">👥 Brackets <small>' + E.length + '</small></div>' + (E.length ? E.map(function(e) {
        var n = BR_ORDER.filter(function(k) { return e.picks[k] && e.picks[k].w; }).length, ns = BR_ORDER.filter(function(k) { return e.picks[k] && e.picks[k].s; }).length;
        return '<div class="adm-row"><div><b>' + escHtml(e.who) + '</b> <span class="u-muted">· ' + n + '/13 winners · ' + ns + '/13 first TDs' + (e.at && !isNaN(new Date(e.at)) ? ' · ' + new Date(e.at).toLocaleDateString() : '') + '</span></div>' +
          '<button class="adm-btn red" data-bra-rm="' + escHtml(e.who) + '">Remove</button></div>';
      }).join('') : '<div class="u-fs-13px u-c-muted">None yet.</div>');
      var G = B.games || [];
      if (G.length) {
        h += '<div class="u-mt-18px pf-h">📋 Results from ESPN <small>fix a first TD if ESPN\'s name doesn\'t match</small></div>';
        G.forEach(function(g) {
          h += '<div class="adm-row"><div class="u-minw-0"><b>' + escHtml(brNick(g.teams[0])) + ' vs ' + escHtml(brNick(g.teams[1])) + '</b> <span class="u-muted">· ' + BR_ROUNDS[g.round].t + ' · ' + (g.state === 'post' ? 'final' + (g.winner ? ', ' + escHtml(brNick(g.winner)) + ' won' : '') : g.state === 'in' ? 'live' : 'not started') + '</span>' +
            '<div class="u-fs-12px u-mt-3px">First TD: <b>' + escHtml(g.ftd || '—') + '</b>' + (g.fixed ? ' (fixed by you)' : '') + '</div></div>' +
            '<span class="u-ws-nowrap"><button class="adm-btn" data-bra-fix="' + escHtml(g.id) + '">Fix</button>' + (g.fixed ? ' <button class="adm-btn" data-bra-unfix="' + escHtml(g.id) + '">Use ESPN</button>' : '') + '</span></div>';
        });
      }
      body.innerHTML = h;

      function call(q, msg) {
        q.pin = SUB.pin; adminMsg('Saving…', true);
        return picksApi(q).then(function(x) {
          if (x.needForce) { if (confirm(x.error + ' Save anyway?')) { q.force = '1'; return call(q, msg); } adminMsg('Not saved.', false); return; }
          if (x.error) { adminMsg(x.error, false); return; }
          BRA.seeds = x.seeds ? { AFC: x.seeds.AFC.slice(), NFC: x.seeds.NFC.slice() } : BRA.seeds;
          drawAdminBracket(body, x); adminMsg(msg, true);
          if (typeof setBracketState === 'function') setBracketState(x.bracket && x.bracket.state !== 'off' ? { state: x.bracket.state, lockAt: x.bracket.lockAt } : null);
          if (typeof BR !== 'undefined') BR.data = null;
        }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
      }
      body.querySelectorAll('[data-bra]').forEach(function(sel) {
        sel.addEventListener('change', function() { var x = sel.getAttribute('data-bra').split('|'); BRA.seeds[x[0]][+x[1]] = sel.value; });
      });
      function saveSeeds(open) {
        var all = BRA.seeds.AFC.concat(BRA.seeds.NFC);
        if (all.some(function(t) { return !t; })) { adminMsg('Fill in all 7 seeds for both conferences.', false); return; }
        call({ action: 'brseeds', seeds: JSON.stringify(BRA.seeds), open: open ? '1' : '' }, open ? 'Saved. The bracket is open. 🏆' : 'Saved.');
      }
      document.getElementById('bra-save').addEventListener('click', function() { saveSeeds(!S || !S.opened ? true : true); });
      var so = document.getElementById('bra-save-only'); if (so) so.addEventListener('click', function() { saveSeeds(false); });
      document.getElementById('bra-pull').addEventListener('click', function() {
        adminMsg('Asking ESPN…', true);
        picksApi({ pin: SUB.pin, action: 'brpull' }).then(function(x) {
          if (x.error || !x.espn) { adminMsg(x.error || 'ESPN didn\'t answer.', false); return; }
          ['AFC', 'NFC'].forEach(function(c) { for (var i = 0; i < 7; i++) BRA.seeds[c][i] = (x.espn[c] && x.espn[c][i]) ? resolveTeam(x.espn[c][i]) : BRA.seeds[c][i]; });
          drawAdminBracket(body, r); adminMsg('Filled from ESPN. Check it, then save.', true);
        }).catch(function() { adminMsg('Couldn\'t reach the script.', false); });
      });
      var ob = document.getElementById('bra-open'); if (ob) ob.addEventListener('click', function() { call({ action: 'bropen', open: S.opened ? '' : '1' }, S.opened ? 'Closed. The 🏆 Bracket page is hidden.' : 'Open. 🏆'); });
      var lk = document.getElementById('bra-lock'); if (lk) lk.addEventListener('click', function() { if (confirm('Lock every bracket right now?')) call({ action: 'brlock', lock: '1' }, 'Locked.'); });
      var ul = document.getElementById('bra-unlock'); if (ul) ul.addEventListener('click', function() { call({ action: 'brlock', lock: '' }, 'Back to locking at the first kickoff.'); });
      var see = document.getElementById('bra-see'); if (see) see.addEventListener('click', function() { switchTab('bracket'); });
      body.querySelectorAll('[data-bra-rm]').forEach(function(b) {
        b.addEventListener('click', function() { var w = b.getAttribute('data-bra-rm'); if (confirm('Remove ' + w + '\'s bracket?')) call({ action: 'brrm', who: w }, 'Removed.'); });
      });
      body.querySelectorAll('[data-bra-fix]').forEach(function(b) {
        b.addEventListener('click', function() {
          var id = b.getAttribute('data-bra-fix'), g = G.filter(function(x) { return x.id === id; })[0];
          var name = prompt('First TD scorer for ' + brNick(g.teams[0]) + ' vs ' + brNick(g.teams[1]) + ' (spell it like the Rosters tab):', g.ftd || '');
          if (name === null || !name.trim()) return;
          var team = prompt('His team? Type ' + brNick(g.teams[0]) + ' or ' + brNick(g.teams[1]) + ':', g.ftdTeam ? brNick(g.ftdTeam) : '');
          var full = g.teams.filter(function(t) { return team && brNick(t).toLowerCase() === team.trim().toLowerCase(); })[0] || g.ftdTeam || '';
          call({ action: 'brfix', id: id, ftd: name.trim(), team: full }, 'Fixed.');
        });
      });
      body.querySelectorAll('[data-bra-unfix]').forEach(function(b) {
        b.addEventListener('click', function() { call({ action: 'brfix', id: b.getAttribute('data-bra-unfix'), ftd: '' }, 'Back to ESPN\'s answer.'); });
      });
    }

    // ── 🏛️ Museum: John's notes, photos and moments (js/museum.js draws the page) ──
    var MUA = { edit: null, list: null };
    function adminMuseum() {
      MUA.edit = null;
      var body = adminScreen('museum', '<div class="loading">Loading the Museum…</div>');
      loadScriptOnce('js/museum.js').then(function() { return museumData(true); }).then(function(list) {
        MUA.list = list; drawAdminMuseum(body);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function muaSaved(id) { return (MUSEUM.saved || []).filter(function(m) { return m.id === id; })[0] || null; }
    function drawAdminMuseum(body) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var E = MUA.edit, auto = E && !E.custom && E.id;
      var years = SEASONS.map(function(s) { return s.year; });
      var weeks = [''].concat(Array.apply(null, Array(18)).map(function(_, i) { return i + 1; })).concat([19, 20, 21, 23]);
      function sel(id, opts, val, dis) {
        return '<select class="adm-input" id="' + id + '"' + (dis ? ' disabled' : '') + '>' + opts.map(function(o) {
          var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
          return '<option value="' + escHtml(String(v)) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + escHtml(String(t)) + '</option>';
        }).join('') + '</select>';
      }
      var h = '<div class="u-d-flex u-jc-space-between u-ai-baseline u-gap-10px u-mb-10px">' +
        '<div class="u-fs-12px u-c-muted">The site finds most moments by itself. Add your own, or give any moment a note, a photo or a ⭐. Hidden ones stay off the page.</div>' +
        '<button class="u-ws-nowrap link-btn" id="mua-open">Open the Museum →</button></div>';
      h += '<div class="pf-h">' + (E ? '✏️ Edit: ' + escHtml(E.title) : '➕ Add a moment') + '</div>' +
        '<div class="mua-form">' +
          '<label>Season' + sel('mua-season', years, E ? E.season : CURRENT_YEAR, auto) + '</label>' +
          '<label>Week' + sel('mua-week', weeks.map(function(w) { return [w, w ? wkName(w) : '—']; }), E ? (E.week === 99 ? '' : E.week || '') : '', auto) + '</label>' +
          '<label>Who' + sel('mua-who', [['', '—'], 'Maria', 'Danielle', 'Both'], E ? E.who || '' : '', auto) + '</label>' +
          '<label class="wide">Title' + '<input class="adm-input" id="mua-title" maxlength="90" placeholder="' + (auto ? escHtml(E.autoTitle || E.title) + ' (leave empty to keep)' : 'e.g. The Thanksgiving miracle') + '" value="' + escHtml(E && (E.custom || E.titleSet) ? E.title : '') + '"></label>' +
          '<label class="wide">Caption' + '<textarea class="adm-input" id="mua-cap" maxlength="500" placeholder="' + (auto ? escHtml(E.autoCaption || '') : 'What happened?') + '">' + escHtml(E && (E.custom || E.capSet) ? E.caption : '') + '</textarea></label>' +
          '<label class="wide">Photo (optional)<div class="mua-photo">' +
            '<input type="file" id="mua-file" accept="image/*" style="display:none"><button class="adm-btn" id="mua-pick" type="button">📷 Upload a photo</button>' +
            '<input class="u-f-1 u-minw-160px adm-input" id="mua-photo" placeholder="or paste an image link (https://…)" value="' + escHtml(E && E.photo || '') + '">' +
            (E && E.photo ? '<img class="mua-thumb" id="mua-thumb" src="' + escHtml(E.photo) + '" alt="">' : '<img class="mua-thumb" style="display:none" id="mua-thumb" alt="">') +
          '</div></label>' +
          '<label class="u-fd-row u-ai-center u-gap-8px u-fs-13px u-c-t1 wide"><input type="checkbox" id="mua-star"' + (E && E.star ? ' checked' : '') + '> ⭐ Feature it (gold card, bigger with a photo)</label>' +
        '</div>' +
        '<button class="u-p-10px-20px primary-btn" id="mua-save">' + (E ? 'Save changes' : 'Add to the Museum') + '</button>' +
        (E ? ' <button class="u-ml-s link-btn" id="mua-cancel">Cancel</button>' : '') +
        '<div class="u-ta-left submit-msg" id="adm-msg"></div>';

      var list = MUA.list || [];
      h += '<div class="u-mt-18px pf-h">🏛️ Everything in the Museum <small>' + list.filter(function(m) { return !m.hidden; }).length + ' showing · ' + list.filter(function(m) { return m.hidden; }).length + ' hidden</small></div>';
      list.forEach(function(m, i) {
        var tag = MU_TAGS[m.tag] || MU_TAGS.custom;
        h += '<div class="mua-row' + (m.hidden ? ' off' : '') + '"><div class="mua-ic">' + tag.ic + '</div><div class="mua-mid">' +
          '<div class="mua-t">' + (m.star ? '⭐ ' : '') + escHtml(m.title) + (m.photo ? ' 📷' : '') + '</div>' +
          '<div class="mua-s">' + (m.custom ? 'Yours' : tag.t) + (m.edited ? ' · edited' : '') + ' · ' + museumWhen(m) + (m.hidden ? ' · hidden' : '') + '</div></div>' +
          '<div class="mua-btns"><button class="adm-btn" data-mua-ed="' + i + '">Edit</button>' +
          '<button class="adm-btn" data-mua-hide="' + i + '">' + (m.hidden ? 'Show' : 'Hide') + '</button>' +
          (m.custom ? '<button class="adm-btn red" data-mua-rm="' + i + '">Delete</button>' : m.edited ? '<button class="adm-btn" data-mua-rm="' + i + '" title="Remove your note, photo and ⭐">Reset</button>' : '') +
          '</div></div>';
      });
      body.innerHTML = h;

      function val(id) { var x = document.getElementById(id); return x ? x.value : ''; }
      function refresh(res, msg) {
        if (res && res.museum) MUSEUM.saved = res.museum.items;
        museumData().then(function(l) { MUA.list = l; MUA.edit = null; drawAdminMuseum(body); adminMsg(msg, true); });
      }
      // Save one moment: the full row is written every time, so carry over what's already saved
      function save(m, changes, msg) {
        var cur = muaSaved(m.id) || {};
        var q = { pin: SUB.pin, action: 'museumsave', id: m.custom || cur.id ? m.id : (m.id || ''),
          season: m.season, week: m.week === 99 ? '' : (m.week || ''), who: m.who || '',
          title: cur.title || (m.custom ? m.title : ''), caption: cur.caption || (m.custom ? m.caption : ''), photo: cur.photo || '', star: cur.star ? '1' : '', hidden: cur.hidden ? '1' : '' };
        Object.keys(changes).forEach(function(k) { q[k] = changes[k]; });
        adminMsg('Saving…', true);
        return picksApi(q).then(function(res) {
          if (res.error) { adminMsg(res.error, false); return; }
          refresh(res, msg);
        }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
      }

      document.getElementById('mua-open').addEventListener('click', function() { switchTab('museum'); });
      var cancel = document.getElementById('mua-cancel');
      if (cancel) cancel.addEventListener('click', function() { MUA.edit = null; drawAdminMuseum(body); });
      var file = document.getElementById('mua-file'), thumb = document.getElementById('mua-thumb'), photo = document.getElementById('mua-photo');
      document.getElementById('mua-pick').addEventListener('click', function() { file.click(); });
      function showThumb(u) { if (u && /^https:\/\//.test(u)) { thumb.src = u; thumb.style.display = ''; } else thumb.style.display = 'none'; }
      photo.addEventListener('input', function() { showThumb(photo.value.trim()); });
      file.addEventListener('change', function() {
        if (!file.files || !file.files[0]) return;
        adminMsg('Uploading the photo…', true);
        museumUpload(SUB.pin, file.files[0]).then(function(r) {
          if (!r || r.error || !r.url) { adminMsg((r && r.error) || 'The upload didn\'t work.', false); return; }
          photo.value = r.url; showThumb(r.url); adminMsg('Photo uploaded. Save to keep it.', true);
        }).catch(function() { adminMsg('The upload didn\'t work. Make sure Museum.gs is in Apps Script and you ran authorizeMuseumPhotos once.', false); });
      });
      document.getElementById('mua-save').addEventListener('click', function() {
        var title = val('mua-title').trim(), cap = val('mua-cap').trim(), ph = val('mua-photo').trim(), star = document.getElementById('mua-star').checked ? '1' : '';
        if (ph && !/^https:\/\//.test(ph)) { adminMsg('The photo link has to start with https://', false); return; }
        if (!E) {
          if (!title) { adminMsg('Give the moment a title.', false); return; }
          return save({ id: '', custom: true, season: val('mua-season'), week: val('mua-week'), who: val('mua-who') },
            { id: '', title: title, caption: cap, photo: ph, star: star, hidden: '' }, 'Added to the Museum. 🏛️');
        }
        var ch = { title: title, caption: cap, photo: ph, star: star };
        if (E.custom) { if (!title) { adminMsg('Give the moment a title.', false); return; } ch.season = val('mua-season'); ch.week = val('mua-week'); ch.who = val('mua-who'); }
        save(E, ch, 'Saved.');
      });
      body.querySelectorAll('[data-mua-ed]').forEach(function(b) {
        b.addEventListener('click', function() {
          var m = list[+b.getAttribute('data-mua-ed')], cur = muaSaved(m.id) || {};
          MUA.edit = Object.assign({}, m, { titleSet: !!cur.title, capSet: !!cur.caption, autoTitle: m.custom ? '' : (cur.title ? '' : m.title), autoCaption: m.custom ? '' : (cur.caption ? '' : m.caption) });
          drawAdminMuseum(body); window.scrollTo(0, 0);
        });
      });
      body.querySelectorAll('[data-mua-hide]').forEach(function(b) {
        b.addEventListener('click', function() { var m = list[+b.getAttribute('data-mua-hide')]; save(m, { hidden: m.hidden ? '' : '1' }, m.hidden ? 'Back on display.' : 'Hidden from the Museum.'); });
      });
      body.querySelectorAll('[data-mua-rm]').forEach(function(b) {
        b.addEventListener('click', function() {
          var m = list[+b.getAttribute('data-mua-rm')];
          if (!confirm(m.custom ? 'Delete "' + m.title + '" from the Museum?' : 'Remove your note, photo and ⭐ from "' + m.title + '"?')) return;
          adminMsg('Saving…', true);
          picksApi({ pin: SUB.pin, action: 'museumrm', id: m.id }).then(function(res) {
            if (res.error) { adminMsg(res.error, false); return; }
            refresh(res, m.custom ? 'Deleted.' : 'Back to the automatic version.');
          }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
        });
      });
    }

    // ── 🆕 Season: start next year's sheet ──────────────────────────────────
    function seasonConfigText(add) {
      var list = SEASONS.filter(function(x) { return x.year !== add.year; }).concat([{ year: add.year, sheetId: add.id }])
        .sort(function(a, b) { return parseInt(b.year) - parseInt(a.year); });
      var lines = ['const CONFIG = {'];
      Object.keys(CONFIG).forEach(function(k) { if (k !== 'SEASONS') lines.push('  ' + k + ': ' + JSON.stringify(CONFIG[k]) + ','); });
      lines.push('  SEASONS: [');
      list.forEach(function(x) { lines.push("    { year: '" + x.year + "', sheetId: '" + x.sheetId + "'" + (x.tab && x.tab !== 'Winnings' ? ", tab: '" + x.tab + "'" : '') + ' },'); });
      lines.push('  ],', '};');
      return lines.join('\n');
    }
    function adminSeason() {
      var body = adminScreen('season', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'season' }).then(function(r) {
        if (!document.body.contains(body)) return; // left this tab before it loaded
        if (r.error) { body.innerHTML = '<div class="loading">' + escHtml(r.error) + '</div>'; return; }
        var cur = r.current, pend = r.pending, prev = r.prev;
        var next = String(parseInt(cur.year, 10) + 1);
        var siteYear = CURRENT_YEAR;
        function link(x) { return '<a href="' + x.url + '" target="_blank" rel="noopener" class="u-c-blue">Open sheet ↗</a>'; }
        function step(n, title, state, inner) {
          return '<div class="ns-step ' + state + '"><div class="ns-num">' + (state === 'done' ? '✓' : n) + '</div><div class="u-f-1 u-minw-0"><div class="ns-title">' + title + '</div>' + (inner || '') + '</div></div>';
        }
        var h = '<div class="u-fs-12px u-c-muted u-mb-14px">Picks, odds, Trash Talk, first TDs and the Tuesday email all use the <b class="u-c-t1">' + cur.year + '</b> sheet right now. ' + link(cur) + '</div>';
        var configFor = pend || (prev ? cur : null);
        var needConfig = configFor && SEASONS.map(function(x) { return x.year; }).indexOf(configFor.year) < 0;

        h += step(1, 'Make the ' + (pend ? pend.year : prev ? cur.year : next) + ' sheet', (pend || prev) ? 'done' : 'now',
          (pend || prev) ? '<div class="ns-sub">Copied from ' + (pend ? cur.year : prev.year) + ' with the formulas, tabs and team colors. Game rows, Trash Talk and Injured were blanked. ' + link(pend || cur) + '</div>'
            : '<div class="ns-sub">Copies the ' + cur.year + ' sheet into a new "' + next + '" sheet in the same Drive folder, keeping every formula, tab, dropdown and the team-color script, then blanks the game rows, Trash Talk and Injured list. The ' + cur.year + ' sheet is not changed. Nothing switches yet.</div>' +
              '<button class="u-mt-10px primary-btn" id="ns-make">Make ' + next + ' sheet</button>');
        h += step(2, 'Fill it in', pend ? 'now' : prev ? 'done' : 'later',
          '<div class="ns-sub">Pre-fill the game rows like you always do (or add them on the 🏈 Games screen, which only works after step 3), and update the Rosters and QBs tabs for the new year. The site and scripts keep using ' + (pend ? cur.year : 'the old sheet') + ' until step 3.</div>');
        h += step(3, 'Switch over', pend ? 'now' : prev ? 'done' : 'later',
          pend ? '<div class="ns-sub">Do this before ' + pend.year + ' Week 1. Picks, odds, chat, first TDs and the Tuesday email move to the ' + pend.year + ' sheet. Friends and their old picks stay.</div><button class="u-mt-10px u-p-9px-16px u-fs-13px adm-btn green" id="ns-switch">Switch to ' + pend.year + '</button>'
            : prev ? '<div class="ns-sub">Switched from ' + prev.year + ' to ' + cur.year + '. <button class="link-btn" id="ns-undo">Undo, go back to ' + prev.year + '</button></div>' : '');
        h += step(4, 'Upload the new config.js', needConfig ? (prev ? 'now' : 'later') : (configFor ? 'done' : 'later'),
          configFor ? (needConfig
            ? '<div class="ns-sub">Replace config.js on GitHub with this, right after step 3. Then the site shows ' + configFor.year + ' as the current season and ' + (parseInt(configFor.year) - 1) + ' gets its Season Wrapped and Crowd Wrapped cards.</div>' +
              '<textarea class="ns-config" id="ns-config" readonly rows="' + (seasonConfigText(configFor).split('\n').length) + '">' + escHtml(seasonConfigText(configFor)) + '</textarea>' +
              '<button class="adm-btn" id="ns-copy">Copy</button>'
            : '<div class="ns-sub">The site already lists ' + configFor.year + ' (it shows ' + siteYear + ' as the current season).</div>')
          : '<div class="ns-sub">You\'ll get the exact file to paste here.</div>');
        h += '<div class="u-ta-left submit-msg" id="adm-msg"></div>';
        h += '<div class="u-mt-18px pf-h">✅ Ready for ' + (pend ? pend.year : cur.year) + '? <small><button class="link-btn" id="ns-recheck">Check again</button></small></div><div id="ns-check"><div class="loading">Checking…</div></div>';
        h += '<div class="u-fs-11px u-c-faint u-mt-14px">Keep editing the scripts in the 2026 sheet\'s Apps Script. The new sheet gets a copy of them only so the team colors keep working there.</div>';
        body.innerHTML = h;

        function run(action, btn, label) {
          btn.disabled = true; btn.textContent = label;
          picksApi({ pin: SUB.pin, action: action }).then(function(x) {
            if (x.error) { btn.disabled = false; adminMsg(x.error); return; }
            CROWD.data = null; adminSeason();
          }).catch(function() { btn.disabled = false; adminMsg('Couldn\'t reach the script. Check the sheet before trying again.'); });
        }
        var mk = document.getElementById('ns-make');
        if (mk) mk.addEventListener('click', function() { run('newseason', mk, 'Copying… (about 30 seconds)'); });
        var sw = document.getElementById('ns-switch');
        if (sw) sw.addEventListener('click', function() {
          if (confirm('Switch to ' + pend.year + '? New picks, odds, chat and first TDs will go into the ' + pend.year + ' sheet. Upload the new config.js right after.')) run('switchseason', sw, 'Switching…');
        });
        var un = document.getElementById('ns-undo');
        if (un) un.addEventListener('click', function() {
          if (confirm('Go back to the ' + prev.year + ' sheet? (The ' + cur.year + ' sheet stays in Drive, ready to switch again.)')) run('undoseason', un, 'Switching back…');
        });
        // ✅ The checklist: the script looks at the sheet, this page checks the website's config.js
        function drawCheck() {
          var box = document.getElementById('ns-check');
          if (!box) return;
          box.innerHTML = '<div class="loading">Checking…</div>';
          picksApi({ pin: SUB.pin, action: 'seasoncheck' }).then(function(c) {
            if (c.error || !c.items) { box.innerHTML = '<div class="inj-warn">' + escHtml(c.error || 'The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy.') + '</div>'; return; }
            var items = c.items.slice();
            var listed = SEASONS.some(function(x) { return x.year === c.year; });
            items.splice(items.length - 2, 0, { state: !pend && CURRENT_YEAR === c.year ? 'ok' : pend ? 'now' : listed ? 'ok' : 'bad', label: 'Website shows ' + c.year,
              detail: CURRENT_YEAR === c.year ? 'config.js lists it as the current season.' : pend ? 'After switching, upload the new config.js (step 4).' : 'Upload the new config.js (step 4). The site still shows ' + CURRENT_YEAR + '.' });
            var bad = items.filter(function(x) { return x.state === 'bad' || x.state === 'warn' || x.state === 'now'; }).length;
            box.innerHTML = '<div class="ns-sum ' + (bad ? 'todo' : 'ready') + '">' + (bad ? bad + ' thing' + (bad === 1 ? '' : 's') + ' left before ' + c.year + ' is ready' : '🎉 All set for ' + c.year + '.') + '</div>' +
              items.map(function(x) {
                var ic = x.state === 'ok' ? '✅' : x.state === 'warn' ? '⚠️' : x.state === 'bad' ? '❌' : x.state === 'now' ? '👉' : 'ℹ️';
                return '<div class="st-row"><span class="st-ic">' + ic + '</span><div><div class="st-l">' + escHtml(x.label) + '</div>' + (x.detail ? '<div class="st-d">' + escHtml(x.detail) + '</div>' : '') + '</div></div>';
              }).join('');
          }).catch(function() { box.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
        }
        drawCheck();
        document.getElementById('ns-recheck').addEventListener('click', drawCheck);
        var cp = document.getElementById('ns-copy');
        if (cp) cp.addEventListener('click', function() {
          var ta = document.getElementById('ns-config'); ta.select();
          (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function() { document.execCommand('copy'); });
          cp.textContent = 'Copied ✓';
        });
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }

    // Injuries
    function adminInjuries() {
      var body = adminScreen('injuries', '<div class="loading">Loading…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'injuries' }), ROSTERS_READY, loadNFL()]).then(function(res) {
        drawInjuries(body, res[0]);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawInjuries(body, st) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      if (st.error) { body.innerHTML = '<div class="loading">' + escHtml(st.error) + '</div>'; return; }
      if (!st.slots) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version, so this screen can\'t work yet. In Apps Script: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>. Then reload this page.</div>'; return; }
      function nick(t) { return t ? resolveTeam(t).split(' ').pop() : ''; }
      function when(iso) { return iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'never'; }
      var names = Object.keys(ROSTER_INFO).map(function(k) { return ROSTER_INFO[k].name; }).filter(Boolean).sort();
      var h = '<div class="inj-auto"><div><b>🤖 Auto from ESPN</b><div class="st-d">Players ESPN lists as Out, IR, Suspended or PUP are marked out every 2 hours and come back when ESPN clears them. Last check: ' + when(st.last && st.last.at) + '</div></div>' +
        '<div class="u-d-flex u-fd-column u-gap-6px u-ai-flex-end"><span class="inj-state ' + (st.auto ? 'on' : 'off') + '">' + (st.auto ? '● Currently ON' : '● Currently OFF') + '</span>' +
          '<button class="adm-btn" id="inj-auto">' + (st.auto ? 'Turn off' : 'Turn on') + '</button><button class="adm-btn" id="inj-sync">Check ESPN now</button></div></div>';
      h += '<div class="u-d-flex u-gap-8px u-fwrap-wrap u-m-12px-0-6px">' +
          '<input class="u-f-2 u-minw-160px adm-input" id="inj-name" list="inj-players" placeholder="Mark someone out by hand">' +
          '<input class="u-f-1-4 u-minw-120px adm-input" id="inj-note" placeholder="Note (optional)">' +
          '<button class="u-p-9px-18px primary-btn" id="inj-add">Mark OUT</button>' +
        '</div><datalist id="inj-players">' + names.map(function(n) { return '<option value="' + escHtml(n) + '">'; }).join('') + '</datalist>' +
        '<div class="u-ta-left submit-msg" id="adm-msg"></div>';
      if (st.needFill && st.needFill.length) h += '<div class="inj-warn">⚠️ No fill-in found for: <b>' + st.needFill.map(escHtml).join(', ') + '</b>. Pick one below, or leave the slot empty.</div>';
      if (st.pending && st.pending.length) h += '<div class="u-bc-rgba-147-197-253-0-4 u-bg-rgba-96-165-250-0-08 inj-warn">⏳ Waiting for the game to finish before shifting: <b>' + st.pending.map(nick).join(', ') + '</b></div>';

      h += '<div class="inj-h">🚑 Currently out (' + st.rows.length + ')</div>';
      h += st.rows.length ? st.rows.map(function(r) {
        var auto = r.source === 'auto';
        var team = resolveTeam(r.team);
        var pos = r.pos || (ROSTER_INFO[playerKey(r.name)] || {}).pos || '';
        var P = pos.replace(/\d+/g, '');
        // Fill-in choices: that team's players at the same position who aren't offered yet
        var opts = Object.keys(NFL).map(function(k) { return NFL[k]; }).filter(function(n) {
          return n.team === team && n.pos === P && !isOffered(n.name) && playerKey(n.name) !== playerKey(r.name);
        }).sort(function(a, b) { return a.name.localeCompare(b.name); });
        var cur = r.fill === '-' ? '-' : (r.fillBy === 'you' ? r.fill : '');
        var sel = '<select class="adm-input inj-fill" data-fill="' + escHtml(r.name) + '">' +
          '<option value=""' + (!cur ? ' selected' : '') + '>' + (P === 'QB' ? 'No fill-in (QB)' : 'Auto: ESPN depth chart' + (r.fill && r.fillBy === 'espn' ? ' (' + escHtml(r.fill) + ')' : '')) + '</option>' +
          '<option value="-"' + (cur === '-' ? ' selected' : '') + '>No fill-in, leave it empty</option>' +
          opts.map(function(n) { return '<option value="' + escHtml(n.name) + '"' + (cur === n.name ? ' selected' : '') + '>' + escHtml(n.name) + (n.inj ? ' (' + escHtml(n.inj) + ')' : '') + '</option>'; }).join('') +
          (cur && cur !== '-' && !opts.some(function(n) { return n.name === cur; }) ? '<option selected value="' + escHtml(cur) + '">' + escHtml(cur) + '</option>' : '') + '</select>';
        return '<div class="inj-row"><div class="inj-top"><div><b>' + escHtml(r.name) + '</b> <span class="u-muted">· ' + nick(team) + (pos ? ' ' + escHtml(pos) : '') + '</span>' +
            '<div class="inj-tags">' + (auto ? '<span class="pc-tag inj">🤖 ESPN: ' + escHtml(r.espn || 'Out') + '</span>' : '<span class="pc-tag">✋ Added by you</span>') +
            (r.note && !/^ESPN:/.test(r.note) ? '<span class="st-d">' + escHtml(r.note) + '</span>' : '') + '</div></div>' +
            (auto ? '<button class="adm-btn" data-keep="' + escHtml(r.name) + '" title="Ignore ESPN for him until his status changes">Keep him in</button>'
                  : '<button class="adm-btn green" data-heal="' + escHtml(r.name) + '">Healthy ✓</button>') + '</div>' +
          '<div class="inj-fillrow"><span>Fill-in:</span>' + sel + '</div></div>';
      }).join('') : '<div class="u-c-muted u-fs-13px u-p-10px-0">Nobody is out.</div>';

      if (st.shifted && st.shifted.length) {
        h += '<div class="inj-h">🔒 Shifted teams <small>don\'t hand-edit these columns until they\'re back to normal</small></div>';
        h += st.shifted.map(function(s) {
          var diffs = [];
          for (var i = 0; i < 9; i++) if ((s.original[i] || '') !== (s.now[i] || '')) diffs.push('<span class="inj-slot">' + st.slots[i] + '</span> ' + (s.original[i] ? '<s>' + escHtml(s.original[i]) + '</s>' : '<i>empty</i>') + ' → ' + (s.now[i] ? '<b>' + escHtml(s.now[i]) + '</b>' : '<i>empty</i>'));
          return '<div class="inj-shift">' + teamLogo(s.team) + '<b>' + nick(s.team) + '</b><div class="st-d">' + diffs.join('<br>') + '</div></div>';
        }).join('');
      }
      if (st.tagged && st.tagged.length) h += '<div class="inj-h">🟡 Questionable / doubtful <small>tagged only, still pickable</small></div>' +
        '<div class="st-d">' + st.tagged.map(function(t) { return escHtml(t.name) + ' (' + nick(t.team) + ', ' + escHtml(t.espn) + ')'; }).join(' · ') + '</div>';
      if (st.unmatched && st.unmatched.length) h += '<div class="inj-h">✏️ Not found on ESPN <small>usually a spelling difference, so these can\'t be auto-tracked</small></div>' +
        '<div class="st-d">' + st.unmatched.map(escHtml).join(' · ') + '</div>';
      if (st.log && st.log.length) h += '<div class="inj-h">🕘 Recent activity</div><div class="st-log">' + st.log.map(function(l) { return '<span class="u-c-faint">' + when(l.at) + '</span> ' + escHtml(l.text); }).join('<br>') + '</div>';
      body.innerHTML = h;

      function act(params, btn) {
        if (btn) { btn.disabled = true; }
        adminMsg('Saving…', true);
        picksApi(Object.assign({ pin: SUB.pin }, params)).then(function(r) {
          if (r && r.error) { adminMsg(r.error); if (btn) btn.disabled = false; return; }
          refreshAfterInjury(); adminInjuries();
        }).catch(function() { adminMsg('Couldn\'t reach the script.'); if (btn) btn.disabled = false; });
      }
      document.getElementById('inj-auto').addEventListener('click', function() { act({ action: 'injauto', on: st.auto ? 'off' : 'on' }, this); });
      document.getElementById('inj-sync').addEventListener('click', function() { this.textContent = 'Checking…'; act({ action: 'injsync' }, this); });
      document.getElementById('inj-add').addEventListener('click', function() {
        var name = document.getElementById('inj-name').value.trim();
        if (!name) return adminMsg('Type a player name.');
        if (!ROSTER_INFO[playerKey(name)] && !confirm(name + ' isn\'t on the Rosters tab. Add anyway?')) return;
        act({ action: 'injure', name: name, note: document.getElementById('inj-note').value.trim() }, this);
      });
      body.querySelectorAll('[data-heal]').forEach(function(b) { b.addEventListener('click', function() { act({ action: 'heal', name: b.getAttribute('data-heal') }, b); }); });
      body.querySelectorAll('[data-keep]').forEach(function(b) {
        b.addEventListener('click', function() {
          if (confirm('Keep ' + b.getAttribute('data-keep') + ' in? ESPN will be ignored for him until his status changes.')) act({ action: 'injkeep', name: b.getAttribute('data-keep') }, b);
        });
      });
      body.querySelectorAll('[data-fill]').forEach(function(sel) { sel.addEventListener('change', function() { act({ action: 'setfill', name: sel.getAttribute('data-fill'), fill: sel.value }); }); });
    }
    function refreshAfterInjury() { clearSheetCache(); ROSTERS_READY = loadRosters(); }
