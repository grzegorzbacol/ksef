import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { login: "grzegorzbacol" },
    update: {},
    create: {
      login: "grzegorzbacol",
      password: "", // first login will set password
    },
  });
  console.log("Seed: user grzegorzbacol created (password empty - set on first login)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
