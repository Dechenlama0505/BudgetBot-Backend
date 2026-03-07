const express = require("express");
const router = express.Router();
const { addExpense, getExpenses, getSummary } = require("../controllers/expenseController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", addExpense);
router.get("/summary", getSummary);
router.get("/", getExpenses);

module.exports = router;
