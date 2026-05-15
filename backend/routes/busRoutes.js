const router = require("express").Router();
const c = require("../controllers/busController");
const auth = require("../middleware/auth");

router.get("/", c.listBuses);
router.get("/mine", auth, c.myBus);
router.get("/route/:routeId", c.busesByRoute);
router.get("/:id", c.getBus);

router.post("/register", auth, c.registerBus);
router.put("/:id", auth, c.updateBus);
router.put("/:id/location", auth, c.updateLocation);
router.post("/:id/start-trip", auth, c.startTrip);
router.post("/:id/stop-trip", auth, c.stopTrip);

module.exports = router;
