const express = require("express");
const router = express.Router();
const User = require("../models/user");
const CreditTransaction = require("../models/credits");

// ✅ iOS In-App Purchase Verification
router.post("/verify-ios", async (req, res) => {
  const { userId, receiptData, productId } = req.body;

  if (!userId || !receiptData || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Determine environment
    const isSandbox = process.env.APPLE_SANDBOX === 'true';
    const verifyUrl = isSandbox
      ? "https://sandbox.itunes.apple.com/verifyReceipt"
      : "https://buy.itunes.apple.com/verifyReceipt";

    console.log(`🔍 Verifying iOS receipt for ${productId} (${isSandbox ? 'sandbox' : 'production'})`);

    // Call Apple's verification API
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        "password": process.env.APPLE_SHARED_SECRET,
        "exclude-old-transactions": true
      }),
    });

    const data = await response.json();
    console.log('📡 Apple response status:', data.status);

    // Handle sandbox receipt sent to production
    if (data.status === 21007) {
      console.log('🔄 Sandbox receipt detected, retrying with sandbox URL');
      return res.status(400).json({ 
        message: "Use sandbox environment", 
        appleStatus: data.status 
      });
    }

    // Check verification status
    if (data.status !== 0) {
      console.error('❌ Invalid receipt:', data.status);
      return res.status(400).json({ 
        message: "Invalid receipt", 
        appleStatus: data.status 
      });
    }

    // Determine credits based on productId
    let creditsToAdd = 0;
    switch (productId) {
      case "com.kerachrom.starter.app":
        creditsToAdd = 50; // or whatever your product gives
        break;
      case "credits_100":
        creditsToAdd = 100;
        break;
      default:
        console.error('❌ Unknown product ID:', productId);
        return res.status(400).json({ message: "Unknown product ID" });
    }

    console.log(`💰 Adding ${creditsToAdd} credits to user ${userId}`);

    // Update user credits
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log transaction
    await CreditTransaction.create({
      userId,
      type: "purchase",
      amount: creditsToAdd,
      productId: productId,
      note: `iOS In-App Purchase (${productId})`,
      status: "approved",
      timestamp: new Date()
    });

    console.log('✅ Purchase verified successfully');
    
    res.json({
      message: "iOS purchase verified successfully",
      addedCredits: creditsToAdd,
      newBalance: updatedUser.credits,
    });
  } catch (err) {
    console.error("❌ iOS verification error:", err);
    res.status(500).json({ message: "Server error verifying receipt" });
  }
});

// ✅ Get User Credits
router.get("/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("credits firstName lastName email");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ credits: user.credits });
  } catch (err) {
    console.error("Error fetching user credits:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get User's Purchase History
router.get("/:userId", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.params.userId,
      type: "purchase"
    }).sort({ timestamp: -1 });
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching purchase history:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get All Purchases (Admin)
router.get("/admin/all-purchases", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ type: "purchase" })
      .sort({ timestamp: -1 })
      .populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching all purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get Pending Purchases (Admin)
router.get("/admin/pending", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      type: "purchase", 
      status: "pending" 
    }).populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching pending purchases:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Approve Purchase (Admin)
router.post("/admin/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount } = req.body;

    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const creditsToAdd = approvedAmount || transaction.amount;

    // Update transaction status
    transaction.status = "approved";
    await transaction.save();

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    console.log(`✅ Approved ${creditsToAdd} credits for user ${transaction.userId}`);

    res.json({ 
      message: "Purchase approved",
      transactionAmount: transaction.amount,
      addedAmount: creditsToAdd,
      newBalance: updatedUser.credits
    });
    
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Reject Purchase (Admin)
router.post("/admin/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await CreditTransaction.findByIdAndUpdate(
      id,
      { 
        status: "rejected",
        note: reason || "Purchase rejected" 
      },
      { new: true }
    );
    
    console.log(`❌ Rejected transaction ${id}`);
    res.json({ message: "Purchase rejected", transaction });
  } catch (err) {
    console.error("Rejection error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Deduct Credits (for downloads, etc.)
router.post('/deduct', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: 'Missing data' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits < amount) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    user.credits -= amount;
    await user.save();

    // Log transaction
    await CreditTransaction.create({
      userId,
      type: "usage",
      amount: -amount,
      note: `Credits deducted for download`,
      status: "approved",
      timestamp: new Date()
    });

    console.log(`💸 Deducted ${amount} credits from user ${userId}`);
    res.json({ message: 'Credits deducted', newBalance: user.credits });
  } catch (err) {
    console.error("Deduction error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Refund Credits
router.post('/refund', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: 'Missing data' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.credits += amount;
    await user.save();

    // Log refund transaction
    await CreditTransaction.create({
      userId,
      type: "refund",
      amount: amount,
      note: `Refunded after cancellation`,
      status: "approved",
      timestamp: new Date()
    });

    console.log(`🔄 Refunded ${amount} credits to user ${userId}`);
    res.json({ message: 'Credits refunded', newBalance: user.credits });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;