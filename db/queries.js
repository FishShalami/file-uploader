const { prisma } = require("./prisma");

async function createUser({ username, passwordHash }) {
  try {
    return await prisma.user.create({
      data: { username, password: passwordHash },
      select: { id: true, username: true },
    });
  } catch (err) {
    // Unique constraint (e.g., username) — Prisma error code P2002
    if (err.code === "P2002") {
      const fields = err.meta?.target?.join(", ") || "field";
      const e = new Error(`Duplicate value for ${fields}`);
      e.code = "DUPLICATE";
      throw e;
    }
    throw err;
  }
}

async function findUserByUsername(username) {
  return prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, password: true },
  });
}

async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });
}

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
};
