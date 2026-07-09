const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Driver = require("../models/Driver");

function sign(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

exports.register = async (req, res) => {
  try {
    const { name, phone, dlNumber, password } = req.body;
    if (!name || !phone || !dlNumber || !password)
      return res.status(400).json({ message: "name, phone, dlNumber, password are required" });

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || !/^[a-zA-Z\s]+$/.test(trimmedName)) {
      return res.status(400).json({ message: "Name must be at least 2 characters and contain only letters" });
    }

    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return res.status(400).json({ message: "Phone number must be a valid 10-digit mobile number" });
    }

    const cleanDL = dlNumber.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{13}$/.test(cleanDL)) {
      return res.status(400).json({ message: "Driving License number must be a valid Indian DL format (e.g. PB1020150123456)" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await Driver.findOne({ phone: trimmedPhone });
    if (exists) return res.status(409).json({ message: "Phone already registered" });

    const dlExists = await Driver.findOne({ dlNumber: cleanDL });
    if (dlExists) return res.status(409).json({ message: "Driving License number already registered" });

    const hash = await bcrypt.hash(password, 10);
    const driver = await Driver.create({
      name: trimmedName,
      phone: trimmedPhone,
      dlNumber: cleanDL,
      password: hash,
    });

    res.status(201).json({
      token: sign(driver._id),
      driver: { id: driver._id, name: driver.name, phone: driver.phone, dlNumber: driver.dlNumber },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: "Phone and password are required" });

    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return res.status(400).json({ message: "Phone number must be a valid 10-digit mobile number" });
    }

    const driver = await Driver.findOne({ phone: trimmedPhone });
    if (!driver) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, driver.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      token: sign(driver._id),
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        dlNumber: driver.dlNumber,
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
