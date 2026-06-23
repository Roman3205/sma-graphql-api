import "dotenv/config";
import { prisma } from "./lib/prisma";

async function main() {
  console.log("Seeding categories and tags...");

  const categories = ["Technology", "Science", "Education", "Entertainment", "Lifestyle"];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const tags = ["Vue", "GraphQL", "Prisma", "TypeScript", "NodeJS", "WebDev"];
  for (const name of tags) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
