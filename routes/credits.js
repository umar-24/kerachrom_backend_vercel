const express = require("express");
const router = express.Router();
const User = require("../models/user");
const CreditTransaction = require("../models/credits");



// POST /api/credits/verify-ios
router.post("/verify-ios", async (req, res) => {
  const { userId, receiptData, productId } = req.body;

  if (!userId || !receiptData || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Use Apple's verify endpoint
    const verifyUrl = "https://buy.itunes.apple.com/verifyReceipt"; // or sandbox: https://sandbox.itunes.apple.com/verifyReceipt
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        "password": process.env.APPLE_SHARED_SECRET, // from App Store Connect
        "exclude-old-transactions": true
      }),
    });

    const data = await response.json();

    // Check Apple verification response
    if (data.status !== 0) {
      return res.status(400).json({ message: "Invalid receipt", appleStatus: data.status });
    }

    // Determine credits based on productId
    let creditsToAdd = 0;
    switch (productId) {
      case "credits_50":
        creditsToAdd = 50;
        break;
      case "credits_100":
        creditsToAdd = 100;
        break;
      default:
        creditsToAdd = 0;
    }

    if (creditsToAdd === 0) {
      return res.status(400).json({ message: "Unknown product ID" });
    }

    // Update user credits
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    // Log transaction
    await CreditTransaction.create({
      userId,
      type: "purchase",
      amount: creditsToAdd,
      note: `iOS In-App Purchase (${productId})`,
      status: "approved",
    });

    res.json({
      message: "iOS purchase verified successfully",
      addedCredits: creditsToAdd,
      newBalance: updatedUser.credits,
    });
  } catch (err) {
    console.error("iOS verification error:", err);
    res.status(500).json({ message: "Server error verifying receipt" });
  }
});



// Add this to your credits routes file
router.get("/all-purchases", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ type: "purchase" })
      .sort({ timestamp: -1 }) // Newest first
      .populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching all purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve credit purchase
router.post("/purchase", async (req, res) => {
  const { userId, amount, note, screenshotUrl } = req.body;

  if (!userId || !amount || !screenshotUrl) {
    return res.status(400).send("Missing required fields");
  }

  const transaction = new CreditTransaction({
    userId,
    type: "purchase",
    amount,
    note: note || "Purchase request submitted",
    screenshotUrl,
    status: "pending"
  });

  await transaction.save();
  res.status(200).send({ message: "Purchase request submitted", transactionId: transaction._id });
});

// Get all pending purchase requests
router.get("/pending", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      type: "purchase", 
      status: "pending" 
    }).populate("userId", "firstName lastName email");
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve a purchase request
router.post("/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount } = req.body;

    // 1. Find the transaction (don't modify its amount)
    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // 2. Calculate the amount to add (use approvedAmount if provided, otherwise original amount)
    const creditsToAdd = approvedAmount || transaction.amount;

    // 3. Update transaction status ONLY
    transaction.status = "approved";
    await transaction.save();

    // 4. Increment user's credits
    const updatedUser = await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { credits: creditsToAdd } }, // Adds to existing credits
      { new: true }
    );

    // 5. Add to transaction history (with original amount)
    await User.findByIdAndUpdate(
      transaction.userId,
      { 
        $push: { 
          transactions: {
            type: "purchase",
            amount: transaction.amount, // Original amount
            note: `Credits purchased (${transaction._id})`,
            timestamp: new Date()
          }
        }
      }
    );

    res.json({ 
      message: "Purchase approved",
      transactionAmount: transaction.amount, // Original amount
      addedAmount: creditsToAdd, // Actual amount added (might differ if adjusted)
      newBalance: updatedUser.credits
    });
    
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ message: err.message });
  }
});
// Reject a purchase request
router.post("/reject/:id", async (req, res) => {
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
    
    res.json({ message: "Purchase rejected", transaction });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Get user's credit transactions
router.get("/:userId", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.params.userId,
      type: "purchase"
    }).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-password"); // Exclude password from response
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// POST /api/credits/deduct
router.post('/deduct', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.credits < amount) {
    return res.status(400).json({ message: 'Insufficient credits' });
  }

  user.credits -= amount;

  // Add to transaction log (optional)
  await CreditTransaction.create({
    userId,
    type: "usage",
    amount,
    note: `Deducted for download`,
    status: "approved"
  });

  await user.save();

  res.json({ message: 'Credits deducted', newBalance: user.credits });
});

// POST /api/credits/refund
router.post('/refund', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Business logic: only refund if user's credits are low enough to assume deduction happened
  if (user.credits + amount > user.maxCreditsAllowed) {
    return res.status(400).json({ message: 'Credits were not deducted previously' });
  }

  user.credits += amount;

  await CreditTransaction.create({
    userId,
    type: "purchase",
    amount,
    note: `Refunded after cancel`,
    status: "approved"
  });

  await user.save();

  res.json({ message: 'Credits refunded', newBalance: user.credits });
});


module.exports = router;