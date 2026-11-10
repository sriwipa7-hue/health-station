/* HS.book — ประกอบ "สมุดสุขภาพ" ของผู้ใช้หนึ่งคน (สเปกข้อ 5). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined') {
  ['rules', 'thai-date', 'advice', 'weeks', 'badges'].forEach(function (m) {
    var key = m === 'thai-date' ? 'thaiDate' : m;
    if (!HS[key]) require('./' + m + '.js');
  });
}

HS.book = (function () {
  var DAY = 86400000;
  function time(x) { return (x instanceof Date ? x : new Date(x)).getTime(); }
  // วันที่ปฏิทินไทยเป็น 'YYYY-MM-DD'
  function isoDay(x) { return new Date(time(x) + 7 * 3600 * 1000).toISOString().slice(0, 10); }

  // trainingDates ของผู้ใช้ = รายการใน settings.cohorts ที่ project + cohort ตรงกัน
  function trainingDatesOf(user, settings) {
    var list = (settings && settings.cohorts) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].project === user.project && String(list[i].cohort) === String(user.cohort || '')) {
        return { pre: list[i].pre, post: list[i].post };
      }
    }
    return null;
  }
  function withDates(user, settings) {
    var copy = {};
    for (var k in user) copy[k] = user[k];
    copy.heightCm = Number(user.heightCm);
    copy.trainingDates = trainingDatesOf(user, settings);
    return copy;
  }

  function sorted(ms) { return ms.slice().sort(function (a, b) { return time(a.ts) - time(b.ts); }); }
  function rowsOf(ms, metric) { return sorted(ms).filter(function (m) { return m.metric === metric; }); }
  function lastOf(ms, metric) { var s = rowsOf(ms, metric); return s.length ? s[s.length - 1] : null; }
  function stamp(r, row) { r.ts = row.ts; r.source = row.source; return r; }

  // ผลล่าสุดของตัวเลขสุขภาพ 7 ตัว (เฉพาะที่เคยบันทึก)
  function latest(ms, user) {
    var out = [], w = lastOf(ms, 'weight'), row, h = user.heightCm;
    if (w && h) out.push(stamp(HS.rules.bmi(w.value, h), w));
    if ((row = lastOf(ms, 'waist'))) out.push(stamp(HS.rules.waist(row.value, h), row));
    if ((row = lastOf(ms, 'bp'))) out.push(stamp(HS.rules.bp(row.value.sys, row.value.dia), row));
    if ((row = lastOf(ms, 'fbs'))) out.push(stamp(HS.rules.fbs(row.value), row));
    if ((row = lastOf(ms, 'lipid'))) out.push(stamp(HS.rules.lipid(row.value), row));
    if ((row = lastOf(ms, 'smoke'))) out.push(stamp(HS.rules.smoke(row.value), row));
    if ((row = lastOf(ms, 'alcohol'))) out.push(stamp(HS.rules.alcohol(row.value), row));
    return out;
  }

  function trends(ms) {
    function plain(metric) { return rowsOf(ms, metric).map(function (m) { return { ts: m.ts, value: m.value }; }); }
    return {
      weight: plain('weight'), waist: plain('waist'), bmi: plain('bmi'), fbs: plain('fbs'),
      bp: rowsOf(ms, 'bp').map(function (m) { return { ts: m.ts, sys: m.value.sys, dia: m.value.dia }; })
    };
  }

  function weeks(user, exercise, now) {
    var td = user.trainingDates, per = [], i, w;
    if (!td) return null;
    for (i = 0; i < 12; i++) per.push(0);
    for (i = 0; i < exercise.length; i++) {
      w = HS.weeks.index(td.pre, exercise[i].ts);
      if (w >= 1 && w <= 12) per[w - 1] += Number(exercise[i].minutes) || 0;
    }
    return { index: HS.weeks.index(td.pre, now), logged: HS.weeks.logged(exercise, td.pre),
      minutesThisWeek: HS.weeks.minutesThisWeek(exercise, td.pre, now), perWeek: per };
  }

  // ฟอร์มที่ถึงกำหนด (ข้อ R3) เฉพาะ HBHW ที่มีวันอบรม
  function formsDue(user, assessments, now) {
    var td = user.trainingDates, today = isoDay(now), out = [];
    if (user.project !== 'HBHW' || !td) return out;
    function done(form, phase) {
      return assessments.some(function (a) { return a.form === form && a.phase === phase; });
    }
    function add(form, phase) { if (!done(form, phase)) out.push({ form: form, phase: phase }); }
    if (today >= td.pre) { add('hbhw_quiz', 'pre'); add('st5', 'pre'); }
    if (today >= td.post) { add('hbhw_quiz', 'post'); add('st5', 'post'); add('satisfaction', 'post'); }
    return out;
  }

  // ค่าสถานีครั้งแรกของแต่ละเฟส (ก่อน/หลังอบรม)
  function compare(ms) {
    function pick(phase) {
      var rows = sorted(ms).filter(function (m) { return m.source === 'station' && m.phase === phase; });
      if (!rows.length) return null;
      var o = { weight: null, waist: null, bmi: null, bp: null };
      for (var k in o) for (var i = 0; i < rows.length; i++) if (rows[i].metric === k) { o[k] = rows[i].value; break; }
      return o;
    }
    return { pre: pick('pre'), post: pick('post') };
  }

  function recallOf(mine) {
    var d = mine.appointment && mine.appointment.date;
    if (!d) return null;
    return d instanceof Date ? isoDay(d) : String(d).slice(0, 10);
  }

  // extra.newBadges: เหรียญที่เพิ่งได้ในคำขอนี้ (อ่านอย่างเดียวไม่มี)
  function build(user0, mine, deps, extra) {
    var settings = deps.settings, now = deps.now(), user = withDates(user0, settings);
    var ms = mine.measurements || [], res = latest(ms, user), group = HS.advice.overall(res);
    var ev = HS.badges.evaluate({ measurements: ms, exercise: mine.exercise || [], assessments: mine.assessments || [],
      user: user, earned: mine.earned || [], groupBefore: group, groupAfter: group }, settings);
    return {
      user: { userId: user.userId, name: user.name, project: user.project, cohort: user.cohort || '', dept: user.dept || '',
        status: user.status, heightCm: user.heightCm },
      latest: res, group: group, recall: recallOf(mine),
      topThree: HS.advice.topThree(res, deps.advice || {}),
      trends: trends(ms), weeks: weeks(user, mine.exercise || [], now),
      badges: { earned: (mine.earned || []).slice(), newBadges: (extra && extra.newBadges) || [], praise: ev.praise, safetyNote: ev.safetyNote },
      formsDue: formsDue(user, mine.assessments || [], now), compare: compare(ms), trainingDates: user.trainingDates
    };
  }

  return { build: build, latest: latest, isoDay: isoDay, withDates: withDates, trainingDatesOf: trainingDatesOf, formsDue: formsDue };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
