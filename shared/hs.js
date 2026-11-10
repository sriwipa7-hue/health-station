/*
 * HS namespace pattern (every shared/*.js file follows this; no require/import in GAS).
 *
 * One global object `HS` holds every module as a property (HS.rules, HS.dates, ...).
 *  - hs.js creates it:                 var HS = (typeof HS !== 'undefined') ? HS : {};
 *  - each module file (rules.js, ...) starts with the same `var HS` line plus a
 *    Node-only fallback `require('./hs.js')`, then attaches itself: HS.rules = {...}
 *    and ends with `if (typeof module !== 'undefined' && module.exports) module.exports = HS;`
 * Environments:
 *  - Node:   const HS = require('../shared/rules.js')  -> HS with rules populated
 *            (hs.js alone returns the bare, shared HS object)
 *  - Browser: <script src="shared/hs.js"> then <script src="shared/rules.js">  -> window.HS
 *  - Apps Script: files concatenated in one global scope; hs.js must sort before modules.
 * Modules must not use ES module syntax, require() for anything but ./hs.js, or Node/DOM APIs.
 */
var HS = (typeof HS !== 'undefined') ? HS : {};
if (typeof module !== 'undefined' && module.exports) module.exports = HS;
