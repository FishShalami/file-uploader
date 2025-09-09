const path = require("node:path");
const express = require("express");
require("dotenv").config();

const session = require("express-session");
const passport = require("passport");

const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { prisma } = require("./db/prisma");

// const { pool } = require("./db/pool");

const {
  getRoot,
  getFolder,
  listChildren,
  listFiles,
  createFolder,
  createFile,
  renameFile,
  renameFolder,
  deleteFolder,
  getFileMeta,
  deleteFileRecord,
  getFileDetails,
} = require("./db/queries");

const {
  getIndex,
  getSignupForm,
  postSignup,
  postLogin,
  getAfterLogin,
} = require("./controllers/authController");

const {
  postCreateFolder,
  getDriveFolder,
  getDriveRoot,
  postDeleteFolder,
  postRenameFolder,
} = require("./controllers/driveController");

const multer = require("multer");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const storage = multer.diskStorage({
  async destination(req, file, cb) {
    try {
      const folderId = String(req.body.folderId || "").trim();
      // keep it simple, but ensure it exists
      if (!folderId) return cb(new Error("folderId is required"));
      // optional: ensure numeric
      if (!/^\d+$/.test(folderId))
        return cb(new Error("folderId must be numeric"));
      const dir = path.join(__dirname, "uploads", folderId);
      await fs.mkdir(dir, { recursive: true }); // creates nested dirs if missing
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const key = `${crypto.randomUUID()}${ext}`; // prevents collisions
    cb(null, key);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

//Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Session

app.use(
  session({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // ms
    },
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, //ms
      dbRecordIdIsSessionId: true,
    }),
  })
);

require("./db/passport");
app.use(passport.initialize());
app.use(passport.session());

//---HELPER FUNCTIONS --- //

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/");
}

// --- GET ROUTES --- //

app.get("/", getIndex);

app.get("/sign-up", getSignupForm);

app.get("/after-login", ensureAuth, getAfterLogin);

app.get("/drive", ensureAuth, getDriveRoot);

app.get("/drive/:folderId", ensureAuth, getDriveFolder);

// Show a file's details page
app.get("/files/:id", ensureAuth, async (req, res, next) => {
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
});

// Download the file
app.get("/files/:id/download", ensureAuth, async (req, res, next) => {
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
});

//--- POST ROUTES ---//

app.post("/sign-up", postSignup);

app.post("/login", postLogin);

app.post(
  "/upload",
  ensureAuth,
  upload.single("uploaded_file"),
  async (req, res, next) => {
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
  }
);

app.post("/folders", ensureAuth);

// Rename a folder
app.post("/folders/:id/rename", ensureAuth, postRenameFolder);

// Rename a file
app.post("/files/:id/rename", ensureAuth, async (req, res, next) => {
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
});

// DELETE FOLDER
app.post("/folders/:id/delete", ensureAuth, postDeleteFolder);

// DELETE FILE (disk + DB)
const fsp = require("node:fs/promises");

app.post("/files/:id/delete", ensureAuth, async (req, res, next) => {
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
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`app listening on ${PORT}!`);
});
