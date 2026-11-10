/* แบบประเมิน (#forms) — ทีละข้อ ปุ่มใหญ่ · คะแนนแสดงทันที (คะแนนจากเซิร์ฟเวอร์ data.result หน้าเว็บไม่มีเฉลย)
 * ไม่แสดงเฉลย/ข้อที่ผิด/คำตอบดิบของ ST-5 */
window.Screens = window.Screens || {};
(function () {
  var esc = function (s) { return UI.esc(s); };
  var NAME = { hbhw_quiz: 'แบบทดสอบความรอบรู้ 3อ.2ส.', st5: 'แบบประเมินความเครียด (ST-5)', satisfaction: 'แบบประเมินความพึงพอใจ' };
  var PHASE = { pre: 'ก่อนอบรม', post: 'หลังอบรม' };
  var STRESS = { 'น้อย': 'ok', 'ปานกลาง': 'risk', 'มาก': 'sick', 'มากที่สุด': 'sick' };
  function title(f) { return NAME[f.form] + (f.form === 'hbhw_quiz' ? ' (' + PHASE[f.phase] + ')' : ''); }

  Screens.forms = {
    async render(root, ctx) {
      var book = await ctx.loadBook(true), Q = HS.data.questionnaires;

      function list(msg) {
        var h = '<a class="back" href="#book">‹ กลับสมุดของฉัน</a><h1>แบบประเมิน</h1>';
        if (msg) h += msg;
        if (!book.formsDue.length) h += '<div class="panel" id="forms-empty">ยังไม่มีแบบประเมินที่ต้องทำตอนนี้</div>';
        else {
          h += '<p class="muted">เลือกแบบประเมินที่ต้องการทำ</p>';
          book.formsDue.forEach(function (f, i) {
            h += '<button type="button" class="form-item" data-form="' + f.form + '" data-phase="' + f.phase + '" data-i="' + i + '"><span>' + esc(title(f)) +
              '</span><small>' + (f.form === 'satisfaction' ? 'หลังอบรม' : PHASE[f.phase]) + ' ›</small></button>';
          });
        }
        root.innerHTML = h;
        root.querySelectorAll('.form-item').forEach(function (b) { b.onclick = function () { run(book.formsDue[+b.getAttribute('data-i')]); }; });
      }

      // ชุดคำถามของแต่ละแบบ: {text, opts:[{value,label,prefix}]}
      function steps(form) {
        if (form === 'hbhw_quiz') return Q.hbhw_quiz.items.map(function (it) {
          return { text: it.question, opts: it.options.map(function (o) { return { value: o.key, label: o.key + '. ' + o.text }; }) };
        });
        if (form === 'st5') return Q.st5.items.map(function (it) {
          return { text: it.question, note: 'ในช่วง ' + Q.st5.period + ' คุณมีอาการนี้บ่อยแค่ไหน', opts: Q.st5.options.map(function (o) { return { value: o.value, label: o.text }; }) };
        });
        var n = Q.satisfaction.scale.length;
        return Q.satisfaction.items.map(function (it) {
          return { text: it.text, note: 'ระดับความพึงพอใจ', opts: Q.satisfaction.scale.map(function (t, k) { return { value: n - k, label: t }; }) };
        });
      }

      function run(f) {
        var st = steps(f.form), answers = [], pos = 0, sending = false, open = ['', ''];
        var isSat = f.form === 'satisfaction', total = st.length + (isSat ? 1 : 0);

        function frame(inner, step) {
          root.innerHTML = '<button type="button" class="back linkbtn" id="q-back">‹ ' + (pos === 0 ? 'กลับรายการ' : 'ข้อก่อนหน้า') + '</button>' +
            '<h2>' + esc(title(f)) + '</h2><div class="progress" aria-hidden="true"><i style="width:' + Math.round((pos + 1) / total * 100) + '%"></i></div>' +
            '<div class="small muted" id="q-progress">' + step + '</div>' + inner + '<div class="err" id="form-error" role="alert"></div>';
          root.querySelector('#q-back').onclick = function () { if (pos === 0) { list(); } else { saveOpen(); pos--; show(); } };
        }
        function saveOpen() { var t = root.querySelectorAll('textarea'); if (t.length) open = [t[0].value, t[1].value]; }

        function show() {
          if (isSat && pos === st.length) return showOpen();
          var s = st[pos], last = pos === total - 1;
          frame('<p class="qtext">' + esc(s.text) + '</p>' + (s.note ? '<p class="small muted">' + esc(s.note) + '</p>' : '') +
            '<div class="opts">' + s.opts.map(function (o) {
              return '<button type="button" class="opt" data-key="' + esc(o.value) + '" data-value="' + esc(o.value) + '" aria-pressed="' + (answers[pos] === o.value) + '">' + esc(o.label) + '</button>';
            }).join('') + '</div>' + (last ? '<button type="button" class="btn" id="submit"' + (answers[pos] === undefined ? ' disabled' : '') + '>ส่งคำตอบ</button>' : ''),
            'ข้อ ' + (pos + 1) + ' จาก ' + st.length);
          root.querySelectorAll('.opt').forEach(function (b, k) {
            b.onclick = function () {
              answers[pos] = s.opts[k].value;
              if (!last) { pos++; show(); return; }
              root.querySelectorAll('.opt').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
              root.querySelector('#submit').disabled = false;
            };
          });
          if (last) root.querySelector('#submit').onclick = submit;
        }

        function showOpen() {
          var oe = Q.satisfaction.openEnded;
          frame(oe.map(function (o, k) { return '<div class="field"><label for="oe' + k + '">' + esc(o.text) + ' (ไม่บังคับ)</label><textarea id="oe' + k + '" rows="3" maxlength="500">' + esc(open[k]) + '</textarea></div>'; }).join('') +
            '<button type="button" class="btn" id="submit">ส่งแบบประเมิน</button>', 'ขั้นสุดท้าย — ข้อเสนอแนะ');
          root.querySelector('#submit').onclick = submit;
        }

        async function submit() {
          if (sending) return;
          saveOpen();
          var btn = root.querySelector('#submit'), payload = { form: f.form, phase: f.phase, answers: answers.slice(0, st.length) };
          if (isSat) payload.openEnded = { suggestion: open[0].slice(0, 500), apply: open[1].slice(0, 500) };
          sending = true; btn.disabled = true; btn.textContent = 'กำลังส่ง…';
          try {
            var data = await Api.call('saveAssessment', payload);
            var res = data.result || null;
            delete data.result;
            ctx.setBook(data); book = data;
            result(f, res);
          } catch (e) {
            if (e.code === 'not_registered') return;
            root.querySelector('#form-error').textContent = e.message;
            btn.disabled = false; btn.textContent = isSat ? 'ส่งแบบประเมิน' : 'ส่งคำตอบ';
          } finally { sending = false; }
        }
        show();
      }

      // r = data.result จากเซิร์ฟเวอร์: quiz {score,max,pass,passScore} · st5 {level,alert}
      function result(f, r) {
        var h = '<h2>' + esc(title(f)) + '</h2><div class="panel" id="result">';
        if (f.form === 'hbhw_quiz' && r && typeof r.score === 'number') {
          h += '<div class="num big" id="score">ได้ ' + esc(r.score) + '/' + esc(r.max) + ' คะแนน</div>' +
            (r.pass ? '<div class="st ok">● ผ่านเกณฑ์</div>' : '<div class="st risk">▲ ยังไม่ผ่านเกณฑ์ (ผ่านที่ ' + esc(r.passScore) + ' คะแนน)</div>') +
            '<p class="small muted">ขอบคุณที่ทำแบบทดสอบค่ะ</p>';
        } else if (f.form === 'st5' && r && r.level) {
          h += '<div>ระดับความเครียด</div><div>' + UI.status(STRESS[r.level] || 'risk', r.level) + '</div>';
          if (r.alert) h += '<p><b>ความเครียดอยู่ในระดับที่ควรได้รับการดูแล เจ้าหน้าที่จะติดต่อกลับ</b></p>' +
            '<p>หากต้องการคุยตอนนี้ โทร <a class="btn" href="tel:1323">สายด่วนสุขภาพจิต 1323</a></p>';
          else h += '<p class="small muted">ขอบคุณที่ร่วมประเมินค่ะ ดูแลใจตัวเองด้วยการพักผ่อนและพูดคุยกับคนที่ไว้ใจนะคะ</p>';
        } else h += '<div class="big">ขอบคุณที่ร่วมประเมินค่ะ</div>';
        h += '</div><button type="button" class="btn ghost" id="back-list">กลับรายการแบบประเมิน</button>';
        root.innerHTML = h;
        root.querySelector('#back-list').onclick = function () { list(); };
      }

      list();
    }
  };
})();
