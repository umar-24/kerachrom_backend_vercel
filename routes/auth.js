// const express = require("express");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/user");
// const sendEmail = require("../utils/sendEmail");
// const Otp = require("../models/otp"); // New Otp model (temp storage)
// const authRouter = express.Router();

// // ✅ SIGNUP
// authRouter.post("/api/signup", async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       email,
//       password,
//       accountType,
//       isResellerUser,
//       businessUserId,
//       isCompany,
//       companyId,
//       isEnabled,
//       address,
//       city,
//       state,
//       country,
//       telephone,
//     } = req.body;

//     if (!email || !password || !firstName || !lastName) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       if (existingUser.status !== "-1") {
//         return res.status(400).json({ message: "Email already exists" });
//       } else {
//         await User.deleteOne({ _id: existingUser._id }); // Optionally remove the old user
//       }
//     }
    

//     if (password.length < 8) {
//       return res
//         .status(400)
//         .json({ message: "Password must be at least 8 characters long" });
//     }

//     if (isCompany && !businessUserId) {
//       return res
//         .status(400)
//         .json({ message: "businessUserId is required for companies" });
//     }

//     if (isResellerUser && !companyId) {
//       return res
//         .status(400)
//         .json({ message: "companyId is required for reseller users" });
//     }

//     let userCode = "";
//     if (!businessUserId) {
//       let standaloneCount = await User.countDocuments({ businessUserId: null });
//       userCode = `A${String(standaloneCount + 1).padStart(3, "0")}`;
//     } else {
//       let businessUserCount = await User.countDocuments({ businessUserId });
//       userCode = String(businessUserCount + 1).padStart(3, "0");
//     }

//     // Ensure userCode is unique
//     while (await User.findOne({ userCode })) {
//       const lastCode = parseInt(userCode.replace("A", "")) + 1;
//       userCode = `A${String(lastCode).padStart(3, "0")}`;
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     let status = "0"; // Default: under review
//     if (isResellerUser || isCompany) {
//       status = "1"; // Auto-approved
//     }

//     let newUser = new User({
//       firstName,
//       lastName,
//       email,
//       password: hashedPassword,
//       accountType: isResellerUser ? "Personal" : accountType,
//       isResellerUser: !!isResellerUser,
//       businessUserId: businessUserId || null,
//       isCompany: !!isCompany,
//       companyId: isResellerUser ? companyId : null,
//       userCode,
//       isEnabled: isEnabled ?? true,
//       status,
//       address,
//       city,
//       state,
//       country,
//       telephone,
//     });

//     newUser = await newUser.save();

//    const adminEmail = "Info@kerachrom.it"; // Replace with actual admin email

// if (!isCompany && !isResellerUser) {
//   // Send email to the user
//   await sendEmail({
//     to: email,
//     subject: "Account Under Review",
//     text: "Your account is currently under review.",
//     html: "<p>Your account is currently under review.</p>",
//   });

//   // Send email to the admin
//   await sendEmail({
//     to: adminEmail,
//     subject: "New User Signup Notification",
//     text: `A new user signed up:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nAccount Type: ${accountType}`,
//     html: `
//       <h3>New User Signup</h3>
//       <p><strong>Name:</strong> ${firstName} ${lastName}</p>
//       <p><strong>Email:</strong> ${email}</p>
//       <p><strong>Account Type:</strong> ${accountType}</p>
//     `,
//   });
// }

    

//     res.status(201).json({ message: "User registered", user: newUser });
//   } catch (error) {
//     console.error("Signup Error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // ✅ SIGNIN
// authRouter.post("/api/signin", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const findUser = await User.findOne({ email });
//     if (!findUser) return res.status(400).json({ message: "Invalid Email" });

//     if (findUser.status === "-1") {
//       return res
//         .status(400)
//         .json({ message: "No account exists or invalid email" });
//     }

//     if (findUser.status === "0") {
//       return res.status(403).json({ message: "Your account is under review" });
//     }

//     const isMatch = await bcrypt.compare(password, findUser.password);
//     if (!isMatch) return res.status(400).json({ message: "Invalid Password" });

//     const token = jwt.sign({ id: findUser._id }, "passwordKey");
//     const { password: pwd, ...userData } = findUser._doc;

//     res.json({ token, ...userData });
//   } catch (error) {
//     console.error("Signin Error:", error);
//     res.status(500).json({ message: "Error signing in", error: error.message });
//   }
// });

// // ✅ UPDATE USER
// authRouter.put("/api/user/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const {
//       firstName,
//       lastName,
//       email,
//       password,
//       accountType,
//       isResellerUser,
//       businessUserId,
//       isCompany,
//       companyId,
//       isEnabled,
//       status: newStatus,
//       address, // ✅ New
//       city, // ✅ New
//       telephone, // ✅ New
//       state,
//       country,
//     } = req.body;

//     console.log("🔁 Incoming user update request:", req.body);

//     let user = await User.findById(id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     const oldStatus = user.status;
//     console.log("🧪 Status check:", { oldStatus, newStatus });

//     if (email && email !== user.email) {
//       const emailExists = await User.findOne({ email });
//       if (emailExists) {
//         return res.status(400).json({ message: "Email already in use" });
//       }
//     }

//     let hashedPassword = user.password;
//     if (password && password.length >= 8) {
//       const salt = await bcrypt.genSalt(10);
//       hashedPassword = await bcrypt.hash(password, salt);
//     } else if (password) {
//       return res.status(400).json({
//         message: "Password must be at least 8 characters",
//       });
//     }

//     if (
//       accountType &&
//       !["Personal", "Business", "admin"].includes(accountType)
//     ) {
//       return res.status(400).json({ message: "Invalid account type" });
//     }

//     if (isCompany && !businessUserId) {
//       return res.status(400).json({
//         message: "businessUserId is required for companies",
//       });
//     }

//     if (isResellerUser && !companyId) {
//       return res.status(400).json({
//         message: "companyId is required for reseller users",
//       });
//     }

//     const updatedUser = await User.findByIdAndUpdate(
//       id,
//       {
//         firstName,
//         lastName,
//         email,
//         password: hashedPassword,
//         accountType,
//         isResellerUser,
//         businessUserId: isCompany
//           ? businessUserId
//           : isResellerUser
//           ? companyId
//           : null,
//         isCompany,
//         companyId: isResellerUser ? companyId : null,
//         isEnabled,
//         status: newStatus,
//         address,   // ✅ Added
//         city,      // ✅ Added
//         telephone, // ✅ Added
//         state,
//         country,
//       },
//       { new: true, select: "-password" }
//     );

//     // ✅ Check for approval email condition
//     if (oldStatus === "0" && newStatus === "1") {
//       console.log(
//         "📤 Status changed from under review to approved, sending email..."
//       );

//       try {
//         console.log("📧 Sending email to:", updatedUser.email);
//         await sendEmail({
//           to: updatedUser.email,
//           subject: "Account Approved",
//           html: `<p>Hello ${updatedUser.firstName},</p><p>Your account has been approved. You may now access the platform.</p>`,
//         });
//         console.log("✅ Approval email sent");
//       } catch (emailErr) {
//         console.error("❌ Error sending approval email:", emailErr);
//       }
//     } else {
//       console.log("error not enter in if block");
//     }
//     res.json({ message: "User updated successfully", user: updatedUser });
//   } catch (error) {
//     console.error("🔥 Update User Error:", error);
//     res
//       .status(500)
//       .json({ message: "Error updating user", error: error.message });
//   }
// });
// // ✅ forget-password
// authRouter.post("/api/forgot-password", async (req, res) => {
//   try {
//     const { email } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "Email does not exist" });

//     const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

//     await Otp.deleteMany({ email }); // Remove old OTPs

//     await new Otp({ email, code: otpCode }).save();

//     await sendEmail({
//       to: email,
//       subject: "Reset Password OTP",
//       html: `<p>Your OTP code is: <b>${otpCode}</b></p>`,
//     });

//     res.json({ message: "OTP sent successfully" });
//   } catch (error) {
//     console.error("Error sending OTP:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
// // ✅ verify-OTP
// authRouter.post("/api/verify-otp", async (req, res) => {
//   const { email, otp } = req.body;

//   const record = await Otp.findOne({ email, code: otp });
//   if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

//   await Otp.deleteMany({ email }); // clean up OTP
//   res.json({ message: "OTP verified" });
// });
// // ✅ reset-password
// authRouter.post("/api/reset-password", async (req, res) => {
//   const { email, password } = req.body;

//   if (!password || password.length < 8) {
//     return res.status(400).json({ message: "Password must be at least 8 characters" });
//   }

//   const user = await User.findOne({ email });
//   if (!user) return res.status(404).json({ message: "User not found" });

//   const hashed = await bcrypt.hash(password, 10);
//   user.password = hashed;
//   await user.save();

//   res.json({ message: "Password updated successfully" });
// });
// // Get all users
// authRouter.get("/api/users", async (req, res) => {
//   try {
//     const users = await User.find().select("-password"); // Exclude password field
//     res.json({ message: "Users retrieved successfully", users });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error fetching users", error: error.message });
//   }
// });
// // Update User API
// // ✏️ Update User Route
// // authRouter.put("/api/user/:id", async (req, res) => {
// //   try {
// //     const { id } = req.params;

// //     // Explicitly convert status to number
// //     const {
// //       firstName,
// //       lastName,
// //       email,
// //       password,
// //       accountType,
// //       isResellerUser,
// //       businessUserId,
// //       isCompany,
// //       companyId,
// //       isEnabled,
// //     } = req.body;

// //     const status = req.body.status !== undefined ? Number(req.body.status) : undefined;

// //     let user = await User.findById(id);
// //     if (!user) return res.status(404).json({ message: "User not found" });

// //     if (email && email !== user.email) {
// //       const emailExists = await User.findOne({ email });
// //       if (emailExists) {
// //         return res.status(400).json({ message: "Email already in use" });
// //       }
// //     }

// //     let hashedPassword = user.password;
// //     if (password && password.length >= 8) {
// //       const salt = await bcrypt.genSalt(10);
// //       hashedPassword = await bcrypt.hash(password, salt);
// //     } else if (password) {
// //       return res
// //         .status(400)
// //         .json({ message: "Password must be at least 8 characters" });
// //     }

// //     if (accountType && !["Personal", "Business", "admin"].includes(accountType)) {
// //       return res.status(400).json({ message: "Invalid account type" });
// //     }

// //     if (isCompany && !businessUserId) {
// //       return res.status(400).json({
// //         message: "businessUserId is required for companies",
// //       });
// //     }

// //     if (isResellerUser && !companyId) {
// //       return res.status(400).json({
// //         message: "companyId is required for reseller users",
// //       });
// //     }

// //     const oldStatus = user.status;

// //     // 🔧 Update user
// //     user = await User.findByIdAndUpdate(
// //       id,
// //       {
// //         firstName,
// //         lastName,
// //         email,
// //         password: hashedPassword,
// //         accountType,
// //         isResellerUser,
// //         businessUserId: isCompany
// //           ? businessUserId
// //           : isResellerUser
// //           ? companyId
// //           : null,
// //         isCompany,
// //         companyId: isResellerUser ? companyId : null,
// //         isEnabled,
// //         status,
// //       },
// //       { new: true, select: "-password" }
// //     );

// //     // 📧 Send approval email
// //     if (status === "1" && oldStatus === "0") {
// //       await sendEmail({
// //         to: user.email,
// //         subject: "Account Approved",
// //         html: `<p>Hello ${user.firstName},</p><p>Your account has been approved. You may now access the platform.</p>`,
// //       });
// //     }

// //     res.json({ message: "User updated successfully", user });
// //   } catch (error) {
// //     console.error("🔥 Update User Error:", error);
// //     res
// //       .status(500)
// //       .json({ message: "Error updating user", error: error.message });
// //   }
// // });
// // fetch resealler users
// authRouter.get("/api/resellers/:businessUserId", async (req, res) => {
//   try {
//     const { businessUserId } = req.params;

//     // Validate if the provided ID belongs to a business user
//     const businessUser = await User.findById(businessUserId);
//     if (!businessUser || businessUser.accountType !== "Business") {
//       return res
//         .status(403)
//         .json({ message: "Only business users can fetch reseller users" });
//     }

//     // Fetch all reseller users linked to this business user
//     const resellers = await User.find({ businessUserId }).select("-password");

//     res.json({
//       message: "Reseller users retrieved successfully",
//       resellers,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error fetching reseller users", error: error.message });
//   }
// });
// authRouter.get("/api/company/resellers", async (req, res) => {
//   try {
//     const { userId } = req.query; // Get Company ID from query

//     const companyUser = await User.findById(userId);
//     if (!companyUser || !companyUser.isCompany) {
//       return res
//         .status(403)
//         .json({
//           message:
//             "Access denied. Only Company users can fetch reseller users.",
//         });
//     }

//     const resellers = await User.find({
//       companyId: userId,
//       isResellerUser: true,
//     }); // Fetch Resellers
//     res.json({ resellers });
//   } catch (e) {
//     console.error("🔥 Fetch Resellers Error:", e);
//     res.status(500).json({ error: e.message });
//   }
// });
// // Fetch all companies created by a business user
// authRouter.get("/api/business/companies/:businessUserId", async (req, res) => {
//   try {
//     const { businessUserId } = req.params;

//     // Validate if the provided ID belongs to a business user
//     const businessUser = await User.findById(businessUserId);
//     if (!businessUser || businessUser.accountType !== "Business") {
//       return res
//         .status(403)
//         .json({ message: "Only business users can fetch their companies" });
//     }

//     // Fetch all companies linked to this business user
//     const companies = await User.find({
//       businessUserId,
//       isCompany: true,
//     }).select("-password");

//     res.json({
//       message: "Companies retrieved successfully",
//       companies,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error fetching companies", error: error.message });
//   }
// });
// // Update Password
// authRouter.put("/api/user/:id/change-password", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { currentPassword, newPassword, confirmPassword } = req.body;

//     // 1. Validate inputs
//     if (!currentPassword || !newPassword || !confirmPassword) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.status(400).json({ message: "New passwords don't match" });
//     }

//     if (newPassword.length < 8) {
//       return res.status(400).json({
//         message: "Password must be at least 8 characters long",
//       });
//     }

//     // 2. Verify user exists
//     const user = await User.findById(id).select("+password");
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // 3. Verify current password
//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Current password is incorrect" });
//     }

//     // 4. Hash and save new password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newPassword, salt);

//     await User.findByIdAndUpdate(id, {
//       password: hashedPassword,
//       updatedAt: Date.now(),
//     });

//     // 5. Invalidate existing sessions/tokens if needed
//     // (Implementation depends on your auth system)

//     res.json({ message: "Password updated successfully" });
//   } catch (error) {
//     console.error("Password change error:", error);
//     res.status(500).json({ message: "Error changing password" });
//   }
// });
// authRouter.get("/api/business/companies/:businessUserId", async (req, res) => {
//   try {
//     const { businessUserId } = req.params;

//     // Validate if the provided ID belongs to a business user
//     const businessUser = await User.findById(businessUserId);
//     if (!businessUser || businessUser.accountType !== "Business") {
//       return res
//         .status(403)
//         .json({ message: "Only business users can fetch their companies" });
//     }

//     // Fetch all companies linked to this business user
//     const companies = await User.find({
//       businessUserId,
//       isCompany: true,
//     }).select("-password");

//     res.json({
//       message: "Companies retrieved successfully",
//       companies,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error fetching companies", error: error.message });
//   }
// });

// // GET /api/user/:id - Get a single user by ID
// authRouter.get("/api/user/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const user = await User.findById(id).select("-password"); // Exclude password from response

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json(user);
//   } catch (error) {
//     console.error("🔥 Get User Error:", error);
//     res
//       .status(500)
//       .json({ message: "Error retrieving user", error: error.message });
//   }
// });

// module.exports = authRouter;





const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const sendEmail = require("../utils/sendEmail");
const Otp = require("../models/otp");
const authRouter = express.Router();

// ---- helpers: jwt ----
const JWT_SECRET = process.env.JWT_SECRET || "passwordKey"; // TODO: use env in prod

// ---- simple auth middleware ----
function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id || decoded.sub;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ✅ SIGNUP
authRouter.post("/api/signup", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      accountType,
      isResellerUser,
      businessUserId,
      isCompany,
      companyId,
      isEnabled,
      address,
      city,
      state,
      country,
      telephone,
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.status !== "-1") {
        return res.status(400).json({ message: "Email already exists" });
      } else {
        await User.deleteOne({ _id: existingUser._id });
      }
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    if (isCompany && !businessUserId) {
      return res
        .status(400)
        .json({ message: "businessUserId is required for companies" });
    }

    if (isResellerUser && !companyId) {
      return res
        .status(400)
        .json({ message: "companyId is required for reseller users" });
    }

    let userCode = "";
    if (!businessUserId) {
      let standaloneCount = await User.countDocuments({ businessUserId: null });
      userCode = `A${String(standaloneCount + 1).padStart(3, "0")}`;
    } else {
      let businessUserCount = await User.countDocuments({ businessUserId });
      userCode = String(businessUserCount + 1).padStart(3, "0");
    }

    while (await User.findOne({ userCode })) {
      const lastCode = parseInt(userCode.replace("A", "")) + 1;
      userCode = `A${String(lastCode).padStart(3, "0")}`;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let status = "0"; // under review
    if (isResellerUser || isCompany) status = "1"; // auto-approved

    let newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      accountType: isResellerUser ? "Personal" : accountType,
      isResellerUser: !!isResellerUser,
      businessUserId: businessUserId || null,
      isCompany: !!isCompany,
      companyId: isResellerUser ? companyId : null,
      userCode,
      isEnabled: isEnabled ?? true,
      status,
      address,
      city,
      state,
      country,
      telephone,
    });

    newUser = await newUser.save();

    const adminEmail = "Info@kerachrom.it";

    if (!isCompany && !isResellerUser) {
      await sendEmail({
        to: email,
        subject: "Account Under Review",
        text: "Your account is currently under review.",
        html: "<p>Your account is currently under review.</p>",
      });

      await sendEmail({
        to: adminEmail,
        subject: "New User Signup Notification",
        text: `A new user signed up:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nAccount Type: ${accountType}`,
        html: `
          <h3>New User Signup</h3>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Account Type:</strong> ${accountType}</p>
        `,
      });
    }

    res.status(201).json({ message: "User registered", user: newUser });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ SIGNIN
authRouter.post("/api/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ email });
    if (!findUser) return res.status(400).json({ message: "Invalid Email" });

    if (findUser.status === "-1") {
      return res
        .status(400)
        .json({ message: "No account exists or invalid email" });
    }

    if (findUser.status === "0") {
      return res.status(403).json({ message: "Your account is under review" });
    }

    const isMatch = await bcrypt.compare(password, findUser.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Password" });

    const token = jwt.sign({ id: findUser._id }, JWT_SECRET, { expiresIn: "7d" });
    const { password: pwd, ...userData } = findUser._doc;

    res.json({ token, ...userData });
  } catch (error) {
    console.error("Signin Error:", error);
    res.status(500).json({ message: "Error signing in", error: error.message });
  }
});

// ✅ UPDATE USER (email/fields)
authRouter.put("/api/user/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      firstName,
      lastName,
      email,
      password,
      accountType,
      isResellerUser,
      businessUserId,
      isCompany,
      companyId,
      isEnabled,
      status: newStatus,
      address,
      city,
      telephone,
      state,
      country,
      // optional guard: currentPassword (agar aap enforce karna chahen)
      currentPassword,
    } = req.body;

    let user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldStatus = user.status;

    if (email && email !== user.email) {
      // (Optional) Enforce current password if email change is sensitive
      if (currentPassword) {
        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(401).json({ message: "Wrong password" });
      }

      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    let hashedPassword = user.password;
    if (password && password.length >= 8) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    } else if (password) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    if (
      accountType &&
      !["Personal", "Business", "admin"].includes(accountType)
    ) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    if (isCompany && !businessUserId) {
      return res.status(400).json({
        message: "businessUserId is required for companies",
      });
    }

    if (isResellerUser && !companyId) {
      return res.status(400).json({
        message: "companyId is required for reseller users",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        accountType,
        isResellerUser,
        businessUserId: isCompany
          ? businessUserId
          : isResellerUser
          ? companyId
          : null,
        isCompany,
        companyId: isResellerUser ? companyId : null,
        isEnabled,
        status: newStatus,
        address,
        city,
        telephone,
        state,
        country,
      },
      { new: true, select: "-password" }
    );

    if (oldStatus === "0" && newStatus === "1") {
      try {
        await sendEmail({
          to: updatedUser.email,
          subject: "Account Approved",
          html: `<p>Hello ${updatedUser.firstName},</p><p>Your account has been approved. You may now access the platform.</p>`,
        });
      } catch (emailErr) {
        console.error("❌ Error sending approval email:", emailErr);
      }
    }

    res.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("🔥 Update User Error:", error);
    res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
});

// ✅ FORGOT / OTP / RESET (as-is)
authRouter.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email does not exist" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email });
    await new Otp({ email, code: otpCode }).save();

    await sendEmail({
      to: email,
      subject: "Reset Password OTP",
      html: `<p>Your OTP code is: <b>${otpCode}</b></p>`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
});

authRouter.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const record = await Otp.findOne({ email, code: otp });
  if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });
  await Otp.deleteMany({ email });
  res.json({ message: "OTP verified" });
});

authRouter.post("/api/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  const hashed = await bcrypt.hash(password, 10);
  user.password = hashed;
  await user.save();
  res.json({ message: "Password updated successfully" });
});

// ✅ Get all users
authRouter.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ message: "Users retrieved successfully", users });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
});

// ✅ Fetch resellers for a business user
authRouter.get("/api/resellers/:businessUserId", async (req, res) => {
  try {
    const { businessUserId } = req.params;
    const businessUser = await User.findById(businessUserId);
    if (!businessUser || businessUser.accountType !== "Business") {
      return res
        .status(403)
        .json({ message: "Only business users can fetch reseller users" });
    }

    const resellers = await User.find({ businessUserId }).select("-password");

    res.json({
      message: "Reseller users retrieved successfully",
      resellers,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching reseller users", error: error.message });
  }
});

// ✅ Fetch companies created by a business user
authRouter.get("/api/business/companies/:businessUserId", async (req, res) => {
  try {
    const { businessUserId } = req.params;
    const businessUser = await User.findById(businessUserId);
    if (!businessUser || businessUser.accountType !== "Business") {
      return res
        .status(403)
        .json({ message: "Only business users can fetch their companies" });
    }

    const companies = await User.find({
      businessUserId,
      isCompany: true,
    }).select("-password");

    res.json({
      message: "Companies retrieved successfully",
      companies,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching companies", error: error.message });
  }
});

// ✅ Change password
authRouter.put("/api/user/:id/change-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords don't match" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    const user = await User.findById(id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(id, {
      password: hashedPassword,
      updatedAt: Date.now(),
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Error changing password" });
  }
});

// ✅ Get single user
authRouter.get("/api/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("🔥 Get User Error:", error);
    res
      .status(500)
      .json({ message: "Error retrieving user", error: error.message });
  }
});

// ✅ Save device token (for push notifications)
authRouter.post("/api/users/save-device-token", requireAuth, async (req, res) => {
  try {
    const { deviceToken } = req.body || {};
    if (!deviceToken) return res.status(400).json({ message: "deviceToken required" });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { deviceToken, updatedAt: Date.now() },
      { new: true, select: "_id email deviceToken" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "Device token saved", user });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = authRouter;
