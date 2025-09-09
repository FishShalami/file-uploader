const {
  createFolder,
  getRoot,
  getFolder,
  deleteFolder,
  listChildren,
  listFiles,
  renameFolder,
} = require("../db/queries");

const getDriveRoot = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const folders = await getRoot(ownerId);
    // No files at root in our simple model (files live inside a folder)
    res.render("drive", {
      user: req.user,
      currentFolder: null,
      parentChain: [], // breadcrumb for root is empty
      folders,
      files: [],
    });
  } catch (err) {
    next(err);
  }
};

const getDriveFolder = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const folderId = Number(req.params.folderId);
    const currentFolder = await getFolder(folderId, ownerId);
    if (!currentFolder) return res.status(404).send("Folder not found");

    const folders = await listChildren(folderId, ownerId);
    const files = await listFiles(folderId, ownerId);

    // Minimal breadcrumb: just parent if exists (we’ll keep it simple)
    const parentChain = [];
    if (currentFolder.parent) parentChain.push(currentFolder.parent);

    res.render("drive", {
      user: req.user,
      currentFolder,
      parentChain,
      folders,
      files,
    });
  } catch (err) {
    next(err);
  }
};

const postCreateFolder = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const name = String(req.body.name || "").trim();
    const parentId = req.body.parentId ? Number(req.body.parentId) : null;

    const folder = await createFolder(name, ownerId, parentId);
    // Redirect to parent (or root if created at root)
    return parentId
      ? res.redirect(`/drive/${parentId}`)
      : res.redirect("/drive");
  } catch (err) {
    next(err);
  }
};

const postRenameFolder = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid folder id");
    const ownerId = req.user.id;
    const folderId = Number(req.params.id);
    const newName = String(req.body.name || "").trim();

    await renameFolder(folderId, ownerId, newName);

    const returnTo = req.body.returnTo || req.headers.referer || "/drive";
    return res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
};

const postDeleteFolder = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid folder id");
    const ownerId = req.user.id;
    const folderId = Number(req.params.id);

    // (Optional) fetch parent to build a fallback redirect
    const f = await getFolder(folderId, ownerId); // includes parent
    if (!f) return res.status(404).send("Folder not found");

    await deleteFolder(folderId, ownerId);

    const returnTo =
      req.body.returnTo ||
      req.headers.referer ||
      (f.parent ? `/drive/${f.parent.id}` : "/drive");

    return res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  postCreateFolder,
  getDriveFolder,
  getDriveRoot,
  postDeleteFolder,
  postRenameFolder,
};
