export type WeeklyAchievement = {
  enoughData: boolean;
  savedAmount: number;
  categoryMessage: string;
};

export type SpendingInsight = {
  enoughData: boolean;
  message: string;
};

export type LedgerBadge = {
  tier: "default" | "seven" | "thirty";
  streakDays: number;
  title: string;
  hint: string;
};
