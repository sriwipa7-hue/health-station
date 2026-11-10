/* ลงทะเบียน (#register) — เลือกโครงการ กรอกข้อมูล ยินยอม PDPA */
window.Screens = window.Screens || {};
(function () {
  var esc = function (s) { return UI.esc(s); };
  var PROJECTS = [['HBHW', 'โครงการ Happy Body Happy Work (บุคลากร)'], ['DPAC', 'คลินิกไร้พุง (DPAC)'], ['GENERAL', 'ประชาชนทั่วไป']];

  function text(id, label, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + ((extra && extra.type) || 'text') + '"' + ((extra && extra.attrs) || '') + '><div class="err" id="' + id + '-error" role="alert"></div></div>';
  }
  function select(id, label, opts) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '"><option value="">— เลือก —</option>' +
      opts.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('') + '</select><div class="err" id="' + id + '-error" role="alert"></div></div>';
  }

  Screens.register = {
    async render(root, ctx) {
      var cfg;
      try { cfg = await ctx.loadConfig(); } catch (e) { cfg = { departments: [], cohorts: [] }; }
      var cohorts = cfg.cohorts.filter(function (c) { return c.project === 'HBHW'; }).map(function (c) { return c.cohort; });
      var project = '';
      root.innerHTML =
        '<h1>ลงทะเบียน</h1><p class="muted">กรอกครั้งเดียว ใช้บันทึกสุขภาพของคุณเองได้ตลอด</p>' +
        '<div class="field"><div class="lab">เลือกโครงการ</div><div class="seg" style="flex-direction:column">' +
        PROJECTS.map(function (p) { return '<button type="button" id="project-' + p[0] + '" aria-pressed="false">' + p[1] + '</button>'; }).join('') +
        '</div><div class="err" id="project-error" role="alert"></div></div>' +
        '<div id="fields" hidden>' +
        text('name', 'ชื่อ-สกุล', { attrs: ' autocomplete="name"' }) +
        '<div class="field"><div class="lab">เพศ</div><div class="seg"><label><input type="radio" name="sex" id="sex-male" value="ชาย">ชาย</label>' +
        '<label><input type="radio" name="sex" id="sex-female" value="หญิง">หญิง</label></div><div class="err" id="sex-error" role="alert"></div></div>' +
        text('birthDate', 'วันเกิด', { type: 'date' }) +
        text('heightCm', 'ส่วนสูง (ซม.)', { attrs: ' inputmode="decimal"' }) +
        '<div data-for="HBHW">' + select('dept', 'กลุ่มงาน', cfg.departments) + select('cohort', 'รุ่นที่เข้าอบรม', cohorts) + '</div>' +
        '<div data-for="DPAC">' + text('hn', 'HN', { attrs: ' autocomplete="off"' }) + '</div>' +
        '<div data-for="GENERAL">' + text('tambon', 'ตำบล') + text('moo', 'หมู่ที่', { attrs: ' inputmode="numeric"' }) + '</div>' +
        '<label class="consent"><input type="checkbox" id="consent"><span>ยินยอมให้โรงพยาบาลภูเรือเก็บและใช้ข้อมูลสุขภาพเพื่อการดูแลและติดตามผล ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล</span></label>' +
        '<div class="err" id="consent-error" role="alert"></div>' +
        '<div class="err" id="form-error" role="alert"></div>' +
        '<button type="button" class="btn" id="save">ลงทะเบียน</button></div>';

      var $ = function (s) { return UI.$(s, root); };
      function pick(p) {
        project = p; $('#project-error').textContent = '';
        PROJECTS.forEach(function (x) { $('#project-' + x[0]).setAttribute('aria-pressed', x[0] === p); });
        $('#fields').hidden = false;
        root.querySelectorAll('[data-for]').forEach(function (d) { d.hidden = d.getAttribute('data-for') !== p; });
      }
      PROJECTS.forEach(function (p) { $('#project-' + p[0]).onclick = function () { pick(p[0]); }; });
      $('#consent').onchange = function () { if (this.checked) $('#consent-error').textContent = ''; };

      var sending = false;
      $('#save').onclick = async function () {
        if (sending) return;
        root.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
        var sexEl = root.querySelector('input[name=sex]:checked');
        var p = { project: project, name: $('#name').value.trim(), sex: sexEl ? sexEl.value : '', birthDate: $('#birthDate').value,
          heightCm: $('#heightCm').value.trim(), consent: $('#consent').checked };
        var errs = {};
        if (!p.name) errs.name = 'กรุณากรอกชื่อ-สกุล';
        if (!p.sex) errs.sex = 'กรุณาเลือกเพศ';
        if (!p.birthDate) errs.birthDate = 'กรุณากรอกวันเกิด';
        var h = HS.rules.validate('height', { heightCm: p.heightCm });
        if (!h.ok) errs.heightCm = h.message;
        if (project === 'HBHW') { p.dept = $('#dept').value; p.cohort = $('#cohort').value; if (!p.dept) errs.dept = 'กรุณาเลือกกลุ่มงาน'; if (!p.cohort) errs.cohort = 'กรุณาเลือกรุ่น'; }
        if (project === 'DPAC') { p.hn = $('#hn').value.trim(); if (!p.hn) errs.hn = 'กรุณากรอก HN'; }
        if (project === 'GENERAL') { p.tambon = $('#tambon').value.trim(); p.moo = $('#moo').value.trim(); if (!p.tambon) errs.tambon = 'กรุณากรอกตำบล'; if (!p.moo) errs.moo = 'กรุณากรอกหมู่ที่'; }
        if (!p.consent) errs.consent = 'กรุณาติ๊กยินยอมก่อนลงทะเบียน';
        var keys = Object.keys(errs);
        if (keys.length) { keys.forEach(function (k) { $('#' + k + '-error').textContent = errs[k]; }); $('#' + keys[0] + '-error').scrollIntoView({ block: 'center' }); return; }

        sending = true; this.disabled = true; this.textContent = 'กำลังส่ง…';
        try {
          var data = await Api.call('register', p);
          ctx.setBook(data);
          try { await liff.sendMessages([{ type: 'text', text: 'ลงทะเบียน' }]); } catch (e) { /* นอกห้องแชต ส่งไม่ได้ก็ไม่เป็นไร */ }
          ctx.go('#book');
        } catch (e) { $('#form-error').textContent = e.message; }
        finally { sending = false; this.disabled = false; this.textContent = 'ลงทะเบียน'; }
      };
    }
  };
})();
