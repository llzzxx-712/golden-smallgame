# 沙海淘金 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一款浏览器端运行的节点式路线沙漠生存游戏，包含资源管理、随机事件、道具商店、难度系统和声望跨局成长。

**Architecture:** 纯前端单页应用。HTML 定义布局骨架，CSS 处理扁平卡通风 UI，Canvas 绘制节点连线地图。游戏逻辑分模块管理（game/map/events/shop/storage），由 main.js 串联 UI 交互。localStorage 持久化声望和存档。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS (ES modules)，零外部依赖。

---

## 模块职责

| 文件 | 职责 | 接口 |
|------|------|------|
| `index.html` | 页面结构，所有 UI 面板 | 通过 ID 暴露 DOM 元素给 js |
| `css/style.css` | 扁平卡通风格，圆角色块 + emoji，全屏布局 | CSS class |
| `js/game.js` | 游戏状态机、玩家数据、回合推进 | `createGame()`, `step()`, `getState()` |
| `js/map.js` | 地图随机生成 + Canvas 绘制 | `generateMap()`, `renderMap()`, `getReachable()` |
| `js/events.js` | 随机事件触发和结算 | `triggerEvent()`, `applyEvent()` |
| `js/shop.js` | 商店/商队商品列表和交易 | `getShopItems()`, `buy()`, `sell()` |
| `js/storage.js` | localStorage 读写 | `saveGame()`, `loadGame()`, `saveReputation()` |
| `js/main.js` | UI 事件绑定、模块串联、启动入口 | `init()` |

---

### Task 1: 项目脚手架 — HTML 布局

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**说明：** 搭建 HTML 骨架（左右分栏：资源面板 + 地图画布），引入 CSS 和 JS。

- [ ] **Step 1: 创建 index.html 结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>沙海淘金</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <header id="top-bar">
      <h1>🏜️ 沙海淘金</h1>
      <span id="difficulty-display">难度: 普通</span>
      <span id="coins-display">💰 100</span>
    </header>
    <main id="game-area">
      <aside id="sidebar">
        <div id="resources-panel" class="panel">
          <h2>资源</h2>
          <div id="resource-water">💧 水: 5</div>
          <div id="resource-food">🍖 食物: 5</div>
          <div id="resource-hp">❤️ HP: 100/100</div>
          <div id="resource-stamina">⚡ 体力: 5/5</div>
        </div>
        <div id="items-panel" class="panel">
          <h2>道具</h2>
          <div id="items-list"></div>
        </div>
        <div id="actions-panel" class="panel">
          <h2>操作</h2>
          <div id="action-buttons"></div>
        </div>
      </aside>
      <div id="map-container">
        <canvas id="map-canvas"></canvas>
        <div id="event-overlay" class="overlay hidden"></div>
      </div>
    </main>
    <footer id="log-bar">
      <div id="log-content">📋 欢迎来到沙海淘金！</div>
    </footer>
  </div>

  <!-- 弹层：开始选择 / 商店 / 事件 / 结算 -->
  <div id="modal-overlay" class="modal-overlay hidden">
    <div id="modal-box" class="modal-box"></div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 css/style.css 基础样式**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #1a1625;
  --panel-bg: #252033;
  --panel-border: #3a3348;
  --gold: #f0c040;
  --water: #4a90d9;
  --food: #c07c4a;
  --hp: #c04a4a;
  --stamina: #7ec04a;
  --text: #e8e0d0;
  --text-dim: #8a8090;
  --danger: #e04040;
  --success: #40c080;
  --radius: 12px;
  font-family: 'Segoe UI', 'PingFang SC', system-ui, sans-serif;
}

body {
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--panel-bg);
  border-bottom: 2px solid var(--panel-border);
}

#top-bar h1 { font-size: 18px; }

#top-bar span { font-size: 14px; color: var(--text-dim); }

#game-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar {
  width: 220px;
  background: var(--panel-bg);
  border-right: 2px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
}

.panel {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 12px;
}

.panel h2 {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 6px;
  text-transform: uppercase;
}

#resources-panel > div {
  padding: 4px 0;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

#map-container {
  flex: 1;
  position: relative;
}

#map-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
}

.hidden { display: none !important; }

#log-bar {
  padding: 6px 16px;
  background: var(--panel-bg);
  border-top: 2px solid var(--panel-border);
  font-size: 13px;
  color: var(--text-dim);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-box {
  background: var(--panel-bg);
  border: 2px solid var(--panel-border);
  border-radius: var(--radius);
  padding: 24px;
  min-width: 320px;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-box h2 { font-size: 18px; margin-bottom: 12px; }

.modal-box button {
  background: var(--panel-border);
  color: var(--text);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-box button:hover { background: #5a4a6a; }

.modal-box button.primary { background: var(--gold); color: #1a1625; font-weight: bold; }
.modal-box button.danger { background: var(--danger); }
</style>
```

- [ ] **Step 3: 浏览器打开 index.html 验证骨架**

Run: 直接用浏览器打开 `index.html`，确认能看到左右分栏、顶栏、底栏、资源面板。

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: add HTML layout scaffold and base CSS"
```

---

### Task 2: 数据模型与游戏状态机

**Files:**
- Create: `js/game.js`

**说明：** 定义游戏核心数据结构（Player, GameState, Difficulty），实现状态机（init → prepare → travel → mining → return → win/dead）。

- [ ] **Step 1: 创建 js/game.js 定义常量和难度配置**

```js
// 难度配置
export const DIFFICULTIES = {
  easy: {
    label: '简单', oasisCount: 3, goodEventBias: 0.1, startCoins: 150,
    sandstormCount: 1, reputationMultiplier: 1.0
  },
  normal: {
    label: '普通', oasisCount: 2, goodEventBias: 0, startCoins: 100,
    sandstormCount: 2, reputationMultiplier: 1.2
  },
  hard: {
    label: '困难', oasisCount: 1, goodEventBias: -0.1, startCoins: 60,
    sandstormCount: 3, reputationMultiplier: 1.5
  }
};

// 道具模板
export const ITEM_TEMPLATES = {
  water_bag:  { id: 'water_bag',  name: '水袋',  icon: '💧', effect: { water: 3 }, price: 15 },
  dried_food: { id: 'dried_food', name: '干粮',  icon: '🍖', effect: { food: 3 },  price: 15 },
  medicine:   { id: 'medicine',   name: '药品',  icon: '💊', effect: { hp: 30 },    price: 25 },
  camel:      { id: 'camel',      name: '骆驼',  icon: '🐪', effect: { camel: true }, price: 50, permanent: true, unique: true },
  tent:       { id: 'tent',       name: '帐篷',  icon: '⛺', effect: { tent: 1 },    price: 30, consumable: true },
  compass:    { id: 'compass',    name: '指南针', icon: '🧭', effect: { compass: 1 }, price: 20, consumable: true },
  tablet:     { id: 'tablet',     name: '净水片', icon: '💠', effect: { oasisBonus: 2 }, price: 10, permanent: true, unique: true },
  fuel:       { id: 'fuel',       name: '燃油',   icon: '⛽', effect: { fuelSteps: 3 }, price: 20, permanent: true, unique: true },
};

// 角色模板
export const CHARACTERS = {
  explorer:    { id: 'explorer',    name: '探险家',  icon: '🧑', cost: 0,   desc: '标准属性，无特殊能力' },
  geologist:   { id: 'geologist',   name: '地质学家', icon: '👩‍', cost: 80,  desc: '挖金收益 +30%', effect: { goldBonus: 0.3 } },
  nomad:       { id: 'nomad',       name: '游牧民',   icon: '🧕', cost: 100, desc: '水和食物消耗 -20%', effect: { consumeReduce: 0.2 } },
  veteran:     { id: 'veteran',     name: '老兵',     icon: '👨‍', cost: 120, desc: 'HP +30，战斗事件必胜', effect: { hpBonus: 30, combatWin: true } },
};
```

- [ ] **Step 2: 定义 Player 和 GameState 工厂函数**

```js
export function createPlayer(characterId = 'explorer') {
  const char = CHARACTERS[characterId];
  return {
    water: 5,
    food: 5,
    hp: 100 + (char.effect?.hpBonus || 0),
    maxHp: 100 + (char.effect?.hpBonus || 0),
    stamina: 5,
    maxStamina: 5,
    coins: 100,
    items: [],
    character: characterId,
    position: null,    // current node id
    visitedNodes: [],  // ids of visited nodes
    atGoldMine: false,
  };
}

export function createGameState(difficulty = 'normal', characterId = 'explorer') {
  const diff = DIFFICULTIES[difficulty];
  return {
    phase: 'init',       // init | prepare | travel | mining | returning | win | dead
    difficulty,
    player: createPlayer(characterId),
    map: null,
    log: [],
    turn: 0,
    reputationEarned: 0,
  };
}

export function addLog(state, message) {
  state.log.push(`[第${state.turn}回合] ${message}`);
  if (state.log.length > 50) state.log.shift();
}

export function setPhase(state, phase) {
  state.phase = phase;
}
```

- [ ] **Step 3: 添加资源消耗和检查函数**

```js
export function consumeStepResources(state) {
  const p = state.player;
  const char = CHARACTERS[p.character];
  const reduce = 1 - (char.effect?.consumeReduce || 0);
  const waterCost = Math.round(1 * reduce);
  const foodCost = Math.round(1 * reduce);
  p.water -= waterCost;
  p.food -= foodCost;
  p.stamina -= p.items.some(i => i.id === 'camel') ? 0.5 : 1;
  return { waterCost, foodCost };
}

export function checkDead(state) {
  const p = state.player;
  if (p.water <= 0) { setPhase(state, 'dead'); addLog(state, '💀 你渴死在沙漠中...'); return true; }
  if (p.food <= 0) { setPhase(state, 'dead'); addLog(state, '💀 你饿死在沙漠中...'); return true; }
  if (p.hp <= 0) { setPhase(state, 'dead'); addLog(state, '💀 你倒在了沙丘上...'); return true; }
  return false;
}

export function checkWin(state) {
  const p = state.player;
  if (p.atGoldMine && state.phase === 'returning' && p.position === state.map.startNodeId) {
    setPhase(state, 'win');
    addLog(state, '🎉 你成功带着金子返回营地！');
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/game.js
git commit -m "feat: add game data model and state machine"
```

---

### Task 3: 地图生成

**Files:**
- Create: `js/map.js`

**说明：** 随机生成节点连线地图，保证营地到金矿连通。根据难度调整绿洲和沙暴数量。

- [ ] **Step 1: 创建 js/map.js 实现地图生成**

```js
// 节点类型
export const NODE_TYPES = {
  camp:      { type: 'camp',      icon: '🏕️', label: '营地',    eventChance: 0 },
  desert:    { type: 'desert',    icon: '🌵', label: '沙漠',    eventChance: 1 },
  oasis:     { type: 'oasis',     icon: '💧', label: '绿洲',    eventChance: 0.5, goodBias: 0.2 },
  ruins:     { type: 'ruins',     icon: '🏚️', label: '废墟',    eventChance: 0.8, goodBias: 0.15 },
  caravan:   { type: 'caravan',   icon: '🐪', label: '商队',    eventChance: 0 },
  goldMine:  { type: 'goldMine',  icon: '⛏️', label: '金矿',    eventChance: 0 },
  sandstorm: { type: 'sandstorm', icon: '🌪️', label: '沙暴',    eventChance: 0.9, goodBias: -0.4 },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * 生成地图节点和边
 * 策略：在 canvas 上划分网格，放置节点，用 BFS 保证连通
 */
export function generateMap(difficulty = 'normal', canvasWidth = 800, canvasHeight = 500) {
  const diff = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2;
  const nodes = [];
  const edges = [];

  const margin = 60;
  const cols = 5;
  const rows = 3;
  const cellW = (canvasWidth - margin * 2) / (cols - 1);
  const cellH = (canvasHeight - margin * 2) / (rows - 1);

  let id = 0;
  const nextId = () => id++;

  // 列0: 营地
  const campNode = { id: nextId(), ...NODE_TYPES.camp, col: 0, row: 1 };
  nodes.push(campNode);

  // 列4: 金矿
  const goldNode = { id: nextId(), ...NODE_TYPES.goldMine, col: cols - 1, row: 1 };
  nodes.push(goldNode);

  const startNodeId = campNode.id;
  const goldNodeId = goldNode.id;

  // 中间列 (1-3) 放置节点
  // 随机决定每列放几个节点 (1~row个)
  const middleNodes = [];
  for (let col = 1; col < cols - 1; col++) {
    const count = randInt(1, rows);
    const selectedRows = shuffle([0, 1, 2]).slice(0, count);
    for (const row of selectedRows) {
      const isGoldRow = row === 1;
      let type;
      if (isGoldRow && col === cols - 2) {
        type = { ...NODE_TYPES.desert }; // 金矿前一格固定沙漠
      } else {
        type = pickNodeType(diff, col);
      }
      const node = { id: nextId(), ...type, col, row };
      nodes.push(node);
      middleNodes.push(node);
    }
  }

  // 连接边：相邻列之间随机连
  const nodesByCol = {};
  for (const n of nodes) {
    if (!nodesByCol[n.col]) nodesByCol[n.col] = [];
    nodesByCol[n.col].push(n);
  }

  for (let col = 0; col < cols - 1; col++) {
    const leftNodes = nodesByCol[col] || [];
    const rightNodes = nodesByCol[col + 1] || [];

    // 每个右侧节点至少连一个左侧节点
    for (const rn of rightNodes) {
      const nearest = leftNodes.reduce((a, b) =>
        Math.abs(a.row - rn.row) < Math.abs(b.row - rn.row) ? a : b
      );
      edges.push({ from: nearest.id, to: rn.id });
    }

    // 随机加一些对角边
    if (leftNodes.length > 1 && rightNodes.length > 1) {
      const extraCount = randInt(0, Math.min(leftNodes.length, rightNodes.length) - 1);
      const shuffled = shuffle([...leftNodes]);
      for (let i = 0; i < extraCount; i++) {
        const target = rightNodes[randInt(0, rightNodes.length - 1)];
        if (!edges.some(e => e.from === shuffled[i].id && e.to === target.id)) {
          edges.push({ from: shuffled[i].id, to: target.id });
        }
      }
    }
  }

  // BFS 验证连通性
  const adj = {};
  for (const e of edges) {
    if (!adj[e.from]) adj[e.from] = [];
    if (!adj[e.to]) adj[e.to] = [];
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  }
  const visited = new Set();
  const queue = [startNodeId];
  visited.add(startNodeId);
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of (adj[cur] || [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
    }
  }
  if (!visited.has(goldNodeId)) {
    // 回退：直接连一条最短路径
    let cur = campNode;
    for (let col = 1; col <= cols - 1; col++) {
      const nextNodes = nodesByCol[col].filter(n => !visited.has(n.id));
      if (nextNodes.length === 0) {
        const allCol = nodesByCol[col];
        const target = allCol[randInt(0, allCol.length - 1)];
        edges.push({ from: cur.id, to: target.id });
        cur = target;
      } else {
        const target = nextNodes[randInt(0, nextNodes.length - 1)];
        edges.push({ from: cur.id, to: target.id });
        cur = target;
        visited.add(target.id);
      }
    }
  }

  // 最终计算坐标
  for (const n of nodes) {
    n.x = margin + n.col * cellW + (Math.random() - 0.5) * 30;
    n.y = margin + n.row * cellH + (Math.random() - 0.5) * 25;
  }

  return { nodes, edges, startNodeId, goldNodeId };
}

function pickNodeType(diff, col) {
  const roll = Math.random();
  // 难度影响绿洲和沙暴数量：diff=1 (easy) → 多绿洲少沙暴，diff=3 (hard) → 反之
  const oasisWeight = 0.25 - (diff - 2) * 0.1;
  const sandstormWeight = 0.1 + (diff - 2) * 0.1;

  if (roll < oasisWeight) return { ...NODE_TYPES.oasis };
  if (roll < oasisWeight + sandstormWeight) return { ...NODE_TYPES.sandstorm };
  if (roll < oasisWeight + sandstormWeight + 0.15) return { ...NODE_TYPES.ruins };
  if (roll < oasisWeight + sandstormWeight + 0.25) return { ...NODE_TYPES.caravan };
  return { ...NODE_TYPES.desert };
}

export function getAdjacentNodes(map, nodeId) {
  const neighbors = [];
  for (const e of map.edges) {
    if (e.from === nodeId) neighbors.push(e.to);
    if (e.to === nodeId) neighbors.push(e.from);
  }
  return neighbors;
}

export function getNodeById(map, nodeId) {
  return map.nodes.find(n => n.id === nodeId);
}
```

- [ ] **Step 2: 添加 Canvas 渲染函数**

```js
export function renderMap(canvas, map, state) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  // 背景
  ctx.fillStyle = '#1a1625';
  ctx.fillRect(0, 0, w, h);

  // 画边
  for (const e of map.edges) {
    const from = map.nodes.find(n => n.id === e.from);
    const to = map.nodes.find(n => n.id === e.to);
    if (!from || !to) continue;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = '#3a3348';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 箭头
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillStyle = '#5a4a6a';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 画节点
  const playerPos = state.player.position;
  for (const n of map.nodes) {
    const isPlayer = n.id === playerPos;
    const radius = isPlayer ? 30 : 24;

    // 外圈光晕 (玩家位置)
    if (isPlayer) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 192, 64, 0.3)';
      ctx.fill();
    }

    // 节点圆
    const gradient = ctx.createRadialGradient(n.x - 3, n.y - 3, 2, n.x, n.y, radius);
    if (n.type === 'sandstorm') {
      gradient.addColorStop(0, '#6a4a3a');
      gradient.addColorStop(1, '#3a2010');
    } else if (n.type === 'oasis') {
      gradient.addColorStop(0, '#5ab0d0');
      gradient.addColorStop(1, '#2a6080');
    } else if (n.type === 'goldMine') {
      gradient.addColorStop(0, '#f0c040');
      gradient.addColorStop(1, '#8a6020');
    } else if (n.type === 'camp') {
      gradient.addColorStop(0, '#60b060');
      gradient.addColorStop(1, '#2a6030');
    } else if (n.type === 'caravan') {
      gradient.addColorStop(0, '#c0a060');
      gradient.addColorStop(1, '#604020');
    } else if (n.type === 'ruins') {
      gradient.addColorStop(0, '#a09080');
      gradient.addColorStop(1, '#504030');
    } else {
      gradient.addColorStop(0, '#d0c090');
      gradient.addColorStop(1, '#605020');
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = isPlayer ? '#f0c040' : '#5a4a6a';
    ctx.lineWidth = isPlayer ? 3 : 2;
    ctx.stroke();

    // emoji 图标
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.icon, n.x, n.y);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add js/map.js
git commit -m "feat: add map generation and canvas rendering"
```

---

### Task 4: 随机事件系统

**Files:**
- Create: `js/events.js`

- [ ] **Step 1: 创建 js/events.js 定义事件池**

```js
export const EVENTS = {
  good: [
    { id: 'found_water',   name: '发现水源',    desc: '你在沙丘后发现了一处隐蔽的水源！', effect: { water: 2 } },
    { id: 'cactus_fruit',  name: '仙人掌果实',  desc: '路边一株仙人掌结满了果实。',        effect: { food: 2 } },
    { id: 'kind_traveler', name: '好心旅人',    desc: '路过的旅人分享了干粮和金币。',       effect: { coins: 20 } },
    { id: 'abandoned_camp',name: '废弃营地',    desc: '你找到了一个废弃的营地，可以免费扎营。', effect: { tent: 1 } },
    { id: 'clear_sky',     name: '晴天微风',    desc: '今天天气极好，行走特别轻松。',       effect: { freeStep: true } },
  ],
  neutral: [
    { id: 'minecart',      name: '废弃矿车',    desc: '一辆破旧的矿车躺在沙中...',          effect: { coins: 15 }, chance: 0.5, failDesc: '矿车是空的，什么也没有。' },
    { id: 'shortcut',      name: '岔路发现',    desc: '你发现了一条被遗忘的捷径！',          effect: { shortcut: true } },
    { id: 'lookout',       name: '沙丘瞭望',    desc: '登上沙丘，你看到了周围的地形...',     effect: { reveal: 2 } },
    { id: 'nothing',       name: '空无一物',    desc: '放眼望去，只有无尽的黄沙...',         effect: {} },
  ],
  bad: [
    { id: 'sandstorm',     name: '沙暴来袭',    desc: '狂风卷起漫天黄沙！',                  effect: { water: -2, food: -1, hp: -15 } },
    { id: 'bandits',       name: '遭遇强盗',    desc: '一伙强盗挡住了去路！',                effect: { coins: -25 }, orEffect: { hp: -20 }, orDesc: '你选择反抗，被打伤了...' },
    { id: 'scorpion',      name: '毒蝎蛰伤',    desc: '一只毒蝎从沙中窜出！',                effect: { hp: -25 } },
    { id: 'lost',          name: '迷路',        desc: '你在沙暴中迷失了方向...',             effect: { stamina: -1, retreat: true } },
    { id: 'broken_bag',   name: '水袋破损',    desc: '你不小心摔破了水袋！',                effect: { water: -3 } },
    { id: 'heatstroke',    name: '中暑',        desc: '烈日当头，你感到头晕目眩...',         effect: { hp: -15, stamina: -1 } },
  ],
};

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
```

- [ ] **Step 2: 实现事件触发逻辑**

```js
import { NODE_TYPES } from './map.js';
import { DIFFICULTIES, CHARACTERS, addLog } from './game.js';

/**
 * 根据当前节点和难度决定事件类型，返回事件对象
 */
export function triggerEvent(state) {
  const node = state.map.nodes.find(n => n.id === state.player.position);
  if (!node || node.eventChance === 0) return null;
  if (Math.random() > node.eventChance) return null;

  const diff = DIFFICULTIES[state.difficulty];
  const goodWeight = 0.40 + (diff.goodEventBias || 0) + (node.goodBias || 0);
  const badWeight = 0.35 - (diff.goodEventBias || 0) - (node.goodBias || 0);
  const neutralWeight = 1 - goodWeight - badWeight;

  const roll = Math.random();
  let category;
  if (roll < goodWeight) category = 'good';
  else if (roll < goodWeight + neutralWeight) category = 'neutral';
  else category = 'bad';

  const pool = EVENTS[category];
  const event = pool[Math.floor(Math.random() * pool.length)];

  // 中性事件有概率判定
  if (event.chance !== undefined && Math.random() > event.chance) {
    addLog(state, `📋 ${event.name}: ${event.failDesc || '什么也没有发生。'}`);
    return null;
  }

  return { ...event, category };
}

/**
 * 应用事件效果到玩家
 */
export function applyEvent(state, event) {
  if (!event) return;
  const p = state.player;
  addLog(state, `${event.category === 'good' ? '🎉' : event.category === 'bad' ? '😨' : '📋'} ${event.name}: ${event.desc}`);

  // 战斗事件：老兵必胜
  const char = CHARACTERS[p.character];
  if (event.id === 'bandits' && char.effect?.combatWin) {
    addLog(state, '👊 作为老兵，你轻松击退了强盗！');
    return;
  }

  const eff = event.effect;
  if (eff.water)  p.water  = clamp(p.water + eff.water, 0, 999);
  if (eff.food)   p.food   = clamp(p.food + eff.food, 0, 999);
  if (eff.hp)     p.hp     = clamp(p.hp + eff.hp, 0, p.maxHp);
  if (eff.coins)  p.coins  = clamp(p.coins + eff.coins, 0, 9999);
  if (eff.stamina) p.stamina = clamp(p.stamina + eff.stamina, 0, p.maxStamina);

  if (eff.tent) {
    p.stamina = p.maxStamina;
    addLog(state, '⛺ 你扎营休息，体力完全恢复！');
  }

  if (eff.retreat && state.player.visitedNodes.length > 1) {
    const prevNodeId = state.player.visitedNodes[state.player.visitedNodes.length - 2];
    state.player.position = prevNodeId;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add js/events.js
git commit -m "feat: add random event system"
```

---

### Task 5: 商店系统

**Files:**
- Create: `js/shop.js`

- [ ] **Step 1: 创建 js/shop.js**

```js
import { ITEM_TEMPLATES } from './game.js';

/**
 * 获取商店商品列表（营地固定价，商队有浮动）
 */
export function getShopItems(location = 'camp') {
  const items = Object.values(ITEM_TEMPLATES).map(item => {
    let price = item.price;
    if (location === 'caravan') {
      // 商队价格在 60%-140% 浮动
      price = Math.round(item.price * (0.6 + Math.random() * 0.8));
    }
    return { ...item, price };
  });

  // 商队只卖部分物品
  if (location === 'caravan') {
    return items.filter(i => ['water_bag', 'dried_food', 'medicine', 'tent'].includes(i.id));
  }

  return items;
}

/**
 * 购买道具
 * @returns {{ success: boolean, message: string }}
 */
export function buyItem(state, itemId, location = 'camp') {
  const template = ITEM_TEMPLATES[itemId];
  if (!template) return { success: false, message: '未知道具' };

  let price = template.price;
  if (location === 'caravan') {
    price = Math.round(template.price * (0.6 + Math.random() * 0.8));
  }

  if (state.player.coins < price) {
    return { success: false, message: '金币不足！' };
  }

  // unique 道具不可重复购买
  if (template.unique && state.player.items.some(i => i.id === itemId)) {
    return { success: false, message: '你已经拥有该道具了！' };
  }

  state.player.coins -= price;
  state.player.items.push({ id: itemId, ...template });
  return { success: true, message: `购买了 ${template.name}，花费 ${price} 💰` };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/shop.js
git commit -m "feat: add shop system"
```

---

### Task 6: 存档系统

**Files:**
- Create: `js/storage.js`

- [ ] **Step 1: 创建 js/storage.js**

```js
const SAVE_KEY = 'sahaijin_save';
const REPUTATION_KEY = 'sahaijin_reputation';

/**
 * 声望数据结构
 */
export function createReputation() {
  return {
    totalReputation: 0,
    unlockedCharacters: ['explorer'],
    unlockedItems: [],
    stats: { gamesPlayed: 0, wins: 0, deaths: 0, totalGoldMined: 0 },
  };
}

export function loadReputation() {
  try {
    const raw = localStorage.getItem(REPUTATION_KEY);
    if (!raw) return createReputation();
    const data = JSON.parse(raw);
    return { ...createReputation(), ...data };
  } catch {
    return createReputation();
  }
}

export function saveReputation(rep) {
  localStorage.setItem(REPUTATION_KEY, JSON.stringify(rep));
}

export function saveGame(state) {
  const saveData = {
    phase: state.phase,
    difficulty: state.difficulty,
    player: state.player,
    map: state.map,
    log: state.log.slice(-20),
    turn: state.turn,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * 结算声望并保存
 */
export function settleReputation(state) {
  const rep = loadReputation();
  const p = state.player;
  const diff = state.difficulty;

  const difficultyMultipliers = { easy: 1.0, normal: 1.2, hard: 1.5 };

  let earned = 0;
  if (state.phase === 'win') {
    earned += 50; // 活着回来
    earned += Math.floor(p.coins / 10);  // 带回金币
    earned += p.water * 2;
    earned += p.food * 2;
    earned += p.items.length * 5;
    earned += p.visitedNodes.length * 3;
  }
  earned = Math.floor(earned * (difficultyMultipliers[diff] || 1));

  rep.totalReputation += earned;
  rep.stats.gamesPlayed++;
  if (state.phase === 'win') rep.stats.wins++;
  else rep.stats.deaths++;
  rep.stats.totalGoldMined += (state.player._goldMined || 0);

  saveReputation(rep);
  return { earned, rep };
}

/**
 * 解锁角色
 */
import { CHARACTERS } from './game.js';

export function unlockCharacter(rep, characterId) {
  const char = CHARACTERS[characterId];
  if (!char || rep.totalReputation < char.cost) return { success: false, message: '声望不足' };
  if (rep.unlockedCharacters.includes(characterId)) return { success: false, message: '已解锁' };

  rep.totalReputation -= char.cost;
  rep.unlockedCharacters.push(characterId);
  saveReputation(rep);
  return { success: true, message: `解锁了 ${char.name}！` };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/storage.js
git commit -m "feat: add save/load and reputation system"
```

---

### Task 7: 主控制逻辑 (main.js)

**Files:**
- Create: `js/main.js`

**说明：** 串联所有模块，处理 UI 事件（开始游戏、移动、购买、事件交互），驱动游戏循环。

- [ ] **Step 1: 创建 js/main.js 初始化入口**

```js
import { createGameState, DIFFICULTIES, CHARACTERS, ITEM_TEMPLATES, addLog, setPhase, consumeStepResources, checkDead, checkWin } from './game.js';
import { generateMap, renderMap, getAdjacentNodes, getNodeById } from './map.js';
import { triggerEvent, applyEvent } from './events.js';
import { getShopItems, buyItem } from './shop.js';
import { saveGame, loadGame, clearSave, loadReputation, saveReputation, settleReputation } from './storage.js';

let state = null;
let reputation = null;
let chosenCharacter = 'explorer';
let chosenDifficulty = 'normal';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

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
  const p = state.player;
  difficultyDisplay.textContent = `难度: ${DIFFICULTIES[state.difficulty].label}`;
  coinsDisplay.textContent = `💰 ${p.coins}`;
  resourceWater.textContent = `💧 水: ${Math.max(0, p.water)}`;
  resourceFood.textContent = `🍖 食物: ${Math.max(0, p.food)}`;
  resourceHp.textContent = `❤️ HP: ${Math.max(0, p.hp)}/${p.maxHp}`;
  resourceStamina.textContent = `⚡ 体力: ${Math.max(0, p.stamina)}/${p.maxStamina}`;

  // 道具列表
  if (p.items.length === 0) {
    itemsList.innerHTML = '<span style="color:var(--text-dim)">空空如也</span>';
  } else {
    itemsList.innerHTML = p.items.map(i => {
      const tpl = ITEM_TEMPLATES[i.id] || {};
      return `<div style="padding:2px 0;display:flex;gap:4px;align-items:center" title="${tpl.name || i.id}">${tpl.icon || '📦'} ${tpl.name || i.id}${i._uses ? ` x${i._uses}` : ''}</div>`;
    }).join('');
  }

  // 行动按钮
  renderActionButtons();

  // 日志
  logContent.textContent = '📋 ' + (state.log.length > 0 ? state.log[state.log.length - 1] : '欢迎来到沙海淘金！');

  // Canvas 重绘
  if (state.map) renderMap(canvas, state.map, state);
}

function renderActionButtons() {
  const p = state.player;
  let html = '';

  if (state.phase === 'prepare') {
    html += '<button onclick="window._openShop(\'camp\')">🛒 购买物资</button>';
    html += '<button class="primary" onclick="window._startTravel()">🚶 出发！</button>';
  }

  if (state.phase === 'travel') {
    const adj = getAdjacentNodes(state.map, p.position);
    for (const nid of adj) {
      const node = getNodeById(state.map, nid);
      html += `<button onclick="window._moveTo(${nid})">➡️ 前往 ${node.icon} ${node.label}</button>`;
    }
    // 扎营（如果有帐篷）
    if (p.items.some(i => i.id === 'tent')) {
      html += '<button onclick="window._useTent()">⛺ 扎营休息</button>';
    }
    // 使用消耗品
    for (const item of p.items) {
      if (item.id === 'medicine') {
        html += `<button onclick="window._useItem('${item.id}')">💊 使用药品</button>`;
      }
      if (item.id === 'water_bag') {
        html += `<button onclick="window._useItem('${item.id}')">💧 使用水袋</button>`;
      }
      if (item.id === 'dried_food') {
        html += `<button onclick="window._useItem('${item.id}')">🍖 食用干粮</button>`;
      }
      if (item.id === 'compass') {
        html += `<button onclick="window._useCompass()">🧭 使用指南针</button>`;
      }
      if (item.id === 'fuel') {
        html += `<button onclick="window._useFuel()">⛽ 使用燃油</button>`;
      }
    }
  }

  if (state.phase === 'mining') {
    html += '<button class="primary" onclick="window._mineGold()">⛏️ 挖金！</button>';
  }

  if (state.phase === 'returning') {
    const adj = getAdjacentNodes(state.map, p.position);
    for (const nid of adj) {
      const node = getNodeById(state.map, nid);
      html += `<button onclick="window._moveTo(${nid})">➡️ 前往 ${node.icon} ${node.label}</button>`;
    }
    if (p.items.some(i => i.id === 'tent')) {
      html += '<button onclick="window._useTent()">⛺ 扎营休息</button>';
    }
  }

  if (state.phase === 'win') {
    html += `<div style="color:var(--gold);text-align:center;padding:8px">🎉 胜利！</div>`;
    html += `<div style="font-size:12px;color:var(--text-dim)">获得声望: +${state.reputationEarned}</div>`;
    html += '<button class="primary" onclick="window._showStartScreen()">🔄 再来一局</button>';
  }

  if (state.phase === 'dead') {
    html += `<div style="color:var(--danger);text-align:center;padding:8px">💀 你死了...</div>`;
    html += '<button class="primary" onclick="window._showStartScreen()">🔄 重新开始</button>';
  }

  actionButtons.innerHTML = html;
}
```

- [ ] **Step 2: 实现移动和游戏逻辑**

```js
function moveTo(nodeId) {
  if (state.phase !== 'travel' && state.phase !== 'returning') return;

  const p = state.player;
  const targetNode = getNodeById(state.map, nodeId);
  if (!targetNode) return;

  // 检查体力
  const staminaCost = p.items.some(i => i.id === 'camel') ? 0.5 : 1;
  if (p.stamina < staminaCost) {
    addLog(state, '⚡ 体力不足，无法移动！请扎营休息。');
    updateUI();
    return;
  }

  // 燃油效果
  if (p._fuelSteps > 0) {
    p._fuelSteps--;
    addLog(state, `⛽ 燃油驱动，本步不耗体力 (剩余 ${p._fuelSteps} 步)`);
    p.stamina = Math.max(0, p.stamina);
  } else {
    const { waterCost, foodCost } = consumeStepResources(state);
    addLog(state, `消耗 💧${waterCost} 🍖${foodCost}`);
  }

  // 移动
  p.visitedNodes.push(nodeId);
  p.position = nodeId;
  state.turn++;

  // 检查死亡
  if (checkDead(state)) {
    saveReputation(reputation);
    updateUI();
    return;
  }

  // 节点逻辑
  if (targetNode.type === 'camp') {
    if (p.atGoldMine) {
      // 回到营地
      const result = settleReputation(state);
      state.reputationEarned = result.earned;
      setPhase(state, 'win');
      addLog(state, '🎉 你成功带着金子回到了营地！');
    } else {
      addLog(state, '你回到了营地。');
    }
  } else if (targetNode.type === 'goldMine') {
    setPhase(state, 'mining');
    p.atGoldMine = true;
    addLog(state, '你到达了金矿！准备挖金。');
  } else if (targetNode.type === 'oasis') {
    // 绿洲补水
    const bonus = p.items.some(i => i.id === 'tablet') ? 4 : 2;
    const actualBonus = Math.min(bonus, p.items.some(i => i.id === 'tablet') ? 4 : 2);
    p.water += actualBonus;
    addLog(state, `💧 在绿洲补充了 ${actualBonus} 水！`);
    // 绿洲也触发事件
    const event = triggerEvent(state);
    if (event) applyEvent(state, event);
  } else if (targetNode.type === 'caravan') {
    addLog(state, '🐪 你遇到了商队，可以交易物资。');
    openShop('caravan');
  } else if (targetNode.type === 'ruins') {
    addLog(state, '🏚️ 你探索了废墟...');
    const loot = Math.random() > 0.5 ? { coins: 15 } : { item: 'medicine' };
    if (loot.coins) {
      p.coins += loot.coins;
      addLog(state, `找到了 ${loot.coins} 💰！`);
    }
    const event = triggerEvent(state);
    if (event) applyEvent(state, event);
  } else {
    // 沙漠/沙暴：触发事件
    const event = triggerEvent(state);
    if (event) applyEvent(state, event);
  }

  // 再次检查死亡
  checkDead(state);

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
  if (tpl.effect.water) p.water += tpl.effect.water;
  if (tpl.effect.food) p.food += tpl.effect.food;
  if (tpl.effect.hp) p.hp = Math.min(p.maxHp, p.hp + tpl.effect.hp);
  addLog(state, `使用了 ${tpl.name}！`);
  updateUI();
}

function useCompass() {
  const p = state.player;
  const idx = p.items.findIndex(i => i.id === 'compass');
  if (idx === -1) return;
  p.items.splice(idx, 1);
  const adj = getAdjacentNodes(state.map, p.position);
  const info = adj.map(nid => {
    const n = getNodeById(state.map, nid);
    return `${n.icon}${n.label}`;
  }).join(' | ');
  addLog(state, `🧭 指南针显示相邻节点: ${info}`);
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
  const char = CHARACTERS[p.character];
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

// === 全局函数暴露给 onclick ===
window._moveTo = moveTo;
window._useTent = useTent;
window._useItem = useItem;
window._useCompass = useCompass;
window._useFuel = useFuel;
window._mineGold = mineGold;
```

- [ ] **Step 3: 实现弹窗（开始画面 / 商店）**

```js
function showModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove('hidden');
}

function hideModal() {
  modalOverlay.classList.add('hidden');
}

window._hideModal = hideModal;

function showStartScreen() {
  const rep = loadReputation();
  reputation = rep;
  clearSave();

  const charOptions = Object.values(CHARACTERS).map(c => {
    const unlocked = rep.unlockedCharacters.includes(c.id);
    return `
      <div style="padding:8px;margin:4px 0;background:var(--bg);border-radius:8px;cursor:pointer;border:2px solid ${chosenCharacter === c.id ? 'var(--gold)' : 'transparent'}"
           onclick="window._selectChar('${c.id}')">
        <strong>${c.icon} ${c.name}</strong>
        <span style="float:right;color:var(--text-dim);font-size:12px">${unlocked ? '已解锁' : `🔒 ${c.cost}声望`}</span>
        <div style="font-size:12px;color:var(--text-dim);margin-top:4px">${c.desc}</div>
      </div>
    `;
  }).join('');

  const diffOptions = ['easy', 'normal', 'hard'].map(d => {
    const cfg = DIFFICULTIES[d];
    return `
      <div style="padding:8px;margin:4px 0;background:var(--bg);border-radius:8px;cursor:pointer;border:2px solid ${chosenDifficulty === d ? 'var(--gold)' : 'transparent'}"
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

window._showStartScreen = showStartScreen;
window._selectChar = (id) => { chosenCharacter = id; showStartScreen(); };
window._selectDifficulty = (d) => { chosenDifficulty = d; showStartScreen(); };

function startGame() {
  const rep = loadReputation();
  if (!rep.unlockedCharacters.includes(chosenCharacter)) {
    alert('该角色未解锁！');
    return;
  }
  hideModal();
  state = createGameState(chosenDifficulty, chosenCharacter);
  state.player.coins = DIFFICULTIES[chosenDifficulty].startCoins;
  state.map = generateMap(chosenDifficulty);
  state.player.position = state.map.startNodeId;
  state.player.visitedNodes = [state.map.startNodeId];
  setPhase(state, 'prepare');
  addLog(state, `🟢 你选择了「${CHARACTERS[chosenCharacter].name}」，准备出发！`);
  saveGame(state);
  updateUI();
}

window._startGame = startGame;

function openShop(location) {
  const items = getShopItems(location);
  const playerItems = state.player.items;
  const html = `
    <h2>${location === 'camp' ? '🏕️ 营地商店' : '🐪 商队交易'}</h2>
    <div style="margin-bottom:8px;color:var(--gold)">💰 持有金币: ${state.player.coins}</div>
    ${items.map(item => {
      const owned = playerItems.some(i => i.id === item.id && item.unique);
      return `
        <div style="padding:10px;margin:4px 0;background:var(--bg);border-radius:8px;display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">${item.icon}</span>
          <div style="flex:1">
            <strong>${item.name}</strong>
            <div style="font-size:12px;color:var(--text-dim)">${describeEffect(item.effect)}</div>
          </div>
          <span style="color:var(--gold)">💰${item.price}</span>
          <button ${owned ? 'disabled' : ''} onclick="window._buy('${item.id}', '${location}')">
            ${owned ? '已有' : '购买'}
          </button>
        </div>
      `;
    }).join('')}
    <button onclick="window._hideModal()" style="margin-top:8px;width:100%">关闭</button>
  `;
  showModal(html);
}

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

window._openShop = (loc) => openShop(loc);
window._buy = (itemId, location) => {
  const result = buyItem(state, itemId, location);
  addLog(state, result.message);
  openShop(location);
  updateUI();
};

window._startTravel = () => {
  setPhase(state, 'travel');
  addLog(state, '🚶 你踏上了寻金之旅...');
  updateUI();
};

// === 恢复存档 ===
function tryResume() {
  const saved = loadGame();
  if (!saved || saved.phase === 'win' || saved.phase === 'dead') return false;

  const rep = loadReputation();
  reputation = rep;

  showModal(`
    <h2>📂 有未完成的存档</h2>
    <p style="color:var(--text-dim)">角色: ${CHARACTERS[saved.player.character]?.name || '未知'} | 难度: ${DIFFICULTIES[saved.difficulty]?.label || '?'}</p>
    <p style="color:var(--text-dim)">回合: ${saved.turn} | 位置: ${saved.map ? getNodeById(saved.map, saved.player.position)?.label || '?' : '?'}</p>
    <button class="primary" onclick="window._resumeGame()" style="width:100%;margin-bottom:8px">▶️ 继续游戏</button>
    <button onclick="window._newGame()" style="width:100%">🆕 新游戏</button>
  `);
  return true;
}

window._resumeGame = () => {
  const saved = loadGame();
  state = createGameState(saved.difficulty, saved.player.character);
  Object.assign(state, saved);
  reputation = loadReputation();
  hideModal();
  updateUI();
};

window._newGame = () => {
  clearSave();
  hideModal();
  showStartScreen();
};

// === 初始化 ===
function init() {
  reputation = loadReputation();
  if (!tryResume()) {
    showStartScreen();
  }
}

init();
```

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: add main game logic and UI integration"
```

---

### Task 8: 完善 CSS 视觉效果

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: 补充动画、饱和度、节点悬停等细节样式**

在现有 `style.css` 后面追加：

```css
/* 按钮动画 */
button {
  transition: all 0.2s ease;
}

button:active {
  transform: scale(0.95);
}

/* HP 条 */
.hp-bar {
  width: 100%;
  height: 6px;
  background: #3a2030;
  border-radius: 3px;
  margin-top: 2px;
  overflow: hidden;
}
.hp-bar-fill {
  height: 100%;
  background: var(--hp);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 资源面板数值颜色 */
#resource-water span { color: var(--water); }
#resource-food span { color: var(--food); }
#resource-hp span { color: var(--hp); }
#resource-stamina span { color: var(--stamina); }

/* 道具列表项 */
#items-list > div {
  transition: background 0.2s;
  border-radius: 6px;
  padding: 4px 6px;
}
#items-list > div:hover {
  background: var(--panel-border);
}

/* 弹窗动画 */
.modal-overlay {
  animation: fadeIn 0.2s ease;
}

.modal-box {
  animation: slideUp 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 响应式：小屏幕侧栏缩小 */
@media (max-width: 700px) {
  #sidebar {
    width: 160px;
    font-size: 12px;
  }
}

/* 按钮组样式 */
#action-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#action-buttons button {
  width: 100%;
  text-align: left;
}
```

- [ ] **Step 2: 优化资源显示为带进度条**

修改 `index.html` 中的资源面板，使其包含进度条：

```html
<div id="resources-panel" class="panel">
  <h2>资源</h2>
  <div id="resource-water">💧 水: <span>5</span></div>
  <div id="resource-food">🍖 食物: <span>5</span></div>
  <div id="resource-hp">
    ❤️ HP: <span>100/100</span>
    <div class="hp-bar"><div class="hp-bar-fill" style="width:100%"></div></div>
  </div>
  <div id="resource-stamina">⚡ 体力: <span>5/5</span></div>
</div>
```

- [ ] **Step 3: 更新 updateUI 中的 HP 条和体力条**

修改 `js/main.js` 中的 `updateUI`：

```js
// 在 updateUI 中，替换 resourceHp 的更新：
const hpPercent = Math.max(0, p.hp) / p.maxHp * 100;
resourceHp.innerHTML = `❤️ HP: <span>${Math.max(0, p.hp)}/${p.maxHp}</span> <div class="hp-bar"><div class="hp-bar-fill" style="width:${hpPercent}%"></div></div>`;

// 替换 resourceStamina:
const staminaPercent = Math.max(0, p.stamina) / p.maxStamina * 100;
resourceStamina.innerHTML = `⚡ 体力: <span>${Math.max(0, p.stamina)}/${p.maxStamina}</span> <div class="hp-bar"><div class="hp-bar-fill" style="width:${staminaPercent}%;background:var(--stamina)"></div></div>`;
```

- [ ] **Step 4: Commit**

```bash
git add css/style.css index.html js/main.js
git commit -m "feat: add visual polish, HP bar and animations"
```

---

### Task 9: 测试与修复

**Files:** 无新建，验证所有已有文件。

- [ ] **Step 1: 用简单 HTTP 服务器启动并测试**

```bash
cd /mnt/f/gameDemo && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

验证流程：
1. 开始画面正常显示，选择角色和难度
2. 点击开始游戏，地图 Canvas 正常绘制
3. 资源面板显示正确
4. 点击购买物资，商店弹窗打开，购买水袋
5. 点击出发，进入旅行阶段
6. 点击相邻节点移动，资源和体力正常消耗
7. 遇到事件弹窗或日志显示
8. 到达金矿，挖金
9. 返回营地，结算声望
10. 死亡时显示重开按钮
11. 刷新页面，存档恢复弹窗出现

- [ ] **Step 2: 修复发现的问题后 Commit**

```bash
git add -A
git commit -m "fix: bugs found during testing"
```

---

## 自检清单

- [x] 资源系统 (水/食物/HP/体力/金币) — Task 2 + Task 7
- [x] 难度系统 — Task 1 (constants) + Task 3 (map gen) + Task 7 (UI)
- [x] 节点类型 — Task 3 (map gen)
- [x] 道具系统 — Task 5 (shop) + Task 7 (use items)
- [x] 随机事件 — Task 4 (events)
- [x] 声望跨局成长 — Task 6 (storage) + Task 7 (settle)
- [x] Canvas 地图渲染 — Task 3 (renderMap)
- [x] 存档恢复 — Task 6 + Task 7 (tryResume)
- [x] UI 交互 — Task 7 (all button logic)
- [x] 视觉动画 — Task 8 (CSS polish)
