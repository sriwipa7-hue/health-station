/* บันทึกผล (#record) — สีเปลี่ยนทันทีระหว่างพิมพ์ · กันพิมพ์ผิด · ส่งซ้ำเมื่อเน็ตหลุด */
window.Screens = window.Screens || {};
(function () {
  var R = function () { return HS.rules; };
  var esc = function (s) { return UI.esc(s); };

  function numField(id, label, unit) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="input-row"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off"><span class="unit">' + unit + '</span></div>' +
      '<div class="live" id="' + id + '-status"></div><div class="err" id="' + id + '-error" role="alert"></div></div>';
  }
  function yesNo(key, label, noText, yesText) {
    return '<div class="field"><div class="lab">' + label + '</div><div class="seg" id="' + key + '-seg">' +
      '<button type="button" id="' + key + '-no" aria-pressed="false">' + noText + '</button>' +
      '<button type="button" id="' + key + '-yes" aria-pressed="false">' + yesText + '</button></div><div class="live" id="' + key + '-status"></div></div>';
  }

  Screens.record = {
    async render(root, ctx) {
      var station = ctx.params.station || '';
      var book = null;
      try { book = await ctx.loadBook(false); } catch (e) { if (e.code === 'not_registered') return; }
      var height = book && book.user.heightCm, prevW = null;
      if (book && book.trends.weight.length) prevW = book.trends.weight[book.trends.weight.length - 1].value;

      root.innerHTML =
        '<a class="back" href="#book">‹ กลับสมุดของฉัน</a><h1>บันทึกผล</h1>' +
        '<p class="muted">กรอกเฉพาะค่าที่มี ไม่ต้องกรอกทุกช่อง</p>' +
        numField('weight', 'น้ำหนัก', 'กก.') + numField('waist', 'รอบเอว', 'ซม.') +
        '<div class="field"><div class="lab">ความดันโลหิต</div><div class="input-row"><input id="sys" type="text" inputmode="decimal" placeholder="ตัวบน" aria-label="ความดันตัวบน" autocomplete="off"><span class="unit">/</span>' +
        '<input id="dia" type="text" inputmode="decimal" placeholder="ตัวล่าง" aria-label="ความดันตัวล่าง" autocomplete="off"><span class="unit">มม.ปรอท</span></div>' +
        '<div class="live" id="bp-status"></div><div class="err" id="bp-error" role="alert"></div></div>' +
        numField('fbs', 'น้ำตาลในเลือดตอนอดอาหาร', 'มก./ดล.') +
        '<button type="button" class="btn ghost" id="lipid-toggle" aria-expanded="false">+ ไขมันในเลือด (ถ้ามีผลตรวจ)</button>' +
        '<div class="fold" id="lipid-group" hidden>' + numField('tc', 'คอเลสเตอรอลรวม (TC)', 'มก./ดล.') + numField('ldl', 'LDL', 'มก./ดล.') +
        numField('hdl', 'HDL', 'มก./ดล.') + numField('tg', 'ไตรกลีเซอไรด์ (TG)', 'มก./ดล.') + '<div class="live" id="lipid-status"></div></div>' +
        yesNo('smoke', 'การสูบบุหรี่', 'ไม่สูบ', 'สูบ') + yesNo('alcohol', 'การดื่มแอลกอฮอล์', 'ไม่ดื่ม', 'ดื่ม') +
        '<div class="field" id="source-choice"' + (station ? ' hidden' : '') + '><div class="lab">วัดที่ไหน</div><div class="seg">' +
        '<button type="button" id="source-home" aria-pressed="true">บ้าน</button><button type="button" id="source-station" aria-pressed="false">จุดบริการ</button></div></div>' +
        (station ? '<div class="panel">บันทึกจากจุดบริการวันอบรม</div>' : '') +
        '<div class="confirm" id="confirm-change" hidden><b>ค่าน้ำหนักต่างจากครั้งก่อนมากกว่า 5 กก. ยืนยันหรือไม่</b><div class="small" id="confirm-detail"></div>' +
        '<button type="button" class="btn" id="confirm-ok">ยืนยัน ค่านี้ถูกต้อง</button><button type="button" class="btn ghost" id="confirm-cancel">ยกเลิก แก้ไขค่า</button></div>' +
        '<div class="err" id="form-error" role="alert"></div>' +
        '<button type="button" class="btn ghost" id="resend" hidden>ส่งอีกครั้ง</button>' +
        '<button type="button" class="btn" id="save">บันทึก</button>';

      var $ = function (s) { return UI.$(s, root); };
      var yn = { smoke: null, alcohol: null }, source = 'home';
      function val(id) { return $('#' + id).value.trim(); }
      function num(id) { return R().parseNumber(val(id)); }

      function setLive(id, level, text) { $('#' + id).innerHTML = level ? UI.status(level, text) : ''; }
      function live() {
        var r, w = num('weight'), wa = num('waist'), s = num('sys'), d = num('dia'), f = num('fbs');
        setLive('weight-status', 0);
        if (val('weight') && R().validate('weight', { weightKg: val('weight') }).ok && height) { r = R().bmi(w, height); $('#weight-status').innerHTML = '<span class="muted">BMI ' + r.value + '</span> ' + UI.status(r.level, r.label); }
        setLive('waist-status', 0);
        if (val('waist') && height && R().validate('waist', { waistCm: val('waist') }).ok) { r = R().waist(wa, height); setLive('waist-status', r.level, r.label); }
        setLive('bp-status', 0);
        if (val('sys') && val('dia') && R().validate('bp', { sys: val('sys'), dia: val('dia') }).ok) { r = R().bp(s, d); setLive('bp-status', r.level, r.label); }
        setLive('fbs-status', 0);
        if (val('fbs') && R().validate('fbs', { mgdl: val('fbs') }).ok) { r = R().fbs(f); setLive('fbs-status', r.level, r.label); }
        var lv = lipidValues();
        setLive('lipid-status', 0);
        if (Object.keys(lv).length && R().validate('lipid', lv).ok) { var nums = {}; for (var k in lv) nums[k] = R().parseNumber(lv[k]); r = R().lipid(nums); setLive('lipid-status', r.level, 'ไขมัน' + r.label); }
        ['smoke', 'alcohol'].forEach(function (k) { if (yn[k] !== null) { r = R()[k](yn[k]); setLive(k + '-status', r.level, r.label); } });
      }
      function lipidValues() { var o = {}; ['tc', 'ldl', 'hdl', 'tg'].forEach(function (k) { if (val(k)) o[k] = val(k); }); return o; }

      root.addEventListener('input', function (e) {
        var id = e.target.id; if (!id) return;
        var err = $('#' + id + '-error'); if (err) err.textContent = '';
        if (id === 'sys' || id === 'dia') $('#bp-error').textContent = '';
        $('#form-error').textContent = ''; $('#confirm-change').hidden = true;
        live();
      });
      $('#lipid-toggle').onclick = function () {
        var g = $('#lipid-group'); g.hidden = !g.hidden; this.setAttribute('aria-expanded', g.hidden ? 'false' : 'true');
      };
      ['smoke', 'alcohol'].forEach(function (k) {
        [['no', false], ['yes', true]].forEach(function (p) {
          $('#' + k + '-' + p[0]).onclick = function () {
            yn[k] = yn[k] === p[1] ? null : p[1]; // แตะซ้ำ = ไม่บันทึกค่านี้
            $('#' + k + '-no').setAttribute('aria-pressed', yn[k] === false); $('#' + k + '-yes').setAttribute('aria-pressed', yn[k] === true);
            live();
          };
        });
      });
      $('#source-home').onclick = $('#source-station').onclick = function () {
        source = this.id === 'source-home' ? 'home' : 'station';
        $('#source-home').setAttribute('aria-pressed', source === 'home'); $('#source-station').setAttribute('aria-pressed', source === 'station');
      };

      function collect() {
        var errors = {}, values = {}, any = false;
        function bad(id, msg) { errors[id] = msg; }
        if (val('weight')) { any = true; var c = R().validate('weight', { weightKg: val('weight') }); if (c.ok) values.weightKg = num('weight'); else bad('weight', c.message); }
        if (val('waist')) { any = true; c = R().validate('waist', { waistCm: val('waist') }); if (c.ok) values.waistCm = num('waist'); else bad('waist', c.message); }
        if (val('sys') || val('dia')) { any = true; c = R().validate('bp', { sys: val('sys'), dia: val('dia') }); if (c.ok) { values.sys = num('sys'); values.dia = num('dia'); } else bad('bp', c.message); }
        if (val('fbs')) { any = true; c = R().validate('fbs', { mgdl: val('fbs') }); if (c.ok) values.fbs = num('fbs'); else bad('fbs', c.message); }
        var lv = lipidValues();
        if (Object.keys(lv).length) {
          any = true; c = R().validate('lipid', lv);
          if (c.ok) { values.lipid = {}; for (var k in lv) values.lipid[k] = R().parseNumber(lv[k]); }
          else { var key = ['tc', 'ldl', 'hdl', 'tg'].filter(function (x) { return c.message.indexOf(x.toUpperCase()) >= 0; })[0] || 'tc'; bad(key, c.message); }
        }
        ['smoke', 'alcohol'].forEach(function (k) { if (yn[k] !== null) { any = true; values[k] = yn[k]; } });
        return { errors: errors, values: values, any: any };
      }

      var sending = false;
      async function submit(payload, retryDraft) {
        if (sending) return; sending = true;
        var btn = $('#save'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; $('#resend').hidden = true;
        try {
          var data = retryDraft ? await Api.resend() : await Api.call('saveMeasurements', payload);
          ctx.setBook(data); ctx.App.state.justSaved = true; ctx.go('#book');
        } catch (e) {
          if (e.code === 'not_registered') return;
          $('#form-error').textContent = e.message;
          if (e.code === 'network') $('#resend').hidden = false;
        } finally { sending = false; btn.disabled = false; btn.textContent = 'บันทึก'; }
      }

      var pendingPayload = null;
      $('#save').onclick = function () {
        ['weight', 'waist', 'bp', 'fbs', 'tc', 'ldl', 'hdl', 'tg'].forEach(function (k) { $('#' + k + '-error').textContent = ''; });
        $('#form-error').textContent = ''; $('#confirm-change').hidden = true;
        var c = collect(), ids = Object.keys(c.errors);
        if (ids.length) {
          ids.forEach(function (k) { $('#' + k + '-error').textContent = c.errors[k]; });
          if (c.errors.tc !== undefined || c.errors.ldl !== undefined || c.errors.hdl !== undefined || c.errors.tg !== undefined) { $('#lipid-group').hidden = false; }
          $('#' + ids[0] + '-error').scrollIntoView({ block: 'center' });
          return;
        }
        if (!c.any) { $('#form-error').textContent = 'กรุณากรอกอย่างน้อย 1 ค่า'; return; }
        var payload = { values: {}, source: source };
        var v = c.values;
        if (v.weightKg !== undefined) payload.values.weightKg = v.weightKg;
        if (v.waistCm !== undefined) payload.values.waistCm = v.waistCm;
        if (v.sys !== undefined) { payload.values.sys = v.sys; payload.values.dia = v.dia; }
        ['fbs', 'lipid', 'smoke', 'alcohol'].forEach(function (k) { if (v[k] !== undefined) payload.values[k] = v[k]; });
        if (station) payload.stationCode = station;
        if (v.weightKg !== undefined && prevW !== null && Math.abs(v.weightKg - prevW) > 5) {
          pendingPayload = payload;
          $('#confirm-detail').textContent = 'ครั้งก่อน ' + prevW + ' กก. ครั้งนี้ ' + v.weightKg + ' กก.';
          $('#confirm-change').hidden = false; $('#confirm-change').scrollIntoView({ block: 'center' });
          return;
        }
        submit(payload);
      };
      $('#confirm-ok').onclick = function () { $('#confirm-change').hidden = true; submit(pendingPayload); };
      $('#confirm-cancel').onclick = function () { $('#confirm-change').hidden = true; $('#weight').focus(); };
      $('#resend').onclick = function () { submit(null, true); };
      if (Api.getDraft()) { $('#resend').hidden = false; $('#form-error').textContent = 'มีข้อมูลที่ยังส่งไม่สำเร็จ กด "ส่งอีกครั้ง"'; }
    }
  };
})();
