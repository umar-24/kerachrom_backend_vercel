const express = require("express");
const router = express.Router();
const Templates = require("../models/templates");

// POST: Add new templates
router.post("/api/templates", async (req, res) => {
  try {
    const { template_urls } = req.body;

    if (!template_urls || !Array.isArray(template_urls) || template_urls.length === 0) {
      return res.status(400).json({ message: "Invalid template_urls." });
    }

    for (const item of template_urls) {
      if (!item.url || !item.shape) {  // Removed shape validation against enum
        return res.status(400).json({ message: "Invalid url or shape." });
      }
    }

    let templateDoc = await Templates.findOne() || new Templates({ template_urls: [] });

    for (const newTemplate of template_urls) {
      if (!templateDoc.template_urls.some(t => t.url === newTemplate.url)) {
        templateDoc.template_urls.push(newTemplate);
      }
    }

    await templateDoc.save();
    res.status(201).json({
      message: "Templates with variants uploaded successfully",
      templates: templateDoc.template_urls
    });
  } catch (error) {
    res.status(400).json({ message: "Error uploading templates", error: error.message });
  }
});

// GET: Retrieve all templates
router.get("/api/templates", async (req, res) => {
  try {
    const templateDoc = await Templates.findOne();
    res.status(200).json({ message: "Templates retrieved successfully", templates: templateDoc?.template_urls || [] });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving templates", error: error.message });
  }
});

// PUT: Update specific template by ID
router.put("/api/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { url, shape, variants } = req.body;

    if (!url || !shape) {  // No need to validate shape anymore
      return res.status(400).json({ message: "Must provide valid URL and shape" });
    }

    const templateDoc = await Templates.findOne();
    if (!templateDoc) return res.status(404).json({ message: "No templates found" });

    const templateIndex = templateDoc.template_urls.findIndex(t => t._id == id);
    if (templateIndex === -1) return res.status(404).json({ message: "Template not found" });

    templateDoc.template_urls[templateIndex] = { _id: id, url, shape, variants };
    await templateDoc.save();

    res.status(200).json({ message: "Template updated successfully", template: templateDoc.template_urls[templateIndex] });
  } catch (error) {
    res.status(500).json({ message: "Error updating template", error: error.message });
  }
});

// DELETE: Delete specific template by ID
router.delete("/api/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const templateDoc = await Templates.findOne();
    if (!templateDoc) return res.status(404).json({ message: "No templates found" });

    const initialLength = templateDoc.template_urls.length;
    templateDoc.template_urls = templateDoc.template_urls.filter(t => t._id != id);

    if (templateDoc.template_urls.length === initialLength) {
      return res.status(404).json({ message: "Template not found" });
    }

    await templateDoc.save();
    res.status(200).json({ message: "Template deleted successfully", remainingTemplates: templateDoc.template_urls });
  } catch (error) {
    res.status(500).json({ message: "Error deleting template", error: error.message });
  }
});

module.exports = router;
