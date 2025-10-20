// const mongoose = require("mongoose");

// const userSchema = mongoose.Schema({
//   firstName: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   lastName: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//     lowercase: true,
//     validate: {
//       validator: (value) => {
//         const regex =
//           /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
//         return regex.test(value);
//       },
//       message: "Please enter a valid email address",
//     },
//   },
//   password: {
//     type: String,
//     required: true,

//     validate: {
//       validator: (value) => {
//         // Password must be at least 8 characters long
//         return value.length >= 8;
//       },
//       message: "Password must be at least 8 characters long",
//     },
//   },
//   accountType: {
//     type: String,
//     required: true,
//     enum: ["Personal", "Business", "admin"],
//   },
//   isResellerUser: {
//     type: Boolean,
//     default: false,
//   },
//   businessUserId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     default: null, // Only set when isResellerUser is true
//   },
//   isCompany: {
//     type: Boolean,
//     default: false,
//   },
//   isEnabled: {
//     type: Boolean,
//     default: true,
//   },
//   companyId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     default: null, // Only set when isResellerUser is true
//   },
//   userCode: {
//     type: String,
//     unique: true,
//     required: true,
//   },
//   status: {
//     type: String,
//     default: "0",
//   },
//   isVerified: { type: Boolean, default: false },
//   address: {
//     type: String,
//     trim: true,
//     default: ""
//   },
//   city: {
//     type: String,
//     trim: true,
//     default: ""
//   },
//   state: {
//     type: String,
//     trim: true,
//     default: ""
//   },
//   country: {
//     type: String,
//     trim: true,
//     default: ""
//   },
//   telephone: {
//     type: String,
//     trim: true,
//     default: ""
//   },  
// credits: {
//   type: Number,
//   default: 0,
// },
// });


// const User = mongoose.model("User", userSchema);

// module.exports = User;




const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value) => {
          const regex =
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          return regex.test(value);
        },
        message: "Please enter a valid email address",
      },
    },

    password: {
      type: String,
      required: true,
      validate: {
        validator: (value) => value.length >= 8,
        message: "Password must be at least 8 characters long",
      },
    },

    accountType: {
      type: String,
      required: true,
      enum: ["Personal", "Business", "admin"],
    },

    isResellerUser: { type: Boolean, default: false },
    businessUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isCompany: { type: Boolean, default: false },
    isEnabled: { type: Boolean, default: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    userCode: { type: String, unique: true, required: true },
    status:   { type: String, default: "0" },
    isVerified: { type: Boolean, default: false },

    address:  { type: String, trim: true, default: "" },
    city:     { type: String, trim: true, default: "" },
    state:    { type: String, trim: true, default: "" },
    country:  { type: String, trim: true, default: "" },
    telephone:{ type: String, trim: true, default: "" },

    // 🔴 NEW: wallet credits for IAP / PayPal / legacy
    credits: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

// Helpful compound indexes (optional but good hygiene)
userSchema.index({ email: 1 }, { unique: true });

// 🔴 NEW: helper statics used by IAP flow
userSchema.statics.getOrCreate = async function (userId) {
  // Note: aapke system me userId ka source (auth uid) jo bhi ho, yahan pass hota hai.
  const found = await this.findById(userId).lean();
  if (found) return found;
  // If not found, create a minimal shell user — OR throw if you don’t want auto-create
  await this.create({
    _id: userId,               // ensure your code passes req.params.userId as _id here
    firstName: "N/A",
    lastName: "N/A",
    email: `user_${userId}@placeholder.local`, // placeholder; your real flow likely creates users elsewhere
    password: "placeholder_password_123",      // DO NOT use this for real auth; this is only to satisfy schema
    accountType: "Personal",
    userCode: `U-${userId}`,
    credits: 0,
  });
  return { _id: userId, credits: 0 };
};

userSchema.statics.getCredits = async function (userId) {
  const u = await this.getOrCreate(userId);
  return u.credits || 0;
};

userSchema.statics.addCredits = async function (userId, delta) {
  await this.updateOne({ _id: userId }, { $inc: { credits: delta } }, { upsert: true });
  const u = await this.findById(userId).lean();
  return u?.credits ?? 0;
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
