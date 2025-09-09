const express = require("express");
const router = express.Router();
const { ensureAuth } = require("../middleware/ensureAuth");

const {
  postCreateFolder,
  getDriveFolder,
  getDriveRoot,
  postDeleteFolder,
  postRenameFolder,
} = require("../controllers/driveController");

router.get("/drive", ensureAuth, getDriveRoot);

router.get("/drive/:folderId", ensureAuth, getDriveFolder);

router.post("/folders", ensureAuth, postCreateFolder);

// Rename a folder
router.post("/folders/:id/rename", ensureAuth, postRenameFolder);

router.post("/folders/:id/delete", ensureAuth, postDeleteFolder);

module.exports = router;
