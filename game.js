/* global THREE, CARD_DATA */
(() => {
  'use strict';

  const root = document.getElementById('game');
  const loading = document.getElementById('loading');
  const loadingMessage = document.getElementById('loading-message');
  const deckLabel = document.getElementById('deck-label');
  const archiveLabel = document.getElementById('grave-label');
  const hint = document.getElementById('hint');

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
  const cardGeometry = new THREE.PlaneGeometry(1.56, 2.18);
  const hand = [];
  const battlefield = [];
  let deck = [];
  let dragging = null;
  let hovered = null;
  let table, deckTop;

  const textureLoader = new THREE.TextureLoader();
  const loadTexture = url => new Promise((resolve, reject) => textureLoader.load(url, resolve, undefined, reject));

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

  function layoutHand() {
    const count = hand.length;
    const spacing = Math.min(1.18, 7.1 / Math.max(count - 1, 1));
    hand.forEach((card, i) => {
      const offset = i - (count - 1) / 2;
      card.userData.target.set(offset * spacing, .16 + Math.abs(offset) * .012, 4.12 + Math.abs(offset) * .08);
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
      card.userData.target.set((col - (rowCount - 1) / 2) * 1.82 - .35, .08, -1.4 + row * 2.45);
      card.userData.targetRot = 0;
      card.userData.zone = 'field';
    });
  }

  function updateLabels() {
    deckLabel.querySelector('b').textContent = deck.length;
    archiveLabel.querySelector('b').textContent = '0';
    deckLabel.style.opacity = deck.length ? '1' : '.35';
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
    deck = [...cards].sort(() => Math.random() - .5);
    deck.forEach(c => { c.visible = false; c.userData.zone = 'deck'; });
    for (let i = 0; i < 6; i++) drawCard();
    updateLabels();
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function cardHits() {
    return raycaster.intersectObjects(hand.filter(c => c !== dragging), false);
  }

  function onPointerDown(event) {
    setPointer(event);
    const deckHit = deckTop && raycaster.intersectObject(deckTop, false)[0];
    if (deckHit) { drawCard(); return; }
    const hit = cardHits()[0];
    if (!hit) return;
    dragging = hit.object;
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
    if (hovered !== hit) hovered = hit;
    renderer.domElement.style.cursor = hit ? 'grab' : (raycaster.intersectObject(deckTop, false)[0] ? 'pointer' : 'default');
  }

  function onPointerUp(event) {
    if (!dragging) return;
    const card = dragging;
    dragging = null; hint.classList.remove('show');
    const valid = card.position.z > -3.55 && card.position.z < 1.65 && Math.abs(card.position.x + .4) < 5.7;
    if (valid) { battlefield.push(card); layoutBattlefield(); }
    else { hand.push(card); layoutHand(); }
    renderer.domElement.style.cursor = 'default';
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = performance.now() * .001;
    [...hand, ...battlefield].forEach(card => {
      if (card === dragging) return;
      const hoverLift = card === hovered && card.userData.zone === 'hand' ? .42 : 0;
      const target = card.userData.target.clone(); target.y += hoverLift;
      if (card === hovered) target.z -= .2;
      card.position.lerp(target, .16);
      card.rotation.z += (card.userData.targetRot - card.rotation.z) * .16;
    });
    if (deckTop) deckTop.position.y = .14 + Math.sin(t * 1.4) * .008;
    renderer.render(scene, camera);
  }

  async function init() {
    try {
      await document.fonts.ready;
      const [tableTex, atlasTex, chromeTex, backTex] = await Promise.all([
        loadTexture('./table.png'), loadTexture('./cards.png'),
        loadTexture('./card-front-chrome.png'), loadTexture('./card-back.png')
      ]);
      makeTable(tableTex); makeDeck(backTex);
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
  addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'd') drawCard();
    if (event.key.toLowerCase() === 'r') location.reload();
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  const help = document.getElementById('help');
  document.getElementById('settings').onclick = () => { help.hidden = !help.hidden; };
  document.getElementById('close-help').onclick = () => { help.hidden = true; };

  init(); animate();
})();
