import express from 'express'

// Authentication types
export interface AuthenticatedRequest extends express.Request {
  user?: {
    userId: number
    role: string
    isRegistrationComplete?: boolean
    isSetupComplete?: boolean
    hasActiveSubscription?: boolean
  }
}

// User types
export interface UserResponse {
  id: number
  email: string
  name: string | null
  phone: string | null
  role: string
  isRegistrationComplete?: boolean
  isSetupComplete?: boolean
  hasActiveSubscription?: boolean
}

// Registration types
export interface RegistrationData {
  email: string
  password: string
  name: string
  phone: string
  role: 'car_owner' | 'service_center' | 'part_seller'
  profileData: ProfileData
}

export interface CompleteRegistrationData {
  phone: string
  role: 'car_owner' | 'service_center' | 'part_seller'
  profileData: ProfileData
}

// Setup flow types
export interface SetupStatus {
  isRegistrationComplete: boolean
  isSetupComplete: boolean
  hasActiveSubscription: boolean
  missingSteps: string[]
  redirectTo: string | null
}

export interface ProfileData {
  vehicles?: VehicleData[]
  businessDetails?: BusinessDetails
  shopDetails?: ShopDetails
}

// Vehicle types
export interface VehicleData {
  vehicleName: string
  model: string
  year: number
  licensePlate: string
  color: string
  vehicleType: string
  isPrimary?: boolean
}

// Business types
export interface BusinessDetails {
  businessName: string
  address: string
  businessRegistrationNumber: string
  servicesOffered: string[]
  operatingHours: Record<string, string>
  logo?: string
}

export interface ShopDetails {
  shopName: string
  address: string
  categoriesSold: string[]
  inventoryCapacity?: string
  contactPersonName: string
}

// Subscription types
export interface SubscriptionData {
  planType: 'monthly' | 'yearly'
  paymentData: Record<string, any>
}

// API Response types
export interface ApiResponse<T = any> {
  message: string
  data?: T
  error?: string
}

export interface AuthResponse {
  message: string
  token: string
  user: UserResponse
  setupStatus?: SetupStatus
  requiresSetup?: boolean
}

export interface OnboardingRequest {
  name: string;
  contact: string;
  profileImage: string; // base64 string or image URL, as expected by your backend
} 