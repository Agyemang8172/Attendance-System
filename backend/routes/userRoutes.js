const express = require('express')
const router = express.Router();
const userController = require('../controllers/userController');
const authmiddleware = require('../middleware/authMiddleware')
const authorizeRole = require('../middleware/rolemiddleware')




router.get('/:id',authmiddleware,authorizeRole('superadmin','hr','staff'),userController.getUserById)

router.get('/',authmiddleware,authorizeRole('superadmin','hr'),userController.getAllUsers)

router.post('/',userController.createUser)

router.put('/:id',authmiddleware,authorizeRole('superadmin','hr','staff'),userController.updateUser)

router.delete('/:id',authmiddleware,authorizeRole('superadmin'),userController.deleteUser)

module.exports = router      