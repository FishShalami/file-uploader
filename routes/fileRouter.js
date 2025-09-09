const express = require("express");
const router = express.Router();
const { ensureAuth } = require("../middleware/ensureAuth");
const { upload } = require("../middleware/upload");

const {
  getFileDetails,
  getFileDownload,
  postFileUpload,
  postRenameFile,
  postDeleteFile,
} = require("../controllers/fileController");

// Show a file's details page
router.get("/files/:id", ensureAuth, getFileDetails);

// Download the file
router.get("/files/:id/download", ensureAuth, getFileDownload);

// Upload a file
router.post(
  "/upload",
  ensureAuth,
  upload.single("uploaded_file"),
  postFileUpload
);

// Rename a file
router.post("/files/:id/rename", ensureAuth, postRenameFile);

//Delete a file
router.post("/files/:id/delete", ensureAuth, postDeleteFile);

module.exports = router;
