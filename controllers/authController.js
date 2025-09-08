const { createUser } = require("../db/queries");
const bcrypt = require("bcryptjs");
const passport = require("passport");

const getIndex = (req, res) => {
  res.render("index");
};

const getSignupForm = (req, res) => {
  res.render("sign-up-form");
};

const postSignup = async (req, res, next) => {
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
};

const postLogin = (req, res, next) => {
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
};

const getAfterLogin = (req, res) => {
  console.log("after-login user:", req.user);
  res.redirect("/drive");
};

module.exports = {
  getIndex,
  getSignupForm,
  postSignup,
  postLogin,
  getAfterLogin,
};
