const express = require("express");
const router = express.Router();
const { getBudget, upsertBudget } = require("../controllers/budgetController");
const { protect } = require("../middleware/auth");

router.use(protect);
router.get("/", getBudget);
router.put("/", upsertBudget);

module.exports = router;
