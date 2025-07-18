import express from 'express';
import prisma from '../prisma';
import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// List all packages for a service center
router.get('/service-centers/:centerId/packages', [
  param('centerId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  try {
    const packages = await prisma.servicePackage.findMany({
      where: { serviceCenterId: Number(centerId) },
      include: {
        services: {
          include: { service: true }
        }
      }
    });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Get a single package
router.get('/service-centers/:centerId/packages/:packageId', [
  param('centerId').isInt(),
  param('packageId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { packageId } = req.params;
  try {
    const pkg = await prisma.servicePackage.findUnique({
      where: { id: Number(packageId) },
      include: {
        services: {
          include: { service: true }
        }
      }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// Create a new package
router.post('/service-centers/:centerId/packages', [
  param('centerId').isInt(),
  body('name').isString(),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('createdBy').optional().isString(),
  body('discountType').optional().isString(),
  body('discountValue').optional().isNumeric(),
  body('customTotal').optional().isNumeric(),
  body('serviceIds').isArray(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  const {
    name, description, category, isActive, createdBy,
    discountType, discountValue, customTotal, serviceIds
  } = req.body;
  try {
    const pkg = await prisma.servicePackage.create({
      data: {
        name,
        description,
        category,
        isActive: isActive !== undefined ? isActive : true,
        createdBy,
        discountType,
        discountValue,
        customTotal,
        serviceCenterId: Number(centerId),
        services: {
          create: serviceIds.map((serviceId: number) => ({ serviceId }))
        }
      },
      include: {
        services: { include: { service: true } }
      }
    });
    res.status(201).json(pkg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Update an existing package
router.put('/service-centers/:centerId/packages/:packageId', [
  param('centerId').isInt(),
  param('packageId').isInt(),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('createdBy').optional().isString(),
  body('discountType').optional().isString(),
  body('discountValue').optional().isNumeric(),
  body('customTotal').optional().isNumeric(),
  body('serviceIds').optional().isArray(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { packageId } = req.params;
  const {
    name, description, category, isActive, createdBy,
    discountType, discountValue, customTotal, serviceIds
  } = req.body;
  try {
    // Update package details
    const pkg = await prisma.servicePackage.update({
      where: { id: Number(packageId) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(createdBy !== undefined && { createdBy }),
        ...(discountType !== undefined && { discountType }),
        ...(discountValue !== undefined && { discountValue }),
        ...(customTotal !== undefined && { customTotal })
      }
    });
    // Update services if provided
    if (serviceIds) {
      // Remove all existing
      await prisma.serviceInPackage.deleteMany({ where: { packageId: Number(packageId) } });
      // Add new
      await prisma.serviceInPackage.createMany({
        data: serviceIds.map((serviceId: number) => ({ packageId: Number(packageId), serviceId }))
      });
    }
    // Return updated package
    const updated = await prisma.servicePackage.findUnique({
      where: { id: Number(packageId) },
      include: { services: { include: { service: true } } }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete a package
router.delete('/service-centers/:centerId/packages/:packageId', [
  param('centerId').isInt(),
  param('packageId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { packageId } = req.params;
  try {
    // Delete all ServiceInPackage entries first (to avoid FK constraint errors)
    await prisma.serviceInPackage.deleteMany({ where: { packageId: Number(packageId) } });
    await prisma.servicePackage.delete({ where: { id: Number(packageId) } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

export default router; 