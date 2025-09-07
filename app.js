const path = require("node:path");
const express = require("express");
require("dotenv").config();

const session = require("express-session");
const passport = require("passport");

const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { prisma } = require("./db/prisma");

const bcrypt = require("bcryptjs");
const { pool } = require("./db/pool");
const { createUser } = require("./db/queries");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

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

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/sign-up", (req, res) => {
  res.render("sign-up-form");
});

app.get("/after-login", ensureAuth, (req, res) => {
  console.log("after-login user:", req.user);
  res.render("landing-page", { user: req.user });
});

//--- POST ROUTES ---//

app.post("/sign-up", async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    await createUser({ username: req.body.username, passwordHash });

    res.redirect("/");
  } catch (err) {
    if (err.code === "DUPLICATE") {
      return res.status(400).send("Username taken");
    }
    next(err);
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) return next(err);
    if (!user) {
      return res.redirect("/");
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect("/after-login");
    });
  })(req, res, next);
});

app.post(
  "/upload",
  ensureAuth,
  upload.single("uploaded_file"),
  (req, res, next) => {
    console.log({ user: req.user, file_size: req.file.size });
    res.render("landing-page", {
      user: req.user,
      uploadSuccess: true,
    });
  }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`app listening on ${PORT}!`);
});
