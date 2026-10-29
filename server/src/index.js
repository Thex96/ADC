import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  console.error("Set JWT_SECRET to a random secret of at least 32 characters in server/.env.");
  process.exit(1);
}

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "32kb" }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const deviceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  deviceId: { type: String, required: true, trim: true, uppercase: true },
  tokenHash: { type: String, required: true },
  lastSeenAt: { type: Date, default: null },
  latest: {
    latitude: Number,
    longitude: Number,
    speedKmph: Number,
    altitudeM: Number,
    satellites: Number,
    hdop: Number,
    estimatedAccuracyM: Number,
    fixAt: Date,
    receivedAt: Date
  }
}, { timestamps: true });
deviceSchema.index({ owner: 1, deviceId: 1 }, { unique: true });

const locationSchema = new mongoose.Schema({
  device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speedKmph: Number,
  altitudeM: Number,
  satellites: Number,
  hdop: Number,
  estimatedAccuracyM: Number,
  fixAt: { type: Date, required: true },
  receivedAt: { type: Date, default: Date.now }
}, { timestamps: false });
locationSchema.index({ device: 1, fixAt: -1 });

const User = mongoose.model("User", userSchema);
const Device = mongoose.model("Device", deviceSchema);
const Location = mongoose.model("Location", locationSchema);

function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function makeToken(user) {
  return jwt.sign({ sub: user._id.toString() }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) throw new Error("missing token");
    const payload = jwt.verify(token, jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Please sign in again." });
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Name must be between 2 and 80 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
  if (await User.exists({ email })) return res.status(409).json({ message: "An account with this email already exists." });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
  res.json({ token: makeToken(user), user: safeUser(user) });
}));

app.get("/api/auth/me", auth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: "Account not found." });
  res.json({ user: safeUser(user) });
}));

app.get("/api/devices", auth, asyncRoute(async (req, res) => {
  const devices = await Device.find({ owner: req.userId }).sort({ createdAt: -1 }).lean();
  res.json({ devices: devices.map(({ tokenHash, ...device }) => device) });
}));

app.post("/api/devices", auth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const deviceId = String(req.body.deviceId || "").trim().toUpperCase();
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Device name must be between 2 and 80 characters." });
  if (!/^[A-Z0-9_-]{3,48}$/.test(deviceId)) return res.status(400).json({ message: "Device ID must use 3–48 letters, numbers, hyphens, or underscores." });
  if (await Device.exists({ owner: req.userId, deviceId })) return res.status(409).json({ message: "You have already registered this device ID." });
  const deviceToken = crypto.randomBytes(32).toString("hex");
  const device = await Device.create({ owner: req.userId, name, deviceId, tokenHash: crypto.createHash("sha256").update(deviceToken).digest("hex") });
  res.status(201).json({ device: { id: device._id, name: device.name, deviceId: device.deviceId, createdAt: device.createdAt }, deviceToken });
}));

app.get("/api/devices/:id", auth, asyncRoute(async (req, res) => {
  const device = await Device.findOne({ _id: req.params.id, owner: req.userId }).select("-tokenHash").lean();
  if (!device) return res.status(404).json({ message: "Device not found." });
  const history = await Location.find({ device: device._id }).sort({ fixAt: -1 }).limit(100).lean();
  res.json({ device, history });
}));

app.delete("/api/devices/:id", auth, asyncRoute(async (req, res) => {
  const device = await Device.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!device) return res.status(404).json({ message: "Device not found." });
  await Location.deleteMany({ device: device._id });
  res.json({ message: "Device deleted." });
}));

app.post("/api/telemetry/:deviceId", asyncRoute(async (req, res) => {
  const token = String(req.headers["x-device-token"] || "");
  if (!token || token.length > 256) return res.status(401).json({ message: "Missing device token." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const device = await Device.findOne({ deviceId: String(req.params.deviceId).toUpperCase(), tokenHash });
  if (!device) return res.status(401).json({ message: "Invalid device ID or token." });

  const body = req.body || {};
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const fixAt = new Date(body.fixAt);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !body.fixAt || Number.isNaN(fixAt.getTime()) || fixAt.getTime() > Date.now() + 60000) {
    return res.status(400).json({ message: "Valid coordinates and a synchronized GPS fix timestamp are required." });
  }
  const optionalNumber = (value, min = -Infinity, max = Infinity) => {
    if (value === null || value === undefined || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  };
  const receivedAt = new Date();
  const record = {
    device: device._id,
    latitude,
    longitude,
    speedKmph: optionalNumber(body.speedKmph, 0, 1500),
    altitudeM: optionalNumber(body.altitudeM, -20000, 100000),
    satellites: optionalNumber(body.satellites, 0, 100),
    hdop: optionalNumber(body.hdop, 0, 1000),
    estimatedAccuracyM: optionalNumber(body.estimatedAccuracyM, 0, 1000000),
    fixAt,
    receivedAt
  };
  await Location.create(record);
  const previousFix = device.latest?.fixAt ? new Date(device.latest.fixAt).getTime() : 0;
  if (fixAt.getTime() >= previousFix) {
    device.latest = { ...record, receivedAt };
  }
  device.lastSeenAt = receivedAt;
  await device.save();
  res.status(201).json({ accepted: true, receivedAt });
}));

app.use((err, _req, res, _next) => {
  if (err?.code === 11000) return res.status(409).json({ message: "That email or device ID is already registered." });
  console.error(err);
  res.status(500).json({ message: "Server error. Check the server terminal for details." });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trackpoint")
  .then(() => {
    app.listen(port, () => console.log(`TrackPoint API running at http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
