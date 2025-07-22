import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma';
import { EmailService } from '../Services/Email';

const router = Router();

// Admin endpoint to create Service Centers or Car Users
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userType, ...form } = req.body;
    // userType: 'Service Centers' | 'Car Users'
    if (!userType || (userType !== 'Service Centers' && userType !== 'Car Users')) {
      return res.status(400).json({ error: 'Invalid or missing userType' });
    }

    // Common fields
    const { name, email, phone } = form;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    let user;
    if (userType === 'Service Centers') {
      // Service Center creation
      const { password, businessName, address, businessRegistrationNumber, contactPersonName } = form;
      if (!password || !businessName || !address || !businessRegistrationNumber) {
        return res.status(400).json({ error: 'Missing required service center fields' });
      }
      const hashed = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashed,
          role: 'service_center',
          isRegistrationComplete: true,
        },
      });
      await prisma.serviceCenterProfile.create({
        data: {
          userId: user.id,
          businessName,
          address,
          businessRegistrationNumber,
          servicesOffered: '[]', // required by schema, set as empty array JSON
          operatingHours: '{}', // required by schema, set as empty object JSON
          // contactPersonName is not a field in ServiceCenterProfile
        },
      });
      await EmailService.sendWelcomeEmail(email);
    } else if (userType === 'Car Users') {
      // Car User creation
      const { totalVehicles } = form;
      if (!totalVehicles) {
        return res.status(400).json({ error: 'Missing totalVehicles for car user' });
      }
      user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          role: 'car_owner',
          isRegistrationComplete: true,
        },
      });
      await prisma.carOwnerProfile.create({
        data: {
          userId: user.id,
          // Optionally add more fields if needed
        },
      });
      // Optionally, you could create vehicle records here if needed
      await EmailService.sendWelcomeEmail(email);
    }
    res.json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
