const User = require("../models/User");
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

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  deleteProfilePicture,
};