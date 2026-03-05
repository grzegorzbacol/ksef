/**
 * Typy modułu budżetu osobistego (YNAB-style)
 */

export const ACCOUNT_TYPES = {
  ON_BUDGET: ["checking", "savings", "cash", "debit", "credit_card"] as const,
  OFF_BUDGET: ["loan", "investment", "mortgage"] as const,
} as const;

export type OnBudgetAccountType = (typeof ACCOUNT_TYPES.ON_BUDGET)[number];
export type OffBudgetAccountType = (typeof ACCOUNT_TYPES.OFF_BUDGET)[number];
export type AccountType = OnBudgetAccountType | OffBudgetAccountType;

export const TARGET_TYPES = {
  MONTHLY_SPENDING: "monthly_spending",
  SAVINGS: "savings",
  TARGET_BY_DATE: "target_by_date",
} as const;

export type TargetType = (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];

export const SCHEDULED_FREQUENCY = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

export type ScheduledFrequency = (typeof SCHEDULED_FREQUENCY)[keyof typeof SCHEDULED_FREQUENCY];

export interface CategoryWithActivity {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  isSystem: boolean;
  isPrivateExpenses?: boolean;
  targetType: TargetType | null;
  targetAmount: number | null;
  targetDate: Date | null;
  allocated: number;
  activity: number; // suma transakcji (ujemna = wydatki)
  available: number; // allocated + activity (z rolloverem)
  overspent: boolean;
}

export interface MonthBudgetSummary {
  month: number;
  year: number;
  toBeBudgeted: number;
  totalAllocated: number;
  totalActivity: number;
  overspentCategories: string[];
  categories: CategoryWithActivity[];
}
