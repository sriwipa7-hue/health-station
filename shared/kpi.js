/* HS.kpi — ตัวชี้วัดโครงการ HBHW และแถวทะเบียน Excel (สเปกข้อ 10). Pattern: see hs.js
 *
 * ตรงกับสูตรในไฟล์ "4.แบบฟอร์มเก็บข้อมูลและสรุปตัวชี้วัด Happy Body ปี2570.xlsx" (แท็บ สรุปตัวชี้วัด):
 *  PI1 ผ่าน = มีน้ำหนักทั้ง pre และ post (SUMIF X=1)      ฐาน = ผู้ใช้ HBHW ที่ approved (COUNTA B)
 *  PI2 ผ่าน = คะแนน quiz post >= quizPass (SUMIF Y=1)      ฐาน = คนที่มีคะแนน post (COUNT M)
 *  PI3 ผ่าน = ROUND(น้ำหนัก pre-post,1)>0 หรือ ROUND(รอบเอว pre-post,1)>0 (SUMIF U=1)
 *      ฐาน = คนที่มีคู่น้ำหนัก หรือ คู่รอบเอว (COUNT U)
 *  PI4 ผ่าน = สัปดาห์ที่บันทึก >= 6 (SUMIF W=1)            ฐาน = approved HBHW ทุกคน (สัปดาห์ = 0 ถ้าไม่มี)
 *  pct = ROUND(pass/base*100, 1) (ปัดครึ่งออกจากศูนย์แบบ Excel) ; base = 0 -> pct = null
 * ใช้เฉพาะ source:'station' ช่วง pre/post ค่าแรกสุด (ตาม ts) ของแต่ละช่วง; quiz ครั้งแรกของแต่ละช่วง;
 * ผู้ใช้ status:'pending' หรือไม่ใช่ project HBHW ไม่นับ
 *
 * registerRows key -> คอลัมน์ในแท็บ ทะเบียนบันทึกผล (Task 11 เขียนลงเฉพาะคอลัมน์กรอก ห้ามทับสูตร):
 *  name B · dept C · cohort D · sex E · heightCm F · weight1 G · waist1 I · bp1 J ('sys/dia')
 *  st5_1 K · scorePre L · scorePost M · weight2 N · waist2 P · bp2 Q · st5_2 R · weeksLogged V
 *  (userId ไม่มีคอลัมน์ ใช้อ้างอิงเท่านั้น) ; ไม่มีค่า = null
 */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined' && !HS.weeks) {
  require('./weeks.js'); // Node: โหลด weeks เข้า HS เดียวกัน
}
if (typeof require === 'function' && typeof module !== 'undefined' && !HS.book) {
  require('./book.js'); // overview ใช้ HS.book.latest + HS.advice.overall
}

HS.kpi = (function () {
  function tsOf(x) { return new Date(x.ts).getTime(); }
  function byTs(a, b) { return tsOf(a) - tsOf(b); }
  function round1(n) { return Math.floor(n * 10 + 0.5 + 1e-9) / 10; } // n >= 0 เท่านั้น
  function roundSigned1(n) { return (n < 0 ? -1 : 1) * round1(Math.abs(n)); }
  function pct(pass, base) { return base ? Math.floor(pass * 1000 / base + 0.5 + 1e-9) / 10 : null; }
  function result(pass, base) { return { pass: pass, base: base, pct: pct(pass, base) }; }

  function groupBy(rows, key) {
    var m = {}, i, k;
    for (i = 0; i < rows.length; i++) {
      k = rows[i][key];
      (m[k] || (m[k] = [])).push(rows[i]);
    }
    return m;
  }

  function cohortUsers(users) {
    var out = [], i;
    for (i = 0; i < users.length; i++) {
      if (users[i].project === 'HBHW' && users[i].status === 'approved') out.push(users[i]);
    }
    return out;
  }

  // ค่าแรกสุดของ metric ในช่วง phase จาก station
  function firstStation(ms, metric, phase) {
    var best = null, i, m;
    for (i = 0; i < ms.length; i++) {
      m = ms[i];
      if (m.source !== 'station' || m.metric !== metric || m.phase !== phase) continue;
      if (m.value === null || m.value === undefined) continue;
      if (!best || tsOf(m) < tsOf(best)) best = m;
    }
    return best ? best.value : null;
  }
  function firstAssessment(as, form, phase) {
    var best = null, i, a;
    for (i = 0; i < as.length; i++) {
      a = as[i];
      if (a.form !== form || a.phase !== phase) continue;
      if (a.score === null || a.score === undefined) continue;
      if (!best || tsOf(a) < tsOf(best)) best = a;
    }
    return best ? best.score : null;
  }
  function bpText(v) { return v && v.sys != null && v.dia != null ? v.sys + '/' + v.dia : null; }

  function registerRows(users, measurements, assessments, exercise) {
    var ms = groupBy(measurements || [], 'userId');
    var as = groupBy(assessments || [], 'userId');
    var ex = groupBy(exercise || [], 'userId');
    var list = cohortUsers(users || []), rows = [], i, u, m, a, e, td;
    for (i = 0; i < list.length; i++) {
      u = list[i]; m = ms[u.userId] || []; a = as[u.userId] || []; e = ex[u.userId] || [];
      td = u.trainingDates && u.trainingDates.pre;
      rows.push({
        userId: u.userId,
        name: u.name, dept: u.dept == null ? null : u.dept, cohort: u.cohort == null ? null : u.cohort,
        sex: u.sex == null ? null : u.sex, heightCm: u.heightCm == null ? null : u.heightCm,
        weight1: firstStation(m, 'weight', 'pre'), waist1: firstStation(m, 'waist', 'pre'),
        bp1: bpText(firstStation(m, 'bp', 'pre')), st5_1: firstAssessment(a, 'st5', 'pre'),
        scorePre: firstAssessment(a, 'hbhw_quiz', 'pre'), scorePost: firstAssessment(a, 'hbhw_quiz', 'post'),
        weight2: firstStation(m, 'weight', 'post'), waist2: firstStation(m, 'waist', 'post'),
        bp2: bpText(firstStation(m, 'bp', 'post')), st5_2: firstAssessment(a, 'st5', 'post'),
        weeksLogged: td ? HS.weeks.logged(e.slice().sort(byTs), td) : 0
      });
    }
    return rows;
  }

  function hbhw(users, measurements, assessments, exercise, settings) {
    var rows = registerRows(users, measurements, assessments, exercise);
    var quizPass = settings && typeof settings.quizPass === 'number' ? settings.quizPass : 8;
    var p1 = 0, p2 = 0, b2 = 0, p3 = 0, b3 = 0, p4 = 0, i, r, ds, dw, hasW, hasA;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (r.weight1 !== null && r.weight2 !== null) p1++;
      if (r.scorePost !== null) { b2++; if (r.scorePost >= quizPass) p2++; }
      hasW = r.weight1 !== null && r.weight2 !== null;
      hasA = r.waist1 !== null && r.waist2 !== null;
      if (hasW || hasA) {
        b3++;
        ds = hasW ? roundSigned1(r.weight1 - r.weight2) : 0;
        dw = hasA ? roundSigned1(r.waist1 - r.waist2) : 0;
        if (ds > 0 || dw > 0) p3++;
      }
      if (r.weeksLogged >= 6) p4++;
    }
    return { pi1: result(p1, rows.length), pi2: result(p2, b2), pi3: result(p3, b3), pi4: result(p4, rows.length) };
  }

  // key ของ registerRows -> คอลัมน์ในแท็บ ทะเบียนบันทึกผล (แหล่งเดียว: Export.gs และ scripts/export_check.py ใช้ตัวนี้)
  // A = ลำดับ (ตัวส่งออกเขียนเลขวิ่งเอง) ; คอลัมน์สูตร H O S T U W X Y ห้ามเขียน
  var REGISTER_COLUMNS = { name: 'B', dept: 'C', cohort: 'D', sex: 'E', heightCm: 'F', weight1: 'G', waist1: 'I', bp1: 'J',
    st5_1: 'K', scorePre: 'L', scorePost: 'M', weight2: 'N', waist2: 'P', bp2: 'Q', st5_2: 'R', weeksLogged: 'V' };

  // ภาพรวมกลุ่มล่าสุดของผู้ใช้ที่ approved (ทุกโครงการ) — นับเท่านั้น ไม่มีชื่อ/รหัสผู้ใช้
  function overview(users, measurements) {
    var ms = groupBy(measurements || [], 'userId');
    var out = { counts: { ok: 0, risk: 0, sick: 0, none: 0 }, byTambon: {}, byDept: {} }, i, u, g;
    function bump(map, key, g) {
      var k = key === null || key === undefined || key === '' ? 'ไม่ระบุ' : String(key);
      if (!map[k]) map[k] = { ok: 0, risk: 0, sick: 0 };
      map[k][g]++;
    }
    for (i = 0; i < (users || []).length; i++) {
      u = users[i];
      if (u.status !== 'approved') continue;
      g = HS.advice.overall(HS.book.latest(ms[u.userId] || [], { heightCm: Number(u.heightCm) }));
      if (g === null) { out.counts.none++; continue; }
      out.counts[g]++;
      bump(out.byTambon, u.tambon, g);
      bump(out.byDept, u.dept, g);
    }
    return out;
  }

  return { hbhw: hbhw, registerRows: registerRows, overview: overview, REGISTER_COLUMNS: REGISTER_COLUMNS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
