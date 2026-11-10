/* สมุดของฉัน (#book) — การ์ด 7 ใบ แถบเกณฑ์ แตะดูกราฟและคำแนะนำ */
window.Screens = window.Screens || {};
(function () {
  var ORDER = ['bmi', 'waist', 'bp', 'fbs', 'lipid', 'smoke', 'alcohol'];
  var UNIT = { bmi: 'กก./ตร.ม.', waist: 'ซม.', bp: 'มม.ปรอท', fbs: 'มก./ดล.' };
  var esc = function (s) { return UI.esc(s); };

  // แถบเกณฑ์: segs = [จาก, ถึง, ชนิด] ในสเกล [min,max]; caps = ตัวเลขเส้นแบ่งใต้แถบ
  function railSpec(r, height) {
    if (r.metric === 'bmi') return { min: 15, max: 35, v: r.value, caps: [18.5, 23], segs: [[15, 18.5, 'r'], [18.5, 23, 'o'], [23, 35, 'r']] };
    if (r.metric === 'waist') { var lim = height / 2; return { min: lim * 0.7, max: lim * 1.35, v: r.value, caps: [Math.round(lim * 10) / 10], segs: [[lim * 0.7, lim, 'o'], [lim, lim * 1.35, 'r']] }; }
    if (r.metric === 'bp') return { min: 90, max: 190, v: parseInt(String(r.value).split('/')[0], 10), caps: [130, 140], segs: [[90, 130, 'o'], [130, 140, 'r'], [140, 190, 's']] };
    if (r.metric === 'fbs') return { min: 60, max: 180, v: r.value, caps: [100, 126], segs: [[60, 100, 'o'], [100, 126, 'r'], [126, 180, 's']] };
    return null;
  }
  function rail(r, height) {
    var s = railSpec(r, height); if (!s) return '';
    var span = s.max - s.min;
    function pct(x) { return Math.max(0, Math.min(100, (x - s.min) / span * 100)); }
    var segs = s.segs.map(function (g) { return '<span class="' + g[2] + '" style="width:' + ((g[1] - g[0]) / span * 100).toFixed(2) + '%"></span>'; }).join('');
    var caps = s.caps.map(function (c) { return '<span style="left:' + pct(c).toFixed(2) + '%">' + c + '</span>'; }).join('');
    return '<div class="rail" aria-hidden="true">' + segs + '<i data-pos="' + pct(s.v).toFixed(2) + '" style="left:' + pct(s.v).toFixed(2) + '%"></i></div><div class="cap" aria-hidden="true">' + caps + '</div>';
  }

  function dateText(ts) { return HS.thaiDate.short(new Date(ts)); }

  function chart(series, labels) {
    var W = 300, H = 110, px = 10, py = 12, all = [], t = [];
    series.forEach(function (s) { s.forEach(function (p) { all.push(p.y); t.push(p.t); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), t0 = Math.min.apply(null, t), t1 = Math.max.apply(null, t);
    if (hi === lo) { hi += 1; lo -= 1; }
    function X(tt) { return t1 === t0 ? W / 2 : px + (tt - t0) / (t1 - t0) * (W - 2 * px); }
    function Y(v) { return H - py - (v - lo) / (hi - lo) * (H - 2 * py); }
    var g = '<line class="g" x1="0" x2="' + W + '" y1="' + (H - 1) + '" y2="' + (H - 1) + '"/>';
    var out = series.map(function (s, i) {
      var pts = s.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.y).toFixed(1); }).join(' ');
      return '<polyline class="l' + (i + 1) + '" points="' + pts + '"/>' + s.map(function (p) { return '<circle class="d' + (i + 1) + '" cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="4"/>'; }).join('');
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(labels) + '">' + g + out + '</svg>';
  }

  function trendOf(metric, trends) {
    function simple(list) { return list.map(function (p) { return { t: new Date(p.ts).getTime(), y: p.value }; }); }
    if (metric === 'bmi' || metric === 'waist' || metric === 'fbs') return { series: [simple(trends[metric] || [])], label: '', first: trends[metric] };
    if (metric === 'bp') {
      var b = trends.bp || [];
      return { series: [b.map(function (p) { return { t: new Date(p.ts).getTime(), y: p.sys }; }), b.map(function (p) { return { t: new Date(p.ts).getTime(), y: p.dia }; })], bp: true, first: b };
    }
    return null;
  }

  function detail(r, trends) {
    var tr = trendOf(r.metric, trends), html = '';
    if (tr && tr.first && tr.first.length) {
      var f = tr.first[0], l = tr.first[tr.first.length - 1];
      var fv = tr.bp ? f.sys + '/' + f.dia : f.value, lv = tr.bp ? l.sys + '/' + l.dia : l.value;
      html += '<div><b>แนวโน้ม</b></div>' + chart(tr.series, 'กราฟแนวโน้ม' + HS.rules.metricNames[r.metric]);
      html += '<div class="trend-cap"><span>' + dateText(f.ts) + ' · ' + esc(fv) + '</span><span>' + dateText(l.ts) + ' · ' + esc(lv) + '</span></div>';
      if (tr.bp) html += '<div class="legend">เส้นทึบ = ตัวบน · เส้นประ = ตัวล่าง</div>';
    }
    var table = (window.HS && HS.data && HS.data.advice) || {}, base = r.metric + '.' + r.level;
    var lines = (r.kind && table[base + '.' + r.kind]) || table[base] || [];
    if (lines.length) html += '<div><b>คำแนะนำ</b></div><ul class="advice">' + lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return html;
  }

  function card(metric, r, b) {
    var name = HS.rules.metricNames[metric];
    if (!r) {
      return '<div class="card empty" data-metric="' + metric + '"><div class="row"><span class="lb">' + esc(name) + '</span></div>' +
        '<div class="v muted" style="font-size:22px">ยังไม่มีข้อมูล</div><a href="#record">บันทึกค่านี้</a></div>';
    }
    var valueHtml;
    if (metric === 'lipid' || metric === 'smoke' || metric === 'alcohol') valueHtml = '<div class="v" style="font-size:26px">' + esc(r.label) + '</div>';
    else valueHtml = '<div class="v">' + esc(r.value) + '<small>' + UNIT[metric] + '</small></div>';
    var chips = metric === 'lipid' && r.detail && r.detail.length ? '<div class="small muted">ค่าที่เกินเกณฑ์: ' + r.detail.map(function (d) { return d.toUpperCase(); }).join(', ') + '</div>' : '';
    return '<div class="card" data-metric="' + metric + '" tabindex="0" role="button" aria-expanded="false">' +
      '<div class="row"><span class="lb">' + esc(name) + '<i>' + (r.source === 'station' ? 'จุดบริการ' : 'บ้าน') + '</i></span>' + UI.status(r.level, r.label) + '</div>' +
      valueHtml + chips + rail(r, b.user.heightCm) + '<div class="when">วัดเมื่อ ' + dateText(r.ts) + '</div>' +
      '<div class="detail" hidden>' + detail(r, b.trends) + '</div></div>';
  }

  Screens.book = {
    async render(root, ctx) {
      var b;
      try { b = await ctx.loadBook(true); }
      catch (e) {
        if (e.code === 'not_registered') return;
        root.innerHTML = '<p class="err">' + esc(e.message) + '</p><button class="btn" id="retry">ลองอีกครั้ง</button>';
        UI.$('#retry', root).onclick = function () { Screens.book.render(root, ctx); };
        return;
      }
      var byMetric = {}; b.latest.forEach(function (r) { byMetric[r.metric] = r; });
      var h = '';
      h += '<div class="hello"><div><small>สมุดสุขภาพของ</small><b>' + esc(b.user.name) + '</b></div>' +
        (b.group ? '<span class="badge ' + b.group + '" id="overall">' + UI.SYM[b.group] + ' ' + UI.GROUP[b.group] + '</span>' : '') + '</div>';
      if (b.user.status === 'pending') h += '<div class="panel pending" id="pending-note">รอผู้ดูแลยืนยันการลงทะเบียน — ยังบันทึกผลได้ตามปกติ</div>';
      h += '<div class="next" id="next-recall"><span>นัดวัดซ้ำครั้งถัดไป</span><b class="num">' +
        (b.recall ? HS.thaiDate.short(new Date(b.recall + 'T12:00:00+07:00')) : 'ยังไม่กำหนด') + '</b></div>';
      if (b.badges.safetyNote) h += '<div class="panel safety" id="safety-note">' + esc(b.badges.safetyNote) + '</div>';
      else if (b.badges.praise) h += '<div class="panel praise" id="praise">' + esc(b.badges.praise) + '</div>';
      if (b.topThree.length) h += '<div class="todo" id="top-three"><small>3 เรื่องที่ควรทำก่อน</small><ol>' + b.topThree.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
      h += '<a class="btn" href="#record">บันทึกผลวันนี้</a>';
      ORDER.forEach(function (m) { h += card(m, byMetric[m], b); });
      root.innerHTML = h;

      if (ctx.App.state.justSaved) { // หมุดเลื่อนไปค่าใหม่ 300 ms (เฉพาะหลังบันทึก)
        ctx.App.state.justSaved = false;
        root.classList.add('anim');
        root.querySelectorAll('.rail i').forEach(function (i) { var p = i.getAttribute('data-pos'); i.style.left = '0%'; requestAnimationFrame(function () { requestAnimationFrame(function () { i.style.left = p + '%'; }); }); });
      }
      function toggle(c) {
        var d = c.querySelector('.detail'), open = d.hidden;
        d.hidden = !open; c.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      root.querySelectorAll('.card[tabindex]').forEach(function (c) {
        c.addEventListener('click', function (e) { if (!e.target.closest('.detail')) toggle(c); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c); } });
      });
    }
  };
})();
