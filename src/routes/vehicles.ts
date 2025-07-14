import { Router, Response } from 'express'
import prisma from '../prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { validateVehicleData } from '../utils/validation'

const router = Router()

// Add vehicle
router.post('/:userId/vehicles', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params
    const { vehicleData } = req.body
    const authenticatedUserId = req.user?.userId

    if (!authenticatedUserId || authenticatedUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    })

    if (!user || user.role !== 'car_owner') {
      return res.status(400).json({ error: 'Only car owners can add vehicles' })
    }

    // Validate vehicle data
    const validation = validateVehicleData(vehicleData)
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') })
    }

    // Check if license plate already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { licensePlate: vehicleData.licensePlate }
    })

    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this license plate already exists' })
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: parseInt(userId),
        vehicleName: vehicleData.vehicleName,
        model: vehicleData.model,
        year: vehicleData.year,
        licensePlate: vehicleData.licensePlate,
        color: vehicleData.color,
        vehicleType: vehicleData.vehicleType,
        isPrimary: vehicleData.isPrimary || false,
      }
    })

    res.json({ 
      message: 'Vehicle added successfully', 
      vehicle 
    })
  } catch (error) {
    console.error('Add vehicle error:', error)
    res.status(500).json({ error: 'Failed to add vehicle' })
  }
})

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
        vehicleType: vehicleData.vehicleType,
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

export default router 