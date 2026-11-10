/* HS.rules — เกณฑ์แปลผลตัวเลข 7 ตัว (สเปกข้อ 6). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.rules = (function () {
  function res(metric, level, label, value, extra) {
    var r = { metric: metric, level: level, label: label, value: value };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function missing(v) { return v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v)); }

  function parseNumber(str) {
    if (typeof str === 'number') return str;
    if (str === undefined || str === null) return NaN;
    var s = String(str).trim().replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  var RANGES = {
    height: [100, 220], weight: [30, 250], waist: [40, 200],
    sys: [60, 260], dia: [30, 160], fbs: [40, 600], lipid: [10, 1000]
  };
  var NAMES = {
    height: 'ส่วนสูง', weight: 'น้ำหนัก', waist: 'รอบเอว', sys: 'ความดันตัวบน',
    dia: 'ความดันตัวล่าง', fbs: 'น้ำตาลในเลือด', lipid: 'ค่าไขมัน'
  };
  // ชื่อตัวชี้วัดแต่ละตัว (ใช้ในข้อความ "ค่า{ชื่อ}อยู่ในระดับ…")
  var METRIC_NAMES = {
    bmi: 'ดัชนีมวลกาย', waist: NAMES.waist, bp: 'ความดันโลหิต', fbs: NAMES.fbs,
    lipid: 'ไขมันในเลือด', smoke: 'การสูบบุหรี่', alcohol: 'การดื่มแอลกอฮอล์'
  };
  var UNITS = {
    height: 'ซม.', weight: 'กก.', waist: 'ซม.', sys: 'มม.ปรอท', dia: 'มม.ปรอท',
    fbs: 'มก./ดล.', lipid: 'มก./ดล.'
  };

  function check(key, v) {
    var r = RANGES[key], n = parseNumber(v);
    if (isNaN(n) || n < r[0] || n > r[1]) {
      return { ok: false, message: NAMES[key] + 'ต้องอยู่ระหว่าง ' + r[0] + '–' + r[1] + ' ' + UNITS[key] + ' (ตรวจสอบหน่วยและจุดทศนิยม)' };
    }
    return { ok: true };
  }

  function validate(field, input) {
    input = input || {};
    var r;
    switch (field) {
      case 'height': return check('height', input.heightCm);
      case 'weight': return check('weight', input.weightKg);
      case 'waist': return check('waist', input.waistCm);
      case 'fbs': return check('fbs', input.mgdl);
      case 'bp':
        if (missing(input.sys) || missing(input.dia)) return { ok: false, message: 'กรุณากรอกความดันทั้งตัวบนและตัวล่าง' };
        r = check('sys', input.sys); if (!r.ok) return r;
        return check('dia', input.dia);
      case 'lipid':
        var keys = ['tc', 'ldl', 'hdl', 'tg'];
        for (var i = 0; i < keys.length; i++) {
          if (missing(input[keys[i]])) continue;
          r = check('lipid', input[keys[i]]);
          if (!r.ok) return { ok: false, message: r.message.replace(NAMES.lipid, NAMES.lipid + ' ' + keys[i].toUpperCase()) };
        }
        return { ok: true };
      default: return { ok: false, message: 'ไม่รู้จักรายการที่ตรวจสอบ' };
    }
  }

  function bmi(weightKg, heightCm) {
    var m = heightCm / 100;
    var v = round1(weightKg / (m * m));
    if (v < 18.5) return res('bmi', 'risk', 'น้ำหนักต่ำกว่าเกณฑ์', v, { kind: 'low' });
    if (v < 23) return res('bmi', 'ok', 'ปกติ', v);
    if (v < 25) return res('bmi', 'risk', 'น้ำหนักเกิน / อ้วนระดับ 1', v, { kind: 'high' });
    if (v < 30) return res('bmi', 'risk', 'อ้วนระดับ 2', v, { kind: 'high' });
    return res('bmi', 'risk', 'อ้วนระดับ 3', v, { kind: 'high' });
  }

  function waist(waistCm, heightCm) {
    var limit = heightCm / 2;
    return waistCm <= limit
      ? res('waist', 'ok', 'ปกติ', waistCm, { limit: limit })
      : res('waist', 'risk', 'เกินเกณฑ์', waistCm, { limit: limit });
  }

  function bp(sys, dia) {
    var value = sys + '/' + dia;
    if (sys >= 140 || dia >= 90) {
      var ls = sys >= 180 ? 3 : sys >= 160 ? 2 : sys >= 140 ? 1 : 0;
      var ld = dia >= 110 ? 3 : dia >= 100 ? 2 : dia >= 90 ? 1 : 0;
      if (dia < 90) return res('bp', 'sick', 'สูงเฉพาะค่าตัวบน', value);
      if (sys < 140) return res('bp', 'sick', 'สูงเฉพาะค่าตัวล่าง', value);
      return res('bp', 'sick', 'ความดันโลหิตสูง ระดับ ' + Math.max(ls, ld), value);
    }
    if (sys >= 130 || dia >= 80) return res('bp', 'risk', 'เสี่ยง', value);
    if (sys >= 120) return res('bp', 'ok', 'ปกติ', value);
    return res('bp', 'ok', 'เหมาะสม', value);
  }

  function fbs(mgdl) {
    if (mgdl < 100) return res('fbs', 'ok', 'ปกติ', mgdl);
    if (mgdl < 126) return res('fbs', 'risk', 'เสี่ยงเบาหวาน', mgdl);
    return res('fbs', 'sick', 'อยู่ในระดับเบาหวาน', mgdl);
  }

  function lipid(v) {
    var detail = [];
    if (!missing(v.tc) && v.tc >= 200) detail.push('tc');
    if (!missing(v.ldl) && v.ldl >= 100) detail.push('ldl');
    if (!missing(v.hdl) && v.hdl <= 40) detail.push('hdl');
    if (!missing(v.tg) && v.tg >= 150) detail.push('tg');
    return detail.length
      ? res('lipid', 'risk', 'เกินเกณฑ์', null, { detail: detail })
      : res('lipid', 'ok', 'อยู่ในเกณฑ์', null, { detail: detail });
  }

  function smoke(b) { return b ? res('smoke', 'risk', 'สูบ', true) : res('smoke', 'ok', 'ไม่สูบ', false); }
  function alcohol(b) { return b ? res('alcohol', 'risk', 'ดื่ม', true) : res('alcohol', 'ok', 'ไม่ดื่ม', false); }

  return { metricNames: METRIC_NAMES, parseNumber: parseNumber, validate: validate, bmi: bmi, waist: waist, bp: bp,
           fbs: fbs, lipid: lipid, smoke: smoke, alcohol: alcohol };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
