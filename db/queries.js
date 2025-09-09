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

// Rename a folder (simple + explicit)
async function renameFolder(folderId, ownerId, newName) {
  const name = String(newName || "").trim();
  if (!name) throw new Error("New folder name is required.");

  // 1) Ensure the folder exists and is owned by this user
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId },
    select: { id: true, parentId: true },
  });
  if (!folder) throw new Error("Folder not found.");

  // 2) Prevent duplicate name among siblings (same parent)
  const dup = await prisma.folder.findFirst({
    where: { ownerId, parentId: folder.parentId, name },
    select: { id: true },
  });
  if (dup && dup.id !== folderId) {
    throw new Error("A folder with that name already exists here.");
  }

  // 3) Update
  return prisma.folder.update({
    where: { id: folderId },
    data: { name },
    select: { id: true, name: true },
  });
}

// Rename a file (simple + explicit)
async function renameFile(fileId, ownerId, newName) {
  const name = String(newName || "").trim();
  if (!name) throw new Error("New filename is required.");

  // 1) Ensure the file exists and is owned by this user
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId },
    select: { id: true, folderId: true },
  });
  if (!file) throw new Error("File not found.");

  // 2) Prevent duplicate name in the same folder
  const dup = await prisma.file.findFirst({
    where: { folderId: file.folderId, originalName: name },
    select: { id: true },
  });
  if (dup && dup.id !== fileId) {
    throw new Error("A file with that name already exists in this folder.");
  }

  // 3) Update only the display name; disk key is unchanged
  return prisma.file.update({
    where: { id: fileId },
    data: { originalName: name },
    select: { id: true, originalName: true },
  });
}

// Delete a folder (blocks if there are subfolders)
async function deleteFolder(folderId, ownerId) {
  // Check folder exists + ownership
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId },
    select: { id: true },
  });
  if (!folder) throw new Error("Folder not found.");

  // Block if there are child folders
  const childCount = await prisma.folder.count({
    where: { ownerId, parentId: folderId },
  });
  if (childCount > 0) {
    throw new Error("Folder has subfolders. Delete or move them first.");
  }

  // Files in this folder will be deleted by DB (onDelete: Cascade)
  await prisma.folder.delete({ where: { id: folderId } });
}

// Minimal helper to fetch file meta needed to delete from disk
async function getFileMeta(fileId, ownerId) {
  return prisma.file.findFirst({
    where: { id: fileId, ownerId },
    select: { id: true, folderId: true, key: true, originalName: true },
  });
}

// Remove the DB record (call AFTER disk unlink)
async function deleteFileRecord(fileId) {
  await prisma.file.delete({ where: { id: fileId } });
}

// Get full details for a file (owner-scoped)
async function getFileDeets(fileId, ownerId) {
  return prisma.file.findFirst({
    where: { id: fileId, ownerId },
    select: {
      id: true,
      originalName: true,
      key: true, // disk filename
      mimeType: true,
      sizeBytes: true,
      ext: true,
      createdAt: true,
      folderId: true,
      folder: { select: { id: true, name: true } },
    },
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
  renameFolder,
  renameFile,
  deleteFileRecord,
  getFileMeta,
  deleteFolder,
  getFileDeets,
};
