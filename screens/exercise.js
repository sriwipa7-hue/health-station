/* ออกกำลังกาย (#exercise) — แตะเลือกชนิด + เวลา แล้วกดบันทึก · แถบ 12 สัปดาห์ */
window.Screens = window.Screens || {};
(function () {
  var esc = function (s) { return UI.esc(s); };
  var MINS = [15, 30, 45, 60];

  Screens.exercise = {
    async render(root, ctx) {
      var book = await ctx.loadBook(true), cfg = await ctx.loadConfig();
      var goal = HS.data.settings.weeklyMinutesGoal || 150;
      var sel = { type: null }, sending = false;

      function header(w) {
        var idx = w.index, title, elapsed = Math.min(Math.max(idx, 0), 12), target = Math.ceil(elapsed * 0.5), on = w.logged >= target;
        title = idx >= 1 && idx <= 12 ? 'สัปดาห์ที่ ' + idx + ' จาก 12' : (idx === 0 ? 'โครงการเริ่มวันอบรมครั้งที่ 1' : 'ครบ 12 สัปดาห์แล้ว');
        var cells = '';
        for (var i = 1; i <= 12; i++) cells += '<span class="' + (w.perWeek[i - 1] > 0 ? 'd' : '') + (i === idx ? ' now' : '') + '">' + i + '</span>';
        var pct = Math.min(100, Math.round(w.minutesThisWeek / goal * 100));
        return '<div class="row-between"><h2 id="week-title">' + title + '</h2>' +
          '<span class="badge ' + (on ? 'ok' : 'risk') + '" id="week-status">' + (on ? '● ตามเป้า' : '▲ ยังไม่ถึงเป้า') + '</span></div>' +
          '<div class="week" role="img" aria-label="ออกกำลังกายแล้ว ' + w.logged + ' สัปดาห์">' + cells + '</div>' +
          '<div class="panel" id="week-minutes"><div class="row-between"><span>สัปดาห์นี้</span><b class="num">' + w.minutesThisWeek + ' / ' + goal + ' นาที</b></div>' +
          '<div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
          (w.minutesThisWeek >= goal ? '<div class="st ok">● ถึงเป้าสัปดาห์นี้แล้ว</div>' : '<div class="small muted">อีก ' + (goal - w.minutesThisWeek) + ' นาทีถึงเป้า</div>') + '</div>';
      }

      function draw(msg) {
        var b = book, h = '<a class="back" href="#book">‹ กลับสมุดของฉัน</a><h1>ออกกำลังกาย</h1>';
        if (b.weeks) h += header(b.weeks);
        else h += '<div class="panel" id="no-program">ยังไม่ได้อยู่ในโครงการ 12 สัปดาห์ — ยังบันทึกการออกกำลังกายไว้ดูเองได้ค่ะ</div>';
        if (msg) h += '<div class="panel praise" id="log-ok" role="status">' + esc(msg) + '</div>';
        h += '<div class="field"><div class="lab">ออกกำลังกายอะไร</div><div class="seg" id="types">' +
          cfg.exerciseTypes.map(function (t) { return '<button type="button" class="type-chip" aria-pressed="' + (sel.type === t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
          '<div class="field"><div class="lab">กี่นาที</div><div class="seg" id="mins">' +
          MINS.map(function (m) { return '<button type="button" class="min-chip" aria-pressed="false">' + m + '</button>'; }).join('') + '</div>' +
          '<div class="input-row"><input id="minutes" type="text" inputmode="numeric" autocomplete="off" placeholder="หรือพิมพ์จำนวนนาที" aria-label="จำนวนนาที"><span class="unit">นาที</span></div></div>' +
          '<div class="err" id="log-error" role="alert"></div><button type="button" class="btn" id="log">บันทึกการออกกำลังกาย</button>';
        if ((b.badges.earned || []).indexOf('four_weeks_150') < 0) {
          var bi = BadgeInfo.find('four_weeks_150');
          h += '<div class="medal-hint" id="medal-hint">' + BadgeInfo.medal(bi, false) + '<div><b>เหรียญ “' + esc(bi.name) + '”</b><div class="small muted">' + esc(bi.how) + '</div></div></div>';
        }
        root.innerHTML = h;
        wire();
      }

      function wire() {
        var $ = function (s) { return root.querySelector(s); };
        root.querySelectorAll('.type-chip').forEach(function (btn) {
          btn.onclick = function () {
            sel.type = btn.textContent;
            root.querySelectorAll('.type-chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
            $('#log-error').textContent = '';
          };
        });
        root.querySelectorAll('.min-chip').forEach(function (btn) {
          btn.onclick = function () {
            $('#minutes').value = btn.textContent;
            root.querySelectorAll('.min-chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
            $('#log-error').textContent = '';
          };
        });
        $('#minutes').addEventListener('input', function () {
          var v = this.value.trim();
          root.querySelectorAll('.min-chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x.textContent === v)); });
          $('#log-error').textContent = '';
        });
        $('#log').onclick = async function () {
          if (sending) return;
          var err = $('#log-error'), mins = HS.rules.parseNumber($('#minutes').value);
          if (!sel.type) { err.textContent = 'กรุณาเลือกชนิดการออกกำลังกาย'; return; }
          if (isNaN(mins) || mins % 1 !== 0 || mins < 1 || mins > 600) { err.textContent = 'เวลาออกกำลังกายต้องเป็นจำนวนเต็ม 1–600 นาที'; return; }
          sending = true; this.disabled = true; this.textContent = 'กำลังบันทึก…';
          try {
            var data = await Api.call('saveExercise', { type: sel.type, minutes: mins });
            ctx.setBook(data); book = data;
            var type = sel.type; sel.type = null;
            draw('บันทึกแล้ว: ' + type + ' ' + mins + ' นาที เก่งมากค่ะ');
          } catch (e) {
            if (e.code === 'not_registered') return;
            err.textContent = e.message; this.disabled = false; this.textContent = 'บันทึกการออกกำลังกาย';
          } finally { sending = false; }
        };
      }
      draw();
    }
  };
})();
