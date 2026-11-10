/* ก่อน–หลังอบรม (#compare) — เฉพาะ HBHW: น้ำหนัก รอบเอว BMI ความดัน (ค่าสถานีครั้งแรกของแต่ละเฟส) */
window.Screens = window.Screens || {};
(function () {
  var esc = function (s) { return UI.esc(s); };
  var MINUS = '−';
  function fmt(n, dec) { return dec ? Number(n).toFixed(dec) : String(Number(n)); }
  function signed(d, dec) { var r = Math.round(d * 10) / 10; return (r < 0 ? MINUS : r > 0 ? '+' : '') + (dec ? Math.abs(r).toFixed(1) : String(Math.abs(r))); }
  function change(d, dec, text) {
    var r = Math.round(d * 10) / 10;
    if (r === 0) return '<span class="st">เท่าเดิม</span>';
    return '<span class="st ' + (r < 0 ? 'ok' : 'risk') + '">' + (r < 0 ? '▼' : '▲') + ' (' + text + ')</span>';
  }

  Screens.compare = {
    async render(root, ctx) {
      var book = await ctx.loadBook(true), h = '<a class="back" href="#book">‹ กลับสมุดของฉัน</a><h1>ก่อน–หลังอบรม</h1>';
      if (book.user.project !== 'HBHW') {
        root.innerHTML = h + '<div class="panel" id="compare-note">หน้านี้สำหรับผู้เข้าร่วมโครงการสุขภาพกายใจบุคลากร (HBHW) ค่ะ</div>'; return;
      }
      var c = book.compare || {}, pre = c.pre, post = c.post, td = book.trainingDates;
      var postDate = td && td.post ? HS.thaiDate.short(new Date(td.post + 'T00:00:00+07:00')) : '';
      var pendingText = 'ยังไม่มีผลหลังอบรม' + (postDate ? ' (อบรมครั้งที่ 2: ' + postDate + ')' : '');
      if (!pre && !post) {
        root.innerHTML = h + '<div class="panel" id="compare-note">ยังไม่มีผลที่วัดที่จุดบริการวันอบรม — เมื่อวัดแล้วจะเห็นผลก่อนและหลังอบรมที่นี่ค่ะ</div>'; return;
      }
      var rows = [
        { id: 'weight', label: 'น้ำหนัก', unit: 'กก.', dec: 1 },
        { id: 'waist', label: 'รอบเอว', unit: 'ซม.', dec: 0 },
        { id: 'bmi', label: 'ดัชนีมวลกาย (BMI)', unit: '', dec: 1 },
        { id: 'bp', label: 'ความดันโลหิต', unit: 'มม.ปรอท', dec: 0 }
      ];
      rows.forEach(function (r) {
        var a = pre && pre[r.id], b = post && post[r.id], bp = r.id === 'bp', body;
        function show(v) { return v === null || v === undefined ? null : bp ? v.sys + '/' + v.dia : fmt(v, r.dec); }
        if (show(a) === null) body = '<span class="muted">ยังไม่มีผลก่อนอบรม</span>';
        else if (show(b) === null) body = '<span class="num big">' + show(a) + '</span> <span class="unit">' + r.unit + '</span><div class="small muted">' + esc(pendingText) + '</div>';
        else {
          var chg = bp ? change(b.sys - a.sys, 0, signed(b.sys - a.sys, 0) + '/' + signed(b.dia - a.dia, 0)) : change(b - a, r.dec, signed(b - a, r.dec));
          body = '<span class="num big">' + show(a) + ' → ' + show(b) + '</span> <span class="unit">' + r.unit + '</span><div>' + chg + '</div>';
        }
        h += '<div class="card cmp empty" id="compare-' + r.id + '"><div class="lb">' + r.label + '</div><div>' + body + '</div></div>';
      });
      h += '<p class="small muted">เทียบค่าที่วัดครั้งแรกที่จุดบริการในวันอบรมแต่ละครั้ง</p>';
      root.innerHTML = h;
    }
  };
})();
