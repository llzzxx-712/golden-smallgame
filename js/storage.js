import { CHARACTERS } from './game.js';

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
    if (!data || typeof data !== 'object') return createReputation();
    return { ...createReputation(), ...data };
  } catch {
    return createReputation();
  }
}

export function saveReputation(rep) {
  try {
    localStorage.setItem(REPUTATION_KEY, JSON.stringify(rep));
  } catch {
    // localStorage full or unavailable
  }
}

export function saveGame(state) {
  try {
    const saveData = {
      phase: state.phase,
      difficulty: state.difficulty,
      player: state.player,
      map: state.map,
      log: state.log.slice(-20),
      turn: state.turn,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch {
    // localStorage full or unavailable
  }
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
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/**
 * 结算声望并保存
 */
export function settleReputation(state) {
  const rep = loadReputation();
  const p = state.player;
  const difficultyMultipliers = { easy: 1.0, normal: 1.2, hard: 1.5 };

  let earned = 0;
  if (state.phase === 'win') {
    earned += 50; // 活着回来
    earned += Math.floor((p.coins || 0) / 10);
    earned += (p.water || 0) * 2;
    earned += (p.food || 0) * 2;
    earned += (p.items?.length || 0) * 5;
    earned += (p.visitedNodes?.length || 0) * 3;
  }
  earned = Math.floor(earned * (difficultyMultipliers[state.difficulty] || 1));

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
export function unlockCharacter(rep, characterId) {
  const char = CHARACTERS[characterId];
  if (!char || rep.totalReputation < char.cost) return { success: false, message: '声望不足' };
  if (rep.unlockedCharacters.includes(characterId)) return { success: false, message: '已解锁' };

  rep.totalReputation -= char.cost;
  rep.unlockedCharacters.push(characterId);
  saveReputation(rep);
  return { success: true, message: `解锁了 ${char.name}！` };
}
