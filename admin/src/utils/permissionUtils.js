export const normalizeFeatureName = (feature) => String(feature || '').trim();
export const normalizeRoleName = (role) =>
  String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

const FEATURE_PERMISSION_MAP = {
  'Intelligence Dashboard': ['Disease Intelligence', 'View Intelligence Dashboard'],
  'Disease Monitoring': ['Disease Intelligence', 'View Disease Monitoring'],
  'Risk Monitoring': ['Disease Intelligence', 'View Risk Monitoring'],
  'Community Analytics': ['Disease Intelligence', 'View Community Analytics'],
  Reports: ['Disease Intelligence', 'View Reports'],
  'Data Sync Status': ['Disease Intelligence', 'View Data Sync Status'],
  'Pet Profiles': ['Patient / Pet Records', 'View Pet Records'],
  'Medical Records': ['Patient / Pet Records', 'View Medical History'],
  'User & Role Management': ['User Management', 'View Users'],
  'Appointment Management': ['Appointments', 'View Appointments'],
  'Client Management': ['Client Management', 'View Clients'],
  'Billing & Payments': ['Billing & Financial', 'View Billing'],
  'Financial Monitoring': ['Billing & Financial', 'View Financial Reports'],
  'Inventory Management': ['Inventory', 'View Inventory'],
  'Services Management': ['Services', 'View Services'],
  'Audit Trail': ['Audit', 'View Audit Trail'],
  'Shared Inbox': ['Communication', 'View Pet Owner Messages'],
  'Due Dates & Reminders': ['Appointments', 'View Follow-ups'],
};

const ROLE_DEFAULT_FEATURES = {
  receptionist: new Set([
    'Appointment Management',
    'New Patient Registration',
    'Patient Queue',
    'Billing & Payments',
    'Shared Inbox',
  ]),
};

const getFeaturePermissions = (permissions, feature) => {
  if (!permissions || typeof permissions !== 'object') return null;
  const normalizedFeature = normalizeFeatureName(feature);
  const featurePermissions = permissions[normalizedFeature];
  if (featurePermissions && typeof featurePermissions === 'object') return featurePermissions;

  const mappedPermission = FEATURE_PERMISSION_MAP[normalizedFeature];
  if (!mappedPermission) return null;

  const [group, item] = mappedPermission;
  const itemPermission = permissions[group]?.[item];
  return typeof itemPermission === 'boolean' ? { view: itemPermission } : null;
};

export const hasPermissionForFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return Object.values(featurePermissions).some(Boolean);
  }

  // For super_admin with no explicit permissions, grant access
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === 'super_admin') return true;

  // For all other roles, if explicit permissions are not defined, deny access
  // This ensures permissions are ONLY based on what's explicitly set in the matrix
  return false;
};

export const canViewFeature = (permissions, role, feature) => {
  const normalizedRole = normalizeRoleName(role);
  const normalizedFeature = normalizeFeatureName(feature);
  // These pages belong to their assigned roles even when saved permissions are older.
  if (normalizedFeature === 'Client Management') {
    return ['owner', 'clinic_owner', 'super_admin'].includes(normalizedRole);
  }
  if (normalizedFeature === 'Due Dates & Reminders') {
    return ['doctor', 'assistant_doctor', 'veterinarian', 'super_admin'].includes(normalizedRole);
  }
  if (ROLE_DEFAULT_FEATURES[normalizedRole]?.has(normalizeFeatureName(feature))) return true;

  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return !!featurePermissions.view;
  }
  
  // For super_admin with no explicit permissions, allow view
  if (normalizedRole === 'super_admin') return true;
  
  // For all other roles, deny access if explicit permissions don't exist
  return false;
};

export const canExportFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return !!featurePermissions.export;
  }
  return false;
};

export const canCreateFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return !!featurePermissions.create;
  }
  return false;
};

export const canEditFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return !!featurePermissions.edit;
  }
  return false;
};

export const canDeleteFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return !!featurePermissions.delete;
  }
  return false;
};

export const canInteractWithFeature = (permissions, role, feature) => {
  const featurePermissions = getFeaturePermissions(permissions, feature);
  if (featurePermissions) {
    return ['create', 'edit', 'delete', 'export'].some((type) => featurePermissions[type]);
  }
  return false;
};
