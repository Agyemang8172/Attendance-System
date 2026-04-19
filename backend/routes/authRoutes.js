const express = require('express');
const router = express.Router()
const authContoller = require('../controllers/authcontroller');



router.post('/login',authContoller.login);

module.exports = router;