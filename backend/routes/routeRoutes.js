const router = require("express").Router();
const c = require("../controllers/routeController");
const auth = require("../middleware/auth");

router.get("/", c.list);
router.get("/:id", c.get);
router.post("/", auth, c.create);
router.put("/:id", auth, c.update);
router.delete("/:id", auth, c.remove);

module.exports = router;
