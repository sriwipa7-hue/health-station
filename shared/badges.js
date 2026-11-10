/* HS.badges — เหรียญ คำชม และข้อความความปลอดภัย (สเปกข้อ 9). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined') {
  if (!HS.rules) require('./rules.js');
  if (!HS.weeks) require('./weeks.js');
}

HS.badges = (function () {
  var DAY = 86400000;
  var SEVEN = ['bmi', 'waist', 'bp', 'fbs', 'lipid', 'smoke', 'alcohol'];
  var SAFETY = 'ลดน้ำหนักอย่างค่อยเป็นค่อยไป สัปดาห์ละ 0.5–1 กก.';
  var PRAISE_NAMES = { weight: 'น้ำหนัก', waist: 'รอบเอว', bp: 'ความดันโลหิต', fbs: 'น้ำตาลในเลือด' };

  function time(x) { return (x instanceof Date ? x : new Date(x)).getTime(); }
  // แถวของ metric เรียงเก่า -> ใหม่
  function series(ms, metric) {
    var out = [];
    for (var i = 0; i < ms.length; i++) if (ms[i].metric === metric) out.push(ms[i]);
    out.sort(function (a, b) { return time(a.ts) - time(b.ts); });
    return out;
  }
  function num(row, metric) { return metric === 'bp' ? row.value.sys : row.value; }
  function trainingPre(user) { return user && user.trainingDates && user.trainingDates.pre; }

  function sixRounds(ms, user) {
    var pre = trainingPre(user), got = {}, ws = series(ms, 'weight');
    if (!pre) return false;
    for (var i = 0; i < ws.length; i++) {
      var r = (typeof ws[i].round === 'number') ? ws[i].round : HS.weeks.round(pre, ws[i].ts);
      if (r >= 1 && r <= 6) got[r] = true;
    }
    for (var n = 1; n <= 6; n++) if (!got[n]) return false;
    return true;
  }
  function consecutiveWeeks(exercise, user, goal) {
    var pre = trainingPre(user), mins = [], i, w, run = 0;
    if (!pre) return false;
    for (w = 0; w <= 12; w++) mins.push(0);
    for (i = 0; i < exercise.length; i++) {
      w = HS.weeks.index(pre, exercise[i].ts);
      if (w >= 1 && w <= 12) mins[w] += Number(exercise[i].minutes) || 0;
    }
    for (w = 1; w <= 12; w++) {
      run = mins[w] >= goal ? run + 1 : 0;
      if (run >= 4) return true;
    }
    return false;
  }
  function hasForm(as, form, phase) {
    for (var i = 0; i < as.length; i++) if (as[i].form === form && (!phase || as[i].phase === phase)) return true;
    return false;
  }

  function newestBmi(ms, user) {
    var b = series(ms, 'bmi'), w = series(ms, 'weight');
    // ใช้ค่าล่าสุดระหว่างแถว bmi กับ BMI ที่คำนวณจากน้ำหนักล่าสุด
    var lastB = b.length ? b[b.length - 1] : null, lastW = w.length ? w[w.length - 1] : null;
    if (lastW && user && user.heightCm && (!lastB || time(lastW.ts) > time(lastB.ts))) {
      return HS.rules.bmi(lastW.value, user.heightCm).value;
    }
    return lastB ? lastB.value : null;
  }
  function weightSafety(ms, user) {
    var ws = series(ms, 'weight'), bmi = newestBmi(ms, user), i;
    if (bmi !== null && bmi < 18.5) return true;
    if (ws.length >= 2) {
      var last = ws[ws.length - 1], t = time(last.ts);
      for (i = 0; i < ws.length - 1; i++) {
        var dt = t - time(ws[i].ts);
        if (dt >= 0 && dt <= 7 * DAY && ws[i].value - last.value > 2) return true;
      }
    }
    return false;
  }
  function praise(ms) {
    var order = ['weight', 'waist', 'bp', 'fbs'];
    for (var i = 0; i < order.length; i++) {
      var s = series(ms, order[i]);
      if (s.length >= 2 && num(s[s.length - 1], order[i]) < num(s[s.length - 2], order[i])) {
        return PRAISE_NAMES[order[i]] + 'ดีขึ้นจากครั้งก่อน เก่งมากค่ะ';
      }
    }
    return null;
  }

  function evaluate(ctx, settings) {
    var ms = ctx.measurements || [], user = ctx.user || {}, earned = ctx.earned || [];
    var goal = settings && settings.weeklyMinutesGoal, found = [], i;
    function award(code, cond) { if (cond && earned.indexOf(code) < 0) found.push(code); }

    award('first_record', ms.length >= 1);
    var all7 = true;
    for (i = 0; i < SEVEN.length; i++) if (series(ms, SEVEN[i]).length === 0) all7 = false;
    award('all_seven', all7);
    award('six_rounds', sixRounds(ms, user));
    award('four_weeks_150', consecutiveWeeks(ctx.exercise || [], user, goal));
    var wa = series(ms, 'waist'), wt = series(ms, 'weight');
    award('waist_minus2', wa.length >= 2 && wa[wa.length - 1].value <= wa[0].value - 2);
    award('weight_minus5pct', wt.length >= 2 && wt[wt.length - 1].value <= wt[0].value * 0.95);
    award('risk_to_ok', ctx.groupBefore === 'risk' && ctx.groupAfter === 'ok');
    var as = ctx.assessments || [];
    award('all_forms', user.project === 'HBHW' && hasForm(as, 'hbhw_quiz', 'pre') && hasForm(as, 'hbhw_quiz', 'post') &&
      hasForm(as, 'st5', 'pre') && hasForm(as, 'st5', 'post') && hasForm(as, 'satisfaction'));

    var unsafe = weightSafety(ms, user);
    return { newBadges: found, praise: unsafe ? null : praise(ms), safetyNote: unsafe ? SAFETY : null };
  }
  return { evaluate: evaluate };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
