import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      settings: {
        confidenceThreshold: 0.6,
        autoArchiveDays: 15,
        defaultModel: "claude",
        weeklyReviewDay: 0,
      },
    },
  });

  console.log("Created user:", user.email);

  // Create sample project
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "Sample Project",
      description: "A sample project for testing",
      status: "active",
    },
  });

  console.log("Created project:", project.name);

  // Create sample area
  const area = await prisma.area.create({
    data: {
      userId: user.id,
      name: "Health & Fitness",
      description: "Personal health and fitness activities",
    },
  });

  console.log("Created area:", area.name);

  // Create sample inbox items
  await prisma.inboxItem.createMany({
    data: [
      {
        userId: user.id,
        type: "manual",
        content: "Call dentist to schedule appointment",
        source: "capture",
        status: "pending",
      },
      {
        userId: user.id,
        type: "manual",
        content: "Review quarterly report and prepare summary for team meeting",
        source: "capture",
        status: "pending",
      },
      {
        userId: user.id,
        type: "email",
        content:
          "Re: Project Deadline - Please confirm the new deadline for the marketing campaign",
        source: "email-forward",
        status: "pending",
      },
    ],
  });

  console.log("Created 3 inbox items");

  // Create sample action
  await prisma.action.create({
    data: {
      userId: user.id,
      description: "Email Sarah about budget proposal",
      status: "pending",
      priority: "high",
      projectId: project.id,
    },
  });

  console.log("Created sample action");

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
