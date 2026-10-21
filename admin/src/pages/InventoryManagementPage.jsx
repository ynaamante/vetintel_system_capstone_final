import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import LabDateTimePicker from '../components/LabDateTimePicker';
import { Icons } from '../icons';
import { formatDateText } from '../utils/dateFormatting';
import {
  INVENTORY_ITEMS, INVENTORY_PURCHASE_ORDERS, INVENTORY_USAGE,
} from '../data/mockData';
import { canViewFeature } from '../utils/permissionUtils';

function formatInventoryDate(value) {
  if (!value || value === 'N/A' || value === '—') return value || '—';
  const rawValue = String(value);
  const datePrefix = /^(\d{4}-\d{2}-\d{2})(.*)$/.exec(rawValue);
  if (datePrefix) return `${formatDateText(datePrefix[1])}${datePrefix[2]}`;
  return formatDateText(rawValue, undefined, rawValue);
}

const CATEGORY_VALUE_DATA = [
  { name: 'Medications', value: 42580, color: '#139b76' },
  { name: 'Vaccines', value: 38240, color: '#8b5cf6' },
  { name: 'Supplies', value: 18650, color: '#10b981' },
  { name: 'Laboratory', value: 5400, color: '#f59e0b' },
];
const TOP_USED = ['Amoxicillin', 'Rabies Vaccine', 'Doxycycline', 'DHPP', 'Enrofloxacin', 'Metronidazole', 'Bordetella', 'Meloxicam'].map((name, index) => ({ name, value: [142, 88, 76, 65, 58, 54, 42, 38][index] }));
const FORECAST_ITEMS = [
  ['Doxycycline 100mg', '18 tablets remaining', '~11 days', 'Avg usage: 12 tablets/wk'],
  ['Leptospirosis 4-way', '5 vials remaining', '~18 days', 'Avg usage: 2 vials/wk'],
  ['DHPP (Distemper Combo)', '8 vials remaining', '~19 days', 'Avg usage: 3 vials/wk'],
  ['Exam Gloves (Medium)', '80 pairs remaining', '~19 days', 'Avg usage: 30 pairs/wk'],
  ['Blood Glucose Test Kit', '3 kits remaining', '~21 days', 'Avg usage: 1 kits/wk'],
  ['Rabies Vaccine (IMRAB)', '22 vials remaining', '~39 days', 'Avg usage: 4 vials/wk'],
  ['Amoxicillin 500mg', '240 tablets remaining', '~48 days', 'Avg usage: 35 tablets/wk'],
  ['Feline Distemper (FVRCP)', '15 vials remaining', '~53 days', 'Avg usage: 2 vials/wk'],
];
const SUPPLIERS = [
  'PharmVet Co.',
  'Zoetis Philippines',
  'Merck Animal Health',
  'VetSupply Inc.',
  'MedSupply Direct',
];
const SUPPLIER_CARDS = [
  { id: 'SUP-001', name: 'PharmVet Co.', contact: 'Maria Santos', phone: '+63 917 123 4567', email: 'orders@pharmvet.ph', address: '123 Veterinary Ave, Quezon City, Metro Manila', products: ['Amoxicillin 500mg', 'Doxycycline 100mg', 'Meloxicam Oral 1.5mg/ml', 'Enrofloxacin 50mg'] },
  { id: 'SUP-002', name: 'Zoetis Philippines', contact: 'Carlos Reyes', phone: '+63 918 234 5678', email: 'zoetis.ph@zoetis.com', address: 'Bonifacio Global City, Taguig, Metro Manila', products: ['Rabies Vaccine (IMRAB)', 'DHPP (Distemper Combo)', 'Leptospirosis 4-way', 'Blood Glucose Test Kit'] },
  { id: 'SUP-003', name: 'Merck Animal Health', contact: 'Ana Cruz', phone: '+63 919 345 6789', email: 'merck.ah@merck.com', address: 'Pasig City, Metro Manila', products: ['Feline Distemper (FVRCP)', 'Bordetella Intranasal', 'Parasite Control'] },
  { id: 'SUP-004', name: 'VetSupply Inc.', contact: 'Jose Garcia', phone: '+63 920 456 7890', email: 'sales@vetsupply.ph', address: 'Mandaluyong City, Metro Manila', products: ['Metronidazole 250mg', 'Enrofloxacin 50mg', 'Surgical Supplies'] },
  { id: 'SUP-005', name: 'MedSupply Direct', contact: 'Rosa Lim', phone: '+63 921 567 8901', email: 'orders@medsupply.ph', address: 'Marikina City, Metro Manila', products: ['Syringes 5ml', 'Exam Gloves (Medium)', 'Gauze Rolls', 'IV Catheter 22G'] },
  { id: 'SUP-006', name: 'VetMed Supply', contact: 'Pedro Bautista', phone: '+63 922 678 9012', email: 'orders@vetmed.ph', address: 'Caloocan City, Metro Manila', products: ['IV Catheter 22G', 'Bandages', 'Surgical Drapes', 'Disposable Gowns'] },
];
const ALL_ITEMS_TABLE_DATA = [
  { id: 'MED-001', name: 'Amoxicillin 500mg', subtitle: 'Amoxicillin Trihydrate', batch: 'AMX-2025-A1', lot: 'LOT-10284', category: 'Medications', unit: 'tablets', quantity: 241, reorderLevel: 100, expiry: '2027-06-30', supplier: 'PharmVet Co.', value: 3012.5, status: 'Healthy Stock' },
  { id: 'BGT-2025-N14', name: 'Blood Glucose Test Kit', subtitle: 'Portable Glucometer + Strips', batch: 'BGT-2025-N14', lot: 'LOT-10390', category: 'Laboratory', unit: 'kits', quantity: 3, reorderLevel: 5, expiry: '2027-04-30', supplier: 'Zoetis', value: 5400, status: 'Low Stock' },
  { id: 'BOR-2025-I9', name: 'Bordetella Intranasal', subtitle: 'Bordetella bronchiseptica', batch: 'BOR-2025-I9', lot: 'LOT-10333', category: 'Vaccines', unit: 'doses', quantity: 30, reorderLevel: 12, expiry: '2027-02-28', supplier: 'Merck Animal Health', value: 3600, status: 'Healthy Stock' },
  { id: 'DHP-2025-G7', name: 'DHPP (Distemper Combo)', subtitle: 'Canine DHPP Combination', batch: 'DHP-2025-G7', lot: 'LOT-10278', category: 'Vaccines', unit: 'vials', quantity: 8, reorderLevel: 10, expiry: '2026-08-15 (Expired)', supplier: 'Zoetis', value: 1280, status: 'Critical Stock' },
  { id: 'DOX-2025-B2', name: 'Doxycycline 100mg', subtitle: 'Doxycycline Hyclate', batch: 'DOX-2025-B2', lot: 'LOT-10301', category: 'Medications', unit: 'tablets', quantity: 18, reorderLevel: 50, expiry: '2027-03-15', supplier: 'PharmVet Co.', value: 324, status: 'Low Stock' },
  { id: 'ENR-2025-E5', name: 'Enrofloxacin 50mg', subtitle: 'Enrofloxacin', batch: 'ENR-2025-E5', lot: 'LOT-10288', category: 'Medications', unit: 'tablets', quantity: 95, reorderLevel: 40, expiry: '2027-01-10', supplier: 'VetSupply Inc.', value: 2090, status: 'Healthy Stock' },
  { id: 'GLV-2025-L12', name: 'Exam Gloves (Medium)', subtitle: 'Nitrile Examination Gloves', batch: 'GLV-2025-L12', lot: 'LOT-10362', category: 'Supplies', unit: 'pairs', quantity: 80, reorderLevel: 100, expiry: 'N/A', supplier: 'MedSupply Direct', value: 600, status: 'Reorder Soon' },
  { id: 'FVR-2025-H8', name: 'Feline Distemper (FVRCP)', subtitle: 'Feline Viral Rhinotracheitis', batch: 'FVR-2025-H8', lot: 'LOT-10264', category: 'Vaccines', unit: 'vials', quantity: 15, reorderLevel: 8, expiry: '2026-10-01 (21d)', supplier: 'Merck Animal Health', value: 1950, status: 'Expiring Soon' },
  { id: 'IVC-2025-M13', name: 'IV Catheter 22G', subtitle: 'IV Catheter 22-gauge', batch: 'IVC-2025-M13', lot: 'LOT-10378', category: 'Supplies', unit: 'pieces', quantity: 45, reorderLevel: 30, expiry: '2028-01-01', supplier: 'VetMed Supply', value: 2475, status: 'Healthy Stock' },
  { id: 'LEP-2025-J10', name: 'Leptospirosis 4-way', subtitle: 'Leptospira Bacterin 4-way', batch: 'LEP-2025-J10', lot: 'LOT-10241', category: 'Vaccines', unit: 'vials', quantity: 5, reorderLevel: 8, expiry: '2026-07-31 (Expired)', supplier: 'Zoetis', value: 925, status: 'Critical Stock' },
  { id: 'MEL-2025-D4', name: 'Meloxicam Oral 1.5mg/ml', subtitle: 'Meloxicam', batch: 'MEL-2025-D4', lot: 'LOT-10312', category: 'Medications', unit: 'bottles (100ml)', quantity: 12, reorderLevel: 5, expiry: '2026-09-20 (10d)', supplier: 'PharmVet Co.', value: 5400, status: 'Expiring Soon' },
  { id: 'MET-2024-C3', name: 'Metronidazole 250mg', subtitle: 'Metronidazole', batch: 'MET-2024-C3', lot: 'LOT-10190', category: 'Medications', unit: 'tablets', quantity: 0, reorderLevel: 80, expiry: '2026-12-01 (82d)', supplier: 'VetSupply Inc.', value: 0, status: 'Out of Stock' },
  { id: 'RAB-2025-F6', name: 'Rabies Vaccine (IMRAB)', subtitle: 'Inactivated Rabies Virus', batch: 'RAB-2025-F6', lot: 'LOT-10295', category: 'Vaccines', unit: 'vials', quantity: 22, reorderLevel: 10, expiry: '2026-11-30 (81d)', supplier: 'Zoetis', value: 3300, status: 'Healthy Stock' },
  { id: 'SYR-2025-K11', name: 'Syringes 5ml', subtitle: 'Disposable Hypodermic Syringe', batch: 'SYR-2025-K11', lot: 'LOT-10350', category: 'Supplies', unit: 'pieces', quantity: 500, reorderLevel: 200, expiry: 'N/A', supplier: 'MedSupply Direct', value: 1750, status: 'Healthy Stock' },
];
const PURCHASE_ORDER_TABLE_DATA = [
  { order: 'PO-2026-001', supplier: 'PharmVet Co.', requestedBy: 'Owner', date: '2026-09-10', expected: '2026-09-17', received: '—', items: '2 items', total: 4300, status: 'Pending Approval', email: 'orders@pharmvet.ph', lines: [['Doxycycline 100mg', 100, 'tablets', 18], ['Amoxicillin 500mg', 200, 'tablets', 12.5]], actions: ['Approve', 'Cancel'] },
  { order: 'PO-2026-002', supplier: 'Zoetis Philippines', requestedBy: 'Owner', date: '2026-09-08', expected: '2026-09-14', received: '—', items: '2 items', total: 5450, status: 'Approved', email: 'zoetis.ph@zoetis.com', lines: [['DHPP (Distemper Combo)', 20, 'vials', 160], ['Rabies Vaccine (IMRAB)', 15, 'vials', 150]], actions: ['Receive'] },
  { order: 'PO-2026-003', supplier: 'VetSupply Inc.', requestedBy: 'Owner', date: '2026-09-01', expected: '2026-09-10', received: '2026-09-09', items: '1 item', total: 1700, status: 'Received', email: 'sales@vetsupply.ph', lines: [['Metronidazole 250mg', 200, 'tablets', 8.5]], actions: [] },
  { order: 'PO-2026-004', supplier: 'MedSupply Direct', requestedBy: 'Owner', date: '2026-09-05', expected: '2026-09-12', received: '—', items: '1 item', total: 2250, status: 'Cancelled', email: '', cancellationReason: 'Found better pricing from alternative supplier.', lines: [['Exam Gloves (Medium)', 300, 'pairs', 7.5]], actions: ['Duplicate'] },
  { order: 'PO-2026-005', supplier: 'Merck Animal Health', requestedBy: 'Owner', date: '2026-09-11', expected: '2026-09-20', received: '—', items: '1 item', total: 3250, status: 'Pending Approval', email: 'merck.ah@merck.com', lines: [['Feline Distemper (FVRCP)', 25, 'vials', 130]], actions: ['Approve', 'Cancel'] },
  { order: 'PO-2026-006', supplier: 'Zoetis Philippines', requestedBy: 'Owner', date: '2026-09-07', expected: '2026-09-13', received: '2026-09-12', items: '2 items', total: 12700, status: 'Partially Received', email: '', notes: 'Blood glucose kits backordered, expected September 20.', lines: [['Leptospirosis 4-way', 20, 'vials', 185], ['Blood Glucose Test Kit', 5, 'kits', 1800]], actions: ['Receive Remaining'] },
  { order: 'PO-2026-007', supplier: 'PharmVet Co.', requestedBy: 'Owner', date: '2026-09-12', expected: '—', received: '—', items: '1 item', total: 4500, status: 'Draft', email: '', notes: 'Urgent restock needed — expiring batch.', lines: [['Meloxicam Oral 1.5mg/ml', 10, 'bottles (100ml)', 450]], actions: ['Submit', 'Cancel'] },
];
const PURCHASE_ORDER_ACTIONS = ['Approve', 'Receive', 'Receive Remaining', 'Submit', 'Duplicate', 'Cancel'];
const INVENTORY_ITEM_DETAILS = {
  'Amoxicillin 500mg': { generic: 'Amoxicillin Trihydrate', brand: 'Moxamox', dosage: '500mg capsule', storage: 'Store below 25°C, away from moisture', purchasePrice: 12.5, sellingPrice: 18, movements: [['PO Receipt — PO-2026-001', 'September 10, 2026 · Owner', '+100']], },
  'Blood Glucose Test Kit': { generic: 'Portable Glucometer + Strips', brand: 'AlphaTRAK 2', dosage: 'N/A', storage: 'Store below 30°C, away from moisture', purchasePrice: 1800, sellingPrice: 2500, movements: [['Purchase', 'January 10, 2026 · Owner', '+10']], },
  'DHPP (Distemper Combo)': { generic: 'Canine DHPP Combination', brand: 'Vanguard Plus 5', dosage: '1ml/dose', storage: 'Store 2–8°C refrigerated', purchasePrice: 160, sellingPrice: 230, movements: [['Purchase', 'April 1, 2026 · Owner', '+25']], },
  'Exam Gloves (Medium)': { generic: 'Nitrile Examination Gloves', brand: 'Kimberly-Clark', dosage: 'N/A', storage: 'Store in dry, cool place away from sunlight', purchasePrice: 7.5, sellingPrice: 10, movements: [['Purchase', 'June 1, 2026 · Owner', '+200']], },
  'Feline Distemper (FVRCP)': { generic: 'Feline Viral Rhinotracheitis', brand: 'Purevax', dosage: '1ml/dose', storage: 'Store 2–8°C refrigerated', purchasePrice: 130, sellingPrice: 195, movements: [['Purchase', 'March 15, 2026 · Owner', '+20']], },
  'Metronidazole 250mg': { generic: 'Metronidazole', brand: 'Flagyl', dosage: '250mg tablet', storage: 'Store below 25°C', purchasePrice: 8.5, sellingPrice: 14, movements: [['Purchase', 'July 5, 2026 · Owner', '+100']], },
};
const STOCK_MOVEMENT_DATA = [
  ['July 15, 2026', 'Amoxicillin 500mg', 'INV-001', 'Stock Out', '−4', 'Consultation — Luna', 'Dr. Chen'],
  ['July 12, 2026', 'Amoxicillin 500mg', 'INV-001', 'Stock Out', '−10', 'Consultation — Max', 'Dr. Torres'],
  ['July 12, 2026', 'Doxycycline 100mg', 'INV-002', 'Stock Out', '−10', 'Vaccination', 'Dr. Torres'],
  ['July 12, 2026', 'Rabies Vaccine (IMRAB)', 'INV-006', 'Stock Out', '−8', 'Vaccination clinic', 'Dr. Torres'],
  ['July 12, 2026', 'Leptospirosis 4-way', 'INV-010', 'Stock Out', '−15', 'Annual lepto vaccination', 'Dr. Chen'],
  ['July 12, 2026', 'Syringes 5ml', 'INV-011', 'Stock Out', '−100', 'Clinic operations', 'Dr. Torres'],
  ['July 10, 2026', 'Amoxicillin 500mg', 'INV-001', 'Stock In', '+100', 'Purchase', 'Owner'],
  ['July 10, 2026', 'Meloxicam Oral 1.5mg/ml', 'INV-004', 'Stock Out', '−3', 'Surgery post-op', 'Dr. Torres'],
  ['July 10, 2026', 'DHPP (Distemper Combo)', 'INV-007', 'Stock Out', '−17', 'Vaccination schedule', 'Dr. Chen'],
  ['July 10, 2026', 'Bordetella Intranasal', 'INV-009', 'Stock Out', '−10', 'Kennel cough prevention', 'Dr. Torres'],
  ['July 10, 2026', 'Exam Gloves (Medium)', 'INV-012', 'Stock Out', '−120', 'Clinic operations', 'Dr. Smith'],
  ['July 8, 2026', 'Feline Distemper (FVRCP)', 'INV-008', 'Stock Out', '−5', 'Feline vaccination', 'Dr. Smith'],
  ['July 5, 2026', 'Enrofloxacin 50mg', 'INV-005', 'Stock Out', '−25', 'Multiple consultations', 'Dr. Smith'],
  ['July 5, 2026', 'IV Catheter 22G', 'INV-013', 'Stock Out', '−15', 'IV therapy patients', 'Dr. Chen'],
  ['July 1, 2026', 'Doxycycline 100mg', 'INV-002', 'Stock Out', '−30', 'Consultation — Charlie', 'Dr. Smith'],
  ['July 1, 2026', 'Blood Glucose Test Kit', 'INV-014', 'Stock Out', '−7', 'Diabetes monitoring', 'Dr. Torres'],
  ['June 30, 2026', 'Metronidazole 250mg', 'INV-003', 'Stock Out', '−100', 'Multiple consultations', 'Dr. Chen'],
  ['June 20, 2026', 'Doxycycline 100mg', 'INV-002', 'Stock In', '+80', 'Purchase', 'Owner'],
  ['June 15, 2026', 'Syringes 5ml', 'INV-011', 'Stock In', '+600', 'Purchase', 'Owner'],
  ['June 1, 2026', 'Bordetella Intranasal', 'INV-009', 'Stock In', '+40', 'Purchase', 'Owner'],
  ['June 1, 2026', 'Exam Gloves (Medium)', 'INV-012', 'Stock In', '+200', 'Purchase', 'Owner'],
  ['May 25, 2026', 'IV Catheter 22G', 'INV-013', 'Stock In', '+60', 'Purchase', 'Owner'],
  ['May 20, 2026', 'Leptospirosis 4-way', 'INV-010', 'Stock In', '+20', 'Purchase', 'Owner'],
  ['May 10, 2026', 'Rabies Vaccine (IMRAB)', 'INV-006', 'Stock In', '+30', 'Purchase', 'Owner'],
  ['May 5, 2026', 'Metronidazole 250mg', 'INV-003', 'Stock In', '+100', 'Purchase', 'Owner'],
  ['April 15, 2026', 'Enrofloxacin 50mg', 'INV-005', 'Stock In', '+120', 'Purchase', 'Owner'],
  ['April 1, 2026', 'DHPP (Distemper Combo)', 'INV-007', 'Stock In', '+25', 'Purchase', 'Owner'],
  ['March 15, 2026', 'Feline Distemper (FVRCP)', 'INV-008', 'Stock In', '+20', 'Purchase', 'Owner'],
  ['March 1, 2026', 'Meloxicam Oral 1.5mg/ml', 'INV-004', 'Stock In', '+15', 'Purchase', 'Owner'],
  ['January 10, 2026', 'Blood Glucose Test Kit', 'INV-014', 'Stock In', '+10', 'Purchase', 'Owner'],
];
const STOCK_MOVEMENT_DISPLAY_DATA = [
  ['2026-09-10 09:15', 'Amoxicillin 500mg', 'INV-001', 'Stock In / PO Receipt', '+100', '240 tablets', 'PO-2026-001', 'Purchase Order receipt from PharmVet Co.', 'Owner'],
  ['2026-09-10 11:30', 'Amoxicillin 500mg', 'INV-001', 'Used for Consultation', '−10', '230 tablets', 'CONS-2026-089', 'Post-op antibiotic — Max (Golden Retriever)', 'Dr. Torres'],
  ['2026-09-09 14:00', 'Rabies Vaccine (IMRAB)', 'INV-006', 'Used for Vaccination', '−8', '22 vials', 'VACC-2026-045', 'Scheduled vaccination clinic — 8 patients', 'Dr. Torres'],
  ['2026-09-08 10:00', 'Exam Gloves (Medium)', 'INV-012', 'Stock Count / Reconciliation', '±20', '80 pairs', 'RECON-2026-003', 'Monthly stock count — variance of 20 pairs', 'Owner'],
  ['2026-09-07 16:20', 'Leptospirosis 4-way', 'INV-010', 'Stock In / PO Receipt', '+5', '5 vials', 'PO-2026-006', 'Partial receipt — PO-2026-006 (5 of 20 vials received)', 'Owner'],
  ['2026-09-07 15:00', 'Enrofloxacin 50mg', 'INV-005', 'Dispensed', '−25', '95 tablets', 'CONS-2026-087', 'Dispensed — Rocky (UTI treatment, 5 days)', 'Dr. Smith'],
  ['2026-09-05 09:45', 'Metronidazole 250mg', 'INV-003', 'Manual Adjustment', '±10', '0 tablets', 'ADJ-2026-012', 'Adjusted to zero — damaged packaging during storage', 'Owner'],
  ['2026-09-03 08:30', 'Meloxicam Oral 1.5mg/ml', 'INV-004', 'Expired or Wasted', '−3', '12 bottles (100ml)', 'WASTE-2026-008', 'Disposed 3 bottles — expiry within 30 days (unused)', 'Owner'],
  ['2026-09-01 14:10', 'Metronidazole 250mg', 'INV-003', 'Stock In / PO Receipt', '+200', '200 tablets', 'PO-2026-003', 'Full PO receipt — PO-2026-003 from VetSupply Inc.', 'Owner'],
  ['2026-08-28 11:00', 'DHPP (Distemper Combo)', 'INV-007', 'Used for Vaccination', '−17', '8 vials', 'VACC-2026-040', 'Mass vaccination event — 17 dogs', 'Dr. Chen'],
  ['2026-08-25 13:00', 'Feline Distemper (FVRCP)', 'INV-008', 'Return to Supplier', '−5', '15 vials', 'RET-2026-002', 'Returned defective batch to Merck Animal Health', 'Owner'],
  ['2026-08-20 10:30', 'Syringes 5ml', 'INV-011', 'Stock In / PO Receipt', '+600', '600 pieces', 'PO-2026-SYR', 'Purchase Order receipt from MedSupply Direct', 'Owner'],
];

const EXPORT_REPORT_TYPES = [
  { id: 'inventory', label: 'Inventory Summary', description: 'Current stock, values, suppliers, and statuses' },
  { id: 'movements', label: 'Stock Movement Report', description: 'Stock in, usage, adjustments, and references' },
  { id: 'purchase-orders', label: 'Purchase Orders Report', description: 'Orders, suppliers, totals, and delivery status' },
  { id: 'attention', label: 'Stock Attention Report', description: 'Items that need replenishment or immediate action' },
];

function getReportRows(reportType) {
  if (reportType === 'movements') {
    return [
      ['Date & Time', 'Item', 'Item Code', 'Movement Type', 'Quantity', 'Balance After', 'Reference', 'Reason', 'Performed By'],
      ...STOCK_MOVEMENT_DISPLAY_DATA,
    ];
  }
  if (reportType === 'purchase-orders') {
    return [
      ['Order', 'Supplier', 'Requested By', 'Order Date', 'Expected Date', 'Received Date', 'Items', 'Total', 'Status'],
      ...PURCHASE_ORDER_TABLE_DATA.map(order => [order.order, order.supplier, order.requestedBy, order.date, order.expected, order.received, order.items, order.total, order.status]),
    ];
  }
  if (reportType === 'attention') {
    return [
      ['Item', 'Unit', 'Quantity', 'Reorder Level', 'Supplier', 'Attention', 'Guidance'],
      ...ATTENTION_ITEMS.map(item => [item.name, item.unit, item.quantity, item.reorderLevel, item.supplier, item.attention, item.guidance]),
    ];
  }
  return [
    ['Item', 'Category', 'Quantity', 'Unit', 'Reorder Level', 'Supplier', 'Status'],
    ...INVENTORY_ITEMS.map(item => [item.name, item.category, item.quantity, item.unit, item.reorderLevel, item.supplier, item.status]),
  ];
}

function getReportTitle(reportType) {
  return EXPORT_REPORT_TYPES.find(report => report.id === reportType)?.label || 'Inventory Summary';
}

function downloadInventoryCsv(reportType = 'inventory') {
  const rows = getReportRows(reportType);
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `vetintel-${reportType}-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadInventoryPdf(reportType = 'inventory') {
  const rows = getReportRows(reportType);
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text(`VetIntel ${getReportTitle(reportType)}`, 14, 18);
  pdf.setFontSize(9);
  pdf.text(`Generated: ${formatDateText(new Date(), 'en-PH')}`, 14, 26);
  let y = 38;
  const columnWidth = 182 / rows[0].length;
  rows.forEach((row, rowIndex) => {
    y += 8;
    if (y > 280) { pdf.addPage(); y = 20; }
    pdf.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
    row.forEach((value, columnIndex) => {
      const maxLength = rows[0].length > 7 ? 16 : 24;
      pdf.text(String(value).slice(0, maxLength), 14 + (columnIndex * columnWidth), y);
    });
  });
  pdf.save(`vetintel-${reportType}-report.pdf`);
}
const ATTENTION_ITEMS = [
  { ...INVENTORY_ITEMS.find(item => item.status === 'Out of stock'), attention: 'Out of stock', guidance: 'Replenish immediately' },
  { name: 'Surgical Suture 3-0', unit: 'Pack', quantity: 4, reorderLevel: 10, supplier: 'MediPet Wholesale', attention: 'Critical stock', guidance: 'Below critical level' },
  { name: 'Meloxicam 1.5mg/ml', unit: 'Bottle', quantity: 9, reorderLevel: 12, supplier: 'VetPharm Supplies', attention: 'Critical stock', guidance: 'Below critical level' },
];

function UsageTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={s.usageTooltip}>
      <div style={s.usageTooltipLabel}>{label}</div>
      {payload.map(item => (
        <div key={item.dataKey} style={{ ...s.usageTooltipRow, color: item.color }}>
          <span>{item.dataKey}</span>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

function MedicineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={s.medicineTooltip}>
      <div style={s.medicineTooltipName}>{item.payload.name}</div>
      <div style={s.medicineTooltipValue}>Dispensed : {item.value}</div>
    </div>
  );
}

function StatCard({ label, value, detail, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statAccent, background: color }} />
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
      <div style={s.statDetail}>{detail}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <StatusIndicator status={status} />;
}

export default function InventoryManagementPage({ user }) {
  const [showOrders, setShowOrders] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPurchaseOrder, setShowPurchaseOrder] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [showReceiveDelivery, setShowReceiveDelivery] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedExportReport, setSelectedExportReport] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementType, setMovementType] = useState('All Movements');
  const [movementItem, setMovementItem] = useState('All Items');
  const [movementStaff, setMovementStaff] = useState('All Staff');
  const [movementDetail, setMovementDetail] = useState(null);
  const [formNotice, setFormNotice] = useState('');
  const [notification, setNotification] = useState('');
  const [notificationError, setNotificationError] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState({ supplier: '', email: '', requestedBy: '', expectedDeliveryDate: '', notes: '' });
  const [supplierCards, setSupplierCards] = useState(SUPPLIER_CARDS);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [selectedAttentionItem, setSelectedAttentionItem] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [receivedDeliveries, setReceivedDeliveries] = useState([]);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState('');
  const [inventoryItems, setInventoryItems] = useState(ALL_ITEMS_TABLE_DATA);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [purchaseOrderFilter, setPurchaseOrderFilter] = useState('all');
  const [openPurchaseOrderActions, setOpenPurchaseOrderActions] = useState('');
  const [viewPurchaseOrder, setViewPurchaseOrder] = useState(null);
  const [viewInventoryItem, setViewInventoryItem] = useState(null);
  const [restockInventoryItem, setRestockInventoryItem] = useState(null);
  const [editInventoryItem, setEditInventoryItem] = useState(null);
  const [receivePurchaseOrder, setReceivePurchaseOrder] = useState(null);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([{ product: '', quantity: 0, unit: 'pieces', unitPrice: '0.00' }]);
  const selectedSupplier = supplierCards.find(supplier => supplier.name === purchaseOrder.supplier);
  const unitOptions = ['tablets', 'capsules', 'vials', 'bottles', 'bottles (100ml)', 'pieces', 'pairs', 'doses', 'kits', 'packs', 'boxes', 'rolls'];
  const canView = canViewFeature(user.permissions, user.role, 'Inventory Management')
    || String(user.role || '').trim().toLowerCase() === 'owner';

  useEffect(() => {
    if (!canView || !user?.token) return;
    const loadCatalogProducts = async () => {
      setCatalogLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const normalizedRole = String(user.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (['owner', 'clinic_owner'].includes(normalizedRole)) {
          const seedResponse = await fetch(`${apiUrl}/clinic-records/billing-catalog/seed-defaults`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${user.token}` },
          });
          const seedPayload = await seedResponse.json().catch(() => ({}));
          if (!seedResponse.ok) throw new Error(seedPayload.error || 'Unable to load the owner-managed product catalog.');
        }
        const response = await fetch(`${apiUrl}/clinic-records/billing-catalog`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(payload)) throw new Error(payload.error || 'Unable to load the clinic product catalog.');
        const productCategories = new Set([
          'Medical Supplies', 'Wound Care', 'Laboratory Supplies', 'Grooming & Hygiene',
          'Surgical Equipment', 'Clinic Accessories',
        ]);
        const products = payload
          .filter(item => item.active !== false && productCategories.has(item.category))
          .map(item => ({
            id: `CAT-${item.id}`,
            catalogId: item.id,
            name: item.name,
            subtitle: item.description || 'Clinic catalog product',
            batch: 'Not assigned',
            lot: 'Not assigned',
            category: item.category,
            unit: item.unit || 'pieces',
            quantity: 0,
            reorderLevel: 0,
            expiry: 'N/A',
            supplier: 'Not assigned',
            value: 0,
            status: 'Catalog item',
          }));
        setCatalogProducts(products);
        setInventoryItems(current => {
          const existingNames = new Set(current.map(item => item.name.toLowerCase()));
          return [...current, ...products.filter(item => !existingNames.has(item.name.toLowerCase()))];
        });
      } catch (catalogError) {
        setNotificationError(true);
        setNotification(catalogError.message || 'Unable to load the clinic product catalog.');
      } finally {
        setCatalogLoading(false);
      }
    };
    loadCatalogProducts();
  }, [canView, user?.token]);

  if (!canView) {
    return <div style={s.main}><Topbar user={user} title="Inventory Management" subtitle="Track clinic stock, suppliers, and replenishment" /><div style={s.page}><div style={s.empty}>You do not have permission to view Inventory Management.</div></div></div>;
  }

  return (
    <div className="inventory-management-page" style={s.main}>
      <Topbar user={user} title="Inventory Management" subtitle="Track clinic stock, suppliers, and replenishment" />
      {notification && (
        <div style={s.notification} role="status">
          <span style={{ ...s.notificationIcon, ...(notificationError ? s.notificationErrorIcon : {}) }}>{notificationError ? '!' : '✓'}</span>
          <span>{notification}</span>
        </div>
      )}
      {canView && (
        <div style={{ ...s.notification, margin: '12px 22px 0', background: '#e7f5f2', color: '#005447' }} role="status">
          {catalogLoading
            ? 'Loading owner-managed products…'
            : `${catalogProducts.length} owner-managed products are available for inventory purchasing and stock setup.`}
        </div>
      )}
      {movementDetail && (() => {
        const item = inventoryItems.find(entry => entry.name === movementDetail.name);
        const unit = movementDetail.balance.replace(/^-?\d+\s*/, '');
        const balanceAfter = Number(movementDetail.balance.match(/^-?\d+/)?.[0] || 0);
        const signedQuantity = Number(movementDetail.quantity.replace('−', '-').replace('±', '0'));
        const balanceBefore = balanceAfter - signedQuantity;
        return (
          <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMovementDetail(null); }}>
            <div style={s.movementDetailModal} role="dialog" aria-modal="true" aria-labelledby="movement-detail-title">
              <div style={s.modalHeader}><div><h2 id="movement-detail-title" style={s.modalTitle}>Movement Detail</h2><p style={s.modalSubtitle}>{movementDetail.movementId}</p></div><button type="button" style={s.closeButton} onClick={() => setMovementDetail(null)} aria-label="Close">×</button></div>
              <div style={s.movementDetailSummary}><span style={{ ...s.stockMovementBadge, ...(movementDetail.type.includes('Stock In') ? s.stockInBadge : movementDetail.type.includes('Stock Count') ? s.stockCountBadge : movementDetail.type === 'Return to Supplier' ? s.stockReturnBadge : s.stockOutBadge) }}>{movementDetail.type}</span><strong style={{ color: movementDetail.quantity.startsWith('+') ? '#16a34a' : movementDetail.quantity.startsWith('±') ? '#f97316' : '#ef1d2d' }}>{movementDetail.quantity} {unit}</strong></div>
              <div style={s.movementDetailGrid}>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Date &amp; Time</span><strong>{movementDetail.date}</strong></div><div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Item</span><strong>{movementDetail.name}</strong></div>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Item Code</span><strong>{movementDetail.id}</strong></div><div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Performed By</span><strong>{movementDetail.performedBy}</strong></div>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Balance Before</span><strong>{balanceBefore} {unit}</strong></div><div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Balance After</span><strong>{movementDetail.balance}</strong></div>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Reference</span><strong style={s.movementDetailLink}>{movementDetail.reference}</strong></div><div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Batch Number</span><strong>{item?.batch || '—'}</strong></div>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Expiry Date</span><strong>{item?.expiry || '—'}</strong></div><div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Purchase Order</span><strong style={s.movementDetailLink}>{movementDetail.reference.startsWith('PO-') ? movementDetail.reference : '—'}</strong></div>
                <div style={s.movementDetailGridCell}><span style={s.movementDetailLabel}>Supplier</span><strong>{item?.supplier || '—'}</strong></div>
                <div style={{ ...s.movementDetailGridCell, gridColumn: '1 / -1' }}><span style={s.movementDetailLabel}>Reason</span><strong style={s.movementDetailReason}>{movementDetail.reason}</strong></div>
              </div>
              <div style={s.movementDetailFooter}><button type="button" style={s.cancelButton} onClick={() => setMovementDetail(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}
      {showAddSupplier && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAddSupplier(false); }}>
          <form style={s.addSupplierModal} onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const supplier = {
              id: `SUP-${String(supplierCards.length + 1).padStart(3, '0')}`,
              name: String(data.get('name')).trim(),
              contact: String(data.get('contact')).trim(),
              email: String(data.get('email')).trim(),
              phone: String(data.get('phone')).trim(),
              address: String(data.get('address')).trim(),
              products: String(data.get('products')).split(',').map(product => product.trim()).filter(Boolean),
            };
            setSupplierCards(previous => [...previous, supplier]);
            setShowAddSupplier(false);
            setNotificationError(false);
            setNotification(`${supplier.name} added successfully`);
            window.setTimeout(() => setNotification(''), 2500);
          }}>
            <div style={s.modalHeader}><div><h2 style={s.modalTitle}>Add Supplier</h2><p style={s.modalSubtitle}>Add a supplier to your inventory directory.</p></div><button type="button" style={s.closeButton} onClick={() => setShowAddSupplier(false)} aria-label="Close">×</button></div>
            <div style={s.addSupplierGrid}>
              <label style={s.formField}>Supplier Name<input name="name" required placeholder="e.g., VetMed Supply" style={s.formInput} /></label>
              <label style={s.formField}>Contact Person<input name="contact" required placeholder="e.g., Pedro Bautista" style={s.formInput} /></label>
              <label style={s.formField}>Email<input name="email" type="email" required placeholder="e.g., orders@supplier.ph" style={s.formInput} /></label>
              <label style={s.formField}>Phone<input name="phone" required placeholder="e.g., +63 922 678 9012" style={s.formInput} /></label>
              <label style={{ ...s.formField, gridColumn: '1 / -1' }}>Address<input name="address" required placeholder="e.g., Quezon City, Metro Manila" style={s.formInput} /></label>
              <label style={{ ...s.formField, gridColumn: '1 / -1' }}>Products Supplied<input name="products" placeholder="Separate products with commas" style={s.formInput} /></label>
            </div>
            <div style={s.modalFooter}><button type="button" style={s.cancelButton} onClick={() => setShowAddSupplier(false)}>Cancel</button><button type="submit" style={s.modalSubmit}>Add Supplier</button></div>
          </form>
        </div>
      )}
      {showReceipt && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowReceipt(null); }}>
          <div style={s.receiptModal} role="dialog" aria-modal="true" aria-labelledby="receipt-title">
            <div style={s.modalHeader}><h2 id="receipt-title" style={s.modalTitle}>Delivery Receipt</h2><button type="button" style={s.closeButton} onClick={() => setShowReceipt(null)} aria-label="Close">×</button></div>
            <img src={showReceipt.url} alt={showReceipt.name} style={s.receiptFullImage} />
            <div style={s.receiptModalFooter}><span>{showReceipt.name}</span><button type="button" style={s.cancelButton} onClick={() => setShowReceipt(null)}>Close</button></div>
          </div>
        </div>
      )}
      {restockInventoryItem && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRestockInventoryItem(null); }}>
          <form style={s.restockModal} onSubmit={event => {
            event.preventDefault();
            const quantityToAdd = Number(new FormData(event.currentTarget).get('quantityToAdd'));
            if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) return;
            setInventoryItems(previous => previous.map(item => item.id === restockInventoryItem.id
              ? { ...item, quantity: item.quantity + quantityToAdd, value: item.value + quantityToAdd * ((INVENTORY_ITEM_DETAILS[item.name]?.purchasePrice || item.value / Math.max(item.quantity, 1))) }
              : item));
            setRestockInventoryItem(null);
            setNotificationError(false);
            setNotification(`${restockInventoryItem.name} restocked successfully`);
            window.setTimeout(() => setNotification(''), 2500);
          }}>
            <div style={s.modalHeader}>
              <div><h2 style={s.modalTitle}>Restock Item</h2><p style={s.modalSubtitle}>Add incoming stock for {restockInventoryItem.name}</p></div>
              <button type="button" style={s.closeButton} onClick={() => setRestockInventoryItem(null)} aria-label="Close">×</button>
            </div>
            <div style={s.restockSummary}>
              <div style={s.restockSummaryItem}><span style={s.restockSummaryLabel}>Current</span><strong style={s.restockSummaryValue}>{restockInventoryItem.quantity} {restockInventoryItem.unit}</strong></div>
              <div style={s.restockSummaryItem}><span style={s.restockSummaryLabel}>Reorder at</span><strong style={s.restockSummaryValue}>{restockInventoryItem.reorderLevel} {restockInventoryItem.unit}</strong></div>
              <div style={s.restockSummaryItem}><span style={s.restockSummaryLabel}>Batch</span><strong style={s.restockSummaryValue}>{restockInventoryItem.batch}</strong></div>
            </div>
            <label style={s.formField}>Quantity to Add ({restockInventoryItem.unit})<span style={s.required}>*</span><input name="quantityToAdd" type="number" min="1" step="1" required autoFocus placeholder="e.g. 200" style={s.restockQuantityInput} /></label>
            <div style={s.restockFooter}><button type="button" style={s.cancelButton} onClick={() => setRestockInventoryItem(null)}>Cancel</button><button type="submit" style={s.modalSubmit}><span style={s.actionIcon}>{Icons.refresh}</span> Confirm Restock</button></div>
          </form>
        </div>
      )}
      {editInventoryItem && (() => {
        const detail = { generic: '', brand: '', dosage: '', storage: '', purchasePrice: '', sellingPrice: '', ...INVENTORY_ITEM_DETAILS[editInventoryItem.name] };
        return (
          <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditInventoryItem(null); }}>
            <form style={s.editInventoryModal} onSubmit={event => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const quantity = Number(data.get('quantity'));
              const purchasePrice = Number(data.get('purchasePrice'));
              const updatedItem = {
                ...editInventoryItem,
                name: String(data.get('itemName')).trim(),
                subtitle: String(data.get('genericName')).trim(),
                generic: String(data.get('genericName')).trim(),
                brand: String(data.get('brand')).trim(),
                dosage: String(data.get('dosage')).trim(),
                storage: String(data.get('storage')).trim(),
                purchasePrice,
                sellingPrice: Number(data.get('sellingPrice') || 0),
                category: String(data.get('category')),
                supplier: String(data.get('supplier')).trim(),
                quantity,
                unit: String(data.get('unit')).trim(),
                reorderLevel: Number(data.get('reorderLevel')),
                batch: String(data.get('batch')).trim(),
                lot: String(data.get('lot')).trim(),
                expiry: String(data.get('expiry')),
                value: quantity * purchasePrice,
              };
              setInventoryItems(previous => previous.map(item => item.id === updatedItem.id ? updatedItem : item));
              setEditInventoryItem(null);
              setNotificationError(false);
              setNotification(`${updatedItem.name} details updated`);
              window.setTimeout(() => setNotification(''), 2500);
            }}>
              <div style={s.modalHeader}><div><h2 style={s.modalTitle}>Edit Inventory Item</h2><p style={s.modalSubtitle}>Update details for {editInventoryItem.name}</p></div><button type="button" style={s.closeButton} onClick={() => setEditInventoryItem(null)} aria-label="Close">×</button></div>
              <div style={s.editInventoryGrid}>
                <label style={s.formField}>Item Name<input name="itemName" placeholder="e.g., Amoxicillin 500mg" required style={s.formInput} /></label>
                <label style={s.formField}>Generic Name<input name="genericName" placeholder="e.g., Amoxicillin Trihydrate" style={s.formInput} /></label>
                <label style={s.formField}>Brand<input name="brand" placeholder="e.g., Moxamox" style={s.formInput} /></label>
                <label style={s.formField}>Dosage / Form<input name="dosage" placeholder="e.g., 500mg capsule" style={s.formInput} /></label>
                <label style={s.formField}>Category<select name="category" required defaultValue="" style={s.formInput}><option value="">Select category</option>{['Medications', 'Vaccines', 'Supplies', 'Equipment', 'Laboratory'].map(category => <option key={category} value={category}>{category === 'Medications' ? 'Medication' : category === 'Vaccines' ? 'Vaccine' : category === 'Supplies' ? 'Supply' : category}</option>)}</select></label>
                <label style={s.formField}>Supplier<input name="supplier" placeholder="e.g., PharmVet Co." required style={s.formInput} /></label>
                <div style={s.editInventoryTriple}>
                  <label style={s.formField}>Current Stock<input name="quantity" type="number" min="0" placeholder="e.g., 100" required style={s.formInput} /></label>
                  <label style={s.formField}>Unit<input name="unit" placeholder="e.g., tablets" required style={s.formInput} /></label>
                  <label style={s.formField}>Reorder Level<input name="reorderLevel" type="number" min="0" placeholder="e.g., 50" required style={s.formInput} /></label>
                </div>
                <div style={s.editInventoryTriple}>
                  <label style={s.formField}>Critical Level<input name="criticalLevel" type="number" min="0" placeholder="e.g., 20" style={s.formInput} /></label>
                  <label style={s.formField}>Purchase Price (₱)<input name="purchasePrice" type="number" min="0" step="0.01" placeholder="e.g., 12.50" required style={s.formInput} /></label>
                  <label style={s.formField}>Selling Price (₱)<input name="sellingPrice" type="number" min="0" step="0.01" placeholder="e.g., 18.00" style={s.formInput} /></label>
                </div>
                <div style={s.editInventoryTriple}>
                  <label style={s.formField}>Batch Number<input name="batch" placeholder="e.g., AMX-2025-A1" style={s.formInput} /></label>
                  <label style={s.formField}>Lot Number<input name="lot" placeholder="e.g., LOT-10284" style={s.formInput} /></label>
                  <label style={s.formField}>Expiry Date<LabDateTimePicker name="expiry" mode="date" style={s.formInput} /></label>
                </div>
                <label style={{ ...s.formField, gridColumn: '1 / -1' }}>Storage Requirements<textarea name="storage" placeholder="e.g., Store below 25°C, away from moisture" style={s.editInventoryTextarea} /></label>
              </div>
              <div style={s.modalFooter}><button type="button" style={s.cancelButton} onClick={() => setEditInventoryItem(null)}>Cancel</button><button type="submit" style={s.modalSubmit}>Save Changes</button></div>
            </form>
          </div>
        );
      })()}
      {viewInventoryItem && (() => {
        const detail = { generic: 'N/A', brand: 'N/A', dosage: 'N/A', storage: 'Store in a cool, dry place', purchasePrice: viewInventoryItem.value && viewInventoryItem.quantity ? viewInventoryItem.value / viewInventoryItem.quantity : 0, sellingPrice: 0, movements: [['Purchase', 'Recent · Owner', `+${viewInventoryItem.quantity}`]], ...INVENTORY_ITEM_DETAILS[viewInventoryItem.name], ...viewInventoryItem };
        return (
          <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setViewInventoryItem(null); }}>
            <div style={s.inventoryViewModal} role="dialog" aria-modal="true" aria-labelledby="inventory-item-view-title">
              <div style={s.inventoryViewHeader}>
                <div><h2 id="inventory-item-view-title" style={s.inventoryViewTitle}>{viewInventoryItem.name}</h2><p style={s.inventoryViewSubtitle}>{viewInventoryItem.id} · {viewInventoryItem.category === 'Medications' ? 'Medication' : viewInventoryItem.category === 'Vaccines' ? 'Vaccine' : viewInventoryItem.category === 'Supplies' ? 'Supply' : 'Laboratory'}</p></div>
                <button type="button" style={s.closeButton} onClick={() => setViewInventoryItem(null)} aria-label="Close">×</button>
              </div>
              <div style={s.inventoryViewStats}>
                <div style={s.inventoryViewStatsItem}><span style={s.inventoryViewStatsLabel}>Current Stock</span><strong style={{ ...s.inventoryViewStatsValue, color: viewInventoryItem.quantity === 0 ? '#dc2626' : '#1f2937' }}>{viewInventoryItem.quantity}</strong><small style={s.inventoryViewStatsUnit}>{viewInventoryItem.unit}</small></div>
                <div style={s.inventoryViewStatsItem}><span style={s.inventoryViewStatsLabel}>Reorder Level</span><strong style={{ ...s.inventoryViewStatsValue, color: '#d97706' }}>{viewInventoryItem.reorderLevel}</strong><small style={s.inventoryViewStatsUnit}>{viewInventoryItem.unit}</small></div>
                <div style={s.inventoryViewStatsItem}><span style={s.inventoryViewStatsLabel}>Status</span><StatusBadge status={viewInventoryItem.status} /></div>
              </div>
              <div style={s.inventoryViewInfo}>
                <div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Generic Name</span><strong>{detail.generic}</strong></div><div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Brand</span><strong>{detail.brand}</strong></div>
                <div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Dosage / Form</span><strong>{detail.dosage}</strong></div><div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Supplier</span><strong>{viewInventoryItem.supplier}</strong></div>
                <div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Batch Number</span><strong>{viewInventoryItem.batch}</strong></div><div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Lot Number</span><strong>{viewInventoryItem.lot}</strong></div>
                <div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Expiry Date</span><strong style={viewInventoryItem.expiry.includes('Expired') || viewInventoryItem.expiry.includes('d)') ? s.inventoryExpiryWarning : {}}>{formatInventoryDate(viewInventoryItem.expiry)}</strong></div><div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Purchase Price</span><strong>₱{detail.purchasePrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                <div style={s.inventoryViewInfoItem}><span style={s.inventoryViewInfoLabel}>Selling Price</span><strong>{detail.sellingPrice ? `₱${detail.sellingPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'N/A'}</strong></div>
                <div style={{ ...s.inventoryViewInfoItem, gridColumn: '1 / -1' }}><span style={s.inventoryViewInfoLabel}>Storage Requirements</span><strong>{detail.storage}</strong></div>
              </div>
              <div style={s.inventoryMovementsTitle}>Recent Movements</div>
              <div style={s.inventoryMovements}>{detail.movements.map(([name, date, quantity]) => <div key={`${name}-${date}`} style={s.inventoryMovement}><div style={s.inventoryMovementInfo}><strong>{name}</strong><small>{date}</small></div><b style={{ color: quantity.startsWith('+') ? '#16a34a' : '#ef1d2d' }}>{quantity} {viewInventoryItem.unit}</b></div>)}</div>
              <div style={s.inventoryViewFooter}><button type="button" style={s.cancelButton} onClick={() => setViewInventoryItem(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}
      {viewPurchaseOrder && (
        <div style={{ ...s.modalOverlay, zIndex: 200 }} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setViewPurchaseOrder(null); }}>
          <div style={{ width: 'min(510px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '20px 24px 18px', boxShadow: '0 18px 50px rgba(15,23,42,.22)', color: '#1f2937' }} role="dialog" aria-modal="true" aria-labelledby="purchase-order-view-title">
            <div style={s.purchaseViewHeader}>
              <div>
                <h2 id="purchase-order-view-title" style={s.purchaseViewTitle}>Purchase Order — {viewPurchaseOrder.order}</h2>
                <p style={s.purchaseViewSubtitle}>{viewPurchaseOrder.supplier} · {formatInventoryDate(viewPurchaseOrder.date)}</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => setViewPurchaseOrder(null)} aria-label="Close">×</button>
            </div>
            <div style={s.purchaseViewStatusRow}>
              <StatusBadge status={viewPurchaseOrder.status} />
              {viewPurchaseOrder.received !== '—' && <span style={s.purchaseViewReceived}>Received: {viewPurchaseOrder.received}</span>}
            </div>
            <div style={s.purchaseViewInfo}>
              <div><span style={s.purchaseViewInfoLabel}>Requested By</span><strong style={s.purchaseViewInfoValue}>{viewPurchaseOrder.requestedBy}</strong></div>
              <div><span style={s.purchaseViewInfoLabel}>Order Date</span><strong style={s.purchaseViewInfoValue}>{formatInventoryDate(viewPurchaseOrder.date)}</strong></div>
              <div><span style={s.purchaseViewInfoLabel}>Expected Delivery</span><strong style={s.purchaseViewInfoValue}>{formatInventoryDate(viewPurchaseOrder.expected)}</strong></div>
              <div><span style={s.purchaseViewInfoLabel}>Send To</span><strong style={s.purchaseViewInfoValue}>{viewPurchaseOrder.email || '—'}</strong></div>
            </div>
            {viewPurchaseOrder.cancellationReason && <div style={s.purchaseCancellation}><strong>Cancellation Reason</strong><span>{viewPurchaseOrder.cancellationReason}</span></div>}
            <div style={s.purchaseViewItemsTitle}>Order Items</div>
            <table style={s.purchaseViewItemsTable}>
              <thead><tr><th style={s.purchaseViewItemsTableHead}>Item</th><th style={s.purchaseViewItemsTableHead}>Qty</th><th style={s.purchaseViewItemsTableHead}>Unit</th><th style={s.purchaseViewItemsTableHead}>Unit Cost</th><th style={s.purchaseViewItemsTableHead}>Line Total</th></tr></thead>
              <tbody>{viewPurchaseOrder.lines.map(([name, quantity, unit, unitCost]) => <tr key={name}><td style={s.purchaseViewItemsTableCell}>{name}</td><td style={s.purchaseViewItemsTableCell}>{quantity}</td><td style={s.purchaseViewItemsTableCell}>{unit}</td><td style={s.purchaseViewItemsTableCell}>₱{unitCost.toFixed(2)}</td><td style={s.purchaseViewItemsTableCell}><strong>₱{(quantity * unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>)}</tbody>
            </table>
            <div style={s.purchaseViewTotal}><strong>Total Amount</strong><strong style={s.purchaseViewTotalValue}>₱{viewPurchaseOrder.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
            {viewPurchaseOrder.notes && <div style={s.purchaseViewNotes}><span style={s.purchaseViewNotesLabel}>Notes</span><p style={s.purchaseViewNotesText}>{viewPurchaseOrder.notes}</p></div>}
            <div style={s.purchaseViewFooter}><button type="button" style={s.cancelButton} onClick={() => setViewPurchaseOrder(null)}>Close</button></div>
          </div>
        </div>
      )}
      {showDeliveries && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowDeliveries(false); }}>
          <div style={s.deliveriesModal} role="dialog" aria-modal="true" aria-labelledby="recent-deliveries-title">
            <div style={s.modalHeader}>
              <div>
                <h2 id="recent-deliveries-title" style={s.modalTitle}>Recent Deliveries</h2>
                <p style={s.modalSubtitle}>Received purchase orders and attached receipt photos.</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => setShowDeliveries(false)} aria-label="Close">×</button>
            </div>
            {receivedDeliveries.length > 0 ? (
              <div style={s.deliveryList}>
                {receivedDeliveries.map(delivery => (
                  <div key={delivery.id} style={s.deliveryRow}>
                    <div style={s.deliveryInfo}>
                      <button type="button" style={s.deliverySummaryButton} onClick={() => setExpandedDeliveryId(previous => previous === delivery.id ? '' : delivery.id)} aria-expanded={expandedDeliveryId === delivery.id}>
                        <span style={s.deliverySummaryMain}><strong>{delivery.purchaseOrder}</strong><span style={s.deliveryInfoSecondary}>{delivery.supplier} · Delivered {delivery.deliveryDate}</span></span>
                        <span style={s.deliverySummaryEnd}><StatusBadge status="Received" /><span style={s.deliveryExpandIcon}>{expandedDeliveryId === delivery.id ? '−' : '+'}</span></span>
                      </button>
                      {expandedDeliveryId === delivery.id && (
                        <div style={s.deliveryExpanded}>
                          <div style={s.deliveryDetailsGrid}>
                            <div><span style={s.purchaseViewInfoLabel}>Received By</span><strong style={s.purchaseViewInfoValue}>{delivery.receivedBy}</strong></div>
                            <div><span style={s.purchaseViewInfoLabel}>Delivery Date</span><strong style={s.purchaseViewInfoValue}>{delivery.deliveryDate}</strong></div>
                            <div><span style={s.purchaseViewInfoLabel}>Order Date</span><strong style={s.purchaseViewInfoValue}>{delivery.orderDate || '—'}</strong></div>
                            <div><span style={s.purchaseViewInfoLabel}>Expected Delivery</span><strong style={s.purchaseViewInfoValue}>{delivery.expected || '—'}</strong></div>
                          </div>
                          <div style={s.deliveryItems}>
                            <strong style={s.deliverySectionLabel}>Order Items</strong>
                            {delivery.lines?.map(([name, quantity, unit, unitCost]) => (
                              <div key={name} style={s.deliveryItem}>
                                <span>{name}</span>
                                <span>{quantity} {unit} · ₱{(quantity * unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                          </div>
                          <div style={s.deliveryTotal}><strong>Total Amount</strong><strong>₱{(delivery.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                          {delivery.notes && <div style={s.deliveryNotes}><span style={s.purchaseViewInfoLabel}>Notes / Discrepancies</span><span>{delivery.notes}</span></div>}
                          {delivery.receiptPhoto ? (
                            <div style={s.deliveryReceipt}>
                              <img src={delivery.receiptPhoto.url} alt={delivery.receiptPhoto.name} style={s.deliveryReceiptImage} />
                              <div style={s.deliveryReceiptInfo}><span style={s.purchaseViewInfoLabel}>Receipt Photo</span><strong>{delivery.receiptPhoto.name}</strong><button type="button" style={s.viewReceiptButton} onClick={() => { setShowDeliveries(false); setShowReceipt(delivery.receiptPhoto); }}>View full receipt</button></div>
                            </div>
                          ) : <div style={s.noReceipt}>No receipt attached</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={s.deliveryEmpty}>No deliveries recorded yet. Click Receive Delivery to add a delivery and attach its receipt photo.</div>}
            <div style={s.modalFooter}>
              <button type="button" style={s.cancelButton} onClick={() => setShowDeliveries(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div className="inventory-management-content" style={s.page}>
        <div style={s.alert}>
          <span style={s.alertIcon}>!</span>
          <div style={s.alertSummary}><strong>3 items require immediate attention</strong><small style={s.alertSmall}>1 out of stock · 2 critical stock · 0 expired</small></div>
          <button type="button" style={s.alertDetailsButton} onClick={() => setShowAttention(true)}><span><b style={s.alertDetailsLabel}>View affected items</b><small style={s.alertDetailsHint}>See stock levels and suppliers</small></span></button>
        </div>
        <div className="inventory-management-actions" style={s.actionRow}>
          <button type="button" className="inventory-primary-action" style={s.primaryButton} onClick={() => { setFormNotice(''); setShowAddItem(true); }}><span style={s.actionIcon}>{Icons.plus}</span> Add Item</button>
          <button type="button" className="inventory-secondary-action" style={s.secondaryButton} onClick={() => setShowDeliveries(true)} aria-expanded={showDeliveries}><span style={s.actionIcon}>{Icons.archive}</span> Recent Deliveries</button>
          <div style={s.exportWrap}>
            <button type="button" className="inventory-secondary-action" style={s.secondaryButton} onClick={() => { setShowExportMenu(previous => !previous); setSelectedExportReport(null); }}><span style={s.actionIcon}>▣</span> Export Report</button>
            {showExportMenu && (
              <div style={s.exportMenu}>
                <div style={s.exportMenuTitle}>Choose report type</div>
                {EXPORT_REPORT_TYPES.map(report => (
                  <button type="button" key={report.id} style={{ ...s.exportOption, ...(selectedExportReport === report.id ? s.exportOptionActive : {}) }} onClick={() => setSelectedExportReport(report.id)}>
                    <strong style={s.exportOptionLabel}>{report.label}</strong>
                    <small style={s.exportOptionDescription}>{report.description}</small>
                  </button>
                ))}
                {selectedExportReport && (
                  <div style={s.exportFormatSection}>
                    <div style={s.exportMenuTitle}>Export {getReportTitle(selectedExportReport)} as</div>
                    <div style={s.exportFormatRow}>
                      <button type="button" style={s.exportFormatButton} onClick={() => { downloadInventoryCsv(selectedExportReport); setShowExportMenu(false); setSelectedExportReport(null); }}>CSV</button>
                      <button type="button" style={s.exportFormatButton} onClick={() => { downloadInventoryPdf(selectedExportReport); setShowExportMenu(false); setSelectedExportReport(null); }}>PDF</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="inventory-management-tabs" style={s.tabsNav}>{['Overview', 'All Items', 'Medications', 'Vaccines', 'Supplies', 'Purchase Orders', 'Suppliers', 'Stock Movement'].map(item => <button type="button" key={item} onClick={() => setActiveTab(item)} style={{ ...s.navTab, ...(activeTab === item ? s.navTabActive : {}) }}>{item}</button>)}</div>
        {activeTab === 'Purchase Orders' && (
          <section style={s.purchaseOrdersPage}>
            <div style={s.purchaseOrderToolbar}>
              <div style={s.purchaseOrderTitle}>Purchase Orders</div>
              <button type="button" style={s.newPurchaseOrderButton} onClick={() => { setFormNotice(''); setShowPurchaseOrder(true); }}><span style={s.purchaseOrderPlus}>+</span> New Purchase Order</button>
            </div>
            <div style={s.purchaseOrderFilterBar}>
              <div style={s.purchaseOrderFilters}>
                {[
                  ['all', 'Draft', 'Pending Approval', 'Approved', 'Partially Received', 'Received', 'Cancelled'].map(value => [
                    value,
                    value === 'all' ? 'All' : value,
                    value === 'all' ? PURCHASE_ORDER_TABLE_DATA.length : PURCHASE_ORDER_TABLE_DATA.filter(order => order.status === value).length,
                  ])
                ].flat().map(([value, label, count]) => (
                  <button key={value} type="button" onClick={() => setPurchaseOrderFilter(value)} style={{ ...s.purchaseOrderFilter, ...(purchaseOrderFilter === value ? s.purchaseOrderFilterActive : {}), ...(value === 'Draft' ? s.purchaseOrderFilterDraft : {}), ...(value === 'Pending Approval' ? s.purchaseOrderFilterPending : {}), ...(value === 'Approved' ? s.purchaseOrderFilterApproved : {}), ...(value === 'Partially Received' ? s.purchaseOrderFilterPartial : {}), ...(value === 'Received' ? s.purchaseOrderFilterDelivered : {}), ...(value === 'Cancelled' ? s.purchaseOrderFilterCancelled : {}) }}>
                    {label} <small style={s.purchaseOrderFilterCount}>({count})</small>
                  </button>
                ))}
              </div>
            </div>
            <div style={s.purchaseOrderTableWrap}>
              <table style={s.purchaseOrderTable}>
                <thead><tr>{['PO Number', 'Supplier', 'Requested By', 'Order Date', 'Expected', 'Received', 'Items', 'Total', 'Status', 'Actions'].map(label => <th key={label} style={{ ...s.purchaseOrderTableHead, ...(label === 'Actions' ? s.purchaseOrderActionsHead : {}) }}>{label}</th>)}</tr></thead>
                <tbody>{PURCHASE_ORDER_TABLE_DATA.filter(order => purchaseOrderFilter === 'all' || order.status === purchaseOrderFilter).map(order => (
                  <tr key={order.order}>
                    <td style={s.purchaseOrderTableCell}><button type="button" style={s.purchaseOrderLink}>{order.order}</button></td>
                    <td style={s.purchaseOrderTableCell}>{order.supplier}</td>
                    <td style={{ ...s.purchaseOrderTableCell, ...s.purchaseOrderMuted }}>{order.requestedBy}</td>
                    <td style={{ ...s.purchaseOrderTableCell, ...s.purchaseOrderMuted }}>{formatInventoryDate(order.date)}</td>
                    <td style={{ ...s.purchaseOrderTableCell, ...s.purchaseOrderMuted }}>{formatInventoryDate(order.expected)}</td>
                    <td style={{ ...s.purchaseOrderTableCell, ...s.purchaseOrderMuted }}>{formatInventoryDate(order.received)}</td>
                    <td style={s.purchaseOrderTableCell}>{order.items}</td>
                    <td style={s.purchaseOrderTableCell}><strong>₱{order.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
                    <td style={s.purchaseOrderTableCell}><StatusBadge status={order.status} /></td>
                    <td style={{ ...s.purchaseOrderTableCell, ...s.purchaseOrderActionsCell }}><div style={s.purchaseOrderActions}>
                      <button type="button" style={s.purchaseOrderAction} onClick={() => { setOpenPurchaseOrderActions(''); setViewPurchaseOrder(order); }}>{Icons.eye}<span>View</span></button>
                      <div style={s.purchaseOrderMoreWrap}>
                        <button type="button" style={s.purchaseOrderMoreButton} aria-label={`More actions for ${order.order}`} aria-expanded={openPurchaseOrderActions === order.order} onClick={() => setOpenPurchaseOrderActions(previous => previous === order.order ? '' : order.order)}>...</button>
                        {openPurchaseOrderActions === order.order && (
                          <div style={s.purchaseOrderActionMenu}>
                            {PURCHASE_ORDER_ACTIONS.map(action => <button key={action} type="button" style={{ ...s.purchaseOrderMenuItem, ...(action === 'Cancel' ? s.purchaseOrderCancelAction : action === 'Approve' ? s.purchaseOrderApproveAction : {}) }} onClick={() => {
                              setOpenPurchaseOrderActions('');
                              if (action === 'Receive' || action === 'Receive Remaining') {
                                setReceivePurchaseOrder(order);
                                setReceiptPhoto(null);
                                setShowReceiveDelivery(true);
                              }
                              else {
                                setNotification(`${order.order} ${action.toLowerCase()} action selected`);
                                window.setTimeout(() => setNotification(''), 2500);
                              }
                            }}><span style={s.purchaseOrderMenuIcon}>{action === 'Approve' ? Icons.check : action === 'Cancel' ? Icons.xCircle : action === 'Receive' || action === 'Receive Remaining' ? Icons.archive : action === 'Submit' ? Icons.send : Icons.copy}</span><span>{action}</span></button>)}
                          </div>
                        )}
                      </div>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
        {activeTab === 'Suppliers' && (
          <section style={s.suppliersSection}>
            <div style={s.suppliersToolbar}><h2 style={s.suppliersTitle}>Suppliers</h2><button type="button" style={s.addSupplierButton} onClick={() => setShowAddSupplier(true)}><span style={s.purchaseOrderPlus}>+</span> Add Supplier</button></div>
            <div style={s.suppliersGrid}>
            {supplierCards.map(supplier => (
              <article key={supplier.name} style={s.supplierCard}>
                <div style={s.supplierHeading}>
                  <div><strong style={s.supplierName}>{supplier.name}</strong><small style={s.supplierId}>{supplier.id}</small></div>
                </div>
                <div style={s.supplierDetails}>
                  <span><i style={s.supplierDetailIcon}>{Icons.user}</i>{supplier.contact}</span>
                  <span><i style={s.supplierDetailIcon}>{Icons.mail}</i>{supplier.email}</span>
                  <span><i style={s.supplierDetailIcon}>{Icons.phone}</i>{supplier.phone}</span>
                  <span><i style={s.supplierDetailIcon}>{Icons.location}</i>{supplier.address}</span>
                </div>
                <div style={s.supplierProductsLabel}>Products supplied:</div>
                <div style={s.supplierProducts}>{supplier.products.map(product => <span key={product} style={s.supplierProductsChip}>{product}</span>)}</div>
              </article>
            ))}
            </div>
          </section>
        )}
        {activeTab === 'Stock Movement' && (
          <section style={s.stockMovementSection}>
            <div style={s.stockMovementHeader}>
              <h2 style={s.stockMovementTitle}>Stock Movement Log</h2>
              <span style={s.stockMovementCount}>12 of 12 records</span>
            </div>
            <div style={s.stockMovementFilters}>
              <div style={s.stockMovementSearch}><span>{Icons.search}</span><input style={s.stockMovementSearchInput} value={movementSearch} onChange={event => setMovementSearch(event.target.value)} placeholder="Search movements..." /></div>
              <select value={movementType} onChange={event => setMovementType(event.target.value)} style={s.stockMovementFilter}><option>All Movements</option>{[...new Set(STOCK_MOVEMENT_DISPLAY_DATA.map(row => row[3]))].map(type => <option key={type}>{type}</option>)}</select>
              <select value={movementItem} onChange={event => setMovementItem(event.target.value)} style={s.stockMovementFilter}><option>All Items</option>{[...new Set(STOCK_MOVEMENT_DISPLAY_DATA.map(row => row[1]))].map(item => <option key={item}>{item}</option>)}</select>
              <select value={movementStaff} onChange={event => setMovementStaff(event.target.value)} style={s.stockMovementFilter}><option>All Staff</option>{[...new Set(STOCK_MOVEMENT_DISPLAY_DATA.map(row => row[8]))].map(staff => <option key={staff}>{staff}</option>)}</select>
              <LabDateTimePicker mode="date" label="Filter by date" style={s.stockMovementDateFilter} />
            </div>
            <div style={s.stockMovementTableWrap}>
              <table style={s.stockMovementTable}>
                <thead><tr>{['Date & Time', 'Item', 'Movement Type', 'Quantity', 'Balance After', 'Reference', 'Reason', 'Performed By', ''].map(label => <th key={label} style={s.stockMovementTableHead}>{label}</th>)}</tr></thead>
                <tbody>{STOCK_MOVEMENT_DISPLAY_DATA.filter(row => {
                  const searchable = row.join(' ').toLowerCase();
                  return (!movementSearch || searchable.includes(movementSearch.toLowerCase()))
                    && (movementType === 'All Movements' || row[3] === movementType)
                    && (movementItem === 'All Items' || row[1] === movementItem)
                    && (movementStaff === 'All Staff' || row[8] === movementStaff);
                }).map(([date, name, id, type, quantity, balance, reference, reason, performedBy], index) => (
                  <tr key={`${id}-${date}`}>
                    <td style={s.stockMovementTableCell}>{formatInventoryDate(date)}</td>
                    <td style={s.stockMovementTableCell}><strong style={s.stockMovementItem}>{name}</strong><small style={s.stockMovementId}>{id}</small></td>
                    <td style={s.stockMovementTableCell}><span style={{ ...s.stockMovementBadge, ...(type.includes('Stock In') ? s.stockInBadge : type.includes('Stock Count') ? s.stockCountBadge : type === 'Return to Supplier' ? s.stockReturnBadge : s.stockOutBadge) }}>{type}</span></td>
                    <td style={{ ...s.stockMovementTableCell, ...s.stockMovementQuantity, color: quantity.startsWith('+') ? '#16a34a' : quantity.startsWith('±') ? '#f97316' : '#ef1d2d' }}>{quantity} <small>{balance.split(' ').slice(1).join(' ')}</small></td>
                    <td style={s.stockMovementTableCell}>{balance}</td>
                    <td style={s.stockMovementReference}>{reference}</td>
                    <td style={s.stockMovementTableCell}>{reason}</td>
                    <td style={s.stockMovementTableCell}>{performedBy}</td>
                    <td style={s.stockMovementInfo}><button type="button" style={s.stockMovementInfoButton} aria-label={`View details for ${name}`} onClick={() => setMovementDetail({ date, name, id, type, quantity, balance, reference, reason, performedBy, movementId: `SM-${String(index + 1).padStart(3, '0')}` })}>{Icons.info}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
        {['All Items', 'Medications', 'Vaccines', 'Supplies'].includes(activeTab) && (
          <section className="inventory-items-section" style={s.itemsSection}>
            <div style={s.itemsTableWrap}>
              <table className="inventory-items-table" style={s.itemsTable}>
                <thead><tr>{['Item', 'Batch / Lot', 'Category', 'Stock', 'Reorder', 'Expiry', 'Supplier', 'Status', 'Value', 'Actions'].map(label => <th key={label} style={s.itemsTableHeadCell}>{label}</th>)}</tr></thead>
                <tbody>{inventoryItems.filter(item => activeTab === 'All Items' || item.category === activeTab).map(item => (
                  <tr key={item.id}>
                    <td style={s.itemsTableCell}><div style={s.itemCell}><span style={{ ...s.itemTypeIcon, color: item.category === 'Vaccines' ? '#8b5cf6' : item.category === 'Laboratory' ? '#f59e0b' : item.category === 'Supplies' ? '#64748b' : '#005447' }}>{item.category === 'Vaccines' ? Icons.syringe : item.category === 'Laboratory' ? Icons.activity : item.category === 'Supplies' ? Icons.archive : Icons.pill}</span><div><strong style={s.itemName}>{item.name}</strong><small style={s.itemId}>{item.subtitle}</small></div></div></td>
                    <td style={s.itemsTableCell}><span style={s.batchLot}>{item.batch}</span><small style={s.itemId}>{item.lot}</small></td>
                    <td style={s.itemsTableCell}><span style={s.categoryBadge}>{item.category === 'Medications' ? 'Medication' : item.category === 'Vaccines' ? 'Vaccine' : item.category === 'Supplies' ? 'Supply' : 'Laboratory'}</span></td>
                    <td style={s.itemsTableCell}><strong style={{ color: item.status === 'Out of Stock' ? '#dc2626' : ['Low Stock', 'Critical Stock', 'Reorder Soon'].includes(item.status) ? '#d97706' : '#374151' }}>{item.quantity} {item.unit} </strong><small style={s.stockMeta}>~{Math.max(2, Math.round(item.quantity / 8))}w left</small></td>
                    <td style={s.itemsTableCell}>{item.reorderLevel} {item.unit}</td>
                    <td style={s.itemsTableCell}><span style={item.expiry.includes('Expired') || item.expiry.includes('d)') ? s.expiryWarning : s.expiryDate}>{formatInventoryDate(item.expiry)}</span></td>
                    <td style={s.itemsTableCell}>{item.supplier}</td>
                    <td style={s.itemsTableCell}><StatusBadge status={item.status} /></td>
                    <td style={s.itemsTableCell}>₱{item.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td style={s.itemsTableCell}><div style={s.rowActions}><button type="button" style={s.rowAction} aria-label={`View ${item.name}`} onClick={() => setViewInventoryItem(item)}>{Icons.eye}</button><button type="button" style={s.rowAction} aria-label={`Edit ${item.name}`} onClick={() => setEditInventoryItem(item)}>{Icons.edit}</button><button type="button" style={{ ...s.rowAction, color: '#16a34a' }} aria-label={`Restock ${item.name}`} onClick={() => setRestockInventoryItem(item)}>{Icons.refresh}</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Overview' && <div style={s.stats}>
          <StatCard label="Total Items" value="14" detail="" color="#005447" />
          <StatCard label="Inventory Value" value="₱32,094.00" detail="" color="#16a34a" />
          <StatCard label="Low Stock" value="4" detail="" color="#d97706" />
          <StatCard label="Out of Stock" value="1" detail="" color="#dc2626" />
          <StatCard label="Today's Dispensed" value="27" detail="" color="#9333ea" />
          <StatCard label="Pending POs" value="2" detail="" color="#64748b" />
        </div>}

        {activeTab === 'Overview' && <div style={s.chartGrid}>
          <section style={s.card}>
            <div style={s.cardHeader}><div><h2 style={s.cardTitle}>Monthly Inventory Usage</h2></div><span style={s.legend}>— Medications &nbsp;— Vaccines &nbsp;— Supplies</span></div>
            <div style={{ height: 245 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={INVENTORY_USAGE} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#dbe3ee" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#94a3b8' }} /><YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#94a3b8' }} /><Tooltip content={<UsageTooltip />} /><Line type="monotone" dataKey="medications" stroke="#139b76" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="vaccines" stroke="#8b5cf6" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="supplies" stroke="#10b981" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
          </section>
          <section style={s.card}>
            <div style={s.cardHeader}><div><h2 style={s.cardTitle}>Value by Category</h2></div></div>
            <div style={s.categoryChart}>
              <ResponsiveContainer width="100%" height={205}>
                <PieChart>
                  <Tooltip
                    formatter={(value, name) => [`₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, name]}
                    contentStyle={s.categoryTooltip}
                  />
                  <Pie data={CATEGORY_VALUE_DATA} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {CATEGORY_VALUE_DATA.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={s.categoryList}>
              {CATEGORY_VALUE_DATA.map(item => (
                <div key={item.name} style={s.categoryItem}>
                  <span style={s.categoryName}><i style={{ ...s.categoryDot, background: item.color }} />{item.name}</span>
                  <b>₱{item.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</b>
                </div>
              ))}
            </div>
          </section>
        </div>}

        {activeTab === 'Overview' && <><section style={s.card}><div style={s.cardHeader}><h2 style={s.cardTitle}>Top Used Medicines</h2></div><ResponsiveContainer width="100%" height={220}><BarChart data={TOP_USED} layout="vertical" margin={{ top: 0, right: 10, left: 35, bottom: 0 }}><CartesianGrid stroke="#dbe3ee" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={85} /><Tooltip content={<MedicineTooltip />} cursor={{ fill: '#d1d5db', opacity: 0.9 }} /><Bar dataKey="value" fill="#139b76" radius={[0, 4, 4, 0]} barSize={18} /></BarChart></ResponsiveContainer></section>
        <section style={s.card}><div style={s.cardHeader}><h2 style={s.cardTitle}>⚡ Stock Forecasting — Estimated Depletion</h2></div><div style={s.forecastGrid}>{FORECAST_ITEMS.map(([name, remaining, days, usage]) => <div key={name} style={{ ...s.forecastCard, ...(days === '~11 days' ? s.forecastWarning : {}) }}><strong>{name}</strong><span>{remaining}</span><b>{days}</b><small>{usage}</small></div>)}</div></section></>}

        {showOrders && <section style={s.card}><div style={s.cardHeader}><div><h2 style={s.cardTitle}>Recent purchase orders</h2><p style={s.cardDescription}>Supplier orders and expected delivery dates.</p></div></div><div style={s.tableWrap}><table style={s.table}><thead><tr><th>Order</th><th>Supplier</th><th>Items</th><th>Total</th><th>Expected</th><th>Status</th></tr></thead><tbody>{INVENTORY_PURCHASE_ORDERS.map((order) => <tr key={order.order}><td><strong>{order.order}</strong></td><td>{order.supplier}</td><td>{order.items}</td><td>${order.total.toLocaleString()}</td><td>{formatInventoryDate(order.expected)}</td><td><StatusBadge status={order.status} /></td></tr>)}</tbody></table></div></section>}
      </div>
      {showAddItem && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAddItem(false); }}>
          <form noValidate style={s.addModal} onSubmit={event => {
            event.preventDefault();
            const requiredFields = [
              ['Item Name', event.currentTarget.elements.itemName.value],
              ['Category', event.currentTarget.elements.category.value],
              ['Supplier', event.currentTarget.elements.supplier.value],
              ['Initial Stock', event.currentTarget.elements.initialStock.value],
              ['Unit', event.currentTarget.elements.unit.value],
              ['Reorder Level', event.currentTarget.elements.reorderLevel.value],
            ];
            const missingFields = requiredFields.filter(([, value]) => !String(value).trim()).map(([label]) => label);
            if (missingFields.length) {
              setFormNotice(`Please complete the required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}.`);
              return;
            }
            const initialStock = Number(event.currentTarget.elements.initialStock.value);
            const reorderLevel = Number(event.currentTarget.elements.reorderLevel.value);
            if (!Number.isFinite(initialStock) || initialStock < 0) {
              setFormNotice('Initial Stock must be a valid number greater than or equal to 0.');
              return;
            }
            if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
              setFormNotice('Reorder Level must be a valid number greater than or equal to 0.');
              return;
            }
            if (Number(event.currentTarget.elements.criticalLevel.value) < 0) {
              setFormNotice('Critical Level cannot be negative.');
              return;
            }
            if (Number(event.currentTarget.elements.purchasePrice.value) < 0 || Number(event.currentTarget.elements.sellingPrice.value) < 0) {
              setFormNotice('Purchase Price and Selling Price cannot be negative.');
              return;
            }
            setFormNotice('');
            setShowAddItem(false);
          }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Add Inventory Item</h2>
                <p style={s.modalSubtitle}>Register a new medication, vaccine, or supply.</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => setShowAddItem(false)} aria-label="Close">×</button>
            </div>
            {formNotice && <div role="alert" style={s.formNotice}>{formNotice}</div>}
            <div style={s.formGrid}>
              <label style={s.formField}>Item Name<span style={s.required}>*</span><input name="itemName" required autoFocus placeholder="e.g., Amoxicillin 500mg" style={s.formInput} /></label>
              <label style={s.formField}>Generic Name<input placeholder="e.g., Amoxicillin Trihydrate" style={s.formInput} /></label>
              <label style={s.formField}>Brand<input placeholder="e.g., Moxamox" style={s.formInput} /></label>
              <label style={s.formField}>Category<span style={s.required}>*</span><select name="category" required defaultValue="" style={s.formInput}><option value="">Select category</option><option>Medication</option><option>Vaccine</option><option>Supply</option><option>Laboratory</option></select></label>
              <label style={s.formField}>Dosage / Form<input placeholder="e.g., 500mg capsule" style={s.formInput} /></label>
              <label style={s.formField}>Supplier<span style={s.required}>*</span><input name="supplier" required placeholder="e.g., PharmVet Co." style={s.formInput} /></label>
              <div style={s.formTriple}>
                <label style={s.formField}>Initial Stock<span style={s.required}>*</span><input name="initialStock" required min="0" type="number" placeholder="e.g., 100" style={s.formInput} /></label>
                <label style={s.formField}>Unit<span style={s.required}>*</span><input name="unit" required placeholder="e.g., tablets" style={s.formInput} /></label>
                <label style={s.formField}>Reorder Level<span style={s.required}>*</span><input name="reorderLevel" required min="0" type="number" placeholder="e.g., 50" style={s.formInput} /></label>
              </div>
              <div style={s.formTriple}>
                <label style={s.formField}>Critical Level<input name="criticalLevel" min="0" type="number" placeholder="e.g., 20" style={s.formInput} /></label>
                <label style={s.formField}>Purchase Price (₱)<input name="purchasePrice" min="0" type="number" step="0.01" placeholder="e.g., 12.50" style={s.formInput} /></label>
                <label style={s.formField}>Selling Price (₱)<input name="sellingPrice" min="0" type="number" step="0.01" placeholder="e.g., 18.00" style={s.formInput} /></label>
              </div>
              <label style={s.formField}>Batch Number<input placeholder="e.g., AMX-2025-A1" style={s.formInput} /></label>
              <label style={s.formField}>Lot Number<input placeholder="e.g., LOT-10284" style={s.formInput} /></label>
              <label style={s.formField}>Expiry Date<LabDateTimePicker mode="date" style={s.formInput} /></label>
              <label style={{ ...s.formField, gridColumn: '1 / -1' }}>Storage Requirements<textarea placeholder="e.g., Store below 25°C, away from moisture" style={s.formTextarea} /></label>
            </div>
            <div style={s.modalFooter}>
              <button type="button" style={s.cancelButton} onClick={() => setShowAddItem(false)}>Cancel</button>
              <button type="submit" style={s.modalSubmit}><span style={s.actionIcon}>{Icons.plus}</span> Add to Inventory</button>
            </div>
          </form>
        </div>
      )}
      {showAttention && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAttention(false); }}>
          <div style={s.attentionModal} role="dialog" aria-modal="true" aria-labelledby="inventory-attention-title">
            <div style={s.modalHeader}>
              <div>
                <h2 id="inventory-attention-title" style={s.modalTitle}>Inventory Attention</h2>
                <p style={s.modalSubtitle}>Review these items before generating a purchase order.</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => setShowAttention(false)} aria-label="Close">×</button>
            </div>
            <div style={s.attentionList}>
              {ATTENTION_ITEMS.map(item => (
                <button key={item.name} type="button" style={s.attentionItem} onClick={() => {
                  setSelectedAttentionItem(item.name);
                  setPurchaseOrder(previous => ({
                    ...previous,
                    supplier: item.supplier,
                    notes: `Please replenish ${item.name}. Current stock: ${item.quantity} ${item.unit.toLowerCase()} remaining. Reorder level: ${item.reorderLevel}.`,
                  }));
                  setShowAttention(false);
                  setShowPurchaseOrder(true);
                }}>
                  <div style={{ ...s.attentionStatus, ...(item.attention === 'Out of stock' ? s.attentionOut : {}) }}>{item.attention === 'Out of stock' ? '!' : '!'}</div>
                  <div style={s.attentionInfo}>
                    <strong>{item.name}</strong>
                    <span style={s.attentionInfoSecondary}>{item.quantity} {item.unit.toLowerCase()} remaining · Reorder level: {item.reorderLevel}</span>
                    <small>{item.supplier} · {item.guidance}</small>
                  </div>
                  <StatusBadge status={item.attention === 'Out of stock' ? 'Out of stock' : 'Critical'} />
                </button>
              ))}
            </div>
            <div style={s.modalFooter}>
              <button type="button" style={s.cancelButton} onClick={() => setShowAttention(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showPurchaseOrder && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowPurchaseOrder(false); }}>
          <form style={s.purchaseModal} onSubmit={async event => {
            event.preventDefault();
            const purchaseOrderId = 'PO-2026-006';
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            try {
              const response = await fetch(`${apiUrl}/purchase-orders/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}) },
                body: JSON.stringify({ ...purchaseOrder, purchaseOrderId }),
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(result.error || 'Purchase order email could not be sent.');
              setShowPurchaseOrder(false);
              setShowOrders(true);
              setNotificationError(false);
              setNotification(`Purchase Order ${purchaseOrderId} sent to ${purchaseOrder.email}`);
              setPurchaseOrder({ supplier: '', email: '', requestedBy: '', expectedDeliveryDate: '', notes: '' });
              setSelectedAttentionItem('');
            } catch (error) {
              setNotificationError(true);
              setNotification(error.message || 'Purchase order email could not be sent.');
            }
            window.setTimeout(() => setNotification(''), 3000);
          }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>New Purchase Order</h2>
                <p style={s.modalSubtitle}>Create a purchase order to request stock replenishment.</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => setShowPurchaseOrder(false)} aria-label="Close">×</button>
            </div>
            <div style={s.purchaseFields}>
              <label style={s.formField}>Supplier<span style={s.required}>*</span><select required value={purchaseOrder.supplier} style={s.formInput} onChange={event => {
                const supplier = supplierCards.find(item => item.name === event.target.value);
                setPurchaseOrder(previous => ({ ...previous, supplier: event.target.value, email: supplier?.email || '' }));
              }}><option value="">Select supplier</option>{supplierCards.map(supplier => <option key={supplier.id}>{supplier.name}</option>)}</select></label>
              {selectedSupplier && <div style={s.supplierDetailsPanel}>
                <div style={s.supplierDetailsTitle}>SUPPLIER DETAILS</div>
                <div style={s.supplierDetailsGrid}>
                  <span><i style={s.purchaseSupplierIcon}>{Icons.user}</i>{selectedSupplier.contact}</span><span><i style={s.purchaseSupplierIcon}>{Icons.mail}</i>{selectedSupplier.email}</span>
                  <span><i style={s.purchaseSupplierIcon}>{Icons.phone}</i>{selectedSupplier.phone}</span><span><i style={s.purchaseSupplierIcon}>{Icons.location}</i>{selectedSupplier.address}</span>
                </div>
              </div>}
              <div style={s.purchaseTwoFields}>
                <label style={s.formField}>Send PO To (Email)<input required type="email" value={purchaseOrder.email} placeholder="supplier@example.com" style={s.formInput} onChange={event => setPurchaseOrder(previous => ({ ...previous, email: event.target.value }))} /></label>
                <label style={s.formField}>CC (Optional)<input placeholder="cc@email.com" style={s.formInput} /></label>
              </div>
              <div style={s.orderItemsHeader}><strong>Order Items</strong><button type="button" style={s.addOrderItemButton} onClick={() => setPurchaseOrderItems(previous => [...previous, { product: '', quantity: 0, unit: 'pieces', unitPrice: '0.00' }])}><span>+</span> Add Item</button></div>
              <div style={s.orderItemLabels}><span>Product</span><span>Qty</span><span>Unit</span><span>Unit Price</span><span>Line Total</span></div>
              {purchaseOrderItems.map((item, index) => <div key={`purchase-item-${index}`} style={s.orderItemRow}>
                <select value={item.product} onChange={event => setPurchaseOrderItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, product: event.target.value } : row))} style={s.orderProductInput}><option value="">Select product</option>{inventoryItems.map(product => <option key={product.id}>{product.name}</option>)}</select>
                <input type="number" min="0" value={item.quantity} onChange={event => setPurchaseOrderItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} style={s.orderQuantityInput} />
                <select value={item.unit} onChange={event => setPurchaseOrderItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, unit: event.target.value } : row))} style={s.orderUnitInput}>{unitOptions.map(unit => <option key={unit}>{unit}</option>)}</select>
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => setPurchaseOrderItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} style={s.orderPriceInput} />
                <span style={s.orderLineTotal}>₱{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}</span>
                <button type="button" style={s.removeOrderItem} disabled={purchaseOrderItems.length === 1} onClick={() => setPurchaseOrderItems(previous => previous.filter((_, rowIndex) => rowIndex !== index))}>×</button>
              </div>)}
              <div style={s.purchaseTwoFields}>
                <label style={s.formField}>Requested By<input required value={purchaseOrder.requestedBy} placeholder="Your name" style={s.formInput} onChange={event => setPurchaseOrder(previous => ({ ...previous, requestedBy: event.target.value }))} /></label>
                <label style={s.formField}>Expected Delivery Date<LabDateTimePicker mode="date" value={purchaseOrder.expectedDeliveryDate} style={s.formInput} onChange={expectedDeliveryDate => setPurchaseOrder(previous => ({ ...previous, expectedDeliveryDate }))} /></label>
              </div>
              <label style={s.formField}>Notes / Special Instructions<textarea value={purchaseOrder.notes} placeholder="Priority items, delivery instructions..." style={s.purchaseTextarea} onChange={event => setPurchaseOrder(previous => ({ ...previous, notes: event.target.value }))} /></label>
            </div>
            <div style={s.modalFooter}>
              <button type="button" style={s.cancelButton} onClick={() => setShowPurchaseOrder(false)}>Cancel</button>
              <button type="button" style={s.saveDraftButton} onClick={() => { setShowPurchaseOrder(false); setNotification('Purchase order saved as draft'); window.setTimeout(() => setNotification(''), 2500); }}><span style={s.actionIcon}>{Icons.copy}</span> Save as Draft</button>
              <button type="submit" style={s.modalSubmit}><span style={s.actionIcon}>{Icons.archive}</span> Create Purchase Order</button>
              <button type="submit" style={s.sendPoButton}><span style={s.actionIcon}>{Icons.send}</span> Create &amp; Send PO</button>
            </div>
          </form>
        </div>
      )}
      {showReceiveDelivery && (
        <div style={s.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setShowReceiveDelivery(false); setReceivePurchaseOrder(null); } }}>
          <form style={s.receiveModal} onSubmit={event => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const purchaseOrder = formData.get('purchaseOrder');
            const receivedBy = formData.get('receivedBy');
            const deliveryDate = formData.get('deliveryDate') || new Date().toISOString().slice(0, 10);
            const notes = formData.get('notes') || '';
            const selectedOrder = PURCHASE_ORDER_TABLE_DATA.find(order => order.order === purchaseOrder);
            setReceivedDeliveries(previous => [{
              id: `${purchaseOrder}-${Date.now()}`,
              purchaseOrder,
              supplier: selectedOrder?.supplier || 'Supplier not specified',
              orderDate: selectedOrder?.date || '—',
              expected: selectedOrder?.expected || '—',
              lines: selectedOrder?.lines || [],
              total: selectedOrder?.total || 0,
              receivedBy,
              deliveryDate,
              notes,
              receiptPhoto,
            }, ...previous]);
            setShowReceiveDelivery(false);
            setReceivePurchaseOrder(null);
            setReceiptPhoto(null);
            setNotificationError(false);
            setNotification('Delivery received and stock updated');
            window.setTimeout(() => setNotification(''), 3000);
          }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Receive Delivery</h2>
                <p style={s.modalSubtitle}>Record incoming stock from a delivered purchase order.</p>
              </div>
              <button type="button" style={s.closeButton} onClick={() => { setShowReceiveDelivery(false); setReceivePurchaseOrder(null); }} aria-label="Close">×</button>
            </div>
            <div style={s.receiveFields}>
              {receivePurchaseOrder ? (
                <>
                  <input type="hidden" name="purchaseOrder" value={receivePurchaseOrder.order} />
                  <div style={s.receiveOrderSummary}>
                    <div style={s.receiveOrderSummaryHeader}>
                      <div>
                        <strong style={s.receiveOrderNumber}>{receivePurchaseOrder.order}</strong>
                        <span style={s.receiveOrderSupplier}>{receivePurchaseOrder.supplier}</span>
                      </div>
                      <StatusBadge status={receivePurchaseOrder.status} />
                    </div>
                    <div style={s.receiveOrderSummaryGrid}>
                      <div><span style={s.purchaseViewInfoLabel}>Order Date</span><strong style={s.purchaseViewInfoValue}>{formatInventoryDate(receivePurchaseOrder.date)}</strong></div>
                      <div><span style={s.purchaseViewInfoLabel}>Expected Delivery</span><strong style={s.purchaseViewInfoValue}>{formatInventoryDate(receivePurchaseOrder.expected)}</strong></div>
                      <div><span style={s.purchaseViewInfoLabel}>Items</span><strong style={s.purchaseViewInfoValue}>{receivePurchaseOrder.items}</strong></div>
                      <div><span style={s.purchaseViewInfoLabel}>Total Amount</span><strong style={s.purchaseViewInfoValue}>₱{receivePurchaseOrder.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                    </div>
                    <div style={s.receiveOrderItems}>
                      {receivePurchaseOrder.lines.map(([name, quantity, unit]) => <div key={name} style={s.receiveOrderItem}><span>{name}</span><strong>{quantity} {unit}</strong></div>)}
                    </div>
                  </div>
                </>
              ) : (
                <label style={s.formField}>Purchase Order<span style={s.required}>*</span><select name="purchaseOrder" required defaultValue="" style={s.formInput}><option value="">Select PO to receive</option>{PURCHASE_ORDER_TABLE_DATA.filter(order => order.status !== 'Received').map(order => <option key={order.order} value={order.order}>{order.order} — {order.supplier}</option>)}</select></label>
              )}
              <label style={s.formField}>Received By<span style={s.required}>*</span><input name="receivedBy" required placeholder="Your name" style={s.formInput} /></label>
              <label style={s.formField}>Delivery Date<LabDateTimePicker name="deliveryDate" mode="date" defaultValue={receivePurchaseOrder?.received !== '—' ? receivePurchaseOrder?.received : new Date().toISOString().slice(0, 10)} style={s.formInput} /></label>
              <label style={s.formField}>Receipt Photo<span style={s.optional}>Optional</span>
                <input type="file" accept="image/*" style={s.fileInput} onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) setReceiptPhoto({ name: file.name, url: URL.createObjectURL(file) });
                }} />
                <span style={s.filePicker}>{receiptPhoto ? 'Replace receipt photo' : 'Add receipt photo'}</span>
              </label>
              {receiptPhoto && <div style={s.receiptPreview}><img src={receiptPhoto.url} alt="Receipt preview" style={s.receiptImage} /><div style={s.receiptDetails}><strong>{receiptPhoto.name}</strong><button type="button" style={s.removeReceipt} onClick={() => setReceiptPhoto(null)}>Remove photo</button></div></div>}
              <label style={{ ...s.formField, gridColumn: '1 / -1' }}>Notes / Discrepancies<textarea name="notes" placeholder="Note any missing or damaged items..." style={s.formTextarea} /></label>
            </div>
            <div style={s.modalFooter}>
              <button type="button" style={s.cancelButton} onClick={() => { setShowReceiveDelivery(false); setReceivePurchaseOrder(null); }}>Cancel</button>
              <button type="submit" style={s.modalSubmit}><span style={s.actionIcon}>{Icons.archive}</span> Confirm Receipt</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const s = {
  main: { minWidth: 0, flex: 1, background: '#f8fafc', overflowY: 'auto' },
  notification: { position: 'fixed', top: 18, right: 24, zIndex: 120, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', boxShadow: '0 8px 24px rgba(15,23,42,.12)', color: '#111827', fontSize: '.78rem', fontWeight: 500 },
  notificationIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: '.68rem', fontWeight: 700 },
  notificationErrorIcon: { background: '#b91c1c' },
  page: { padding: '28px 34px 48px', maxWidth: 1500, margin: '0 auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 },
  title: { margin: 0, color: '#0f172a', fontSize: '1.65rem', letterSpacing: '-.03em' },
  subtitle: { margin: '7px 0 0', color: '#475569', fontSize: '.95rem' },
  actions: { display: 'flex', gap: 10, flexShrink: 0 },
  primaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 34, border: 0, borderRadius: 7, padding: '7px 11px', background: '#005447', color: '#fff', fontSize: '.74rem', fontWeight: 700, lineHeight: 1.2, cursor: 'pointer' },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 7, padding: '6px 10px', background: '#fff', color: '#334155', fontSize: '.74rem', fontWeight: 600, lineHeight: 1.2, cursor: 'pointer' },
  exportWrap: { position: 'relative' },
  exportMenu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, width: 255, padding: 6, border: '1px solid #dbe3ee', borderRadius: 8, background: '#fff', boxShadow: '0 8px 20px rgba(15,23,42,.12)' },
  exportMenuTitle: { padding: '5px 8px 6px', color: '#64748b', fontSize: '.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' },
  exportOption: { display: 'block', width: '100%', border: 0, borderRadius: 5, background: '#fff', color: '#334155', padding: '8px 10px', textAlign: 'left', cursor: 'pointer' },
  exportOptionActive: { background: '#e7f5f2' },
  exportOptionLabel: { display: 'block', fontSize: '.74rem', lineHeight: 1.25 },
  exportOptionDescription: { display: 'block', marginTop: 2, color: '#64748b', fontSize: '.66rem', lineHeight: 1.25 },
  exportFormatSection: { marginTop: 5, paddingTop: 5, borderTop: '1px solid #e2e8f0' },
  exportFormatRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 8px 6px' },
  exportFormatButton: { border: '1px solid #005447', borderRadius: 5, background: '#005447', color: '#fff', padding: '7px 8px', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' },
  actionIcon: { width: 15, height: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 'inherit' },
  alert: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: '1px solid #fecaca', borderRadius: 9, background: '#fff1f2', color: '#b91c1c', marginBottom: 12, fontSize: '.78rem' },
  alertIcon: { width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#ef4444', color: '#fff', fontWeight: 800 },
  alertSmall: { display: 'block', color: '#ef4444', marginTop: 3 },
  alertSummary: { textAlign: 'left', color: 'inherit' },
  alertDetailsButton: { display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', border: '1px solid #fca5a5', borderRadius: 7, background: '#fff', color: '#991b1b', padding: '6px 9px', textAlign: 'left', cursor: 'pointer' },
  alertDetailsLabel: { display: 'block', fontSize: '.7rem', lineHeight: 1.2 },
  alertDetailsHint: { display: 'block', marginTop: 2, color: '#b45309', fontSize: '.61rem', lineHeight: 1.2 },
  alertButton: { marginLeft: 'auto', border: 0, borderRadius: 7, background: '#dc2626', color: '#fff', padding: '8px 12px', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' },
  actionRow: { display: 'flex', gap: 8, marginBottom: 12 },
  tabsNav: { display: 'flex', gap: 2, padding: 4, width: 'fit-content', background: '#eef1f5', borderRadius: 12, marginBottom: 18 },
  navTab: { border: 0, background: 'transparent', borderRadius: 9, padding: '7px 11px', color: '#475569', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' },
  navTabActive: { background: '#fff', color: '#0f1117', boxShadow: '0 1px 3px rgba(15,23,42,.12)' },
  purchaseOrdersPage: { border: '1px solid #dbe3ee', borderRadius: 12, background: '#fff', overflow: 'visible' },
  purchaseOrderToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 20px 18px' },
  purchaseOrderFilterBar: { display: 'flex', alignItems: 'center', padding: '0 20px 14px', borderBottom: '1px solid #dbe3ee' },
  purchaseOrderFilters: { display: 'flex', alignItems: 'center', gap: 8 },
  purchaseOrderFilter: { border: 0, borderRadius: 8, background: '#f1f5f9', color: '#334155', padding: '7px 12px', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' },
  purchaseOrderFilterCount: { fontSize: '.64rem', fontWeight: 600, opacity: .8 },
  purchaseOrderFilterActive: { background: '#1e293b', color: '#fff' },
  purchaseOrderFilterDraft: { background: '#f1f5f9', color: '#475569' },
  purchaseOrderFilterPending: { background: '#fef3c7', color: '#a16207' },
  purchaseOrderFilterApproved: { background: '#d8f4e8', color: '#005447' },
  purchaseOrderFilterPartial: { background: '#f3e8ff', color: '#7e22ce' },
  purchaseOrderFilterDelivered: { background: '#d1fae5', color: '#047857' },
  purchaseOrderFilterCancelled: { background: '#fee2e2', color: '#b91c1c' },
  newPurchaseOrderButton: { display: 'inline-flex', alignItems: 'center', gap: 10, border: 0, borderRadius: 9, background: '#090b1a', color: '#fff', padding: '10px 15px', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' },
  purchaseOrderPlus: { fontSize: '1.1rem', lineHeight: 1, fontWeight: 400 },
  purchaseOrderTableWrap: { overflow: 'visible' },
  purchaseOrderTable: { width: '100%', minWidth: 1100, borderCollapse: 'collapse', color: '#1f2937', fontSize: '.74rem' },
  purchaseOrderTableHead: { padding: '13px 9px', textAlign: 'left', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db', background: '#f8fafc', color: '#1f2937', fontSize: '.7rem', fontWeight: 700, whiteSpace: 'nowrap' },
  purchaseOrderTableCell: { padding: '12px 9px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  purchaseOrderActionsHead: { textAlign: 'center' },
  purchaseOrderActionsCell: { textAlign: 'center' },
  purchaseOrderTitle: { color: '#334155', fontSize: '.86rem', fontWeight: 700 },
  purchaseOrderLink: { border: 0, padding: 0, background: 'transparent', color: '#005447', fontWeight: 600, cursor: 'pointer' },
  purchaseOrderMuted: { color: '#526581' },
  purchaseOrderItems: { display: 'grid', gap: 4, color: '#526581', fontSize: '.7rem' },
  purchaseOrderView: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: 0, background: 'transparent', color: '#526581', cursor: 'pointer' },
  purchaseOrderActions: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  purchaseOrderAction: { display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, padding: 0, background: 'transparent', color: '#334155', fontSize: '.7rem', cursor: 'pointer' },
  purchaseOrderMoreWrap: { position: 'relative' },
  purchaseOrderMoreButton: { width: 20, height: 20, border: '1px solid #cbd5e1', borderRadius: 5, background: '#fff', color: '#475569', fontSize: '.62rem', fontWeight: 800, lineHeight: 1, letterSpacing: 1, cursor: 'pointer' },
  purchaseOrderActionMenu: { position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, zIndex: 30, minWidth: 145, padding: 3, border: '1px solid #dbe3ee', borderRadius: 7, background: '#fff', boxShadow: '0 6px 16px rgba(15,23,42,.12)' },
  purchaseOrderMenuItem: { display: 'flex', alignItems: 'center', gap: 7, width: '100%', minHeight: 25, border: 0, borderRadius: 4, padding: '5px 7px', background: '#fff', color: '#334155', fontSize: '.66rem', textAlign: 'left', cursor: 'pointer' },
  purchaseOrderMenuIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0 },
  purchaseViewModal: { width: 'min(510px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '20px 24px 18px', boxShadow: '0 18px 50px rgba(15,23,42,.22)' },
  purchaseViewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  purchaseViewTitle: { margin: 0, color: '#111827', fontSize: '1.05rem' },
  purchaseViewSubtitle: { margin: '5px 0 0', color: '#64748b', fontSize: '.74rem' },
  purchaseViewStatusRow: { display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' },
  purchaseViewReceived: { color: '#64748b', fontSize: '.7rem' },
  purchaseViewInfo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '14px 13px', borderRadius: 10, background: '#f8fafc' },
  purchaseViewInfoLabel: { display: 'block', color: '#8ca0ba', fontSize: '.67rem' },
  purchaseViewInfoValue: { display: 'block', marginTop: 3, color: '#111827', fontSize: '.74rem' },
  purchaseCancellation: { display: 'grid', gap: 5, marginTop: 14, padding: '13px', border: '1px solid #fecaca', borderRadius: 9, background: '#fff1f2', color: '#dc2626', fontSize: '.7rem' },
  purchaseViewItemsTitle: { margin: '18px 0 8px', color: '#334155', fontSize: '.76rem' },
  purchaseViewItemsTable: { width: '100%', borderCollapse: 'collapse', color: '#1f2937', fontSize: '.7rem' },
  purchaseViewItemsTableHead: { padding: '10px 8px', background: '#f8fafc', textAlign: 'left', fontWeight: 600 },
  purchaseViewItemsTableCell: { padding: '9px 8px', borderBottom: '1px solid #e5e7eb' },
  purchaseViewTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, padding: '15px 13px', borderRadius: 10, background: '#f8fafc', color: '#334155', fontSize: '.78rem' },
  purchaseViewTotalValue: { color: '#1f2937', fontSize: '1.05rem' },
  purchaseViewNotes: { marginTop: 14, color: '#526581', fontSize: '.72rem' },
  purchaseViewNotesLabel: { display: 'block', color: '#8ca0ba', marginBottom: 4 },
  purchaseViewNotesText: { margin: 0 },
  purchaseViewFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: 16 },
  inventoryViewModal: { width: 'min(620px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '22px 24px 20px', boxShadow: '0 18px 50px rgba(15,23,42,.22)', color: '#111827' },
  inventoryViewHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  inventoryViewTitle: { margin: 0, color: '#111827', fontSize: '1.05rem' },
  inventoryViewSubtitle: { margin: '5px 0 0', color: '#7c8495', fontSize: '.76rem' },
  inventoryViewStats: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 18 },
  inventoryViewStatsItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 88, padding: '10px 8px', boxSizing: 'border-box', borderRadius: 10, background: '#f8fafc', textAlign: 'center' },
  inventoryViewStatsLabel: { color: '#8ca0ba', fontSize: '.68rem' },
  inventoryViewStatsValue: { display: 'block', marginTop: 4, fontSize: '1.45rem', lineHeight: 1.05, fontWeight: 700 },
  inventoryViewStatsUnit: { marginTop: 3, color: '#526581', fontSize: '.7rem' },
  inventoryViewInfo: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32, rowGap: 13, marginTop: 18, color: '#1f2937', fontSize: '.74rem' },
  inventoryViewInfoItem: { minWidth: 0, lineHeight: 1.25 },
  inventoryViewInfoLabel: { display: 'block', marginBottom: 4, color: '#8ca0ba', fontSize: '.68rem' },
  inventoryExpiryWarning: { display: 'inline-block', padding: '2px 5px', borderRadius: 4, background: '#fff1f2', color: '#dc2626' },
  inventoryMovementsTitle: { marginTop: 19, color: '#526581', fontSize: '.74rem' },
  inventoryMovements: { display: 'grid', gap: 8, marginTop: 8 },
  inventoryMovement: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, background: '#f8fafc', color: '#334155', fontSize: '.72rem' },
  inventoryMovementInfo: { display: 'grid', gap: 3, minWidth: 0 },
  inventoryViewFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 0 },
  editInventoryModal: { width: 'min(600px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '22px 24px 22px', boxShadow: '0 18px 50px rgba(15,23,42,.22)' },
  editInventoryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 12 },
  editInventoryTriple: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 },
  editInventoryTextarea: { display: 'block', width: '100%', minHeight: 64, boxSizing: 'border-box', marginTop: 5, resize: 'vertical', border: 0, borderRadius: 8, padding: '10px 12px', background: '#f1f1f4', color: '#6f7788', font: 'inherit', fontSize: '.78rem', outline: 'none' },
  restockModal: { width: 'min(395px, calc(100vw - 48px))', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '20px 20px 22px', boxShadow: '0 18px 50px rgba(15,23,42,.22)' },
  restockSummary: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '17px 0 15px', padding: '13px 12px', borderRadius: 9, background: '#f8fafc' },
  restockSummaryItem: { display: 'grid', gap: 3, minWidth: 0 },
  restockSummaryLabel: { color: '#8ca0ba', fontSize: '.68rem' },
  restockSummaryValue: { color: '#1f2937', fontSize: '.72rem' },
  restockQuantityInput: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '2px solid #9ca3af', borderRadius: 9, padding: '9px 11px', background: '#f8f8fa', color: '#1f2937', fontSize: '.78rem', outline: 'none' },
  restockFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  purchaseOrderApproveAction: { color: '#16a34a' },
  purchaseOrderCancelAction: { color: '#ef1d2d' },
  suppliersSection: { display: 'grid', gap: 14 },
  suppliersToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  suppliersTitle: { margin: 0, color: '#1f2937', fontSize: '1rem' },
  addSupplierButton: { display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 7, padding: '8px 12px', background: '#07051f', color: '#fff', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' },
  suppliersGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 },
  supplierCard: { minWidth: 0, padding: '17px 20px 20px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', boxShadow: '0 2px 4px rgba(15,23,42,.08)' },
  supplierHeading: { display: 'flex', alignItems: 'center', marginBottom: 13 },
  supplierName: { display: 'block', color: '#273449', fontSize: '.82rem' },
  supplierId: { display: 'block', marginTop: 5, color: '#64748b', fontSize: '.65rem' },
  supplierDetails: { display: 'grid', gap: 7, marginBottom: 13, color: '#475569', fontSize: '.67rem' },
  supplierDetailIcon: { width: 13, height: 13, display: 'inline-flex', verticalAlign: 'middle', marginRight: 5 },
  supplierProductsLabel: { marginBottom: 5, color: '#64748b', fontSize: '.66rem', fontWeight: 600 },
  supplierProducts: { display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 23, marginBottom: 13 },
  supplierProductsChip: { border: '1px solid #e2e8f0', borderRadius: 999, padding: '3px 6px', background: '#fff', color: '#334155', fontSize: '.61rem' },
  addSupplierModal: { width: 'min(560px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '22px 24px 22px', boxShadow: '0 18px 50px rgba(15,23,42,.22)' },
  addSupplierGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 14, rowGap: 12 },
  supplierCart: { width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  stockMovementSection: { border: '1px solid #dbe3ee', borderRadius: 12, background: '#fff', overflow: 'hidden' },
  stockMovementHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '17px 20px 12px' },
  stockMovementTitle: { margin: 0, color: '#526581', fontSize: '.82rem' },
  stockMovementCount: { color: '#8ca0ba', fontSize: '.7rem' },
  stockMovementFilters: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '0 20px 18px' },
  stockMovementSearch: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '8px 10px', borderRadius: 8, background: '#f1f1f4', color: '#8ca0ba' },
  stockMovementSearchInput: { width: '100%', minWidth: 0, border: 0, outline: 'none', padding: 0, background: 'transparent', color: '#334155', fontSize: '.72rem', fontFamily: 'inherit' },
  stockMovementFilter: { minWidth: 0, border: 0, borderRadius: 8, padding: '8px 10px', background: '#f1f1f4', color: '#334155', fontSize: '.72rem', outline: 'none' },
  stockMovementDateFilter: { minWidth: 0, border: 0, borderRadius: 8, padding: '8px 10px', background: '#f1f1f4', color: '#334155', fontSize: '.72rem', outline: 'none' },
  stockMovementTableWrap: { overflowX: 'auto', padding: '0 0 5px' },
  stockMovementTable: { width: '100%', minWidth: 1180, borderCollapse: 'collapse', color: '#4b5563', fontSize: '.68rem' },
  stockMovementTableHead: { padding: '11px 8px', background: '#f8fafc', borderTop: '1px solid #eef2f7', borderBottom: '1px solid #dbe3ee', color: '#334155', fontSize: '.68rem', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' },
  stockMovementTableCell: { padding: '9px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', verticalAlign: 'middle', color: '#4b5563' },
  stockMovementItem: { display: 'block', color: '#334155', fontSize: '.7rem' },
  stockMovementId: { display: 'block', marginTop: 2, color: '#64748b', fontSize: '.62rem' },
  stockMovementBadge: { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 8px', fontSize: '.62rem', fontWeight: 700, whiteSpace: 'nowrap' },
  stockInBadge: { background: '#d1fae5', color: '#16a34a' },
  stockOutBadge: { background: '#fee2e2', color: '#ef1d2d' },
  stockCountBadge: { background: '#ffedd5', color: '#c2410c' },
  stockReturnBadge: { background: '#f3e8ff', color: '#9333ea' },
  stockMovementQuantity: { fontWeight: 700 },
  stockMovementReference: { padding: '9px 8px', borderBottom: '1px solid #e5e7eb', color: '#005447', whiteSpace: 'nowrap' },
  stockMovementInfo: { padding: '9px 8px', borderBottom: '1px solid #e5e7eb', color: '#64748b', fontSize: '.82rem', textAlign: 'center' },
  stockMovementInfoButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, border: 0, padding: 0, background: 'transparent', color: '#64748b', lineHeight: 1, cursor: 'pointer' },
  itemsSection: { border: '1px solid #dbe3ee', borderRadius: 10, background: '#fff', overflow: 'hidden', marginBottom: 20 },
  itemsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '18px 20px', borderBottom: '1px solid #e2e8f0' },
  itemsTitle: { margin: 0, color: '#0f172a', fontSize: '1.05rem' },
  itemsSubtitle: { margin: '5px 0 0', color: '#64748b', fontSize: '.76rem' },
  itemsHeaderActions: { display: 'flex', alignItems: 'center', gap: 8 },
  itemsSearch: { width: 190, border: '1px solid #cbd5e1', borderRadius: 7, padding: '8px 10px', color: '#0f172a', fontSize: '.74rem', outline: 'none' },
  filterButton: { border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#475569', padding: '8px 11px', fontSize: '.74rem', cursor: 'pointer' },
  itemsTableWrap: { overflowX: 'auto' },
  itemsTable: { width: '100%', borderCollapse: 'collapse', minWidth: 1120, color: '#374151', fontSize: '.72rem' },
  itemsTableHeadCell: { padding: '11px 10px', borderBottom: '1px solid #cbd5e1', color: '#374151', fontSize: '.64rem', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase' },
  itemsTableCell: { padding: '10px', borderBottom: '1px solid #d1d5db', whiteSpace: 'nowrap', verticalAlign: 'middle', color: '#374151' },
  itemCell: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 190 },
  itemTypeIcon: { width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  itemName: { display: 'block', color: '#1e293b', fontSize: '.74rem' },
  itemId: { display: 'block', marginTop: 2, color: '#64748b', fontSize: '.64rem' },
  batchLot: { display: 'block', color: '#4b5563', fontSize: '.67rem' },
  categoryBadge: { display: 'inline-block', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 7px', color: '#334155', background: '#fff', fontSize: '.65rem' },
  stockMeta: { display: 'block', marginTop: 2, color: '#6b7280', fontSize: '.63rem' },
  expiryDate: { color: '#4b5563' },
  expiryWarning: { display: 'inline-block', borderRadius: 4, padding: '3px 5px', background: '#fee2e2', color: '#dc2626', fontSize: '.64rem', fontWeight: 700 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 8 },
  rowAction: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, border: 0, background: 'transparent', padding: 0, color: '#64748b', cursor: 'pointer' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  statCard: { position: 'relative', overflow: 'hidden', padding: '16px 14px 15px 18px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' },
  statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  statLabel: { color: '#64748b', fontSize: '.7rem', fontWeight: 600 },
  statValue: { color: '#0f172a', fontSize: '1.28rem', fontWeight: 800, marginTop: 7, whiteSpace: 'nowrap' },
  statDetail: { color: '#64748b', fontSize: '.7rem', marginTop: 5 },
  chartGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 20, marginBottom: 20 },
  card: { border: '1px solid #dbe3ee', borderRadius: 10, background: '#fff', padding: 20, marginBottom: 20 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  cardTitle: { margin: 0, color: '#0f172a', fontSize: '1.02rem' },
  cardDescription: { margin: '5px 0 0', color: '#64748b', fontSize: '.82rem' },
  legend: { display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: '.72rem', whiteSpace: 'nowrap' },
  usageTooltip: { minWidth: 118, padding: '7px 9px', border: '1px solid #dbe3ee', borderRadius: 5, background: '#fff', boxShadow: '0 2px 7px rgba(15,23,42,.1)', fontSize: '.68rem' },
  usageTooltipLabel: { color: '#0f172a', fontSize: '.7rem', fontWeight: 600, marginBottom: 4 },
  usageTooltipRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, lineHeight: 1.35 },
  medicineTooltip: { minWidth: 108, padding: '9px 11px', border: '1px solid #dbe3ee', borderRadius: 0, background: '#fff', boxShadow: '0 2px 5px rgba(15,23,42,.08)', fontSize: '.72rem' },
  medicineTooltipName: { color: '#0f172a', fontSize: '.78rem', marginBottom: 7 },
  medicineTooltipValue: { color: '#005447', fontSize: '.75rem' },
  health: { display: 'flex', alignItems: 'center', gap: 30, padding: '24px 12px 20px' },
  donut: { width: 138, height: 138, borderRadius: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '18px solid #22c55e', outline: '12px solid #dcfce7', flexShrink: 0 },
  donutValue: { color: '#166534', fontSize: '1.65rem' },
  donutLabel: { color: '#64748b', fontSize: '.75rem' },
  healthList: { display: 'grid', gap: 14 },
  healthItem: { display: 'flex', alignItems: 'center', gap: 9 },
  healthNumber: { width: 22, fontSize: '1.2rem' },
  healthLabel: { color: '#475569', fontSize: '.84rem' },
  forecast: { display: 'flex', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '.8rem' },
  categoryChart: { height: 205, marginTop: -4 },
  categoryTooltip: { border: '1px solid #dbe3ee', borderRadius: 0, background: '#fff', color: '#0f172a', fontSize: '.78rem', boxShadow: 'none' },
  categoryList: { display: 'grid', gap: 7, color: '#64748b', fontSize: '.72rem' },
  categoryItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryName: { display: 'flex', alignItems: 'center', gap: 7 },
  categoryDot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
  forecastGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 },
  forecastCard: { display: 'grid', gap: 4, padding: '13px 12px', border: '1px solid #dbe3ee', borderRadius: 10, background: '#f8fafc', color: '#1e293b', fontSize: '.72rem' },
  forecastWarning: { borderColor: '#fcd34d', background: '#fffbeb' },
  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  search: { width: 230, border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', color: '#0f172a', outline: 'none' },
  tabs: { display: 'flex', gap: 7, borderBottom: '1px solid #e2e8f0', margin: '18px -20px 0', padding: '0 20px' },
  tab: { border: 0, borderBottom: '2px solid transparent', background: 'transparent', color: '#64748b', padding: '10px 4px', marginRight: 16, fontWeight: 600, cursor: 'pointer' },
  activeTab: { color: '#005447', borderBottomColor: '#005447' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: '.82rem', color: '#475569' },
  tableHeaderCell: { textAlign: 'left', color: '#64748b', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em', padding: '13px 10px', borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap' },
  tableCell: { padding: '14px 10px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  itemName: { color: '#0f172a' },
  itemMeta: { display: 'block', color: '#94a3b8', fontSize: '.7rem', marginTop: 3 },
  badge: { display: 'inline-block', borderRadius: 999, padding: '4px 8px', fontSize: '.7rem', fontWeight: 700 },
  noResults: { padding: 28, textAlign: 'center', color: '#64748b' },
  empty: { padding: 40, border: '1px solid #dbe3ee', borderRadius: 10, background: '#fff', color: '#475569' },
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(15, 23, 42, .5)' },
  movementDetailModal: { width: 'min(460px, calc(100vw - 40px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 10, padding: '20px 20px 18px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  movementDetailSummary: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 11px', marginBottom: 15, border: '1px solid #dbe3ee', borderRadius: 8, background: '#f8fafc', fontSize: '.76rem' },
  movementDetailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', color: '#334155', fontSize: '.74rem' },
  movementDetailGridCell: { display: 'grid', gap: 3, minWidth: 0 },
  movementDetailLabel: { color: '#64748b', fontSize: '.65rem' },
  movementDetailLink: { color: '#005447' },
  movementDetailReason: { fontWeight: 500, lineHeight: 1.45 },
  movementDetailFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: 17, paddingTop: 13, borderTop: '1px solid #e2e8f0' },  addModal: { width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '22px 24px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  attentionModal: { width: 'min(570px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '22px 24px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  purchaseModal: { width: 'min(620px, 100%)', maxHeight: 'calc(100vh - 44px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '18px 20px 20px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  receiveModal: { width: 'min(480px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '22px 24px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  receiveFields: { display: 'grid', gap: 13 },
  receiveOrderSummary: { display: 'grid', gap: 13, padding: '14px 13px', border: '1px solid #dbe3ee', borderRadius: 10, background: '#f8fafc' },
  receiveOrderSummaryHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid #e2e8f0' },
  receiveOrderNumber: { display: 'block', color: '#1f2937', fontSize: '.82rem' },
  receiveOrderSupplier: { display: 'block', marginTop: 3, color: '#64748b', fontSize: '.7rem' },
  receiveOrderSummaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  receiveOrderItems: { display: 'grid', gap: 6, paddingTop: 2 },
  receiveOrderItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: '#475569', fontSize: '.7rem' },
  optional: { marginLeft: 5, color: '#94a3b8', fontSize: '.68rem', fontWeight: 400 },
  fileInput: { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
  filePicker: { display: 'block', marginTop: 6, padding: '11px 12px', border: '1px dashed #cbd5e1', borderRadius: 7, background: '#f8fafc', color: '#64748b', fontSize: '.76rem', cursor: 'pointer' },
  receiptPreview: { display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid #dbe3ee', borderRadius: 7, background: '#f8fafc' },
  receiptImage: { width: 54, height: 54, objectFit: 'cover', borderRadius: 5 },
  receiptDetails: { display: 'grid', gap: 5, minWidth: 0, color: '#334155', fontSize: '.72rem' },
  removeReceipt: { width: 'fit-content', padding: 0, border: 0, background: 'transparent', color: '#dc2626', fontSize: '.68rem', cursor: 'pointer' },
  viewReceiptButton: { border: 0, background: 'transparent', color: '#005447', padding: 0, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  noReceipt: { color: '#94a3b8', fontSize: '.75rem' },
  closeSectionButton: { border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#475569', padding: '5px 9px', fontSize: '.7rem', cursor: 'pointer' },
  deliveryEmpty: { padding: '22px 12px', border: '1px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#64748b', fontSize: '.78rem', textAlign: 'center' },
  receiptModal: { width: 'min(620px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '22px 24px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  deliveriesModal: { width: 'min(600px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: '22px 24px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, .22)' },
  deliveryList: { display: 'grid', gap: 8 },
  deliveryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 10px', border: '1px solid #dbe3ee', borderRadius: 8, background: '#f8fafc' },
  deliveryInfo: { display: 'grid', gap: 11, width: '100%', minWidth: 0, color: '#0f172a', fontSize: '.78rem' },
  deliverySummaryButton: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', border: 0, padding: 0, background: 'transparent', color: '#0f172a', font: 'inherit', textAlign: 'left', cursor: 'pointer' },
  deliverySummaryMain: { display: 'grid', gap: 3, minWidth: 0 },
  deliverySummaryEnd: { display: 'inline-flex', alignItems: 'center', gap: 9, flexShrink: 0 },
  deliveryExpandIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: '1px solid #cbd5e1', borderRadius: 5, color: '#64748b', fontSize: '.9rem', fontWeight: 600, lineHeight: 1 },
  deliveryExpanded: { display: 'grid', gap: 11, paddingTop: 11, borderTop: '1px solid #e2e8f0' },
  deliveryHeading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingBottom: 9, borderBottom: '1px solid #e2e8f0' },
  deliveryInfoSecondary: { color: '#64748b', fontSize: '.7rem' },
  deliveryInfoDate: { color: '#94a3b8', fontSize: '.68rem' },
  deliveryDetailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  deliveryItems: { display: 'grid', gap: 6, paddingTop: 2 },
  deliverySectionLabel: { color: '#334155', fontSize: '.7rem' },
  deliveryItem: { display: 'flex', justifyContent: 'space-between', gap: 10, color: '#475569', fontSize: '.69rem' },
  deliveryTotal: { display: 'flex', justifyContent: 'space-between', padding: '10px 11px', borderRadius: 7, background: '#fff', color: '#334155', fontSize: '.75rem' },
  deliveryNotes: { display: 'grid', gap: 4, paddingTop: 2, color: '#526581', fontSize: '.7rem' },
  deliveryReceipt: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' },
  deliveryReceiptImage: { width: 58, height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid #dbe3ee' },
  deliveryReceiptInfo: { display: 'grid', gap: 3, minWidth: 0, color: '#334155', fontSize: '.7rem' },
  receiptFullImage: { display: 'block', width: '100%', maxHeight: '65vh', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' },
  receiptModalFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, color: '#64748b', fontSize: '.75rem' },
  attentionList: { display: 'grid', gap: 8 },
  attentionItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '11px 10px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fffafa', color: '#0f172a', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' },
  attentionStatus: { width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 6, background: '#fef3c7', color: '#b45309', fontWeight: 800 },
  attentionOut: { background: '#fee2e2', color: '#b91c1c' },
  attentionInfo: { display: 'grid', gap: 2, flex: 1, minWidth: 0, color: '#0f172a', fontSize: '.76rem' },
  attentionInfoSecondary: { color: '#475569', fontSize: '.7rem' },
  attentionInfoSmall: { color: '#94a3b8', fontSize: '.67rem' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 600 },
  modalSubtitle: { margin: '6px 0 0', color: '#7c8495', fontSize: '.78rem' },
  closeButton: { border: 0, background: 'transparent', color: '#59616e', fontSize: '1.35rem', lineHeight: 1, padding: 0, cursor: 'pointer' },
  formNotice: { marginBottom: 14, padding: '9px 11px', border: '1px solid #fecaca', borderRadius: 7, background: '#fff1f2', color: '#b91c1c', fontSize: '.75rem', lineHeight: 1.4 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 14, rowGap: 12 },
  formField: { display: 'block', color: '#111827', fontSize: '.74rem', fontWeight: 500 },
  required: { display: 'inline', color: '#dc2626', marginLeft: 2 },
  formInput: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: 0, borderRadius: 8, padding: '9px 12px', background: '#f1f1f4', color: '#6f7788', fontSize: '.78rem', outline: 'none' },
  formTextarea: { display: 'block', width: '100%', minHeight: 64, boxSizing: 'border-box', marginTop: 5, resize: 'vertical', border: 0, borderRadius: 8, padding: '10px 12px', background: '#f1f1f4', color: '#6f7788', font: 'inherit', fontSize: '.78rem', outline: 'none' },
  purchaseFields: { display: 'grid', gap: 12 },
  supplierDetailsPanel: { padding: '16px 17px', border: '1px solid #dbe3ee', borderRadius: 12, background: '#f8fafc' },
  supplierDetailsTitle: { marginBottom: 10, color: '#526581', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.03em' },
  supplierDetailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, color: '#526581', fontSize: '.72rem' },
  purchaseSupplierIcon: { display: 'inline-flex', width: 14, height: 14, verticalAlign: 'middle', marginRight: 5 },
  purchaseTwoFields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  orderItemsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, color: '#334155', fontSize: '.78rem' },
  addOrderItemButton: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d9dce2', borderRadius: 8, padding: '7px 10px', background: '#fff', color: '#334155', fontSize: '.72rem', cursor: 'pointer' },
  orderItemLabels: { display: 'grid', gridTemplateColumns: '2fr .8fr 1fr 1fr .8fr', gap: 8, padding: '4px 4px 0', color: '#71809a', fontSize: '.65rem', fontWeight: 600 },
  orderItemRow: { display: 'grid', gridTemplateColumns: '2fr .8fr 1fr 1fr .8fr 16px', gap: 8, alignItems: 'center' },
  orderProductInput: { minWidth: 0, ...{}, border: 0, borderRadius: 8, padding: '10px 12px', background: '#f1f1f4', color: '#6f7788', fontSize: '.72rem', outline: 'none' },
  orderQuantityInput: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 8, padding: '10px 9px', background: '#f1f1f4', color: '#6f7788', fontSize: '.72rem', outline: 'none' },
  orderUnitInput: { minWidth: 0, border: 0, borderRadius: 8, padding: '10px 9px', background: '#f1f1f4', color: '#6f7788', fontSize: '.72rem', outline: 'none' },
  orderPriceInput: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 8, padding: '10px 9px', background: '#f1f1f4', color: '#6f7788', fontSize: '.72rem', outline: 'none' },
  orderLineTotal: { color: '#526581', fontSize: '.72rem', whiteSpace: 'nowrap' },
  removeOrderItem: { border: 0, background: 'transparent', color: '#f28b91', fontSize: '1rem', cursor: 'pointer' },
  purchaseTextarea: { display: 'block', width: '100%', minHeight: 64, boxSizing: 'border-box', marginTop: 5, resize: 'vertical', border: 0, borderRadius: 8, padding: '10px 12px', background: '#f1f1f4', color: '#6f7788', font: 'inherit', fontSize: '.78rem', outline: 'none' },
  formTriple: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancelButton: { border: '1px solid #d9dce2', borderRadius: 8, padding: '9px 14px', background: '#fff', color: '#111827', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  saveDraftButton: { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #d9dce2', borderRadius: 8, padding: '9px 12px', background: '#fff', color: '#111827', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' },
  modalSubmit: { display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 8, padding: '9px 14px', background: '#07051f', color: '#fff', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  sendPoButton: { display: 'inline-flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 8, padding: '9px 14px', background: '#07051f', color: '#fff', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer' },
};
