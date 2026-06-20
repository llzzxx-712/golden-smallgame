export const ACHIEVEMENTS = [
  { id: 'first_win',       name: '初次淘金',   icon: '🥇', desc: '首次成功返回营地' },
  { id: 'gold_master',     name: '淘金达人',   icon: '💎', desc: '累计5次胜利' },
  { id: 'explorer_20',     name: '沙漠漫步',   icon: '🗺️', desc: '一局探索20+个节点' },
  { id: 'rich_500',        name: '富翁',       icon: '💰', desc: '单局携带500+金币返回' },
  { id: 'survivor',        name: '饥渴难耐',   icon: '💧', desc: '水和食物均≤1的情况下通关' },
  { id: 'speed_run',       name: '速通王者',   icon: '⚡', desc: '10回合内通关' },
  { id: 'long_march',      name: '万里长征',   icon: '👣', desc: '累计移动100步' },
  { id: 'shopaholic',      name: '购物狂',     icon: '🛒', desc: '单局购买10+个道具' },
  { id: 'hard_win',        name: '困难征服者', icon: '🔥', desc: '困难模式通关' },
  { id: 'all_chars',       name: '全能战士',   icon: '👑', desc: '所有角色各通关一次' },
  { id: 'veteran_kills',   name: '不死老兵',   icon: '⚔️', desc: '用老兵击杀5次野兽/强盗' },
  { id: 'die_hard',        name: '探险初心',   icon: '🪦', desc: '累计死亡10次' },
  { id: 'full_hp_return',  name: '毫发无伤',   icon: '💚', desc: '满HP状态通关' },
  { id: 'no_shop_win',     name: '极简主义',   icon: '🎒', desc: '未购买任何道具通关' },
];

/**
 * 检查并解锁新成就
 * @returns {Array} 新解锁的成就列表
 */
export function checkAchievements(reputation, state, lifetimeStats) {
  const earned = reputation.achievements ? new Set(reputation.achievements) : new Set();
  const newlyUnlocked = [];
  const p = state?.player;

  const unlock = (ach) => {
    if (!earned.has(ach.id)) {
      earned.add(ach.id);
      newlyUnlocked.push(ach);
      reputation.totalReputation += 20;
    }
  };

  lifetimeStats = lifetimeStats || {};

  // 1: 初次淘金
  if (state && state.phase === 'win') unlock(ACHIEVEMENTS[0]);

  // 2: 淘金达人 (5 wins)
  if ((reputation.stats.wins || 0) >= 5) unlock(ACHIEVEMENTS[1]);

  // 3: 沙漠漫步 (20+ nodes)
  if (state && p && p.visitedNodes?.length >= 20) unlock(ACHIEVEMENTS[2]);

  // 4: 富翁 (500+ coins return)
  if (state && state.phase === 'win' && p && p.coins >= 500) unlock(ACHIEVEMENTS[3]);

  // 5: 饥渴难耐 (water≤1 && food≤1 win)
  if (state && state.phase === 'win' && p && p.water <= 1 && p.food <= 1) unlock(ACHIEVEMENTS[4]);

  // 6: 速通王者 (≤10 turns)
  if (state && state.phase === 'win' && state.turn <= 10) unlock(ACHIEVEMENTS[5]);

  // 7: 万里长征 (lifetime 100 steps)
  lifetimeStats.totalSteps = (lifetimeStats.totalSteps || 0);
  if (state && p) lifetimeStats.totalSteps = p.visitedNodes?.length || 0;
  if (lifetimeStats.totalSteps >= 100) unlock(ACHIEVEMENTS[6]);

  // 8: 购物狂 (buy 10+ items in one run)
  lifetimeStats.itemsBoughtThisRun = (lifetimeStats.itemsBoughtThisRun || 0);
  if (lifetimeStats.itemsBoughtThisRun >= 10) unlock(ACHIEVEMENTS[7]);

  // 9: 困难征服者
  if (state && state.phase === 'win' && state.difficulty === 'hard') unlock(ACHIEVEMENTS[8]);

  // 10: 全能战士 (all 4 chars win)
  lifetimeStats.charWins = lifetimeStats.charWins || [];
  if (state && state.phase === 'win' && p && !lifetimeStats.charWins.includes(p.character)) {
    lifetimeStats.charWins.push(p.character);
  }
  if (lifetimeStats.charWins.length >= 4) unlock(ACHIEVEMENTS[9]);

  // 11: 不死老兵 (veteran kills 5+ beasts/bandits)
  lifetimeStats.veteranKills = lifetimeStats.veteranKills || 0;
  if (lifetimeStats.veteranKills >= 5) unlock(ACHIEVEMENTS[10]);

  // 12: 探险初心 (die 10 times)
  if ((reputation.stats.deaths || 0) >= 10) unlock(ACHIEVEMENTS[11]);

  // 13: 毫发无伤 (full HP win)
  if (state && state.phase === 'win' && p && p.hp >= p.maxHp) unlock(ACHIEVEMENTS[12]);

  // 14: 极简主义 (win without buying items)
  if (state && state.phase === 'win' && lifetimeStats.itemsBoughtThisRun === 0) unlock(ACHIEVEMENTS[13]);

  // Save earned set
  reputation.achievements = [...earned];

  return newlyUnlocked;
}
