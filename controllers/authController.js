const crypto = require("crypto");
const User = require("../models/User");
const { sendPasswordResetEmail } = require("../utils/sendEmail");
const Category = require("../models/Category");
const generateToken = require("../utils/generateToken");
const fs = require("fs");
const path = require("path");

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
        errors: {
          email: "This email is already registered",
        },
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
    });

    if (user) {
      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePicture: user.profilePicture,
            monthlyIncome: user.monthlyIncome,
            budgetCategories: user.budgetCategories || [],
            createdAt: user.createdAt,
          },
          token,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }
  } catch (error) {
    console.error("Signup error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
        errors: {
          email: "This email is already registered",
        },
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error occurred during signup",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and include password field
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        errors: {
          email: "No account found with this email",
        },
      });
    }

    // Check if password matches
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        errors: {
          password: "Incorrect password",
        },
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          monthlyIncome: user.monthlyIncome,
          budgetCategories: user.budgetCategories || [],
          lastLogin: user.lastLogin,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred during login",
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          monthlyIncome: user.monthlyIncome,
          budgetCategories: user.budgetCategories || [],
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { fullName, monthlyIncome } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate fullName if provided
    if (fullName) {
      if (fullName.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Full name must be at most 100 characters",
          errors: {
            fullName: "Full name must be at most 100 characters",
          },
        });
      }

      if (!/^[A-Za-z\s]+$/.test(fullName.trim())) {
        return res.status(400).json({
          success: false,
          message: "Full name can only contain letters and spaces",
          errors: {
            fullName: "Full name can only contain letters and spaces",
          },
        });
      }

      user.fullName = fullName.trim();
    }

    // Validate monthlyIncome if provided
    if (monthlyIncome !== undefined && monthlyIncome !== null && monthlyIncome !== "") {
      const income = parseFloat(monthlyIncome);
      
      if (isNaN(income)) {
        return res.status(400).json({
          success: false,
          message: "Monthly income must be a valid number",
          errors: {
            monthlyIncome: "Monthly income must be a valid number",
          },
        });
      }

      if (income < 0) {
        return res.status(400).json({
          success: false,
          message: "Monthly income cannot be negative",
          errors: {
            monthlyIncome: "Monthly income cannot be negative",
          },
        });
      }

      user.monthlyIncome = income;
    }

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if exists
      if (user.profilePicture) {
        const oldImagePath = path.join(__dirname, "..", user.profilePicture);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Save new profile picture path (relative path for database)
      user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          monthlyIncome: user.monthlyIncome,
          budgetCategories: user.budgetCategories || [],
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    // If there was an uploaded file and an error occurred, delete it
    if (req.file) {
      const filePath = path.join(
        __dirname,
        "../uploads/profiles",
        req.file.filename
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: "Server error occurred while updating profile",
    });
  }
};

// @desc    Delete profile picture
// @route   DELETE /api/auth/profile/picture
// @access  Private
const deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to delete",
      });
    }

    // Delete the file
    const imagePath = path.join(__dirname, "..", user.profilePicture);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Update user
    user.profilePicture = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture deleted successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          monthlyIncome: user.monthlyIncome,
          budgetCategories: user.budgetCategories || [],
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while deleting profile picture",
    });
  }
};

// @desc    Update user's budget categories (add/remove for Set Your Budget)
// @route   PUT /api/auth/budget-categories
// @access  Private
const updateBudgetCategories = async (req, res) => {
  try {
    const { budgetCategories } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!Array.isArray(budgetCategories)) {
      return res.status(400).json({
        success: false,
        message: "budgetCategories must be an array",
      });
    }

    // Validate all category names exist in predefined categories
    const validNames = await Category.find().distinct("name");
    const invalid = budgetCategories.filter((c) => !validNames.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category names: " + invalid.join(", "),
      });
    }

    user.budgetCategories = budgetCategories;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Budget categories updated successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          monthlyIncome: user.monthlyIncome,
          budgetCategories: user.budgetCategories,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Update budget categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while updating budget categories",
    });
  }
};

// @desc    Change password (authenticated user)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: true });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    if (error.name === "ValidationError") {
      const msg = error.errors?.password?.message || "Invalid new password";
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({
      success: false,
      message: "Server error occurred while changing password",
    });
  }
};

// @desc    Forgot password - generate reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.log("[ForgotPassword] User not found for email:", email.trim(), "- no email sent");
      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, you will receive reset instructions.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const frontendBase = process.env.CLIENT_URL || "http://localhost:3000";
    const resetLink = `${frontendBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    console.log("[ForgotPassword] Sending reset email to:", user.email);
    await sendPasswordResetEmail(user.email, resetLink);
    console.log("[ForgotPassword] Password reset email sent successfully to:", user.email);

    res.status(200).json({
      success: true,
      message: "If an account exists with this email, you will receive reset instructions.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset token, and new password are required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+password +resetPasswordToken +resetPasswordExpire");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: true });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while resetting password",
    });
  }
};

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  deleteProfilePicture,
  updateBudgetCategories,
  changePassword,
  forgotPassword,
  resetPassword,
};