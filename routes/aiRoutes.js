const express = require("express");
const { predictSpending, getAiSummary } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", protect, getAiSummary);
router.post("/predict", predictSpending);

module.exports = router;
