const express = require('express')
const router = express.Router()
const attendanceController = require('../controllers/attendanceController')
const authMiddleware = require('../middleware/authMiddleware')
const authorizeRole= require('../middleware/rolemiddleware')




router.post('/clock-in',authMiddleware, authorizeRole('superadmin','hr','staff'),attendanceController.clockIn)
router.post('/clock-out',authMiddleware, authorizeRole('superadmin','hr','staff'),attendanceController.clockOut)



module.exports = router