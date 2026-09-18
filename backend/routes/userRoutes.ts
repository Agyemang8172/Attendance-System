import express from 'express'
import userController from '../controllers/userController'
import authmiddleware from '../middleware/authMiddleware'
import authorizeRole from '../middleware/rolemiddleware'

const router = express.Router()

router.get(
  '/:id',
  authmiddleware,
  authorizeRole('superadmin', 'hr', 'staff'),
  userController.getUserById
)

router.get(
  '/',
  authmiddleware,
  authorizeRole('superadmin', 'hr'),
  userController.getAllUsers
)

router.post(
  '/',
  authmiddleware,
  authorizeRole('superadmin'),
  userController.createUser
)

router.put(
  '/change-password',
  authmiddleware,
  userController.changePassword
)

router.put(
  '/:id',
  authmiddleware,
  authorizeRole('superadmin', 'hr', 'staff'),
  userController.updateUser
)

router.delete(
  '/:id',
  authmiddleware,
  authorizeRole('superadmin'),
  userController.deleteUser
)

export default router