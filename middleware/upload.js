const multer = require("multer");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const storage = multer.diskStorage({
  async destination(req, file, cb) {
    try {
      const folderId = String(req.body.folderId || "").trim();
      if (!folderId) return cb(new Error("folderId is required in the form"));

      const dir = path.join(process.cwd(), "uploads", folderId);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const key = `${crypto.randomUUID()}${ext}`;
    cb(null, key);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload };
