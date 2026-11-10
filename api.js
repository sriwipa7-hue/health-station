/* Api.call(action, payload) -> Promise<data>
 * แนบ idToken + requestId (ใช้ซ้ำทุกครั้งที่ลองใหม่) · busy/เน็ตหลุด: ลองใหม่ 3 ครั้ง (1, 2, 4 วินาที) แล้วเก็บร่างใน localStorage
 * unauthorized: liff.login() 1 ครั้ง (ธงใน sessionStorage กันวนลูป) · not_registered: ไป #register */
window.Api = (function () {
  var DRAFT_KEY = 'hs.draft', LOGIN_FLAG = 'hs.loginTried';
  var DELAYS = /[?&]fast=1/.test(location.search) ? [10, 10, 10] : [1000, 2000, 4000];
  var GENERIC = 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  function session(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function fail(code, message, extra) { var e = new Error(message || GENERIC); e.code = code; if (extra) for (var k in extra) e[k] = extra[k]; return e; }

  function transport(body) {
    if (window.Mock) return window.Mock.post(body);
    return fetch(window.HS_CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }

  function saveDraft(d) { store(function (s) { s.setItem(DRAFT_KEY, JSON.stringify(d)); }); }
  function clearDraft() { store(function (s) { s.removeItem(DRAFT_KEY); }); }
  function getDraft() { try { return JSON.parse(store(function (s) { return s.getItem(DRAFT_KEY); })); } catch (e) { return null; } }

  async function send(action, payload, requestId) {
    var body = { action: action, idToken: liff.getIDToken(), payload: payload || {}, requestId: requestId };
    var attempt = 0, res;
    for (;;) {
      var network = false;
      try { res = await transport(body); } catch (e) { network = true; }
      if (!network && res && res.ok) { session(function (s) { s.removeItem(LOGIN_FLAG); }); return res.data; }
      var code = network ? 'network' : (res && res.code) || 'server';
      if (code === 'network' || (code === 'busy' && res.retry !== false)) {
        if (attempt < DELAYS.length) { await sleep(DELAYS[attempt++]); continue; }
        throw fail('network', 'ส่งข้อมูลไม่สำเร็จ ระบบเก็บค่าที่กรอกไว้ในเครื่องแล้ว กดส่งอีกครั้งเมื่อสัญญาณดีขึ้น');
      }
      if (code === 'unauthorized') {
        if (!session(function (s) { return s.getItem(LOGIN_FLAG); })) {
          session(function (s) { s.setItem(LOGIN_FLAG, '1'); });
          liff.login();
          return new Promise(function () {}); // หน้าจะถูกพาไปล็อกอินแล้วโหลดใหม่
        }
        throw fail('unauthorized', 'เข้าสู่ระบบไม่สำเร็จ กรุณาปิดแล้วเปิดหน้านี้จากแอป LINE อีกครั้ง');
      }
      if (code === 'not_registered') { location.hash = '#register'; throw fail('not_registered', 'ยังไม่ได้ลงทะเบียน'); }
      if (code === 'invalid') throw fail('invalid', res.error || res.message || 'ข้อมูลไม่ถูกต้อง');
      throw fail('server', GENERIC);
    }
  }

  async function call(action, payload, opts) {
    var requestId = (opts && opts.requestId) || newId();
    var write = action !== 'getMyBook' && action !== 'getConfig';
    try {
      var data = await send(action, payload, requestId);
      if (write) clearDraft();
      return data;
    } catch (e) {
      if (write && e.code === 'network') saveDraft({ action: action, payload: payload, requestId: requestId });
      throw e;
    }
  }

  function resend() {
    var d = getDraft();
    if (!d) return Promise.reject(fail('invalid', 'ไม่พบข้อมูลที่ค้างส่ง'));
    return call(d.action, d.payload, { requestId: d.requestId });
  }

  return { call: call, resend: resend, getDraft: getDraft, clearDraft: clearDraft };
})();
