const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint"); // Assuming you have a Complaint model
const authMiddleware = require("../middleware/auth"); // Auth middleware to verify JWT token

// Submit a new complaint
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    const newComplaint = new Complaint({ user: req.user.id, title, description });
    await newComplaint.save();
    res.status(201).json(newComplaint);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch all complaints of the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user.id });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
