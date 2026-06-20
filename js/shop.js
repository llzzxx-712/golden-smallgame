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
