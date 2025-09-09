const express = require("express");
const router = express.Router();

const {
  postCreateFolder,
  getDriveFolder,
  getDriveRoot,
  postDeleteFolder,
  postRenameFolder,
} = require("../controllers/driveController");

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/");
}

router.get("/drive", ensureAuth, getDriveRoot);

router.get("/drive/:folderId", ensureAuth, getDriveFolder);

router.post("/folders", ensureAuth, postCreateFolder);

// Rename a folder
router.post("/folders/:id/rename", ensureAuth, postRenameFolder);

router.post("/folders/:id/delete", ensureAuth, postDeleteFolder);

module.exports = router;
