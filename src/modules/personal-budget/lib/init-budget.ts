/**
 * Inicjalizacja nowego budżetu osobistego z domyślnymi grupami i kategoriami
 */

import { prisma } from "@/lib/prisma";

const DEFAULT_GROUPS = [
  {
    name: "Do przydzielenia",
    isPrivateExpenses: false,
    categories: [],
  },
  {
    name: "Mieszkanie",
    isPrivateExpenses: false,
    categories: ["Czynsz", "Prąd", "Internet", "Media"],
  },
  {
    name: "Jedzenie",
    isPrivateExpenses: false,
    categories: ["Zakupy", "Restauracje"],
  },
  {
    name: "Transport",
    isPrivateExpenses: false,
    categories: ["Paliwo", "Naprawy", "Bilety"],
  },
  {
    name: "Wydatki prywatne",
    isPrivateExpenses: true,
    categories: ["Prywatne zakupy", "Rozrywka", "Prezenty"],
  },
  {
    name: "Oszczędności",
    isPrivateExpenses: false,
    categories: ["Nagły wypadek", "Wakacje", "Inne oszczędności"],
  },
];

export async function createPersonalBudgetWithDefaults(userId: string, name: string) {
  const budget = await prisma.personalBudget.create({
    data: {
      userId,
      name,
      currency: "PLN",
    },
  });

  let sortOrder = 0;
  for (const grp of DEFAULT_GROUPS) {
    const group = await prisma.personalCategoryGroup.create({
      data: {
        budgetId: budget.id,
        name: grp.name,
        isPrivateExpenses: grp.isPrivateExpenses,
        sortOrder: sortOrder++,
      },
    });

    if (grp.name === "Do przydzielenia") {
      await prisma.personalCategory.create({
        data: {
          groupId: group.id,
          name: "Do przydzielenia",
          isSystem: true,
          sortOrder: -1,
        },
      });
    } else {
      for (let i = 0; i < grp.categories.length; i++) {
        await prisma.personalCategory.create({
          data: {
            groupId: group.id,
            name: grp.categories[i],
            sortOrder: i,
          },
        });
      }
    }
  }

  // Domyślne konto
  await prisma.personalAccount.create({
    data: {
      budgetId: budget.id,
      name: "Konto główne",
      type: "checking",
      isOnBudget: true,
      sortOrder: 0,
    },
  });

  return budget;
}
