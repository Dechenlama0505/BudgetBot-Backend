const express = require("express");
const router = express.Router();
const { getInsights, getIncomeVsSpending } = require("../controllers/insightsController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/income-vs-spending", getIncomeVsSpending);
router.get("/", getInsights);

module.exports = router;
