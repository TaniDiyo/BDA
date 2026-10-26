const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "analyst"], required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Login looks up users by email; uniqueness also prevents duplicate accounts.
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
