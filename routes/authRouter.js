const express = require("express");
const router = express.Router();
const { ensureAuth } = require("../middleware/ensureAuth");

const {
  getIndex,
  getSignupForm,
  postSignup,
  postLogin,
  getAfterLogin,
} = require("../controllers/authController");

router.get("/", getIndex);

router.get("/sign-up", getSignupForm);

router.post("/sign-up", postSignup);

router.post("/login", postLogin);

router.get("/after-login", ensureAuth, getAfterLogin);

module.exports = router;
