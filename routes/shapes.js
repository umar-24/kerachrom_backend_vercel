const express = require("express");
const router = express.Router();
const Shape = require("../models/shapes");

// GET all shapes.
router.get("/api/shapes", async (req, res) => {
  try {
    const shapes = await Shape.find();
    res.status(200).json({ shapes });
  } catch (error) {
    res.status(500).json({ message: "Error fetching shapes", error: error.message });
  }
});

// POST a new shape
router.post("/api/shapes", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Shape name is required" });

    const newShape = new Shape({ name });
    await newShape.save();

    res.status(201).json({ message: "Shape added", shape: newShape });
  } catch (error) {
    res.status(500).json({ message: "Error adding shape", error: error.message });
  }
});

// PUT (update) a shape by ID
router.put("/api/shapes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Shape name is required" });

    const updatedShape = await Shape.findByIdAndUpdate(
      id,
      { name },
      { new: true } // Return the updated document
    );

    if (!updatedShape) {
      return res.status(404).json({ message: "Shape not found" });
    }

    res.status(200).json({ message: "Shape updated", shape: updatedShape });
  } catch (error) {
    res.status(500).json({ message: "Error updating shape", error: error.message });
  }
});

// DELETE a shape by ID
router.delete("/api/shapes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedShape = await Shape.findByIdAndDelete(id);

    if (!deletedShape) {
      return res.status(404).json({ message: "Shape not found" });
    }

    res.status(200).json({ message: "Shape deleted", shape: deletedShape });
  } catch (error) {
    res.status(500).json({ message: "Error deleting shape", error: error.message });
  }
});

module.exports = router;