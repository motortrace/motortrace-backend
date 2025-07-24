import { PrismaClient } from '@prisma/client'
import prisma from '../src/prisma';

async function main() {
  // Test car_owner registration
  const carOwner = await prisma.user.create({
    data: {
      email: 'carowner@motortrace.com',
      name: 'John Car Owner',
      phone: '+1234567890',
      password: 'testpassword123',
      role: 'car_owner',
    },
  })

  console.log('Car owner created:', carOwner)

  // Test service_center registration
  const serviceCenter = await prisma.user.create({
    data: {
      email: 'servicecenter@motortrace.com',
      name: 'ABC Auto Service',
      phone: '+1234567891',
      password: 'testpassword123',
      role: 'service_center',
    },
  })

  console.log('Service center created:', serviceCenter)

  // Test part_seller registration
  const partSeller = await prisma.user.create({
    data: {
      email: 'partseller@motortrace.com',
      name: 'XYZ Parts Store',
      phone: '+1234567892',
      password: 'testpassword123',
      role: 'part_seller',
    },
  })

  console.log('Part seller created:', partSeller)

  const allUsers = await prisma.user.findMany()
  console.log('All users:', allUsers)
}

main().finally(() => prisma.$disconnect())
