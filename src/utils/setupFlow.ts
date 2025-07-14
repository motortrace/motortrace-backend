import { PrismaClient } from '@prisma/client'
import { SetupStatus } from '../types'
import prisma from '../prisma';

export const checkSetupStatus = async (userId: number): Promise<SetupStatus> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      carOwnerProfile: true,
      serviceCenterProfile: true,
      partSellerProfile: true,
      vehicles: true,
      subscription: true
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  const missingSteps: string[] = []
  let redirectTo: string | null = null

  // Check if registration is complete (has phone and role)
  const isRegistrationComplete = !!(user.phone && user.role && user.role !== 'car_owner')
  
  if (!isRegistrationComplete) {
    missingSteps.push('registration')
    redirectTo = '/setup/details'
  }

  // Check if profile setup is complete
  let isSetupComplete = false
  
  switch (user.role) {
    case 'car_owner':
      isSetupComplete = !!(user.carOwnerProfile && user.vehicles.length > 0)
      break
    case 'service_center':
      isSetupComplete = !!user.serviceCenterProfile
      break
    case 'part_seller':
      isSetupComplete = !!user.partSellerProfile
      break
  }

  if (!isSetupComplete) {
    missingSteps.push('profile')
    redirectTo = '/setup/details'
  }

  // Check if subscription is active (only for business users)
  const hasActiveSubscription = !!(user.subscription && user.subscription.status === 'active')
  
  if ((user.role === 'service_center' || user.role === 'part_seller') && !hasActiveSubscription) {
    missingSteps.push('payment')
    redirectTo = '/setup/payment'
  }

  // If all steps are complete, no redirect needed
  if (missingSteps.length === 0) {
    redirectTo = null
  }

  return {
    isRegistrationComplete,
    isSetupComplete,
    hasActiveSubscription,
    missingSteps,
    redirectTo
  }
}

export const canAccessDashboard = (setupStatus: SetupStatus): boolean => {
  return setupStatus.missingSteps.length === 0
}

export const getNextSetupStep = (setupStatus: SetupStatus): string | null => {
  return setupStatus.redirectTo
} 