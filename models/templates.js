const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  code: String,
  size: String,
  price1: String,
  price2: String,
}, { _id: false });

const templateSchema = new mongoose.Schema({
  template_urls: [
    {
      url: { type: String, required: true },
      shape: { type: String, required: true },  // Removed enum validation
      variants: [variantSchema] // ✅ include variants
    }
  ]
}, { timestamps: true });

const Templates = mongoose.model("Template", templateSchema);
module.exports = Templates;
