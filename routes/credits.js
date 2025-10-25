const express = require("express");
const router = express.Router();
const User = require("../models/user");
const CreditTransaction = require("../models/credits");
const axios = require('axios');

// ✅ iOS In-App Purchase Verification
// router.post("/verify-iap", async (req, res) => {
//   const { userId, productId, receipt, platform } = req.body;

//   console.log("IAP Verification Request:", { userId, productId, platform });

//   if (!userId || !receipt || !productId || platform !== 'ios') {
//     return res.status(400).json({ 
//       success: false,
//       message: "Missing required fields or invalid platform" 
//     });
//   }

//   try {
//     // Check if transaction already processed (prevent duplicates)
//     const existingTransaction = await CreditTransaction.findOne({
//       userId,
//       receiptData: receipt,
//       status: "approved"
//     });

//     if (existingTransaction) {
//       console.log("Duplicate transaction detected");
//       return res.status(200).json({ 
//         success: true,
//         message: "Transaction already processed",
//         alreadyProcessed: true
//       });
//     }

//     // Verify receipt with Apple
//     const verifyUrl = process.env.APPLE_SANDBOX_MODE === 'true' 
//       ? "https://sandbox.itunes.apple.com/verifyReceipt"
//       : "https://buy.itunes.apple.com/verifyReceipt";

//     console.log("Verifying with Apple:", verifyUrl);

//     const appleResponse = await axios.post(verifyUrl, {
//       "receipt-data": receipt,
//       "password": process.env.APPLE_SHARED_SECRET,
//       "exclude-old-transactions": true
//     });

//     const appleData = appleResponse.data;
//     console.log("Apple Response Status:", appleData.status);

//     // Handle sandbox redirect (status 21007)
//     if (appleData.status === 21007) {
//       console.log("Redirecting to sandbox...");
//       const sandboxResponse = await axios.post(
//         "https://sandbox.itunes.apple.com/verifyReceipt",
//         {
//           "receipt-data": receipt,
//           "password": process.env.APPLE_SHARED_SECRET,
//           "exclude-old-transactions": true
//         }
//       );
//       appleData.status = sandboxResponse.data.status;
//       appleData.receipt = sandboxResponse.data.receipt;
//     }

//     // Check verification status
//     if (appleData.status !== 0) {
//       console.error("Apple verification failed:", appleData.status);
//       return res.status(400).json({ 
//         success: false,
//         message: "Receipt verification failed", 
//         appleStatus: appleData.status 
//       });
//     }

//     // Map product ID to credits
//     const productCreditsMap = {
//       'com.kerachrom.starter.app': 50,
//       'com.kerachrom.premium.app': 100,
//       'com.kerachrom.ultimate.app': 200
//     };

//     const creditsToAdd = productCreditsMap[productId];

//     if (!creditsToAdd) {
//       console.error("Unknown product ID:", productId);
//       return res.status(400).json({ 
//         success: false,
//         message: "Unknown product ID" 
//       });
//     }

//     // Update user credits
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $inc: { credits: creditsToAdd } },
//       { new: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ 
//         success: false,
//         message: "User not found" 
//       });
//     }

//     // Create transaction record
//     await CreditTransaction.create({
//       userId,
//       type: "purchase",
//       amount: creditsToAdd,
//       productId,
//       receiptData: receipt,
//       platform: "ios",
//       note: `iOS In-App Purchase - ${creditsToAdd} Credits`,
//       status: "approved",
//       timestamp: new Date()
//     });

//     console.log("Credits added successfully:", creditsToAdd);

//     res.json({
//       success: true,
//       message: "Purchase verified and credits added",
//       addedCredits: creditsToAdd,
//       newBalance: updatedUser.credits
//     });

//   } catch (err) {
//     console.error("iOS verification error:", err.message);
//     res.status(500).json({ 
//       success: false,
//       message: "Server error verifying receipt",
//       error: err.message 
//     });
//   }
// });

router.post("/verify-iap", async (req, res) => {
  const { userId, "receipt-data": receiptData, productId, transactionId } = req.body;

  if (!userId || !receiptData) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    const requestBody = {
      "receipt-data": receiptData,
      "password": sharedSecret,
      "exclude-old-transactions": true,
    };

    let appleResponse = await axios.post("https://buy.itunes.apple.com/verifyReceipt", requestBody);

    // If sandbox receipt, redirect verification
    if (appleResponse.data.status === 21007) {
      appleResponse = await axios.post("https://sandbox.itunes.apple.com/verifyReceipt", requestBody);
    }

    const data = appleResponse.data;
    console.log("🍏 Apple Verification Response:", JSON.stringify(data, null, 2));

    if (data.status !== 0) {
      return res.status(400).json({ status: "error", message: "Apple receipt invalid", code: data.status });
    }

    const inApp = data.receipt?.in_app || [];
    const validTx = inApp.find((tx) => tx.transaction_id === transactionId);

    if (!validTx) {
      return res.status(400).json({ status: "error", message: "Transaction not found in receipt" });
    }

    // Prevent duplicates
    const existingTx = await CreditTransaction.findOne({ appleTransactionId: transactionId });
    if (existingTx) {
      return res.status(200).json({ status: "success", message: "Duplicate transaction ignored" });
    }

    // Determine credits based on productId
    let creditsToAdd = 0;
    if (productId === "credits_100") creditsToAdd = 100;
    if (productId === "credits_500") creditsToAdd = 500;
    if (productId === "credits_1000") creditsToAdd = 1000;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    await CreditTransaction.create({
      userId,
      productId,
      appleTransactionId: transactionId,
      credits: creditsToAdd,
      receiptData,
      status: "approved",
      method: "iap",
    });

    res.status(200).json({
      status: "success",
      addedCredits: creditsToAdd,
      newBalance: updatedUser.credits,
    });
  } catch (err) {
    console.error("❌ IAP verification error:", err.response?.data || err.message);
    res.status(500).json({ status: "error", message: "Server error verifying receipt" });
  }
});


// ✅ Get all purchases (for admin)
router.get("/all-purchases", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ type: "purchase" })
      .sort({ timestamp: -1 })
      .populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Manual purchase submission (PayPal/Bank Transfer)
router.post("/purchase", async (req, res) => {
  const { userId, amount, note, screenshotUrl } = req.body;

  if (!userId || !amount || !screenshotUrl) {
    return res.status(400).json({ 
      success: false,
      message: "Missing required fields" 
    });
  }

  try {
    const transaction = await CreditTransaction.create({
      userId,
      type: "purchase",
      amount,
      note: note || "Manual purchase request",
      screenshotUrl,
      platform: "manual",
      status: "pending",
      timestamp: new Date()
    });

    res.status(200).json({ 
      success: true,
      message: "Purchase request submitted", 
      transactionId: transaction._id 
    });
  } catch (err) {
    console.error("Purchase submission error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to submit purchase request" 
    });
  }
});

// ✅ Get pending purchases (for admin)
router.get("/pending", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      type: "purchase", 
      status: "pending" 
    }).populate("userId", "firstName lastName email")
      .sort({ timestamp: -1 });
    
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Approve manual purchase (admin only)
router.post("/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount } = req.body;

    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ message: "Transaction already processed" });
    }

    const creditsToAdd = approvedAmount || transaction.amount;

    // Update transaction
    transaction.status = "approved";
    transaction.approvedAmount = creditsToAdd;
    await transaction.save();

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    res.json({ 
      success: true,
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

// ✅ Reject manual purchase (admin only)
router.post("/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ message: "Transaction already processed" });
    }

    transaction.status = "rejected";
    transaction.note = reason || "Purchase rejected by admin";
    await transaction.save();
    
    res.json({ 
      success: true,
      message: "Purchase rejected", 
      transaction 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get user's credit transactions
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

// ✅ Deduct credits (for downloads/usage)
router.post('/deduct', async (req, res) => {
  const { userId, amount, note } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: 'Missing data' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits < amount) {
      return res.status(400).json({ 
        message: 'Insufficient credits',
        currentBalance: user.credits,
        required: amount
      });
    }

    user.credits -= amount;
    await user.save();

    // Log transaction
    await CreditTransaction.create({
      userId,
      type: "usage",
      amount,
      note: note || "Credits deducted for usage",
      status: "approved",
      timestamp: new Date()
    });

    res.json({ 
      success: true,
      message: 'Credits deducted', 
      newBalance: user.credits 
    });
  } catch (err) {
    console.error("Deduct error:", err);
    res.status(500).json({ message: "Failed to deduct credits" });
  }
});

// ✅ Refund credits
router.post('/refund', async (req, res) => {
  const { userId, amount, note } = req.body;

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

    await CreditTransaction.create({
      userId,
      type: "refund",
      amount,
      note: note || "Credits refunded",
      status: "approved",
      timestamp: new Date()
    });

    res.json({ 
      success: true,
      message: 'Credits refunded', 
      newBalance: user.credits 
    });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ message: "Failed to refund credits" });
  }
});

module.exports = router;