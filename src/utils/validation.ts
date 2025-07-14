import { RegistrationData, CompleteRegistrationData } from '../types'

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): boolean => {
  return password.length >= 8
}

export const validatePhone = (phone: string): boolean => {
  // Basic phone validation - can be enhanced based on requirements
  return phone.length >= 10
}

export const validateRole = (role: string): boolean => {
  const validRoles = ['car_owner', 'service_center', 'part_seller']
  return validRoles.includes(role)
}

export const validateRegistrationData = (data: RegistrationData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Only require email and password for initial registration
  if (!data.email || !data.password) {
    errors.push('Missing required fields: email, password')
  }

  // Email validation
  if (data.email && !validateEmail(data.email)) {
    errors.push('Invalid email format')
  }

  // Password validation
  if (data.password && !validatePassword(data.password)) {
    errors.push('Password must be at least 8 characters long')
  }

  // Do not require name, phone, or role at this stage
  // Remove role-specific validation for initial registration

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateCompleteRegistrationData = (data: CompleteRegistrationData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Required fields
  if (!data.phone || !data.role) {
    errors.push('Missing required fields: phone, role')
  }

  // Phone validation
  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Invalid phone number format')
  }

  // Role validation
  if (data.role && !validateRole(data.role)) {
    errors.push('Invalid role. Must be car_owner, service_center, or part_seller')
  }

  // Role-specific validation
  if (data.role === 'car_owner' && (!data.profileData?.vehicles || data.profileData.vehicles.length === 0)) {
    errors.push('At least one vehicle is required for car_owner registration')
  }

  if (data.role === 'service_center' && !data.profileData?.businessDetails) {
    errors.push('Business details are required for service_center registration')
  }

  if (data.role === 'part_seller' && !data.profileData?.shopDetails) {
    errors.push('Shop details are required for part_seller registration')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateVehicleData = (vehicle: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!vehicle.vehicleName || !vehicle.model || !vehicle.year || !vehicle.licensePlate || !vehicle.color || !vehicle.vehicleType) {
    errors.push('All vehicle fields are required: vehicleName, model, year, licensePlate, color, vehicleType')
  }

  if (vehicle.year && (vehicle.year < 1900 || vehicle.year > new Date().getFullYear() + 1)) {
    errors.push('Invalid vehicle year')
  }

  if (vehicle.licensePlate && vehicle.licensePlate.length < 3) {
    errors.push('License plate must be at least 3 characters')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
} 