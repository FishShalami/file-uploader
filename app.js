const path = require("node:path");
const express = require("express");
require("dotenv").config();

const session = require("express-session");
const passport = require("passport");

const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { prisma } = require("./db/prisma");

// const { pool } = require("./db/pool");

const authRouter = require("./routes/authRouter");
const driveRouter = require("./routes/driveRouter");

const {
  getFileDetails,
  getFileDownload,
  postFileUpload,
  postRenameFile,
  postDeleteFile,
} = require("./controllers/fileController");

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

app.use("/", authRouter);
app.use("/", driveRouter);

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/");
}

// --- GET ROUTES --- //

// Show a file's details page
app.get("/files/:id", ensureAuth, getFileDetails);

// Download the file
app.get("/files/:id/download", ensureAuth, getFileDownload);

//--- POST ROUTES ---//

app.post("/upload", ensureAuth, upload.single("uploaded_file"), postFileUpload);

// Rename a file
app.post("/files/:id/rename", ensureAuth, postRenameFile);

// DELETE FOLDER

// DELETE FILE (disk + DB)

app.post("/files/:id/delete", ensureAuth, postDeleteFile);

const PORT = process.env.PORT || 3000;

app.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`app listening on ${PORT}!`);
});
