# Modular Backend Structure

## Overview

The backend has been refactored into a modular structure to improve maintainability, readability, and scalability. This document explains the new organization and how to work with it.

## Directory Structure

```
src/
├── index.ts                 # Main application entry point
├── types/
│   └── index.ts            # TypeScript interfaces and types
├── middleware/
│   └── auth.ts             # Authentication middleware
├── utils/
│   └── validation.ts       # Input validation utilities
├── routes/
│   ├── auth.ts             # Authentication routes
│   ├── vehicles.ts         # Vehicle management routes
│   ├── profiles.ts         # Profile management routes (TODO)
│   ├── subscriptions.ts    # Subscription routes (TODO)
│   └── index.ts            # Route aggregator (TODO)
└── services/               # Business logic layer (TODO)
    ├── auth.service.ts     # Authentication business logic
    ├── vehicle.service.ts  # Vehicle business logic
    └── profile.service.ts  # Profile business logic
```

## File Responsibilities

### 1. `src/index.ts` - Main Entry Point
- **Purpose**: Application bootstrap and configuration
- **Responsibilities**:
  - Express app setup
  - Middleware configuration (CORS, JSON parsing)
  - Route mounting
  - Server startup
- **Size**: ~30 lines (down from 875 lines!)

### 2. `src/types/index.ts` - Type Definitions
- **Purpose**: Centralized TypeScript interfaces
- **Contains**:
  - `AuthenticatedRequest` - Extended Express request with user data
  - `UserResponse` - User data response format
  - `RegistrationData` - Registration input validation
  - `VehicleData` - Vehicle information structure
  - `BusinessDetails` - Service center business info
  - `ShopDetails` - Part seller shop info
  - `ApiResponse` - Standard API response format

### 3. `src/middleware/auth.ts` - Authentication Middleware
- **Purpose**: JWT token verification and authorization
- **Functions**:
  - `authenticateToken` - Verify JWT tokens
  - `requireRegistrationComplete` - Ensure user completed registration
  - `requireRole` - Role-based access control

### 4. `src/utils/validation.ts` - Input Validation
- **Purpose**: Centralized validation logic
- **Functions**:
  - `validateEmail` - Email format validation
  - `validatePassword` - Password strength validation
  - `validatePhone` - Phone number validation
  - `validateRole` - Role validation
  - `validateRegistrationData` - Complete registration validation
  - `validateVehicleData` - Vehicle data validation

### 5. `src/routes/` - Route Modules
Each route file handles a specific domain:

#### `auth.ts` - Authentication Routes
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/google` - Google OAuth
- `POST /auth/complete-registration` - Complete OAuth registration
- `GET /auth/registration-status` - Check registration status

#### `vehicles.ts` - Vehicle Management
- `POST /users/:userId/vehicles` - Add vehicle
- `GET /users/:userId/vehicles` - Get user vehicles
- `PUT /users/:userId/vehicles/:vehicleId` - Update vehicle
- `DELETE /users/:userId/vehicles/:vehicleId` - Delete vehicle
- `PATCH /users/:userId/vehicles/:vehicleId/primary` - Set primary vehicle

## Benefits of Modular Structure

### 1. **Maintainability**
- Each file has a single responsibility
- Easy to locate specific functionality
- Reduced cognitive load when working on features

### 2. **Scalability**
- Easy to add new routes without cluttering main file
- Clear separation of concerns
- Modular testing capabilities

### 3. **Team Collaboration**
- Multiple developers can work on different modules
- Reduced merge conflicts
- Clear ownership of code areas

### 4. **Code Reusability**
- Shared middleware and utilities
- Consistent validation patterns
- Standardized response formats

## How to Add New Features

### 1. **Add New Route Module**
```typescript
// src/routes/profiles.ts
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.get('/:userId/profile', authenticateToken, async (req, res) => {
  // Profile logic here
})

export default router
```

### 2. **Mount in Main App**
```typescript
// src/index.ts
import profileRoutes from './routes/profiles'

// Mount routes
app.use('/profiles', profileRoutes)
```

### 3. **Add Types**
```typescript
// src/types/index.ts
export interface ProfileData {
  // Profile interface
}
```

### 4. **Add Validation**
```typescript
// src/utils/validation.ts
export const validateProfileData = (data: ProfileData) => {
  // Validation logic
}
```

## API Endpoint Organization

### Current Endpoints
```
Authentication:
POST   /auth/register
POST   /auth/login
POST   /auth/google
POST   /auth/complete-registration
GET    /auth/registration-status

Vehicles:
POST   /users/:userId/vehicles
GET    /users/:userId/vehicles
PUT    /users/:userId/vehicles/:vehicleId
DELETE /users/:userId/vehicles/:vehicleId
PATCH  /users/:userId/vehicles/:vehicleId/primary

System:
GET    /health
GET    /test-db
```

### Planned Endpoints
```
Profiles:
GET    /profiles/:userId
PUT    /profiles/:userId

Subscriptions:
POST   /subscriptions
GET    /users/:userId/subscription
PUT    /subscriptions/:id
DELETE /subscriptions/:id
```

## Development Workflow

### 1. **Adding New Features**
1. Create route file in `src/routes/`
2. Add types in `src/types/index.ts`
3. Add validation in `src/utils/validation.ts`
4. Mount route in `src/index.ts`
5. Test the endpoint

### 2. **Modifying Existing Features**
1. Locate the relevant route file
2. Make changes in the specific module
3. Update types if needed
4. Test the changes

### 3. **Debugging**
- Each route file is self-contained
- Easy to isolate issues
- Clear error boundaries

## Best Practices

### 1. **File Organization**
- Keep files under 200 lines when possible
- Group related functionality together
- Use descriptive file names

### 2. **Import/Export**
- Use named exports for utilities
- Use default exports for route modules
- Avoid circular dependencies

### 3. **Error Handling**
- Centralize error handling in middleware
- Use consistent error response format
- Log errors appropriately

### 4. **Validation**
- Validate all inputs
- Use centralized validation functions
- Provide clear error messages

## Migration from Monolithic Structure

The refactoring process:

1. **Extracted Types**: Moved all interfaces to `src/types/`
2. **Created Middleware**: Separated authentication logic
3. **Added Validation**: Centralized input validation
4. **Split Routes**: Organized endpoints by domain
5. **Simplified Main File**: Reduced `index.ts` to essential setup

## Next Steps

### Immediate Tasks
1. **Regenerate Prisma Client**: `npx prisma generate`
2. **Test All Endpoints**: Ensure functionality is preserved
3. **Add Missing Routes**: Create profile and subscription modules

### Future Improvements
1. **Add Services Layer**: Business logic separation
2. **Implement Error Handling Middleware**: Centralized error responses
3. **Add Request Logging**: API request/response logging
4. **Add Rate Limiting**: Protect against abuse
5. **Add API Documentation**: Swagger/OpenAPI integration

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Run `npx prisma generate` after schema changes
2. **Import Errors**: Check file paths and export statements
3. **Route Not Found**: Ensure route is mounted in `index.ts`
4. **Validation Errors**: Check validation functions in `utils/validation.ts`

### Debugging Tips

1. **Check Console Logs**: Server startup shows mounted routes
2. **Use Health Endpoint**: `/health` to verify server is running
3. **Test Database**: `/test-db` to verify database connection
4. **Check Route Files**: Each route file is self-contained for easier debugging

This modular structure makes the codebase much more manageable and sets a solid foundation for future development! 