# VETINEL - Veterinary Health Monitoring System

A comprehensive veterinary health monitoring and clinic management platform with three integrated applications: an admin portal for clinic management, a mobile app for pet owners, and a super admin portal for system oversight.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Frontend Applications](#frontend-applications)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Backend Setup](#backend-setup)
7. [Installation & Running](#installation--running)
8. [Notes](#notes)

---

## System Overview

The VETINEL system consists of a public Landing Page and three role-based applications connected to a single Node.js backend with a PostgreSQL database. The Landing Page is the public entry point for authentication, clinic applications, and authenticated communication with Super Admin.

| Application | Purpose | Tech Stack | Users |
|-----------|---------|-----------|-------|
| **Landing Page** | Public product entry point, sign in, registration, clinic applications, and authenticated VetIntel Admin messaging | HTML, CSS, JavaScript | Visitors, Pet Owners, Clinic Owners |
| **Admin Portal** | Clinic staff dashboard for managing appointments, clients, disease monitoring, and financial data | Vite + React + Tailwind CSS | Clinic Owners, Doctors, Receptionists |
| **PetWatch Mobile** | Pet owner app for managing pets, appointments, vaccinations, health records, and receiving alerts | Expo + React Native + TypeScript | Pet Owners |
| **Super Admin Portal** | System administration for managing clinics, users, roles, permissions, and audit trails | Vite + React + TypeScript | System Administrators |

### Key Features

#### Landing Page Features:
- Product landing page and public navigation
- Clinic Owner and Pet Owner sign in
- Pet Owner and Clinic Owner registration
- Clinic application submission for Super Admin review
- Authenticated VetIntel Admin messenger
- Message templates for account, appointment, clinic application, and app error help
- Signed-in user notification, initials avatar, and Sign Out
- Displays Super Admin replies in the conversation thread

#### Admin Portal Features:
- Dashboard with real-time disease monitoring and outbreak alerts
- Appointment and patient queue management
- Client/patient management
- Billing and financial monitoring
- Risk monitoring (low, moderate, high)
- Community analytics and reporting
- Data synchronization
- Audit trail tracking
- User role management

#### PetWatch Mobile Features:
- Pet profile management (dogs, cats, other species)
- Vaccination tracking and scheduling
- Health symptom reporting
- Appointment booking
- Nearby clinic discovery
- Health tips and education
- Alert notifications for outbreaks and vaccination reminders
- Deworming schedule tracking
- Health history records

#### Super Admin Portal Features:
- Clinic management and oversight
- User management across all clinics
- Role-based access control (RBAC)
- Audit trail for system activities
- System settings and configuration
- Dashboard with system metrics

---

## Architecture & Data Flow

The Landing Page is the public entry layer. Visitors can browse the product, sign in, create an account, submit a clinic application, and—after authentication—message VetIntel Super Admin. The Admin Portal, PetWatch Mobile app, and Super Admin Portal consume the same backend API and database.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│ Landing Page (HTML/CSS/JavaScript)                              │
│ - Public product entry, Sign In, Registration                  │
│ - Clinic applications and authenticated Admin messenger         │
├─────────────────────────────────────────────────────────────────┤
│ Admin Portal (Vite + React)                                     │
│ - Clinic operations, appointments, clients, billing, reports    │
├─────────────────────────────────────────────────────────────────┤
│ PetWatch Mobile (Expo + React Native + TypeScript)              │
│ - Pets, health records, vaccinations, appointments, alerts       │
├─────────────────────────────────────────────────────────────────┤
│ Super Admin Portal (Vite + React + TypeScript)                  │
│ - Clinics, approvals, users, RBAC, Inbox, audit, settings        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP REST API + JWT
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│ API Server                                                        │
│ - Authentication & Authorization (JWT)                          │
│ - Request Validation                                            │
│ - Business Logic                                                │
│ - Error Handling                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL Queries
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE LAYER (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────┤
│ - Users & Authentication                                        │
│ - Clinics & Management                                          │
│ - Pets & Owners                                                 │
│ - Appointments                                                  │
│ - Medical Records (Vaccinations, Symptoms, Health History)     │
│ - Billing & Financials                                         │
│ - Disease Monitoring Data                                       │
│ - Audit Logs                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Landing Page Clinic Application Flow

1. A clinic owner submits an application from the Landing Page through `POST /api/clinic-applications`.
2. The backend validates and stores the application as a pending clinic record.
3. Super Admin reviews the application in Clinic Applications.
4. Super Admin approves it through `PUT /api/clinics/:id` with `status: active`.
5. The backend creates the clinic owner account, hashes the temporary password, and sets `must_change_password = true`.
6. Configured SMTP sends the credentials to the owner.
7. The clinic owner signs in through the Landing Page and changes the temporary password.

### Landing Page Authenticated Messaging Flow

1. A signed-in Pet Owner or Clinic Owner selects a message template.
2. The backend validates the bearer token and stores the message in `messages`.
3. Super Admin receives the message in the Inbox with sender, audience, subject, body, and date.
4. Super Admin replies through `POST /api/messages/:id/replies`.
5. The Landing Page loads the reply through `GET /api/my-messages` and displays it in the conversation.

### Data Flow Example: Pet Owner Booking Appointment

1. **PetWatch App**: User selects a clinic and available slot
2. **Frontend**: Sends HTTP POST request to `/api/appointments` with appointment data
3. **Backend**: Validates request, checks clinic availability, stores in database
4. **Admin Portal**: Updates real-time dashboard showing new appointment
5. **Notifications**: System generates alert for pet owner

---

## Frontend Applications

### 1. Landing Page (`/LandingPage`)

**Purpose**: Public entry point for VetIntel users and clinic applicants.

**Main capabilities**:
- Public product information and navigation
- Sign in for Clinic Owners and Pet Owners
- Registration for Clinic Owners and Pet Owners
- Clinic application submission
- Authenticated VetIntel Admin messenger
- Message templates and reply history
- Signed-in user notification, profile initials, and Sign Out

**Primary file**:
- `LandingPage/Index.html`

**Backend integrations**:
- `POST /api/login`
- `POST /api/register`
- `POST /api/clinic-applications`
- `GET /api/my-messages`
- `POST /api/messages`

---

### 2. Admin Portal (`/admin`)

**Purpose**: Clinic staff management dashboard

**Main Pages & Routes**:
- `/` - Dashboard (overview, key metrics, recent alerts)
- `/disease` - Disease Monitoring (disease trends, outbreak alerts)
- `/clinic` - Clinic Layout/Overview
- `/appointments-ops` - Appointment Management
- `/patient-queue` - Patient Queue Management
- `/billing` - Billing Management
- `/client-mgmt` - Client Management
- `/reminders` - Reminders Management
- `/risk` - Risk Monitoring (low/moderate/high risk cases)
- `/analytics` - Community Analytics
- `/reports` - Reports Generation
- `/sync` - Data Synchronization
- `/clinics` - Clinic Management (Multi-clinic support)
- `/users` - User Role Management
- `/financial` - Financial Monitoring & Analytics
- `/audit` - Audit Trail Logs
- `/login` - Authentication

**Key Components**:
- `Sidebar.jsx` - Navigation sidebar with menu items
- `Topbar.jsx` - Top navigation with user info
- `AlertItem.jsx` - Alert display component
- Various Page components for each route

**User Roles**:
- **Owner**: Full access to all clinic data and settings
- **Doctor**: Access to patient records, medical history, appointments
- **Receptionist**: Access to appointments, client management, billing

---

### 3. PetWatch Mobile App (`/petwatch-rn`)

**Purpose**: Pet owner mobile application for health management

**Main Screens & Routes**:
- `/login` - Authentication
- `/register` - User registration
- `/clinic-selection` - Clinic selection after registration
- `/home` - Home dashboard (pets overview, quick actions)
- `/alerts` - System and personal alerts
- `/appointments` - Appointments view
- `/profile` - User profile management
- `/pet-details/:id` - Individual pet details page
- `/add-pet` - Add new pet to profile
- `/report-symptoms` - Report pet symptoms
- `/vaccinations` - Pet vaccinations tracking
- `/health-history` - Complete health history
- `/health-report` - Health report generation
- `/book-appointment` - Appointment booking flow
- `/nearby-clinics` - Discover nearby veterinary clinics
- `/health-tips` - Health tips and education

**Core Data Models** (TypeScript Interfaces):

```typescript
interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  age: number;
  weight: number;
  color: string;
  lastDewormingDate?: string;
  nextDewormingDate?: string;
}

interface Vaccination {
  id: string;
  petId: string;
  vaccine: string;
  date: string;
  nextDue: string;
  status: 'completed' | 'upcoming' | 'overdue';
}

interface Appointment {
  id: string;
  petId: string;
  petName: string;
  date: string;
  time: string;
  type: string;
  vetName: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  clinicId: string;
  clinicName: string;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'moderate' | 'high';
  date: string;
  read: boolean;
  type: 'outbreak' | 'vaccination' | 'appointment' | 'symptom' | 'deworming';
}

interface Symptom {
  id: string;
  petId: string;
  symptoms: string[];
  severity: 'low' | 'moderate' | 'high';
  description: string;
  date: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  selectedClinicId?: string;
  createdAt: string;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  distance: number;
  rating: number;
  emergencyService: boolean;
  specialties: string[];
  hours: string;
}
```

---

### 4. Super Admin Portal (`/super-admin`)

**Purpose**: System-wide administration and oversight

**Main Routes**:
- `/login` - Authentication
- `/` - Dashboard (system overview)
- `/clinics` - Clinic management and listing
- `/clinics/:id` - Clinic details and settings
- `/users` - User management across all clinics
- `/roles` - Role-based access control (RBAC) management
- `/audit` - System audit trail
- `/settings` - System settings and configuration

**Key Features**:
- Protected routes with authentication check
- Role-based access control
- Multi-clinic oversight
- User permission management
- System audit logging

---

## API Endpoints

The backend Node.js server should implement the following REST API endpoints. All endpoints require a JWT token in the `Authorization` header (except `/auth/login` and `/auth/register`).

### Authentication Endpoints

```
POST   /api/auth/login              - User login
POST   /api/auth/register           - User registration
POST   /api/auth/refresh-token      - Refresh JWT token
POST   /api/auth/logout             - User logout
GET    /api/auth/verify             - Verify token validity
```

### User & Clinic Endpoints

```
GET    /api/users                   - List all users (admin/super-admin only)
GET    /api/users/:id               - Get user details
POST   /api/users                   - Create new user
PUT    /api/users/:id               - Update user
DELETE /api/users/:id               - Delete user

GET    /api/clinics                 - List all clinics
GET    /api/clinics/:id             - Get clinic details
POST   /api/clinics                 - Create new clinic (super-admin)
PUT    /api/clinics/:id             - Update clinic
DELETE /api/clinics/:id             - Delete clinic (super-admin)

GET    /api/roles                   - List all roles
GET    /api/permissions             - List all permissions
POST   /api/roles                   - Create new role (super-admin)
PUT    /api/roles/:id               - Update role (super-admin)
DELETE /api/roles/:id               - Delete role (super-admin)
```

### Pet Management Endpoints

```
GET    /api/pets                    - List user's pets
GET    /api/pets/:id                - Get pet details
POST   /api/pets                    - Create new pet
PUT    /api/pets/:id                - Update pet information
DELETE /api/pets/:id                - Delete pet

GET    /api/pets/:id/vaccinations   - Get pet vaccinations
POST   /api/pets/:id/vaccinations   - Add vaccination record
PUT    /api/vaccinations/:id        - Update vaccination
DELETE /api/vaccinations/:id        - Delete vaccination

GET    /api/pets/:id/symptoms       - Get pet symptom history
POST   /api/pets/:id/symptoms       - Report new symptoms
PUT    /api/symptoms/:id            - Update symptom report
DELETE /api/symptoms/:id            - Delete symptom report

GET    /api/pets/:id/health-history - Get complete health history
GET    /api/pets/:id/deworming      - Get deworming schedule
POST   /api/pets/:id/deworming      - Schedule deworming
```

### Appointment Endpoints

```
GET    /api/appointments            - List appointments
GET    /api/appointments/:id        - Get appointment details
POST   /api/appointments            - Create appointment
PUT    /api/appointments/:id        - Update appointment
DELETE /api/appointments/:id        - Cancel appointment

GET    /api/clinics/:id/availability - Get clinic available slots
GET    /api/clinics/:id/schedules    - Get clinic schedules
```

### Alerts & Notifications Endpoints

```
GET    /api/alerts                  - List alerts for user
GET    /api/alerts/:id              - Get alert details
PUT    /api/alerts/:id/read         - Mark alert as read
DELETE /api/alerts/:id              - Delete alert

POST   /api/alerts/outbreak         - Create outbreak alert (backend/doctor)
POST   /api/alerts/vaccination      - Create vaccination alert (backend)
POST   /api/alerts/appointment      - Create appointment alert (backend)
```

### Disease Monitoring & Analytics Endpoints

```
GET    /api/disease-monitoring      - Get disease statistics and trends
GET    /api/disease/:name           - Get specific disease data
GET    /api/disease-monitoring/stats - Disease statistics by period
GET    /api/disease-monitoring/trends - Disease trends over time

GET    /api/analytics/community     - Community health analytics
GET    /api/analytics/clinic        - Clinic-specific analytics
GET    /api/risk-monitoring         - Risk data (low/moderate/high cases)
```

### Clinic Management Endpoints (Admin)

```
GET    /api/clinic/clients          - List clinic's clients/patients
POST   /api/clinic/clients          - Add new client
PUT    /api/clinic/clients/:id      - Update client
DELETE /api/clinic/clients/:id      - Delete client

GET    /api/clinic/appointments     - List clinic appointments
POST   /api/clinic/appointments     - Schedule appointment
PUT    /api/clinic/appointments/:id - Update appointment
DELETE /api/clinic/appointments/:id - Cancel appointment

GET    /api/clinic/queue            - Get current patient queue
PUT    /api/clinic/queue/:id        - Update queue position

GET    /api/clinic/billing          - Get billing records
POST   /api/clinic/billing          - Create billing record
PUT    /api/clinic/billing/:id      - Update billing

GET    /api/clinic/financial        - Get financial reports
GET    /api/clinic/reports          - Generate clinic reports
```

### Audit & System Endpoints

```
GET    /api/audit-trail             - Get system audit logs
GET    /api/audit-trail/user/:id    - Get user's activities
GET    /api/data-sync/status        - Get data synchronization status
POST   /api/data-sync/trigger       - Trigger manual sync
```

### Clinic Discovery (Mobile)

```
GET    /api/clinics/nearby          - Find clinics by location
GET    /api/clinics/search          - Search clinics by name/specialty
GET    /api/clinics/:id/reviews     - Get clinic reviews/ratings
```

---

## Database Schema

PostgreSQL database structure for the VETINEL system:

### Users & Authentication

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role_id UUID NOT NULL REFERENCES roles(id),
  clinic_id UUID REFERENCES clinics(id),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  clinic_id UUID REFERENCES clinics(id),
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource VARCHAR(100),
  action VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

### Clinics

```sql
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  owner_id UUID NOT NULL REFERENCES users(id),
  rating DECIMAL(3, 2) DEFAULT 0.0,
  emergency_service BOOLEAN DEFAULT false,
  hours_open VARCHAR(255),
  hours_close VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinic_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  specialty VARCHAR(100) NOT NULL,
  UNIQUE(clinic_id, specialty)
);

CREATE TABLE clinic_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  is_available BOOLEAN DEFAULT true
);
```

### Pets & Pet Owners

```sql
CREATE TABLE pet_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  preferred_clinic_id UUID REFERENCES clinics(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  species VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  age INT,
  weight DECIMAL(8, 2),
  color VARCHAR(100),
  microchip_id VARCHAR(50),
  date_of_birth DATE,
  gender VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Medical Records

```sql
CREATE TABLE vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(255) NOT NULL,
  date_administered DATE NOT NULL,
  next_due_date DATE NOT NULL,
  vet_name VARCHAR(255),
  clinic_id UUID REFERENCES clinics(id),
  status VARCHAR(20) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  symptoms TEXT[] NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT,
  reported_date DATE NOT NULL,
  risk_level VARCHAR(20),
  status VARCHAR(20) DEFAULT 'reported',
  clinic_id UUID REFERENCES clinics(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deworming_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  last_deworming_date DATE,
  next_deworming_date DATE,
  deworming_type VARCHAR(100),
  clinic_id UUID REFERENCES clinics(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  record_type VARCHAR(50),
  description TEXT,
  recorded_date DATE,
  vet_id UUID REFERENCES users(id),
  clinic_id UUID REFERENCES clinics(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Appointments

```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES users(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'scheduled',
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  queue_position INT,
  status VARCHAR(20) DEFAULT 'waiting',
  check_in_time TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Billing & Financial

```sql
CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  service_description TEXT,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  invoice_number VARCHAR(50) UNIQUE,
  issued_date DATE,
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  report_date DATE,
  total_revenue DECIMAL(15, 2),
  total_expenses DECIMAL(15, 2),
  total_appointments INT,
  total_patients INT,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Disease Monitoring & Alerts

```sql
CREATE TABLE disease_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name VARCHAR(255) NOT NULL,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id),
  number_of_cases INT NOT NULL,
  report_date DATE NOT NULL,
  severity VARCHAR(20),
  geographic_area VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE disease_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name VARCHAR(255) NOT NULL,
  report_month DATE NOT NULL,
  total_cases INT,
  clinic_id UUID REFERENCES clinics(id),
  growth_percentage DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(disease_name, report_month, clinic_id)
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  related_pet_id UUID REFERENCES pets(id),
  related_disease VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

CREATE TABLE outbreak_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name VARCHAR(255) NOT NULL,
  clinic_id UUID REFERENCES clinics(id),
  geographic_area VARCHAR(255),
  cases_exceeded_by_percentage INT,
  severity VARCHAR(20) NOT NULL,
  affected_clinics INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Trail

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  changes JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Reminders & Notifications

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  pet_id UUID REFERENCES pets(id),
  appointment_id UUID REFERENCES appointments(id),
  reminder_date DATE NOT NULL,
  reminder_time TIME,
  message TEXT,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes for Performance

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_clinic_id ON users(clinic_id);
CREATE INDEX idx_pets_owner_id ON pets(owner_id);
CREATE INDEX idx_pets_clinic_id ON pets(clinic_id);
CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_owner_id ON appointments(owner_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_vaccinations_pet_id ON vaccinations(pet_id);
CREATE INDEX idx_disease_reports_clinic ON disease_reports(clinic_id);
CREATE INDEX idx_disease_reports_date ON disease_reports(report_date);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_created ON alerts(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## Backend Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL (v12 or higher)

### Backend Installation

Navigate to the backend directory and install dependencies:

```bash
cd vetinel
npm install
```

**Backend Dependencies:**
- `express` (v4.18.2) - Web framework
- `pg` (v8.10.0) - PostgreSQL client
- `bcryptjs` (v2.4.3) - Password hashing
- `dotenv` (v16.0.0) - Environment variable management

### Environment Configuration

Create a `.env` file in the `vetinel/` directory with the following variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vetinel_db
DB_USER=postgres
DB_PASSWORD=your_password
NODE_ENV=development
JWT_SECRET=your_jwt_secret
```

### Running the Backend Server

```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## Backend Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v12+)
- npm or yarn

### Backend Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js       - PostgreSQL connection configuration
│   │   ├── jwt.js            - JWT secret configuration
│   │   └── env.js            - Environment variables
│   ├── middleware/
│   │   ├── auth.js           - JWT authentication middleware
│   │   ├── authorization.js  - Role-based access control
│   │   ├── errorHandler.js   - Error handling middleware
│   │   └── validation.js     - Request validation
│   ├── routes/
│   │   ├── auth.js           - Authentication routes
│   │   ├── users.js          - User management routes
│   │   ├── clinics.js        - Clinic routes
│   │   ├── pets.js           - Pet management routes
│   │   ├── appointments.js   - Appointment routes
│   │   ├── alerts.js         - Alert routes
│   │   ├── disease.js        - Disease monitoring routes
│   │   ├── billing.js        - Billing routes
│   │   └── audit.js          - Audit trail routes
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── clinicController.js
│   │   ├── petController.js
│   │   ├── appointmentController.js
│   │   ├── alertController.js
│   │   ├── diseaseController.js
│   │   ├── billingController.js
│   │   └── auditController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Clinic.js
│   │   ├── Pet.js
│   │   ├── Appointment.js
│   │   ├── Alert.js
│   │   ├── Vaccination.js
│   │   ├── DiseaseReport.js
│   │   └── BillingRecord.js
│   ├── utils/
│   │   ├── validators.js     - Validation helper functions
│   │   ├── responses.js      - Standard response formatting
│   │   ├── emailService.js   - Email sending service
│   │   ├── notifications.js  - Notification service
│   │   └── helpers.js        - General utilities
│   └── app.js               - Express app setup
├── migrations/              - Database migrations
├── seeds/                   - Database seeding scripts
├── .env.example            - Environment variables template
├── package.json
└── server.js               - Entry point
```

### Environment Variables (.env)

```env
# Server
NODE_ENV=development
PORT=5000
BASE_URL=http://localhost:5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vetinel_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRATION=24h
REFRESH_TOKEN_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:8081

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# API Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

### Installation & Running Backend

```bash
# 1. Create backend directory and initialize
mkdir backend
cd backend
npm init -y

# 2. Install dependencies
npm install express pg bcryptjs jsonwebtoken cors dotenv joi axios

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Create and run database migrations
npm run migrate:up

# 5. (Optional) Seed initial data
npm run seed

# 6. Start backend server
npm start
# or for development with hot reload
npm run dev
```

### Database Setup Commands

```bash
# Connect to PostgreSQL
psql -U postgres -d postgres

# Create database
CREATE DATABASE vetinel_db;

# Run migrations
psql -U postgres -d vetinel_db -f migrations/001_initial_schema.sql

# Check tables
\dt
```

---

## Connecting Frontend to Backend

### Admin Portal

Update the API base URL in `admin/src/config/api.js`:

```javascript
// admin/src/config/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  get: (endpoint) => fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  }),
  post: (endpoint, data) => fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }),
  put: (endpoint, data) => fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }),
  delete: (endpoint) => fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  })
};
```

Then in pages, replace mock data calls with API calls:

```javascript
// Before (mock data)
import { USERS } from '../data/mockData';

// After (API call)
const fetchUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    const users = await response.json();
    setUsers(users);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};
```

### PetWatch Mobile App

Update API base URL in `petwatch-rn/src/config/api.ts`:

```typescript
// petwatch-rn/src/config/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor to add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Export API functions
export const petApi = {
  getPets: () => apiClient.get('/pets'),
  addPet: (petData) => apiClient.post('/pets', petData),
  getAppointments: () => apiClient.get('/appointments'),
  bookAppointment: (appointmentData) => apiClient.post('/appointments', appointmentData),
  getAlerts: () => apiClient.get('/alerts'),
  reportSymptoms: (petId, symptoms) => apiClient.post(`/pets/${petId}/symptoms`, symptoms),
  getNearByClinics: (lat, lng, radius = 5) => 
    apiClient.get(`/clinics/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
};
```

### Super Admin Portal

Update API base URL in `super-admin/src/config/api.ts`:

```typescript
// super-admin/src/config/api.ts
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  // Similar structure as admin portal
};
```

### Environment Variables for Frontends

**Admin Portal** (`.env` or `.env.local`):
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=VetIntel Admin
```

**PetWatch Mobile** (`.env` or `.env.local`):
```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_APP_NAME=PetWatch
```

**Super Admin Portal** (`.env.local`):
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=VetIntel Super Admin
```

---

## Installation & Running

### Prerequisites

- Node.js (v16 or higher) - [Download](https://nodejs.org/)
- npm (v8 or higher) - Included with Node.js
- PostgreSQL (v12 or higher) - [Download](https://www.postgresql.org/download/)
- Git - [Download](https://git-scm.com/)

### Quick Start

#### 1. Clone the repository

```bash
git clone https://github.com/ynaamante/vetinel
cd vetinel
```

#### 2. Backend Setup (Node.js + PostgreSQL)

Navigate to backend and install dependencies:

```bash
npm install
```

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vetinel_db
DB_USER=postgres
DB_PASSWORD=your_password
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
PORT=3000
```

Start the backend server:

```bash
npm start
```

The backend API will run on `http://localhost:3000`

#### 3. Admin Portal (React + Vite)

```bash
cd admin
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**Admin Portal Test Accounts**: Use accounts provisioned locally for the development database. Do not commit account passwords or other credentials to the repository.

**Admin Portal Dependencies** (automatically installed):
- React (18.3.1) - UI framework
- Vite (v8.0.16) - Build tool
- React Router (v6.30.4) - Navigation
- Axios (v1.17.0) - HTTP requests
- Recharts (2.10.3) - Charts and graphs
- TailwindCSS (3.3.5) - Styling
- Zustand (4.4.0) - State management
- TypeScript (5.2.2) - Type safety
- ESLint (8.52.0) - Code quality

#### 4. PetWatch Mobile App (React Native + Expo)

```bash
cd petwatch-rn
npm install
npm start
```

Run on simulator or physical device:

```bash
# Android
npm run android

# iOS (macOS only)
npm run ios
```

**PetWatch Dependencies** (automatically installed):
- Expo (v54.0.35) - React Native framework
- React Native (0.81.5) - Mobile framework
- React Navigation (v6.1.17) - Navigation library
- React Native Reanimated (v4.1.1) - Animations
- Expo Linear Gradient (v15.0.8) - Gradient support
- React Native QR Code (v6.3.1) - QR code generation
- AsyncStorage (2.2.0) - Local persistence
- TypeScript (v5.9.2) - Type safety
- Babel (v7.24.0) - JavaScript transpiler

#### 5. Super Admin Portal (React + Vite + TypeScript)

```bash
cd super-admin
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

**Super Admin Portal Dependencies** (automatically installed):
- React (18.3.1) - UI framework
- Vite (v8.0.16) - Build tool
- React Router (v6.30.4) - Navigation
- React Hook Form (7.48.0) - Form management
- Radix UI (v1.x) - 25+ accessible components
- Recharts (2.10.3) - Charts
- jsPDF (v2.5.2) - PDF generation
- Lucide React (0.292.0) - Icons
- Sonner (v1.2.2) - Toast notifications
- TailwindCSS (3.3.5) - Styling
- TypeScript (5.2.2) - Type safety

### Backend Dependencies Summary

The backend requires the following Node.js packages:

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",      // Password hashing
    "dotenv": "^16.0.0",        // Environment variables
    "express": "^4.18.2",       // Web framework
    "pg": "^8.10.0"             // PostgreSQL client
  }
}
```

To install backend dependencies:

```bash
npm install
```

### Production Build

#### Build Admin Portal

```bash
cd admin
npm run build
```

Output: `admin/dist/`

#### Build PetWatch Mobile

```bash
cd petwatch-rn
npm run build

# Or publish to app stores
eas build --platform ios
eas build --platform android
```

#### Build Super Admin Portal

```bash
cd super-admin
npm run build
```

Output: `super-admin/dist/`

### Troubleshooting

**Module not found errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Port already in use:**
```bash
# Backend on different port
PORT=3001 npm start

# Frontend on different port (check vite.config.js)
```

**Database connection issues:**
```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d vetinel_db

# Create database if not exists
createdb -U postgres vetinel_db
```

**Dependency version conflicts:**
```bash
# Update npm
npm install -g npm@latest

# Use npm ci for production
npm ci
```

For detailed setup instructions for each application, see:
- [Backend Setup](#backend-setup)
- [Admin Portal README](admin/README.md)
- [PetWatch Mobile README](petwatch-rn/README.md)
- [Super Admin Portal README](super-admin/README.md)

---

## System Flow & User Journeys

### Pet Owner Journey (PetWatch Mobile)

1. **Registration** → User creates account with email and password
2. **Clinic Selection** → User selects preferred veterinary clinic
3. **Add Pet** → User adds their pet information (name, breed, age, etc.)
4. **Health Monitoring** → User can:
   - View pet vaccinations and schedule next doses
   - Report symptoms and get health alerts
   - Track deworming schedule
   - View health history
5. **Appointments** → User can:
   - Browse nearby clinics
   - Book appointments
   - View upcoming appointments
   - Receive appointment reminders
6. **Alerts** → User receives:
   - Outbreak alerts for detected diseases in area
   - Vaccination reminders
   - Appointment reminders
   - Deworming alerts

### Clinic Staff Journey (Admin Portal)

1. **Login** → Staff authenticates with clinic account
2. **Dashboard** → View key metrics:
   - Today's appointments
   - Patient queue
   - Disease outbreaks
   - Billing status
3. **Appointment Management** → Handle:
   - View scheduled appointments
   - Update appointment status
   - Manage patient queue
4. **Client Management** → Track:
   - Client/pet owner information
   - Pet records
   - Medical history
5. **Billing** → Process:
   - Create billing records
   - Track payments
   - Generate invoices
6. **Monitoring** → Monitor:
   - Disease outbreaks
   - Risk levels
   - Community health trends
7. **Reporting** → Generate:
   - Financial reports
   - Health analytics
   - Audit trails

### System Administrator Journey (Super Admin Portal)

1. **Login** → Admin authenticates
2. **Dashboard** → View system overview
3. **Clinic Management** → Add/edit/remove clinics
4. **User Management** → Manage system users across all clinics
5. **Role Management** → Define roles and permissions
6. **Audit Trail** → Review all system activities
7. **Settings** → Configure system-wide settings

---

## Notes

- Do not commit generated folders such as `node_modules`, `dist`, `build`, `.expo`, Android build output, or iOS Pods.
- Always use the provided `.env` configuration files with sensitive information.
- The backend API endpoints return standardized JSON responses.
- All date fields should be ISO 8601 formatted (YYYY-MM-DD).
- Mobile app should handle offline data caching for critical information.
- Implement proper error handling and user-friendly error messages on all frontends.
- Use JWT tokens for authentication across all applications.
- Follow role-based access control (RBAC) for authorization.
- If dependency installation fails, retry from the app folder so the lockfile stays local to that project.
#      

---

## Change Log: Added and Changed Features

### Landing page changes

- Changed the landing-page navigation from **Contact** to **Sign In**.
- Added Clinic Owner and Pet Owner sign-in selection.
- Added Pet Owner and Clinic Owner registration.
- Added authenticated session handling, user display, initials avatar, notification, and Sign Out.
- Added the VetIntel Admin floating chat launcher after login.
- Added the compact right-side messenger layout.
- Added reusable message templates inside the messenger.
- Restricted messaging to signed-in users.
- Added message thread loading and Super Admin reply display.
- Added clinic application submission from the landing page.

### Authentication and backend changes

- Added `POST /api/register`.
- Added `POST /api/login`, `GET /api/me`, and `POST /api/password/change` integration.
- Added password hashing with `bcryptjs`.
- Added authenticated message creation through `POST /api/messages`.
- Added `GET /api/my-messages` for the signed-in user's conversations.
- Added Super Admin message details, read status, and reply endpoints.
- Added reply email notification support.
- Added Pet Owner and Clinic Owner audience values to messages.

### Clinic application and approval changes

- Added clinic application storage through `POST /api/clinic-applications`.
- Added Super Admin application review and status management.
- Replaced the basic approval confirmation with a three-step approval wizard:
  - Review
  - Create Account
  - Credentials Sent
- Added clinic owner account creation during approval.
- Added generated temporary passwords and password regeneration.
- Added email preview for clinic owner credentials.
- Added `must_change_password` for newly approved clinic owners.
- Added credential delivery status and warning display.

### Super Admin changes

- Updated Clinic Applications to show owner and application details.
- Added approve, reject, edit, suspend, reactivate, and archive actions.
- Updated Inbox to show sender, email, subject, audience, body, date, and reply controls.
- Updated Inbox replies to call the backend reply API.
- Updated message audience mapping so Pet Owner and Veterinary Clinic messages display correctly.
- Replaced the hardcoded Inbox message timestamp with the actual message date.
- Updated the approval backend to accept the temporary password generated by the wizard.

### Development configuration changes

Added development credentials to `.env`:

Development account credentials are intentionally omitted. Configure them in the local `.env` file only, and never commit passwords or other secrets to the repository.

### Files changed for these features

- `LandingPage/Index.html`
- `routes/api.js`
- `controllers/userController.js`
- `controllers/clinicController.js`
- `controllers/adminSurfaceController.js`
- `super-admin/src/app/components/pages/ClinicManagement.tsx`
- `super-admin/src/app/components/pages/ReferenceScreens.tsx`
- `.env`
- `README.md`

---

## Current Implementation Status and Handoff

This section records the implementation completed during the landing-page, authentication, messaging, and Super Admin approval work. Treat it as the current source of truth for the next implementation pass.

### End-to-end flow

```text
Landing Page -> Sign In/Create Account -> Pet Owner or Clinic Owner
-> Authenticated Messenger -> Super Admin Inbox
-> Clinic Application Review -> Approve Application
-> Create Clinic Owner Account -> Send Credentials -> Clinic Owner Sign In
```

### Completed

#### Landing page (`LandingPage/Index.html`)

- Replaced the public Contact navigation flow with Sign In.
- Added Sign In tabs for Clinic Owner and Pet Owner.
- Added Create Account for Pet Owner and Clinic Owner.
- Connected registration to `POST /api/register`.
- Connected login to `POST /api/login` and stores the returned session token.
- Shows the signed-in user's name/initials and Sign Out.
- Shows a post-login notification and a floating VetIntel Admin chat launcher.
- Added the right-side messenger widget matching the supplied reference layout.
- Added Account Help, Appointment Help, Clinic Application Help, and Report an App Error templates.
- Sends sender name, sender email, audience, subject, and body to the backend.
- Loads the user's messages and replies from `GET /api/my-messages`.
- Submits clinic applications to `POST /api/clinic-applications`.

#### Backend

- Added registration, login, current-user, and password-change flows.
- Hashes passwords with `bcryptjs`.
- Requires authentication to create messages.
- Added sender message listing, Super Admin message listing, message details, read status, and replies.
- Stores messages in `messages` and replies in `message_replies`.
- Preserves Pet Owner versus Clinic Owner audience.
- Sends an email notification when Super Admin replies, when email service is configured.
- Clinic approval creates a clinic owner with `must_change_password = true`.
- Approval accepts the wizard-generated temporary password and returns credential status.

#### Super Admin portal

- Clinic Applications loads data from the backend.
- Supports review, approve, reject, edit, suspend, reactivate, and archive actions.
- Approval now uses a three-step wizard: Review, Create Account, Credentials Sent.
- Wizard includes owner details, application email, temporary password generation/regeneration, and email preview.
- Final approval screen shows clinic, owner, email, temporary password, and email delivery status.
- Inbox displays sender, email, subject, audience, body, actual message date, and reply controls.
- Super Admin replies use `POST /api/messages/:id/replies`.

#### Development accounts

Development account credentials are intentionally omitted. Configure them in the local `.env` file only, and never commit passwords or other secrets to the repository.

### Incomplete and needs verification

#### Authentication and security

- Confirm that the database has a real `pet_owner` role; otherwise registration may fall back to the generic `user` role.
- Apply `auth.required` and role checks consistently to every private user, clinic, record, settings, role, permission, and audit endpoint. Several routes still use `auth.optional` or have no middleware.
- Confirm that only Super Admin can read or mutate Super Admin data.
- Replace development JWT/API secrets and demo passwords.
- Verify CORS, rate limiting, request validation, token expiration/revocation, password reset, and SMTP configuration.
- Do not expose temporary passwords in production responses after email delivery is verified.

#### Clinic approval

- Test the full path: landing-page application, Super Admin review, approval, one owner user, owner login, and forced first-login password change.
- Verify duplicate approval never creates a duplicate owner.
- Add resend-credentials when email delivery fails.
- Replace the hardcoded `app.vetintel.com` email preview URL with an environment variable.
- Add server-side validation for supplied temporary passwords.
- Wire “Go to User Role Management” to the real User Management route.

#### Messaging

- Add refresh or polling/WebSocket updates so new replies appear without a full reload.
- Add sent, delivered, and error states in the landing messenger.
- Add unread counts and mark-as-read behavior for both sides.
- Render complete reply history in the Super Admin Inbox.
- Replace positional `string[][]` Inbox state with typed message/reply objects.
- Make Inbox search functional and implement a real Unread filter.
- Sanitize all user-generated message content consistently.

#### Admin portal (`admin/`)

- Most of the clinic dashboard is not yet proven against the current backend.
- Replace mock dashboard data with authenticated API calls.
- Connect clinic, users, appointments, clients, patient queue, billing, reminders, risk, analytics, reports, sync, and audit pages.
- Add role-aware navigation and route guards for Clinic Owner, Doctor, and Receptionist.
- Confirm clinic owners only see their own clinic data.
- Add loading, empty, error, retry, and permission states.

#### PetWatch mobile (`petwatch-rn/`)

- Many screens still use `src/data/mockData.ts`.
- Connect login, registration, profile, pets, clinics, appointments, vaccinations, symptoms, history, alerts, and health tips to the backend.
- Add token persistence and authenticated API requests.
- Add pet-owner authorization, real appointment creation/cancellation, clinic availability, notifications, and offline/error handling.

#### Super Admin portal

- Fix existing TypeScript unused-import/declaration errors before using type-check as a release gate.
- Replace remaining reference/placeholder screens with production API behavior.
- Add pagination, server-side filtering, sorting, and real API counts.
- Add confirmation and error handling for every destructive action.
- Add automated tests for registration, login, application approval, duplicate approval, password change, messages, and replies.

### Validation completed

- Landing page JavaScript syntax check passed.
- Clinic approval backend syntax check passed.
- VS Code Problems checks passed for the latest modified files.
- Super Admin production build passed with `npm run build`.
- Super Admin `npm run type-check` still reports existing unused imports/declarations in multiple files.

### Recommended order for Claude/Codex

1. Start PostgreSQL and the backend with a clean development database.
2. Verify migrations, roles, demo users, and SMTP configuration.
3. Add API tests for authentication, approval, duplicate approval, password change, messages, and replies.
4. Finish approval resend credentials and real User Management navigation.
5. Finish typed Inbox state, reply history, unread state, search, and refresh.
6. Enforce strict authentication and role authorization on all private routes.
7. Connect the Admin portal to real clinic-scoped data.
8. Connect PetWatch to real pet-owner APIs and remove mock data.
9. Fix all TypeScript and lint errors.
10. Run manual acceptance tests for Pet Owner, Clinic Owner, Super Admin, Doctor, and Receptionist.
11. Remove development credentials, rotate secrets, configure production SMTP, and perform a security review.

### Important files

- `LandingPage/Index.html` — landing page, authentication, registration, messenger, and clinic application form.
- `routes/api.js` — API routes and middleware wiring.
- `controllers/userController.js` — registration, login, password changes, and users.
- `controllers/clinicController.js` — applications, clinic status changes, and owner account creation.
- `controllers/adminSurfaceController.js` — Super Admin messages, replies, role requests, plans, and demo requests.
- `super-admin/src/app/components/pages/ClinicManagement.tsx` — clinic application list and approval wizard.
- `super-admin/src/app/components/pages/ReferenceScreens.tsx` — Inbox and other reference screens.
- `.env` — local development configuration and demo credentials.
