const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getTotalUsersCount,
  getRecentMembers,
  getRecentActivity,
  getMembers,
  updateMember,
  deleteMember,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/superAdminController");
const { protect, superAdminOnly } = require("../middleware/auth");

router.use(protect, superAdminOnly);

router.get("/dashboard", getDashboardStats);
router.get("/dashboard/stats", getTotalUsersCount);
router.get("/members/recent", getRecentMembers);
router.get("/activity", getRecentActivity);

router.get("/members", getMembers);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);

router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

module.exports = router;
