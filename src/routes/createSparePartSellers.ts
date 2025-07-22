import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma';
import { EmailService } from '../Services/Email';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      shopName,
      address,
      categoriesSold, // should be a JSON string, e.g. '["engine", "brakes"]'
      inventoryCapacity, // optional
      contactPersonName,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !shopName || !address || !categoriesSold || !contactPersonName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashed,
        role: 'part_seller',
        isRegistrationComplete: true,
      },
    });

    // Create part seller profile
    await prisma.partSellerProfile.create({
      data: {
        userId: user.id,
        shopName,
        address,
        categoriesSold, // should be a JSON string
        inventoryCapacity, // optional
        contactPersonName,
      },
    });

    await EmailService.sendWelcomeEmail(email);

    res.json({ message: 'Spare Parts Seller created successfully', user });
  } catch (error) {
    console.error('Create spare parts seller error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;