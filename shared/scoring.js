/* HS.scoring — คะแนนแบบทดสอบ HBHW, ST-5, ความพึงพอใจ (สเปกข้อ 7). Pattern: see hs.js */
var HS = (typeof HS !== 'undefined') ? HS
  : (typeof require === 'function' ? require('./hs.js') : {});

HS.scoring = (function () {
  function quiz(answers, form) {
    var key = form.answerKey, score = 0, i;
    answers = answers || [];
    for (i = 0; i < key.length; i++) if (answers[i] === key[i]) score++;
    return { score: score, max: key.length, pass: score >= form.passScore };
  }

  function st5(answers, settings) {
    var i, score = 0, v;
    if (Object.prototype.toString.call(answers) !== '[object Array]' || answers.length !== 5) {
      throw new Error('ST-5 ต้องมี 5 คำตอบ');
    }
    for (i = 0; i < 5; i++) {
      v = answers[i];
      if (typeof v !== 'number' || v % 1 !== 0 || v < 0 || v > 3) throw new Error('คำตอบ ST-5 ต้องเป็นจำนวนเต็ม 0–3');
      score += v;
    }
    var level = score <= 4 ? 'น้อย' : score <= 7 ? 'ปานกลาง' : score <= 9 ? 'มาก' : 'มากที่สุด';
    var thr = (settings && typeof settings.st5Alert === 'number') ? settings.st5Alert : 8;
    return { score: score, level: level, alert: score >= thr };
  }

  function satisfaction(answers) {
    var sum = 0, n = 0, i, v;
    answers = answers || [];
    for (i = 0; i < answers.length; i++) {
      v = answers[i];
      if (v === null || v === undefined || typeof v !== 'number' || isNaN(v)) continue;
      sum += v; n++;
    }
    return { mean: n ? Math.round(sum / n * 100) / 100 : 0, items: answers };
  }

  return { quiz: quiz, st5: st5, satisfaction: satisfaction };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HS;
