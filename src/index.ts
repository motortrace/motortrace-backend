import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, AuthenticatedRequest } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth'
import vehicleRoutes from './routes/vehicles'
import profileRoutes from './routes/profiles'
import subscriptionRoutes from './routes/subscriptions'
import serviceTypesRouter from './routes/serviceTypes';
import servicesRouter from './routes/services';
import prisma from './prisma';

const app = express()

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}))

app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Test database connection
app.get('/test-db', async (req, res) => {
  try {
    await prisma.$connect()
    res.json({ message: 'Database connected' })
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' })
  }
})

app.get('/user/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        carOwnerProfile: true,
        serviceCenterProfile: true,
        partSellerProfile: true,
        vehicles: true,
        subscription: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let isSetupComplete = false;
    let centerId = null;

    switch (user.role) {
      case 'car_owner':
        isSetupComplete = !!(user.carOwnerProfile && user.vehicles.length > 0);
        break;

      case 'service_center':
        isSetupComplete = !!user.serviceCenterProfile;
        centerId = user.serviceCenterProfile?.id || null;
        break;

      case 'part_seller':
        isSetupComplete = !!user.partSellerProfile;
        break;
    }

    const hasActiveSubscription = !!(user.subscription && user.subscription.status === 'active');

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSetupComplete,
      hasActiveSubscription,
      centerId,
    });

  } catch (error) {
    console.error('User status error:', error);
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});


// Mount routes
app.use('/auth', authRoutes)
app.use('/users', vehicleRoutes)
app.use('/subscriptions', subscriptionRoutes)
app.use('/profiles', profileRoutes)
app.use('/service-types', serviceTypesRouter);
app.use('/', servicesRouter);

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Database test: http://localhost:${PORT}/test-db`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
