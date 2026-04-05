const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined");
    }

    // Replica-set URIs list multiple hosts (host1:27017,host2:27017) — not valid for `new URL()`.
    const pathBeforeQuery = uri.split("?")[0];
    const dbNameMatch = pathBeforeQuery.match(/\/([^/]+)$/);
    const dbName = dbNameMatch ? dbNameMatch[1] : "";

    if (!dbName) {
      throw new Error("Database name is missing in MONGODB_URI (add /YourDbName before ?)");
    }

    const conn = await mongoose.connect(uri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
