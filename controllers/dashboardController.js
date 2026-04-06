const User = require("../models/User");

const getTotalUsersCount = async (req, res) => {
  try {
    const [totalUsers, activeUsers, pendingUsers, inactiveUsers] =
      await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "user", status: "active" }),
        User.countDocuments({ role: "user", status: "pending" }),
        User.countDocuments({ role: "user", status: "inactive" }),
      ]);

    res.status(200).json({
      success: true,
      totalUsers,
      activeUsers,
      pendingUsers,
      inactiveUsers,
    });
  } catch (error) {
    console.error("Get total users count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard stats",
    });
  }
};

module.exports = {
  getTotalUsersCount,
};
