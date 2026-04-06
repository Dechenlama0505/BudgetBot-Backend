const User = require("../models/User");

const getTotalUsersCount = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });

    res.status(200).json({
      success: true,
      totalUsers,
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
