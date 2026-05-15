const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Driver = require("../models/Driver");

function sign(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

exports.register = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ message: "name, phone, password are required" });

    const exists = await Driver.findOne({ phone });
    if (exists) return res.status(409).json({ message: "Phone already registered" });

    const hash = await bcrypt.hash(password, 10);
    const driver = await Driver.create({ name, phone, password: hash });

    res.status(201).json({
      token: sign(driver._id),
      driver: { id: driver._id, name: driver.name, phone: driver.phone },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, driver.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      token: sign(driver._id),
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        assignedBusId: driver.assignedBusId,
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.me = async (req, res) => {
  const driver = await Driver.findById(req.driverId).select("-password");
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};
