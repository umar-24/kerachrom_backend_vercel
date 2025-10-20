const express = require("express");
const Category = require("../models/Category");

const catgRouter = express.Router();

// POST - Create category
catgRouter.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });

    const existing = await Category.findOne({ name });
    if (existing) return res.status(400).json({ message: "Category already exists" });

    const category = new Category({ name });
    await category.save();
    res.status(201).json({ message: "Category created", category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - All categories
catgRouter.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT - Update category
catgRouter.put("/api/categories/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Category updated", category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE - Delete category
catgRouter.delete("/api/categories/:id", async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = catgRouter;
