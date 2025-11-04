// routes/user.routes.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");

// (example) Get one user (used by your Flutter getUserById)
router.get("/user/:userId", async (req, res) => {
  try {
    const doc = await User.findById(req.params.userId);
    if (!doc) return res.status(404).json({ message: "User not found" });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// (example) Get all users (used by your Flutter fetchUsers)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json({ users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ EXACT: Update user (now accepts credits)
// PUT /api/user/:userId
router.put("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Allow only whitelisted fields
    const allowed = [
      "firstName", "lastName", "email", "password",
      "accountType", "isResellerUser", "businessUserId",
      "isCompany", "companyId", "isEnabled", "status",
      "credits" // ✅ allow credits
    ];

    const $set = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        $set[k] = req.body[k];
      }
    }

    // Validate credits if present
    if ($set.hasOwnProperty("credits")) {
      const c = $set.credits;
      if (typeof c !== "number" || Number.isNaN(c)) {
        return res.status(400).json({ message: "credits must be a number" });
      }
      // Optional rule: prevent negative
      // if (c < 0) return res.status(400).json({ message: "credits cannot be negative" });
    }

    const updated = await User.findByIdAndUpdate(userId, { $set }, { new: true });
    if (!updated) return res.status(404).json({ message: "User not found" });

    // keep response shape small & safe
    return res.status(200).json({
      user: {
        _id: updated._id,
        userCode: updated.userCode,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        accountType: updated.accountType,
        isResellerUser: updated.isResellerUser,
        isCompany: updated.isCompany,
        isEnabled: updated.isEnabled,
        businessUserId: updated.businessUserId,
        companyId: updated.companyId,
        status: updated.status,
        credits: updated.credits,
      }
    });
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
