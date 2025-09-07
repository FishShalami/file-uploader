const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const { findUserByUsername, findUserById } = require("./queries");

// --- PASSPORT CONFIG --- //
passport.use(
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    async (username, password, done) => {
      try {
        const user = await findUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return done(null, false, { message: "Invalid credentials" });

        const safeUser = { id: user.id, username: user.username };
        return done(null, safeUser);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// How the user is stored in the session cookie (by id)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// How the full user is rehydrated on every request
passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    if (!user) return done(null, false);

    return done(null, user); // becomes req.user
  } catch (err) {
    return done(err);
  }
});

module.exports = passport;
