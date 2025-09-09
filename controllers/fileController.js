const fsp = require("node:fs/promises");
const passport = require("passport");
const {
  renameFile,
  getFileDeets,
  createFile,
  getFileMeta,
  deleteFileRecord,
} = require("../db/queries");

const getFileDetails = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid file id");
    const ownerId = req.user.id;
    const fileId = Number(req.params.id);

    const file = await getFileDetails(fileId, ownerId);
    if (!file) return res.status(404).send("File not found");

    res.render("file-detail", { user: req.user, file });
  } catch (err) {
    next(err);
  }
};

const getFileDownload = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid file id");
    const ownerId = req.user.id;
    const fileId = Number(req.params.id);

    // Minimal: reuse details/meta to get folderId + key
    const file = await getFileDetails(fileId, ownerId);
    if (!file) return res.status(404).send("File not found");

    const diskPath = path.join(
      __dirname,
      "uploads",
      String(file.folderId),
      file.key
    );
    // res.download streams the file and sets Content-Disposition: attachment
    return res.download(diskPath, file.originalName, (err) => {
      if (err) {
        if (err.code === "ENOENT")
          return res.status(404).send("File missing on disk");
        return next(err);
      }
    });
  } catch (err) {
    next(err);
  }
};

const postFileUpload = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const folderId = Number(req.body.folderId);
    if (!folderId) throw new Error("folderId is required");

    const f = req.file;
    if (!f) throw new Error("No file uploaded");

    await createFile({
      ownerId,
      folderId,
      originalName: f.originalname,
      key: f.filename, // the saved disk name
      mimeType: f.mimetype,
      sizeBytes: f.size,
      ext: path.extname(f.originalname || ""),
    });

    return res.redirect(`/drive/${folderId}`);
  } catch (err) {
    next(err);
  }
};

const postRenameFile = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid file id");
    const ownerId = req.user.id;
    const fileId = Number(req.params.id);
    const newName = String(req.body.name || "").trim();

    await renameFile(fileId, ownerId, newName);

    const returnTo = req.body.returnTo || req.headers.referer || "/drive";
    return res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
};

const postDeleteFile = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).send("Invalid file id");
    const ownerId = req.user.id;
    const fileId = Number(req.params.id);

    // 1) Get file info (owner-scoped)
    const meta = await getFileMeta(fileId, ownerId);
    if (!meta) return res.status(404).send("File not found");

    // 2) Delete from disk (ignore if already missing)
    const diskPath = path.join(
      __dirname,
      "uploads",
      String(meta.folderId),
      meta.key
    );
    try {
      await fsp.unlink(diskPath);
    } catch (e) {
      if (e && e.code !== "ENOENT") throw e; // ignore missing, bubble up other errors
    }

    // 3) Remove DB record
    await deleteFileRecord(fileId);

    const returnTo =
      req.body.returnTo || req.headers.referer || `/drive/${meta.folderId}`;
    return res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFileDetails,
  getFileDownload,
  postFileUpload,
  postRenameFile,
  postDeleteFile,
};
