export const USERS = [
  {
    email: 'owner@happypaws.com',
    password: 'owner123',
    name: 'Dr. Sarah Chen',
    role: 'Owner',
    initials: 'SC',
  },
  {
    email: 'doctor@happypaws.com',
    password: 'doctor123',
    name: 'Dr. James Park',
    role: 'Doctor',
    initials: 'JP',
  },
  {
    email: 'receptionist@happypaws.com',
    password: 'receptionist123',
    name: 'Maria Santos',
    role: 'Receptionist',
    initials: 'MS',
  },
];

export const LINE_DATA = [
  { month: 'Sep', cases: 35 },
  { month: 'Oct', cases: 48 },
  { month: 'Nov', cases: 55 },
  { month: 'Dec', cases: 67 },
  { month: 'Jan', cases: 89 },
  { month: 'Feb', cases: 102 },
  { month: 'Mar', cases: 120 },
];

export const BAR_DATA = [
  { name: 'Parvovirus',     cases: 140 },
  { name: 'Kennel Cough',   cases: 88  },
  { name: 'Distemper',      cases: 62  },
  { name: 'Giardia',        cases: 55  },
  { name: 'Leptospirosis',  cases: 44  },
];

export const ALERTS = [
  {
    name: 'Parvovirus Outbreak',
    desc: 'Cases exceeded safe threshold by 40% in East region',
    date: 'March 3, 2026',
    level: 'HIGH',
    color: '#e53e3e',
  },
  {
    name: 'Kennel Cough Spike',
    desc: 'Moderate increase detected across 3 clinics',
    date: 'March 2, 2026',
    level: 'MOD',
    color: '#f6ad55',
  },
  {
    name: 'Vaccination Coverage Drop',
    desc: 'Network coverage below herd immunity threshold',
    date: 'March 1, 2026',
    level: 'HIGH',
    color: '#e53e3e',
  },
];

export const RISK_DATA = [
  { label: 'Low Risk',      color: '#48bb78', pct: 58, cases: '245 cases' },
  { label: 'Moderate Risk', color: '#f6ad55', pct: 28, cases: '118 cases' },
  { label: 'High Risk',     color: '#e53e3e', pct: 14, cases: '59 cases'  },
];

export const INVENTORY_ITEMS = [
  { id: 'MED-001', name: 'Amoxicillin 250mg', category: 'Medications', unit: 'Bottle', quantity: 18, reorderLevel: 25, expiry: '2026-08-14', supplier: 'VetPharm Supplies', value: 810, status: 'Low stock' },
  { id: 'MED-002', name: 'Carprofen 50mg', category: 'Medications', unit: 'Box', quantity: 42, reorderLevel: 20, expiry: '2027-01-22', supplier: 'AnimalCare Direct', value: 1260, status: 'In stock' },
  { id: 'MED-003', name: 'Meloxicam 1.5mg/ml', category: 'Medications', unit: 'Bottle', quantity: 9, reorderLevel: 12, expiry: '2026-05-09', supplier: 'VetPharm Supplies', value: 405, status: 'Low stock' },
  { id: 'VAC-001', name: 'DHPP Vaccine', category: 'Vaccines', unit: 'Vial', quantity: 36, reorderLevel: 20, expiry: '2026-06-18', supplier: 'Guardian Animal Health', value: 1620, status: 'In stock' },
  { id: 'VAC-002', name: 'Rabies Vaccine', category: 'Vaccines', unit: 'Vial', quantity: 7, reorderLevel: 15, expiry: '2026-04-02', supplier: 'Guardian Animal Health', value: 385, status: 'Expiring soon' },
  { id: 'SUP-001', name: 'Sterile Examination Gloves', category: 'Supplies', unit: 'Box', quantity: 64, reorderLevel: 30, expiry: '2029-11-30', supplier: 'MediPet Wholesale', value: 960, status: 'In stock' },
  { id: 'SUP-002', name: 'Surgical Suture 3-0', category: 'Supplies', unit: 'Pack', quantity: 4, reorderLevel: 10, expiry: '2026-03-28', supplier: 'MediPet Wholesale', value: 180, status: 'Critical' },
  { id: 'SUP-003', name: 'Petri Dishes', category: 'Laboratory', unit: 'Pack', quantity: 0, reorderLevel: 8, expiry: '2028-12-15', supplier: 'LabSource Veterinary', value: 0, status: 'Out of stock' },
];

export const INVENTORY_USAGE = [
  { month: 'Oct', medications: 420, vaccines: 180, supplies: 250 },
  { month: 'Nov', medications: 480, vaccines: 210, supplies: 290 },
  { month: 'Dec', medications: 445, vaccines: 230, supplies: 310 },
  { month: 'Jan', medications: 530, vaccines: 260, supplies: 340 },
  { month: 'Feb', medications: 575, vaccines: 285, supplies: 365 },
  { month: 'Mar', medications: 610, vaccines: 310, supplies: 390 },
];

export const INVENTORY_PURCHASE_ORDERS = [
  { order: 'PO-2026-018', supplier: 'VetPharm Supplies', items: 4, total: 2480, status: 'Pending', expected: 'March 18, 2026' },
  { order: 'PO-2026-017', supplier: 'Guardian Animal Health', items: 2, total: 1740, status: 'In transit', expected: 'March 15, 2026' },
  { order: 'PO-2026-016', supplier: 'MediPet Wholesale', items: 6, total: 3120, status: 'Received', expected: 'March 08, 2026' },
];