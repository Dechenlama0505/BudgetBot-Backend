const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getTotalUsersCount,
  getRecentMembers,
  getRecentActivity,
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  getAdmins,
  getSuperAdmins,
  createAdmin,
  createSuperAdmin,
  updateAdmin,
  deleteAdmin,
  updateSuperAdmin,
  deleteSuperAdmin,
} = require("../controllers/superAdminController");
const { protect, authorizeRoles } = require("../middleware/auth");

router.use(protect, authorizeRoles("superadmin"));

router.get("/dashboard", getDashboardStats);
router.get("/dashboard/stats", getTotalUsersCount);
router.get("/members/recent", getRecentMembers);
router.get("/activity", getRecentActivity);

router.post("/members", createMember);
router.get("/members", getMembers);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);

router.get("/superadmins", getSuperAdmins);
router.post("/superadmins", createSuperAdmin);
router.put("/superadmins/:id", updateSuperAdmin);
router.delete("/superadmins/:id", deleteSuperAdmin);

router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

module.exports = router;
