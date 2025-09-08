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

//list root level folders for a user
async function getRoot(ownerId) {
  return prisma.folder.findMany({
    where: { ownerId, parentId: null },
    orderBy: { name: "asc" },
  });
}

//fetch a single folder by ID, scope to owner
//includes breadcrumbs of parent
async function getFolder(folderId, ownerId) {
  return prisma.folder.findFirst({
    where: { id: folderId, ownerId },
    include: { parent: true },
  });
}

async function listChildren(folderId, ownerId) {
  return prisma.folder.findMany({
    where: { ownerId, parentId: folderId },
    orderBy: { name: "asc" },
  });
}

async function listFiles(folderId, ownerId) {
  return prisma.file.findMany({
    where: { ownerId, folderId },
    orderBy: { originalName: "asc" },
  });
}

async function createFolder(name, ownerId, parentId = null) {
  const folderName = String(name || "").trim();
  if (!folderName) throw new Error("Folder name is required");

  return prisma.$transaction(async (tx) => {
    if (parentId !== null && parentId !== undefined) {
      const parent = await tx.folder.findFirst({
        where: { id: parentId, ownerId },
        select: { id: true },
      });
      if (!parent) throw new Error("Parent folder not found");
    } else {
      const existingRoot = await tx.folder.findFirst({
        where: { ownerId, parentId: null, name: folderName },
        select: { id: true },
      });
      if (existingRoot)
        throw new Error("A root folder with that name already exists");
    }

    try {
      return await tx.folder.create({
        data: { name: folderName, ownerId, parentId },
      });
    } catch (err) {
      throw err;
    }
  });
}

async function createFile(meta) {
  const { ownerId, folderId, originalName, key, mimeType, sizeBytes, ext } =
    meta || {};

  if (!ownerId || !folderId || !originalName || !key) {
    throw new Error("ownerId, folderId, originalName, and key are required");
  }

  return prisma.$transaction(async (tx) => {
    const folder = await tx.folder.findFirst({
      where: { id: folderId, ownerId },
      select: { id: true },
    });
    if (!folder) throw new Error("Folder not found!");

    try {
      return await tx.file.create({
        data: {
          ownerId,
          folderId,
          originalName,
          key,
          mimeType: mimeType || "application/octet-stream",
          sizeBytes: Number(sizeBytes || 0),
          ext: ext || "",
        },
      });
    } catch (err) {
      throw err;
    }
  });
}

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
  getRoot,
  getFolder,
  listChildren,
  listFiles,
  createFolder,
  createFile,
};
