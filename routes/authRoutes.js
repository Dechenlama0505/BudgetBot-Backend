const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  updateProfile,
  deleteProfilePicture
} = require('../controllers/authController');
const {
  signupValidation,
  loginValidation,
  handleValidationErrors
} = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// Public routes
router.post('/signup', signupValidation, handleValidationErrors, signup);
router.post('/login', loginValidation, handleValidationErrors, login);

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

module.exports = router;