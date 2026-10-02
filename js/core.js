// Shared basics: Google Sheets loading, seasons, team names and colors, small helpers. Loads first.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    const API_KEY = CONFIG.API_KEY;

    // ── Google Sheets request sharing ───────────────────────────────────────
    // Google allows about 60 reads a minute. Many tabs read the same sheet, so identical
    // requests made within 30 seconds share one answer, and a "too many requests" reply
    // is retried after a short wait instead of failing.
    (function() {
      var realFetch = window.fetch.bind(window);
      var memo = {};
      var TTL = 30000;
      function getWithRetry(url, n) {
        return realFetch(url).then(function(res) {
          if (res.status === 429 && n < 4) {
            return new Promise(function(r) { setTimeout(r, [2000, 5000, 10000, 20000][n]); })
              .then(function() { return getWithRetry(url, n + 1); });
          }
          return res.text().then(function(body) { return { status: res.status, body: body }; });
        });
      }
      function toResponse(x) {
        return new Response(x.body, { status: x.status, headers: { 'Content-Type': 'application/json' } });
      }
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.indexOf('sheets.googleapis.com') < 0 || (init && init.method && init.method !== 'GET')) return realFetch(input, init);
        var live = url.indexOf('Trash%20Talk') >= 0; // chat always asks fresh
        var hit = memo[url];
        if (!live && hit && Date.now() - hit.t < TTL) return hit.p.then(toResponse);
        var p = getWithRetry(url, 0);
        if (!live) {
          memo[url] = { t: Date.now(), p: p };
          p.then(function(x) { if (x.status !== 200) delete memo[url]; }, function() { delete memo[url]; });
        }
        return p.then(toResponse);
      };
      window.clearSheetCache = function() { memo = {}; };
    })();

    // ── Seasons ─────────────────────────────────────────────────────────────
    // Set in config.js as CONFIG.SEASONS (newest first). The first one is the current season.
    // New season = add one line there. These are only used if config.js doesn't list any.
    var SEASONS = ((CONFIG.SEASONS && CONFIG.SEASONS.length) ? CONFIG.SEASONS : [
      { year: '2026', sheetId: '1eokxqa-RCuH4qNh486OMSnIeZdXbhHnw_FygbzUwGj4' },
      { year: '2025', sheetId: '1DWLYS9RYuOv97ajIcsak69Z97ODtegnBXvlDKJgpwYc' },
    ]).map(function(x) { return { year: String(x.year), sheetId: x.sheetId, tab: x.tab || 'Winnings' }; })
      .sort(function(a, b) { return parseInt(b.year) - parseInt(a.year); });
    var CURRENT_YEAR = SEASONS[0].year;
    const SHEET_ID = SEASONS[0].sheetId;
    var SB_M = '#F87171', SB_D = '#60A5FA'; // Maria / Danielle on dark cards
    document.getElementById('season-title').textContent = CURRENT_YEAR + ' Touchdown Bets';
    // ESPN team logos (small versions). Shown next to team names, never next to player names.
    var TEAM_ABBR = {
      'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'bal', 'Buffalo Bills': 'buf', 'Carolina Panthers': 'car',
      'Chicago Bears': 'chi', 'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle', 'Dallas Cowboys': 'dal', 'Denver Broncos': 'den',
      'Detroit Lions': 'det', 'Green Bay Packers': 'gb', 'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax',
      'Kansas City Chiefs': 'kc', 'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac', 'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia',
      'Minnesota Vikings': 'min', 'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg', 'New York Jets': 'nyj',
      'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit', 'San Francisco 49ers': 'sf', 'Seattle Seahawks': 'sea',
      'Tampa Bay Buccaneers': 'tb', 'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh',
    };
    function teamLogoUrl(team) {
      var a = TEAM_ABBR[resolveTeam(team)];
      return a ? 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/' + a + '.png&h=64&w=64' : '';
    }
    function teamLogo(team, cls) {
      var u = teamLogoUrl(team);
      return u ? '<img class="tlogo' + (cls ? ' ' + cls : '') + '" src="' + u + '" alt="" loading="lazy" onerror="this.remove()">' : '';
    }
    function isTeamLabel(text, team) {
      var r = resolveTeam(team);
      return !!(r && TEAM_COLORS[r] && /^[A-Za-z0-9 .]+$/.test(text || '') && resolveTeam(text) === r);
    }
    function teamPill(text, team) {
      var tc = TEAM_COLORS[resolveTeam(team)];
      if (!tc) return '<b>' + text + '</b>';
      return '<span class="tpill" style="background:' + (tc.bg || tc.primary) + ';color:' + tc.text + '">' + (isTeamLabel(text, team) ? teamLogo(team) : '') + text + '</span>';
    }


    function teamColor(teamName) {
      var tc = TEAM_COLORS[resolveTeam(teamName)];
      return tc ? tc.dark : '#A1A9B6';
    }

    function coloredText(text, teamName) {
      var tc = TEAM_COLORS[resolveTeam(teamName)];
      if (!tc) return text;
      return '<span style="color:' + tc.dark + ';font-weight:600">' + text + '</span>';
    }

    function hexA(hex, a) {
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function coloredGame(homeTeam, awayTeam) {
      return teamLogo(homeTeam) + coloredText(homeTeam, homeTeam) + '<span style="color:#9CA3AF"> vs </span>' + teamLogo(awayTeam) + coloredText(awayTeam, awayTeam);
    }

    async function fetchSheet(tabName, range) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabName + '!' + range)}?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${tabName}: ${res.status}`);
      const data = await res.json();
      return data.values || [];
    }

    function pct(n, d) { if (!d) return '0%'; return Math.round(n / d * 100) + '%'; }

    function barWidth(a, b) {
      const total = Math.abs(a) + Math.abs(b);
      if (!total) return ['50%', '50%'];
      return [Math.round(Math.abs(a) / total * 100) + '%', Math.round(Math.abs(b) / total * 100) + '%'];
    }

    function statBlock(label, mariaVal, danielleVal, mariaDisplay, danielleDisplay) {
      const [mw, dw] = barWidth(mariaVal, danielleVal);
      return `<div class="stat-block">
        <div class="stat-label">${label}</div>
        <div class="stat-row">
          <div class="stat-value maria">${mariaDisplay}</div>
          <div class="stat-divider">·</div>
          <div class="stat-value danielle">${danielleDisplay}</div>
        </div>
        <div class="bar-row">
          <div class="bar maria" style="width:${mw}"></div>
          <div class="bar danielle" style="width:${dw}"></div>
        </div>
      </div>`;
    }

    function escHtml(t) {
      return (t || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Legacy tab ────────────────────────────────────────────────────────────

    var TEAM_ALIASES = {
      "Eagles": "Philadelphia Eagles", "Giants": "New York Giants",
      "Cowboys": "Dallas Cowboys", "Commanders": "Washington Commanders",
      "Lions": "Detroit Lions", "Packers": "Green Bay Packers",
      "Vikings": "Minnesota Vikings", "Bears": "Chicago Bears",
      "Buccaneers": "Tampa Bay Buccaneers", "Bucaneers": "Tampa Bay Buccaneers",
      "Falcons": "Atlanta Falcons", "Panthers": "Carolina Panthers",
      "Saints": "New Orleans Saints", "Rams": "Los Angeles Rams",
      "Seahawks": "Seattle Seahawks", "49ers": "San Francisco 49ers",
      "Cardinals": "Arizona Cardinals", "Bills": "Buffalo Bills",
      "Jets": "New York Jets", "Patriots": "New England Patriots",
      "Dolphins": "Miami Dolphins", "Ravens": "Baltimore Ravens",
      "Bengals": "Cincinnati Bengals", "Steelers": "Pittsburgh Steelers",
      "Browns": "Cleveland Browns", "Colts": "Indianapolis Colts",
      "Jaguars": "Jacksonville Jaguars", "Texans": "Houston Texans",
      "Titans": "Tennessee Titans", "Chiefs": "Kansas City Chiefs",
      "Chargers": "Los Angeles Chargers", "Broncos": "Denver Broncos",
      "Raiders": "Las Vegas Raiders",
    };

    // Turns any reasonable spelling into the full team name:
    // "Bills", "Buffalo Bills", "buffalo bills ", "Bucs", "Bucaneers", "Tampa Bay Bucanners" ...
    var TEAM_NAME_CACHE = {};
    function resolveTeam(name) {
      var n = (name || '').toString().trim();
      if (!n) return n;
      if (TEAM_COLORS[n]) return n;
      if (TEAM_ALIASES[n]) return TEAM_ALIASES[n];
      if (n in TEAM_NAME_CACHE) return TEAM_NAME_CACHE[n];
      var key = n.toLowerCase().replace(/[^a-z0-9]/g, '');
      var hit = null;
      if (/buc|tampa/.test(key)) hit = 'Tampa Bay Buccaneers';
      else if (/niner/.test(key)) hit = 'San Francisco 49ers';
      else {
        Object.keys(TEAM_COLORS).forEach(function(full) {
          var nick = full.split(' ').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
          var whole = full.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (key === whole || key === nick || key.slice(-nick.length) === nick) hit = full;
        });
      }
      TEAM_NAME_CACHE[n] = hit || n;
      return TEAM_NAME_CACHE[n];
    }

    function legacyColoredText(text, team) {
      var r = resolveTeam(team);
      if (!r || !TEAM_COLORS[r]) return text;
      return '<span style="color:' + TEAM_COLORS[r].dark + ';font-weight:600">' + text + '</span>';
    }
    function legacyColoredGame(h, a) {
      return teamLogo(h) + legacyColoredText(h, h) + '<span style="color:#9CA3AF"> vs </span>' + teamLogo(a) + legacyColoredText(a, a);
    }

    // bg/text match the Google Sheet (jersey style). primary = readable team color on white.
    const TEAM_COLORS = {
      "Philadelphia Eagles":    { primary: "#004C54", bg: "#004C54", text: "#A5ACAF", dark: "#3FA9A8" },
      "New York Giants":        { primary: "#0B2265", bg: "#0B2265", text: "#FFFFFF", dark: "#7B93E6" },
      "Dallas Cowboys":         { primary: "#041E42", bg: "#869397", text: "#041E42", dark: "#B4C2CF" },
      "Washington Commanders":  { primary: "#5A1414", bg: "#5A1414", text: "#FFB612", dark: "#FFB612" },
      "Detroit Lions":          { primary: "#0076B6", bg: "#0076B6", text: "#FFFFFF", dark: "#3BA3E8" },
      "Green Bay Packers":      { primary: "#203731", bg: "#203731", text: "#FFB612", dark: "#FFB612" },
      "Minnesota Vikings":      { primary: "#4F2683", bg: "#4F2683", text: "#FFC62F", dark: "#A784E0" },
      "Chicago Bears":          { primary: "#0B162A", bg: "#0B162A", text: "#E64100", dark: "#F26B21" },
      "Tampa Bay Buccaneers":   { primary: "#D50A0A", bg: "#D50A0A", text: "#FFFFFF", dark: "#F0443A" },
      "Atlanta Falcons":        { primary: "#000000", bg: "#000000", text: "#E0243E", dark: "#EF3B52" },
      "Carolina Panthers":      { primary: "#0085CA", bg: "#0085CA", text: "#101820", dark: "#3DB2EE" },
      "New Orleans Saints":     { primary: "#9A7B3E", bg: "#D3BC8D", text: "#101820", dark: "#D3BC8D" },
      "Los Angeles Rams":       { primary: "#003594", bg: "#003594", text: "#FFD100", dark: "#FFD100" },
      "Seattle Seahawks":       { primary: "#002244", bg: "#002244", text: "#69BE28", dark: "#69BE28" },
      "San Francisco 49ers":    { primary: "#AA0000", bg: "#AA0000", text: "#E6C98A", dark: "#E5484D" },
      "Arizona Cardinals":      { primary: "#97233F", bg: "#97233F", text: "#FFFFFF", dark: "#E0577A" },
      "Buffalo Bills":          { primary: "#00338D", bg: "#00338D", text: "#FFFFFF", dark: "#5B8EF7" },
      "New York Jets":          { primary: "#125740", bg: "#125740", text: "#FFFFFF", dark: "#3BB27D" },
      "New England Patriots":   { primary: "#002244", bg: "#002244", text: "#C60C30", dark: "#E1334F" },
      "Miami Dolphins":         { primary: "#008E97", bg: "#008E97", text: "#FFFFFF", dark: "#1FBFC9" },
      "Baltimore Ravens":       { primary: "#241773", bg: "#241773", text: "#C9A227", dark: "#9B87F5" },
      "Cincinnati Bengals":     { primary: "#FB4F14", bg: "#FB4F14", text: "#000000", dark: "#FB4F14" },
      "Pittsburgh Steelers":    { primary: "#101820", bg: "#101820", text: "#FFB612", dark: "#FFB612" },
      "Cleveland Browns":       { primary: "#311D00", bg: "#311D00", text: "#FF3C00", dark: "#FF6A2B" },
      "Indianapolis Colts":     { primary: "#002C5F", bg: "#FFFFFF", text: "#002C5F", dark: "#6FA0E8" },
      "Jacksonville Jaguars":   { primary: "#006778", bg: "#006778", text: "#D7A22A", dark: "#2BB3C5" },
      "Houston Texans":         { primary: "#A71930", bg: "#A71930", text: "#03202F", dark: "#EF4E63" },
      "Tennessee Titans":       { primary: "#0C2340", bg: "#0C2340", text: "#4B92DB", dark: "#4B92DB" },
      "Kansas City Chiefs":     { primary: "#E31837", bg: "#E31837", text: "#FFB81C", dark: "#F5334F" },
      "Los Angeles Chargers":   { primary: "#0080C6", bg: "#0080C6", text: "#FFC20E", dark: "#FFC20E" },
      "Denver Broncos":         { primary: "#002244", bg: "#002244", text: "#FB4F14", dark: "#FB4F14" },
      "Las Vegas Raiders":      { primary: "#000000", bg: "#000000", text: "#A5ACAF", dark: "#C4C8CB" },
    };

    const DIVISIONS = {"NFC East": ["Philadelphia Eagles", "New York Giants", "Dallas Cowboys", "Washington Commanders"], "NFC North": ["Detroit Lions", "Green Bay Packers", "Minnesota Vikings", "Chicago Bears"], "NFC South": ["Tampa Bay Buccaneers", "Atlanta Falcons", "Carolina Panthers", "New Orleans Saints"], "NFC West": ["Los Angeles Rams", "Seattle Seahawks", "San Francisco 49ers", "Arizona Cardinals"], "AFC East": ["Buffalo Bills", "New York Jets", "New England Patriots", "Miami Dolphins"], "AFC North": ["Baltimore Ravens", "Cincinnati Bengals", "Pittsburgh Steelers", "Cleveland Browns"], "AFC South": ["Indianapolis Colts", "Jacksonville Jaguars", "Houston Texans", "Tennessee Titans"], "AFC West": ["Kansas City Chiefs", "Los Angeles Chargers", "Denver Broncos", "Las Vegas Raiders"]};
