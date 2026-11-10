/* โหมดทดสอบ ?mock=1 (ใช้ได้เฉพาะเมื่อ HS_CONFIG.API_URL ว่าง) — liff จำลอง + API จำลองที่ใช้ HS.handlers ตัวจริงกับ repo ในหน่วยความจำ
 * ธง: fail=network (ทุกคำขอล้มเหลวแบบเน็ตหลุด) · state=pending | unregistered | general (ประชาชนทั่วไป ไม่อยู่รุ่น 12 สัปดาห์) · stage=post (ข้ามไปหลังอบรมครั้งที่ 2) · fast=1 (ลดเวลารอลองใหม่ ใช้ทดสอบ) */
(function () {
  var q = new URLSearchParams(location.search), fail = q.get('fail'), state = q.get('state');
  var DAY = 86400000, realNow = Date.now(), now = realNow, stage = q.get('stage');
  var offset = stage === 'post' ? 30 * DAY : 0; // stage=post: วันนี้เลื่อนไปหลังอบรมครั้งที่ 2
  function ago(d) { return new Date(realNow - d * DAY).toISOString(); }

  window.liff = {
    init: function () { return Promise.resolve(); },
    isInClient: function () { return true; },
    isLoggedIn: function () { return true; },
    getIDToken: function () { return 'mock'; },
    login: function () {},
    sendMessages: function () { return Promise.resolve(); }
  };

  var settings = JSON.parse(JSON.stringify(HS.data.settings));
  settings.departments = ['การพยาบาล', 'เภสัชกรรม', 'ปฐมภูมิและองค์รวม'];
  settings.cohorts = [{ project: 'HBHW', cohort: 'รุ่น 1', pre: ago(49).slice(0, 10), post: new Date(realNow + 21 * DAY).toISOString().slice(0, 10) }]; // วันนี้อยู่สัปดาห์ที่ 8

  var repo = { users: [], measurements: [], exercise: [], assessments: [], referrals: [], pending: [], badges: [], appointment: null, reqs: {} };
  repo.getUserByLine = function (l) { return repo.users.filter(function (u) { return u.lineId === l; })[0] || null; };
  repo.insertUser = function (u) { var row = Object.assign({}, u, { userId: 'U' + String(repo.users.length + 1).padStart(6, '0') }); repo.users.push(row); return row; };
  repo.appendMeasurement = function (m) { repo.measurements.push(m); };
  repo.appendExercise = function (e) { repo.exercise.push(e); };
  repo.appendAssessment = function (a) { repo.assessments.push(a); };
  repo.listMine = function (id) {
    return { measurements: repo.measurements.filter(function (x) { return x.userId === id; }), exercise: repo.exercise.filter(function (x) { return x.userId === id; }),
      assessments: repo.assessments.filter(function (x) { return x.userId === id; }), earned: repo.badges.filter(function (b) { return b.userId === id; }).map(function (b) { return b.code; }),
      appointment: repo.appointment && repo.appointment.userId === id ? repo.appointment : null };
  };
  repo.seenRequest = function (u, id) { return !!repo.reqs['req:' + u + ':' + id]; };
  repo.markRequest = function (u, id) { repo.reqs['req:' + u + ':' + id] = 1; };
  repo.enqueueReferral = function (x) { var row = Object.assign({ id: 'R' + (repo.referrals.length + 1), status: 'รอ', alerted: false }, x); repo.referrals.push(row); return row.id; };
  repo.hasOpenReferral = function (u, d) { return repo.referrals.some(function (x) { return x.userId === u && x.dest === d && x.status === 'รอ'; }); };
  repo.markReferralAlerted = function () {};
  repo.upsertAppointment = function (a) { repo.appointment = a; };
  repo.addBadges = function (u, codes) { codes.forEach(function (c) { repo.badges.push({ userId: u, code: c }); }); };
  repo.addPending = function (j) { repo.pending.push(j); };

  if (state !== 'unregistered') {
    var u = repo.insertUser({ lineId: 'mock-line', name: 'คุณสมใจ', sex: 'หญิง', birthDate: '1975-03-04', heightCm: 158, tambon: '', moo: '',
      project: state === 'general' ? 'GENERAL' : 'HBHW', cohort: state === 'general' ? '' : 'รุ่น 1', dept: 'การพยาบาล', hn: '', role: 'user', status: state === 'pending' ? 'pending' : 'active', consentAt: ago(30), createdAt: ago(30) });
    var id = u.userId;
    function m(d, metric, value, source) { repo.appendMeasurement({ ts: ago(d), userId: id, metric: metric, value: value, source: source || 'home', phase: 'during', round: null, requestId: '' }); }
    m(21, 'weight', 68.4, 'station'); m(21, 'bmi', 27.4, 'station'); m(21, 'waist', 94, 'station'); m(21, 'bp', { sys: 140, dia: 88 }, 'station'); m(21, 'fbs', 98, 'station');
    m(7, 'weight', 68.4); m(7, 'bmi', 27.4); m(7, 'waist', 92); m(7, 'bp', { sys: 134, dia: 86 }); m(7, 'fbs', 96);
    m(7, 'lipid', { tc: 180, ldl: 90, hdl: 55, tg: 120 }); m(7, 'smoke', false); m(7, 'alcohol', false);
    function st(d, phase, w, wa, bmi, sys, dia) {
      [['weight', w], ['waist', wa], ['bmi', bmi], ['bp', { sys: sys, dia: dia }]].forEach(function (x) {
        repo.appendMeasurement({ ts: ago(d), userId: id, metric: x[0], value: x[1], source: 'station', phase: phase, round: null, requestId: '' });
      });
    }
    if (state !== 'general') {
      st(49, 'pre', 71.0, 96, 28.4, 138, 88);
      if (stage === 'post') st(-21, 'post', 68.4, 92, 27.4, 128, 82);
      [[1, 100], [2, 120], [4, 90], [5, 110], [6, 140], [7, 130]].forEach(function (w) { // สัปดาห์ที่ 1,2,4,5,6,7 ไม่ถึง 150 นาที
        repo.appendExercise({ ts: ago(49 - (w[0] - 1) * 7 - 1), userId: id, type: 'เดินเร็ว', minutes: w[1], week: w[0], requestId: '' });
      });
      repo.badges.push({ userId: id, code: 'first_record' }, { userId: id, code: 'all_seven' });
    }
    repo.appointment = { userId: id, group: 'risk', date: new Date(now + 60 * DAY).toISOString(), sent: false };
  }

  // หน้าเว็บไม่ได้รับเฉลยจริง (build.sh ตัดออก) — โหมดจำลองใช้ "เฉลยจำลอง" นี้แทน เพื่อให้ HS.handlers คิดคะแนนเหมือนเซิร์ฟเวอร์
  var QUIZ_KEY = ['ก', 'ข', 'ค', 'ง', 'ก', 'ข', 'ค', 'ง', 'ก', 'ข'];
  var forms = JSON.parse(JSON.stringify(HS.data.questionnaires));
  forms.hbhw_quiz.answerKey = QUIZ_KEY.slice(0, forms.hbhw_quiz.items.length);

  var deps = {
    verify: function (t) { return t === 'mock' ? { lineId: 'mock-line', name: 'ทดสอบ' } : null; },
    repo: repo, now: function () { return new Date(Date.now() + offset); }, settings: settings, advice: HS.data.advice, forms: forms,
    alertAdmin: function () { return true; }, linkMenu: function () {}
  };

  window.Mock = {
    quizKey: forms.hbhw_quiz.answerKey.slice(), // ให้ e2e ตอบแบบทดสอบได้ (เฉลยจำลอง)
    post: function (body) {
      if (fail === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      var res = HS.handlers.handle(JSON.parse(JSON.stringify(body)), deps);
      return Promise.resolve(JSON.parse(JSON.stringify(res)));
    }
  };
})();
