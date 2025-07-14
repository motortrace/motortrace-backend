# OAuth Registration Flow with Complete Registration Step

## Overview

This document outlines the improved OAuth registration flow that includes a "Complete Registration" step for users who sign up via Google OAuth. This ensures we collect all necessary information for role-based profiles while providing a smooth user experience.

## Flow Diagram

```
User clicks "Sign Up with Google"
         ↓
Google OAuth Authentication
         ↓
Check if user exists in database
         ↓
┌─────────────────┬─────────────────┐
│   Existing      │   New User      │
│     User        │                 │
└─────────────────┴─────────────────┘
         ↓                 ↓
   Return user data    Create minimal user
   with token         (incomplete registration)
         ↓                 ↓
   Normal app flow    Redirect to Complete
                     Registration page
         ↓                 ↓
                     Collect missing info:
                     - Phone number
                     - Role selection
                     - Profile data
                     ↓
                     Complete registration
                     ↓
                     Normal app flow
```

## API Endpoints

### 1. Google OAuth Login
```http
POST /auth/google
Content-Type: application/json

{
  "idToken": "google_id_token_here"
}
```

**Response for New User:**
```json
{
  "message": "Google login successful - complete registration required",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": null,
    "role": "car_owner",
    "isRegistrationComplete": false
  },
  "requiresRegistrationCompletion": true
}
```

**Response for Existing User:**
```json
{
  "message": "Google login successful",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "role": "car_owner",
    "isRegistrationComplete": true
  },
  "requiresRegistrationCompletion": false
}
```

### 2. Complete Registration
```http
POST /complete-registration
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "phone": "+1234567890",
  "role": "car_owner",
  "profileData": {
    "vehicles": [
      {
        "vehicleName": "My Daily Driver",
        "model": "Toyota Camry",
        "year": 2020,
        "licensePlate": "ABC123",
        "color": "Silver",
        "vehicleType": "sedan"
      }
    ]
  }
}
```

**Response:**
```json
{
  "message": "Registration completed successfully",
  "token": "new_jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "role": "car_owner",
    "isRegistrationComplete": true
  }
}
```

### 3. Check Registration Status
```http
GET /registration-status
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
  "isRegistrationComplete": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "role": "car_owner"
  },
  "profile": {
    "id": 1,
    "userId": 1,
    "vehicles": [
      {
        "id": 1,
        "vehicleName": "My Daily Driver",
        "model": "Toyota Camry",
        "year": 2020,
        "licensePlate": "ABC123",
        "color": "Silver",
        "vehicleType": "sedan",
        "isPrimary": true
      }
    ]
  }
}
```

## Frontend Implementation

### React/Next.js Example

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react'

interface User {
  id: number
  email: string
  name: string
  phone: string | null
  role: string
  isRegistrationComplete: boolean
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [requiresCompletion, setRequiresCompletion] = useState(false)

  const googleLogin = async (idToken: string) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      })
      
      const data = await response.json()
      
      if (data.requiresRegistrationCompletion) {
        setRequiresCompletion(true)
        setUser(data.user)
      } else {
        setUser(data.user)
        // Redirect to dashboard
        router.push('/dashboard')
      }
      
      // Store token
      localStorage.setItem('token', data.token)
    } catch (error) {
      console.error('Google login failed:', error)
    }
  }

  const completeRegistration = async (registrationData: any) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(registrationData)
      })
      
      const data = await response.json()
      
      // Update token and user
      localStorage.setItem('token', data.token)
      setUser(data.user)
      setRequiresCompletion(false)
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Registration completion failed:', error)
    }
  }

  return {
    user,
    loading,
    requiresCompletion,
    googleLogin,
    completeRegistration
  }
}
```

### Complete Registration Component

```typescript
// components/CompleteRegistration.tsx
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export const CompleteRegistration = () => {
  const { user, completeRegistration } = useAuth()
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
    await completeRegistration(formData)
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Complete Your Registration</h2>
      <p className="mb-4 text-gray-600">
        Welcome, {user?.name}! Please provide some additional information to complete your registration.
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

        {/* Role-specific forms would be conditionally rendered here */}
        {formData.role === 'car_owner' && (
          <VehicleForm 
            vehicles={formData.profileData.vehicles}
            onChange={(vehicles) => setFormData({
              ...formData, 
              profileData: { ...formData.profileData, vehicles }
            })}
          />
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Complete Registration
        </button>
      </form>
    </div>
  )
}
```

## Business Logic

### Registration Completion Requirements

1. **Car Owner:**
   - Phone number (required)
   - At least one vehicle (required)
   - Vehicle details: name, model, year, license plate, color, type

2. **Service Center:**
   - Phone number (required)
   - Business details: name, address, registration number, services, hours

3. **Part Seller:**
   - Phone number (required)
   - Shop details: name, address, categories, contact person

### Security Considerations

1. **Token Validation:** The complete registration endpoint requires a valid JWT token
2. **User Ownership:** Users can only complete their own registration
3. **Data Validation:** All input is validated server-side
4. **Transaction Safety:** Profile creation uses database transactions

### Error Handling

- **400 Bad Request:** Missing required fields or invalid data
- **401 Unauthorized:** Invalid or missing token
- **403 Forbidden:** User trying to complete another user's registration
- **500 Internal Server Error:** Database or server errors

## Database Schema Updates

The User model now includes:
```prisma
model User {
  id                      Int      @id @default(autoincrement())
  email                   String   @unique
  password                String?   // hashed
  name                    String?
  phone                   String?
  role                    String   @default("car_owner")
  isRegistrationComplete  Boolean  @default(false) // NEW FIELD
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  // ... relations
}
```

## Migration Steps

1. **Update Prisma Schema:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

2. **Update Frontend:**
   - Add registration completion check after OAuth login
   - Create complete registration form
   - Handle token updates

3. **Test Flow:**
   - Test with new OAuth users
   - Test with existing users
   - Verify all role-specific validations

## Benefits

1. **Better UX:** Users can start with OAuth and complete registration later
2. **Data Completeness:** Ensures all required information is collected
3. **Flexibility:** Users can change their role during completion
4. **Security:** Maintains proper authentication throughout the process
5. **Scalability:** Easy to add new required fields in the future 