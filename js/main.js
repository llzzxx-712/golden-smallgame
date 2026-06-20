import { createGameState, DIFFICULTIES, CHARACTERS, ITEM_TEMPLATES, addLog, setPhase, consumeStepResources, checkDead } from './game.js';
import { generateMap, renderMap, getAdjacentNodes, getNodeById, getNodesInRange } from './map.js';
import { triggerEvent, applyEvent } from './events.js';
import { getShopItems, buyItem } from './shop.js';
import { saveGame, loadGame, clearSave, loadReputation, saveReputation, settleReputation, unlockCharacter } from './storage.js';

let state = null;
let reputation = null;
let chosenCharacter = 'explorer';
let chosenDifficulty = 'normal';
let pendingEvent = null;
let afterEventCallback = null;

const canvas = document.getElementById('map-canvas');

// === DOM 引用 ===
const $ = (id) => document.getElementById(id);
const difficultyDisplay = $('difficulty-display');
const coinsDisplay = $('coins-display');
const resourceWater = $('resource-water');
const resourceFood = $('resource-food');
const resourceHp = $('resource-hp');
const resourceStamina = $('resource-stamina');
const itemsList = $('items-list');
const actionButtons = $('action-buttons');
const logContent = $('log-content');
const modalOverlay = $('modal-overlay');
const modalBox = $('modal-box');

// === UI 更新 ===
function updateUI() {
  if (!state) return;
  const p = state.player;
  difficultyDisplay.textContent = `难度: ${DIFFICULTIES[state.difficulty].label}`;
  coinsDisplay.textContent = `💰 ${p.coins}`;
  resourceWater.innerHTML = `💧 水: <span>${Math.max(0, p.water)}</span>`;
  resourceFood.innerHTML = `🍖 食物: <span>${Math.max(0, p.food)}</span>`;

  const hpPercent = Math.max(0, p.hp) / p.maxHp * 100;
  resourceHp.innerHTML = `❤️ HP: <span>${Math.max(0, p.hp)}/${p.maxHp}</span> <div class="hp-bar"><div class="hp-bar-fill" style="width:${hpPercent}%"></div></div>`;

  const staminaPercent = Math.max(0, p.stamina) / p.maxStamina * 100;
  resourceStamina.innerHTML = `⚡ 体力: <span>${Math.max(0, p.stamina)}/${p.maxStamina}</span> <div class="hp-bar"><div class="hp-bar-fill" style="width:${staminaPercent}%;background:var(--stamina)"></div></div>`;

  // 道具列表
  if (p.items.length === 0) {
    itemsList.innerHTML = '<span style="color:var(--text-dim)">空空如也</span>';
  } else {
    itemsList.innerHTML = p.items.map(i => {
      const tpl = ITEM_TEMPLATES[i.id] || {};
      return `<div title="${tpl.name || i.id}">${tpl.icon || '📦'} ${tpl.name || i.id}</div>`;
    }).join('');
  }

  // 行动按钮
  renderActionButtons();

  // 日志
  logContent.textContent = '📋 ' + (state.log.length > 0 ? state.log[state.log.length - 1] : '欢迎来到沙海淘金！');

  // Canvas 重绘
  if (state.map) renderMap(canvas, state.map, state, state.revealedNodes || null);
}

function renderActionButtons() {
  const p = state.player;
  let html = '';

  if (state.phase === 'prepare') {
    html += '<button onclick="window._openShop(\'camp\')">🛒 购买物资</button>';
    html += '<button class="primary" onclick="window._startTravel()">🚶 出发！</button>';
  }

  if (state.phase === 'travel' || state.phase === 'returning') {
    const adj = getAdjacentNodes(state.map, p.position);
    const curNode = getNodeById(state.map, p.position);
    for (const nid of adj) {
      const node = getNodeById(state.map, nid);
      if (node && curNode) {
        const isReturn = node.col < curNode.col;
        const dirIcon = isReturn ? '⬅️' : '➡️';
        const dirLabel = isReturn ? '返回' : '前往';
        const dirClass = isReturn ? 'style="background:#3a2a30"' : '';
        html += `<button ${dirClass} onclick="window._moveTo(${nid})">${dirIcon} ${dirLabel} ${node.icon} ${node.label}</button>`;
      }
    }
    if (p.items.some(i => i.id === 'tent')) {
      html += '<button onclick="window._useTent()">⛺ 扎营休息</button>';
    }
    for (const item of p.items) {
      if (item.id === 'medicine' && p.hp < p.maxHp) {
        html += '<button onclick="window._useItem(\'medicine\')">💊 使用药品 (+30 HP)</button>';
      }
      if (item.id === 'water_bag') {
        html += '<button onclick="window._useItem(\'water_bag\')">💧 使用水袋 (+3 水)</button>';
      }
      if (item.id === 'dried_food') {
        html += '<button onclick="window._useItem(\'dried_food\')">🍖 食用干粮 (+3 食物)</button>';
      }
      if (item.id === 'compass') {
        html += '<button onclick="window._useCompass()">🧭 使用指南针</button>';
      }
      if (item.id === 'fuel') {
        html += '<button onclick="window._useFuel()">⛽ 使用燃油 (3步)</button>';
      }
    }
  }

  if (state.phase === 'mining') {
    html += '<button class="primary" onclick="window._mineGold()">⛏️ 挖金！</button>';
  }

  if (state.phase === 'win' || state.phase === 'dead') {
    const icon = state.phase === 'win' ? '🎉 胜利！' : '💀 你死了...';
    const repText = state.phase === 'win' ? `获得声望: +${state.reputationEarned || 0}` : '';
    html += `<div style="color:${state.phase === 'win' ? 'var(--gold)' : 'var(--danger)'};text-align:center;padding:8px">${icon}</div>`;
    if (repText) html += `<div style="font-size:12px;color:var(--text-dim);text-align:center">${repText}</div>`;
    html += '<button class="primary" onclick="window._showStartScreen()">🔄 再来一局</button>';
  }

  actionButtons.innerHTML = html;
}

// === 游戏操作 ===
function moveTo(nodeId) {
  if (state.phase !== 'travel' && state.phase !== 'returning') return;

  const p = state.player;
  const targetNode = getNodeById(state.map, nodeId);
  if (!targetNode) return;

  const hasCamel = p.items.some(i => i.id === 'camel');
  const staminaCost = hasCamel ? 0.5 : 1;

  if (p._fuelSteps > 0) {
    p._fuelSteps--;
    addLog(state, `⛽ 燃油驱动，本步不耗体力 (剩余 ${p._fuelSteps} 步)`);
  } else {
    if (p.stamina < staminaCost) {
      addLog(state, '⚡ 体力不足，无法移动！请扎营休息。');
      updateUI();
      return;
    }
    const { waterCost, foodCost } = consumeStepResources(state);
    addLog(state, `消耗 💧${waterCost} 🍖${foodCost}`);
  }

  p.visitedNodes.push(nodeId);
  p.position = nodeId;
  state.turn++;

  // 迷雾：揭示相邻节点
  if (state.revealedNodes) {
    const newRevealed = getNodesInRange(state.map, nodeId, 1);
    for (const nid of newRevealed) state.revealedNodes.add(nid);
  }

  if (checkDead(state)) {
    reputation.stats.gamesPlayed++;
    reputation.stats.deaths++;
    saveReputation(reputation);
    saveGame(state);
    updateUI();
    return;
  }

  handleNodeArrival(targetNode);
}

function handleNodeArrival(targetNode) {
  const p = state.player;

  if (targetNode.type === 'camp') {
    if (p.atGoldMine) {
      setPhase(state, 'win');
      state.reputationEarned = 0;
      addLog(state, '🎉 你成功带着金子回到了营地！');
      const result = settleReputation(state);
      state.reputationEarned = result.earned;
      reputation = result.rep;
    } else {
      addLog(state, '你回到了营地。');
    }
    finishMove();
    return;
  }

  if (targetNode.type === 'goldMine') {
    setPhase(state, 'mining');
    p.atGoldMine = true;
    addLog(state, '⛏️ 你到达了金矿！准备挖金。');
    finishMove();
    return;
  }

  if (targetNode.type === 'oasis') {
    const bonus = p.items.some(i => i.id === 'tablet') ? 4 : 2;
    p.water += bonus;
    addLog(state, `💧 在绿洲补充了 ${bonus} 水！`);
  }

  if (targetNode.type === 'caravan') {
    addLog(state, '🐪 你遇到了商队，可以交易物资。');
    afterShopClose = () => {
      finishMove();
    };
    openShop('caravan');
    return;
  }

  if (targetNode.type === 'ruins') {
    addLog(state, '🏚️ 你探索了废墟...');
    if (Math.random() > 0.5) {
      p.coins += 15;
      addLog(state, '找到了 15 💰！');
    }
  }

  const event = triggerEvent(state);
  if (event) {
    showEventModal(event, () => { finishMove(); });
  } else {
    finishMove();
  }
}

function finishMove() {
  checkDead(state);
  if (state.phase === 'dead') {
    saveReputation(reputation);
  }
  saveGame(state);
  updateUI();
}

function useTent() {
  const p = state.player;
  const idx = p.items.findIndex(i => i.id === 'tent');
  if (idx === -1) return;
  p.items.splice(idx, 1);
  p.stamina = p.maxStamina;
  addLog(state, '⛺ 扎营休息，体力完全恢复！');
  updateUI();
}

function useItem(itemId) {
  const p = state.player;
  const idx = p.items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  p.items.splice(idx, 1);
  const tpl = ITEM_TEMPLATES[itemId];
  if (tpl.effect.water) p.water = Math.min(999, p.water + tpl.effect.water);
  if (tpl.effect.food) p.food = Math.min(999, p.food + tpl.effect.food);
  if (tpl.effect.hp) p.hp = Math.min(p.maxHp, p.hp + tpl.effect.hp);
  addLog(state, `使用了 ${tpl.name}！`);
  updateUI();
}

function useCompass() {
  const p = state.player;
  if (!p.items.some(i => i.id === 'compass')) return;
  // 揭示距离2的节点（指南针不消耗）
  if (state.revealedNodes) {
    const range2 = getNodesInRange(state.map, p.position, 2);
    let revealed = 0;
    for (const nid of range2) {
      if (!state.revealedNodes.has(nid)) {
        state.revealedNodes.add(nid);
        revealed++;
      }
    }
    addLog(state, `🧭 指南针揭示了周围 ${revealed} 个新地点！`);
  }
  updateUI();
}

function useFuel() {
  const p = state.player;
  const idx = p.items.findIndex(i => i.id === 'fuel');
  if (idx === -1) return;
  p.items.splice(idx, 1);
  p._fuelSteps = (p._fuelSteps || 0) + 3;
  addLog(state, '⛽ 使用了燃油，接下来 3 步不耗体力！');
  updateUI();
}

function mineGold() {
  const p = state.player;
  const char = CHARACTERS[p.character] || CHARACTERS.explorer;
  const bonus = char.effect?.goldBonus || 0;
  const base = 80 + Math.floor(Math.random() * 41); // 80-120
  const mined = Math.floor(base * (1 + bonus));
  p.coins += mined;
  p._goldMined = mined;
  setPhase(state, 'returning');
  addLog(state, `⛏️ 挖到了 ${mined} 金币！快回营地吧！`);
  saveGame(state);
  updateUI();
}

// === 事件弹窗 ===
function showEventModal(event, callback) {
  const catColors = { good: 'var(--gold)', bad: 'var(--danger)', neutral: 'var(--text-dim)' };
  const catLabels = { good: '🎉 好运', bad: '😨 噩运', neutral: '📋 事件' };
  const color = catColors[event.category] || 'var(--text-dim)';
  const label = catLabels[event.category] || '事件';

  const effectTexts = [];
  const eff = event.effect;
  if (eff.water) effectTexts.push(`💧 水 ${eff.water > 0 ? '+' : ''}${eff.water}`);
  if (eff.food) effectTexts.push(`🍖 食物 ${eff.food > 0 ? '+' : ''}${eff.food}`);
  if (eff.hp) effectTexts.push(`❤️ HP ${eff.hp > 0 ? '+' : ''}${eff.hp}`);
  if (eff.coins) effectTexts.push(`💰 金币 ${eff.coins > 0 ? '+' : ''}${eff.coins}`);
  if (eff.stamina) effectTexts.push(`⚡ 体力 ${eff.stamina > 0 ? '+' : ''}${eff.stamina}`);
  if (eff.tent) effectTexts.push('⛺ 免费扎营');
  if (eff.retreat) effectTexts.push('↩️ 退回上个节点');
  if (eff.freeStep) effectTexts.push('⚡ 本步不耗体力');
  if (eff.shortcut) effectTexts.push('🗺️ 发现捷径');
  if (eff.reveal) effectTexts.push('👁️ 探查周围节点');

  showModal(`
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:40px;display:block;margin-bottom:8px">${event.name.includes('沙暴') ? '🌪️' : event.name.includes('发现') ? '💧' : event.name.includes('强盗') ? '⚔️' : event.category === 'good' ? '✨' : event.category === 'bad' ? '💥' : '📦'}</span>
      <h2 style="color:${color};margin:0">${label}</h2>
      <h3 style="color:${color};margin:8px 0">${event.name}</h3>
      <p style="color:var(--text);font-size:15px;line-height:1.6">${event.desc}</p>
      ${effectTexts.length > 0 ? `<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;font-size:14px">${effectTexts.join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>` : ''}
    </div>
    <button class="primary" onclick="window._dismissEvent()" style="width:100%;padding:12px;font-size:16px">确定</button>
  `);
  pendingEvent = event;
  afterEventCallback = callback;
}

window._dismissEvent = () => {
  const event = pendingEvent;
  const cb = afterEventCallback;
  pendingEvent = null;
  afterEventCallback = null;
  hideModal();
  if (event && cb) {
    applyEvent(state, event);
    cb();
  }
};

// === 弹窗 ===
function showModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove('hidden');
}

function hideModal() {
  modalOverlay.classList.add('hidden');
}

function showStartScreen() {
  const rep = loadReputation();
  reputation = rep;
  clearSave();

  const charOptions = Object.values(CHARACTERS).map(c => {
    const unlocked = rep.unlockedCharacters.includes(c.id);
    const affordable = !unlocked && rep.totalReputation >= c.cost;
    const selectedBorder = (unlocked && chosenCharacter === c.id) ? 'border:2px solid var(--gold)' : 'border:2px solid transparent';
    return `
      <div style="padding:10px;margin:6px 0;background:var(--bg);border-radius:8px;display:flex;align-items:center;gap:8px;cursor:pointer;${selectedBorder}"
           ${unlocked ? `onclick="window._selectChar('${c.id}')"` : ''}>
        <span style="font-size:24px">${c.icon}</span>
        <div style="flex:1">
          <strong>${c.name}</strong>
          <div style="font-size:12px;color:var(--text-dim)">${c.desc}</div>
        </div>
        ${unlocked ? '<span style="color:var(--success);font-size:12px">✅</span>' : `
          <button onclick="event.stopPropagation();window._unlockChar('${c.id}')" 
            style="padding:6px 12px;font-size:13px;${affordable ? '' : 'opacity:0.4;cursor:not-allowed'}"
            ${!affordable ? 'disabled' : ''}>
            🔒 ${c.cost}⭐
          </button>
        `}
      </div>
    `;
  }).join('');

  const diffOptions = ['easy', 'normal', 'hard'].map(d => {
    const cfg = DIFFICULTIES[d];
    const selectedClass = chosenDifficulty === d ? 'border:2px solid var(--gold)' : 'border:2px solid transparent';
    return `
      <div style="padding:8px;margin:4px 0;background:var(--bg);border-radius:8px;cursor:pointer;${selectedClass}"
           onclick="window._selectDifficulty('${d}')">
        <strong>${cfg.label}</strong>
        <span style="float:right;color:var(--text-dim)">💰${cfg.startCoins}</span>
      </div>
    `;
  }).join('');

  showModal(`
    <h2>🏜️ 沙海淘金</h2>
    <p style="color:var(--text-dim);margin-bottom:12px">声望: ⭐ ${rep.totalReputation} | 胜: ${rep.stats.wins} | 局: ${rep.stats.gamesPlayed}</p>
    <h3>选择角色</h3>
    ${charOptions}
    <h3 style="margin-top:8px">选择难度</h3>
    ${diffOptions}
    <button class="primary" onclick="window._startGame()" style="margin-top:12px;width:100%">🎮 开始游戏</button>
  `);
}

function startGame() {
  const rep = loadReputation();
  if (!rep.unlockedCharacters.includes(chosenCharacter)) {
    alert('该角色未解锁！');
    return;
  }
  hideModal();
  state = createGameState(chosenDifficulty, chosenCharacter);
  state.player.coins = DIFFICULTIES[chosenDifficulty].startCoins;
  state.map = generateMap(chosenDifficulty, 800, 500);
  state.player.position = state.map.startNodeId;
  state.player.visitedNodes = [state.map.startNodeId];
  state.revealedNodes = new Set(getNodesInRange(state.map, state.map.startNodeId, 1));
  setPhase(state, 'prepare');
  addLog(state, `🟢 你选择了「${CHARACTERS[chosenCharacter].name}」，准备出发！`);
  saveGame(state);
  updateUI();
}

let shopItemsCache = null;

let afterShopClose = null;

function openShop(location) {
  shopItemsCache = getShopItems(location);
  const closeHandler = afterShopClose ? 'window._closeShopAndContinue()' : 'window._hideModal()';
  const html = `
    <h2>${location === 'camp' ? '🏕️ 营地商店' : '🐪 商队交易'}</h2>
    <div style="margin-bottom:8px;color:var(--gold)">💰 持有金币: ${state.player.coins}</div>
    ${shopItemsCache.map(item => {
      const owned = item.unique && state.player.items.some(i => i.id === item.id);
      return `
        <div style="padding:10px;margin:4px 0;background:var(--bg);border-radius:8px;display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">${item.icon}</span>
          <div style="flex:1">
            <strong>${item.name}</strong>
            <div style="font-size:12px;color:var(--text-dim)">${describeEffect(item.effect)}</div>
          </div>
          <span style="color:var(--gold);white-space:nowrap">💰${item.price}</span>
          <button ${owned ? 'disabled' : ''} onclick="window._buy('${item.id}', '${location}', ${item.price})">
            ${owned ? '已有' : '购买'}
          </button>
        </div>
      `;
    }).join('')}
    <button onclick="${closeHandler}" style="margin-top:8px;width:100%">关闭</button>
  `;
  showModal(html);
}

window._closeShopAndContinue = () => {
  hideModal();
  const cb = afterShopClose;
  afterShopClose = null;
  if (cb) cb();
};

function describeEffect(eff) {
  const parts = [];
  if (eff.water) parts.push(`水${eff.water > 0 ? '+' : ''}${eff.water}`);
  if (eff.food) parts.push(`食物${eff.food > 0 ? '+' : ''}${eff.food}`);
  if (eff.hp) parts.push(`HP${eff.hp > 0 ? '+' : ''}${eff.hp}`);
  if (eff.camel) parts.push('体力消耗减半');
  if (eff.tent) parts.push('扎营恢复体力');
  if (eff.compass) parts.push('查看相邻节点');
  if (eff.oasisBonus) parts.push('绿洲补水量+2');
  if (eff.fuelSteps) parts.push(`驱动${eff.fuelSteps}步不耗体力`);
  return parts.join(' | ') || '使用后生效';
}

// === 存档恢复 ===
function tryResume() {
  const saved = loadGame();
  if (!saved || saved.phase === 'win' || saved.phase === 'dead') return false;

  const rep = loadReputation();
  reputation = rep;

  showModal(`
    <h2>📂 有未完成的存档</h2>
    <p style="color:var(--text-dim)">角色: ${CHARACTERS[saved.player?.character]?.name || '未知'} | 难度: ${DIFFICULTIES[saved.difficulty]?.label || '?'}</p>
    <p style="color:var(--text-dim)">回合: ${saved.turn} | 阶段: ${saved.phase}</p>
    <button class="primary" onclick="window._resumeGame()" style="width:100%;margin-bottom:8px">▶️ 继续游戏</button>
    <button onclick="window._newGame()" style="width:100%">🆕 新游戏</button>
  `);
  return true;
}

function resumeGame() {
  const saved = loadGame();
  if (!saved) return;
  state = createGameState(saved.difficulty, saved.player.character);
  Object.assign(state, saved);
  // 恢复 revealedNodes 为 Set
  if (saved.revealedNodes && Array.isArray(saved.revealedNodes)) {
    state.revealedNodes = new Set(saved.revealedNodes);
  } else {
    state.revealedNodes = new Set();
  }
  reputation = loadReputation();
  hideModal();
  updateUI();
}

function unlockChar(charId) {
  const result = unlockCharacter(reputation, charId);
  if (result.success) {
    addLog(state, result.message);
  }
  showStartScreen();
}

// === 全局函数暴露 ===
window._moveTo = moveTo;
window._useTent = useTent;
window._useItem = useItem;
window._useCompass = useCompass;
window._useFuel = useFuel;
window._mineGold = mineGold;
window._hideModal = hideModal;
window._showStartScreen = showStartScreen;
window._selectChar = (id) => { chosenCharacter = id; showStartScreen(); };
window._selectDifficulty = (d) => { chosenDifficulty = d; showStartScreen(); };
window._startGame = startGame;
window._resumeGame = resumeGame;
window._newGame = () => { clearSave(); hideModal(); showStartScreen(); };
window._openShop = (loc) => openShop(loc);
window._buy = (itemId, location, price) => {
  const result = buyItem(state, itemId, location, price);
  addLog(state, result.message);
  openShop(location);
  updateUI();
};
window._unlockChar = (id) => unlockChar(id);
window._startTravel = () => {
  setPhase(state, 'travel');
  addLog(state, '🚶 你踏上了寻金之旅...');
  updateUI();
};

// === 初始化 ===
function init() {
  reputation = loadReputation();
  if (!tryResume()) {
    showStartScreen();
  }
}

init();
