const { createFolder } = require("../db/queries");
const passport = require("passport");

const postCreateFolder = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const name = String(req.body.name || "").trim();
    const parentId = req.body.parentId ? Number(req.body.parentId) : null;

    const folder = await createFolder(name, ownerId, parentId);
    // Redirect to parent (or root if created at root)
    return parentId
      ? res.redirect(`/drive/${parentId}`)
      : res.redirect("/drive");
  } catch (err) {
    next(err);
  }
};

module.exports = { postCreateFolder };
