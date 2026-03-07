const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  updateProfile,
  deleteProfilePicture,
  updateBudgetCategories,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const {
  signupValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  handleValidationErrors
} = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// Public routes
router.post('/signup', signupValidation, handleValidationErrors, signup);
router.post('/login', loginValidation, handleValidationErrors, login);
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, forgotPassword);
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put(
  '/profile',
  protect,
  upload.single('profilePicture'),
  handleUploadError,
  updateProfile
);
router.delete('/profile/picture', protect, deleteProfilePicture);
router.put('/budget-categories', protect, updateBudgetCategories);
router.put('/change-password', protect, changePasswordValidation, handleValidationErrors, changePassword);

module.exports = router;