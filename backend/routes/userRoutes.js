const express = require('express')
const router = express.Router();
const userController = require('../controllers/userController');
const authmiddleware = require('../middleware/authMiddleware')



router.get('/', authmiddleware, userController.getAllUsers)

router.get('/:id', authmiddleware,userController.getUserById)

router.post('/', userController.createUser)

router.put('/:id',authmiddleware, userController.updateUser)

router.delete('/:id',authmiddleware, userController.deleteUser)

module.exports = router