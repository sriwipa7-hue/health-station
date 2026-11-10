/* HS.weeks — สัปดาห์โปรแกรม 12 สัปดาห์ และรอบชั่งน้ำหนัก (สเปกข้อ 8). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.weeks = (function () {
  var DAY = 86400000;
  function toDate(x) { return x instanceof Date ? x : new Date(x); }
  // เลขวันตามปฏิทินไทย: เลื่อน +7 ชม. แล้วตัดเป็นหน่วยวัน (ไม่พึ่งเขตเวลาเครื่อง)
  function thaiDayNumber(x) { return Math.floor((toDate(x).getTime() + 7 * 3600 * 1000) / DAY); }
  function dayOffset(trainingDate, at) { return thaiDayNumber(at) - thaiDayNumber(trainingDate); }

  // 0 = ก่อนเริ่ม, 1..12, 13 = หลังจบ
  function index(trainingDate, at) {
    var day = dayOffset(trainingDate, at);
    if (day < 0) return 0;
    if (day >= 84) return 13;
    return Math.floor(day / 7) + 1;
  }
  function logged(logs, trainingDate) {
    var seen = {}, n = 0;
    for (var i = 0; i < logs.length; i++) {
      var w = index(trainingDate, logs[i].ts);
      if (w >= 1 && w <= 12 && !seen[w]) { seen[w] = true; n++; }
    }
    return n;
  }
  function minutesThisWeek(logs, trainingDate, at) {
    var w = index(trainingDate, at), sum = 0;
    if (w < 1 || w > 12) return 0;
    for (var i = 0; i < logs.length; i++) {
      if (index(trainingDate, logs[i].ts) === w) sum += Number(logs[i].minutes) || 0;
    }
    return sum;
  }
  // รอบชั่งน้ำหนัก n (1..6) เปิดวันที่ 14n ถึง 14n+4
  function round(trainingDate, at) {
    var day = dayOffset(trainingDate, at);
    if (day < 14) return null;
    var n = Math.floor(day / 14);
    if (n > 6 || day - 14 * n > 4) return null;
    return n;
  }
  return { index: index, logged: logged, minutesThisWeek: minutesThisWeek, round: round };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
