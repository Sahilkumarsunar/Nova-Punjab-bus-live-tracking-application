const router = require("express").Router();
const c = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/register", c.register);
router.post("/login", c.login);
router.get("/me", auth, c.me);

module.exports = router;
