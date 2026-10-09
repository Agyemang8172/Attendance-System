import express from "express";
const router = express.Router();
import { login, logout } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../validators/index.js";

router.post("/login", validate(loginSchema), login);

// No `requirePasswordChange` here by design: an account still holding the
// temporary credential must be able to sign out, or the only way out of the
// password screen is closing the tab.
router.post("/logout", authMiddleware, logout);

export default router;
