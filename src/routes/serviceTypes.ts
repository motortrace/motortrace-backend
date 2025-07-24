import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const serviceTypes = await prisma.serviceType.findMany();
    res.json(serviceTypes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

export default router; 