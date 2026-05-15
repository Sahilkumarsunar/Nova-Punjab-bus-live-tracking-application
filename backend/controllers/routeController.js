const Route = require("../models/Route");

exports.list = async (_req, res) => {
  const routes = await Route.find().sort({ source: 1 });
  res.json(routes);
};

exports.get = async (req, res) => {
  const r = await Route.findById(req.params.id);
  if (!r) return res.status(404).json({ message: "Route not found" });
  res.json(r);
};

exports.create = async (req, res) => {
  const r = await Route.create(req.body);
  res.status(201).json(r);
};

exports.update = async (req, res) => {
  const r = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!r) return res.status(404).json({ message: "Route not found" });
  res.json(r);
};

exports.remove = async (req, res) => {
  const r = await Route.findByIdAndDelete(req.params.id);
  if (!r) return res.status(404).json({ message: "Route not found" });
  res.json({ ok: true });
};
