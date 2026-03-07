const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/database");

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/budgets", require("./routes/budgetRoutes"));
app.use("/api/insights", require("./routes/insightsRoutes"));

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BudgetBot API is running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
