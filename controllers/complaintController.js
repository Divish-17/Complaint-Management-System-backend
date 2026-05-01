const Complaint = require("../models/Complaint");
const createComplaint = async (req, res) => {
    try {
      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }
  
      const newComplaint = new Complaint({ user: req.user.id, title, description });
      await newComplaint.save();
  
      res.status(201).json({ message: "Complaint created successfully", complaint: newComplaint });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };
  
  // ✅ Ensure Correct Export
  module.exports = { createComplaint };  // Must be in curly brackets
  