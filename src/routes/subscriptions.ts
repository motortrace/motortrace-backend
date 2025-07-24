import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /subscriptions
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { planType, paymentData } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // Only allow one active subscription per user
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing) return res.status(400).json({ error: 'Subscription already exists' });
    const now = new Date();
    let endDate = new Date(now);
    if (planType === 'yearly') endDate.setFullYear(now.getFullYear() + 1);
    else endDate.setMonth(now.getMonth() + 1);
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planType,
        status: 'active',
        startDate: now,
        endDate,
        paymentData: JSON.stringify(paymentData),
      },
    });
    res.json({ message: 'Subscription created', subscription });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// GET /users/:userId/subscription
router.get('/users/:userId/subscription', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const authUserId = req.user?.userId;
  if (parseInt(userId) !== authUserId) return res.status(403).json({ error: 'Unauthorized' });
  try {
    const subscription = await prisma.subscription.findUnique({ where: { userId: parseInt(userId) } });
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: { ...subscription, paymentData: JSON.parse(subscription.paymentData) } });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// PUT /subscriptions/:id
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const { planType, paymentData, status } = req.body;
  try {
    const subscription = await prisma.subscription.findUnique({ where: { id: parseInt(id) } });
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    if (subscription.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    let endDate = new Date(subscription.startDate);
    if (planType === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);
    const updated = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: {
        planType: planType || subscription.planType,
        paymentData: paymentData ? JSON.stringify(paymentData) : subscription.paymentData,
        status: status || subscription.status,
        endDate,
      },
    });
    res.json({ message: 'Subscription updated', subscription: { ...updated, paymentData: JSON.parse(updated.paymentData) } });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// DELETE /subscriptions/:id
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  try {
    const subscription = await prisma.subscription.findUnique({ where: { id: parseInt(id) } });
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    if (subscription.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await prisma.subscription.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Subscription deleted' });
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

export default router; 