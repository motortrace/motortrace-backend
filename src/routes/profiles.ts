import { Router, Response, Request, NextFunction } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Helper middleware for validation errors
function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// GET /profiles/:userId
router.get('/:userId', [
  param('userId').isInt(),
  handleValidationErrors
], authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        carOwnerProfile: true,
        serviceCenterProfile: true,
        partSellerProfile: true,
        vehicles: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let profile = null;
    if (user.role === 'car_owner') {
      profile = {
        ...user.carOwnerProfile,
        vehicles: user.vehicles,
      };
    } else if (user.role === 'service_center') {
      profile = {
        ...user.serviceCenterProfile,
        servicesOffered: user.serviceCenterProfile?.servicesOffered ? JSON.parse(user.serviceCenterProfile.servicesOffered) : [],
        operatingHours: user.serviceCenterProfile?.operatingHours ? JSON.parse(user.serviceCenterProfile.operatingHours) : {},
      };
    } else if (user.role === 'part_seller') {
      profile = {
        ...user.partSellerProfile,
        categoriesSold: user.partSellerProfile?.categoriesSold ? JSON.parse(user.partSellerProfile.categoriesSold) : [],
      };
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      profile,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /profiles/:userId
router.put('/:userId', [
  param('userId').isInt(),
  body('name').isString().notEmpty(),
  body('phone').isString().notEmpty(),
  body('image').isString().notEmpty(),
  handleValidationErrors
], authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const authUserId = req.user?.userId;
  if (parseInt(userId) !== authUserId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, phone, image } = req.body;
    // Update user basic info

    // Update role-specific profile
    if (user.role === 'car_owner') {

      await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          phone,
        },
      });

      // Remove all vehicles and re-add (simple approach)
      await prisma.carOwnerProfile.update({
        where: { userId: user.id },
        data: {
          name,
          imageBase64: image,
        },
      });
    } 
    // else if (user.role === 'service_center') {
    //   await prisma.serviceCenterProfile.update({
    //     where: { userId: user.id },
    //     data: {
    //       businessName: profileData.businessDetails.businessName,
    //       address: profileData.businessDetails.address,
    //       businessRegistrationNumber: profileData.businessDetails.businessRegistrationNumber,
    //       servicesOffered: JSON.stringify(profileData.businessDetails.servicesOffered),
    //       operatingHours: JSON.stringify(profileData.businessDetails.operatingHours),
    //       logo: profileData.businessDetails.logo,
    //     },
    //   });
    // } else if (user.role === 'part_seller' && profileData?.shopDetails) {
    //   await prisma.partSellerProfile.update({
    //     where: { userId: user.id },
    //     data: {
    //       shopName: profileData.shopDetails.shopName,
    //       address: profileData.shopDetails.address,
    //       categoriesSold: JSON.stringify(profileData.shopDetails.categoriesSold),
    //       inventoryCapacity: profileData.shopDetails.inventoryCapacity,
    //       contactPersonName: profileData.shopDetails.contactPersonName,
    //     },
    //   });
    res.json({ message: 'Profile updated successfully' });
  }
  catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;