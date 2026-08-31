/** Placeholder marks where the user should type an amount. */
export const TEMPLATE_AMOUNT_SLOT = "__";

export const QUICK_TEMPLATE_POOL = [
  "午餐 __ 元",
  "晚餐 __ HKD",
  "地铁来回 __",
  "咖啡 __ 块",
  "奶茶 __ 元",
  "超市 __ HKD",
  "房租 __ 元",
  "水电 __",
  "发工资 __",
  "朋友还我 __",
  "昨天加油 __ 元",
  "大前天奶茶 __ 块",
  "这周每天地铁 __ HKD",
  "打车 __ 到机场",
  "网购 __ CNY",
  "会员订阅 __ /月",
  "健身 __ 一次",
  "药 __ 元",
  "红包发出 __",
  "收到红包 __",
] as const;

export function pickRandomTemplates(count = 3, seed?: number): string[] {
  const pool = [...QUICK_TEMPLATE_POOL];
  let state = seed;
  const random =
    state !== undefined
      ? () => {
          state = ((state ?? 0) * 1103515245 + 12345) & 0x7fffffff;
          return state / 0x7fffffff;
        }
      : Math.random;

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function applyTemplateSlot(template: string): { text: string; cursor: number } {
  const slot = TEMPLATE_AMOUNT_SLOT;
  const index = template.indexOf(slot);
  if (index < 0) {
    return { text: template, cursor: template.length };
  }
  const text = template.slice(0, index) + template.slice(index + slot.length);
  return { text, cursor: index };
}
