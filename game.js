/* global THREE, CARD_DATA, ArchiveCore, ArchiveAI */
// The Hidden Archive — Three.js table (imperative shell).
// All rules live in core.js; this file renders the engine state, turns pointer
// input into engine actions, rolls the physical dice and runs the AI's turn.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const root = $('game');
  const loading = $('loading');
  const loadingMessage = $('loading-message');
  const hint = $('hint');
  const turnStatus = $('turn-status');
  const finishTurnButton = $('finish-turn');
  const eventLog = $('event-log');
  const rollResult = $('roll-result');
  const actionPanel = $('action-panel');
  const dialog = $('dialog');
  const inspector = $('inspector');
  const menu = $('menu');

  if (!window.THREE) {
    loading.classList.add('failed');
    loadingMessage.innerHTML = '<strong>THREE.JS COULD NOT BE LOADED</strong><small>Check your internet connection and reload the page.</small>';
    return;
  }
  if (location.protocol === 'file:') {
    loading.classList.add('failed');
    loadingMessage.innerHTML = '<strong>THE ARCHIVE NEEDS A LOCAL WEB SERVER</strong>Browsers block local image textures when an HTML file is opened directly.<code>./serve.command</code><small>Double-click serve.command, then open http://localhost:8080</small>';
    return;
  }

  const Core = window.ArchiveCore;
  const AI = window.ArchiveAI;
  Core.setCardData(CARD_DATA);
  const HUMAN = 0, CPU = 1;
  const SPHERE_COLORS = { state: '#7f9bb6', capital: '#d2ad52', occult: '#a777cf', fringe: '#6dbb78' };
  const SPHERE_BLURB = {
    state: 'Firewalls, surveillance and arrests. Expose the enemy, then archive what you exposed.',
    capital: 'Money talks. Network groups fund buy-outs, card draw and the biggest bodies.',
    occult: 'Secret societies. Covert groups, slow Secrecy leaks and subversive takeovers.',
    fringe: 'UFOs and cryptids. Haste, Pierce and dice-driven chaos. Hit hard, hit first.'
  };

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090a09);
  scene.fog = new THREE.FogExp2(0x090a09, 0.024);
  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);
  function fitCamera() {
    camera.aspect = innerWidth / innerHeight;
    // Pull back on narrow screens so the 16-unit-wide table stays in view.
    const pull = THREE.MathUtils.clamp(1.75 / camera.aspect, 1.12, 2.3);
    camera.position.set(0, 12.4 * pull, 11.6 * pull);
    camera.lookAt(0, 0, -0.1);
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  fitCamera();

  scene.add(new THREE.HemisphereLight(0xe7c984, 0x172019, 1.45));
  const key = new THREE.DirectionalLight(0xffd68c, 2.1);
  key.position.set(-4, 9, 5);
  key.castShadow = true;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10; key.shadow.camera.right = 10; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
  scene.add(key);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
  const CARD_W = 1.56, CARD_H = 2.18;
  const cardGeometry = makeRoundedCardGeometry(CARD_W, CARD_H, .075);
  const glowGeometry = makeRoundedCardGeometry(CARD_W + .16, CARD_H + .16, .12);
  const billboardTarget = new THREE.Object3D();
  const targetQuaternion = new THREE.Quaternion();
  const cameraDirection = new THREE.Vector3();
  const zoomTarget = new THREE.Vector3();
  const motions = new Map();
  const meshes = new Map();          // engine uid -> mesh
  const textureCache = new Map();    // card id -> texture
  let atlasImage, chromeImage, backTexture, table;
  let dice = [], diceShadows = [], diceAnimation = null;
  const deckStacks = [[], []];

  // ---------- Table geometry ----------
  // +z is toward the human player. Field rows sit either side of the centre line.
  const POS = {
    hand: [4.35, -5.7],
    field: [1.45, -1.75],
    fronts: [new THREE.Vector3(-7.2, 0, 2.75), new THREE.Vector3(-7.2, 0, -4.45)],
    traps: [new THREE.Vector3(-7.2, 0, 0.2), new THREE.Vector3(-7.2, 0, -1.95)],
    deck: [new THREE.Vector3(7.0, 0, 2.75), new THREE.Vector3(7.0, 0, -4.45)],
    archive: [new THREE.Vector3(7.0, 0, 0.2), new THREE.Vector3(7.0, 0, -1.95)]
  };
  const FIELD_ZONE = { minZ: -0.3, maxZ: 3.0, maxX: 5.9 };
  const FRONT_ZONE = { maxX: -6.0, minZ: 1.5, maxZ: 5.2 };

  // ---------- State ----------
  let G = null;                 // engine state
  let mode = 'menu';            // menu | idle | drag | target | selected | dialog | reroll | busy | over
  let zoomed = null, modeBeforeZoom = null, cardZoom = 0;
  let hovered = null, dragging = null, pressed = null, suppressNextClick = false;
  let pendingPlay = null;       // { uid, list }
  let selected = null;          // own group uid
  let selectedMode = 'strike';  // strike | takeover
  let validTargets = new Set();
  let logCursor = 0;
  let humanSphere = 'occult';

  // ---------- Helpers ----------
  function makeRoundedCardGeometry(width, height, radius) {
    const hw = width / 2, hh = height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + radius, -hh);
    shape.lineTo(hw - radius, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + radius);
    shape.lineTo(hw, hh - radius);
    shape.quadraticCurveTo(hw, hh, hw - radius, hh);
    shape.lineTo(-hw + radius, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - radius);
    shape.lineTo(-hw, -hh + radius);
    shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);
    const geometry = new THREE.ShapeGeometry(shape, 5);
    const pos = geometry.attributes.position, uvs = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) uvs.setXY(i, pos.getX(i) / width + .5, pos.getY(i) / height + .5);
    uvs.needsUpdate = true;
    return geometry;
  }
  function canvasTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = url => new Promise((resolve, reject) => textureLoader.load(url, resolve, undefined, reject));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const typeLabel = d => ({ group: 'Group', operation: 'Operation', referendum: 'Referendum', asset: 'Asset', trap: 'Countermeasure' })[d.type];

  // ---------- Card faces ----------
  const CARD_ATLAS_COLUMNS = 16;
  function wrap(ctx, text, width) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > width && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function makeCardTexture(id) {
    if (textureCache.has(id)) return textureCache.get(id);
    const d = CARD_DATA[id];
    const canvas = document.createElement('canvas');
    canvas.width = 636; canvas.height = 888;
    const ctx = canvas.getContext('2d');
    const cellW = atlasImage.width / CARD_ATLAS_COLUMNS, cellH = atlasImage.height / CARD_ATLAS_COLUMNS;
    const col = id % CARD_ATLAS_COLUMNS, row = Math.floor(id / CARD_ATLAS_COLUMNS);
    const cropH = cellW * 117 / 142;
    ctx.fillStyle = '#d7ccb0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(atlasImage, col * cellW, row * cellH + (cellH - cropH) / 2, cellW, cropH, 30, 29, 575, 473);
    ctx.drawImage(chromeImage, 0, 0, canvas.width, canvas.height);
    const sphereColor = SPHERE_COLORS[d.sphere];
    // Title
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#eee8d7';
    let size = 43;
    do { ctx.font = `600 ${size--}px Crimson`; } while (ctx.measureText(d.name).width > 470 && size > 23);
    ctx.fillText(d.name, 300, 533);
    // Cost medallion
    ctx.beginPath(); ctx.arc(82, 82, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#16120ee8'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = sphereColor; ctx.stroke();
    ctx.fillStyle = '#f0dba4'; ctx.font = 'bold 50px Cardo'; ctx.fillText(String(d.cost), 82, 86);
    // Type line with sphere pip
    ctx.textAlign = 'left'; ctx.fillStyle = '#29251e'; ctx.font = '30px Cardo';
    const sphereName = ArchiveCore.SPHERES[d.sphere].name.replace('The ', '');
    ctx.fillText(`${typeLabel(d)} — ${sphereName}`, 52, 598);
    ctx.beginPath(); ctx.arc(578, 598, 13, 0, Math.PI * 2); ctx.fillStyle = sphereColor; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#29251e'; ctx.stroke();
    // Body: keywords, rules text, flavour
    const isGroup = d.type === 'group';
    const bodyBottom = isGroup ? 790 : 840;
    const rules = Core.describe(d);
    const kw = (d.keywords || []).join(' · ');
    let fs = 30, lh, lines;
    for (; fs >= 20; fs -= 2) {
      lh = fs * 1.25;
      lines = [];
      if (kw) { ctx.font = `${fs}px CrimsonSemi`; wrap(ctx, kw, 532).forEach(t => lines.push({ t, f: `${fs}px CrimsonSemi` })); }
      if (rules) { ctx.font = `${fs}px Crimson`; wrap(ctx, rules, 532).forEach(t => lines.push({ t, f: `${fs}px Crimson` })); }
      if (650 + lines.length * lh <= bodyBottom + 4) break;
    }
    if (!kw && !rules) lines = [];
    let y = 650;
    ctx.fillStyle = '#29251e';
    lines.forEach(l => { ctx.font = l.f; ctx.fillText(l.t, 52, y); y += lh; });
    ctx.font = `italic 25px CrimsonItalic`; ctx.fillStyle = '#5b5244';
    const flavor = wrap(ctx, d.flavor || '', isGroup ? 400 : 532);
    const room = Math.floor((bodyBottom - y + 6) / 31);
    flavor.slice(0, Math.max(0, room)).forEach(t => { ctx.fillText(t, 52, y + 6); y += 31; });
    // Power / Resistance
    if (isGroup) {
      ctx.fillStyle = '#17130fe6';
      roundRect(ctx, 462, 788, 136, 62, 10); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = sphereColor; ctx.stroke();
      ctx.fillStyle = '#f2e3bd'; ctx.textAlign = 'center'; ctx.font = 'bold 42px Cardo';
      ctx.fillText(`${d.power}/${d.toughness}`, 530, 821);
    }
    const tex = canvasTexture(canvas);
    textureCache.set(id, tex);
    return tex;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Live status badge drawn under field groups.
  function drawBadge(mesh) {
    const b = mesh.userData.badge;
    const ctx = b.ctx;
    const uid = mesh.userData.uid;
    const c = G.cards[uid];
    const d = Core.def(G, uid);
    const isGroup = d.type === 'group';
    const p = isGroup ? Core.power(G, uid) : 0, r = isGroup ? Core.remaining(G, uid) : 0;
    const tags = [];
    if (c.exposed) tags.push(['EXPOSED', '#ff6b5c']);
    if (c.detained) tags.push(['DETAINED', '#8fb3ff']);
    else if (isGroup && G.players[c.ctrl].field.includes(uid) && c.ctrl === G.active && Core.canAct(G, uid)) tags.push(['READY', '#9be28f']);
    if (isGroup && c.grant && c.grant.includes('Loyal')) tags.push(['TURNED', '#e0c071']);
    const key = [p, r, c.dmg, tags.map(t => t[0]).join(), d.type].join('|');
    if (b.key === key) return;
    b.key = key;
    ctx.clearRect(0, 0, 320, 80);
    ctx.fillStyle = '#0c0b09e8'; roundRect(ctx, 2, 2, 316, 76, 14); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = c.exposed ? '#c8473b' : '#7d6337'; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 21px Cinzel';
    ctx.textAlign = 'left';
    let x = 16;
    if (!isGroup) { ctx.fillStyle = '#d8c497'; ctx.fillText(d.type === 'asset' ? 'ASSET · ONGOING' : '', x, 41); }
    ctx.font = `bold ${tags.length > 1 ? 17 : 21}px Cinzel`;
    tags.slice(0, 2).forEach(([t, col]) => { ctx.fillStyle = col; ctx.fillText(t, x, 41); x += ctx.measureText(t).width + 10; });
    if (isGroup) {
      ctx.textAlign = 'right'; ctx.font = 'bold 44px Cardo';
      const basePow = d.power, baseRes = d.toughness;
      ctx.fillStyle = p > basePow ? '#9be28f' : p < basePow ? '#ff8a7a' : '#f2e3bd';
      const resText = String(r);
      ctx.fillText(resText, 304, 43);
      const wRes = ctx.measureText(resText).width;
      ctx.fillStyle = '#9f8a63'; ctx.fillText('/', 304 - wRes - 2, 43);
      const wSlash = ctx.measureText('/').width;
      ctx.fillStyle = p > basePow ? '#9be28f' : p < basePow ? '#ff8a7a' : '#f2e3bd';
      ctx.fillText(String(p), 304 - wRes - wSlash - 4, 43);
      ctx.fillStyle = r < baseRes ? '#ff8a7a' : r > baseRes ? '#9be28f' : '#f2e3bd';
      ctx.fillText(resText, 304, 43);
    }
    b.texture.needsUpdate = true;
  }

  // ---------- Meshes ----------
  function createCardMesh(uid) {
    const c = G.cards[uid];
    const front = new THREE.MeshStandardMaterial({ map: makeCardTexture(c.id), roughness: 0.71, metalness: 0.04, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(cardGeometry, front);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const back = new THREE.Mesh(cardGeometry, new THREE.MeshStandardMaterial({ map: backTexture, roughness: .68 }));
    back.rotation.y = Math.PI; back.position.z = -.002; back.castShadow = true;
    mesh.add(back);
    const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ color: 0xd4a84f, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    glow.position.z = -.006; glow.renderOrder = -1;
    mesh.add(glow);
    const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 320; badgeCanvas.height = 80;
    const badgeTex = canvasTexture(badgeCanvas);
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .375), new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, depthWrite: false }));
    badge.position.set(0, -1.12, .02); badge.visible = false;
    mesh.add(badge);
    mesh.userData = { uid, zone: 'deck', target: new THREE.Vector3(), rot: 0, faceDown: true, glow, badgeMesh: badge,
      badge: { ctx: badgeCanvas.getContext('2d'), texture: badgeTex, key: null } };
    mesh.visible = false;
    scene.add(mesh);
    meshes.set(uid, mesh);
    return mesh;
  }
  function flatQuat(rot, faceDown) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(faceDown ? Math.PI / 2 : -Math.PI / 2, 0, faceDown ? Math.PI + rot : rot));
  }

  function makeTable(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    table = new THREE.Mesh(new THREE.PlaneGeometry(18, 13.5), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.02 }));
    table.rotation.x = -Math.PI / 2; table.position.set(0, -0.09, -0.4); table.receiveShadow = true;
    scene.add(table);
    const zoneMat = (op) => new THREE.MeshBasicMaterial({ color: 0x9b7436, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
    const addZone = (w, h, x, z, op = .045) => {
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(w, h), zoneMat(op));
      zone.rotation.x = -Math.PI / 2; zone.position.set(x, 0.012, z); scene.add(zone);
      const border = new THREE.LineSegments(new THREE.EdgesGeometry(zone.geometry), new THREE.LineBasicMaterial({ color: 0xb58b45, transparent: true, opacity: .24 }));
      border.rotation.copy(zone.rotation); border.position.copy(zone.position); scene.add(border);
      return zone;
    };
    addZone(12.4, 2.75, -0.3, POS.field[0]);
    addZone(12.4, 2.75, -0.3, POS.field[1], .03);
    [0, 1].forEach(p => {
      addZone(2.1, 2.5, POS.fronts[p].x, POS.fronts[p].z, p ? .03 : .07);
      addZone(2.1, 2.5, POS.traps[p].x, POS.traps[p].z, .02);
      addZone(2.1, 2.5, POS.archive[p].x, POS.archive[p].z, .02);
      tableLabel(p ? 'ENEMY FRONTS' : 'YOUR FRONTS', POS.fronts[p].x, POS.fronts[p].z);
      tableLabel(p ? 'ENEMY COUNTERS' : 'COUNTERMEASURES', POS.traps[p].x, POS.traps[p].z);
      tableLabel(p ? 'ENEMY ARCHIVE' : 'YOUR ARCHIVE', POS.archive[p].x, POS.archive[p].z);
    });
  }
  function tableLabel(text, x, z) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '600 34px Cinzel'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8bf83'; ctx.globalAlpha = .62; ctx.fillText(text, 256, 34);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .2375), new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.position.set(x, .015, z);
    scene.add(label);
  }
  function makeDeckStacks() {
    backTexture.colorSpace = THREE.SRGBColorSpace;
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < 6; i++) {
        const card = new THREE.Mesh(cardGeometry, new THREE.MeshStandardMaterial({ map: backTexture, roughness: .68 }));
        card.quaternion.copy(flatQuat(0, false));
        card.position.set(POS.deck[p].x, 0.03 + i * .025, POS.deck[p].z + i * .01);
        card.castShadow = true; card.receiveShadow = true; scene.add(card);
        deckStacks[p].push(card);
      }
    }
  }

  // ---------- Dice ----------
  const dieFaceNormals = [
    { value: 1, normal: new THREE.Vector3(1, 0, 0) }, { value: 6, normal: new THREE.Vector3(-1, 0, 0) },
    { value: 2, normal: new THREE.Vector3(0, 1, 0) }, { value: 5, normal: new THREE.Vector3(0, -1, 0) },
    { value: 3, normal: new THREE.Vector3(0, 0, 1) }, { value: 4, normal: new THREE.Vector3(0, 0, -1) }
  ];
  function makeDieFaceTexture(baseImage, value) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.drawImage(baseImage, 0, 0, 256, 256);
    const positions = {
      1: [[.5, .5]], 2: [[.3, .3], [.7, .7]], 3: [[.3, .3], [.5, .5], [.7, .7]],
      4: [[.3, .3], [.7, .3], [.3, .7], [.7, .7]], 5: [[.3, .3], [.7, .3], [.5, .5], [.3, .7], [.7, .7]],
      6: [[.3, .25], [.7, .25], [.3, .5], [.7, .5], [.3, .75], [.7, .75]]
    };
    ctx.shadowColor = '#000'; ctx.shadowBlur = 9; ctx.fillStyle = '#e0b45c';
    positions[value].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * 256, y * 256, 20, 0, Math.PI * 2); ctx.fill(); });
    return canvasTexture(canvas);
  }
  function makeDice(baseTexture) {
    const materials = [1, 6, 2, 5, 3, 4].map(value => new THREE.MeshStandardMaterial({ map: makeDieFaceTexture(baseTexture.image, value), roughness: .48, metalness: .12 }));
    const dieSize = 1.56 * 16 / 63;
    const geometry = new THREE.BoxGeometry(dieSize, dieSize, dieSize, 2, 2, 2);
    dice = [0, 1].map(i => {
      const die = new THREE.Mesh(geometry, materials); die.visible = false;
      die.castShadow = true; die.receiveShadow = true; die.renderOrder = 200 + i;
      scene.add(die); return die;
    });
    const shadowGeometry = new THREE.PlaneGeometry(dieSize * .88, dieSize * .88);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .72, depthWrite: false });
    diceShadows = dice.map((die, i) => {
      const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.075; shadow.visible = false; shadow.renderOrder = 190 + i; scene.add(shadow);
      return shadow;
    });
  }
  function createDieBody(die, velocity, angular) {
    const half = die.geometry.parameters.width / 2;
    const points = [];
    for (let x = -1; x <= 1; x += 2) for (let y = -1; y <= 1; y += 2) for (let z = -1; z <= 1; z += 2) {
      const local = new THREE.Vector3(x * half, y * half, z * half).applyQuaternion(die.quaternion);
      const position = die.position.clone().add(local);
      const pointVelocity = velocity.clone().add(new THREE.Vector3().crossVectors(angular, local));
      points.push({ position, previous: position.clone().addScaledVector(pointVelocity, -1 / 120) });
    }
    const constraints = [];
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) constraints.push({ a, b, length: points[a].position.distanceTo(points[b].position) });
    return { points, constraints, half };
  }
  function syncDieFromBody(die, body) {
    die.position.set(0, 0, 0);
    body.points.forEach(point => die.position.add(point.position));
    die.position.multiplyScalar(1 / body.points.length);
    const x = body.points[4].position.clone().sub(body.points[0].position).normalize();
    const y = body.points[2].position.clone().sub(body.points[0].position).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    y.crossVectors(z, x).normalize();
    die.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  function topFaceValueFromQuaternion(quaternion) {
    const up = new THREE.Vector3(0, 1, 0);
    let bestValue = 2, bestDot = -Infinity;
    dieFaceNormals.forEach(face => {
      const dot = face.normal.clone().applyQuaternion(quaternion).dot(up);
      if (dot > bestDot) { bestDot = dot; bestValue = face.value; }
    });
    return bestValue;
  }
  function applyRollingImpulse(body, dt, floor) {
    const center = body.points.reduce((sum, point) => sum.add(point.position), new THREE.Vector3()).multiplyScalar(1 / body.points.length);
    const contactPoints = [];
    const contactVelocity = new THREE.Vector3();
    body.points.forEach(point => {
      if (point.position.y <= floor + .012) { contactPoints.push(point); contactVelocity.add(point.position.clone().sub(point.previous)); }
    });
    if (!contactPoints.length) return;
    contactVelocity.multiplyScalar(1 / contactPoints.length); contactVelocity.y = 0;
    const speed = contactVelocity.length();
    if (speed < .025) return;
    const axis = new THREE.Vector3(contactVelocity.z, 0, -contactVelocity.x);
    const axisLength = axis.length();
    if (axisLength < 1e-6) return;
    axis.multiplyScalar(1 / axisLength);
    const spin = Math.min(.16, speed * dt * 2.2) * Math.min(1, contactPoints.length / 4);
    if (spin <= 0) return;
    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, spin);
    body.points.forEach(point => { point.position.sub(center).applyQuaternion(rotation).add(center); });
  }
  function simulateDiceStep(bodies, dt) {
    const floor = -.09;
    const gravity = 9.81 * (2.18 / .088);
    const deskRestitution = .72, contactFriction = .24, wallRestitution = .56, wallFriction = .9;
    bodies.forEach(body => body.points.forEach(point => {
      const velocity = point.position.clone().sub(point.previous).multiplyScalar(.999);
      point.previous.copy(point.position);
      point.position.add(velocity); point.position.y -= gravity * dt * dt;
    }));
    for (let iteration = 0; iteration < 7; iteration++) {
      bodies.forEach(body => {
        body.constraints.forEach(constraint => {
          const a = body.points[constraint.a].position, b = body.points[constraint.b].position;
          const delta = b.clone().sub(a); const distance = Math.max(delta.length(), 1e-6);
          delta.multiplyScalar((distance - constraint.length) / distance * .5);
          a.add(delta); b.sub(delta);
        });
        body.points.forEach(point => {
          const dx = point.position.x - point.previous.x, dy = point.position.y - point.previous.y, dz = point.position.z - point.previous.z;
          if (point.position.y < floor) {
            point.position.y = floor;
            point.previous.y = point.position.y + dy * deskRestitution;
            point.previous.x = point.position.x - dx * contactFriction;
            point.previous.z = point.position.z - dz * contactFriction;
          }
          for (const [axis, lo, hi, o1, o2] of [['x', -8.45, 8.45, 'y', 'z'], ['z', -6.75, 5.95, 'x', 'y']]) {
            const d = { x: dx, y: dy, z: dz };
            if (point.position[axis] < lo || point.position[axis] > hi) {
              point.position[axis] = point.position[axis] < lo ? lo : hi;
              point.previous[axis] = point.position[axis] + d[axis] * wallRestitution;
              point.previous[o1] = point.position[o1] - d[o1] * wallFriction;
              point.previous[o2] = point.position[o2] - d[o2] * wallFriction;
            }
          }
        });
      });
      if (bodies.length === 2) {
        const centers = bodies.map(body => body.points.reduce((sum, point) => sum.add(point.position), new THREE.Vector3()).multiplyScalar(1 / 8));
        const delta = centers[1].clone().sub(centers[0]);
        const overlap = bodies[0].half * 2 - Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z));
        if (overlap > 0) {
          const axis = Math.abs(delta.x) >= Math.abs(delta.z) ? new THREE.Vector3(Math.sign(delta.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(delta.z) || 1);
          bodies.forEach((body, i) => body.points.forEach(point => point.position.addScaledVector(axis, (i ? 1 : -1) * overlap * .25)));
        }
      }
      bodies.forEach(body => applyRollingImpulse(body, dt, floor));
    }
  }
  // Throw `count` physical dice; resolves with the faces they land on.
  function rollPhysicalDice(owner, count) {
    const isPlayer = owner === HUMAN;
    const used = dice.slice(0, count);
    dice.forEach((die, i) => { die.visible = i < count; diceShadows[i].visible = i < count; });
    used.forEach((die, i) => {
      die.position.set(isPlayer ? 5.2 + i * .34 : -5.2 - i * .34, 1.5 + i * .22, isPlayer ? 4.35 + i * .12 : -4.75 - i * .12);
      die.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    });
    return new Promise(resolve => {
      const direction = isPlayer ? 1 : -1;
      const jitter = () => (Math.random() - .5) * 4;
      const velocities = [new THREE.Vector3(-18 * direction + jitter(), 27, -16 * direction + jitter()), new THREE.Vector3(-21 * direction + jitter(), 30, -13 * direction + jitter())];
      const angular = [new THREE.Vector3(11.7 + jitter(), 14.4, 10.1), new THREE.Vector3(-13.2, 11.9 + jitter(), 15.3)];
      diceAnimation = { start: performance.now(), resolve, count, last: performance.now(), accumulator: 0 };
      diceAnimation.bodies = used.map((die, i) => createDieBody(die, velocities[i], angular[i]));
    });
  }
  async function showRoll(total, label, success) {
    rollResult.querySelector('small').textContent = label;
    rollResult.querySelector('strong').textContent = total;
    rollResult.classList.toggle('fail', success === false);
    rollResult.classList.toggle('ok', success === true);
    rollResult.classList.add('show');
    await wait(success == null ? 650 : 1050);
    rollResult.classList.remove('show');
    dice.forEach(die => { die.visible = false; });
    diceShadows.forEach(shadow => { shadow.visible = false; });
  }

  // ---------- Layout: engine state -> mesh targets ----------
  function place(mesh, zone, target, rot, faceDown, order = 0) {
    const u = mesh.userData;
    if (!mesh.visible) {
      // Entering play from a pile: start at that player's deck.
      const owner = G.cards[u.uid].owner;
      mesh.position.copy(POS.deck[owner]).setY(.45);
      mesh.quaternion.copy(flatQuat(0, true));
      mesh.visible = true;
    }
    u.zone = zone; u.target.copy(target); u.rot = rot; u.faceDown = faceDown;
    mesh.renderOrder = order;
  }
  function layout() {
    if (!G) return;
    const seen = new Set();
    for (let p = 0; p < 2; p++) {
      const P = G.players[p];
      const human = p === HUMAN;
      // Hand
      const n = P.hand.length;
      P.hand.forEach((uid, i) => {
        const m = meshes.get(uid); if (m === dragging || (pendingPlay && pendingPlay.uid === uid)) { seen.add(uid); return; }
        const offset = i - (n - 1) / 2;
        if (human) {
          const spacing = Math.min(1.2, 7.4 / Math.max(n - 1, 1));
          place(m, 'hand', new THREE.Vector3(offset * spacing - .3, .14 + i * .009, POS.hand[0] + Math.abs(offset) * .07), -offset * .04, false, i);
        } else {
          const spacing = Math.min(.62, 4.2 / Math.max(n - 1, 1));
          place(m, 'opp-hand', new THREE.Vector3(offset * spacing - .3, .05 + i * .006, POS.hand[1]), offset * .03, true, i);
        }
        seen.add(uid);
      });
      // Field
      const F = P.field;
      const spacing = Math.min(1.74, 11.6 / Math.max(F.length, 1));
      F.forEach((uid, i) => {
        const m = meshes.get(uid);
        const c = G.cards[uid];
        const x = (i - (F.length - 1) / 2) * spacing - .3;
        place(m, 'field', new THREE.Vector3(x, .06 + i * .004, POS.field[p]), c.exhausted ? .14 : 0, false, 10 + i);
        seen.add(uid);
      });
      // Fronts (face-down fan)
      P.fronts.forEach((uid, i) => {
        place(meshes.get(uid), 'front', POS.fronts[p].clone().add(new THREE.Vector3((i % 6) * .07, .03 + i * .012, -Math.floor(i / 6) * .25 + (i % 6) * .02)), -.05 + (i % 3) * .04, true, 30 + i);
        seen.add(uid);
      });
      // Traps
      P.traps.forEach((uid, i) => {
        place(meshes.get(uid), 'trap', POS.traps[p].clone().add(new THREE.Vector3(i * .32, .04 + i * .02, i * .12)), .06 * (i ? 1 : -1), true, 40 + i);
        seen.add(uid);
      });
      // Archive: show the top three
      P.archive.forEach((uid, i) => {
        const m = meshes.get(uid);
        const top = i >= P.archive.length - 3;
        if (!top) { if (m.visible && !motions.has(m) && m.userData.zone === 'archive') m.visible = false; seen.add(uid); return; }
        place(m, 'archive', POS.archive[p].clone().add(new THREE.Vector3(0, .05 + (i - P.archive.length + 3) * .02, 0)), .03 * ((i % 3) - 1), false, 50 + i);
        seen.add(uid);
      });
      // Deck stacks
      deckStacks[p].forEach((card, i) => { card.visible = P.deck.length > i * 7; });
    }
    meshes.forEach((m, uid) => { if (!seen.has(uid) && m !== dragging) { m.visible = false; m.userData.zone = 'deck'; } });
    refreshHud();
  }

  // ---------- HUD ----------
  function refreshHud() {
    if (!G) return;
    for (let p = 0; p < 2; p++) {
      const P = G.players[p];
      const el = $(p === HUMAN ? 'player-panel' : 'opponent-panel');
      el.querySelector('strong').textContent = P.name.toUpperCase();
      el.querySelector('.secrecy').innerHTML = `<span>◆</span>${Math.max(0, P.secrecy)}`;
      const groups = Core.groupsOf(G, p).length;
      el.querySelector('small').textContent = `${groups} group${groups === 1 ? '' : 's'} · ${P.fronts.length} front${P.fronts.length === 1 ? '' : 's'} · hand ${P.hand.length} · deck ${P.deck.length}`;
      el.querySelector('.narrative').hidden = G.narrative !== p;
      el.querySelector('.portrait').classList.toggle('active', G.active === p);
      el.querySelector('.portrait').style.borderColor = SPHERE_COLORS[P.sphere];
      el.classList.toggle('targetable', mode === 'selected' && p === CPU && validTargets.has('player'));
    }
    const P = G.players[HUMAN];
    $('influence').innerHTML = `INFLUENCE <b>${G.active === HUMAN ? P.influence : '–'}</b><small>${P.fronts.length} FRONTS${P.frontPlayed ? '' : ' · DRAG A CARD HERE FOR +1'}</small>`;
    $('influence').classList.toggle('pulse', G.active === HUMAN && !P.frontPlayed && mode === 'idle');
    const status = G.phase === 'over' ? (G.winner === HUMAN ? 'VICTORY' : 'DEFEAT')
      : zoomed ? 'INSPECTING DOSSIER · TAP TO CLOSE'
        : G.active === HUMAN ? (mode === 'reroll' ? 'REROLL OR ACCEPT' : mode === 'busy' ? 'RESOLVING' : `YOUR TURN ${Math.ceil(G.turn / 2)}`) : 'THE ENEMY IS ACTING';
    turnStatus.innerHTML = `<span class="turn-dot"></span>${status}`;
    finishTurnButton.disabled = !(G.active === HUMAN && G.phase === 'main' && ['idle', 'selected'].includes(mode) && !G.pending);
    // Valid-move glows
    meshes.forEach((m, uid) => {
      const u = m.userData;
      const glow = u.glow.material;
      let color = null, opacity = 0;
      const c = G.cards[uid];
      if (uid === selected) { color = 0x6fd6ff; opacity = .85; }
      else if (validTargets.has(uid)) { color = selectedMode === 'takeover' && mode === 'selected' ? 0xc58cff : 0xffc35a; opacity = .8; }
      else if (u.zone === 'field' && c.exposed) { color = 0xc8473b; opacity = .45; }
      else if (G.active === HUMAN && mode === 'idle' && u.zone === 'field' && c.ctrl === HUMAN && Core.canAct(G, uid)) { color = 0x88d17a; opacity = .35; }
      else if (G.active === HUMAN && mode === 'idle' && u.zone === 'hand' && canPlayFromHand(uid)) { color = 0xd4a84f; opacity = .3; }
      if (color != null) glow.color.setHex(color);
      u.glowOpacity = opacity;
      const showBadge = u.zone === 'field';
      u.badgeMesh.visible = showBadge;
      if (showBadge) drawBadge(m);
      m.material.color.setScalar(u.zone === 'field' && c.exhausted ? .62 : 1);
    });
  }
  function canPlayFromHand(uid) {
    return Core.legalActions(G).some(a => a.type === 'play' && a.uid === uid);
  }
  function flushLog() {
    if (!G) return;
    const lines = G.log.slice(logCursor);
    logCursor = G.log.length;
    if (!lines.length) return;
    const recent = G.log.slice(-3);
    eventLog.innerHTML = recent.map((l, i) => `<div class="${i === recent.length - 1 ? 'latest' : ''}">${escapeHtml(l)}</div>`).join('');
    const full = $('log-full');
    lines.forEach(l => { const div = document.createElement('div'); div.textContent = l; full.appendChild(div); });
    full.scrollTop = full.scrollHeight;
  }
  const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function setHint(text) {
    hint.textContent = text || '';
    hint.classList.toggle('show', !!text);
  }

  // ---------- Performing actions ----------
  // Every engine action, human or AI, goes through here: stage, roll real dice,
  // apply, then animate the result.
  async function perform(action, actor) {
    mode = 'busy'; validTargets = new Set(); refreshHud();
    const needs = Core.rollsFor(G, action);
    const ctx = { rolls: [] };
    if (action.type === 'takeover' || action.type === 'strike') await stageAttack(action);
    if (action.type === 'play' && !(actor === CPU && Core.def(G, action.uid).type === 'trap')) await stagePlay(action);
    if (needs) {
      const values = [];
      while (values.length < needs) {
        const n = Math.min(2, needs - values.length);
        values.push(...await rollPhysicalDice(actor, n));
      }
      ctx.rolls = [...values];
    }
    const events = Core.apply(G, action, ctx);
    flushLog();
    for (const e of events) {
      if (e.t === 'roll') {
        const label = e.kind === 'chaos' ? 'DAMAGE ROLL' : `TAKEOVER · NEED ${e.need} OR LESS`;
        await showRoll(e.total, label, e.kind === 'chaos' ? null : e.success);
      }
      if (e.t === 'trap') { flashBanner(`COUNTERMEASURE — ${Core.def(G, e.uid).name.toUpperCase()}`); revealTrap(e.uid); await wait(900); }
      if (e.t === 'narrative') flashBanner(e.p === HUMAN ? 'YOU SEIZE THE NARRATIVE' : 'THE ENEMY SEIZES THE NARRATIVE');
    }
    layout();
    await wait(action.type === 'end' ? 250 : 420);
    mode = G.active === HUMAN && actor === HUMAN ? 'idle' : 'busy';
    if (G.phase === 'over') return gameOver();
  }
  function revealTrap(uid) {
    const m = meshes.get(uid);
    if (!m) return;
    m.userData.faceDown = false;
    m.userData.target.set(0, 1.6, 0);
  }
  function stageAttack(action) {
    const m = meshes.get(action.uid);
    if (!m) return wait(0);
    const goal = action.target === 'player'
      ? new THREE.Vector3(m.position.x * .5, .9, G.active === HUMAN ? -3.4 : 3.6)
      : meshes.get(action.target).position.clone().lerp(m.position, .45).setY(.9);
    return moveCard(m, goal, 0, 260).then(() => wait(80));
  }
  function stagePlay(action) {
    const m = meshes.get(action.uid);
    if (!m) return wait(0);
    m.userData.faceDown = false;
    return moveCard(m, new THREE.Vector3(-.3, 1.1, G.active === HUMAN ? 1.1 : -1.1), 0, 320).then(() => wait(G.active === HUMAN ? 120 : 520));
  }
  function moveCard(card, target, rot = 0, duration = 650) {
    return new Promise(resolve => {
      card.visible = true;
      motions.set(card, { from: card.position.clone(), to: target.clone(), fromQuat: card.quaternion.clone(), toQuat: flatQuat(rot, false), start: performance.now(), duration, resolve });
    });
  }
  function flashBanner(text) {
    const b = $('banner');
    b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  // ---------- Turn flow ----------
  async function finishTurn() {
    if (G.active !== HUMAN || G.phase !== 'main' || !['idle', 'selected'].includes(mode)) return;
    clearSelection();
    await perform({ type: 'end' }, HUMAN);
    if (G.phase === 'main') runAiTurn();
  }
  async function runAiTurn() {
    mode = 'busy'; refreshHud();
    await wait(500);
    let guard = 0;
    while (G.phase === 'main' && G.active === CPU && guard++ < 60) {
      const action = AI.chooseAction(G);
      await perform(action, CPU);
      if (G.phase !== 'main') return;
      mode = 'busy';
      if (action.type === 'end') break;
      await wait(380);
    }
    if (G.phase === 'main') { mode = 'idle'; flashBanner('YOUR TURN'); offerMulligan(); }
    refreshHud();
  }
  function offerMulligan() {
    const P = G.players[HUMAN];
    if (P.acted || !G.rules.mulligan || G.active !== HUMAN) return;
    mode = 'dialog';
    dialog.innerHTML = `<h2>Opening hand</h2><p>Keep these dossiers, or shuffle them away and draw ${P.hand.length} new ones? You can only do this once, before your first move.</p>
      <div class="row"><button type="button" id="keep" class="primary">KEEP</button><button type="button" id="redraw">REDRAW</button></div>`;
    dialog.hidden = false; dialog.classList.add('side');
    const close = () => { dialog.hidden = true; dialog.classList.remove('side'); mode = 'idle'; refreshHud(); };
    $('keep').onclick = close;
    $('redraw').onclick = async () => { dialog.hidden = true; dialog.classList.remove('side'); mode = 'idle'; await perform({ type: 'mulligan' }, HUMAN); };
  }
  function gameOver() {
    mode = 'over';
    const won = G.winner === HUMAN;
    const reason = G.winReason === 'domination' ? 'through world domination' : 'by blowing their cover';
    dialog.innerHTML = `<h2>${won ? 'Victory' : 'Defeat'}</h2><p>${escapeHtml(G.players[G.winner].name)} wins ${reason} on turn ${Math.ceil(G.turn / 2)}.</p><div class="row"><button id="again" type="button">NEW GAME</button></div>`;
    dialog.hidden = false;
    $('again').onclick = () => { dialog.hidden = true; showMenu(); };
    refreshHud();
  }

  // ---------- Human input ----------
  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }
  function pickCard() {
    const list = [];
    meshes.forEach(m => { if (m.visible && m !== dragging && ['hand', 'field', 'trap', 'archive'].includes(m.userData.zone)) list.push(m); });
    const hit = raycaster.intersectObjects(list, false)[0];
    return hit ? hit.object : null;
  }
  function tablePoint() {
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(dragPlane, point) ? point : null;
  }
  const inField = p => p && p.z > FIELD_ZONE.minZ && p.z < FIELD_ZONE.maxZ && Math.abs(p.x + .3) < FIELD_ZONE.maxX;
  const inFronts = p => p && p.x < FRONT_ZONE.maxX && p.z > FRONT_ZONE.minZ && p.z < FRONT_ZONE.maxZ;

  function openZoom(mesh) {
    modeBeforeZoom = mode; zoomed = mesh; hovered = mesh; cardZoom = 0; mode = 'zoom';
    renderer.domElement.style.cursor = 'zoom-out';
    showInspector(mesh.userData.uid);
    refreshHud();
  }
  function closeZoom() {
    if (!zoomed) return;
    zoomed = null; hovered = null; mode = modeBeforeZoom || 'idle'; modeBeforeZoom = null;
    inspector.hidden = true;
    renderer.domElement.style.cursor = 'default';
    refreshHud();
  }
  function showInspector(uid) {
    const d = Core.def(G, uid);
    const c = G.cards[uid];
    const status = [];
    if (G.players[c.ctrl].field.includes(uid) && d.type === 'group') {
      status.push(`Power ${Core.power(G, uid)} · Resistance ${Core.remaining(G, uid)}/${Core.toughness(G, uid)}`);
      if (c.exposed) status.push('Exposed: easier to take over, loses Covert, vulnerable to “archive Exposed” effects.');
      if (c.detained) status.push('Detained: will not ready next turn.');
      if (c.grant && c.grant.includes('Loyal')) status.push('Turned: changed sides once and is now Loyal.');
      if (c.ctrl !== c.owner) status.push(`Owned by ${G.players[c.owner].name}.`);
    }
    inspector.innerHTML = `<h3 style="--sphere:${SPHERE_COLORS[d.sphere]}">${escapeHtml(d.name)}</h3>
      <p class="type">${typeLabel(d)} · ${Core.SPHERES[d.sphere].name} · cost ${d.cost}${d.type === 'group' ? ` · ${d.power}/${d.toughness}` : ''}</p>
      ${(d.keywords || []).map(k => `<p><b>${k}</b> — ${Core.KEYWORD_TEXT[k]}.</p>`).join('')}
      ${Core.describe(d) ? `<p>${escapeHtml(Core.describe(d))}</p>` : ''}
      ${status.map(s => `<p class="status">${escapeHtml(s)}</p>`).join('')}
      <p class="flavor">${escapeHtml(d.flavor || '')}</p>`;
    inspector.hidden = false;
  }

  function clearSelection() {
    selected = null; selectedMode = 'strike'; validTargets = new Set();
    actionPanel.hidden = true;
    if (mode === 'selected') mode = 'idle';
    setHint('');
  }
  function selectGroup(uid) {
    selected = uid; mode = 'selected';
    if (selectedMode === 'takeover' && !hasTakeovers(uid)) selectedMode = 'strike';
    computeTargets();
    renderActionPanel();
    refreshHud();
  }
  function hasTakeovers(uid) { return Core.legalActions(G).some(a => a.type === 'takeover' && a.uid === uid); }
  function computeTargets() {
    validTargets = new Set();
    for (const a of Core.legalActions(G)) {
      if (a.uid !== selected) continue;
      if (selectedMode === 'strike' && a.type === 'strike') validTargets.add(a.target);
      if (selectedMode === 'takeover' && a.type === 'takeover') validTargets.add(a.target);
    }
    const walls = Core.firewalls(G, HUMAN).length;
    setHint(selectedMode === 'strike'
      ? (walls ? 'A FIREWALL GUARDS THE ENEMY · STRIKE A GLOWING GROUP' : 'CLICK AN ENEMY GROUP OR THE ENEMY PANEL TO STRIKE')
      : 'CLICK A GLOWING ENEMY GROUP TO ATTEMPT A TAKEOVER');
  }
  function renderActionPanel() {
    const d = Core.def(G, selected);
    const canTake = hasTakeovers(selected);
    const P = G.players[HUMAN];
    const tookOver = P.takeoversThisTurn >= G.rules.takeoversPerTurn;
    actionPanel.innerHTML = `<div class="title">${escapeHtml(d.name)} <span>${Core.power(G, selected)}/${Core.remaining(G, selected)}</span></div>
      <div class="row">
        <button type="button" data-mode="strike" class="${selectedMode === 'strike' ? 'on' : ''}">STRIKE</button>
        <button type="button" data-mode="takeover" class="${selectedMode === 'takeover' ? 'on' : ''}" ${canTake ? '' : 'disabled'} title="${tookOver ? 'One takeover per turn' : ''}">TAKEOVER</button>
        ${validTargets.has('player') ? '<button type="button" data-face="1">HIT CONSPIRACY</button>' : ''}
        <button type="button" data-cancel="1">×</button>
      </div>`;
    actionPanel.hidden = false;
    actionPanel.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { selectedMode = b.dataset.mode; computeTargets(); renderActionPanel(); refreshHud(); });
    const face = actionPanel.querySelector('[data-face]');
    if (face) face.onclick = () => strike('player');
    actionPanel.querySelector('[data-cancel]').onclick = () => { clearSelection(); refreshHud(); };
  }
  async function strike(target) {
    const uid = selected;
    clearSelection();
    await perform({ type: 'strike', uid, target }, HUMAN);
  }
  function openTakeoverDialog(target) {
    const uid = selected;
    const P = G.players[HUMAN];
    const bribe = Core.bribe(G, target);
    let spend = 0;
    mode = 'dialog';
    const render = () => {
      const t = Core.takeoverTarget(G, uid, target, spend);
      const odds = Math.round(Core.chance(t.need) * 100);
      const left = P.influence - bribe - spend;
      dialog.innerHTML = `<h2>Takeover</h2>
        <p><b>${escapeHtml(Core.def(G, uid).name)}</b> moves on <b>${escapeHtml(Core.def(G, target).name)}</b>.</p>
        <p class="math">Need 2d6 ≤ <b>${t.need}</b> = ${G.rules.takeoverBase} base + ${Core.power(G, uid)} Power − ${Core.toughness(G, target)} Resistance${t.parts.map(p => ` ${p}`).join('')}${spend ? ` +${Math.floor(spend / G.rules.spendRate)} bought` : ''}${t.raw > t.need ? ' (max 10)' : ''}</p>
        <div class="odds"><span style="width:${odds}%"></span><em>${odds}%</em></div>
        <p>Bribe: <b>${bribe}</b> Influence. Spend extra (${G.rules.spendRate} per +1):</p>
        <div class="row stepper"><button type="button" id="less" ${spend <= 0 ? 'disabled' : ''}>−</button><b>${spend}</b><button type="button" id="more" ${left < G.rules.spendRate || t.raw >= G.rules.takeoverMax ? 'disabled' : ''}>+</button><small>${left} Influence left after</small></div>
        <p class="small">On a failure you may discard a card to reroll once; otherwise your group is Exposed. 11–12 always fails.</p>
        <div class="row"><button type="button" id="roll" class="primary" ${t.need < 2 ? 'disabled' : ''}>ROLL THE DICE</button><button type="button" id="cancel">CANCEL</button></div>`;
      dialog.hidden = false;
      $('less').onclick = () => { spend = Math.max(0, spend - G.rules.spendRate); render(); };
      $('more').onclick = () => { spend += G.rules.spendRate; render(); };
      $('cancel').onclick = () => { dialog.hidden = true; mode = 'selected'; computeTargets(); refreshHud(); };
      $('roll').onclick = async () => {
        dialog.hidden = true;
        clearSelection();
        await perform({ type: 'takeover', uid, target, spend }, HUMAN);
        if (G.pending) offerReroll();
      };
    };
    render();
  }
  function offerReroll() {
    mode = 'reroll';
    const p = G.pending;
    dialog.innerHTML = `<h2>The takeover failed</h2>
      <p>${escapeHtml(Core.def(G, p.a).name)} needed ${p.need} or less and rolled ${p.rolls[0] + p.rolls[1]}.</p>
      <p><b>Plausible deniability:</b> click a card in your hand to discard it and reroll both dice (${Math.round(Core.chance(p.need) * 100)}%).</p>
      <div class="row"><button type="button" id="accept">ACCEPT FAILURE</button></div>`;
    dialog.hidden = false;
    dialog.classList.add('side');
    setHint('CLICK A HAND CARD TO DISCARD AND REROLL');
    refreshHud();
    $('accept').onclick = async () => { dialog.hidden = true; dialog.classList.remove('side'); setHint(''); await perform({ type: 'accept' }, HUMAN); };
  }
  async function rerollWith(uid) {
    dialog.hidden = true; dialog.classList.remove('side'); setHint('');
    await perform({ type: 'reroll', uid }, HUMAN);
    if (G.pending) offerReroll();
  }

  async function dropCard(card, point) {
    const uid = card.userData.uid;
    dragging = null; setHint('');
    if (inFronts(point) && Core.isLegal(G, { type: 'front', uid })) {
      await perform({ type: 'front', uid }, HUMAN);
      return;
    }
    if (inField(point) && canPlayFromHand(uid)) {
      const t = Core.cardTargets(G, HUMAN, uid);
      if (t && t.list.length) {
        pendingPlay = { uid, list: t.list };
        validTargets = new Set(t.list);
        mode = 'target';
        card.userData.target.set(5.5, 1.2, 1.5); card.userData.faceDown = false;
        setHint(`CHOOSE A TARGET: ${Core.fxText(t.fx).toUpperCase()} · CLICK EMPTY TABLE TO CANCEL`);
        refreshHud();
        return;
      }
      await perform({ type: 'play', uid }, HUMAN);
      return;
    }
    mode = 'idle';
    if (inField(point)) setHint(Core.def(G, uid).cost > G.players[HUMAN].influence ? 'NOT ENOUGH INFLUENCE' : "THAT CARD CAN'T BE PLAYED RIGHT NOW");
    else if (inFronts(point)) setHint('YOU ALREADY SET UP A FRONT THIS TURN');
    setTimeout(() => { if (mode === 'idle') setHint(''); }, 1600);
    layout();
  }
  function cancelTargeting() {
    pendingPlay = null; validTargets = new Set(); mode = 'idle'; setHint(''); layout();
  }

  function onPointerDown(event) {
    if (mode === 'zoom') { closeZoom(); return; }
    if (['menu', 'busy', 'dialog', 'over'].includes(mode)) return;
    setPointer(event);
    const hit = pickCard();
    if (mode === 'target') {
      if (hit && validTargets.has(hit.userData.uid)) {
        const { uid } = pendingPlay;
        const target = hit.userData.uid;
        pendingPlay = null; validTargets = new Set(); setHint('');
        perform({ type: 'play', uid, target }, HUMAN);
      } else cancelTargeting();
      return;
    }
    if (!hit) { if (mode === 'selected') { clearSelection(); refreshHud(); } return; }
    pressed = { card: hit, x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    setPointer(event);
    if (pressed && !dragging) {
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      const u = pressed.card.userData;
      if (distance > 8 && mode === 'idle' && u.zone === 'hand' && G.active === HUMAN && G.phase === 'main') {
        dragging = pressed.card; pressed = null; hovered = null; mode = 'drag';
        dragging.renderOrder = 100;
        layout();
      }
    }
    if (dragging) {
      const point = tablePoint();
      if (point) dragging.position.copy(point);
      const uid = dragging.userData.uid;
      if (inFronts(point)) setHint(G.players[HUMAN].frontPlayed ? 'ONE FRONT PER TURN' : 'RELEASE TO SET UP A FRONT (+1 INFLUENCE EVERY TURN)');
      else if (inField(point)) setHint(canPlayFromHand(uid) ? `RELEASE TO PLAY (${Core.def(G, uid).cost} INFLUENCE)` : 'NOT PLAYABLE NOW');
      else setHint('DROP ON THE FIELD TO PLAY · ON FRONTS (LEFT) FOR INFLUENCE');
      renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if (mode === 'zoom') return;
    const hit = pickCard();
    hovered = hit && ['hand', 'field'].includes(hit.userData.zone) && hit.userData.zone !== 'opp-hand' ? hit : null;
    cardZoom = 0;
    renderer.domElement.style.cursor = hit ? (mode === 'target' || mode === 'selected' ? (validTargets.has(hit.userData.uid) ? 'crosshair' : 'pointer') : 'pointer') : 'default';
  }
  async function onPointerUp(event) {
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    if (dragging) {
      setPointer(event);
      await dropCard(dragging, tablePoint());
      renderer.domElement.style.cursor = 'default';
      return;
    }
    if (!pressed) return;
    const mesh = pressed.card;
    pressed = null;
    const uid = mesh.userData.uid;
    const c = G.cards[uid];
    if (mode === 'reroll') {
      if (mesh.userData.zone === 'hand' && c.ctrl === HUMAN && G.players[HUMAN].hand.includes(uid)) rerollWith(uid);
      return;
    }
    if (mode === 'selected') {
      if (validTargets.has(uid)) {
        if (selectedMode === 'strike') strike(uid);
        else openTakeoverDialog(uid);
        return;
      }
      if (uid !== selected && mesh.userData.zone === 'field' && c.ctrl === HUMAN && Core.canAct(G, uid) && G.active === HUMAN) { selectGroup(uid); return; }
      clearSelection();
    }
    if (mesh.userData.zone === 'field' && c.ctrl === HUMAN && G.active === HUMAN && G.phase === 'main' && Core.canAct(G, uid) && mode === 'idle') {
      selectGroup(uid);
      return;
    }
    if (mesh.userData.zone === 'trap' && c.ctrl !== HUMAN) return;
    openZoom(mesh);
  }

  // ---------- Animation loop ----------
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const t = now * .001;
    motions.forEach((motion, card) => {
      const progress = Math.min(1, (now - motion.start) / motion.duration);
      const eased = progress * progress * (3 - 2 * progress);
      card.position.lerpVectors(motion.from, motion.to, eased);
      card.quaternion.slerpQuaternions(motion.fromQuat, motion.toQuat, eased);
      if (progress === 1) { motions.delete(card); motion.resolve(); }
    });
    if (diceAnimation) {
      const animation = diceAnimation;
      const elapsed = (now - animation.start) / 1000;
      const dt = Math.min(.032, (now - animation.last) / 1000); animation.last = now;
      const used = dice.slice(0, animation.count);
      if (elapsed < 1.3) {
        animation.accumulator += dt;
        const fixedStep = 1 / 120;
        while (animation.accumulator >= fixedStep) { simulateDiceStep(animation.bodies, fixedStep); animation.accumulator -= fixedStep; }
        used.forEach((die, i) => syncDieFromBody(die, animation.bodies[i]));
      } else {
        if (!animation.revealing) {
          animation.revealing = true;
          animation.values = used.map(die => topFaceValueFromQuaternion(die.quaternion));
          animation.from = used.map(die => die.position.clone());
          animation.settleStart = now;
        }
        const progress = Math.min(1, (now - animation.settleStart) / 520);
        const eased = 1 - Math.pow(1 - progress, 3);
        used.forEach((die, i) => {
          const half = die.geometry.parameters.width / 2;
          die.position.lerpVectors(animation.from[i], new THREE.Vector3(used.length > 1 ? (i ? .34 : -.34) : 0, -.09 + half, -.15), eased);
        });
        if (progress === 1) { diceAnimation = null; animation.resolve(animation.values); }
      }
      diceShadows.forEach((shadow, i) => {
        shadow.position.x = dice[i].position.x; shadow.position.z = dice[i].position.z;
        const height = Math.max(0, dice[i].position.y);
        shadow.scale.setScalar(THREE.MathUtils.clamp(1 + height * .12, 1, 1.45));
        shadow.material.opacity = THREE.MathUtils.lerp(.72, .28, THREE.MathUtils.clamp(height / 4, 0, 1));
      });
    }
    meshes.forEach(card => {
      if (!card.visible) return;
      const u = card.userData;
      u.glow.material.opacity = THREE.MathUtils.lerp(u.glow.material.opacity, (u.glowOpacity || 0) * (validTargets.has(u.uid) ? .75 + Math.sin(t * 6) * .25 : 1), .2);
      if (card === dragging || motions.has(card)) return;
      const isHovered = card === hovered;
      const target = u.target.clone();
      if (isHovered && !zoomed && u.zone === 'hand') { target.y += .9; target.z -= .5; }
      else if (isHovered && !zoomed) target.y += .25;
      if (isHovered && zoomed === card && cardZoom > 0) {
        const distance = 2.18 / (1.2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        camera.getWorldDirection(cameraDirection);
        zoomTarget.copy(camera.position).addScaledVector(cameraDirection, distance);
        target.lerp(zoomTarget, cardZoom);
      }
      card.position.lerp(target, .16);
      if (zoomed === card || (isHovered && u.zone === 'hand')) {
        billboardTarget.position.copy(card.position);
        billboardTarget.lookAt(camera.position);
        targetQuaternion.copy(billboardTarget.quaternion);
      } else targetQuaternion.copy(flatQuat(u.rot, u.faceDown));
      card.quaternion.slerp(targetQuaternion, .16);
    });
    cardZoom = THREE.MathUtils.lerp(cardZoom, zoomed ? 1 : 0, .18);
    renderer.render(scene, camera);
  }

  // ---------- Menu / new game ----------
  function showMenu() {
    mode = 'menu';
    menu.innerHTML = `<h1>THE HIDDEN ARCHIVE</h1><p class="sub">Choose the conspiracy you will lead.</p>
      <div class="factions">${Object.entries(Core.SPHERES).map(([k, s]) => `
        <button type="button" class="faction" data-sphere="${k}" style="--sphere:${SPHERE_COLORS[k]}">
          <strong>${s.faction}</strong><em>${s.name}</em><span>${SPHERE_BLURB[k]}</span></button>`).join('')}</div>
      <p class="sub small">New here? Press <b>?</b> during play for the field manual.</p>`;
    menu.hidden = false;
    menu.querySelectorAll('.faction').forEach(b => b.onclick = () => { menu.hidden = true; newGame(b.dataset.sphere); });
  }
  function newGame(sphere) {
    humanSphere = sphere;
    const others = Object.keys(Core.SPHERES).filter(s => s !== sphere);
    const enemy = others[Math.floor(Math.random() * others.length)];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const first = Math.random() < .5 ? HUMAN : CPU;
    meshes.forEach(m => scene.remove(m));
    meshes.clear(); motions.clear();
    clearSelection(); pendingPlay = null; zoomed = null; hovered = null; dragging = null; inspector.hidden = true; dialog.hidden = true;
    G = Core.createGame({
      seed, first,
      spheres: [sphere, enemy],
      names: [Core.SPHERES[sphere].faction, Core.SPHERES[enemy].faction],
      decks: [Core.buildDeck(sphere, seed + 1), Core.buildDeck(enemy, seed + 2)]
    });
    Object.keys(G.cards).forEach(uid => createCardMesh(+uid));
    logCursor = 0; $('log-full').innerHTML = '';
    eventLog.innerHTML = '';
    flushLog();
    layout();
    if (first === CPU) { flashBanner(`${G.players[CPU].name.toUpperCase()} MOVES FIRST`); runAiTurn(); }
    else { mode = 'idle'; flashBanner('YOU MOVE FIRST'); refreshHud(); offerMulligan(); }
  }

  async function init() {
    try {
      await document.fonts.ready;
      await Promise.all(['30px CrimsonSemi', 'italic 25px CrimsonItalic', '30px Crimson', '30px Cardo', '20px Cinzel'].map(f => document.fonts.load(f)));
      const [tableTex, atlasTex, chromeTex, backTex, diceTex] = await Promise.all([
        loadTexture('./assets/table.webp'), loadTexture('./assets/cards.webp?v=20260716-1'),
        loadTexture('./assets/card-front-chrome.webp?v=20260712-2'), loadTexture('./assets/card-back.webp?v=20260712-2'),
        loadTexture('./assets/dice-occult-resin.webp')
      ]);
      atlasImage = atlasTex.image; chromeImage = chromeTex.image; backTexture = backTex;
      makeTable(tableTex); makeDeckStacks(); makeDice(diceTex);
      loading.classList.add('done');
      showMenu();
    } catch (error) {
      console.error(error);
      loading.classList.add('failed');
      loadingMessage.innerHTML = `<strong>THE ARCHIVE FAILED TO OPEN</strong><small>${escapeHtml(String(error?.message || error))}<br>Make sure the assets folder is beside index.html.</small>`;
    }
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', event => { pressed = null; if (dragging) onPointerUp(event); });
  renderer.domElement.addEventListener('pointerleave', () => { if (!dragging && !pressed) hovered = null; });
  $('opponent-panel').addEventListener('click', () => { if (mode === 'selected' && validTargets.has('player')) strike('player'); });
  document.addEventListener('pointerdown', event => {
    if (mode !== 'zoom' || event.target === renderer.domElement) return;
    event.preventDefault(); event.stopImmediatePropagation();
    suppressNextClick = true; closeZoom();
  }, true);
  document.addEventListener('click', event => {
    if (!suppressNextClick) return;
    suppressNextClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  addEventListener('keydown', event => {
    if (mode === 'zoom') { if (event.key === 'Escape') closeZoom(); return; }
    if (event.key === 'Escape') { if (mode === 'target') cancelTargeting(); else if (mode === 'selected') { clearSelection(); refreshHud(); } }
    if (event.key.toLowerCase() === 'r' && !['menu', 'busy'].includes(mode) && event.target === document.body) showMenu();
    if (event.key.toLowerCase() === 'l') $('log-full').classList.toggle('open');
  });
  addEventListener('resize', fitCamera);
  const help = $('help');
  $('settings').onclick = () => { help.hidden = !help.hidden; };
  $('close-help').onclick = () => { help.hidden = true; };
  $('log-toggle').onclick = () => $('log-full').classList.toggle('open');
  finishTurnButton.onclick = finishTurn;

  // Debug/automation hook for headless checks.
  window.__archive = {
    screenOf(uid) {
      const m = meshes.get(uid); if (!m) return null;
      const v = m.position.clone().project(camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
    },
    get state() { return G; }, get mode() { return mode; }, newGame, perform, Core, finishTurn, selectGroup, openTakeoverDialog, offerReroll };

  init(); animate();
})();
