/* HS.handlers — ตัวจัดการคำขอจากหน้าเว็บ (สเปกข้อ 3–4). Pattern: see hs.js
 * handle({action, idToken, payload, requestId}, deps) -> {ok:true, data} | {ok:false, code, error, message?} (R13)
 * คำขอบันทึก (save*) ต้องมี requestId เสมอ; repo.seenRequest/markRequest(userId, requestId) นับซ้ำแยกตามผู้ใช้
 * deps = { verify, repo, now, settings, advice, forms, alertAdmin, linkMenu } — ฟังก์ชันล้วน ไม่แตะ Sheet โดยตรง
 * ตัวตนมาจาก idToken เท่านั้น ไม่เคยเชื่อ userId ใน payload */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined') {
  ['rules', 'scoring', 'weeks', 'book', 'receivers'].forEach(function (m) { if (!HS[m]) require('./' + m + '.js'); });
}

HS.handlers = (function () {
  // รหัสผิดพลาด: unauthorized | not_registered | busy | server ส่งเป็น error ตรง ๆ
  // ส่วน invalid ส่งข้อความไทยเป็น error (ตามเทสต์ในบรีฟ: error ต้อง match /100–220/) พร้อม code:'invalid'
  function fail(code) { return { ok: false, code: code, error: code }; }
  function bad(message) { return { ok: false, error: message, code: 'invalid', message: message }; }
  function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }

  // ---- register ----
  var PROJECTS = ['HBHW', 'DPAC', 'GENERAL'];
  function validateRegister(p) {
    var h;
    if (p.consent !== true) return 'กรุณากดยินยอมการใช้ข้อมูลก่อนลงทะเบียน';
    if (PROJECTS.indexOf(p.project) < 0) return 'กรุณาเลือกโครงการ';
    if (isBlank(p.name)) return 'กรุณากรอกชื่อ-สกุล';
    if (p.sex !== 'ชาย' && p.sex !== 'หญิง') return 'กรุณาเลือกเพศ (ชาย หรือ หญิง)';
    if (String(p.name).length > 100 || String(p.dept || '').length > 100) return 'ชื่อและกลุ่มงานต้องยาวไม่เกิน 100 ตัวอักษร';
    for (var k in p) if (typeof p[k] === 'string' && p[k].length > 200) return 'ข้อความยาวเกินไป (ไม่เกิน 200 ตัวอักษร)';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.birthDate || ''))) return 'กรุณากรอกวันเกิดให้ถูกต้อง';
    h = HS.rules.validate('height', { heightCm: p.heightCm });
    if (!h.ok) return h.message;
    if (p.project === 'HBHW' && (isBlank(p.dept) || isBlank(p.cohort))) return 'กรุณากรอกกลุ่มงานและรุ่นที่เข้าอบรม';
    if (p.project === 'DPAC' && isBlank(p.hn)) return 'กรุณากรอก HN';
    if (p.project === 'GENERAL' && (isBlank(p.tambon) || isBlank(p.moo))) return 'กรุณากรอกตำบลและหมู่ที่';
    return null;
  }
  function register(c) {
    var p = c.payload, msg, u;
    if (c.user) return book(c, c.user);
    msg = validateRegister(p);
    if (msg) return bad(msg);
    u = c.deps.repo.insertUser({
      lineId: c.id.lineId, name: String(p.name).trim(), sex: p.sex, birthDate: p.birthDate,
      heightCm: HS.rules.parseNumber(p.heightCm), tambon: p.tambon || '', moo: p.moo === undefined ? '' : p.moo,
      project: p.project, cohort: p.cohort || '', dept: p.dept || '', hn: p.hn || '', role: 'user', status: 'pending',
      consentAt: c.now.toISOString(), createdAt: c.now.toISOString() });
    c.deps.linkMenu(c.id.lineId, p.project === 'GENERAL' ? 'general' : 'project');
    return book(c, u);
  }

  // ---- saveMeasurements ----
  function stationMatch(c) {
    var list = c.deps.settings.stationCodes || [], code = c.payload.stationCode, today = HS.book.isoDay(c.now), i, e;
    if (isBlank(code)) return null;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.code === code && e.date === today && e.project === c.user.project && String(e.cohort || '') === String(c.user.cohort || '')) return e;
    }
    return null;
  }
  // คืน { rows: [{metric,value,level,label,round}] } หรือ { error }
  function buildRows(c, v) {
    var R = HS.rules, rows = [], num = R.parseNumber, h = Number(c.user.heightCm), td = c.user.trainingDates, r, n, k;
    function push(res, value, round) { rows.push({ metric: res.metric, value: value, level: res.level, label: res.label, round: round || null }); }
    if (v.heightCm !== undefined) { r = R.validate('height', { heightCm: v.heightCm }); if (!r.ok) return { error: r.message }; }
    if (!isBlank(v.weightKg)) {
      r = R.validate('weight', { weightKg: v.weightKg }); if (!r.ok) return { error: r.message };
      n = num(v.weightKg);
      rows.push({ metric: 'weight', value: n, level: null, label: null, round: td ? HS.weeks.round(td.pre, c.now) : null });
      push(R.bmi(n, h), R.bmi(n, h).value);
    }
    if (!isBlank(v.waistCm)) {
      r = R.validate('waist', { waistCm: v.waistCm }); if (!r.ok) return { error: r.message };
      push(R.waist(num(v.waistCm), h), num(v.waistCm));
    }
    if (!isBlank(v.sys) || !isBlank(v.dia)) {
      r = R.validate('bp', { sys: v.sys, dia: v.dia }); if (!r.ok) return { error: r.message };
      push(R.bp(num(v.sys), num(v.dia)), { sys: num(v.sys), dia: num(v.dia) });
    }
    if (!isBlank(v.fbs)) {
      r = R.validate('fbs', { mgdl: v.fbs }); if (!r.ok) return { error: r.message };
      push(R.fbs(num(v.fbs)), num(v.fbs));
    }
    if (v.lipid && typeof v.lipid === 'object') {
      r = R.validate('lipid', v.lipid); if (!r.ok) return { error: r.message };
      n = {};
      ['tc', 'ldl', 'hdl', 'tg'].forEach(function (key) { if (!isBlank(v.lipid[key])) n[key] = num(v.lipid[key]); });
      for (k in n) { push(R.lipid(n), n); break; }
    }
    ['smoke', 'alcohol'].forEach(function (key) {
      if (v[key] === undefined || v[key] === null) return;
      if (typeof v[key] === 'boolean') push(R[key](v[key]), v[key]); else rows.push(null);
    });
    if (rows.indexOf(null) >= 0) return { error: 'ค่าสูบบุหรี่/ดื่มแอลกอฮอล์ต้องเป็นใช่หรือไม่ใช่' };
    if (!rows.length) return { error: 'ไม่มีค่าที่จะบันทึก กรุณากรอกอย่างน้อย 1 รายการ' };
    return { rows: rows };
  }
  function saveMeasurements(c) {
    var p = c.payload, built = buildRows(c, p.values || {}), st = stationMatch(c), source, phase, ts = c.now.toISOString();
    if (built.error) return bad(built.error);
    // รหัสสถานีที่ส่งมาแต่ไม่ตรง = home/during เสมอ (R14); ไม่มีรหัสจึงใช้ source ที่ผู้ใช้เลือก
    source = st ? 'station' : (isBlank(p.stationCode) && p.source === 'station' ? 'station' : 'home');
    phase = st ? st.phase : 'during';
    built.rows.forEach(function (r) {
      c.deps.repo.appendMeasurement({ ts: ts, userId: c.user.userId, metric: r.metric, value: r.value, source: source,
        phase: phase, round: r.round, level: r.level, label: r.label, requestId: c.requestId || '' });
    });
    return afterWrite(c, ['twelveWeek', 'referral', 'recall', 'rewards', 'summary']);
  }

  // ---- saveExercise ----
  function saveExercise(c) {
    var p = c.payload, mins = HS.rules.parseNumber(p.minutes), td = c.user.trainingDates;
    if ((c.deps.settings.exerciseTypes || []).indexOf(p.type) < 0) return bad('กรุณาเลือกชนิดการออกกำลังกายจากรายการ');
    if (isNaN(mins) || mins % 1 !== 0 || mins < 1 || mins > 600) return bad('เวลาออกกำลังกายต้องเป็นจำนวนเต็ม 1–600 นาที');
    c.deps.repo.appendExercise({ ts: c.now.toISOString(), userId: c.user.userId, type: p.type, minutes: mins,
      week: td ? HS.weeks.index(td.pre, c.now) : null, requestId: c.requestId || '' });
    return afterWrite(c, ['rewards', 'summary']);
  }

  // ---- saveAssessment ----
  function scoreForm(c, form, answers) {
    var f = c.deps.forms[form], a, s, i;
    if (Object.prototype.toString.call(answers) !== '[object Array]') return { error: 'รูปแบบคำตอบไม่ถูกต้อง' };
    if (form === 'hbhw_quiz') {
      if (answers.length !== f.items.length) return { error: 'กรุณาตอบให้ครบทุกข้อ' };
      s = HS.scoring.quiz(answers, { answerKey: f.answerKey, passScore: c.deps.settings.quizPass });
      return { score: s.score, level: s.pass ? 'ผ่าน' : 'ไม่ผ่าน' };
    }
    if (form === 'st5') {
      try { s = HS.scoring.st5(answers, c.deps.settings); } catch (e) { return { error: e.message }; }
      return { score: s.score, level: s.level, st5: s };
    }
    if (answers.length !== f.items.length) return { error: 'กรุณาตอบให้ครบทุกข้อ' };
    for (i = 0; i < answers.length; i++) {
      a = answers[i];
      if (typeof a !== 'number' || a % 1 !== 0 || a < 1 || a > f.scale.length) return { error: 'คะแนนความพึงพอใจต้องเป็น 1–' + f.scale.length };
    }
    return { score: HS.scoring.satisfaction(answers).mean, level: '' };
  }
  // ข้อเสนอแนะปลายเปิด (R17): เฉพาะแบบความพึงพอใจ เก็บเฉพาะ suggestion/apply ตัดช่องว่าง ยาวสุด 500 ตัวอักษรต่อช่อง
  function cleanOpenEnded(p) {
    var out = { suggestion: '', apply: '' }, k, v, keys = ['suggestion', 'apply'], i;
    if (p.form !== 'satisfaction') return { value: '' };
    if (p.openEnded === undefined || p.openEnded === null) return { value: JSON.stringify(out) };
    if (typeof p.openEnded !== 'object' || Object.prototype.toString.call(p.openEnded) === '[object Array]') return { error: 'รูปแบบข้อเสนอแนะไม่ถูกต้อง' };
    for (i = 0; i < keys.length; i++) {
      k = keys[i]; v = p.openEnded[k];
      if (v === undefined || v === null) continue;
      v = String(v).replace(/^\s+|\s+$/g, '');
      if (v.length > 500) return { error: 'ข้อเสนอแนะยาวเกิน 500 ตัวอักษร' };
      out[k] = v;
    }
    return { value: JSON.stringify(out) };
  }
  function saveAssessment(c) {
    var p = c.payload, due = HS.book.formsDue(c.user, c.mine().assessments, c.now), d = null, sc, oe, i;
    for (i = 0; i < due.length; i++) if (due[i].form === p.form && (!p.phase || due[i].phase === p.phase)) { d = due[i]; break; }
    if (!d) return bad('แบบประเมินนี้ยังไม่ถึงกำหนดหรือทำเสร็จแล้ว');
    sc = scoreForm(c, p.form, p.answers);
    if (sc.error) return bad(sc.error);
    oe = cleanOpenEnded(p);
    if (oe.error) return bad(oe.error);
    c.deps.repo.appendAssessment({ ts: c.now.toISOString(), userId: c.user.userId, form: p.form, phase: d.phase,
      answers: p.answers, score: sc.score, level: sc.level, requestId: c.requestId || '', openEnded: oe.value });
    c.st5 = sc.st5 || null;
    c.result = assessmentResult(c, { form: p.form, phase: d.phase, score: sc.score, level: sc.level });
    return afterWrite(c, ['referral', 'rewards']);
  }

  // ผลคะแนนที่เซิร์ฟเวอร์คิด (หน้าเว็บแสดงค่านี้ ไม่คิดเอง เพราะไม่ได้รับเฉลย) จากแถวที่บันทึกแล้ว
  function assessmentResult(c, a) {
    var thr;
    if (!a) return null;
    if (a.form === 'hbhw_quiz') {
      return { form: a.form, phase: a.phase, score: Number(a.score), max: (c.deps.forms.hbhw_quiz.items || []).length,
        pass: a.level === 'ผ่าน', passScore: c.deps.settings.quizPass };
    }
    if (a.form === 'st5') {
      thr = typeof c.deps.settings.st5Alert === 'number' ? c.deps.settings.st5Alert : 8;
      return { form: a.form, phase: a.phase, level: a.level, alert: Number(a.score) >= thr };
    }
    return { form: a.form, phase: a.phase };
  }
  function lastAssessment(list, form, phase) {
    for (var i = list.length - 1; i >= 0; i--) if (list[i].form === form && (!phase || list[i].phase === phase)) return list[i];
    return null;
  }

  // ---- shared flow ----
  function afterWrite(c, receivers) {
    var ctx, out;
    c.deps.repo.markRequest(c.user.userId, c.requestId);
    ctx = { deps: c.deps, user: c.user, mine: c.mine(true), groupBefore: c.groupBefore, st5: c.st5, requestId: c.requestId, newBadges: [] };
    HS.receivers.run(receivers, ctx);
    out = { ok: true, data: HS.book.build(c.user, c.deps.repo.listMine(c.user.userId), c.deps, { newBadges: ctx.newBadges }) };
    if (c.result) out.data.result = c.result;
    return out;
  }
  function book(c, rawUser, extra) {
    var u = rawUser || c.user;
    return { ok: true, data: HS.book.build(u, c.deps.repo.listMine(u.userId), c.deps, extra) };
  }

  var SAVES = { saveMeasurements: saveMeasurements, saveExercise: saveExercise, saveAssessment: saveAssessment };
  function has(map, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key); }
  function logError(e) {
    try { if (typeof console !== 'undefined' && console && typeof console.error === 'function') console.error(e && e.stack || e); } catch (ignore) { /* ไม่มีที่บันทึก */ }
  }

  function handle(req, deps) {
    var id, raw, c, cache = null, action, replay;
    try {
      id = deps.verify(req.idToken);
      if (!id || !id.lineId) return fail('unauthorized');
      req.payload = req.payload || {};
      if (req.requestId !== undefined && (typeof req.requestId !== 'string' || req.requestId.length > 200)) return bad('รหัสคำขอไม่ถูกต้อง');
      action = req.action;
      // ชื่อคำขอต้องเป็นข้อความและเป็นคีย์ของตัวเองเท่านั้น (กัน constructor / __proto__ / toString ของ Object.prototype)
      if (typeof action !== 'string' || (action !== 'getConfig' && action !== 'register' && action !== 'getMyBook' && !has(SAVES, action))) {
        return bad('ไม่รู้จักคำขอนี้');
      }
      raw = deps.repo.getUserByLine(id.lineId);
      c = { payload: req.payload, requestId: req.requestId, deps: deps, id: id, now: deps.now(), user: null };
      if (raw) c.user = HS.book.withDates(raw, deps.settings);
      c.mine = function (fresh) { if (!cache || fresh) cache = deps.repo.listMine(c.user.userId); return cache; };
      if (action === 'getConfig') {
        return { ok: true, data: { departments: (deps.settings.departments || []).slice(),
          cohorts: (deps.settings.cohorts || []).map(function (x) { return { project: x.project, cohort: x.cohort }; }),
          exerciseTypes: (deps.settings.exerciseTypes || []).slice() } };
      }
      if (action === 'register') return register(c);
      if (!c.user) return fail('not_registered');
      if (action === 'getMyBook') return book(c);
      // คำขอบันทึก: ต้องมี requestId เสมอ (กันบันทึกซ้ำเมื่อส่งใหม่) และนับซ้ำแยกตามผู้ใช้
      if (typeof req.requestId !== 'string' || isBlank(req.requestId)) return bad('รหัสคำขอไม่ถูกต้อง กรุณาเปิดหน้าใหม่แล้วส่งอีกครั้ง');
      if (deps.repo.seenRequest(c.user.userId, req.requestId)) { // ส่งซ้ำ: ไม่เขียนซ้ำ
        replay = book(c);
        if (action === 'saveAssessment') {
          c.result = assessmentResult(c, lastAssessment(c.mine().assessments || [], req.payload.form, req.payload.phase));
          if (c.result) replay.data.result = c.result;
        }
        return replay;
      }
      c.groupBefore = HS.advice.overall(HS.book.latest(c.mine().measurements, c.user));
      return SAVES[action](c);
    } catch (e) {
      logError(e);
      return { ok: false, code: 'server', error: 'server', message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' };
    }
  }

  return { handle: handle };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
