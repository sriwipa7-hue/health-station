/* เหรียญรางวัล (#rewards) — 8 เหรียญ ได้แล้วทึบ ยังไม่ได้เป็นเส้นขอบ + วิธีได้ */
window.Screens = window.Screens || {};
window.BadgeInfo = (function () {
  var LIST = [
    { code: 'first_record', mark: '1st', name: 'บันทึกครั้งแรก', how: 'บันทึกตัวเลขสุขภาพครั้งแรก' },
    { code: 'all_seven', mark: '7/7', name: 'ครบ 7 ตัวเลข', how: 'บันทึกให้ครบทั้ง 7 ตัวเลข' },
    { code: 'six_rounds', mark: '6R', name: 'ส่งครบ 6 รอบ', how: 'ชั่งน้ำหนักให้ครบทุกรอบใน 12 สัปดาห์' },
    { code: 'four_weeks_150', mark: '4W', name: 'ออกกำลังกาย 4 สัปดาห์ติด', how: 'ออกกำลังกายสัปดาห์ละ 150 นาทีขึ้นไป 4 สัปดาห์ติดกัน' },
    { code: 'waist_minus2', mark: '−2', name: 'รอบเอวลด 2 ซม.', how: 'รอบเอวลดลงอย่างน้อย 2 ซม. จากครั้งแรก' },
    { code: 'weight_minus5pct', mark: '−5%', name: 'น้ำหนักลด 5%', how: 'น้ำหนักลดลง 5% จากครั้งแรก' },
    { code: 'risk_to_ok', mark: 'OK', name: 'จากเสี่ยงเป็นปกติ', how: 'ปรับค่าสุขภาพจากกลุ่มเสี่ยงให้กลับมาปกติ' },
    { code: 'all_forms', mark: 'ALL', name: 'ทำแบบประเมินครบ', how: 'ทำแบบประเมินของโครงการครบทุกชุด' }
  ];
  function find(code) { return LIST.filter(function (b) { return b.code === code; })[0]; }
  function medal(b, earned) { return '<b class="medal-dot' + (earned ? ' on' : '') + '" aria-hidden="true">' + UI.esc(b.mark) + '</b>'; }
  return { list: LIST, find: find, medal: medal };
})();

(function () {
  var esc = function (s) { return UI.esc(s); };
  Screens.rewards = {
    async render(root, ctx) {
      var book = await ctx.loadBook(true), earned = book.badges.earned || [], hbhw = book.user.project === 'HBHW';
      var n = BadgeInfo.list.filter(function (b) { return earned.indexOf(b.code) >= 0; }).length;
      var h = '<a class="back" href="#book">‹ กลับสมุดของฉัน</a><h1>เหรียญรางวัล</h1>' +
        '<p id="reward-count">ได้แล้ว <b class="num">' + n + '</b> จาก ' + BadgeInfo.list.length + ' เหรียญ</p>';
      BadgeInfo.list.forEach(function (b) {
        var on = earned.indexOf(b.code) >= 0;
        h += '<div class="reward' + (on ? ' earned' : '') + '" data-code="' + b.code + '">' + BadgeInfo.medal(b, on) +
          '<div><div class="rname">' + esc(b.name) + '</div><div class="rhow">' + (on ? '● ได้รับแล้ว — ' : '') + esc(b.how) + '</div>' +
          (b.code === 'all_forms' && !hbhw ? '<div class="rhow">เหรียญนี้สำหรับผู้เข้าร่วมโครงการ HBHW</div>' : '') + '</div></div>';
      });
      root.innerHTML = h;
    }
  };
})();
