const mongoose = require("mongoose");
const User = require("../models/User");
const Activity = require("../models/Activity");

const allowedStatuses = ["active", "inactive", "pending"];

const formatMember = (member) => ({
  id: member._id,
  fullName: member.fullName,
  email: member.email,
  role: member.role,
  status: member.status,
  monthlyIncome: member.monthlyIncome,
  profilePicture: member.profilePicture,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
});

const formatActivity = (activity) => ({
  id: activity._id,
  type: activity.type,
  action: activity.action,
  message: activity.message,
  createdAt: activity.createdAt,
  performedBy: activity.performedBy
    ? {
        id: activity.performedBy._id,
        fullName: activity.performedBy.fullName,
        email: activity.performedBy.email,
        role: activity.performedBy.role,
      }
    : null,
  targetUser: activity.targetUser
    ? {
        id: activity.targetUser._id,
        fullName: activity.targetUser.fullName,
        email: activity.targetUser.email,
        role: activity.targetUser.role,
        status: activity.targetUser.status,
      }
    : null,
});

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const validateEmail = (email) => {
  if (typeof email !== "string" || !email.trim()) {
    return "Email is required";
  }

  if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) {
    return "Email must be a valid Gmail address ending with @gmail.com";
  }

  return null;
};

const validateMonthlyIncome = (monthlyIncome) => {
  if (
    monthlyIncome === undefined ||
    monthlyIncome === null ||
    monthlyIncome === ""
  ) {
    return null;
  }

  if (Number.isNaN(Number(monthlyIncome))) {
    return "Monthly income must be a valid number";
  }

  if (Number(monthlyIncome) < 0) {
    return "Monthly income cannot be negative";
  }

  return null;
};

const validatePassword = (password) => {
  if (typeof password !== "string" || !password.trim()) {
    return "Password is required";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }

  return null;
};

const getMemberByIdOr404 = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return User.findOne({ _id: id, role: "user" });
};

const logActivity = async ({
  type,
  action,
  message,
  performedBy,
  targetUser,
}) => {
  try {
    await Activity.create({
      type,
      action,
      message,
      performedBy: performedBy || null,
      targetUser: targetUser || null,
      targetRole: "user",
    });
  } catch (error) {
    console.error("Admin activity log error:", error);
  }
};

// @desc    Create member
// @route   POST /api/admin/members
// @access  Private/Admin or Superadmin
const createMember = async (req, res) => {
  try {
    const { fullName, email, password, status, monthlyIncome } = req.body;

    const fullNameError = validateFullName(fullName);
    if (fullNameError) {
      return res.status(400).json({
        success: false,
        message: fullNameError,
      });
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({
        success: false,
        message: emailError,
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
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

    const incomeError = validateMonthlyIncome(monthlyIncome);
    if (incomeError) {
      return res.status(400).json({
        success: false,
        message: incomeError,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const member = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      role: "user",
      status: status || "active",
      monthlyIncome:
        monthlyIncome === "" || monthlyIncome === null || monthlyIncome === undefined
          ? null
          : Number(monthlyIncome),
    });

    await logActivity({
      type: "member created",
      action: "create",
      message: `Member "${member.fullName}" was created`,
      performedBy: req.user._id,
      targetUser: member._id,
    });

    res.status(201).json({
      success: true,
      message: "Member created successfully",
      data: {
        member: formatMember(member),
      },
    });
  } catch (error) {
    console.error("Create member error:", error);

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
      message: "Failed to create member",
    });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin or Superadmin
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      inactiveUsers,
      totalAdmins,
    ] =
      await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "user", status: "active" }),
        User.countDocuments({ role: "user", status: "pending" }),
        User.countDocuments({ role: "user", status: "inactive" }),
        User.countDocuments({ role: "admin" }),
      ]);

    console.log("Admin count:", totalAdmins);

    res.status(200).json({
      success: true,
      totalUsers,
      activeUsers,
      pendingUsers,
      inactiveUsers,
      totalAdmins,
      totalMembers: totalUsers,
      activeMembers: activeUsers,
      inactiveMembers: inactiveUsers,
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard stats",
    });
  }
};

// @desc    Get all members
// @route   GET /api/admin/members
// @access  Private/Admin or Superadmin
const getMembers = async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const filter = { role: "user" };

    if (status && status !== "all") {
      const statusError = validateStatus(status);
      if (statusError) {
        return res.status(400).json({
          success: false,
          message: statusError,
        });
      }

      filter.status = status;
    }

    if (search.trim()) {
      const pattern = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ fullName: pattern }, { email: pattern }];
    }

    const members = await User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .select(
        "fullName email role status monthlyIncome profilePicture createdAt updatedAt"
      )
      .lean();

    res.status(200).json({
      success: true,
      data: {
        members: members.map(formatMember),
      },
    });
  } catch (error) {
    console.error("Get admin members error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get members",
    });
  }
};

// @desc    Get one member
// @route   GET /api/admin/members/:id
// @access  Private/Admin or Superadmin
const getMemberById = async (req, res) => {
  try {
    const member = await getMemberByIdOr404(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        member: formatMember(member),
      },
    });
  } catch (error) {
    console.error("Get admin member detail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get member details",
    });
  }
};

// @desc    Approve member
// @route   PATCH /api/admin/members/:id/approve
// @access  Private/Admin or Superadmin
const approveMember = async (req, res) => {
  try {
    const member = await getMemberByIdOr404(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    member.status = "active";
    await member.save();

    await logActivity({
      type: "member approved",
      action: "approve",
      message: `Member "${member.fullName}" was approved`,
      performedBy: req.user._id,
      targetUser: member._id,
    });

    res.status(200).json({
      success: true,
      message: "Member approved successfully",
      data: {
        member: formatMember(member),
      },
    });
  } catch (error) {
    console.error("Approve member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve member",
    });
  }
};

// @desc    Reject member
// @route   PATCH /api/admin/members/:id/reject
// @access  Private/Admin or Superadmin
const rejectMember = async (req, res) => {
  try {
    const member = await getMemberByIdOr404(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    member.status = "inactive";
    await member.save();

    await logActivity({
      type: "member rejected",
      action: "reject",
      message: `Member "${member.fullName}" was rejected`,
      performedBy: req.user._id,
      targetUser: member._id,
    });

    res.status(200).json({
      success: true,
      message: "Member rejected successfully",
      data: {
        member: formatMember(member),
      },
    });
  } catch (error) {
    console.error("Reject member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject member",
    });
  }
};

// @desc    Update member
// @route   PUT /api/admin/members/:id
// @access  Private/Admin or Superadmin
const updateMember = async (req, res) => {
  try {
    const { fullName, email, status, monthlyIncome } = req.body;
    const member = await getMemberByIdOr404(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (fullName !== undefined) {
      const fullNameError = validateFullName(fullName);
      if (fullNameError) {
        return res.status(400).json({
          success: false,
          message: fullNameError,
        });
      }
    }

    if (email !== undefined) {
      const emailError = validateEmail(email);
      if (emailError) {
        return res.status(400).json({
          success: false,
          message: emailError,
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: member._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
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

    if (monthlyIncome !== undefined) {
      const incomeError = validateMonthlyIncome(monthlyIncome);
      if (incomeError) {
        return res.status(400).json({
          success: false,
          message: incomeError,
        });
      }
    }

    if (fullName !== undefined) {
      member.fullName = fullName.trim();
    }

    if (email !== undefined) {
      member.email = email.trim().toLowerCase();
    }

    if (status !== undefined) {
      member.status = status;
    }

    if (monthlyIncome !== undefined) {
      member.monthlyIncome =
        monthlyIncome === "" || monthlyIncome === null
          ? null
          : Number(monthlyIncome);
    }

    await member.save();

    await logActivity({
      type: "member updated",
      action: "update",
      message: `Member "${member.fullName}" was updated`,
      performedBy: req.user._id,
      targetUser: member._id,
    });

    res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: {
        member: formatMember(member),
      },
    });
  } catch (error) {
    console.error("Update admin member error:", error);

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
      message: "Failed to update member",
    });
  }
};

// @desc    Delete member
// @route   DELETE /api/admin/members/:id
// @access  Private/Admin or Superadmin
const deleteMember = async (req, res) => {
  try {
    const member = await getMemberByIdOr404(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const memberName = member.fullName;
    const memberId = member._id;

    await member.deleteOne();

    await logActivity({
      type: "member deleted",
      action: "delete",
      message: `Member "${memberName}" was deleted`,
      performedBy: req.user._id,
      targetUser: memberId,
    });

    res.status(200).json({
      success: true,
      message: "Member deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin member error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete member",
    });
  }
};

// @desc    Get recent admin activity
// @route   GET /api/admin/activity/recent
// @access  Private/Admin or Superadmin
const getRecentActivity = async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : 5;

    const activity = await Activity.find({ targetRole: "user" })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate("performedBy", "fullName email role")
      .populate("targetUser", "fullName email role status")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        activity: activity.map(formatActivity),
      },
    });
  } catch (error) {
    console.error("Get admin recent activity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent activity",
    });
  }
};

module.exports = {
  getDashboardStats,
  createMember,
  getMembers,
  getMemberById,
  approveMember,
  rejectMember,
  updateMember,
  deleteMember,
  getRecentActivity,
};
