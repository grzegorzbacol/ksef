/**
 * Logika budżetu wzorowana na YNAB:
 * - planowane vs rzeczywiste wydatki
 * - bilans miesięczny
 * - procent wykorzystania budżetu
 */

export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  sortOrder: number;
  plannedAmount: number;
  actualAmount: number; // suma transakcji (ujemne = wydatki)
  remaining: number; // planned - |wydatki| (dla wydatków) lub actual (dla przychodów)
  utilizationPercent: number; // dla wydatków: actual/planned * 100
};

export type MonthBudgetSummary = {
  month: number;
  year: number;
  totalPlanned: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number; // income - |expenses|
  plannedExpenses: number;
  remainingBudget: number; // plannedExpenses - |totalExpenses|
  categories: CategorySummary[];
};

export function computeCategoryUtilization(planned: number, actual: number): number {
  if (planned <= 0) return 0;
  const spent = Math.abs(actual < 0 ? actual : 0);
  return Math.min(100, (spent / planned) * 100);
}

export function formatCurrency(value: number): string {
  return `${value.toFixed(2)} PLN`;
}
