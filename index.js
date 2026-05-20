require("dotenv").config(); // Load .env variables
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ Import Models
const User = require("./models/User");
const Complaint = require("./models/Complaint");
const Announcement = require("./models/Announcement");

// ✅ Import Middleware
const { protect } = require("./middleware/authMiddleware");
const authMiddleware = protect; // Alias for backward compatibility in this file

// ✅ Register API
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// ✅ Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token, role: user.role });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// ✅ Submit a Complaint (User only)
app.post("/complaints", authMiddleware, async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: Invalid user" });
    }

    const newComplaint = new Complaint({
      user: req.user.id,
      title,
      description,
      category: category || "General",
      priority: priority || "Medium",
      status: "Pending",
    });

    await newComplaint.save();
    res.status(201).json({
      message: "Complaint submitted successfully",
      complaint: newComplaint,
      redirect: "/userdashboard"
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Get Logged-in User's Complaints
app.get("/complaints", authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user.id })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Get Logged-in User Details
app.get("/user", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Admin: Get All Complaints
app.get("/admin/complaints", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

    const complaints = await Complaint.find()
      .populate("user", "name email")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Admin: Create Announcement
app.post("/admin/announcements", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

    const { title, content, importance } = req.body;
    const newAnnouncement = new Announcement({
      title,
      content,
      importance,
      createdBy: req.user.id
    });

    await newAnnouncement.save();
    res.status(201).json({ message: "Announcement created", announcement: newAnnouncement });
  } catch (error) {
    res.status(500).json({ message: "Error creating announcement", error: error.message });
  }
});

// ✅ Get All Announcements
app.get("/announcements", authMiddleware, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: "Error fetching announcements", error: error.message });
  }
});

// ✅ Update Complaint Status (Admin only)
app.post("/admin/complaint/status", authMiddleware, async (req, res) => {
  const { complaintId, status } = req.body;

  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    complaint.status = status;
    await complaint.save();

    res.json({ message: "Complaint status updated successfully", complaint });
  } catch (error) {
    res.status(500).json({ message: "Error updating complaint status", error: error.message });
  }
});


// ✅ Admin: Assign Complaint to Staff
app.post("/admin/assign", authMiddleware, async (req, res) => {
  const { complaintId, staffId } = req.body;

  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied" });

    const staff = await User.findById(staffId);
    if (!staff || staff.role !== "staff") return res.status(400).json({ message: "Invalid staff member" });

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    complaint.assignedTo = staffId;
    complaint.status = "Assigned";
    await complaint.save();

    res.json({ message: "Complaint assigned successfully", complaint });
  } catch (error) {
    res.status(500).json({ message: "Error assigning complaint", error: error.message });
  }
});

// ✅ Admin: Get All Staff Members
app.get("/staff", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const staffMembers = await User.find({ role: "staff" }).select("-password");
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Staff: Get Assigned Complaints
app.get("/staff/complaints", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "staff") return res.status(403).json({ message: "Access denied" });

    const complaints = await Complaint.find({ assignedTo: req.user.id }).populate("user", "name email");
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Error fetching assigned complaints", error: error.message });
  }
});

// ✅ Staff: Mark Complaint as Resolved and notify both user and admin
app.post("/staff/resolve", authMiddleware, async (req, res) => {
  const { complaintId, resolutionNote } = req.body;

  try {
    if (req.user.role !== "staff") return res.status(403).json({ message: "Access denied" });

    const complaint = await Complaint.findOne({ _id: complaintId, assignedTo: req.user.id });
    if (!complaint) return res.status(404).json({ message: "Complaint not found or not assigned to you" });

    complaint.status = "Resolved";
    complaint.resolutionNote = resolutionNote || "Problem resolved by staff.";
    await complaint.save();

    res.json({ message: "Complaint resolved successfully", complaint });
  } catch (error) {
    res.status(500).json({ message: "Error resolving complaint", error: error.message });
  }
});


// ✅ Delete Complaint (User only)
app.delete("/complaints/:complaintId", authMiddleware, async (req, res) => {
  try {
    const complaintId = req.params.complaintId;

    // Check if the complaint exists and belongs to the logged-in user
    const complaint = await Complaint.findOne({ _id: complaintId, user: req.user.id });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found or does not belong to you" });
    }

    // Delete the complaint
    await Complaint.findByIdAndDelete(complaintId);

    res.json({ message: "Complaint deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
