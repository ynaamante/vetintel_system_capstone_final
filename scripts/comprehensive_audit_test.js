#!/usr/bin/env node
/**
 * Comprehensive Audit Logging Test
 * Tests all CUD operations across all controllers
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = process.env.API_TOKEN;
const USER_ID = '1';

let testsPassed = 0;
let testsFailed = 0;
const createdIds = {};

function makeRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${endpoint}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-User-Id': USER_ID,
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testEndpoint(name, method, endpoint, body, expectedStatus) {
  try {
    const result = await makeRequest(method, endpoint, body);
    const passed = result.status === expectedStatus;
    const status = passed ? '✓' : '✗';
    console.log(`${status} ${name} (${result.status})`);
    if (passed) {
      testsPassed++;
      return result.body;
    } else {
      testsFailed++;
      console.log(`  Expected ${expectedStatus}, got ${result.status}`);
      if (result.body?.error) console.log(`  Error: ${result.body.error}`);
      return null;
    }
  } catch (e) {
    console.log(`✗ ${name} (ERROR)`);
    console.log(`  ${e.message}`);
    testsFailed++;
    return null;
  }
}

async function runTests() {
  console.log('\n═══ COMPREHENSIVE AUDIT LOGGING TEST ═══\n');

  // 1. CREATE Role
  console.log('-- ROLE OPERATIONS --');
  const roleRes = await testEndpoint(
    'Create role',
    'POST',
    '/roles',
    { name: `TestRole_${Date.now()}`, description: 'Test role for audit' },
    201
  );
  if (roleRes?.id) createdIds.role = roleRes.id;

  // 2. UPDATE Role
  if (createdIds.role) {
    await testEndpoint(
      'Update role',
      'PUT',
      `/roles/${createdIds.role}`,
      { description: 'Updated description' },
      200
    );
  }

  // 3. CREATE User
  console.log('\n-- USER OPERATIONS --');
  const userRes = await testEndpoint(
    'Create user',
    'POST',
    '/users',
    {
      email: `test_${Date.now()}@example.com`,
      password: 'testpass123',
      first_name: 'Test',
      last_name: 'User',
      clinic_id: 1,
      role_id: 1,
    },
    201
  );
  if (userRes?.id) createdIds.user = userRes.id;

  // 4. UPDATE User
  if (createdIds.user) {
    await testEndpoint(
      'Update user',
      'PUT',
      `/users/${createdIds.user}`,
      { first_name: 'Updated' },
      200
    );
  }

  // 5. CREATE Clinic
  console.log('\n-- CLINIC OPERATIONS --');
  const clinicRes = await testEndpoint(
    'Create clinic',
    'POST',
    '/clinics',
    {
      name: `TestClinic_${Date.now()}`,
      address: '123 Test St',
      city: 'Test City',
      contact_email: `clinic_${Date.now()}@example.com`,
      contact_phone: '555-0123',
    },
    201
  );
  if (clinicRes?.id) createdIds.clinic = clinicRes.id;

  // 6. UPDATE Clinic
  if (createdIds.clinic) {
    await testEndpoint(
      'Update clinic',
      'PUT',
      `/clinics/${createdIds.clinic}`,
      { address: '456 New St' },
      200
    );
  }

  // 7. CREATE Permission
  console.log('\n-- PERMISSION OPERATIONS --');
  const permRes = await testEndpoint(
    'Create permission',
    'POST',
    '/permissions',
    {
      name: `perm_${Date.now()}`,
      description: 'Test permission',
      resource: 'test',
      action: 'read',
    },
    201
  );
  if (permRes?.id) createdIds.permission = permRes.id;

  // 8. UPDATE Permission
  if (createdIds.permission) {
    await testEndpoint(
      'Update permission',
      'PUT',
      `/permissions/${createdIds.permission}`,
      { description: 'Updated permission' },
      200
    );
  }

  // 9. CREATE Role-Permission
  if (createdIds.role && createdIds.permission) {
    const rpRes = await testEndpoint(
      'Create role-permission',
      'POST',
      '/role-permissions',
      { role_id: createdIds.role, permission_id: createdIds.permission },
      201
    );
    if (rpRes?.id) createdIds.rolePermission = rpRes.id;
  }

  // 10. CREATE Announcement
  console.log('\n-- ANNOUNCEMENT OPERATIONS --');
  const annRes = await testEndpoint(
    'Create announcement',
    'POST',
    '/announcements',
    {
      title: `TestAnn_${Date.now()}`,
      description: 'Test announcement',
      priority: 'high',
    },
    201
  );
  if (annRes?.id) createdIds.announcement = annRes.id;

  // 11. UPDATE Announcement
  if (createdIds.announcement) {
    await testEndpoint(
      'Update announcement',
      'PUT',
      `/announcements/${createdIds.announcement}`,
      { description: 'Updated announcement' },
      200
    );
  }

  // 12. CREATE Setting
  console.log('\n-- SETTING OPERATIONS --');
  const setRes = await testEndpoint(
    'Create setting',
    'POST',
    '/settings',
    {
      key: `test_setting_${Date.now()}`,
      value: { test: 'value' },
    },
    201
  );
  if (setRes?.id) createdIds.setting = setRes.id;

  // 13. UPDATE Setting
  if (createdIds.setting) {
    await testEndpoint(
      'Update setting',
      'PUT',
      `/settings/${createdIds.setting}`,
      { value: { updated: true } },
      200
    );
  }

  // 14. DELETE operations (at end, to not break subsequent tests)
  console.log('\n-- DELETE OPERATIONS --');
  if (createdIds.rolePermission) {
    await testEndpoint('Delete role-permission', 'DELETE', `/role-permissions/${createdIds.rolePermission}`, null, 200);
  }
  if (createdIds.permission) {
    await testEndpoint('Delete permission', 'DELETE', `/permissions/${createdIds.permission}`, null, 200);
  }
  if (createdIds.announcement) {
    await testEndpoint('Delete announcement', 'DELETE', `/announcements/${createdIds.announcement}`, null, 200);
  }
  if (createdIds.setting) {
    await testEndpoint('Delete setting', 'DELETE', `/settings/${createdIds.setting}`, null, 200);
  }
  if (createdIds.role) {
    await testEndpoint('Delete role', 'DELETE', `/roles/${createdIds.role}`, null, 200);
  }

  // 15. Verify audit trail
  console.log('\n-- AUDIT TRAIL VERIFICATION --');
  const auditRes = await testEndpoint('Fetch audit trail (latest 20)', 'GET', '/audit-trail', null, 200);
  if (auditRes && Array.isArray(auditRes)) {
    console.log(`✓ Audit trail contains ${auditRes.length} entries`);
    
    // Count by action
    const actionCounts = {};
    auditRes.forEach(entry => {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      if (entry.user_id === null) {
        console.warn(`  ⚠ Entry "${entry.action}" has NULL user_id`);
      }
    });
    console.log('  Audit entries by action:');
    Object.entries(actionCounts).forEach(([action, count]) => {
      console.log(`    - ${action}: ${count}`);
    });
  }

  // 16. Verify dashboard activity
  console.log('\n-- DASHBOARD ACTIVITY VERIFICATION --');
  const activityRes = await testEndpoint('Fetch dashboard activity', 'GET', '/dashboard/activity', null, 200);
  if (activityRes && Array.isArray(activityRes)) {
    console.log(`✓ Dashboard activity contains ${activityRes.length} entries`);
  }

  console.log(`\n═══ RESULTS ═══`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});
