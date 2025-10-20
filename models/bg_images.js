const mongoose = require("mongoose");

const backgroundImageSchema = new mongoose.Schema({
  image_urls: [
    {
      url: { type: String, required: true },
      catg: { type: String, required: true }
    }
  ]
}, { timestamps: true });

const BackgroundImage = mongoose.model("BackgroundImage", backgroundImageSchema);

module.exports = BackgroundImage;
