import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Register new user
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
      return;
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
    });

    await user.save();

    // Don't send password in response
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };

    const token = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: userResponse
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// Login user
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    const token = generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// Get user profile (protected route)
router.get('/profile', authenticateJWT as any, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;