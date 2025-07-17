import express from 'express';
import prisma from '../prisma';
import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// List all packages (with optional filters)
router.get('/service-centers/:centerId/packages', [
  param('centerId').isInt(),
  query('status').optional().isIn(['active', 'inactive']),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  const { status } = req.query;
  try {
    const packages = await prisma.packageTemplate.findMany({
      where: {
        centerId: Number(centerId),
        ...(status ? { isActive: status === 'active' } : {})
      },
      include: {
        services: { include: { serviceTemplate: true } }
      }
    });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Create a new package
router.post('/service-centers/:centerId/packages', [
  param('centerId').isInt(),
  body('name').isString(),
  body('description').optional().isString(),
  body('serviceTemplateIds').isArray(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  const { name, description, serviceTemplateIds } = req.body;
  try {
    const pkg = await prisma.packageTemplate.create({
      data: {
        name,
        description,
        centerId: Number(centerId),
        services: {
          create: serviceTemplateIds.map((id) => ({ serviceTemplateId: id }))
        }
      },
      include: {
        services: { include: { serviceTemplate: true } }
      }
    });
    res.status(201).json(pkg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package' });
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
    const pkg = await prisma.packageTemplate.findUnique({
      where: { id: Number(packageId) },
      include: {
        services: { include: { serviceTemplate: true } }
      }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// Update a package (including services)
router.put('/service-centers/:centerId/packages/:packageId', [
  param('centerId').isInt(),
  param('packageId').isInt(),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('serviceTemplateIds').optional().isArray(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { packageId } = req.params;
  const { name, description, serviceTemplateIds } = req.body;
  try {
    // Update package details
    const pkg = await prisma.packageTemplate.update({
      where: { id: Number(packageId) },
      data: {
        ...(name && { name }),
        ...(description && { description })
      }
    });
    // Update services if provided
    if (serviceTemplateIds) {
      // Remove all existing
      await prisma.packageTemplateService.deleteMany({ where: { packageTemplateId: Number(packageId) } });
      // Add new
      await prisma.packageTemplateService.createMany({
        data: serviceTemplateIds.map((id) => ({ packageTemplateId: Number(packageId), serviceTemplateId: id }))
      });
    }
    // Return updated package
    const updated = await prisma.packageTemplate.findUnique({
      where: { id: Number(packageId) },
      include: { services: { include: { serviceTemplate: true } } }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Toggle active/inactive (requires isActive field in schema)
router.patch('/service-centers/:centerId/packages/:packageId/toggle', [
  param('centerId').isInt(),
  param('packageId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { packageId } = req.params;
  try {
    const pkg = await prisma.packageTemplate.findUnique({ where: { id: Number(packageId) } });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    // If isActive is not in schema, skip this endpoint or add it
    const updated = await prisma.packageTemplate.update({
      where: { id: Number(packageId) },
      data: { isActive: !pkg.isActive }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle package status' });
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
    await prisma.packageTemplate.delete({ where: { id: Number(packageId) } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// Metrics endpoint
router.get('/service-centers/:centerId/packages/metrics', [
  param('centerId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  try {
    const [total] = await Promise.all([
      prisma.packageTemplate.count({ where: { centerId: Number(centerId) } })
    ]);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Analytics endpoint (example: most popular packages)
router.get('/service-centers/:centerId/packages/analytics', [
  param('centerId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  try {
    // Example: most used packages (if tracked in work orders, otherwise skip)
    // Placeholder: return empty
    res.json({ popular: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router; 