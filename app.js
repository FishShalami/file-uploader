const path = require("node:path");
const express = require("express");
require("dotenv").config();

const session = require("express-session");
const passport = require("passport");

const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { prisma } = require("./db/prisma");

const authRouter = require("./routes/authRouter");
const driveRouter = require("./routes/driveRouter");
const fileRouter = require("./routes/fileRouter");

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
app.use("/", fileRouter);

// 404 error

app.use((req, res) => {
  const backHref = req.isAuthenticated?.() ? "/drive" : "/";
  res.status(404).render("404", { backHref });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  // Minimal dev-friendly output; keep generic in prod
  res.status(500).send("Something went wrong.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`app listening on ${PORT}!`);
});
