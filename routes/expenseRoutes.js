const express = require("express");
const router = express.Router();
const {
  addExpense,
  updateExpense,
  getExpenses,
  getSummary,
  getExpenseHistory,
  deleteExpense,
} = require("../controllers/expenseController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", addExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);
router.get("/history", getExpenseHistory);
router.get("/summary", getSummary);
router.get("/", getExpenses);

module.exports = router;
