/* eslint-disable */
// @ts-nocheck
/*
 * 下班逃離辦公室：角色模型與動作（three.js）。設計稿「角色模型」畫板的函式庫（F1）移植成 ES 模組：
 * 用基本幾何體組出低多邊形卡通角色，關節分層，動作全部是程式動畫。
 * 邏輯和設計稿裡的一樣，只把 window.THREE 換成 import；這個檔案不做型別檢查與 lint，修改時請保持原樣、只做必要的改動。
 *
 * buildChar(type) → 角色（root 要加進場景）；apply(c, pose) 套用姿勢；ACTIONS[id].fn(t) → 姿勢
 * stage(canvas, { chars: [{ type, action, x, y, h, view }] }) → 一張 2D 畫布上放多個 3D 角色（介紹頁主視覺），整個視窗共用一個 WebGL
 */
import * as THREE from "three";

  var INK = 0x1c1712;
var TAU = Math.PI * 2;

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function seg(u, a, b) { return ease((u - a) / (b - a)); }
function lerp(a, b, k) { return a + (b - a) * k; }

/* ---------- 材質與描邊 ---------- */
var gradMap = null;
function toon(color) {
  if (!gradMap) {
    var d = new Uint8Array([90, 170, 255]);
    gradMap = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
    gradMap.minFilter = THREE.NearestFilter;
    gradMap.magFilter = THREE.NearestFilter;
    gradMap.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color: color, gradientMap: gradMap });
}
var outlineMat = null;
function getOutlineMat() {
  if (!outlineMat) {
    outlineMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0.022 }, uC: { value: new THREE.Color(INK) } },
      vertexShader: 'uniform float uT; void main(){ vec3 p = position + normal * uT; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
      fragmentShader: 'uniform vec3 uC; void main(){ gl_FragColor = vec4(uC,1.0); }',
      side: THREE.BackSide
    });
  }
  return outlineMat;
}
var boxOutlineMat = null;
function part(geo, color, opts?) {
  opts = opts || {};
  var m = new THREE.Mesh(geo, opts.basic ? new THREE.MeshBasicMaterial({ color: color }) : toon(color));
  if (opts.outline !== false) {
    var o;
    if (opts.box) {
      if (!boxOutlineMat) boxOutlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      o = new THREE.Mesh(geo, boxOutlineMat);
      o.scale.setScalar(opts.box);
    } else {
      o = new THREE.Mesh(geo, getOutlineMat());
    }
    m.add(o);
  }
  return m;
}
function grp(parent, x, y, z) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; }

/* ---------- 角色外觀 ---------- */
var SPECS = {
  runner:    { name: '主角', skin: 0xf2c6a0, hair: 0x2b1d14, shirt: 0xeaf1fb, sleeve: 0xeaf1fb, forearm: 0xf2c6a0, pants: 0x3a4152, shoes: 0x2a1c14, tie: 0xe8762d, backpack: 0x2f6f73 },
  coworkerA: { name: '同事 A', skin: 0xf5cfae, hair: 0x5a3320, shirt: 0xf3b6a8, sleeve: 0xf3b6a8, forearm: 0xf3b6a8, pants: 0x4d4a63, shoes: 0x3b2a22, ponytail: true, mug: 0xffffff },
  coworkerB: { name: '同事 B', skin: 0xd9a77f, hair: 0x1a1410, shirt: 0x9fc7a4, sleeve: 0x9fc7a4, forearm: 0xd9a77f, pants: 0x6b5a45, shoes: 0x222222, glasses: true, tall: 1.06 },
  boss:      { name: '主管', skin: 0xf0c39c, hair: 0x6d6a66, shirt: 0x39404f, sleeve: 0x39404f, forearm: 0x39404f, pants: 0x2d323d, shoes: 0x1a1a1a, tie: 0xb8322a, glasses: true, belly: true, bald: true, mustache: true },
  cleaner:   { name: '清潔人員', skin: 0xe6b48d, hair: 0x2b1d14, shirt: 0x6fa3c9, sleeve: 0x6fa3c9, forearm: 0xe6b48d, pants: 0x4a6b85, shoes: 0x2a2a2a, cap: 0x2f5f86, cart: true },
  commuter:  { name: '路人', skin: 0xf2c6a0, hair: 0x3d2a1e, shirt: 0xb9a3d6, sleeve: 0xb9a3d6, forearm: 0xb9a3d6, pants: 0x30343c, shoes: 0xf2f2f2, phone: true }
};

function buildChar(type) {
  var s = SPECS[type] || SPECS.runner;
  var root = new THREE.Group();
  var body = grp(root);                 // 整體翻轉（跌倒、轉身）
  var hips = grp(body, 0, 0.83, 0);
  var spine = grp(hips, 0, 0.02, 0);
  var torso = part(new THREE.CapsuleGeometry(0.28, 0.3, 6, 16), s.shirt);
  torso.position.y = 0.38;
  torso.scale.set(s.belly ? 1.18 : 1, 1, s.belly ? 0.9 : 0.66);
  spine.add(torso);
  // 腰帶／褲頭
  var waist = part(new THREE.CylinderGeometry(0.27, 0.25, 0.14, 16), s.pants, { outline: false });
  waist.position.y = 0.06; waist.scale.z = s.belly ? 0.9 : 0.68; spine.add(waist);

  if (s.tie) {
    var tie = part(new THREE.BoxGeometry(0.07, 0.32, 0.03), s.tie, { box: 1.25 });
    tie.position.set(0, 0.48, (s.belly ? 0.26 : 0.19)); tie.rotation.x = -0.12; spine.add(tie);
  }
  if (s.backpack) {
    var bp = part(new THREE.BoxGeometry(0.44, 0.5, 0.2), s.backpack, { box: 1.06 });
    bp.position.set(0, 0.42, -0.27); spine.add(bp);
    var flap = part(new THREE.BoxGeometry(0.3, 0.16, 0.04), 0x245659, { outline: false });
    flap.position.set(0, 0.3, -0.38); spine.add(flap);
  }

  var neck = grp(spine, 0, 0.8, 0);
  var head = grp(neck, 0, 0.32, 0);
  head.add(part(new THREE.SphereGeometry(0.36, 22, 16), s.skin));
  // 頭髮
  var hairMat = s.hair;
  if (s.bald) {
    var band = part(new THREE.SphereGeometry(0.375, 20, 12, Math.PI, Math.PI, Math.PI * 0.3, Math.PI * 0.32), hairMat, { outline: false });
    band.material.side = THREE.DoubleSide; head.add(band);
  } else if (s.cap) {
    var cap = part(new THREE.SphereGeometry(0.39, 20, 12, 0, TAU, 0, Math.PI * 0.45), s.cap);
    cap.material.side = THREE.DoubleSide; cap.rotation.x = -0.15; head.add(cap);
    var brim = part(new THREE.BoxGeometry(0.42, 0.04, 0.22), s.cap, { box: 1.1 });
    brim.position.set(0, 0.16, 0.36); brim.rotation.x = 0.12; head.add(brim);
  } else {
    var hair = part(new THREE.SphereGeometry(0.385, 20, 12, 0, TAU, 0, Math.PI * 0.56), hairMat);
    hair.material.side = THREE.DoubleSide; hair.rotation.x = -0.38; head.add(hair);
  }
  if (s.ponytail) {
    var pt = part(new THREE.SphereGeometry(0.16, 14, 10), hairMat);
    pt.position.set(0, 0.04, -0.42); pt.scale.set(0.8, 1.2, 0.8); head.add(pt);
  }
  // 臉
  var face = grp(head);
  var eyeGeo = new THREE.SphereGeometry(0.048, 10, 8);
  var eyeL = part(eyeGeo, INK, { basic: true, outline: false }); eyeL.position.set(0.12, 0.03, 0.325); eyeL.scale.z = 0.5; face.add(eyeL);
  var eyeR = part(eyeGeo, INK, { basic: true, outline: false }); eyeR.position.set(-0.12, 0.03, 0.325); eyeR.scale.z = 0.5; face.add(eyeR);
  var browGeo = new THREE.BoxGeometry(0.11, 0.025, 0.02);
  var browL = part(browGeo, INK, { basic: true, outline: false }); browL.position.set(0.12, 0.13, 0.33); face.add(browL);
  var browR = part(browGeo, INK, { basic: true, outline: false }); browR.position.set(-0.12, 0.13, 0.33); face.add(browR);
  var mouth = part(new THREE.SphereGeometry(0.06, 12, 8), 0x7a2a1a, { basic: true, outline: false });
  mouth.position.set(0, -0.14, 0.33); face.add(mouth);
  var blush = new THREE.MeshBasicMaterial({ color: 0xf08a7a, transparent: true, opacity: 0.45 });
  [0.2, -0.2].forEach(function (x) { var b = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), blush); b.position.set(x, -0.07, 0.31); b.rotation.y = x * 1.6; face.add(b); });
  if (s.glasses) {
    var ringGeo = new THREE.TorusGeometry(0.085, 0.016, 6, 16);
    [0.12, -0.12].forEach(function (x) { var r = part(ringGeo, INK, { basic: true, outline: false }); r.position.set(x, 0.03, 0.35); face.add(r); });
    var bridge = part(new THREE.BoxGeometry(0.08, 0.016, 0.016), INK, { basic: true, outline: false }); bridge.position.set(0, 0.04, 0.36); face.add(bridge);
  }
  if (s.mustache) {
    var mu = part(new THREE.BoxGeometry(0.2, 0.05, 0.04), s.hair, { outline: false }); mu.position.set(0, -0.08, 0.35); face.add(mu);
    var nose = part(new THREE.SphereGeometry(0.06, 10, 8), s.skin); nose.position.set(0, -0.01, 0.37); face.add(nose);
  }

  // 手臂
  function arm(side) {
    var sh = grp(spine, side * (s.belly ? 0.38 : 0.34), 0.62, 0);
    var up = part(new THREE.CapsuleGeometry(0.085, 0.16, 4, 10), s.sleeve); up.position.y = -0.16; sh.add(up);
    var el = grp(sh, 0, -0.31, 0);
    var fo = part(new THREE.CapsuleGeometry(0.078, 0.14, 4, 10), s.forearm); fo.position.y = -0.14; el.add(fo);
    var hand = grp(el, 0, -0.3, 0);
    hand.add(part(new THREE.SphereGeometry(0.09, 12, 10), s.skin));
    return { sh: sh, el: el, hand: hand };
  }
  var aL = arm(1), aR = arm(-1);
  // 腿
  function leg(side) {
    var hp = grp(hips, side * 0.14, 0, 0);
    var th = part(new THREE.CapsuleGeometry(0.1, 0.22, 4, 10), s.pants); th.position.y = -0.2; hp.add(th);
    var kn = grp(hp, 0, -0.4, 0);
    var sn = part(new THREE.CapsuleGeometry(0.09, 0.22, 4, 10), s.pants); sn.position.y = -0.18; kn.add(sn);
    var ft = part(new THREE.BoxGeometry(0.18, 0.1, 0.3), s.shoes, { box: 1.12 }); ft.position.set(0, -0.38, 0.06); kn.add(ft);
    return { hp: hp, kn: kn };
  }
  var lL = leg(1), lR = leg(-1);

  // 手上的東西
  if (s.mug) {
    var mug = part(new THREE.CylinderGeometry(0.07, 0.065, 0.14, 12), s.mug); mug.position.set(0, -0.06, 0.06); aL.hand.add(mug);
  }
  var phone = null;
  if (s.phone) {
    phone = part(new THREE.BoxGeometry(0.12, 0.2, 0.02), 0x22252c, { box: 1.15 });
    phone.position.set(0, -0.04, 0.09); phone.rotation.x = -1.1; aR.hand.add(phone);
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshBasicMaterial({ color: 0x9ad7ff }));
    scr.position.z = 0.011; phone.add(scr);
  }
  var cart = null;
  if (s.cart) {
    cart = grp(root, 0, 0, 0.82);
    var bin = part(new THREE.BoxGeometry(0.62, 0.5, 0.56), 0xd7dde3, { box: 1.05 }); bin.position.y = 0.42; cart.add(bin);
    var bucket = part(new THREE.CylinderGeometry(0.15, 0.12, 0.2, 14), 0xf2c230); bucket.position.set(0.12, 0.77, 0.06); cart.add(bucket);
    var mop = part(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), 0x9a7b55); mop.position.set(-0.18, 0.95, 0.02); mop.rotation.z = 0.15; cart.add(mop);
    var bar = part(new THREE.CylinderGeometry(0.03, 0.03, 0.66, 8), 0x55606b); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.92, -0.34); cart.add(bar);
    [[0.25, 0.22], [-0.25, 0.22], [0.25, -0.22], [-0.25, -0.22]].forEach(function (p) {
      var w = part(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), 0x2a2a2a, { outline: false }); w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.07, p[1]); cart.add(w);
    });
  }
  // 腳下的影子
  var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005;

  var scaleH = s.tall || 1;
  root.scale.setScalar(scaleH);
  return {
    type: type, root: root, body: body, hips: hips, spine: spine, neck: neck, head: head,
    aL: aL, aR: aR, lL: lL, lR: lR, eyeL: eyeL, eyeR: eyeR, browL: browL, browR: browR, mouth: mouth,
    cart: cart, shadow: shadow
  };
}

/* ---------- 動作（姿勢 = 一組關節角度，單位弧度）---------- */
var KEYS = ['x', 'y', 'z', 'pitch', 'roll', 'yaw', 'lean', 'side', 'twist', 'headX', 'headY', 'headZ',
  'lArm', 'lOut', 'lEl', 'rArm', 'rOut', 'rEl', 'lLeg', 'lKn', 'rLeg', 'rKn', 'mouthW', 'mouthH', 'brow', 'cartZ'];
function P(o) { var p = {}; KEYS.forEach(function (k) { p[k] = 0; }); p.mouthW = 1; p.mouthH = 0.3; p.cartZ = 0.82; for (var k in o) p[k] = o[k]; return p; }

function runCycle(t, f, amp, o) {
  var ph = t * TAU * f, s = Math.sin(ph);
  return P(Object.assign({
    y: 0.07 * Math.abs(Math.cos(ph)), lean: 0.26, headX: -0.14, twist: 0.12 * s,
    lArm: -0.85 * amp * s, rArm: 0.85 * amp * s, lEl: 1.35, rEl: 1.35, lOut: 0.1, rOut: 0.1,
    lLeg: 0.85 * amp * s, rLeg: -0.85 * amp * s,
    lKn: 0.25 + 1.0 * amp * Math.max(0, Math.sin(ph - 1.2)), rKn: 0.25 + 1.0 * amp * Math.max(0, -Math.sin(ph - 1.2)),
    mouthW: 0.8, mouthH: 0.45
  }, o || {}));
}
function walkCycle(t, f, amp, o) {
  var ph = t * TAU * f, s = Math.sin(ph);
  return P(Object.assign({
    y: 0.03 * Math.abs(Math.cos(ph)), lean: 0.05,
    lArm: -0.45 * amp * s, rArm: 0.45 * amp * s, lEl: 0.3, rEl: 0.3, lOut: 0.06, rOut: 0.06,
    lLeg: 0.5 * amp * s, rLeg: -0.5 * amp * s,
    lKn: 0.1 + 0.6 * amp * Math.max(0, Math.sin(ph - 1.2)), rKn: 0.1 + 0.6 * amp * Math.max(0, -Math.sin(ph - 1.2))
  }, o || {}));
}

var ACTIONS = {
  /* 主角 */
  ready: { label: '待機・看錶', still: 0.4, fn: function (t) {
    var u = (t % 3) / 3, look = 1 - seg(u, 0.55, 0.7) + seg(u, 0.92, 1);
    var b = Math.abs(Math.sin(t * TAU * 1.4));
    return P({ y: 0.03 * b, lKn: 0.12 + 0.12 * b, rKn: 0.12 + 0.12 * b, lLeg: 0.06, rLeg: 0.06,
      lArm: lerp(0.15, 1.15, look), lEl: lerp(0.2, 1.75, look), lOut: lerp(0.08, -0.35, look),
      rArm: -0.1, rEl: 0.35, rOut: 0.12 + 0.05 * b, headX: lerp(-0.05, 0.42, look), headY: lerp(0, 0.35, look),
      brow: 0.6, mouthW: 0.7, mouthH: 0.25 });
  } },
  run: { label: '跑', still: 0.15, fn: function (t) { return runCycle(t, 1.7, 1); } },
  jump: { label: '跳', still: 0.62, fn: function (t) {
    var D = 1.3, u = (t % D) / D;
    var crouch = seg(u, 0, 0.12) * (1 - seg(u, 0.12, 0.2)) + seg(u, 0.66, 0.72) * (1 - seg(u, 0.72, 0.85));
    var a = clamp((u - 0.16) / 0.5, 0, 1), air = (u > 0.16 && u < 0.66) ? 1 : 0;
    var tuck = Math.sin(a * Math.PI) * air;
    var base = runCycle(t, 1.7, 1 - Math.max(air, crouch));
    var p = P({ y: 3.6 * a * (1 - a) * air * 0.9 - 0.12 * crouch, lean: 0.25 + 0.25 * crouch - 0.15 * tuck,
      lLeg: 1.1 * tuck + 0.4 * crouch, rLeg: 0.2 * tuck + 0.4 * crouch, lKn: 1.5 * tuck + 0.9 * crouch, rKn: 1.0 * tuck + 0.9 * crouch,
      lArm: 2.5 * tuck - 0.3 * crouch, rArm: 2.5 * tuck - 0.3 * crouch, lEl: 0.4, rEl: 0.4, lOut: 0.35 * tuck, rOut: 0.35 * tuck,
      headX: -0.2 * tuck, mouthW: 0.6, mouthH: 0.3 + 0.6 * tuck, brow: -0.3 * tuck });
    var k = Math.max(air, crouch);
    for (var key in p) p[key] = lerp(base[key], p[key], k);
    return p;
  } },
  lane: { label: '換線', still: 0.6, fn: function (t) {
    var w = t * TAU * 0.45, x = Math.tanh(Math.sin(w) * 2.4) / Math.tanh(2.4);
    var v = Math.cos(w);
    return runCycle(t, 1.7, 1, { x: 0.48 * x, roll: -0.28 * v, side: -0.12 * v, headZ: 0.1 * v, lOut: 0.1 + 0.4 * Math.max(0, v), rOut: 0.1 + 0.4 * Math.max(0, -v) });
  } },
  trip: { label: '跌倒', still: 1.0, fn: function (t) {
    var D = 2.4, u = (t % D) / D;
    var fall = seg(u, 0.1, 0.32), up = seg(u, 0.72, 0.95), down = fall * (1 - up);
    var bounce = Math.max(0, Math.sin((u - 0.32) * 30)) * 0.05 * (u > 0.32 && u < 0.45 ? 1 : 0);
    var base = runCycle(t, 1.7, 1 - down);
    var p = P({ pitch: 1.42 * down, y: 0.24 * down + bounce, z: 0.25 * down, lean: -0.1 * down,
      lArm: 2.7 * down, rArm: 2.5 * down, lEl: 0.3, rEl: 0.4, lOut: 0.5 * down, rOut: 0.5 * down,
      lLeg: -0.3 * down, rLeg: -0.05 * down, lKn: 1.3 * down, rKn: 0.6 * down + 0.3 * Math.sin(t * 9) * down,
      headX: -0.6 * down, mouthW: 0.6, mouthH: 0.85 * down + 0.3, brow: 1 });
    for (var key in p) p[key] = lerp(base[key], p[key], down);
    return p;
  } },
  held: { label: '被拉住', still: 0.3, fn: function (t) {
    var tug = Math.sin(t * TAU * 0.9), sh = Math.sin(t * 31) * 0.02;
    return runCycle(t, 2.6, 0.45, { lean: 0.62 + 0.06 * tug, z: -0.06 * tug + sh, headX: -0.35, headY: 0.25 + 0.1 * tug,
      rArm: -1.15 - 0.15 * tug, rEl: 0.1, rOut: 0.25, lArm: 1.5 + 0.2 * Math.sin(t * 6), lEl: 0.25, lOut: 0.15,
      mouthW: 1.1, mouthH: 0.55, brow: 1 });
  } },
  board: { label: '擠進電梯', still: 0.35, fn: function (t) {
    var D = 2.8, u = (t % D) / D;
    var turn = seg(u, 0.02, 0.18) * (1 - seg(u, 0.55, 0.68)), win = seg(u, 0.62, 0.72) * (1 - seg(u, 0.94, 1));
    var step = Math.sin(t * TAU * 2.2);
    var hop = win * Math.abs(Math.sin((u - 0.62) * 14)) * 0.28;
    return P({ yaw: 1.45 * turn, x: 0.12 * step * turn, y: hop, lean: -0.08 * turn,
      lArm: 2.9 * turn + 0.2 * win, lEl: 0.3 * turn + 0.4 * win, lOut: -0.2 * turn + 0.35 * win,
      rArm: 2.9 * turn + 2.7 * win, rEl: 0.3 * turn + 0.9 * win, rOut: -0.2 * turn + 0.3 * win,
      lLeg: 0.35 * step * turn, rLeg: -0.35 * step * turn, lKn: 0.2 * turn, rKn: 0.2 * turn,
      headX: -0.15 * win, mouthW: lerp(0.5, 1.2, win), mouthH: lerp(0.2, 0.75, win), brow: 0.7 * turn - 0.4 * win });
  } },
  cheer: { label: '歡呼', still: 0.3, fn: function (t) {
    var ph = t * TAU * 1.25, hop = Math.max(0, Math.sin(ph)), sw = Math.sin(t * TAU * 0.6);
    return P({ y: 0.3 * hop, lean: -0.1, headX: -0.28, headZ: 0.08 * sw, yaw: 0.12 * sw,
      lArm: 2.75, rArm: 2.75, lOut: 0.55 + 0.1 * hop, rOut: 0.55 + 0.1 * hop, lEl: 0.15 + 0.25 * hop, rEl: 0.15 + 0.25 * hop,
      lLeg: 0.2 * hop, rLeg: 0.05 * hop, lKn: 0.45 - 0.2 * hop + 0.5 * hop, rKn: 0.45 - 0.2 * hop + 0.3 * hop,
      mouthW: 1.25, mouthH: 0.95, brow: -0.3 });
  } },
  /* 同事 */
  chat: { label: '搭話', still: 0.2, fn: function (t) {
    var w = Math.sin(t * TAU * 1.8);
    return P({ rOut: 2.3, rArm: 0.2, rEl: 0.7 + 0.45 * w, lArm: 0.55, lEl: 1.5, lOut: -0.1,
      headZ: 0.14 + 0.05 * Math.sin(t * 2), headX: -0.05, y: 0.015 * Math.abs(Math.sin(t * 3)),
      lKn: 0.08, rKn: 0.08, mouthW: 0.8, mouthH: 0.25 + 0.5 * Math.abs(Math.sin(t * 9)), brow: -0.4 });
  } },
  grab: { label: '拉住你', still: 0.3, fn: function (t) {
    var tug = Math.sin(t * TAU * 0.9);
    return P({ lean: -0.22 - 0.06 * tug, z: 0.04 * tug, lArm: 1.45, rArm: 1.3, lEl: 0.2 + 0.15 * tug, rEl: 0.3 + 0.15 * tug, lOut: -0.15, rOut: -0.15,
      lLeg: 0.45, rLeg: -0.35, lKn: 0.35, rKn: 0.15, headX: -0.1, mouthW: 0.8, mouthH: 0.25 + 0.5 * Math.abs(Math.sin(t * 8)), brow: -0.4 });
  } },
  walk: { label: '走動', still: 0.2, fn: function (t) { return walkCycle(t, 0.95, 1, { headY: 0.15 * Math.sin(t * 0.8) }); } },
  /* 主管 */
  patrol: { label: '巡視', still: 0.1, fn: function (t) {
    return walkCycle(t, 0.7, 0.75, { lArm: -0.55, rArm: -0.55, lEl: 1.5, rEl: 1.5, lOut: -0.05, rOut: -0.05, lean: -0.08,
      headY: 0.75 * Math.sin(t * TAU * 0.28), headX: 0.05, brow: -0.6, mouthW: 0.9, mouthH: 0.15 });
  } },
  call: { label: '叫住', still: 0.2, fn: function (t) {
    var pump = Math.abs(Math.sin(t * TAU * 1.1));
    return P({ rArm: 1.45 + 0.15 * pump, rEl: 0.15, rOut: -0.08, lArm: -0.3, lEl: 1.9, lOut: 0.55, lean: 0.12 + 0.05 * pump,
      headX: -0.12, headZ: -0.08, y: 0.02 * pump, lLeg: 0.15, rLeg: -0.1, lKn: 0.1, rKn: 0.1,
      mouthW: 0.85, mouthH: 0.45 + 0.4 * pump, brow: -0.7 });
  } },
  /* 清潔人員 */
  push: { label: '推車', still: 0.2, fn: function (t) {
    return walkCycle(t, 0.85, 0.9, { lean: 0.35, lArm: 1.05, rArm: 1.05, lEl: 0.55, rEl: 0.55, lOut: 0.05, rOut: 0.05, headX: -0.25, cartZ: 0.82 + 0.03 * Math.sin(t * TAU * 1.7) });
  } },
  rest: { label: '擦汗', still: 0.5, fn: function (t) {
    var wipe = Math.sin(t * TAU * 0.8);
    return P({ rArm: 2.2, rEl: 2.0, rOut: -0.45 + 0.2 * wipe, lArm: 0.7, lEl: 0.5, headX: -0.15, headZ: 0.06 * wipe,
      lKn: 0.08, rKn: 0.08, mouthW: 0.9, mouthH: 0.2, brow: 0.5, cartZ: 0.95 });
  } },
  /* 路人 */
  phone: { label: '低頭滑手機', still: 0.2, fn: function (t) {
    return walkCycle(t, 0.7, 0.6, { rArm: 1.0, rEl: 1.2, rOut: -0.05, lArm: 0.1, headX: 0.5, headY: 0.08, lean: 0.06, mouthW: 0.6, mouthH: 0.15 });
  } },
  rush: { label: '趕路', still: 0.15, fn: function (t) { return runCycle(t, 1.8, 0.9, { rArm: 1.0, rEl: 1.3, headX: 0.1, brow: 0.8 }); } }
};
var CAST = {
  runner: ['ready', 'run', 'jump', 'lane', 'trip', 'held', 'board', 'cheer'],
  coworkerA: ['chat', 'grab', 'walk'], coworkerB: ['chat', 'grab', 'walk'],
  boss: ['patrol', 'call'], cleaner: ['push', 'rest'], commuter: ['phone', 'rush']
};

function apply(c, p) {
  c.root.position.x = c.baseX + p.x;
  c.body.position.set(0, p.y, p.z);
  c.body.rotation.set(p.pitch, c.baseYaw + p.yaw, p.roll, 'YXZ');
  c.spine.rotation.set(p.lean, p.twist, p.side);
  c.head.rotation.set(p.headX, p.headY, p.headZ);
  c.aL.sh.rotation.set(-p.lArm, 0, p.lOut); c.aL.el.rotation.x = -p.lEl;
  c.aR.sh.rotation.set(-p.rArm, 0, -p.rOut); c.aR.el.rotation.x = -p.rEl;
  c.lL.hp.rotation.x = -p.lLeg; c.lL.kn.rotation.x = p.lKn;
  c.lR.hp.rotation.x = -p.rLeg; c.lR.kn.rotation.x = p.rKn;
  c.mouth.scale.set(p.mouthW, clamp(p.mouthH, 0.12, 1.1), 0.4);
  c.browL.rotation.z = -0.35 * p.brow; c.browR.rotation.z = 0.35 * p.brow;
  c.browL.position.y = c.browR.position.y = 0.13 + 0.02 * Math.abs(p.brow);
  if (c.cart) c.cart.position.z = p.cartZ;
  var lift = Math.max(0, p.y);
  c.shadow.position.set(c.root.position.x + p.z * Math.sin(c.baseYaw), 0.005, p.z + (p.pitch > 0.5 ? 0.9 * Math.min(1, p.pitch / 1.4) : 0));
  c.shadow.scale.setScalar(clamp(1 - lift * 0.45, 0.4, 1) * (p.pitch > 0.5 ? 1.5 : 1));
}

function mount(canvas, opts) {
  opts = opts || {};
  var W = +canvas.getAttribute('width') || canvas.clientWidth || 300;
  var H = +canvas.getAttribute('height') || canvas.clientHeight || 300;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  var scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f74, 1.6));
  var sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(3, 6, 4); scene.add(sun);
  var rim = new THREE.DirectionalLight(0xffe3c4, 0.8); rim.position.set(-4, 3, -5); scene.add(rim);

  var cam = new THREE.PerspectiveCamera(opts.fov || 28, W / H, 0.1, 100);
  var viewH = opts.viewHeight || 3.2, targetY = opts.targetY != null ? opts.targetY : 1.15;
  var dist = (viewH / 2) / Math.tan((cam.fov / 2) * Math.PI / 180);
  var visW = viewH * (W / H);
  var list = opts.chars || [{ type: 'runner', action: 'run' }];
  var n = list.length, spacing = opts.spacing || visW / n;
  var view = opts.view || 'front';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var chars = list.map(function (d, i) {
    var c = buildChar(d.type);
    c.baseX = (i - (n - 1) / 2) * spacing;
    c.yawOffset = d.yaw || 0;
    c.action = d.action || CAST[d.type][0];
    c.t = i * 0.37; c.blend = 1; c.from = null; c.cur = null;
    scene.add(c.root); scene.add(c.shadow);
    return c;
  });

  function placeCamera() {
    var el = (view === 'back' ? 26 : 9) * Math.PI / 180;
    var dir = view === 'back' ? -1 : 1;
    cam.position.set(0, targetY + dist * Math.sin(el), dir * dist * Math.cos(el));
    cam.lookAt(0, targetY, 0);
    chars.forEach(function (c) { c.baseYaw = (view === 'back' ? 0 : (opts.baseYaw != null ? opts.baseYaw : 0.32)) + c.yawOffset; });
  }
  placeCamera();

  function pose(c) {
    var a = ACTIONS[c.action] || ACTIONS.run;
    return a.fn(reduce ? a.still * 2 : c.t);
  }
  var running = true, visible = true, raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    chars.forEach(function (c) {
      if (!reduce) c.t += dt;
      var p = pose(c);
      if (c.blend < 1 && c.from) {
        c.blend = Math.min(1, c.blend + dt / 0.28);
        var k = ease(c.blend), q = {};
        for (var key in p) q[key] = lerp(c.from[key], p[key], k);
        p = q;
      }
      c.cur = p;
      // 眨眼
      var bl = ((c.t + c.baseX) % 3.2) < 0.12 ? 0.12 : 0.5;
      c.eyeL.scale.y = c.eyeR.scale.y = bl * 2;
      apply(c, p);
    });
    renderer.render(scene, cam);
    if (running && visible && !reduce) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  var io = null;
  if (window.IntersectionObserver) {
    io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); });
    io.observe(canvas);
  }
  kick();
  return {
    setAction: function (i, id) {
      var c = chars[i]; if (!c || !ACTIONS[id] || c.action === id) return;
      c.from = c.cur; c.blend = c.from ? 0 : 1; c.action = id; c.t = 0; kick();
    },
    setView: function (v) { if (v === view) return; view = v; placeCamera(); kick(); },
    dispose: function () { running = false; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); renderer.dispose(); }
  };
}

/* ---------- 舞台：一張畫布放多個角色，整個視窗共用一個 WebGL ---------- */
var shared = null;
function getShared() {
  if (shared) return shared;
  var cv = document.createElement('canvas');
  var r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setClearColor(0x000000, 0);
  r.autoClear = false;
  var sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f74, 1.6));
  var sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(3, 6, 4); sc.add(sun);
  var rim = new THREE.DirectionalLight(0xffe3c4, 0.8); rim.position.set(-4, 3, -5); sc.add(rim);
  shared = { r: r, scene: sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80), w: 0, h: 0 };
  return shared;
}

function stage(canvas, opts) {
  opts = opts || {};
  var S = getShared();
  var W = +canvas.getAttribute('width') || canvas.clientWidth || 300;
  var H = +canvas.getAttribute('height') || canvas.clientHeight || 300;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit() {
    var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  fit();
  var chars = (opts.chars || []).map(function (d, i) {
    var c = buildChar(d.type);
    c.baseX = 0;
    c.view = d.view || 'front';
    c.baseYaw = d.yaw != null ? d.yaw : (c.view === 'back' ? 0 : 0.25);
    c.action = d.action || CAST[d.type][0];
    c.t = i * 0.53; c.blend = 1; c.from = null; c.cur = null;
    c.px = d.x; c.py = d.y; c.ph = d.h || 160; c.elev = d.elev;
    c.root.visible = false; c.shadow.visible = false;
    S.scene.add(c.root); S.scene.add(c.shadow);
    return c;
  });
  var order = chars.slice().sort(function (a, b) { return a.py - b.py; });

  function draw(c) {
    var el = (c.elev != null ? c.elev : (c.view === 'back' ? 24 : 12)) * Math.PI / 180;
    var dir = c.view === 'back' ? -1 : 1;
    var k = 2.4 * Math.cos(el) / c.ph;
    var bw = c.ph * 1.6, bh = c.ph * 1.8, fb = c.ph * 0.2;
    var cam = S.cam;
    cam.left = -bw / 2 * k; cam.right = bw / 2 * k; cam.top = (bh - fb) * k; cam.bottom = -fb * k;
    cam.updateProjectionMatrix();
    cam.position.set(0, 30 * Math.sin(el), dir * 30 * Math.cos(el));
    cam.lookAt(0, 0, 0);
    var pw = Math.ceil(bw * dpr), ph = Math.ceil(bh * dpr);
    if (S.w < pw || S.h < ph) { S.w = Math.max(S.w, pw); S.h = Math.max(S.h, ph); S.r.setSize(S.w, S.h, false); }
    S.r.setScissorTest(true);
    S.r.setViewport(0, 0, pw, ph); S.r.setScissor(0, 0, pw, ph);
    S.r.clear();
    c.root.visible = true; c.shadow.visible = true;
    S.r.render(S.scene, cam);
    c.root.visible = false; c.shadow.visible = false;
    var src = S.r.domElement;
    ctx.drawImage(src, 0, src.height - ph, pw, ph,
      Math.round((c.px - bw / 2) * dpr), Math.round((c.py - (bh - fb)) * dpr), pw, ph);
  }

  var running = true, visible = true, raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    fit();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    order.forEach(function (c) {
      if (!reduce) c.t += dt;
      var a = ACTIONS[c.action] || ACTIONS.run;
      var p = a.fn(reduce ? a.still * 2 : c.t);
      if (c.blend < 1 && c.from) {
        c.blend = Math.min(1, c.blend + dt / 0.28);
        var kk = ease(c.blend), q = {};
        for (var key in p) q[key] = lerp(c.from[key], p[key], kk);
        p = q;
      }
      c.cur = p;
      var bl = ((c.t + c.px * 0.01) % 3.2) < 0.12 ? 0.12 : 0.5;
      c.eyeL.scale.y = c.eyeR.scale.y = bl * 2;
      apply(c, p);
      draw(c);
    });
    if (running && visible && !reduce) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && running) { last = 0; raf = requestAnimationFrame(frame); } }
  var io = null;
  if (window.IntersectionObserver) {
    io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); });
    io.observe(canvas);
  }
  kick();
  return {
    setAction: function (i, id) {
      var c = chars[i]; if (!c || !ACTIONS[id] || c.action === id) return;
      c.from = c.cur; c.blend = c.from ? 0 : 1; c.action = id; c.t = 0; kick();
    },
    dispose: function () {
      running = false; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect();
      chars.forEach(function (c) { S.scene.remove(c.root); S.scene.remove(c.shadow); });
    }
  };
}

export { mount, stage, buildChar, apply, part, toon, ACTIONS, CAST, SPECS, ease, lerp, clamp };
