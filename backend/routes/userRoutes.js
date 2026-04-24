const express = require('express')
const router = express.Router();
const userController = require('../controllers/userController');
const authmiddleware = require('../middleware/authMiddleware')
const authorizeRole = require('../middleware/rolemidlleware')



router.get('/', authmiddleware, userController.getAllUsers)

router.get('/:id', authmiddleware,userController.getUserById)

router.post('/', userController.createUser)

router.put('/:id',authmiddleware, userController.updateUser)

router.delete('/:id',authmiddleware, userController.deleteUser)

router.delete('/:id',authmiddleware,authorizeRole('superadmin'),userController.deleteUser)

router.get('/api/user/:id',authmiddleware,authorizeRole('superadmin,hr,staff'),userController.getUserById)

router.get('/api/user',authmiddleware,authorizeRole('superadmin,hr'),userController.getAllUsers)

router.post('/api/users',authmiddleware,authorizeRole('superadmin,hr'),userController.createUser)

router.put('/api/users/:id',authmiddleware,authorizeRole('superadmin,hr,staff'),userController.updateUser)

router.delete('/:id',authmiddleware,authorizeRole('superadmin'),userController.deleteUser)

module.exports = router