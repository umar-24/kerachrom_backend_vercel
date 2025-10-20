const express = require("express");
const bgRouter = express.Router();
const BackgroundImage = require("../models/bg_images");

// POST: Add a new background image group
bgRouter.post("/api/backgrounds", async (req, res) => {
    try {
      const { image_urls } = req.body;
  
      if (!Array.isArray(image_urls) || image_urls.length === 0) {
        return res.status(400).json({ message: "image_urls must be a non-empty array" });
      }
  
      for (const item of image_urls) {
        if (!item.url || !item.catg) {
          return res.status(400).json({ message: "Each image must have 'url' and 'catg'" });
        }
      }
  
      // Find existing document or create new one
      let doc = await BackgroundImage.findOne();
      if (!doc) {
        doc = new BackgroundImage({ image_urls });
      } else {
        doc.image_urls.push(...image_urls); // Append new images to existing array
      }
  
      await doc.save();
      res.status(201).json({ message: "Background images saved", data: doc.image_urls });
    } catch (error) {
      res.status(500).json({ message: "Error uploading background images", error: error.message });
    }
  });
  
// GET: Get all background image groups
bgRouter.get("/api/backgrounds", async (req, res) => {
  try {
    const backgrounds = await BackgroundImage.find();
    res.json({ data: backgrounds });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// PUT: Update a specific background image group by ID
bgRouter.put("/api/backgrounds/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { image_urls } = req.body;

    if (!Array.isArray(image_urls) || image_urls.length === 0) {
      return res.status(400).json({ message: "image_urls must be a non-empty array" });
    }

    const updated = await BackgroundImage.findByIdAndUpdate(
      id,
      { image_urls },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Background entry not found" });
    }

    res.json({ message: "Background updated", data: updated });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// DELETE a background image entry by ID
bgRouter.delete("/api/backgrounds/:id", async (req, res) => {
    try {
      const { id } = req.params; // Background document ID
      const { imageId } = req.body; // Image URL _id inside image_urls array
  
      // Find the background document
      const background = await BackgroundImage.findById(id);
  
      if (!background) {
        return res.status(404).json({ message: "Background not found" });
      }
  
      // Find the index of the image to delete in the image_urls array
      const imageIndex = background.image_urls.findIndex(
        (image) => image._id.toString() === imageId
      );
  
      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found" });
      }
  
      // Remove the image from the array
      background.image_urls.splice(imageIndex, 1);
  
      // Save the updated background document
      await background.save();
  
      res.status(200).json({
        message: "Image deleted successfully",
        data: background,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  

module.exports = bgRouter;
