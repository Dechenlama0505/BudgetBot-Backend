require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../models/Category");
const connectDB = require("../config/database");

const CATEGORIES = [
  { name: "Food & Drinks", color: "#FF8A65", icon: "/foodndrink.png", order: 1 },
  { name: "Groceries", color: "#4DB6AC", icon: "/groceries.png", order: 2 },
  { name: "Transport", color: "#7986CB", icon: "/transport.png", order: 3 },
  { name: "Saving", color: "#81C784", icon: "/saving.png", order: 4 },
  { name: "Rent", color: "#A1887F", icon: "/rent.png", order: 5 },
  { name: "Health", color: "#F06292", icon: "/health.png", order: 6 },
  { name: "Education", color: "#4FC3F7", icon: "/education.png", order: 7 },
  { name: "Debt", color: "#E57373", icon: "/debt.png", order: 8 },
  { name: "Insurance", color: "#64B5F6", icon: "/insurance.png", order: 9 },
  { name: "Internet", color: "#BA68C8", icon: "/internet.png", order: 10 },
  { name: "Investment", color: "#AED581", icon: "/investment.png", order: 11 },
  { name: "Gifts", color: "#FFB74D", icon: "/gifts.png", order: 12 },
  { name: "Tax", color: "#90A4AE", icon: "/Tax.png", order: 13 },
  { name: "Travel", color: "#4DD0E1", icon: "/travel.png", order: 14 },
  { name: "Emergency Fund", color: "#DCE775", icon: "/emergencyfund.png", order: 15 },
  { name: "Mobile Bill", color: "#7986CB", icon: "/mobilebill.png", order: 16 },
  { name: "Shopping", color: "#FF8A80", icon: "/shopping.png", order: 17 },
  { name: "Entertainment", color: "#F48FB1", icon: "/entertainment.png", order: 18 },
  { name: "Home Bills", color: "#9575CD", icon: null, order: 19 },
  { name: "Savings", color: "#81C784", icon: null, order: 20 },
  { name: "Others", color: "#FFD54F", icon: "/others.png", order: 21 },
];

async function seed() {
  try {
    await connectDB();
    const existing = await Category.countDocuments();
    if (existing > 0) {
      console.log("Categories already seeded. Skipping.");
      process.exit(0);
      return;
    }
    await Category.insertMany(CATEGORIES);
    console.log("Categories seeded successfully.");
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
