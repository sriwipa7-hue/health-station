/* เริ่มระบบ: LIFF → เราเตอร์ตาม location.hash → Screens[name].render(root, ctx) */
window.UI = (function () {
  var SYM = { ok: '●', risk: '▲', sick: '■' };
  var GROUP = { ok: 'กลุ่มปกติ', risk: 'กลุ่มเสี่ยง', sick: 'กลุ่มป่วย' };
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function status(level, label, id) { return '<span class="st ' + level + '"' + (id ? ' id="' + id + '"' : '') + '>' + SYM[level] + ' ' + esc(label) + '</span>'; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  return { SYM: SYM, GROUP: GROUP, esc: esc, status: status, $: $ };
})();

window.App = (function () {
  var NAMES = ['book', 'record', 'exercise', 'forms', 'rewards', 'compare', 'register'];
  var state = { book: null, fresh: false, config: null };
  var root;

  function parse() {
    var h = location.hash.replace(/^#/, ''), i = h.indexOf('?'), name = i < 0 ? h : h.slice(0, i);
    var params = {};
    if (i >= 0) new URLSearchParams(h.slice(i + 1)).forEach(function (v, k) { params[k] = v; });
    if (NAMES.indexOf(name) < 0) name = 'book';
    return { name: name, params: params };
  }

  // useCache: หลังบันทึกสำเร็จเรามีสมุดล่าสุดอยู่แล้ว ไม่ต้องถามซ้ำ
  async function loadBook(useCache) {
    if (useCache && state.fresh && state.book) { state.fresh = false; return state.book; }
    state.book = await Api.call('getMyBook');
    return state.book;
  }
  function setBook(b) { state.book = b; state.fresh = true; }
  async function loadConfig() {
    if (!state.config) state.config = await Api.call('getConfig');
    return state.config;
  }

  function ctx(params) { return { App: App, UI: UI, Api: Api, params: params, loadBook: loadBook, loadConfig: loadConfig, setBook: setBook,
    go: function (h) { location.hash = h; } }; }

  async function route() {
    var r = parse();
    var screen = window.Screens && Screens[r.name];
    if (!screen) {
      root.innerHTML = '<h1>หน้านี้กำลังจัดทำ</h1><p class="muted">ขออภัยค่ะ หน้านี้ยังเปิดใช้งานไม่ได้</p><a class="btn" href="#book">กลับสมุดของฉัน</a>';
      return;
    }
    root.innerHTML = '<p class="muted">กำลังโหลด…</p>';
    window.scrollTo(0, 0);
    try { await screen.render(root, ctx(r.params)); }
    catch (e) { if (!e || e.code !== 'not_registered') root.innerHTML = '<p class="err">' + UI.esc((e && e.message) || 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง') + '</p><a class="btn" href="#book" onclick="location.reload()">ลองอีกครั้ง</a>'; }
  }

  async function start() {
    root = document.getElementById('app');
    try {
      if (!window.liff) throw new Error('liff');
      if (!window.Mock) {
        if (!HS_CONFIG.LIFF_ID) { root.innerHTML = '<p class="err">ยังไม่ได้ตั้งค่า LIFF ID — แจ้งผู้ดูแลระบบ</p>'; return; }
        await liff.init({ liffId: HS_CONFIG.LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
      } else { await liff.init({}); }
    } catch (e) { root.innerHTML = '<p class="err">เปิดหน้านี้ไม่สำเร็จ กรุณาเปิดจากเมนูในแอป LINE</p>'; return; }
    window.addEventListener('hashchange', route);
    route();
  }

  var App = { state: state, loadBook: loadBook, setBook: setBook, start: start };
  document.addEventListener('DOMContentLoaded', function () {}); // สคริปต์โหลดหลัง DOM พร้อมแล้ว
  start();
  return App;
})();
