/* HS.referral — ตัดสินใจส่งต่อ (สเปกข้อ 10). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.referral = (function () {
  var NAMES = {
    bmi: 'BMI', waist: 'รอบเอว', bp: 'ความดันโลหิต', fbs: 'น้ำตาลในเลือด',
    lipid: 'ไขมันในเลือด', smoke: 'การสูบบุหรี่', alcohol: 'การดื่มแอลกอฮอล์'
  };
  function nameOf(r) {
    var base = NAMES[r.metric] || r.metric;
    return r.label ? base + ' ' + r.label : base;
  }
  function join(rs) { var o = [], i; for (i = 0; i < rs.length; i++) o.push(nameOf(rs[i])); return o.join(', '); }

  // NCD ชนะ DPAC (ไม่ส่งซ้ำ) ; MENTAL เพิ่มได้เมื่อ ST-5 แจ้งเตือน ; คนในโครงการ DPAC ไม่ถูกส่ง DPAC ซ้ำ
  function decide(results, st5, user) {
    var out = [], sick = [], risk = [], i, r;
    results = results || [];
    for (i = 0; i < results.length; i++) {
      r = results[i];
      if (r.level === 'sick') sick.push(r); else if (r.level === 'risk') risk.push(r);
    }
    if (sick.length) out.push({ dest: 'NCD', reason: join(sick) });
    else if (risk.length && !(user && user.project === 'DPAC')) out.push({ dest: 'DPAC', reason: join(risk) });
    if (st5 && st5.alert) out.push({ dest: 'MENTAL', reason: 'ความเครียด ST-5 ' + (st5.score != null ? st5.score + ' คะแนน ' : '') + 'ควรได้รับการดูแล' });
    return out;
  }
  return { decide: decide };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
