import express from "express";
import calendarController from "../controllers/calendarController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";
import authorizeRole from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  updateCalendarSchema,
  createCalendarExceptionSchema,
} from "../validators/index.js";

const router = express.Router();

// HR may read calendars; only SUPERADMIN may change them.
router.get(
  "/",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN", "HR"),
  calendarController.listCalendars
);

router.patch(
  "/:id",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(updateCalendarSchema),
  calendarController.updateCalendar
);

router.post(
  "/:id/exceptions",
  authMiddleware,
  requirePasswordChange(),
  authorizeRole("SUPERADMIN"),
  validate(createCalendarExceptionSchema),
  calendarController.createCalendarException
);

export default router;
