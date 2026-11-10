/* HS.notifyPlan — แผนแจ้งเตือนประจำวันและตัวกันโควตา (สเปกข้อ 10). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.notifyPlan = (function () {
  var DAY = 86400000;
  function toDate(x) { return x instanceof Date ? x : new Date(x); }
  function dayNum(x) { return Math.floor((toDate(x).getTime() + 7 * 3600 * 1000) / DAY); }
  function isoDay(x) { return new Date(toDate(x).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : String(vars[k]); });
  }
  function reachable(u) { return u.status === 'approved' && !!u.lineId; }
  function inProgram(u) { return u.project === 'HBHW' || u.project === 'DPAC'; }

  function today(state, quota, settings) {
    var msgs = settings.messages || {};
    var users = state.users || [], byId = {}, i, j, u;
    for (i = 0; i < users.length; i++) byId[users[i].userId] = users[i];
    var todayN = dayNum(state.today);
    var alerts = [], reminders = [], recalls = [], announce = [], seenCohort = {};

    // รอบชั่งน้ำหนัก
    for (i = 0; i < users.length; i++) {
      u = users[i];
      if (u.status !== 'approved' || !inProgram(u) || !u.trainingDates || !u.trainingDates.pre) continue;
      var day = todayN - dayNum(u.trainingDates.pre);
      if (day < 14) continue;
      var n = Math.floor(day / 14), off = day - 14 * n;
      if (n > 6 || (off !== 0 && off !== 2)) continue;
      var closeDate = HS.thaiDate.short(new Date(toDate(state.today).getTime() + (4 - off) * DAY));
      if (off === 0) {
        var key = n + '|' + u.cohort;
        if (!seenCohort[key]) {
          seenCohort[key] = true;
          announce.push(fill(msgs.announce, { cohort: u.cohort, round: n, closeDate: closeDate }));
        }
        continue;
      }
      if (!u.lineId) continue;
      var submitted = false, ms = state.measurements || [];
      for (j = 0; j < ms.length; j++) {
        if (ms[j].userId === u.userId && ms[j].metric === 'weight') {
          var md = dayNum(ms[j].ts) - dayNum(u.trainingDates.pre);
          if (md >= 14 * n && md <= 14 * n + 4) { submitted = true; break; }
        }
      }
      if (!submitted) {
        reminders.push({ to: u.lineId, kind: 'round_reminder', ref: { type: 'round', userId: u.userId, round: n },
          text: fill(msgs.roundReminder, { name: u.name, round: n, closeDate: closeDate }), userId: u.userId, name: u.name });
      }
    }

    // วันนัดวัดซ้ำ
    var todayIso = isoDay(state.today), apps = state.appointments || [];
    for (i = 0; i < apps.length; i++) {
      u = byId[apps[i].userId];
      if (!u || apps[i].sent || apps[i].date !== todayIso || !reachable(u)) continue;
      if (u.trainingDates && u.trainingDates.pre) {
        var wk = HS.weeks.index(u.trainingDates.pre, state.today);
        if (wk >= 1 && wk <= 12) continue;
      }
      recalls.push({ to: u.lineId, kind: 'recall', ref: { type: 'appointment', userId: u.userId },
        text: fill(msgs.recall, { name: u.name }), userId: u.userId, name: u.name });
    }

    // แจ้งผู้ดูแล (ความเครียด)
    var admins = settings.adminLineIds || [], refs = state.referrals || [];
    for (i = 0; i < refs.length; i++) {
      // เฉพาะที่ยังรอ: ผู้ดูแลกดรับเรื่องแล้ว (status ไม่ใช่ 'รอ') ไม่ต้องแจ้งซ้ำแม้การแจ้งครั้งแรกล้มเหลว
      if (refs[i].dest !== 'MENTAL' || refs[i].alerted || refs[i].status !== 'รอ') continue;
      u = byId[refs[i].userId];
      var nm = u ? u.name : '';
      for (j = 0; j < admins.length; j++) {
        alerts.push({ to: admins[j], kind: 'admin_alert', ref: { type: 'referral', userId: refs[i].userId, id: refs[i].id },
          text: fill(msgs.adminAlert, { name: nm }), userId: refs[i].userId, name: nm });
      }
    }

    // โควตา
    var used = Number(quota.used) || 0, limit = Number(quota.limit) || 0, stop = Number(settings.quotaStop) || 0;
    var alertCap = Math.max(0, limit - used);
    var push = [], manual = [];
    function place(items, cap) {
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        if (k < cap) push.push({ to: it.to, kind: it.kind, text: it.text, ref: it.ref });
        else manual.push({ userId: it.userId, name: it.name, text: it.text });
      }
    }
    place(alerts, alertCap);
    var alertsPushed = push.length;
    // งบรวมใช้ร่วมกัน: ข้อความอื่นใช้ได้ไม่เกิน min(stop, limit) − used − ที่แจ้งเตือนส่งไปแล้ว
    var otherCap = Math.max(0, Math.min(stop, limit) - used - alertsPushed);
    place(reminders.concat(recalls), otherCap);

    var emailAdmin = (manual.length > 0 || used >= stop) ? fill(msgs.quotaEmail, { count: manual.length }) : null;
    return { push: push, manual: manual, announce: announce, emailAdmin: emailAdmin };
  }
  return { today: today };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
