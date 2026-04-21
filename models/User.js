const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name must be at most 100 characters"],
      validate: {
        validator: function (v) {
          return /^[A-Za-z\s]+$/.test(v);
        },
        message: "Full name can only contain letters and spaces",
      },
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@gmail\.com$/i.test(v);
        },
        message: "Email must be a valid Gmail address ending with @gmail.com",
      },
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
    },

    // NEW FIELD: ROLE
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },

    // NEW FIELD: STATUS
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },

    profilePicture: {
      type: String,
      default: null,
    },

    monthlyIncome: {
      type: Number,
      default: null,
      min: [0, "Monthly income cannot be negative"],
    },

    budgetCategories: {
      type: [String],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    lastLogin: {
      type: Date,
    },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove sensitive data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model("User", userSchema);
