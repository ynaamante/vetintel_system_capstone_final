const patientDiagnoses = require('../controllers/patientDiagnosisController');
const diagnosisObservations = require('../controllers/diagnosisObservationController');
const express = require('express');
const router = express.Router();
const users = require('../controllers/userController');
const clinics = require('../controllers/clinicController');
const clinicRecords = require('../controllers/clinicRecordController');
const patientRegistrations = require('../controllers/patientRegistrationController');
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
router.get('/clinic-records/inbox', auth.required, require('../controllers/clinicInboxController').list);
router.post('/clinic-records/inbox', auth.required, require('../controllers/clinicInboxController').create);
router.patch('/clinic-records/inbox/:id', auth.required, require('../controllers/clinicInboxController').update);
router.get('/clinic-records/clients', auth.required, clinicRecords.listClients);
router.post('/clinic-records/clients', auth.required, clinicRecords.createClient);
router.get('/clinic-records/registration-screening/config', auth.required, patientRegistrations.screeningConfig);
router.post('/clinic-records/registration-screening/preview', auth.required, patientRegistrations.previewScreening);
router.patch('/clinic-records/registration-intakes/:id/screening', auth.required, patientRegistrations.reviewScreening);
router.get('/clinic-records/pets/:id/diagnoses', auth.required, patientDiagnoses.list);
router.get('/clinic-records/pets/:id/diagnoses/:diagnosisId/observations', auth.required, diagnosisObservations.list);
router.post('/clinic-records/pets/:id/diagnoses/:diagnosisId/observations', auth.required, diagnosisObservations.create);
router.post('/clinic-records/pets/:id/diagnoses', auth.required, patientDiagnoses.save);
router.put('/clinic-records/pets/:id/diagnoses/:diagnosisId', auth.required, patientDiagnoses.save);
router.get('/clinic-records/pets/:id/intake-summary', auth.required, patientRegistrations.getPatientIntakeSummary);
router.get('/clinic-records/registration-doctors', auth.required, patientRegistrations.listDoctors);
router.get('/clinic-records/registration-intakes', auth.required, patientRegistrations.listIntakes);
router.get('/clinic-records/registration-intakes/:id/patient-record', auth.required, patientRegistrations.getPatientRecord);
router.post('/clinic-records/registration-intakes', auth.required, patientRegistrations.submitIntake);
router.put('/clinic-records/registration-intakes/:id/resubmit', auth.required, patientRegistrations.resubmitIntake);
router.patch('/clinic-records/registration-intakes/:id/return', auth.required, patientRegistrations.returnForCorrection);
router.patch('/clinic-records/registration-intakes/:id/review', auth.required, patientRegistrations.reviewIntake);
router.get('/notifications', auth.required, patientRegistrations.listNotifications);
router.patch('/notifications/:id/read', auth.required, patientRegistrations.markNotificationRead);
router.patch('/clinic-records/clients/:id/archive', auth.required, clinicRecords.archiveClient);
router.put('/clinic-records/clients/:id', auth.required, clinicRecords.updateClient);
router.get('/clinic-records/pets', auth.required, clinicRecords.listPets);
router.get('/clinic-records/pets/:id/clinical-alerts', auth.required, clinicRecords.getPatientClinicalAlerts);
router.get('/clinic-records/pets/:id/documents', auth.required, clinicRecords.listPatientDocuments);
router.post('/clinic-records/pets', auth.required, clinicRecords.createPet);
router.post('/clinic-records/pets/:id/photo', auth.required, clinicRecords.uploadPetPhoto);
router.get('/clinic-records/shareable-records', auth.required, clinicRecords.listShareablePetRecords);
router.post('/clinic-records/shareable-records', auth.required, clinicRecords.sharePetRecordsWithOwner);
router.get('/owner/shared-records', auth.required, clinicRecords.listOwnerSharedRecords);
router.get('/owner/notifications', auth.required, require('../controllers/ownerNotificationController').list);
router.post('/owner/notifications/acknowledge', auth.required, require('../controllers/ownerNotificationController').acknowledge);
router.patch('/owner/notifications/read-all', auth.required, require('../controllers/ownerNotificationController').markRead);
router.patch('/owner/notifications/:id/read', auth.required, require('../controllers/ownerNotificationController').markRead);
router.put('/clinic-records/pets/:id', auth.required, clinicRecords.updatePet);
router.patch('/clinic-records/pets/:id/archive', auth.required, clinicRecords.archivePet);
router.get('/clinic-records/appointments', auth.required, clinicRecords.listAppointments);
router.get('/clinic-records/appointments/filters', auth.required, require('../controllers/reminderController').filters);
router.get('/clinic-records/appointments/:id/reception-context', auth.required, require('../controllers/receptionAppointmentController').context);
router.post('/clinic-records/appointments/:id/reception-action', auth.required, require('../controllers/receptionAppointmentController').act);
router.get('/clinic-records/visits', auth.required, clinicRecords.listVisits);
router.get('/clinic-records/vaccine-inventory', auth.required, require('../controllers/vaccineInventoryController').list);
router.put('/clinic-records/billing-catalog/:id/inventory-links', auth.required, require('../controllers/catalogConnections').update);
router.get('/clinic-records/inventory', auth.required, require('../controllers/inventoryController').list);
router.put('/clinic-records/inventory/:id', auth.required, require('../controllers/inventoryController').update);
router.post('/clinic-records/inventory/import-pdf', auth.required, require('../controllers/inventoryController').importPdf);
router.post('/clinic-records/vaccine-inventory', auth.required, require('../controllers/vaccineInventoryController').create);
router.get('/clinic-records/events', auth.required, require('../utils/clinicEvents').stream);
router.get('/clinic-records/appointments/:id/visit-workflow', auth.required, require('../controllers/visitWorkflowController').get);
router.post('/clinic-records/appointments/:id/visit-workflow', auth.required, require('../controllers/visitWorkflowController').act);
router.get('/clinic-records/dashboard/alerts', auth.required, clinicRecords.listDashboardAlerts);
router.get('/disease-intelligence/summary', auth.required, clinicRecords.getDiseaseIntelligenceSummary);
router.get('/clinic-records/dashboard/summary', auth.required, clinicRecords.getClinicDashboardSummary);
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
router.post('/clinic-records/patient-queue/walk-in', auth.required, require('../controllers/receptionAppointmentController').addWalkIn);
router.get('/clinic-records/billing-catalog', auth.required, clinicRecords.listBillingCatalog);
router.post('/clinic-records/billing-catalog/seed-defaults', auth.required, clinicRecords.seedDefaultBillingCatalog);
router.post('/clinic-records/billing-catalog', auth.required, clinicRecords.createBillingCatalogItem);
router.put('/clinic-records/billing-catalog/:id', auth.required, clinicRecords.updateBillingCatalogItem);
router.get('/clinic-records/invoices', auth.required, clinicRecords.listInvoices);
router.post('/clinic-records/invoices/:id/send-to-reception', auth.required, clinicRecords.sendInvoiceToReception);
router.get('/clinic-records/payments', auth.required, clinicRecords.listPayments);
router.post('/clinic-records/invoices/:id/payments', auth.required, clinicRecords.createInvoicePayment);
router.post('/clinic-records/invoices/:id/review', auth.required, require('../controllers/invoiceReviewController').review);
router.get('/clinic-records/billing-review-options', auth.required, require('../controllers/invoiceReviewController').options);
router.post('/clinic-records/invoices/:id/correct', auth.required, require('../controllers/invoiceReviewController').correct);
router.post('/clinic-records/invoices/:id/void-decision', auth.required, require('../controllers/invoiceReviewController').voidDecision);
router.get('/clinic-records/payment-qr', auth.required, require('../controllers/invoiceReviewController').paymentQr);
router.put('/clinic-records/payment-qr', auth.required, require('../controllers/invoiceReviewController').savePaymentQr);
router.get('/clinic-records/inpatient-stays', auth.required, clinicRecords.listInpatientStays);
router.post('/clinic-records/inpatient-stays', auth.required, clinicRecords.createInpatientStay);
router.get('/clinic-records/inpatient-stays/:id/care', auth.required, clinicRecords.getInpatientCare);
router.post('/clinic-records/inpatient-stays/:id/attachments', auth.required, clinicRecords.uploadInpatientAttachment);
router.post('/clinic-records/inpatient-stays/:id/observations', auth.required, clinicRecords.createInpatientObservation);
router.post('/clinic-records/inpatient-stays/:id/medications', auth.required, clinicRecords.createInpatientMedicationAdministration);
router.patch('/clinic-records/inpatient-stays/:id/discharge', auth.required, clinicRecords.dischargeInpatientStay);
router.get('/clinic-records/reminders/filters', auth.required, require('../controllers/reminderController').filters);
router.get('/clinic-records/reminders', auth.required, require('../controllers/reminderController').list);
router.get('/clinic-records/reminders/:id', auth.required, require('../controllers/reminderDetailsController').get);
router.post('/clinic-records/reminders/:id/send', auth.required, require('../controllers/reminderDetailsController').send);
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
router.get('/clinic-records/lab-test-types', auth.required, clinicRecords.listLabTestTypes);
router.post('/clinic-records/lab-tests', auth.required, clinicRecords.createLabTest);
router.patch('/clinic-records/lab-tests/:id/archive', auth.required, clinicRecords.archiveLabTest);
router.put('/clinic-records/lab-tests/:id', auth.required, clinicRecords.updateLabTest);
router.post('/clinic-records/lab-tests/:id/complete-service', auth.required, clinicRecords.completeLabTestService);
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
router.get('/owner-monitoring/summary', auth.required, require('../controllers/ownerMonitoringController').summary);
router.get('/owner-monitoring/data-status', auth.required, require('../controllers/ownerMonitoringController').dataStatus);
router.get('/owner-monitoring/report', auth.required, require('../controllers/ownerMonitoringController').report);
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
