import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { validateRegistrationData, validateCompleteRegistrationData, validateEmail } from '../utils/validation'
import { checkSetupStatus } from '../utils/setupFlow'
import { RegistrationData, CompleteRegistrationData, AuthResponse, SetupStatus } from '../types'
import prisma from '../prisma';
import { EmailService } from '../Services/Email';

const router = Router()
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
)
const JWT_SECRET = process.env.JWT_SECRET || 'secret'

// Helper function to generate JWT token with setup status
const generateToken = (user: any, setupStatus?: SetupStatus) => {
  return jwt.sign({
    userId: user.id,
    role: user.role,
    isRegistrationComplete: setupStatus?.isRegistrationComplete,
    isSetupComplete: setupStatus?.isSetupComplete,
    hasActiveSubscription: setupStatus?.hasActiveSubscription
  }, JWT_SECRET, { expiresIn: '1d' })
}

// REGISTER
router.post('/register', async (req: Request, res: Response) => {
  try {
    const registrationData: RegistrationData = req.body

    // If mobile client, force role to 'car_owner'
    const isMobile = req.headers['x-client-type'] === 'mobile';
    if (isMobile) {
      registrationData.role = 'car_owner';
    }

    // Validate input
    const validation = validateRegistrationData(registrationData)
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') })
    }

    const { email, password, name, phone, role, profileData } = registrationData

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    const hashed = await bcrypt.hash(password, 10)

    // Create user with transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { 
          email, 
          password: hashed, 
          name, 
          phone,
          role,
          isRegistrationComplete:  !isMobile
        },
      })


      if (role === 'service_center' && profileData.businessDetails) {
        await tx.serviceCenterProfile.create({
          data: {
            userId: user.id,
            businessName: profileData.businessDetails.businessName,
            address: profileData.businessDetails.address,
            businessRegistrationNumber: profileData.businessDetails.businessRegistrationNumber,
            servicesOffered: JSON.stringify(profileData.businessDetails.servicesOffered),
            operatingHours: JSON.stringify(profileData.businessDetails.operatingHours),
            logo: profileData.businessDetails.logo,
          }
        })
      }

      if (role === 'part_seller' && profileData.shopDetails) {
        await tx.partSellerProfile.create({
          data: {
            userId: user.id,
            shopName: profileData.shopDetails.shopName,
            address: profileData.shopDetails.address,
            categoriesSold: JSON.stringify(profileData.shopDetails.categoriesSold),
            inventoryCapacity: profileData.shopDetails.inventoryCapacity,
            contactPersonName: profileData.shopDetails.contactPersonName,
          }
        })
      }

      return user
    })

    // Check setup status for new user
    const setupStatus = await checkSetupStatus(result.id)
    const token = generateToken(result, setupStatus)

    const emailresult = await EmailService.sendWelcomeEmail(email);
    console.log("Email Success", emailresult);

    res.json({ 
      message: 'User created successfully', 
      token,
      user: { 
        id: result.id, 
        email: result.email, 
        name: result.name,
        phone: result.phone,
        role: result.role 
      },
      setupStatus,
      requiresSetup: setupStatus.missingSteps.length > 0
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// LOGIN
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.password) return res.status(401).json({ error: 'Invalid password' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid password' })

    // Check setup status
    const setupStatus = await checkSetupStatus(user.id)
    const token = generateToken(user, setupStatus)

    const userEmail = user.email;

    const loginDetails = {
      timestamp: new Date(),
      location: 'Colombo 14, Sri-Lanka',
      device: 'Pixel 9 Pro',
      ip: '192.168.1.1',
    };

    const success = await EmailService.sendLoginNotificationEmail(userEmail, loginDetails);
    console.log("Email Success", success);

    res.json({ 
      message: 'Login success', 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      isRegistrationComplete: user.isRegistrationComplete,
      setupStatus,
      requiresSetup: setupStatus.missingSteps.length > 0
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GOOGLE OAUTH REDIRECT FLOW
router.get('/google', async (req: Request, res: Response) => {
  try {
    const { callback } = req.query
    
    // Store callback URL in session or pass it through state parameter
    const state = callback ? encodeURIComponent(callback as string) : ''
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback')}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`
    
    res.redirect(googleAuthUrl)
  } catch (error) {
    console.error('Google OAuth redirect error:', error)
    res.status(500).json({ error: 'OAuth redirect failed' })
  }
})

router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' })
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code as string)
    
    if (!tokens.id_token) {
      return res.status(400).json({ error: 'No ID token received' })
    }

    // Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    
    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid token payload' })
    }

    const { email, name } = payload

    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: '',
          role: 'car_owner',
          isRegistrationComplete: false,
        },
      })
      isNewUser = true
    }

    // Check setup status
    const setupStatus = await checkSetupStatus(user.id)
    const token = generateToken(user, setupStatus)
    
    // Redirect back to frontend with token
    const frontendCallback = state ? decodeURIComponent(state as string) : (process.env.FRONTEND_URL || 'http://localhost:5173') + '/auth/callback'
    const redirectUrl = `${frontendCallback}?` +
      `token=${encodeURIComponent(token)}&` +
      `user=${encodeURIComponent(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isRegistrationComplete: setupStatus.isRegistrationComplete
      }))}&` +
      `setupStatus=${encodeURIComponent(JSON.stringify(setupStatus))}&` +
      `requiresSetup=${setupStatus.missingSteps.length > 0}`
    
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    const { state } = req.query
    const frontendCallback = state ? decodeURIComponent(state as string) : (process.env.FRONTEND_URL || 'http://localhost:5173') + '/auth/callback'
    res.redirect(`${frontendCallback}?error=${encodeURIComponent('Authentication failed')}`)
  }
})

// GOOGLE OAUTH
router.post('/google', async (req: Request, res: Response) => {
  try {
    const idToken = req.body.idToken || req.body.token;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing the idToken' })
    }

    let payload
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch (err) {
      return res.status(401).json({ error: 'Invalid google token' })
    }

    if (!payload) {
      return res.status(400).json({ error: 'Invalid token payload' })
    }

    const { email, name } = payload
    if (!email) {
      return res.status(400).json({ error: 'Email missing in the token!' })
    }

    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: '',
          role: 'car_owner',
          isRegistrationComplete: false,
        },
      })
      isNewUser = true
    }

    // Check setup status
    const setupStatus = await checkSetupStatus(user.id)
    const token = generateToken(user, setupStatus)
    
    res.json({
      message: isNewUser ? 'Google login successful - setup required' : 'Google login successful', 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isRegistrationComplete: setupStatus.isRegistrationComplete
      },
      setupStatus,
      requiresSetup: setupStatus.missingSteps.length > 0
    })
  } catch (error) {
    console.error('Google login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// SETUP STATUS CHECK
router.get('/setup-status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const setupStatus = await checkSetupStatus(userId)

    res.json({ 
      setupStatus,
      canAccessDashboard: setupStatus.missingSteps.length === 0,
      nextStep: setupStatus.redirectTo
    })
  } catch (error) {
    console.error('Get setup status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// COMPLETE SETUP DETAILS
router.post('/setup/details', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const completeData: CompleteRegistrationData = req.body
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Validate input
    const validation = validateCompleteRegistrationData(completeData)
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') })
    }

    const { phone, role, profileData } = completeData

    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Update user and create profile with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { 
          phone,
          role,
          isRegistrationComplete: true
        }
      })

      // Create role-specific profile
      if (role === 'car_owner' && profileData.vehicles) {
        await tx.carOwnerProfile.create({
          data: { userId: userId }
        })

        for (let i = 0; i < profileData.vehicles.length; i++) {
          const vehicle = profileData.vehicles[i]
          await tx.vehicle.create({
            data: {
              userId: userId,
              vehicleName: vehicle.vehicleName,
              model: vehicle.model,
              year: vehicle.year,
              licensePlate: vehicle.licensePlate,
              color: vehicle.color,
              vehicleType: vehicle.vehicleType,
              isPrimary: i === 0,
            }
          })
        }
      }

      if (role === 'service_center' && profileData.businessDetails) {
        await tx.serviceCenterProfile.create({
          data: {
            userId: userId,
            businessName: profileData.businessDetails.businessName,
            address: profileData.businessDetails.address,
            businessRegistrationNumber: profileData.businessDetails.businessRegistrationNumber,
            servicesOffered: JSON.stringify(profileData.businessDetails.servicesOffered),
            operatingHours: JSON.stringify(profileData.businessDetails.operatingHours),
            logo: profileData.businessDetails.logo,
          }
        })
      }

      if (role === 'part_seller' && profileData.shopDetails) {
        await tx.partSellerProfile.create({
          data: {
            userId: userId,
            shopName: profileData.shopDetails.shopName,
            address: profileData.shopDetails.address,
            categoriesSold: JSON.stringify(profileData.shopDetails.categoriesSold),
            inventoryCapacity: profileData.shopDetails.inventoryCapacity,
            contactPersonName: profileData.shopDetails.contactPersonName,
          }
        })
      }

      return updatedUser
    })

    // Check updated setup status
    const setupStatus = await checkSetupStatus(result.id)
    const newToken = generateToken(result, setupStatus)

    res.json({ 
      message: 'Setup details completed successfully', 
      token: newToken,
      user: { 
        id: result.id, 
        email: result.email, 
        name: result.name,
        phone: result.phone,
        role: result.role
      },
      setupStatus,
      requiresSetup: setupStatus.missingSteps.length > 0
    })
  } catch (error) {
    console.error('Complete setup details error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/signout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Optional: Update last signout time in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        updatedAt: new Date()
      }
    }).catch(error => {
      console.warn('Failed to update signout timestamp:', error)
    })

    res.json({ 
      message: 'Signed out successfully',
      success: true
    })
  } catch (error) {
    console.error('Signout error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/welcome-email', async (req: Request, res: Response) => {
  try {
    const { email, username } = req.body;

    console.log(req.body)

    // Validate required fields
    if (!email || !username) {
      return res.status(400).json({ 
        error: 'Email and username are required' 
      });
    }

    // Validate email format
    const correctEmail = validateEmail(email);
    if (!correctEmail) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    // Send welcome email
    // const result = await EmailService.sendWelcomeEmail(email, username);
    
    // if (result) {
      res.json({
        message: 'Welcome email sent successfully',
        success: true
      });
    // } else {
    //   return res.status(400).json({ 
    //     error: 'Error sending welcome email' 
    //   });
    // }
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Notification email route
router.post('/notification-email', async (req: Request, res: Response) => {
  try {
    const { email, title, message } = req.body;

    // Validate required fields
    if (!email || !title || !message) {
      return res.status(400).json({ 
        error: 'Email, title, and message are required' 
      });
    }

    // Validate email format
    const correctEmail = validateEmail(email);
    if (!correctEmail) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    // Send notification email
    const result = await EmailService.sendNotificationEmail(email, title, message);
    
    if (result) {
      res.json({
        message: 'Notification email sent successfully',
        success: true
      });
    } else {
      return res.status(400).json({ 
        error: 'Error sending notification email' 
      });
    }
  } catch (error) {
    console.error('Notification email error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Verify email route
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required' 
      });
    }

    // Validate email format
    const correctEmail = validateEmail(email);
    if (!correctEmail) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    // Send verification email
    const result = await EmailService.VerifyEmail(email, otp);
    
    if (result) {
      res.json({
        message: 'Verification email sent successfully',
        success: true
      });
    } else {
      return res.status(400).json({ 
        error: 'Error sending verification email' 
      });
    }
  } catch (error) {
    console.error('Verification email error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Test email route (for development)
router.post('/test-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const correctEmail = validateEmail(email);
    if (!correctEmail) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    // Send test email
    const result = await EmailService.sendCustomEmail(
      email,
      'Test Email',
      '<h1>Test Email</h1><p>This is a test email from your application.</p>',
      true
    );
    
    if (result.success) {
      res.json({
        message: 'Test email sent successfully',
        success: true
      });
    } else {
      return res.status(400).json({ 
        error: 'Error sending test email',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// ONBOARDING for Car Owner
router.post('/onboarding', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, contact, profileImage } = req.body;

    console.log(req.body);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch user and check role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role !== 'car_owner') {
      return res.status(403).json({ error: 'Onboarding only allowed for car owners' });
    }

    // Update phone in User
    await prisma.user.update({
      where: { id: userId },
      data: { phone: contact, name: name, isRegistrationComplete: true  },
    });

    // Upsert CarOwnerProfile (update if exists, create if not)
    await prisma.carOwnerProfile.upsert({
      where: { userId },
      update: { name: name || '', imageBase64: profileImage || '' },
      create: { userId, name: name || '', imageBase64: profileImage || '' },
    });

    res.json({ message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/delete-account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Delete the user (this will also delete CarOwnerProfile and Vehicles if cascade is set)
    await prisma.carOwnerProfile.delete({ where: { userId: userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'Account deleted successfully', success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

const otpStore = new Map();

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 }); // 10 min expiry

  // Send OTP email
  await EmailService.sendCustomEmail(
    email,
    'Your OTP Code',
    `<h1>Your OTP: ${otp}</h1><p>Valid for 10 minutes.</p>`,
    true
  );

  res.json({ message: 'OTP sent to email' });
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore.get(email);
  if (!record || record.otp !== otp || Date.now() > record.expires) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  otpStore.delete(email);

  // Generate a short-lived reset token (JWT)
  const resetToken = jwt.sign({ email, type: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
  res.json({ message: 'OTP verified', resetToken });
});

router.post('/reset-password', async (req, res) => {
  const { email, password, token } = req.body;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    if (payload.email !== email || payload.type !== 'reset') {
      return res.status(400).json({ error: 'Invalid token' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email }, data: { password: hashed } });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

export default router