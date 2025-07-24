# Setup Flow Implementation

## Overview

The system now implements a proper setup flow that checks for incomplete registration details and payment status, then redirects users to the appropriate setup pages before allowing dashboard access.

## Flow Diagram

```
User Login/Register (Email/Password or Google OAuth)
         ↓
Check Setup Status
         ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   All Complete  │ Missing Details │ Missing Payment │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
         ↓                 ↓                 ↓
   Access Dashboard    Redirect to        Redirect to
                      /setup/details     /setup/payment
                              ↓                 ↓
                         Complete Details   Complete Payment
                              ↓                 ↓
                         Check Setup Status  Check Setup Status
                              ↓                 ↓
                         Missing Payment?   All Complete?
                              ↓                 ↓
                         Redirect to        Access Dashboard
                         /setup/payment
```

## Setup Status Check

The system checks three key areas:

### 1. **Registration Complete**
- User has phone number
- User has selected role
- **Missing**: Redirect to `/setup/details`

### 2. **Profile Setup Complete**
- **Car Owner**: Has car owner profile + at least one vehicle
- **Service Center**: Has service center profile
- **Part Seller**: Has part seller profile
- **Missing**: Redirect to `/setup/details`

### 3. **Payment/Subscription Active** (Business Users Only)
- **Service Center**: Has active subscription
- **Part Seller**: Has active subscription
- **Car Owner**: No payment required
- **Missing**: Redirect to `/setup/payment`

## API Endpoints

### Authentication with Setup Status

#### Login Response
```json
{
  "message": "Login success",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "role": "service_center"
  },
  "setupStatus": {
    "isRegistrationComplete": true,
    "isSetupComplete": true,
    "hasActiveSubscription": false,
    "missingSteps": ["payment"],
    "redirectTo": "/setup/payment"
  },
  "requiresSetup": true
}
```

#### Google OAuth Response
```json
{
  "message": "Google login successful - setup required",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": null,
    "role": "car_owner",
    "isRegistrationComplete": false
  },
  "setupStatus": {
    "isRegistrationComplete": false,
    "isSetupComplete": false,
    "hasActiveSubscription": false,
    "missingSteps": ["registration", "profile"],
    "redirectTo": "/setup/details"
  },
  "requiresSetup": true
}
```

### Setup Status Check
```http
GET /auth/setup-status
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
  "setupStatus": {
    "isRegistrationComplete": true,
    "isSetupComplete": true,
    "hasActiveSubscription": false,
    "missingSteps": ["payment"],
    "redirectTo": "/setup/payment"
  },
  "canAccessDashboard": false,
  "nextStep": "/setup/payment"
}
```

### Complete Setup Details
```http
POST /auth/setup/details
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "phone": "+1234567890",
  "role": "service_center",
  "profileData": {
    "businessDetails": {
      "businessName": "ABC Auto Service",
      "address": "123 Main St",
      "businessRegistrationNumber": "REG123456",
      "servicesOffered": ["repair", "diagnostics"],
      "operatingHours": {
        "monday": "9:00-18:00",
        "tuesday": "9:00-18:00"
      }
    }
  }
}
```

## Frontend Implementation

### React Hook for Setup Flow

```typescript
// hooks/useSetupFlow.ts
import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'

export const useSetupFlow = () => {
  const { user, token } = useAuth()
  const [setupStatus, setSetupStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/auth/setup-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setSetupStatus(data.setupStatus)
      return data
    } catch (error) {
      console.error('Setup status check failed:', error)
    }
  }

  const completeSetupDetails = async (detailsData: any) => {
    try {
      const response = await fetch('/api/auth/setup/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(detailsData)
      })
      const data = await response.json()
      
      // Update token and setup status
      localStorage.setItem('token', data.token)
      setSetupStatus(data.setupStatus)
      
      return data
    } catch (error) {
      console.error('Setup details completion failed:', error)
    }
  }

  const canAccessDashboard = () => {
    return setupStatus && setupStatus.missingSteps.length === 0
  }

  const getNextStep = () => {
    return setupStatus?.redirectTo
  }

  return {
    setupStatus,
    checkSetupStatus,
    completeSetupDetails,
    canAccessDashboard,
    getNextStep,
    loading
  }
}
```

### App Router with Setup Flow

```typescript
// App.tsx
import { useAuth } from './hooks/useAuth'
import { useSetupFlow } from './hooks/useSetupFlow'
import { useEffect } from 'react'

export const App = () => {
  const { user, loading: authLoading } = useAuth()
  const { setupStatus, checkSetupStatus, canAccessDashboard, getNextStep, loading: setupLoading } = useSetupFlow()

  useEffect(() => {
    if (user && !authLoading) {
      checkSetupStatus()
    }
  }, [user, authLoading])

  if (authLoading || setupLoading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <LoginPage />
  }

  // Check if user needs to complete setup
  if (!canAccessDashboard()) {
    const nextStep = getNextStep()
    
    switch (nextStep) {
      case '/setup/details':
        return <SetupDetailsPage />
      case '/setup/payment':
        return <SetupPaymentPage />
      default:
        return <SetupDetailsPage />
    }
  }

  // User can access dashboard
  return <Dashboard />
}
```

### Setup Details Page

```typescript
// pages/SetupDetailsPage.tsx
import { useState } from 'react'
import { useSetupFlow } from '../hooks/useSetupFlow'
import { useAuth } from '../hooks/useAuth'

export const SetupDetailsPage = () => {
  const { user } = useAuth()
  const { completeSetupDetails } = useSetupFlow()
  const [formData, setFormData] = useState({
    phone: '',
    role: 'car_owner',
    profileData: {
      vehicles: [{
        vehicleName: '',
        model: '',
        year: new Date().getFullYear(),
        licensePlate: '',
        color: '',
        vehicleType: 'sedan'
      }]
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await completeSetupDetails(formData)
    
    if (result && result.setupStatus.missingSteps.length === 0) {
      // All setup complete, redirect to dashboard
      router.push('/dashboard')
    } else if (result?.setupStatus.redirectTo === '/setup/payment') {
      // Details complete, redirect to payment
      router.push('/setup/payment')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Complete Your Setup</h2>
      <p className="mb-4 text-gray-600">
        Welcome, {user?.name}! Please provide some additional information.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            I am a...
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="car_owner">Car Owner</option>
            <option value="service_center">Service Center</option>
            <option value="part_seller">Part Seller</option>
          </select>
        </div>

        {/* Role-specific forms */}
        {formData.role === 'car_owner' && (
          <VehicleForm 
            vehicles={formData.profileData.vehicles}
            onChange={(vehicles) => setFormData({
              ...formData, 
              profileData: { ...formData.profileData, vehicles }
            })}
          />
        )}

        {formData.role === 'service_center' && (
          <BusinessForm 
            businessData={formData.profileData.businessDetails}
            onChange={(businessDetails) => setFormData({
              ...formData, 
              profileData: { ...formData.profileData, businessDetails }
            })}
          />
        )}

        {formData.role === 'part_seller' && (
          <ShopForm 
            shopData={formData.profileData.shopDetails}
            onChange={(shopDetails) => setFormData({
              ...formData, 
              profileData: { ...formData.profileData, shopDetails }
            })}
          />
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Continue Setup
        </button>
      </form>
    </div>
  )
}
```

### Setup Payment Page

```typescript
// pages/SetupPaymentPage.tsx
import { useState } from 'react'
import { useSetupFlow } from '../hooks/useSetupFlow'

export const SetupPaymentPage = () => {
  const { setupStatus } = useSetupFlow()
  const [paymentData, setPaymentData] = useState({
    planType: 'monthly',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Process payment and create subscription
    const result = await createSubscription(paymentData)
    
    if (result.success) {
      // Payment complete, redirect to dashboard
      router.push('/dashboard')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Complete Payment Setup</h2>
      <p className="mb-4 text-gray-600">
        Choose your subscription plan and enter payment details.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plan Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Subscription Plan
          </label>
          <select
            value={paymentData.planType}
            onChange={(e) => setPaymentData({...paymentData, planType: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="monthly">Monthly ($29/month)</option>
            <option value="yearly">Yearly ($290/year - Save 17%)</option>
          </select>
        </div>

        {/* Payment Form */}
        <PaymentForm 
          paymentData={paymentData}
          onChange={setPaymentData}
        />

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
        >
          Complete Payment
        </button>
      </form>
    </div>
  )
}
```

## User Flow Examples

### Example 1: New Car Owner
1. **Register/Login** → System checks setup status
2. **Missing**: Registration details (phone, role, vehicles)
3. **Redirect**: `/setup/details`
4. **Complete**: Phone, role (car_owner), vehicle details
5. **Result**: All complete, access dashboard

### Example 2: New Service Center
1. **Register/Login** → System checks setup status
2. **Missing**: Registration details (phone, role, business details)
3. **Redirect**: `/setup/details`
4. **Complete**: Phone, role (service_center), business details
5. **Check**: Still missing payment
6. **Redirect**: `/setup/payment`
7. **Complete**: Subscription payment
8. **Result**: All complete, access dashboard

### Example 3: Existing User with Expired Payment
1. **Login** → System checks setup status
2. **Missing**: Active subscription
3. **Redirect**: `/setup/payment`
4. **Complete**: Renew subscription
5. **Result**: All complete, access dashboard

## Benefits

✅ **Clear User Journey**: Users know exactly what they need to complete  
✅ **Separate Concerns**: Details and payment are handled separately  
✅ **Flexible Flow**: Different paths for different user types  
✅ **Better UX**: No overwhelming forms with too many fields  
✅ **Payment Integration**: Proper subscription management  
✅ **Status Tracking**: Clear visibility of completion status  

This setup flow ensures users complete all necessary steps before accessing the dashboard, providing a smooth onboarding experience while maintaining data completeness and payment compliance. 