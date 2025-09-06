const path = require("node:path");
const express = require("express");
const passport = require("passport");
const session = require("express-session");
require("dotenv").config();
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { pool } = require("./db/pool");

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));

// --- GET ROUTES --- //

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/sign-up", (req, res) => {
  res.render("sign-up-form");
});

//--- POST ROUTES ---//

app.post("/sign-up", async (req, res, next) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    console.log(hashedPassword);
    await pool.query(
      `INSERT INTO "User" (username, password) VALUES ($1, $2)`,
      [req.body.username, hashedPassword]
    );

    res.redirect("/");
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// require("./db/passport");
// app.use(passport.initialize());
// app.use(passport.session());

// app.use(
//   expressSession({
//     cookie: {
//      maxAge: 7 * 24 * 60 * 60 * 1000 // ms
//     },
//     secret: process.env.SECRET,
//     resave: true,
//     saveUninitialized: true,
//     store: new PrismaSessionStore(
//       new PrismaClient(),
//       {
//         checkPeriod: 2 * 60 * 1000,  //ms
//         dbRecordIdIsSessionId: true,
//         dbRecordIdFunction: undefined,
//       }
//     )
//   })
// );

const PORT = process.env.PORT || 3000;

app.listen(PORT, (err) => {
  if (err) {
    throw err;
  }
  console.log(`app listening on ${PORT}!`);
});
