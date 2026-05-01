const express = require("express");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const { createComplaint } = require("../controllers/complaintController"); // ✅ Ensure correct import

const router = express.Router();

// ✅ Use `authMiddleware` if required for complaint creation
console.log("createComplaint type:", typeof createComplaint);
router.post("/create", createComplaint);  // ✅ Correct


// ✅ Get Complaints of Logged-in User
router.get("/", authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user.id }).populate("user", "name email").sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Get All Complaints (Admin)
router.get("/admin", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

  try {
    const complaints = await Complaint.find().populate("user", "name email");
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Error fetching complaints", error: error.message });
  }
});



module.exports = router;
