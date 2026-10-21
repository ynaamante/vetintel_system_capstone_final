const express = require('express');
const router = express.Router();
const users = require('../controllers/userController');
const clinics = require('../controllers/clinicController');
const clinicRecords = require('../controllers/clinicRecordController');
const audit = require('../controllers/auditController');
const announcements = require('../controllers/announcementController');
const dashboard = require('../controllers/dashboardController');
const roles = require('../controllers/roleController');
const permissions = require('../controllers/permissionController');
const settings = require('../controllers/settingsController');
const adminSurfaces = require('../controllers/adminSurfaceController');
const auth = require('../middleware/auth');

// Auth endpoints
router.post('/login', users.login);
router.post('/register', users.register);
router.get('/me', auth.required, users.me);
router.post('/password/change', auth.required, users.changePassword);

// User endpoints
router.get('/users', auth.required, users.list);
router.post('/users', users.create);
router.put('/users/:id', auth.required, users.update);
router.delete('/users/:id', auth.required, users.delete);
router.put('/users/:id/restore', auth.required, users.restore);
router.delete('/users/:id/permanent', auth.required, users.permanentDelete);

// Clinic endpoints
router.get('/clinics', auth.required, clinics.list);
router.get('/clinics/:id', auth.required, clinics.getById);
router.post('/clinic-applications', auth.optional, clinics.createApplication);
router.get('/clinics/:id/staff', auth.required, clinics.getStaffByClinic);
router.post('/clinics', auth.required, clinics.create);
router.put('/clinics/:id', auth.required, clinics.update);
router.delete('/clinics/:id', auth.required, auth.superAdmin, clinics.delete);
router.post('/clinics/export/log', auth.required, clinics.logExport);

// Clinic records endpoints
router.get('/clinic-records/clients', auth.required, clinicRecords.listClients);
router.post('/clinic-records/clients', auth.required, clinicRecords.createClient);
router.patch('/clinic-records/clients/:id/archive', auth.required, clinicRecords.archiveClient);
router.get('/clinic-records/pets', auth.required, clinicRecords.listPets);
router.get('/clinic-records/pets/:id/clinical-alerts', auth.required, clinicRecords.getPatientClinicalAlerts);
router.get('/clinic-records/pets/:id/documents', auth.required, clinicRecords.listPatientDocuments);
router.post('/clinic-records/pets', auth.required, clinicRecords.createPet);
router.post('/clinic-records/pets/:id/photo', auth.required, clinicRecords.uploadPetPhoto);
router.get('/clinic-records/shareable-records', auth.required, clinicRecords.listShareablePetRecords);
router.post('/clinic-records/shareable-records', auth.required, clinicRecords.sharePetRecordsWithOwner);
router.get('/owner/shared-records', auth.required, clinicRecords.listOwnerSharedRecords);
router.put('/clinic-records/pets/:id', auth.required, clinicRecords.updatePet);
router.patch('/clinic-records/pets/:id/archive', auth.required, clinicRecords.archivePet);
router.get('/clinic-records/appointments', auth.required, clinicRecords.listAppointments);
router.get('/clinic-records/visits', auth.required, clinicRecords.listVisits);
router.get('/clinic-records/dashboard/alerts', auth.required, clinicRecords.listDashboardAlerts);
router.post('/clinic-records/appointments', auth.required, clinicRecords.createAppointment);
router.patch('/clinic-records/appointments/:id/vaccination-details', auth.required, clinicRecords.updateScheduledVaccinationAppointment);
router.post('/clinic-records/appointments/:id/related', auth.required, clinicRecords.createRelatedAppointment);
router.post('/clinic-records/appointments/:id/start-consultation', auth.required, clinicRecords.startConsultation);
router.get('/clinic-records/appointments/:id/consultation', auth.required, clinicRecords.getConsultation);
router.put('/clinic-records/appointments/:id/consultation', auth.required, clinicRecords.saveConsultation);
router.post('/clinic-records/appointments/:id/complete-consultation', auth.required, clinicRecords.completeConsultation);
router.post('/clinic-records/appointments/:id/transfer', auth.required, clinicRecords.transferAppointment);
router.patch('/clinic-records/appointments/:id/archive', auth.required, clinicRecords.archiveAppointment);
router.get('/clinic-records/patient-queue', auth.required, clinicRecords.listPatientQueue);
router.get('/clinic-records/billing-catalog', auth.required, clinicRecords.listBillingCatalog);
router.post('/clinic-records/billing-catalog/seed-defaults', auth.required, clinicRecords.seedDefaultBillingCatalog);
router.post('/clinic-records/billing-catalog', auth.required, clinicRecords.createBillingCatalogItem);
router.put('/clinic-records/billing-catalog/:id', auth.required, clinicRecords.updateBillingCatalogItem);
router.get('/clinic-records/invoices', auth.required, clinicRecords.listInvoices);
router.get('/clinic-records/payments', auth.required, clinicRecords.listPayments);
router.get('/clinic-records/inpatient-stays', auth.required, clinicRecords.listInpatientStays);
router.post('/clinic-records/inpatient-stays', auth.required, clinicRecords.createInpatientStay);
router.get('/clinic-records/inpatient-stays/:id/care', auth.required, clinicRecords.getInpatientCare);
router.post('/clinic-records/inpatient-stays/:id/observations', auth.required, clinicRecords.createInpatientObservation);
router.post('/clinic-records/inpatient-stays/:id/medications', auth.required, clinicRecords.createInpatientMedicationAdministration);
router.patch('/clinic-records/inpatient-stays/:id/discharge', auth.required, clinicRecords.dischargeInpatientStay);
router.get('/clinic-records/reminders', auth.required, clinicRecords.listReminders);
router.get('/clinic-records/vaccinations', auth.required, clinicRecords.listVaccinations);
router.post('/clinic-records/vaccinations', auth.required, clinicRecords.createVaccination);
router.put('/clinic-records/vaccinations/:id', auth.required, clinicRecords.updateVaccination);
router.patch('/clinic-records/vaccinations/:id/verification', auth.required, clinicRecords.updateVaccinationVerification);
router.post('/clinic-records/vaccinations/:id/sticker', auth.required, clinicRecords.uploadVaccinationSticker);
router.patch('/clinic-records/vaccinations/:id/archive', auth.required, clinicRecords.archiveVaccination);
router.get('/clinic-records/treatments', auth.required, clinicRecords.listPrescriptions);
router.post('/clinic-records/treatments', auth.required, clinicRecords.createPrescription);
router.patch('/clinic-records/treatments/:id/finalize', auth.required, clinicRecords.finalizeTreatment);
router.patch('/clinic-records/treatments/:id/archive', auth.required, clinicRecords.archiveTreatment);
router.get('/clinic-records/treatment-plans', auth.required, clinicRecords.listTreatmentPlans);
router.post('/clinic-records/treatment-plans', auth.required, clinicRecords.createTreatmentPlan);
router.post('/clinic-records/treatment-plans/:id/notes', auth.required, clinicRecords.addTreatmentPlanNote);
router.patch('/clinic-records/treatment-plans/:id/archive', auth.required, clinicRecords.archiveTreatmentPlan);
router.patch('/clinic-records/treatment-plans/:id', auth.required, clinicRecords.updateTreatmentPlan);
router.get('/clinic-records/treatment-records', auth.required, clinicRecords.listTreatmentRecords);
router.post('/clinic-records/treatment-records', auth.required, clinicRecords.createTreatmentRecord);
router.put('/clinic-records/treatment-records/:id', auth.required, clinicRecords.updateTreatmentRecord);
router.get('/clinic-records/lab-tests', auth.required, clinicRecords.listLabTests);
router.post('/clinic-records/lab-tests', auth.required, clinicRecords.createLabTest);
router.patch('/clinic-records/lab-tests/:id/archive', auth.required, clinicRecords.archiveLabTest);
router.put('/clinic-records/lab-tests/:id', auth.required, clinicRecords.updateLabTest);
router.post('/clinic-records/lab-tests/:id/report', auth.required, clinicRecords.uploadLabReport);
router.get('/clinic-records/attachments/:id/content', auth.required, clinicRecords.downloadClinicAttachment);

// Audit Trail endpoints
router.get('/audit-trail', auth.required, audit.list);
router.get('/audit-trail/filter', auth.required, audit.getByFilter);
router.post('/audit-trail', auth.required, audit.create);

// Announcements endpoints
router.get('/announcements', auth.optional, announcements.list);
router.post('/announcements', auth.required, announcements.create);
router.put('/announcements/:id', auth.required, announcements.update);
router.delete('/announcements/:id', auth.required, announcements.delete);

// Dashboard endpoints
router.get('/dashboard/stats', auth.required, dashboard.getDashboardStats);
router.get('/dashboard/activity', auth.required, dashboard.getRecentActivity);
router.get('/dashboard/clinic-applications', auth.optional, dashboard.getRecentClinicApplications);
router.delete('/dashboard/activity', auth.required, auth.superAdmin, dashboard.clearRecentActivity);
router.get('/dashboard/roles', auth.required, dashboard.getRoleBreakdown);
router.get('/reports/platform', auth.required, auth.superAdmin, dashboard.getPlatformReports);

// Roles endpoints
router.get('/roles', auth.required, roles.list);
router.get('/roles/:id', auth.required, roles.getById);
router.post('/roles', auth.required, roles.create);
router.put('/roles/:id', auth.required, roles.update);
router.delete('/roles/:id', auth.required, roles.delete);

// Permissions endpoints
router.get('/permissions', auth.required, permissions.list);
router.get('/permissions/:id', auth.required, permissions.getById);
router.post('/permissions', auth.required, permissions.create);
router.put('/permissions/:id', auth.required, permissions.update);
router.delete('/permissions/:id', auth.required, permissions.delete);

// Role permissions mapping
router.get('/role-permissions', auth.required, permissions.listRolePermissions);
router.post('/role-permissions', auth.required, permissions.createRolePermission);
router.delete('/role-permissions/:id', auth.required, permissions.deleteRolePermission);

// Settings endpoints
router.get('/settings', auth.required, settings.list);
router.get('/settings/:id', auth.required, settings.getById);
router.post('/settings', auth.required, settings.create);
router.put('/settings/:id', auth.required, settings.update);
router.delete('/settings/:id', auth.required, settings.delete);

// Super Admin operational surfaces
router.get('/role-requests', auth.required, auth.superAdmin, adminSurfaces.roleRequests.list);
router.get('/role-requests/:id', auth.required, auth.superAdmin, adminSurfaces.roleRequests.detail);
router.patch('/role-requests/:id/status', auth.required, auth.superAdmin, adminSurfaces.roleRequests.status);
router.put('/role-requests/:id/status', auth.required, auth.superAdmin, adminSurfaces.roleRequests.status);
router.get('/my-role-requests', auth.required, adminSurfaces.roleRequests.listMine);
router.post('/my-role-requests', auth.required, adminSurfaces.roleRequests.createMine);

router.get('/subscription-plans', auth.required, auth.superAdmin, adminSurfaces.plans.list);
router.post('/subscription-plans', auth.required, auth.superAdmin, adminSurfaces.plans.create);
router.put('/subscription-plans/:id', auth.required, auth.superAdmin, adminSurfaces.plans.update);
router.patch('/subscription-plans/:id/status', auth.required, auth.superAdmin, adminSurfaces.plans.status);
router.put('/subscription-plans/:id/status', auth.required, auth.superAdmin, adminSurfaces.plans.status);

router.get('/demo-requests', auth.required, auth.superAdmin, adminSurfaces.demoRequests.list);
router.post('/demo-requests', auth.optional, adminSurfaces.demoRequests.create);
router.get('/demo-requests/:id', auth.required, auth.superAdmin, adminSurfaces.demoRequests.detail);
router.put('/demo-requests/:id', auth.required, auth.superAdmin, adminSurfaces.demoRequests.update);
router.patch('/demo-requests/:id/status', auth.required, auth.superAdmin, adminSurfaces.demoRequests.status);
router.put('/demo-requests/:id/status', auth.required, auth.superAdmin, adminSurfaces.demoRequests.status);

router.get('/messages', auth.required, auth.superAdmin, adminSurfaces.messages.list);
router.post('/messages', auth.required, adminSurfaces.messages.create);
router.get('/my-messages', auth.required, adminSurfaces.messages.mine);
router.get('/messages/:id', auth.required, auth.superAdmin, adminSurfaces.messages.detail);
router.patch('/messages/:id/read', auth.required, auth.superAdmin, adminSurfaces.messages.read);
router.put('/messages/:id/read', auth.required, auth.superAdmin, adminSurfaces.messages.read);
router.post('/messages/:id/replies', auth.required, auth.superAdmin, adminSurfaces.messages.reply);
router.post('/messages/:id/reply', auth.required, auth.superAdmin, adminSurfaces.messages.reply);
router.post('/purchase-orders/send', auth.required, adminSurfaces.purchaseOrders.send);

module.exports = router;
