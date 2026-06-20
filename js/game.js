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
  camel:      { id: 'camel',      name: '骆驼',  icon: '🐪', effect: { camel: true }, price: 60, permanent: true, unique: true },
  tent:       { id: 'tent',       name: '帐篷',  icon: '⛺', effect: { tentBonus: 1.5 }, price: 35, permanent: true, unique: true },
  compass:    { id: 'compass',    name: '指南针', icon: '🧭', effect: { compass: 1 }, price: 45, permanent: true, unique: true },
  tablet:     { id: 'tablet',     name: '净水片', icon: '💠', effect: { oasisBonus: 2 }, price: 30, permanent: true, unique: true },
  fuel:       { id: 'fuel',       name: '燃油',   icon: '⛽', effect: { fuelSteps: 3 }, price: 25, permanent: true },
};

// 角色模板
export const CHARACTERS = {
  explorer:    { id: 'explorer',    name: '探险家',  icon: '🧑', cost: 0,   desc: '标准属性，无特殊能力' },
  geologist:   { id: 'geologist',   name: '地质学家', icon: '👩‍🔬', cost: 240, desc: '挖金收益 +30%', effect: { goldBonus: 0.3 } },
  nomad:       { id: 'nomad',       name: '游牧民',   icon: '🧕', cost: 300, desc: '水和食物消耗 -20%', effect: { consumeReduce: 0.2 } },
  veteran:     { id: 'veteran',     name: '老兵',     icon: '👨‍🚀', cost: 360, desc: 'HP +30，战斗事件必胜', effect: { hpBonus: 30, combatWin: true } },
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
    _waterAcc: 0,
    _foodAcc: 0,
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
  const rate = 1 - (char.effect?.consumeReduce || 0);
  p._waterAcc = (p._waterAcc || 0) + rate;
  p._foodAcc = (p._foodAcc || 0) + rate;
  let waterCost = Math.floor(p._waterAcc);
  let foodCost = Math.floor(p._foodAcc);
  p._waterAcc -= waterCost;
  p._foodAcc -= foodCost;

  // 水粮扣减：最多扣到 0，不会为负
  const actualWaterCost = Math.min(waterCost, p.water);
  const actualFoodCost = Math.min(foodCost, p.food);
  p.water -= actualWaterCost;
  p.food -= actualFoodCost;

  p.stamina = Math.max(-999, p.stamina - (p.items.some(i => i.id === 'camel') ? 0.5 : 1));
  return { waterCost: actualWaterCost, foodCost: actualFoodCost };
}

export function checkDead(state) {
  const p = state.player;
  if (p.hp <= 0) { setPhase(state, 'dead'); addLog(state, '💀 你倒在了沙丘上...'); return true; }
  return state.phase === 'dead';
}

export function checkThirstHunger(state) {
  const p = state.player;
  const events = [];

  // 口渴阶段: 1=水刚归零(提醒), 2=-30HP, 3=-60HP, 4=死亡
  if (p.water <= 0) {
    p._thirstStage = (p._thirstStage || 0) + 1;
    if (p._thirstStage >= 4) {
      addLog(state, '💀 你渴死在沙漠中...');
      setPhase(state, 'dead');
      return [];
    }
    if (p._thirstStage === 1) {
      addLog(state, '💧 水已耗尽！请尽快补水...');
    } else {
      const hpLoss = p._thirstStage === 2 ? 30 : 60;
      p.hp = Math.max(0, p.hp - hpLoss);
      events.push({
        name: p._thirstStage === 2 ? '口渴' : '严重缺水',
        desc: p._thirstStage === 2 ? '水已耗尽，你感到口干舌燥...' : '极度缺水，身体正在衰竭...',
        category: 'bad',
        hpLoss,
      });
    }
  } else {
    p._thirstStage = 0;
  }

  // 饥饿阶段: 1=食物刚归零(提醒), 2=-30HP, 3=-60HP, 4=死亡
  if (p.food <= 0) {
    p._hungerStage = (p._hungerStage || 0) + 1;
    if (p._hungerStage >= 4) {
      addLog(state, '💀 你饿死在沙漠中...');
      setPhase(state, 'dead');
      return [];
    }
    if (p._hungerStage === 1) {
      addLog(state, '🍖 食物已耗尽！请尽快进食...');
    } else {
      const hpLoss = p._hungerStage === 2 ? 30 : 60;
      p.hp = Math.max(0, p.hp - hpLoss);
      events.push({
        name: p._hungerStage === 2 ? '饥饿' : '严重缺食',
        desc: p._hungerStage === 2 ? '食物已耗尽，你感到饥肠辘辘...' : '极度饥饿，身体正在消耗自身...',
        category: 'bad',
        hpLoss,
      });
    }
  } else {
    p._hungerStage = 0;
  }

  return events;
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
