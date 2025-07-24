import express from 'express';
import prisma from '../prisma';
import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

// Middleware for validation errors
function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// List all services (with optional filters)
router.get('/service-centers/:centerId/services', [
  param('centerId').isInt(),
  query('status').optional().isIn(['active', 'inactive']),
  query('category').optional().isString(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  let { status, category } = req.query;

  // Ensure category is a string
  if (Array.isArray(category)) {
    category = category[0];
  }
  if (typeof category !== 'string') {
    category = undefined;
  }

  try {
    const services = await prisma.shopService.findMany({
      where: {
        serviceCenterId: Number(centerId),
        ...(status ? { isActive: status === 'active' } : {}),
        ...(category ? { serviceType: { name: category } } : {})
      },
      include: { serviceType: true }
    });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Create a new service
router.post('/service-centers/:centerId/services', [
  param('centerId').isInt(),
  body('name').isString(),
  body('description').optional().isString(),
  body('price').isFloat(),
  body('unit').isString(),
  body('duration').optional().isFloat(),
  body('discount').optional().isFloat(),
  body('serviceTypeId').optional().isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  try {
    const service = await prisma.shopService.create({
      data: {
        ...req.body,
        serviceCenterId: Number(centerId)
      }
    });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Get a single service
router.get('/service-centers/:centerId/services/:serviceId', [
  param('centerId').isInt(),
  param('serviceId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { serviceId } = req.params;
  try {
    const service = await prisma.shopService.findUnique({
      where: { id: Number(serviceId) },
      include: { serviceType: true }
    });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// Update a service
router.put('/service-centers/:centerId/services/:serviceId', [
  param('centerId').isInt(),
  param('serviceId').isInt(),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('price').optional().isFloat(),
  body('unit').optional().isString(),
  body('duration').optional().isFloat(),
  body('discount').optional().isFloat(),
  body('serviceTypeId').optional().isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { serviceId } = req.params;
  try {
    const service = await prisma.shopService.update({
      where: { id: Number(serviceId) },
      data: req.body
    });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Toggle active/inactive
router.patch('/service-centers/:centerId/services/:serviceId/toggle', [
  param('centerId').isInt(),
  param('serviceId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { serviceId } = req.params;
  try {
    const service = await prisma.shopService.findUnique({ where: { id: Number(serviceId) } });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    const updated = await prisma.shopService.update({
      where: { id: Number(serviceId) },
      data: { isActive: !service.isActive }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle service status' });
  }
});

// Delete a service
router.delete('/service-centers/:centerId/services/:serviceId', [
  param('centerId').isInt(),
  param('serviceId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { serviceId } = req.params;
  try {
    await prisma.shopService.delete({ where: { id: Number(serviceId) } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Metrics endpoint
router.get('/service-centers/:centerId/services/metrics', [
  param('centerId').isInt(),
  handleValidationErrors
], async (req: Request, res: Response) => {
  const { centerId } = req.params;
  try {
    const [total, active, inactive] = await Promise.all([
      prisma.shopService.count({ where: { serviceCenterId: Number(centerId) } }),
      prisma.shopService.count({ where: { serviceCenterId: Number(centerId), isActive: true } }),
      prisma.shopService.count({ where: { serviceCenterId: Number(centerId), isActive: false } })
    ]);
    res.json({ total, active, inactive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router; 