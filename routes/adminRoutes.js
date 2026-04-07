const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  createMember,
  getMembers,
  getMemberById,
  approveMember,
  rejectMember,
  updateMember,
  deleteMember,
  getRecentActivity,
} = require("../controllers/adminController");
const { protect, authorizeRoles } = require("../middleware/auth");

router.use(protect, authorizeRoles("admin", "superadmin"));

router.get("/dashboard/stats", getDashboardStats);
router.get("/activity/recent", getRecentActivity);

router.post("/members", createMember);
router.get("/members", getMembers);
router.get("/members/:id", getMemberById);
router.patch("/members/:id/approve", approveMember);
router.patch("/members/:id/reject", rejectMember);
router.put("/members/:id", updateMember);
router.delete("/members/:id", deleteMember);

module.exports = router;
