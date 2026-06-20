import { createGameState, DIFFICULTIES, CHARACTERS, ITEM_TEMPLATES, addLog, setPhase, consumeStepResources, checkDead, checkThirstHunger } from './game.js';
import { generateMap, renderMap, getAdjacentNodes, getNodeById, getNodesInRange } from './map.js';
import { triggerEvent, applyEvent } from './events.js';
import { getShopItems, buyItem } from './shop.js';
import { saveGame, loadGame, clearSave, loadReputation, saveReputation, settleReputation, unlockCharacter } from './storage.js';
import { checkAchievements } from './achievements.js';

let state = null;
let reputation = null;
let chosenCharacter = 'explorer';
let chosenDifficulty = 'normal';
let pendingEvent = null;
let afterEventCallback = null;
let quickMoveEnabled = false;

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
    html += '<button onclick="window._doRest()" style="background:#2a3a30">💤 休息 (+1 体力)</button>';
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
        const dirClass = isReturn ? 'style="background:#2a3030"' : '';
        let posLabel = '';
        if (node.row < curNode.row) posLabel = ' △';
        else if (node.row > curNode.row) posLabel = ' ▽';
        html += `<button id="mvbtn-${nid}" ${dirClass} onclick="window._moveTo(${nid})">${dirIcon} ${dirLabel} ${node.icon} ${node.label}${posLabel}</button>`;
      }
    }
    // 绿洲采摘
    const curNode2 = getNodeById(state.map, p.position);
    if (curNode2 && curNode2.type === 'oasis') {
      html += '<button onclick="window._harvestOasis()" style="background:#2a3a20">🍎 采摘果实 (+1🍖 -1💧)</button>';
    }
    // 休息按钮（始终可用）
    const restBonus = getRestAmount(curNode2, p);
    html += `<button onclick="window._doRest()" style="background:#2a3a30">💤 休息 (恢复 ${restBonus} 体力)</button>`;
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

  // 游戏说明按钮 (非结束状态下显示)
  if (state.phase !== 'win' && state.phase !== 'dead') {
    html += '<button onclick="window._showGuide()" style="margin-top:4px;background:#2a2a3a;font-size:13px">📖 游戏说明</button>';
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
  lastClickedNodeId = null;
  if (highlightedBtn) { highlightedBtn.classList.remove('highlighted'); highlightedBtn = null; }
  document.getElementById('node-tooltip').classList.add('hidden');

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

  // 检查口渴/饥饿
  const thirstEvent = checkThirstHunger(state);
  if (checkDead(state)) {
    reputation.stats.gamesPlayed++;
    reputation.stats.deaths++;
    saveReputation(reputation);
    saveGame(state);
    updateUI();
    return;
  }
  if (thirstEvent) {
    showEventModal(thirstEvent, () => {
      if (checkDead(state)) {
        reputation.stats.gamesPlayed++;
        reputation.stats.deaths++;
        saveReputation(reputation);
        saveGame(state);
        updateUI();
        return;
      }
      handleNodeArrival(targetNode);
    });
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
      runAchievementCheck();
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

  if (targetNode.type === 'sandstorm') {
    p.hp = Math.max(0, p.hp - 10);
    addLog(state, '🌪️ 沙暴肆虐，损失了 10 HP！');
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

function getRestAmount(node, player) {
  if (!node) return 1;
  let amount = 1; // 默认
  if (node.type === 'oasis') amount = 1.5;
  else if (node.type === 'desert') amount = 0.5;
  else if (node.type === 'sandstorm') amount = -0.5;
  // 帐篷额外加成
  if (player.items.some(i => i.id === 'tent')) amount += 1.5;
  return amount;
}

function doRest() {
  const p = state.player;
  const node = getNodeById(state.map, p.position);

  // 消耗水粮 (最多扣到0)
  p.water = Math.max(0, p.water - 1);
  p.food = Math.max(0, p.food - 1);
  state.turn++;

  const thirstEvent = checkThirstHunger(state);
  if (checkDead(state)) {
    reputation.stats.gamesPlayed++;
    reputation.stats.deaths++;
    saveReputation(reputation);
    saveGame(state);
    updateUI();
    return;
  }
  if (thirstEvent) {
    showEventModal(thirstEvent, () => {
      if (checkDead(state)) {
        reputation.stats.gamesPlayed++;
        reputation.stats.deaths++;
        saveReputation(reputation);
        runAchievementCheck();
        updateUI();
        return;
      }
      doRestContinue(node);
    });
    return;
  }

  doRestContinue(node);
}

function doRestContinue(node) {
  const p = state.player;
  const amount = getRestAmount(node, p);
  p.stamina = Math.min(p.maxStamina, p.stamina + amount);

  if (node.type === 'sandstorm') {
    addLog(state, `🌪️ 在沙暴中艰难休息，体力 ${amount > 0 ? '+' : ''}${amount}。消耗 💧1 🍖1`);
  } else {
    addLog(state, `💤 休息了一晚，恢复了 ${amount} 体力。消耗 💧1 🍖1`);
  }

  // 沙暴中体力耗尽则死
  if (p.stamina <= 0) {
    addLog(state, '💀 沙暴将你吞噬，体力耗尽无法离开...');
    setPhase(state, 'dead');
    reputation.stats.gamesPlayed++;
    reputation.stats.deaths++;
    saveReputation(reputation);
    saveGame(state);
    runAchievementCheck();
    updateUI();
    return;
  }

  // 触发事件
  const event = triggerEvent(state);
  if (event) {
    showEventModal(event, () => { finishMove(); });
  } else {
    finishMove();
  }
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

function harvestOasis() {
  const p = state.player;
  p.food = Math.min(999, p.food + 1);
  p.water = Math.max(0, p.water - 1);
  addLog(state, '🍎 你在绿洲采摘了果实，+1🍖 -1💧');
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
    // 揭示效果
    if (event.effect && event.effect.reveal && state.revealedNodes) {
      const rangeN = getNodesInRange(state.map, state.player.position, event.effect.reveal);
      for (const nid of rangeN) state.revealedNodes.add(nid);
      addLog(state, `👁️ 揭示了 ${rangeN.length} 个节点的视野！`);
    }
    cb();
  }
};

// === 成就 ===
function showAchievementToast(ach) {
  const toast = document.getElementById('achievement-toast');
  const nameEl = document.getElementById('ach-name');
  toast.querySelector('.ach-icon').textContent = ach.icon;
  nameEl.textContent = `${ach.name} — ${ach.desc} (+20⭐)`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

function runAchievementCheck() {
  if (!state || !reputation) return;
  reputation.lifetimeStats = reputation.lifetimeStats || {};
  reputation.lifetimeStats.totalSteps = (reputation.lifetimeStats.totalSteps || 0) +
    (state.player.visitedNodes?.length || 0);
  reputation.lifetimeStats.veteranKills = Math.max(
    reputation.lifetimeStats.veteranKills || 0,
    state.player._veteranKills || 0
  );
  if (state.phase === 'win' && state.player.character) {
    const charWins = reputation.lifetimeStats.charWins || [];
    if (!charWins.includes(state.player.character)) {
      charWins.push(state.player.character);
      reputation.lifetimeStats.charWins = charWins;
    }
  }
  const newAch = checkAchievements(reputation, state, reputation.lifetimeStats);
  for (const ach of newAch) {
    showAchievementToast(ach);
    addLog(state, `🏆 成就解锁: ${ach.icon} ${ach.name} (+20⭐)`);
  }
  if (newAch.length > 0) saveReputation(reputation);
}

function showConfirmModal(node, dirText) {
  showModal(`
    <div style="text-align:center">
      <span style="font-size:36px;display:block;margin-bottom:8px">${node.icon}</span>
      <h3 style="margin:0">${dirText} ${node.label}</h3>
      <p style="color:var(--text-dim);margin:8px 0">${getNodeDesc(node)}</p>
      <button class="primary" onclick="window._confirmMove(${node.id})" style="width:100%;padding:12px;font-size:16px;margin-bottom:6px">✅ 确定前往</button>
      <button onclick="window._hideModal()" style="width:100%">取消</button>
    </div>
  `);
}

window._confirmMove = (nodeId) => {
  hideModal();
  lastClickedNodeId = null;
  if (highlightedBtn) { highlightedBtn.classList.remove('highlighted'); highlightedBtn = null; }
  document.getElementById('node-tooltip').classList.add('hidden');
  moveTo(nodeId);
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
  state.revealedNodes = new Set(getNodesInRange(state.map, state.map.startNodeId, 2));
  setPhase(state, 'prepare');
  addLog(state, `🟢 你选择了「${CHARACTERS[chosenCharacter].name}」，准备出发！`);
  saveGame(state);
  updateUI();
  // 重置地图提示动画
  const hint = document.getElementById('map-hint');
  if (hint) { hint.style.animation = 'none'; hint.offsetHeight; hint.style.animation = ''; }
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
  const hint = document.getElementById('map-hint');
  if (hint) { hint.style.animation = 'none'; hint.offsetHeight; hint.style.animation = ''; }
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
window._doRest = doRest;
window._useItem = useItem;
window._useCompass = useCompass;
window._useFuel = useFuel;
window._harvestOasis = harvestOasis;
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
  if (result.success && reputation) {
    reputation.lifetimeStats = reputation.lifetimeStats || {};
    reputation.lifetimeStats.itemsBoughtThisRun = (reputation.lifetimeStats.itemsBoughtThisRun || 0) + 1;
  }
  openShop(location);
  updateUI();
};
window._unlockChar = (id) => unlockChar(id);
window._startTravel = () => {
  setPhase(state, 'travel');
  addLog(state, '🚶 你踏上了寻金之旅...');
  updateUI();
};

// === 游戏说明 ===
function showGuide() {
  showModal(`
    <h2>📖 游戏说明</h2>
    <div style="max-height:60vh;overflow-y:auto;font-size:14px;line-height:1.8">
      <h3>🎯 目标</h3>
      <p>从🏕️营地出发，穿越沙漠到达⛏️金矿挖金，然后活着返回营地。</p>

      <h3>📊 资源</h3>
      <table style="width:100%;font-size:13px">
        <tr><td>💧 水</td><td>每步消耗1(游牧民-20%)，归零后进入口渴阶段</td></tr>
        <tr><td>🍖 食物</td><td>每步消耗1(游牧民-20%)，归零后进入饥饿阶段</td></tr>
        <tr><td>❤️ HP</td><td>受伤扣减，归零死亡</td></tr>
        <tr><td>⚡ 体力</td><td>每步消耗1(骆驼0.5)，归零无法移动</td></tr>
        <tr><td>💰 金币</td><td>购买物资，挖金获取(80~120，地质学家+30%)</td></tr>
      </table>
      <p style="color:var(--danger);font-size:12px">⚠ 口渴/饥饿阶段：第1次归零仅提醒 → 第2次-30HP弹窗 → 第3次-60HP弹窗 → 第4次死亡。补充水粮后重置。</p>

      <h3>🛒 道具</h3>
      <table style="width:100%;font-size:13px">
        <tr><td>💧 水袋 +3水</td><td>💰20</td><td>💊 药品 +30HP</td><td>💰15</td></tr>
        <tr><td>🍖 干粮 +3食物</td><td>💰20</td><td>⛺ 帐篷 休息+1.5</td><td>💰35</td></tr>
        <tr><td>🐪 骆驼 体力减半</td><td>💰70</td><td>🧭 指南针 无限探查</td><td>💰45</td></tr>
        <tr><td>💠 净水片 绿洲+2水</td><td>💰20</td><td>⛽ 燃油 3步免体力(可复购)</td><td>💰25</td></tr>
      </table>

      <h3>🗺️ 节点类型</h3>
      <table style="width:100%;font-size:13px">
        <tr><td>🏕️ 营地</td><td>起点/终点，可购买物资与休息</td></tr>
        <tr><td>🌵 沙漠</td><td>触发随机事件，休息恢复0.5体力</td></tr>
        <tr><td>💧 绿洲</td><td>免费补水+2(净水片+4)，休息恢复1.5体力，可采摘果实(+1🍖-1💧)</td></tr>
        <tr><td>🏚️ 废墟</td><td>50%找到15金币，触发随机事件</td></tr>
        <tr><td>🐪 商队</td><td>交易物资(价格60%~140%浮动)，仅售水粮药品帐篷</td></tr>
        <tr><td>🌪️ 沙暴</td><td>到达扣10HP，休息-0.5体力，无帐篷体力归零即死</td></tr>
        <tr><td>⛏️ 金矿</td><td>挖得80~120金币(地质学家×1.3)</td></tr>
      </table>

      <h3>💤 休息</h3>
      <p>任意节点可休息，消耗💧1🍖1。绿洲+1.5 | 沙漠+0.5 | 沙暴-0.5 | 其余+1。帐篷额外+1.5。</p>

      <h3>🎲 事件</h3>
      <p>到达节点或休息时随机触发好/坏/中性事件。点击地图节点可查看详情，再点一次可前往(快速移动模式无需确认)。</p>

      <h3>👁️ 地图与迷雾</h3>
      <p>开局显示距离2的节点，移动逐步揭示。点击已揭示节点可查看信息。指南针揭示距离2节点，捷径事件揭示距离3。</p>

      <h3>🏆 成就</h3>
      <p>达成特定条件自动解锁14个成就，每个+20声望。页面顶部弹出奖杯通知。</p>

      <h3>⭐ 声望与角色</h3>
      <p>成功返回营地结算：(金币÷10+水×2+食物×2+HP×0.3+道具×5+节点×3)×难度倍率。声望解锁新角色与道具。</p>
    </div>
    <button onclick="window._hideModal()" style="margin-top:12px;width:100%">关闭</button>
  `);
}

function showIntro() {
  showModal(`
    <div style="text-align:center">
      <div style="font-size:48px;margin-bottom:8px">🏜️</div>
      <h2>欢迎来到沙海淘金！</h2>
      <p style="color:var(--text-dim);margin:12px 0">沙漠深处的金矿在呼唤——</p>
      <div style="text-align:left;font-size:14px;line-height:1.8;margin:16px 0">
        <p>🎯 <b>目标：</b>从营地出发，活着到金矿挖金，再活着回来。</p>
        <p>📊 <b>管理资源：</b>水、食物、HP、体力——任何一项归零即死。</p>
        <p>🛒 <b>购买物资：</b>出发前在营地商店备齐水粮和道具。</p>
        <p>🗺️ <b>规划路线：</b>地图随机生成，迷雾笼罩，谨慎选择每一步。</p>
        <p>🎲 <b>随机事件：</b>好运或噩运随时降临，做好应对准备。</p>
        <p>💤 <b>适时休息：</b>体力不足时扎营恢复，但会消耗水粮。</p>
        <p>⭐ <b>积累声望：</b>成功返回可获声望，解锁更强角色。</p>
      </div>
      <p style="color:var(--text-dim);font-size:13px">侧栏📖游戏说明可随时查看完整规则</p>
      <button class="primary" onclick="window._afterIntro()" style="width:100%;padding:12px;font-size:16px;margin-top:8px">🚶 开始冒险！</button>
    </div>
  `);
}

window._afterIntro = () => {
  hideModal();
  if (!tryResume()) {
    showStartScreen();
  }
};

window._showGuide = showGuide;

// === 快速移动 ===
function toggleQuickMove() {
  quickMoveEnabled = !quickMoveEnabled;
  const btn = document.getElementById('quick-move-btn');
  if (!btn) return;
  btn.textContent = quickMoveEnabled ? '⚡ 快速移动：开' : '⚡ 快速移动：关';
  btn.style.background = quickMoveEnabled ? '#f0c040' : '';
  btn.style.color = quickMoveEnabled ? '#1a1625' : '';
  btn.style.border = quickMoveEnabled ? '2px solid #f0c040' : '';
}

window._toggleQuickMove = toggleQuickMove;

// === 地图点击 ===
let highlightedBtn = null;
let lastClickedNodeId = null;

canvas.addEventListener('click', (e) => {
  if (!state || !state.map) return;
  if (state.phase !== 'travel' && state.phase !== 'returning') return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gx = mx * 800 / rect.width;
  const gy = my * 500 / rect.height;

  // 搜索所有已揭示节点
  const revealed = state.revealedNodes || new Set();
  let closestNode = null;
  let closestDist = 25;

  for (const nid of revealed) {
    const node = getNodeById(state.map, nid);
    if (!node) continue;
    const dx = gx - node.x;
    const dy = gy - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) { closestDist = dist; closestNode = node; }
  }

  if (!closestNode) {
    lastClickedNodeId = null;
    return;
  }

  const isAdjacent = getAdjacentNodes(state.map, state.player.position).includes(closestNode.id);

  // 双击同一个相邻节点
  if (closestNode.id === lastClickedNodeId && isAdjacent) {
    if (quickMoveEnabled) {
      moveTo(closestNode.id);
    } else {
      const curNode = getNodeById(state.map, state.player.position);
      const isReturn = curNode && closestNode.col < curNode.col;
      const dirText = isReturn ? '⬅️返回' : '➡️前往';
      showConfirmModal(closestNode, dirText);
    }
    return;
  }

  // 记录当前点击
  lastClickedNodeId = closestNode.id;

  // 清除之前的高亮
  if (highlightedBtn) { highlightedBtn.classList.remove('highlighted'); highlightedBtn = null; }
  const tooltip = document.getElementById('node-tooltip');
  tooltip.classList.add('hidden');

  // 仅相邻节点高亮按钮
  if (isAdjacent) {
    const btn = document.getElementById(`mvbtn-${closestNode.id}`);
    if (btn) { btn.classList.add('highlighted'); btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); highlightedBtn = btn; }
  }

  // 显示提示 (含再点触达提示)
  const curNode = getNodeById(state.map, state.player.position);
  const isReturn = curNode && closestNode.col < curNode.col;
  const dirText = isAdjacent ? (isReturn ? '⬅️返回' : '➡️前往') : '👁️';
  const rowText = curNode && closestNode.row < curNode.row ? ' △上方' : curNode && closestNode.row > curNode.row ? ' ▽下方' : '';
  const clickHint = isAdjacent ? (quickMoveEnabled
    ? '<br><span style="font-size:10px;color:var(--success)">再次点击直接前往</span>'
    : '<br><span style="font-size:10px;color:var(--gold)">再次点击确认前往</span>') : '';
  const desc = getNodeDesc(closestNode);
  tooltip.innerHTML = `${dirText} ${closestNode.icon} ${closestNode.label}${rowText}${clickHint}<br><span style="font-size:11px;color:var(--text-dim)">${desc}</span>`;
  tooltip.classList.remove('hidden');
  const nsx = closestNode.x * rect.width / 800;
  const nsy = closestNode.y * rect.height / 500;
  tooltip.style.left = Math.min(nsx + 30, rect.width - 200) + 'px';
  tooltip.style.top = Math.max(nsy - 50, 4) + 'px';
});

function getNodeDesc(node) {
  const descs = {
    camp: '起点·终点 | 可购买物资与休息',
    desert: '随机事件 | 休息恢复0.5体力',
    oasis: '免费补水+2(净水片+4) | 可采摘果实 | 休息恢复1.5体力',
    ruins: '50%概率发现15金币 | 随机事件',
    caravan: '买卖物资 | 价格在60%~140%浮动 | 仅售水袋/干粮/药品/帐篷',
    goldMine: '挖得80~120金币 | 地质学家+30%',
    sandstorm: '⚠到达即扣10HP | 休息-0.5体力 | 无帐篷体力归零即死',
  };
  return descs[node.type] || '';
}

// === 初始化 ===
function init() {
  // 绑定快速移动按钮
  const qmb = document.getElementById('quick-move-btn');
  if (qmb) {
    qmb.onclick = toggleQuickMove;
  }

  reputation = loadReputation();
  const introSeen = localStorage.getItem('sahaijin_intro_seen');
  if (!introSeen) {
    localStorage.setItem('sahaijin_intro_seen', '1');
    showIntro();
    return;
  }
  if (!tryResume()) {
    showStartScreen();
  }
}

init();
