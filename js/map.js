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

function pickNodeType(diff) {
  const roll = Math.random();
  // diff: 1=easy, 2=normal, 3=hard
  const oasisWeight = 0.25 - (diff - 2) * 0.1;
  const sandstormWeight = 0.1 + (diff - 2) * 0.1;

  if (roll < oasisWeight) return { ...NODE_TYPES.oasis };
  if (roll < oasisWeight + sandstormWeight) return { ...NODE_TYPES.sandstorm };
  if (roll < oasisWeight + sandstormWeight + 0.15) return { ...NODE_TYPES.ruins };
  if (roll < oasisWeight + sandstormWeight + 0.25) return { ...NODE_TYPES.caravan };
  return { ...NODE_TYPES.desert };
}

/**
 * 生成地图节点和边
 */
export function generateMap(difficulty = 'normal', canvasWidth = 800, canvasHeight = 500) {
  const diffMap = { easy: 1, normal: 2, hard: 3 };
  const diff = diffMap[difficulty] || 2;
  const nodes = [];
  const edges = [];

  const margin = 50;
  const cols = 8;
  const rows = 5;
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
  for (let col = 1; col < cols - 1; col++) {
    const count = randInt(1, rows);
    const selectedRows = shuffle(Array.from({ length: rows }, (_, i) => i)).slice(0, count);
    for (const row of selectedRows) {
      let type = pickNodeType(diff);
      const node = { id: nextId(), ...type, col, row };
      nodes.push(node);
    }
  }

  // 连接边：相邻列之间连接
  const nodesByCol = {};
  for (const n of nodes) {
    if (!nodesByCol[n.col]) nodesByCol[n.col] = [];
    nodesByCol[n.col].push(n);
  }

  for (let col = 0; col < cols - 1; col++) {
    const leftNodes = nodesByCol[col] || [];
    const rightNodes = nodesByCol[col + 1] || [];

    for (const rn of rightNodes) {
      const nearest = leftNodes.reduce((a, b) =>
        Math.abs(a.row - rn.row) < Math.abs(b.row - rn.row) ? a : b
      );
      edges.push({ from: nearest.id, to: rn.id });
    }

    // 随机加对角边
    if (leftNodes.length > 1 && rightNodes.length > 1) {
      const extraCount = randInt(0, Math.min(leftNodes.length, rightNodes.length) - 1);
      const shuffledLeft = shuffle([...leftNodes]);
      for (let i = 0; i < extraCount; i++) {
        const target = rightNodes[randInt(0, rightNodes.length - 1)];
        if (!edges.some(e => e.from === shuffledLeft[i].id && e.to === target.id)) {
          edges.push({ from: shuffledLeft[i].id, to: target.id });
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
    // 回退：补充路径
    let cur = campNode;
    const allCols = Object.keys(nodesByCol).map(Number).filter(c => c > 0);
    for (const col of allCols) {
      const colNodes = nodesByCol[col] || [];
      if (colNodes.length === 0) continue;
      const target = colNodes.find(n => visited.has(n.id)) || colNodes[randInt(0, colNodes.length - 1)];
      edges.push({ from: cur.id, to: target.id });
      cur = target;
      visited.add(target.id);
    }
    if (!visited.has(goldNodeId)) {
      edges.push({ from: cur.id, to: goldNodeId });
    }
  }

  // 计算坐标
  for (const n of nodes) {
    n.x = margin + n.col * cellW + (Math.random() - 0.5) * 30;
    n.y = margin + n.row * cellH + (Math.random() - 0.5) * 25;
  }

  return { nodes, edges, startNodeId, goldNodeId };
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

export function getNodesInRange(map, nodeId, range) {
  if (range <= 0) return [nodeId];
  const adjMap = {};
  for (const e of map.edges) {
    if (!adjMap[e.from]) adjMap[e.from] = [];
    if (!adjMap[e.to]) adjMap[e.to] = [];
    adjMap[e.from].push(e.to);
    adjMap[e.to].push(e.from);
  }
  const result = new Set([nodeId]);
  let frontier = new Set([nodeId]);
  for (let d = 0; d < range; d++) {
    const next = new Set();
    for (const nid of frontier) {
      for (const nb of (adjMap[nid] || [])) {
        if (!result.has(nb)) { result.add(nb); next.add(nb); }
      }
    }
    frontier = next;
  }
  return [...result];
}

export function renderMap(canvas, map, state, revealedNodes = null) {
  if (!canvas || !map || !map.nodes || !map.edges) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const sx = w / 800;
  const sy = h / 500;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0);

  // 背景
  ctx.fillStyle = '#1a1625';
  ctx.fillRect(0, 0, 800, 500);

  // 迷雾过滤
  const isRevealed = (nid) => !revealedNodes || revealedNodes.has(nid);

  // 画边 (仅两端都可见)
  for (const e of map.edges) {
    if (!isRevealed(e.from) && !isRevealed(e.to)) continue;
    const from = map.nodes.find(n => n.id === e.from);
    const to = map.nodes.find(n => n.id === e.to);
    if (!from || !to) continue;

    const bothRevealed = isRevealed(e.from) && isRevealed(e.to);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = bothRevealed ? '#3a3348' : '#252033';
    ctx.lineWidth = bothRevealed ? 3 : 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (bothRevealed) {
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
  }

  // 画节点
  const playerPos = state ? state.player.position : null;
  for (const n of map.nodes) {
    if (!isRevealed(n.id)) {
      // 迷雾节点
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1625';
      ctx.fill();
      ctx.strokeStyle = '#252033';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a3348';
      ctx.fillText('?', n.x, n.y);
      continue;
    }

    const isPlayer = n.id === playerPos;
    const radius = isPlayer ? 28 : 22;

    if (isPlayer) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 192, 64, 0.3)';
      ctx.fill();
    }

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

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.icon, n.x, n.y);
  }
}
