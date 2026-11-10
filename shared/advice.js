/* HS.advice — กลุ่มรวม วันนัด และคำแนะนำ 3 ข้อ (สเปกข้อ 6, 9). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});
if (typeof require === 'function' && typeof module !== 'undefined') {
  if (!HS.rules) require('./rules.js');
  if (!HS.thaiDate) require('./thai-date.js');
}

HS.advice = (function () {
  var RANK = { ok: 0, risk: 1, sick: 2 };

  function overall(results) {
    var worst = null;
    for (var i = 0; i < results.length; i++) {
      var l = results[i].level;
      if (worst === null || RANK[l] > RANK[worst]) worst = l;
    }
    return worst;
  }

  // บวกเดือนปฏิทินตามเวลาไทย; วันที่ไม่มีในเดือนปลายทางให้ถอยเป็นวันสุดท้ายของเดือน
  function recallDate(group, fromDate, settings) {
    var p = HS.thaiDate.parts(fromDate);
    var total = p.m + settings.recallMonths[group];
    var y = p.y + Math.floor(total / 12), m = ((total % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var d = Math.min(p.d, last);
    var ms = Date.UTC(y, m, d) - 7 * 3600 * 1000 // เที่ยงคืนเวลาไทย
      + (fromDate.getTime() + 7 * 3600 * 1000) % 86400000; // คงเวลาในวันเดิมไว้
    return new Date(ms);
  }

  function topThree(results, table) {
    var out = [], seen = {};
    function push(line) {
      if (line && !seen[line] && out.length < 3) { seen[line] = true; out.push(line); }
    }
    var sick = [], risk = [], ok = [];
    results.forEach(function (r) { (r.level === 'sick' ? sick : r.level === 'risk' ? risk : ok).push(r); });
    sick.forEach(function (r) {
      push('ค่า' + HS.rules.metricNames[r.metric] + 'อยู่ในระดับ' + r.label.replace(/^อยู่ในระดับ/, '') + ' — ควรพบแพทย์เพื่อวินิจฉัย');
    });
    function lines(r) {
      var base = r.metric + '.' + r.level;
      return (r.kind && table[base + '.' + r.kind]) || table[base] || [];
    }
    function cycle(list) {
      for (var round = 0; out.length < 3; round++) {
        var any = false;
        for (var i = 0; i < list.length && out.length < 3; i++) {
          var ls = lines(list[i]);
          if (round < ls.length) { any = true; push(ls[round]); }
        }
        if (!any) break;
      }
    }
    // sick ที่ได้บรรทัด "ควรพบแพทย์" แล้ว ให้ดึงคำแนะนำของ sick ต่อด้วย risk
    cycle(sick.concat(risk));
    cycle(ok);
    return out;
  }

  return { overall: overall, recallDate: recallDate, topThree: topThree };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
