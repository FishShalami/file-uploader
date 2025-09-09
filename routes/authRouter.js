const express = require("express");
const router = express.Router();

const {
  getIndex,
  getSignupForm,
  postSignup,
  postLogin,
  getAfterLogin,
} = require("../controllers/authController");

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/");
}

router.get("/", getIndex);

router.get("/sign-up", getSignupForm);

router.post("/sign-up", postSignup);

router.post("/login", postLogin);

router.get("/after-login", ensureAuth, getAfterLogin);

module.exports = router;
