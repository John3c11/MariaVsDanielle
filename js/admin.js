// Admin (John's admin PIN only): the layout, the ⚠️ Needs you bar, 💲 Odds, and loading each section's file.
// The screens themselves are in js/admin-week.js, admin-people.js, admin-season.js, admin-machine.js and
// admin-site.js (v133), each loaded the first time that section opens.
// Loaded by picks.js (loadAdmin) only after the admin PIN is accepted, so nobody else downloads it.
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    // ── Admin odds entry (admin PIN) ─────────────────────────────────────────
    function renderOdds(res) {
      ADMIN.oddsRes = res;
      var el = document.getElementById('submit-content');
      var html = adminHeader('odds') +
        '<div class="u-fs-12px u-c-muted u-mb-18px">Enter odds for picks that don\'t have them yet. Type them the way you do in the sheet (15, 4.7) or as American odds (+1500, +470). Leave a box blank to skip it.</div>';

      if (!res.rows.length) {
        html += '<div class="ui-empty">🎉 All odds are filled in.</div>';
        el.innerHTML = html;
        bindSwitch(); bindAdminNav();
        return;
      }

      // Group rows by game
      var games = [], idx = {};
      res.rows.forEach(function(r) {
        var k = r.week + '_' + r.game;
        if (!(k in idx)) { idx[k] = games.length; games.push({ week: r.week, slot: r.slot, home: r.home, away: r.away, rows: [] }); }
        games[idx[k]].rows.push(r);
      });

      function oddsInput(row, side, val, pick) {
        return '<span class="odds-wrap"><input class="odds-input" data-row="' + row + '" data-side="' + side + '" data-pick="' + escHtml(pick || '') + '" inputmode="decimal" autocomplete="off" placeholder="+" value="' + (val || '') + '" ' +
          'style="width:84px;font-family:Inter,sans-serif;font-size:14px;padding:7px 10px;border:1.5px solid rgba(255,255,255,0.10);border-radius:8px;background:rgba(255,255,255,0.04);color:#F3F4F6;text-align:right">' +
          '<span class="odds-hint"></span></span>';
      }

      games.forEach(function(g) {
        html += '<div class="u-bg-rgba-255-255-255-0-05 u-r-10px u-p-14px-16px u-mb-14px">' +
          '<div class="u-fs-11px u-fw-600 u-c-muted u-tt-uppercase u-ls-0-06em u-mb-4px">' + weekName(g.week) + ' · ' + g.slot + '</div>' +
          '<div class="u-fs-15px u-fw-700 u-mb-10px">' + coloredGame(g.home, g.away) + '</div>';
        g.rows.forEach(function(r) {
          html += '<div class="u-mt-8px">' +
            '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:' + personColor(r.picker) + ';margin-bottom:4px">' + r.picker + '</div>' +
            '<div class="u-d-flex u-jc-space-between u-ai-center u-p-4px-0 u-fs-14px">' + coloredText(r.homePick, r.home) + oddsInput(r.row, 'home', r.homeOdds, r.homePick) + '</div>' +
            '<div class="u-d-flex u-jc-space-between u-ai-center u-p-4px-0 u-fs-14px">' + coloredText(r.awayPick, r.away) + oddsInput(r.row, 'away', r.awayOdds, r.awayPick) + '</div>' +
            '</div>';
        });
        html += '</div>';
      });

      html += '<div class="u-center u-mt-s">' +
        '<button class="primary-btn" id="odds-go">Save Odds</button>' +
        '<div class="submit-msg" id="odds-msg"></div></div>';

      el.innerHTML = html;
      bindSwitch(); bindAdminNav();
      document.getElementById('odds-go').addEventListener('click', saveOdds);
      // Live check: what each box will save as, and a heads-up on odds that look off
      el.querySelectorAll('.odds-input').forEach(function(inp) {
        inp.addEventListener('input', function() { oddsHint(inp); });
        oddsHint(inp);
      });
    }
    // Same rules as the script: 15 or +15 = 15 to 1; +1500 or 1500 is turned into +15
    function oddsCheck(v) {
      v = String(v || '').trim();
      if (!v || v === '+') return { empty: true };
      if (!/^\+?\d+(\.\d+)?$/.test(v)) return { bad: true };
      var n = parseFloat(v.replace('+', ''));
      if (!(n > 0)) return { bad: true };
      var conv = n >= 100;
      if (conv) n = n / 100;
      n = Math.round(n * 100) / 100;
      return { n: n, conv: conv, odd: n < 1.5 || n > 60, american: '+' + Math.round(n * 100), saves: '+' + n };
    }
    function oddsHint(inp) {
      var c = oddsCheck(inp.value), h = inp.parentNode.querySelector('.odds-hint');
      inp.classList.toggle('odds-bad', !!c.bad);
      inp.classList.toggle('odds-odd', !!c.odd);
      h.className = 'odds-hint' + (c.bad ? ' bad' : c.odd ? ' odd' : '');
      h.textContent = c.empty ? '' : c.bad ? 'can\'t read that' : c.odd ? c.american + '? unusual, double-check' : c.conv ? 'saves as ' + c.saves + ' (' + c.american + ')' : '= ' + c.american;
    }

    function saveOdds() {
      if (SUB.busy) return;
      var byRow = {};
      document.querySelectorAll('.odds-input').forEach(function(inp) {
        var v = inp.value.trim();
        if (!v) return;
        var row = inp.getAttribute('data-row');
        if (!byRow[row]) byRow[row] = { row: row, home: '', away: '' };
        byRow[row][inp.getAttribute('data-side')] = v;
      });
      var items = Object.keys(byRow).map(function(k) { return byRow[k]; });
      var msg = document.getElementById('odds-msg');
      if (!items.length) { msg.style.color = '#F87171'; msg.textContent = 'Nothing entered yet.'; return; }
      var bad = [], odd = [];
      document.querySelectorAll('.odds-input').forEach(function(inp) {
        var c = oddsCheck(inp.value), who = inp.getAttribute('data-pick') || 'a pick';
        if (c.bad) bad.push(who + ' ("' + inp.value.trim() + '")');
        else if (c.odd) odd.push(who + ' at ' + c.american);
      });
      if (bad.length) { msg.style.color = '#F87171'; msg.textContent = 'Can\'t read: ' + bad.join(', ') + '. Type it like 15 or +1500.'; return; }
      if (odd.length && !confirm('These look unusual:\n\n' + odd.join('\n') + '\n\nSave anyway?')) return;

      SUB.busy = true;
      var btn = document.getElementById('odds-go');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      picksApi({ pin: SUB.pin, action: 'odds', data: JSON.stringify(items) })
        .then(function(res) {
          SUB.busy = false;
          if (res.error || (res.bad && res.bad.length)) {
            btn.disabled = false;
            btn.textContent = 'Save Odds';
            msg.style.color = '#F87171';
            msg.textContent = res.error || ('Couldn\'t read: ' + res.bad.join(', ') + '. Everything else was saved.');
            return;
          }
          var done = '<div class="u-bg-rgba-52-211-153-0-15 u-r-10px u-p-14px-16px u-fs-13px u-c-good">' +
            '✅ Saved ' + res.saved + ' odds. You\'ve been logged out.</div>';
          renderPinScreen('', done);
          clearSheetCache();
          load();
        })
        .catch(function() {
          SUB.busy = false;
          btn.disabled = false;
          btn.textContent = 'Save Odds';
          msg.style.color = '#F87171';
          msg.textContent = 'Couldn\'t reach the sheet. Check the sheet, then try again.';
        });
    }


    // ── 📜 Which copy of each Apps Script file the website expects ─────────────
    // Bump these whenever a delivery includes that file. Status and the admin alert compare them
    // with what the live script says, so a file that didn't get pasted (or deployed) shows up.
    var SCRIPT_VERSIONS = { PicksAPI: '2026-10-22', Features: '2026-10-10', Automation: '2026-10-21', WeeklyRecap: '2026-10-06', Machine: '2026-10-18' };
    var OLD_SCRIPT_FILES = { Features: 'Market.gs, Museum.gs and Bracket.gs', Automation: 'FirstTD.gs, NFLPlayers.gs, Injuries.gs and Playoffs.gs' };
    var DEPLOY_STEPS = 'Deploy → Manage deployments → ✏️ → New version → Deploy';
    function scriptIssues(v) {
      var out = [];
      Object.keys(SCRIPT_VERSIONS).forEach(function(k) {
        var live = (v || {})[k] || 'missing', want = SCRIPT_VERSIONS[k], t = null, kind = 'old';
        if (live === 'missing') t = 'Not in Apps Script yet. Add ' + k + '.gs, then ' + DEPLOY_STEPS + '.';
        else if (live === 'old separate files') t = 'Still the old separate files. Paste ' + k + '.gs, delete ' + OLD_SCRIPT_FILES[k] + ', then ' + DEPLOY_STEPS + '.';
        else if (!/^\d{4}-/.test(live)) t = 'An old copy (' + live + '). Paste the newest ' + k + '.gs, then ' + DEPLOY_STEPS + '.';
        else if (live < want) t = 'The live copy is from ' + live + ', the site expects ' + want + '. Paste the newest ' + k + '.gs and ' + DEPLOY_STEPS + ' (if you already pasted it, it only needs the deploy).';
        else if (live > want) { kind = 'newer'; t = 'The script (' + live + ') is newer than the website expects (' + want + '). Upload the newest website files to GitHub, then hard-refresh.'; }
        if (t) out.push({ file: k, kind: kind, text: t });
      });
      return out;
    }

    // ── Admin tools (admin PIN): Odds · Friends · Injuries · Trash Talk · Season · Theme · Status ───────
    var ADMIN = { oddsRes: null };

    // ── Admin layout (v131): 5 sections, each with its own row of screens ──
    var ADM_SECTIONS = [
      ['week', '✅ This Week', [['check', '✅ Checklist'], ['odds', '💲 Odds'], ['games', '🏈 Games'], ['plan', '🗓️ Planner'], ['mlines', '🎯 Machine Lines']]],
      ['people', '👥 People', [['friends', '👥 Friends'], ['chat', '🗣️ Trash Talk']]],
      ['season', '🏈 Season', [['season', '🆕 New Season'], ['bracket', '🏆 Bracket'], ['injuries', '🚑 Injuries'], ['museum', '🏛️ Museum']]],
      ['machine', '🤖 Machine', [['machine', '🤖 Machine']]],
      ['site', '⚙️ Site', [['status', '🩺 Status'], ['theme', '🎨 Theme'], ['eggs', '🥚 Eggs'], ['pins', '🔑 PINs']]],
    ];
    function admSecOf(tab) { return ADM_SECTIONS.filter(function(s) { return s[2].some(function(t) { return t[0] === tab; }); })[0] || ADM_SECTIONS[0]; }
    // Little counts on each section: how many things in it need you
    function admBadges() {
      var a = ADMIN.alert || {};
      return { week: ADMIN.ckTodo || 0, people: a.joins || 0, season: a.bracket ? 1 : 0, machine: 0,
        site: (a.scripts && a.scripts.length ? 1 : 0) + (a.issues ? 1 : 0) + (a.errs ? 1 : 0) + (a.jobs ? 1 : 0) + (a.css ? 1 : 0) };
    }
    function adminNavHtml(active) {
      var sec = admSecOf(active), B = admBadges();
      return '<div class="adm-secs">' + ADM_SECTIONS.map(function(s) {
          return '<button data-adm-sec="' + s[0] + '" class="' + (s === sec ? 'on' : '') + '"><span class="adm-sec-ic">' + s[1].split(' ')[0] + '</span><span>' + s[1].split(' ').slice(1).join(' ') + '</span>' + (B[s[0]] ? '<i class="adm-badge">' + B[s[0]] + '</i>' : '') + '</button>';
        }).join('') + '</div>' +
        (sec[2].length > 1 ? '<div class="adm-nav">' + sec[2].map(function(t) {
          return '<button data-adm="' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>' : '<div class="adm-nav adm-nav-none"></div>');
    }
    function adminHeader(active) {
      ADMIN.active = active;
      return '<div class="u-between u-mb-xs">' +
        '<div class="ui-title">Hi John</div>' +
        '<button class="link-btn" id="sub-switch">Log out</button></div>' +
        '<div id="adm-navs">' + adminNavHtml(active) + '</div>' + adminAlertHtml(active);
    }
    // After the login checks come back: refresh the badges and the heads-up bar in place
    function adminRefreshNav() {
      var navs = document.getElementById('adm-navs');
      if (!navs || !ADMIN.active) return;
      navs.innerHTML = adminNavHtml(ADMIN.active);
      var old = document.getElementById('adm-alert'); if (old) old.remove();
      navs.insertAdjacentHTML('afterend', adminAlertHtml(ADMIN.active));
      bindAdminNav();
    }
    function bindAdminNav() {
      document.querySelectorAll('[data-adm]').forEach(function(b) {
        if (b.__adm) return; b.__adm = 1;
        b.addEventListener('click', function() { showAdmin(b.getAttribute('data-adm')); });
      });
      document.querySelectorAll('[data-adm-sec]').forEach(function(b) {
        if (b.__adm) return; b.__adm = 1;
        b.addEventListener('click', function() {
          var sec = ADM_SECTIONS.filter(function(s) { return s[0] === b.getAttribute('data-adm-sec'); })[0];
          showAdmin((ADMIN.lastSub || {})[sec[0]] || sec[2][0][0]);
        });
      });
      var x = document.getElementById('adm-alert-x');
      if (x) x.addEventListener('click', function() { ADMIN.alertHidden = true; var a = document.getElementById('adm-alert'); if (a) a.remove(); });
    }

    // ── ⚠️ Heads-up right after logging in: Data check problems + new phone errors ──
    function errSeen() { try { return localStorage.getItem('mvd-err-seen') || ''; } catch (e) { return ''; } }
    function markErrSeen(list) { if (list && list.length) { try { localStorage.setItem('mvd-err-seen', list[0].at); } catch (e) {} } }
    // One short heads-up bar: each thing that needs you is a chip that opens where you fix it.
    // Chips for the screen you're on (and things the ✅ Checklist already lists) are left out.
    function adminAlertHtml(active) {
      var a = ADMIN.alert;
      if (!a || ADMIN.alertHidden) return '';
      var chips = [];
      function chip(on, ic, txt, to, title) { if (on && to !== active) chips.push('<button class="adm-chip" data-adm="' + to + '"' + (title ? ' title="' + escHtml(title) + '"' : '') + '>' + ic + ' ' + txt + '</button>'); }
      var sc = a.scripts || [];
      chip(sc.length, '📜', sc.length === 1 ? sc[0].file + '.gs to update' : sc.length + ' scripts to update', 'status', sc.map(function(x) { return x.file + '.gs'; }).join(', '));
      chip(a.bracket, '🏆', 'Open the Bracket', 'bracket');
      chip(a.issues, '🔍', a.issues + ' data issue' + (a.issues > 1 ? 's' : ''), 'status', a.bad ? a.bad + ' affect the totals' : '');
      chip(a.errs, '📱', a.errs + ' new error' + (a.errs > 1 ? 's' : ''), 'status');
      chip(a.css, '🎨', 'Upload style.css', 'status', 'style.css on GitHub is older than the page');
      chip(a.joins && active !== 'check', '📨', a.joins + ' want' + (a.joins > 1 ? '' : 's') + ' to join', 'friends');
      chip(a.jobs && active !== 'check', '⏱️', a.jobs + ' job' + (a.jobs > 1 ? 's' : '') + ' down', 'status');
      if (!chips.length) return '';
      return '<div class="adm-alert" id="adm-alert"><span class="adm-al-h">⚠️ Needs you</span>' + chips.join('') +
        '<button class="link-btn adm-al-x" id="adm-alert-x" aria-label="Hide">✕</button></div>';
    }
    // 🔮 Tell the script's Every TD job which sheet holds each season (from config.js), so it can fill in past seasons
    function tdSeasonsSync() {
      var data = JSON.stringify((typeof SEASONS !== 'undefined' ? SEASONS : []).map(function(s) { return { year: s.year, id: s.sheetId, tab: s.tab }; }));
      var sent = ''; try { sent = localStorage.getItem('mvd-tdseasons') || ''; } catch (e) {}
      if (sent === data) return Promise.resolve({});
      return picksApi({ pin: SUB.pin, action: 'tdseasons', data: data }).then(function(r) {
        if (r && r.ok) { try { localStorage.setItem('mvd-tdseasons', data); } catch (e) {} }
        return {};
      }).catch(function() { return {}; });
    }
    function adminLoginCheck() {
      ADMIN.alert = null; ADMIN.alertHidden = false;
      var seen = errSeen();
      Promise.all([
        loadAllBets().catch(function() { return null; }),
        picksApi({ pin: SUB.pin, action: 'errlist' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'versions' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'jobs' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'friends' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'checklist' }).catch(function() { return {}; }),
        tdSeasonsSync(),
        loadAdminPart('site').catch(function() {}), // the Data check count (admin-site.js)
      ]).then(function(res) {
        if (SUB.role !== 'admin') return;
        if (res[1].dcOk) ADMIN.dcOk = res[1].dcOk;
        var c = res[0] && typeof dcCounts === 'function' ? dcCounts(res[0]) : { issues: 0, bad: 0 };
        var errs = (res[1].errors || []).filter(function(e) { return e.at > seen; }).length;
        // January, before Wild Card weekend: nudge to set the playoff field
        var mo = new Date().getMonth(), brOff = typeof BRACKET_ON === 'undefined' || !BRACKET_ON;
        // An older PicksAPI doesn't know 'versions' (it answers with the odds list): treat that as old too
        var scripts = res[2] && res[2].versions ? scriptIssues(res[2].versions).filter(function(x) { return x.kind !== 'newer'; }) : (res[2] && !res[2].error && Object.keys(res[2]).length ? [{ file: 'PicksAPI', kind: 'old' }] : []);
        var jobsBad = (res[3] && res[3].jobs || []).filter(function(j) { return j.fails >= 2 || (!j.triggers && j.fn !== 'sendWeeklyRecap'); }).length;
        ADMIN.alert = { scripts: scripts, issues: c.issues, bad: c.bad, errs: errs, jobs: jobsBad, css: CSS_CHECK.stale, joins: (res[4] && res[4].pending || []).length, bracket: mo === 0 && new Date().getDate() <= 14 && brOff };
        if (res[5] && res[5].items) ADMIN.ckTodo = res[5].todo || 0;
        adminRefreshNav();
      });
    }
    function adminScreen(active, bodyHtml) {
      var el = document.getElementById('submit-content');
      el.innerHTML = adminHeader(active) + '<div id="adm-body">' + bodyHtml + '</div>';
      bindSwitch(); bindAdminNav();
      var row = el.querySelector('#adm-navs .adm-nav'), on = row && row.querySelector('.on'); // keep the open screen's button in view
      if (on && on.offsetLeft - row.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - row.offsetLeft - 16;
      return document.getElementById('adm-body');
    }
    function adminMsg(text, ok) {
      var m = document.getElementById('adm-msg');
      if (m) { m.style.color = ok ? '#6EE7B7' : '#F87171'; m.textContent = text; }
    }

    // Each section's screens live in their own file (v133), loaded the first time you open that section
    var ADMIN_PARTS = {};
    function loadAdminPart(sec) {
      if (ADMIN_PARTS[sec] === true) return Promise.resolve();
      if (!ADMIN_PARTS[sec]) {
        ADMIN_PARTS[sec] = loadScriptOnce('js/admin-' + sec + '.js').then(function() { ADMIN_PARTS[sec] = true; });
        ADMIN_PARTS[sec].catch(function() { delete ADMIN_PARTS[sec]; });
      }
      return ADMIN_PARTS[sec];
    }
    function showAdmin(section) {
      var sec = admSecOf(section);
      if (section !== 'odds' && ADMIN_PARTS[sec[0]] !== true) {
        var body = adminScreen(section, '<div class="loading">Loading…</div>');
        loadAdminPart(sec[0]).then(function() { if (document.body.contains(body)) showAdmin(section); })
          .catch(function() { if (document.body.contains(body)) body.innerHTML = '<div class="loading">Couldn\'t load this screen. Check your connection. <button class="link-btn" onclick="showAdmin(\'' + section + '\')">Try again</button></div>'; });
        return;
      }
      ADMIN.lastSub = ADMIN.lastSub || {}; ADMIN.lastSub[sec[0]] = section;
      if (section !== 'pins') { try { localStorage.setItem('mvd-adm-last', section); } catch (e) {} } // never land on PINs at login
      if (section === 'pins') adminPins();
      if (section === 'friends') adminFriends();
      if (section === 'odds') {
        adminScreen('odds', '<div class="loading">Loading…</div>');
        picksApi({ pin: SUB.pin }).then(function(res) { if (res.admin) renderOdds(res); });
      }
      if (section === 'injuries') adminInjuries();
      if (section === 'games') adminGames();
      if (section === 'chat') adminChat();
      if (section === 'season') adminSeason();
      if (section === 'theme') adminTheme();
      if (section === 'bracket') adminBracket();
      if (section === 'museum') adminMuseum();
      if (section === 'machine') adminMachine();
      if (section === 'mlines') adminMachineLines();
      if (section === 'check') adminChecklist();
      if (section === 'plan') adminPlanner();
      if (section === 'eggs') adminEggs();
      if (section === 'status') adminStatus();
    }
