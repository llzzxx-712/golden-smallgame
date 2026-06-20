// 难度配置
export const DIFFICULTIES = {
  easy: {
    label: '简单', oasisCount: 5, goodEventBias: 0.1, startCoins: 300,
    sandstormCount: 2, reputationMultiplier: 1.0
  },
  normal: {
    label: '普通', oasisCount: 3, goodEventBias: 0, startCoins: 200,
    sandstormCount: 4, reputationMultiplier: 1.2
  },
  hard: {
    label: '困难', oasisCount: 2, goodEventBias: -0.1, startCoins: 150,
    sandstormCount: 5, reputationMultiplier: 1.5
  }
};

// 道具模板
export const ITEM_TEMPLATES = {
  water_bag:  { id: 'water_bag',  name: '水袋',  icon: '💧', effect: { water: 3 }, price: 20 },
  dried_food: { id: 'dried_food', name: '干粮',  icon: '🍖', effect: { food: 3 },  price: 20 },
  medicine:   { id: 'medicine',   name: '药品',  icon: '💊', effect: { hp: 30 },    price: 15 },
  camel:      { id: 'camel',      name: '骆驼',  icon: '🐪', effect: { camel: true }, price: 70, permanent: true, unique: true },
  tent:       { id: 'tent',       name: '帐篷',  icon: '⛺', effect: { tentBonus: 1.5 }, price: 35, permanent: true, unique: true },
  compass:    { id: 'compass',    name: '指南针', icon: '🧭', effect: { compass: 1 }, price: 45, permanent: true, unique: true },
  tablet:     { id: 'tablet',     name: '净水片', icon: '💠', effect: { oasisBonus: 2 }, price: 20, permanent: true, unique: true },
  fuel:       { id: 'fuel',       name: '燃油',   icon: '⛽', effect: { fuelSteps: 3 }, price: 25, permanent: true, unique: true },
};

// 角色模板
export const CHARACTERS = {
  explorer:    { id: 'explorer',    name: '探险家',  icon: '🧑', cost: 0,   desc: '标准属性，无特殊能力' },
  geologist:   { id: 'geologist',   name: '地质学家', icon: '👩‍🔬', cost: 80,  desc: '挖金收益 +30%', effect: { goldBonus: 0.3 } },
  nomad:       { id: 'nomad',       name: '游牧民',   icon: '🧕', cost: 100, desc: '水和食物消耗 -20%', effect: { consumeReduce: 0.2 } },
  veteran:     { id: 'veteran',     name: '老兵',     icon: '👨‍🚀', cost: 120, desc: 'HP +30，战斗事件必胜', effect: { hpBonus: 30, combatWin: true } },
};

export function createPlayer(characterId = 'explorer') {
  const char = CHARACTERS[characterId] || CHARACTERS.explorer;
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
    position: null,
    visitedNodes: [],
    atGoldMine: false,
  };
}

export function createGameState(difficulty = 'normal', characterId = 'explorer') {
  const diff = DIFFICULTIES[difficulty];
  return {
    phase: 'init',
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

export function consumeStepResources(state) {
  const p = state.player;
  const char = CHARACTERS[p.character] || CHARACTERS.explorer;
  const reduce = 1 - (char.effect?.consumeReduce || 0);
  const waterCost = Math.floor(1 * reduce);
  const foodCost = Math.floor(1 * reduce);
  p.water = Math.max(-999, p.water - waterCost);
  p.food = Math.max(-999, p.food - foodCost);
  p.stamina = Math.max(-999, p.stamina - (p.items.some(i => i.id === 'camel') ? 0.5 : 1));
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
  if (p.atGoldMine && state.phase === 'returning' && state.map && p.position === state.map.startNodeId) {
    setPhase(state, 'win');
    addLog(state, '🎉 你成功带着金子返回营地！');
    return true;
  }
  return false;
}
