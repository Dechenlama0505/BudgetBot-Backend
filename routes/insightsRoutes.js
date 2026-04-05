const express = require("express");
const router = express.Router();
const {
  getInsights,
  getIncomeVsSpending,
  getBudgetPredictions,
} = require("../controllers/insightsController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/income-vs-spending", getIncomeVsSpending);
router.get("/predictions", getBudgetPredictions);
router.get("/", getInsights);

module.exports = router;
