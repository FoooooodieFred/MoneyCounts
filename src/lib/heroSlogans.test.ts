import { describe, expect, it } from "vitest";
import {
  buildHeroSlogan,
  getRelativeDayPhrase,
  HERO_SLOGAN_ENDINGS,
  listHeroSloganVariants,
  shiftFromToday,
} from "./heroSlogans";

describe("heroSlogans", () => {
  const today = "2026-08-30";

  it("maps nearby dates to relative day phrases", () => {
    expect(getRelativeDayPhrase(today, today)).toBe("今天");
    expect(getRelativeDayPhrase(shiftFromToday(-1, today), today)).toBe("昨天");
    expect(getRelativeDayPhrase(shiftFromToday(1, today), today)).toBe("明天");
    expect(getRelativeDayPhrase(shiftFromToday(-2, today), today)).toBe("前天");
    expect(getRelativeDayPhrase(shiftFromToday(2, today), today)).toBe("后天");
    expect(getRelativeDayPhrase("2026-08-26", today)).toBe("8月26日");
  });

  it("builds six slogan forms with swapping day phrases", () => {
    const variants = listHeroSloganVariants(today, today);
    expect(variants).toHaveLength(6);
    expect(variants[0]).toBe("今天也要轻松记账");
    expect(HERO_SLOGAN_ENDINGS).toHaveLength(6);

    expect(buildHeroSlogan(shiftFromToday(-1, today), 0, today)).toBe("昨天也要轻松记账");
    expect(buildHeroSlogan(shiftFromToday(1, today), 1, today)).toBe("明天也把账记清楚");
    expect(buildHeroSlogan("2026-08-26", 0, today)).toBe("8月26日也要轻松记账");
  });
});
