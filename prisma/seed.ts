import { PrismaClient } from "@prisma/client";
import { createPersonalBudgetWithDefaults } from "../src/modules/personal-budget/lib/init-budget";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { login: "grzegorzbacol" },
    update: {},
    create: {
      login: "grzegorzbacol",
      password: "", // first login will set password
    },
  });
  console.log("Seed: user grzegorzbacol created (password empty - set on first login)");

  const existingPersonal = await prisma.personalBudget.findFirst({
    where: { userId: user.id },
  });
  if (!existingPersonal) {
    await createPersonalBudgetWithDefaults(user.id, "Budżet osobisty");
    console.log("Seed: domyślny budżet osobisty z grupą 'Wydatki prywatne' utworzony");
  }

  const recurring = [
    { code: "zus", name: "ZUS", formName: "ok", sellerName: "Zakład Ubezpieczeń Społecznych", sellerNip: "" },
    { code: "pit5", name: "PIT-5", formName: "PIT-5", sellerName: "Urząd Skarbowy", sellerNip: "" },
    { code: "vat7", name: "VAT-7", formName: "VAT-7", sellerName: "Urząd Skarbowy", sellerNip: "" },
  ];
  for (const r of recurring) {
    await prisma.recurringSettlement.upsert({
      where: { code: r.code },
      update: { name: r.name, formName: r.formName, sellerName: r.sellerName, sellerNip: r.sellerNip },
      create: r,
    });
  }
  console.log("Seed: recurring settlements ZUS (ok), US (VAT-7), US (PIT-5)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
