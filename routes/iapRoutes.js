// routes/credits.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const CreditTransaction = require('../models/CreditTransaction'); // ⚠️ Import karein

// ============= EXISTING ROUTES (Already hain) =============

// Legacy purchase request (Web/Android)
router.post('/api/credits/purchase', async (req, res) => {
  // ... existing code ...
});

// Get purchase history
router.get('/api/credits/:userId', async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      userId: req.params.userId 
    }).sort({ timestamp: -1 });
    
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= 🔥 NEW IAP ENDPOINT (Add karna hai) =============

router.post('/api/credits/iap-purchase', async (req, res) => {
  try {
    const { userId, purchaseId, productId, credits, platform, transactionDate } = req.body;

    // Validation
    if (!userId || !purchaseId || !productId || !credits) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // 1. Check if purchase already processed (prevent duplicate credits)
    const existingPurchase = await CreditTransaction.findOne({ 
      purchaseId: purchaseId 
    });

    if (existingPurchase) {
      console.log(`Duplicate purchase detected: ${purchaseId}`);
      return res.status(400).json({ 
        error: 'Purchase already processed',
        newBalance: existingPurchase.userBalance 
      });
    }

    // 2. Find user and update credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.credits = (user.credits || 0) + credits;
    await user.save();

    // 3. Save transaction record
    const transaction = new CreditTransaction({
      userId,
      purchaseId,
      productId,
      credits,
      platform,
      status: 'approved',
      timestamp: transactionDate || new Date(),
      userBalance: user.credits
    });
    await transaction.save();

    console.log(`✅ IAP Purchase successful: ${purchaseId} - User: ${userId} - Credits: ${credits}`);

    res.status(200).json({
      success: true,
      newBalance: user.credits,
      transaction: transaction
    });

  } catch (error) {
    console.error('IAP purchase error:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

module.exports = router;