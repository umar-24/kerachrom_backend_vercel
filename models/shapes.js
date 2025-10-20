const mongoose = require("mongoose");

const shapeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model("Shape", shapeSchema);
