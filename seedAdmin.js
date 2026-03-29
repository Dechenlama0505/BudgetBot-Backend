const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

const seedAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected");

        const adminEmail = "admin@gmail.com";
        const superAdminEmail = "superadmin@gmail.com";

        const existingAdmin = await User.findOne({ email: adminEmail });
        const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

        if (!existingAdmin) {
            await User.create({
                fullName: "Admin",
                email: adminEmail,
                password: "Admin@123",
                role: "admin",
                status: "active",
                monthlyIncome: 0,
            });
            console.log("Admin created");
        } else {
            console.log("Admin already exists");
        }

        if (!existingSuperAdmin) {
            await User.create({
                fullName: "Super Admin",
                email: superAdminEmail,
                password: "SuperAdmin@123",
                role: "superadmin",
                status: "active",
                monthlyIncome: 0,
            });
            console.log("Super Admin created");
        } else {
            console.log("Super Admin already exists");
        }

        await mongoose.connection.close();
        console.log("MongoDB connection closed");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding admin accounts:", error);
        process.exit(1);
    }
};

seedAdmins();