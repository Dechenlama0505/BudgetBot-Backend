const User = require("../models/User");

const allowedStatuses = ["active", "inactive", "pending"];

const formatUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  status: user.status,
  createdAt: user.createdAt,
});

const validateFullName = (fullName) => {
  if (typeof fullName !== "string" || !fullName.trim()) {
    return "Full name is required";
  }

  if (fullName.trim().length > 100) {
    return "Full name must be at most 100 characters";
  }

  if (!/^[A-Za-z\s]+$/.test(fullName.trim())) {
    return "Full name can only contain letters and spaces";
  }

  return null;
};

const validateStatus = (status) => {
  if (!allowedStatuses.includes(status)) {
    return "Status must be active, inactive, or pending";
  }

  return null;
};

// @desc    Get super admin dashboard stats
// @route   GET /api/superadmin/dashboard
// @access  Private/Super Admin
const getDashboardStats = async (req, res) => {
  try {
    const [members, admins] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "admin" }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        members,
        admins,
        total: members + admins,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard stats",
    });
  }
};

// @desc    Get recent members
// @route   GET /api/superadmin/members/recent
// @access  Private/Super Admin
const getRecentMembers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .select("fullName email status createdAt")
      .lean();

    res.status(200).json({
      success: true,
      data: users.map(formatUser),
    });
  } catch (error) {
    console.error("Get recent members error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent members",
    });
  }
};

// @desc    Get recent activity
// @route   GET /api/superadmin/activity
// @access  Private/Super Admin
const getRecentActivity = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["user", "admin"] } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .select("fullName role createdAt updatedAt")
      .lean();

    const activity = users.map((user) => {
      const action =
        new Date(user.updatedAt).getTime() > new Date(user.createdAt).getTime()
          ? "updated"
          : "created";

      const label = user.role === "admin" ? "Admin" : "User";

      return {
        name: user.fullName,
        role: user.role,
        message: `${label} '${user.fullName}' was ${action}`,
        createdAt: user.updatedAt || user.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Get recent activity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent activity",
    });
  }
};

// @desc    Get all members
// @route   GET /api/superadmin/members
// @access  Private/Super Admin
const getMembers = async (req, res) => {
  try {
    const members = await User.find({ role: "user" })
      .sort({ createdAt: -1, _id: -1 })
      .select("fullName email status role createdAt updatedAt")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        members: members.map((member) => ({
          id: member._id,
          fullName: member.fullName,
          email: member.email,
          status: member.status,
          role: member.role,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get members error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get members",
    });
  }
};

// @desc    Update member
// @route   PUT /api/superadmin/members/:id
// @access  Private/Super Admin
const updateMember = async (req, res) => {
  try {
    const { fullName, status } = req.body;

    if (fullName !== undefined) {
      const fullNameError = validateFullName(fullName);
      if (fullNameError) {
        return res.status(400).json({
          success: false,
          message: fullNameError,
        });
      }
    }

    if (status !== undefined) {
      const statusError = validateStatus(status);
      if (statusError) {
        return res.status(400).json({
          success: false,
          message: statusError,
        });
      }
    }

    const member = await User.findOne({ _id: req.params.id, role: "user" });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (fullName !== undefined) {
      member.fullName = fullName.trim();
    }

    if (status !== undefined) {
      member.status = status;
    }

    await member.save();

    res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: { member: formatUser(member) },
    });
  } catch (error) {
    console.error("Update member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update member",
    });
  }
};

// @desc    Delete member
// @route   DELETE /api/superadmin/members/:id
// @access  Private/Super Admin
const deleteMember = async (req, res) => {
  try {
    const member = await User.findOneAndDelete({
      _id: req.params.id,
      role: "user",
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member deleted successfully",
    });
  } catch (error) {
    console.error("Delete member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete member",
    });
  }
};

// @desc    Get all admins
// @route   GET /api/superadmin/admins
// @access  Private/Super Admin
const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .sort({ createdAt: -1, _id: -1 })
      .select("fullName email status role createdAt updatedAt")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        admins: admins.map((admin) => ({
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          status: admin.status,
          role: admin.role,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get admins",
    });
  }
};

// @desc    Create admin
// @route   POST /api/superadmin/admins
// @access  Private/Super Admin
const createAdmin = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const fullNameError = validateFullName(fullName);
    if (fullNameError) {
      return res.status(400).json({
        success: false,
        message: fullNameError,
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const existingAdmin = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const admin = await User.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "admin",
      status: "active",
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: { admin: formatUser(admin) },
    });
  } catch (error) {
    console.error("Create admin error:", error);

    if (error.name === "ValidationError") {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({
        success: false,
        message: firstError.message,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create admin",
    });
  }
};

// @desc    Update admin
// @route   PUT /api/superadmin/admins/:id
// @access  Private/Super Admin
const updateAdmin = async (req, res) => {
  try {
    const { fullName, status } = req.body;

    if (fullName !== undefined) {
      const fullNameError = validateFullName(fullName);
      if (fullNameError) {
        return res.status(400).json({
          success: false,
          message: fullNameError,
        });
      }
    }

    if (status !== undefined) {
      const statusError = validateStatus(status);
      if (statusError) {
        return res.status(400).json({
          success: false,
          message: statusError,
        });
      }
    }

    const admin = await User.findOne({ _id: req.params.id, role: "admin" });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (fullName !== undefined) {
      admin.fullName = fullName.trim();
    }

    if (status !== undefined) {
      admin.status = status;
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: { admin: formatUser(admin) },
    });
  } catch (error) {
    console.error("Update admin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update admin",
    });
  }
};

// @desc    Delete admin
// @route   DELETE /api/superadmin/admins/:id
// @access  Private/Super Admin
const deleteAdmin = async (req, res) => {
  try {
    const admin = await User.findOneAndDelete({
      _id: req.params.id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete admin",
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentMembers,
  getRecentActivity,
  getMembers,
  updateMember,
  deleteMember,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};