/* HS.receivers — ตัวรับงานหลังบันทึก (สเปกข้อ 4): 12 สัปดาห์ -> ส่งต่อ -> นัดวัดซ้ำ -> รางวัล -> สรุป
 * แต่ละตัวรับ ctx = { deps, user (มี trainingDates), mine (อ่านหลังบันทึก), groupBefore, st5?, requestId, newBadges[] }
 * Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined') {
  ['rules', 'advice', 'badges', 'referral', 'book'].forEach(function (m) { if (!HS[m]) require('./' + m + '.js'); });
}

HS.receivers = (function () {
  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : String(vars[k]); });
  }

  // round ถูกกำหนดตอนสร้างแถวแล้ว (weeks.round) — เก็บเป็นจุดต่อขยาย
  function twelveWeek() {}
  // T11 อ่านสรุปจากชีตโดยตรง
  function summary() {}

  function referral(ctx) {
    var repo = ctx.deps.repo, st = ctx.deps.settings, user = ctx.user;
    var results = HS.book.latest(ctx.mine.measurements, user);
    var wanted = HS.referral.decide(results, ctx.st5 || null, user);
    wanted.forEach(function (w) {
      if (repo.hasOpenReferral(user.userId, w.dest)) return;
      var id = repo.enqueueReferral({ ts: ctx.deps.now().toISOString(), userId: user.userId, dest: w.dest, reason: w.reason,
        status: 'รอ', alerted: false });
      if (w.dest === 'MENTAL') { // สุขภาพจิตแจ้งผู้ดูแลทันที ไม่รอรอบเช้า
        var sent = ctx.deps.alertAdmin(fill(st.messages && st.messages.adminAlert, { name: user.name }));
        if (sent === true) repo.markReferralAlerted(id);
      }
    });
  }

  function recall(ctx) {
    var res = HS.book.latest(ctx.mine.measurements, ctx.user), group = HS.advice.overall(res), now = ctx.deps.now();
    if (!group) return;
    var date = HS.book.isoDay(HS.advice.recallDate(group, now, ctx.deps.settings));
    ctx.deps.repo.upsertAppointment({ userId: ctx.user.userId, group: group, date: date, sent: false });
  }

  function rewards(ctx) {
    var res = HS.book.latest(ctx.mine.measurements, ctx.user), after = HS.advice.overall(res);
    var ev = HS.badges.evaluate({ measurements: ctx.mine.measurements, exercise: ctx.mine.exercise,
      assessments: ctx.mine.assessments, user: ctx.user, earned: ctx.mine.earned,
      groupBefore: ctx.groupBefore, groupAfter: after }, ctx.deps.settings);
    if (ev.newBadges.length) {
      ctx.deps.repo.addBadges(ctx.user.userId, ev.newBadges);
      ctx.newBadges = ctx.newBadges.concat(ev.newBadges);
    }
  }

  var ALL = { twelveWeek: twelveWeek, referral: referral, recall: recall, rewards: rewards, summary: summary };

  // เรียงตามสเปก; ตัวไหนล้มให้บันทึกลง งานค้าง แล้วทำตัวถัดไปต่อ
  function run(names, ctx) {
    names.forEach(function (n) {
      try { ALL[n](ctx); }
      catch (e) {
        try { ctx.deps.repo.addPending({ ts: ctx.deps.now().toISOString(), receiver: n, ref: ctx.requestId || '', error: String(e && e.message || e) }); }
        catch (e2) { /* ไม่มีที่ให้บันทึกแล้ว — คำขอหลักยังสำเร็จ */ }
      }
    });
  }

  return { run: run, ALL: ALL };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
