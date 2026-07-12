/* global THREE, CARD_DATA */
(() => {
  'use strict';

  const root = document.getElementById('game');
  const loading = document.getElementById('loading');
  const loadingMessage = document.getElementById('loading-message');
  const deckLabel = document.getElementById('deck-label');
  const archiveLabel = document.getElementById('grave-label');
  const hint = document.getElementById('hint');
  const turnStatus = document.getElementById('turn-status');
  const finishTurnButton = document.getElementById('finish-turn');
  const eventLog = document.getElementById('event-log');
  const playerTokensLabel = document.getElementById('player-tokens');
  const opponentTokensLabel = document.getElementById('opponent-tokens');
  const playerGroupsLabel = document.getElementById('player-groups');
  const opponentGroupsLabel = document.getElementById('opponent-groups');
  const rollResult = document.getElementById('roll-result');

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090a09);
  scene.fog = new THREE.FogExp2(0x090a09, 0.027);

  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 11.5, 13.7);
  camera.lookAt(0, 0, -0.7);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe7c984, 0x172019, 1.45));
  const key = new THREE.DirectionalLight(0xffd68c, 2.1);
  key.position.set(-4, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
  const cardGeometry = makeRoundedCardGeometry(1.56, 2.18, .075);
  const flatCardQuaternion = new THREE.Quaternion();
  const billboardTarget = new THREE.Object3D();
  const targetQuaternion = new THREE.Quaternion();
  const cameraDirection = new THREE.Vector3();
  const zoomTarget = new THREE.Vector3();
  const hand = [];
  const battlefield = [];
  const archive = [];
  const opponentBattlefield = [];
  const motions = new Map();
  const State = Object.freeze({
    SETUP: 'setup', PLAYER_IDLE: 'playerIdle', PLAYER_DRAGGING: 'playerDragging',
    ROLLING_PLAYER: 'rollingPlayer', REPORTING_PLAYER: 'reportingPlayer',
    RESOLVING_PLAYER: 'resolvingPlayer', PLAYER_DONE: 'playerDone',
    AI_THINKING: 'aiThinking', ROLLING_AI: 'rollingAi', REPORTING_AI: 'reportingAi',
    RESOLVING_AI: 'resolvingAi', GAME_OVER: 'gameOver'
  });
  const allowedTransitions = {
    [State.SETUP]: [State.PLAYER_IDLE],
    [State.PLAYER_IDLE]: [State.PLAYER_DRAGGING, State.AI_THINKING, State.GAME_OVER],
    [State.PLAYER_DRAGGING]: [State.PLAYER_IDLE, State.ROLLING_PLAYER],
    [State.ROLLING_PLAYER]: [State.REPORTING_PLAYER],
    [State.REPORTING_PLAYER]: [State.RESOLVING_PLAYER],
    [State.RESOLVING_PLAYER]: [State.PLAYER_DONE, State.GAME_OVER],
    [State.PLAYER_DONE]: [State.AI_THINKING, State.GAME_OVER],
    [State.AI_THINKING]: [State.ROLLING_AI, State.PLAYER_IDLE, State.GAME_OVER],
    [State.ROLLING_AI]: [State.REPORTING_AI],
    [State.REPORTING_AI]: [State.RESOLVING_AI],
    [State.RESOLVING_AI]: [State.PLAYER_IDLE, State.GAME_OVER],
    [State.GAME_OVER]: []
  };
  let deck = [];
  let dragging = null;
  let hovered = null;
  let cardZoom = 0;
  let table, deckTop;
  let dice = [];
  let diceAnimation = null;
  let archiveCount = 0;
  let playerTokens = 10;
  let opponentTokens = 10;
  let opponentGroupCount = 1;
  let opponentPower = 2;
  let state = State.SETUP;

  const textureLoader = new THREE.TextureLoader();
  const loadTexture = url => new Promise((resolve, reject) => textureLoader.load(url, resolve, undefined, reject));

  function makeRoundedCardGeometry(width, height, radius) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth + radius, -halfHeight);
    shape.lineTo(halfWidth - radius, -halfHeight);
    shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
    shape.lineTo(halfWidth, halfHeight - radius);
    shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
    shape.lineTo(-halfWidth + radius, halfHeight);
    shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
    shape.lineTo(-halfWidth, -halfHeight + radius);
    shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);

    const geometry = new THREE.ShapeGeometry(shape, 5);
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      uvs.setXY(i, positions.getX(i) / width + .5, positions.getY(i) / height + .5);
    }
    uvs.needsUpdate = true;
    return geometry;
  }

  function canvasTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function fitTitle(ctx, title, maxWidth) {
    let size = 43;
    do { ctx.font = `600 ${size--}px Crimson`; } while (ctx.measureText(title).width > maxWidth && size > 23);
  }

  function makeCardTexture(index, atlas, chrome) {
    const canvas = document.createElement('canvas');
    canvas.width = 636; canvas.height = 888;
    const ctx = canvas.getContext('2d');
    const cellW = atlas.width / 8, cellH = atlas.height / 8;
    const col = index % 8, row = Math.floor(index / 8);
    const cropH = cellW * 117 / 142;
    ctx.fillStyle = '#d7ccb0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(atlas, col * cellW, row * cellH + (cellH - cropH) / 2, cellW, cropH, 36, 36, 564, 468);
    ctx.drawImage(chrome, 0, 0, canvas.width, canvas.height);
    const [title, value] = CARD_DATA[index];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#eee8d7';
    fitTitle(ctx, title, 540); ctx.fillText(title, 318, 541);
    ctx.font = '32px Cardo'; ctx.textAlign = 'left'; ctx.fillStyle = '#29251e';
    ctx.fillText('Conspiracy  •  Dossier', 52, 600);
    ctx.font = '29px Crimson';
    const copy = ['Uncover the hidden connection.', 'Deploy this dossier to the field', 'to advance your investigation.'];
    copy.forEach((line, i) => ctx.fillText(line, 52, 659 + i * 38));
    ctx.fillStyle = '#f2e6c7'; ctx.textAlign = 'center'; ctx.font = 'bold 44px Cardo';
    ctx.fillText(String(value), 557, 817);
    return canvasTexture(canvas);
  }

  function createCard(index, texture) {
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.71, metalness: 0.04, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(cardGeometry, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { index, zone: 'deck', target: new THREE.Vector3(), targetRot: 0 };
    scene.add(mesh);
    return mesh;
  }

  function makeTable(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.02 });
    table = new THREE.Mesh(new THREE.PlaneGeometry(18, 13.5), mat);
    table.rotation.x = -Math.PI / 2;
    table.position.set(0, -0.09, -0.7);
    table.receiveShadow = true;
    scene.add(table);

    const zone = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 4.15), new THREE.MeshBasicMaterial({ color: 0x9b7436, transparent: true, opacity: 0.045, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2; zone.position.set(-0.4, 0.012, -1.05); zone.name = 'battle-zone';
    scene.add(zone);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(zone.geometry), new THREE.LineBasicMaterial({ color: 0xb58b45, transparent: true, opacity: 0.24 }));
    border.rotation.copy(zone.rotation); border.position.copy(zone.position); scene.add(border);
  }

  function makeDeck(backTexture) {
    backTexture.colorSpace = THREE.SRGBColorSpace;
    const geom = cardGeometry;
    for (let i = 0; i < 5; i++) {
      const card = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ map: backTexture, roughness: .68, side: THREE.DoubleSide }));
      card.rotation.x = -Math.PI / 2; card.position.set(6.55, 0.035 + i * .025, .1 + i * .012);
      card.castShadow = true; card.receiveShadow = true; card.userData.deck = true; scene.add(card);
      if (i === 4) deckTop = card;
    }
  }

  function makeDieFaceTexture(baseImage, value) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.drawImage(baseImage, 0, 0, 256, 256);
    const positions = {
      1: [[.5,.5]], 2: [[.3,.3],[.7,.7]], 3: [[.3,.3],[.5,.5],[.7,.7]],
      4: [[.3,.3],[.7,.3],[.3,.7],[.7,.7]],
      5: [[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]],
      6: [[.3,.25],[.7,.25],[.3,.5],[.7,.5],[.3,.75],[.7,.75]]
    };
    ctx.shadowColor = '#000'; ctx.shadowBlur = 9; ctx.fillStyle = '#e0b45c';
    positions[value].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x * 256, y * 256, 20, 0, Math.PI * 2); ctx.fill(); });
    return canvasTexture(canvas);
  }

  function makeDice(baseTexture) {
    const valuesByFace = [1, 6, 2, 5, 3, 4];
    const materials = valuesByFace.map(value => new THREE.MeshStandardMaterial({
      map: makeDieFaceTexture(baseTexture.image, value), roughness: .48, metalness: .12
    }));
    const geometry = new THREE.BoxGeometry(1.05, 1.05, 1.05, 3, 3, 3);
    dice = [-1, 1].map((side, i) => {
      const die = new THREE.Mesh(geometry, materials); die.visible = false;
      die.castShadow = true; die.receiveShadow = true; die.renderOrder = 200 + i;
      scene.add(die); return die;
    });
  }

  function resultQuaternion(value) {
    const rotations = {
      1: [0,0,Math.PI/2], 6: [0,0,-Math.PI/2], 2: [0,0,0],
      5: [Math.PI,0,0], 3: [-Math.PI/2,0,0], 4: [Math.PI/2,0,0]
    };
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotations[value]));
  }

  function rollPhysicalDice(values) {
    dice.forEach((die, i) => {
      die.visible = true; die.position.set(i ? .55 : -.55, 3.5 + i * .35, 1.25);
      die.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    });
    return new Promise(resolve => {
      diceAnimation = {
        values, start: performance.now(), resolve, settled: false,
        velocities: [new THREE.Vector3(-1.35, 4.8, -2.1), new THREE.Vector3(1.25, 5.3, -2.35)],
        angular: [new THREE.Vector3(8.7, 11.4, 7.1), new THREE.Vector3(-10.2, 8.9, 12.3)], last: performance.now()
      };
    });
  }

  async function reportRoll(total, owner) {
    transition(owner === 'player' ? State.REPORTING_PLAYER : State.REPORTING_AI);
    rollResult.querySelector('strong').textContent = total;
    rollResult.classList.add('show');
    await new Promise(resolve => setTimeout(resolve, 520));
    rollResult.classList.remove('show');
    dice.forEach(die => { die.visible = false; });
  }

  function layoutHand() {
    const count = hand.length;
    const spacing = Math.min(1.18, 7.1 / Math.max(count - 1, 1));
    hand.forEach((card, i) => {
      const offset = i - (count - 1) / 2;
      card.userData.target.set(offset * spacing, .14 + i * .009, 4.12 + Math.abs(offset) * .08);
      card.userData.targetRot = -offset * .045;
      card.userData.zone = 'hand';
      card.renderOrder = i;
    });
  }

  function layoutBattlefield() {
    battlefield.forEach((card, i) => {
      const cols = Math.min(5, battlefield.length);
      const row = Math.floor(i / cols), col = i % cols;
      const rowCount = Math.min(cols, battlefield.length - row * cols);
      card.userData.target.set((col - (rowCount - 1) / 2) * 1.82 - .35, .08 + col * .009, -1.4 + row * 2.45);
      card.userData.targetRot = 0;
      card.userData.zone = 'field';
    });
  }

  function layoutOpponentBattlefield() {
    opponentBattlefield.forEach((card, i) => {
      card.userData.target.set((i - (opponentBattlefield.length - 1) / 2) * 1.3 - .4, .08 + i * .009, -4.55);
      card.userData.targetRot = Math.PI;
      card.userData.zone = 'opponent-field';
    });
  }

  function transition(next) {
    if (state === next) return;
    if (!allowedTransitions[state]?.includes(next)) throw new Error(`Invalid game transition: ${state} → ${next}`);
    state = next;
    updateLabels();
  }

  function moveCard(card, target, targetRot = 0, duration = 650) {
    return new Promise(resolve => {
      motions.set(card, {
        from: card.position.clone(), to: target.clone(),
        fromQuat: card.quaternion.clone(), toQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, targetRot)),
        start: performance.now(), duration, resolve
      });
    });
  }

  async function discardCard(card) {
    archive.push(card);
    archiveCount = archive.length;
    card.visible = true; card.userData.zone = 'archive'; card.renderOrder = 50 + archive.length;
    const target = new THREE.Vector3(4.45 + Math.min(archive.length, 8) * .006, .12 + archive.length * .012, .12);
    card.userData.target.copy(target); card.userData.targetRot = .02 * ((archive.length % 3) - 1);
    updateLabels();
    await moveCard(card, target, card.userData.targetRot, 720);
  }

  function updateLabels() {
    deckLabel.querySelector('b').textContent = deck.length;
    archiveLabel.querySelector('b').textContent = archiveCount;
    deckLabel.style.opacity = deck.length ? '1' : '.35';
    playerTokensLabel.innerHTML = `<span>◆</span>${playerTokens}`;
    opponentTokensLabel.innerHTML = `<span>◆</span>${opponentTokens}`;
    const playerGroupCount = battlefield.length + 1;
    playerGroupsLabel.textContent = `${playerGroupCount} ${playerGroupCount === 1 ? 'group' : 'groups'}`;
    opponentGroupsLabel.textContent = `${opponentGroupCount} ${opponentGroupCount === 1 ? 'group' : 'groups'}`;
    const status = state === State.GAME_OVER ? 'GAME OVER'
      : state === State.PLAYER_IDLE || state === State.PLAYER_DRAGGING ? 'YOUR TURN · 1 ATTACK'
        : state === State.PLAYER_DONE ? 'YOUR TURN · ATTACK USED'
          : [State.ROLLING_PLAYER, State.ROLLING_AI].includes(state) ? 'ROLLING DICE'
            : [State.REPORTING_PLAYER, State.REPORTING_AI].includes(state) ? 'DICE RESULT'
          : state === State.RESOLVING_PLAYER ? 'RESOLVING ATTACK'
            : 'THE CABAL IS ACTING';
    turnStatus.innerHTML = `<span class="turn-dot"></span>${status}`;
    finishTurnButton.disabled = ![State.PLAYER_IDLE, State.PLAYER_DONE].includes(state);
  }

  function drawCard() {
    if (!deck.length || hand.length >= 10) return;
    const card = deck.pop();
    card.visible = true;
    hand.push(card);
    card.position.copy(deckTop.position);
    card.position.y = .4;
    layoutHand(); updateLabels();
  }

  function resetGame(cards) {
    dragging = null; hovered = null;
    hand.splice(0).forEach(c => { c.visible = false; });
    battlefield.splice(0).forEach(c => { c.visible = false; });
    archive.splice(0).forEach(c => { c.visible = false; });
    opponentBattlefield.splice(0).forEach(c => { c.visible = false; });
    motions.clear();
    deck = [...cards].sort(() => Math.random() - .5);
    deck.forEach(c => { c.visible = false; c.userData.zone = 'deck'; });
    archiveCount = 0; playerTokens = 10; opponentTokens = 10;
    opponentGroupCount = 1; opponentPower = 2; state = State.SETUP;
    for (let i = 0; i < 5; i++) drawCard();
    eventLog.textContent = 'Build your power structure. Drag one dossier into the field to attack it.';
    transition(State.PLAYER_IDLE);
  }

  const rollDice = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  const cardName = card => CARD_DATA[card.userData.index][0];
  const cardValue = card => CARD_DATA[card.userData.index][1];

  function checkVictory() {
    if (battlefield.length + 1 >= 7) {
      eventLog.textContent = 'WORLD CONTROLLED — the Illuminati win.'; transition(State.GAME_OVER);
    } else if (opponentGroupCount >= 7) {
      eventLog.textContent = 'THE CABAL CONTROLS THE WORLD. Press R to try again.'; transition(State.GAME_OVER);
    }
    updateLabels();
  }

  async function attackCard(card) {
    transition(State.ROLLING_PLAYER);
    playerTokens -= 1;
    const power = Math.max(2, ...battlefield.map(cardValue));
    const target = THREE.MathUtils.clamp(7 + power - cardValue(card), 2, 10);
    const diceValues = rollDice();
    await rollPhysicalDice(diceValues);
    const roll = diceValues[0] + diceValues[1];
    await reportRoll(roll, 'player');
    transition(State.RESOLVING_PLAYER);
    if (roll <= target) {
      battlefield.push(card);
      eventLog.textContent = `${cardName(card)} controlled: rolled ${roll}, needed ${target} or less.`;
      layoutBattlefield();
      await moveCard(card, card.userData.target, card.userData.targetRot, 620);
    } else {
      eventLog.textContent = `${cardName(card)} resisted: rolled ${roll}, needed ${target} or less.`;
      await discardCard(card);
    }
    checkVictory();
    if (state !== State.GAME_OVER) transition(State.PLAYER_DONE);
  }

  function finishTurn() {
    if (![State.PLAYER_IDLE, State.PLAYER_DONE].includes(state)) return;
    transition(State.AI_THINKING);
    eventLog.textContent = 'The Cabal considers its target…';
    setTimeout(runAiTurn, 650);
  }

  async function runAiTurn() {
    if (state !== State.AI_THINKING) return;
    opponentTokens += 2 + Math.floor((opponentGroupCount - 1) / 3);
    const card = deck.pop();
    if (card && opponentTokens > 0) {
      card.visible = true; card.position.copy(deckTop.position); card.position.y = .4;
      opponentTokens -= 1;
      const value = cardValue(card);
      const target = THREE.MathUtils.clamp(7 + opponentPower - value, 2, 10);
      const diceValues = rollDice();
      transition(State.ROLLING_AI);
      await rollPhysicalDice(diceValues);
      const roll = diceValues[0] + diceValues[1];
      await reportRoll(roll, 'ai');
      transition(State.RESOLVING_AI);
      if (roll <= target) {
        opponentGroupCount += 1; opponentPower = Math.max(opponentPower, value);
        eventLog.textContent = `The Cabal controls ${cardName(card)} (rolled ${roll} vs ${target}).`;
        opponentBattlefield.push(card); layoutOpponentBattlefield();
        await moveCard(card, card.userData.target, card.userData.targetRot, 720);
      } else {
        eventLog.textContent = `The Cabal failed to control ${cardName(card)} (rolled ${roll} vs ${target}).`;
        await discardCard(card);
      }
    } else eventLog.textContent = 'The Cabal passes.';
    checkVictory();
    if (state === State.GAME_OVER) return;
    playerTokens += 2 + Math.floor(battlefield.length / 3);
    drawCard(); transition(State.PLAYER_IDLE);
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function handCardHits() {
    return raycaster.intersectObjects(hand.filter(c => c !== dragging), false);
  }

  function cardHits() {
    return raycaster.intersectObjects([...hand, ...battlefield].filter(c => c !== dragging), false);
  }

  function setHovered(card) {
    if (hovered === card) return;
    hovered = card;
    cardZoom = 0;
  }

  function onPointerDown(event) {
    if (state !== State.PLAYER_IDLE || playerTokens < 1) return;
    setPointer(event);
    const deckHit = deckTop && raycaster.intersectObject(deckTop, false)[0];
    if (deckHit) return;
    const hit = handCardHits()[0];
    if (!hit) return;
    setHovered(null);
    dragging = hit.object;
    transition(State.PLAYER_DRAGGING);
    const idx = hand.indexOf(dragging);
    if (idx >= 0) hand.splice(idx, 1);
    dragging.userData.zone = 'drag'; dragging.renderOrder = 100;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    layoutHand();
    onPointerMove(event);
  }

  function onPointerMove(event) {
    setPointer(event);
    if (dragging) {
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane, point);
      if (point) dragging.position.copy(point);
      dragging.rotation.z *= .78;
      const valid = point.z > -3.55 && point.z < 1.65 && Math.abs(point.x + .4) < 5.7;
      hint.textContent = valid ? 'RELEASE TO DEPLOY' : 'MOVE ONTO THE BATTLEFIELD';
      hint.classList.add('show');
      renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    const hit = cardHits()[0]?.object || null;
    setHovered(hit);
    renderer.domElement.style.cursor = hit ? 'grab' : (raycaster.intersectObject(deckTop, false)[0] ? 'pointer' : 'default');
  }

  function onWheel(event) {
    if (!hovered || dragging) return;
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    cardZoom = THREE.MathUtils.clamp(cardZoom - delta * .002, 0, 1);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    const card = dragging;
    dragging = null; hint.classList.remove('show');
    const valid = card.position.z > -3.55 && card.position.z < 1.65 && Math.abs(card.position.x + .4) < 5.7;
    if (valid) attackCard(card);
    else { hand.push(card); layoutHand(); transition(State.PLAYER_IDLE); }
    renderer.domElement.style.cursor = 'default';
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

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
      if (elapsed < 1.65) {
        dice.forEach((die, i) => {
          animation.velocities[i].y -= 12.5 * dt;
          die.position.addScaledVector(animation.velocities[i], dt);
          die.rotation.x += animation.angular[i].x * dt;
          die.rotation.y += animation.angular[i].y * dt;
          die.rotation.z += animation.angular[i].z * dt;
          if (die.position.y < .62) {
            die.position.y = .62; animation.velocities[i].y = Math.abs(animation.velocities[i].y) * .46;
            animation.velocities[i].x *= .78; animation.velocities[i].z *= .78;
            animation.angular[i].multiplyScalar(.82);
          }
        });
      } else {
        if (!animation.settled) {
          animation.settled = true; animation.settleStart = now;
          animation.from = dice.map(die => ({ position: die.position.clone(), quaternion: die.quaternion.clone() }));
        }
        const p = Math.min(1, (now - animation.settleStart) / 380);
        const eased = 1 - Math.pow(1 - p, 3);
        dice.forEach((die, i) => {
          die.position.lerpVectors(animation.from[i].position, new THREE.Vector3(i ? .68 : -.68, .62, -.45), eased);
          die.quaternion.slerpQuaternions(animation.from[i].quaternion, resultQuaternion(animation.values[i]), eased);
        });
        if (p === 1) { diceAnimation = null; animation.resolve(); }
      }
    }
    [...hand, ...battlefield, ...archive, ...opponentBattlefield].forEach(card => {
      if (card === dragging || motions.has(card)) return;
      const isHovered = card === hovered;
      const hoverLift = isHovered ? .9 : 0;
      const target = card.userData.target.clone(); target.y += hoverLift;
      if (isHovered) target.z += .3;
      if (isHovered && cardZoom > 0) {
        const distance = 2.18 / (1.2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        camera.getWorldDirection(cameraDirection);
        zoomTarget.copy(camera.position).addScaledVector(cameraDirection, distance);
        target.lerp(zoomTarget, cardZoom);
      }
      card.position.lerp(target, .16);

      if (isHovered) {
        billboardTarget.position.copy(card.position);
        billboardTarget.lookAt(camera.position);
        targetQuaternion.copy(billboardTarget.quaternion);
      } else {
        flatCardQuaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, card.userData.targetRot));
        targetQuaternion.copy(flatCardQuaternion);
      }
      card.quaternion.slerp(targetQuaternion, .16);
    });
    if (deckTop) deckTop.position.y = .14 + Math.sin(t * 1.4) * .008;
    renderer.render(scene, camera);
  }

  async function init() {
    try {
      await document.fonts.ready;
      const [tableTex, atlasTex, chromeTex, backTex, diceTex] = await Promise.all([
        loadTexture('./assets/table.png'), loadTexture('./assets/cards.png'),
        loadTexture('./assets/card-front-chrome.png'), loadTexture('./assets/card-back.png'),
        loadTexture('./assets/dice-occult-resin.png')
      ]);
      makeTable(tableTex); makeDeck(backTex); makeDice(diceTex);
      const atlas = atlasTex.image, chrome = chromeTex.image;
      const textures = CARD_DATA.map((_, i) => makeCardTexture(i, atlas, chrome));
      const cards = textures.map((texture, i) => createCard(i, texture));
      resetGame(cards);
      loading.classList.add('done');
    } catch (error) {
      console.error(error);
      loading.classList.add('failed');
      loadingMessage.innerHTML = `<strong>THE ARCHIVE FAILED TO OPEN</strong><small>${String(error?.message || error)}<br>Make sure the PNG assets are beside index.html.</small>`;
    }
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('pointerleave', () => {
    if (!dragging) setHovered(null);
  });
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'r') location.reload();
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  const help = document.getElementById('help');
  document.getElementById('settings').onclick = () => { help.hidden = !help.hidden; };
  document.getElementById('close-help').onclick = () => { help.hidden = true; };
  finishTurnButton.onclick = finishTurn;

  init(); animate();
})();
