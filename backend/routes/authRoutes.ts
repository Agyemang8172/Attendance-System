import express from "express";
const router = express.Router();
import { login } from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../validators/index.js";

router.post("/login", validate(loginSchema), login);

export default router;