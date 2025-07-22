import { Router, Response } from 'express'
import prisma from '../prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { validateVehicleData } from '../utils/validation'

const router = Router()

// Add vehicle
router.post('/:userId/vehicles', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!user || user.role !== 'car_owner') {
      return res.status(400).json({ error: 'Only car owners can add vehicles' });
    }

    // Accept fields from body
    const {
      vehicleName,
      model,
      year,
      licensePlate,
      color,
      image
    } = req.body;

    // Validate required fields
    if (!vehicleName || !model || !year || !licensePlate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if license plate already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { licensePlate }
    });
    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this license plate already exists' });
    }

    // Only allow vehicleType 'car' for this onboarding
    const finalColor = color || 'white';

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: parseInt(userId),
        vehicleName,
        model,
        year: parseInt(year),
        licensePlate,
        color: finalColor,
        // Optionally store image if you add an image field to Vehicle model
      }
    });

    res.json({
      message: 'Vehicle added successfully',
      vehicle
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// Get user vehicles
router.get('/:userId/vehicles', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params
    
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { isPrimary: 'desc' }
    })

    res.json({ vehicles })
  } catch (error) {
    console.error('Get vehicles error:', error)
    res.status(500).json({ error: 'Failed to get vehicles' })
  }
})

// Get specific vehicle for a user
router.get('/:userId/vehicles/:vehicleId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, vehicleId } = req.params;
    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: parseInt(vehicleId),
        userId: parseInt(userId),
      },
    });
    console.log('Route hit for userId:', userId, 'vehicleId:', vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ vehicle });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ error: 'Failed to get vehicle' });
  }
});

// Update vehicle
router.put('/:userId/vehicles/:vehicleId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, vehicleId } = req.params
    const { vehicleData } = req.body
    const authenticatedUserId = req.user?.userId

    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Validate vehicle data
    const validation = validateVehicleData(vehicleData)
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') })
    }

    const vehicle = await prisma.vehicle.update({
      where: { 
        id: parseInt(vehicleId),
        userId: parseInt(userId) // Ensure user owns the vehicle
      },
      data: {
        vehicleName: vehicleData.vehicleName,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: vehicleData.licensePlate,
        color: vehicleData.color,
        isPrimary: vehicleData.isPrimary,
      }
    })

    res.json({ 
      message: 'Vehicle updated successfully', 
      vehicle 
    })
  } catch (error) {
    console.error('Update vehicle error:', error)
    res.status(500).json({ error: 'Failed to update vehicle' })
  }
})

// Delete vehicle
router.delete('/:userId/vehicles/:vehicleId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, vehicleId } = req.params
    const authenticatedUserId = req.user?.userId

    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    await prisma.vehicle.delete({
      where: { 
        id: parseInt(vehicleId),
        userId: parseInt(userId) // Ensure user owns the vehicle
      }
    })

    res.json({ message: 'Vehicle deleted successfully' })
  } catch (error) {
    console.error('Delete vehicle error:', error)
    res.status(500).json({ error: 'Failed to delete vehicle' })
  }
})

// Set primary vehicle
router.patch('/:userId/vehicles/:vehicleId/primary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, vehicleId } = req.params
    const authenticatedUserId = req.user?.userId

    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Reset all vehicles to non-primary
    await prisma.vehicle.updateMany({
      where: { userId: parseInt(userId) },
      data: { isPrimary: false }
    })

    // Set the specified vehicle as primary
    const vehicle = await prisma.vehicle.update({
      where: { 
        id: parseInt(vehicleId),
        userId: parseInt(userId)
      },
      data: { isPrimary: true }
    })

    res.json({ 
      message: 'Primary vehicle updated successfully', 
      vehicle 
    })
  } catch (error) {
    console.error('Set primary vehicle error:', error)
    res.status(500).json({ error: 'Failed to set primary vehicle' })
  }
})

// Get summary of all cars for a user (for rendering in Cars UI)
router.get('/:userId/cars', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Get cars summary request received');
    const { userId } = req.params;
    const authenticatedUserId = req.user?.userId;
    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    console.log("User Id is", userId);
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { isPrimary: 'desc' }
    });
    // Map to summary structure for UI
    const cars = vehicles.map(car => ({
      id: car.id,
      vehicleName: car.vehicleName,
      model: car.model,
      year: car.year,
      color: car.color,
      image: car.image,
      nickname: car.nickname,
      status: car.status,
      statusText: car.statusText,
      // Add more fields as needed for UI
    }));
    res.json({ cars });
  } catch (error) {
    console.error('Get cars summary error:', error);
    res.status(500).json({ error: 'Failed to get cars' });
  }
});

export default router 