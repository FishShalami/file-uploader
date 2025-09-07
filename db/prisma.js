// db/prisma.js
const { PrismaClient } = require("@prisma/client");

let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // prevent hot-reload from creating multiple clients in dev
  if (!global.__prisma) global.__prisma = new PrismaClient();
  prisma = global.__prisma;
}

module.exports = { prisma };
