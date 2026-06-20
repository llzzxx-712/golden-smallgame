import { NODE_TYPES } from './map.js';
import { DIFFICULTIES, CHARACTERS, addLog } from './game.js';

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

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
    { id: 'broken_bag',    name: '水袋破损',    desc: '你不小心摔破了水袋！',                effect: { water: -3 } },
    { id: 'heatstroke',    name: '中暑',        desc: '烈日当头，你感到头晕目眩...',         effect: { hp: -15, stamina: -1 } },
  ],
};

/**
 * 根据当前节点和难度决定事件类型，返回事件对象
 */
export function triggerEvent(state) {
  const map = state.map;
  if (!map) return null;

  const node = map.nodes.find(n => n.id === state.player.position);
  if (!node || node.eventChance === 0) return null;
  if (Math.random() > node.eventChance) return null;

  const diff = DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
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
  const char = CHARACTERS[p.character] || CHARACTERS.explorer;
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

  // 强盗选择反抗分支
  if (event.id === 'bandits' && event.orEffect && p.coins < 25) {
    // Not enough coins, take HP damage instead
    if (eff.hp) p.hp = clamp(p.hp + (event.orEffect.hp || 0), 0, p.maxHp);
    addLog(state, `😨 金币不够，${event.orDesc || '你被打伤了...'}`);
    return;
  }

  if (eff.freeStep) {
    // refund stamina for the step that triggered this
    p.stamina = clamp(p.stamina + 1, 0, p.maxStamina);
  }
}
