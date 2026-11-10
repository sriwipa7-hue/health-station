/* HS.thaiDate — วันที่ไทย (พ.ศ. 2 หลัก, เวลา Asia/Bangkok). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.thaiDate = (function () {
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  // เลื่อน +7 ชม. แล้วใช้ getter แบบ UTC จึงได้วันตามเวลาไทยไม่ขึ้นกับเขตเวลาเครื่อง
  function parts(date) {
    var t = new Date(date.getTime() + 7 * 3600 * 1000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
  }
  function short(date) {
    var p = parts(date), yy = (p.y + 543) % 100;
    yy = (yy < 10 ? '0' : '') + yy;
    return p.d + ' ' + MONTHS[p.m] + ' ' + yy;
  }
  return { months: MONTHS, parts: parts, short: short };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
