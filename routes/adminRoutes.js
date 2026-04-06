const express = require("express");
const router = express.Router();
const { getTotalUsersCount } = require("../controllers/dashboardController");
const { protect, authorizeRoles } = require("../middleware/auth");

router.get(
  "/dashboard/stats",
  protect,
  authorizeRoles("admin", "superadmin"),
  getTotalUsersCount,
);

module.exports = router;
