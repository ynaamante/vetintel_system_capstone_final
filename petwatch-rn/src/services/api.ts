import { NativeModules, Platform } from 'react-native';
import { resolveApiUrl } from './apiBaseUrl';

function apiUrl() {
  const source = NativeModules.SourceCode;
  return resolveApiUrl({
    configuredUrl: process.env.EXPO_PUBLIC_API_URL,
    platform: Platform.OS,
    scriptUrl: source?.scriptURL || source?.getConstants?.()?.scriptURL,
    webHostname: typeof window !== 'undefined' ? window.location?.hostname : undefined,
  });
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  token?: string;
  body?: any;
  timeoutMs?: number;
}

const invalidSessionListeners = new Set<(token: string) => void>();
export function onInvalidSession(listener: (token: string) => void) {
  invalidSessionListeners.add(listener);
  return () => { invalidSessionListeners.delete(listener); };
}

// Generic API call handler
export async function apiCall(
  endpoint: string,
  options: ApiOptions = {}
) {
  const { method = 'GET', token, body, timeoutMs = 20000 } = options;
  const API_URL = apiUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const invalidSession = token && (response.status === 401 || error.code === 'SESSION_INVALID'
        || response.status === 403 && error.error === 'Forbidden' && (endpoint.startsWith('/owner/') || endpoint === '/me'));
      if (invalidSession) invalidSessionListeners.forEach(listener => listener(token!));
      throw Object.assign(new Error(error.error || error.message || `HTTP ${response.status}`), { code: error.code, email: error.email, status: response.status, retryAfter: error.retry_after, deliveryError: error.delivery_error });
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Check that the backend is running, then try again.');
    }
    if (!error.status && (error instanceof TypeError || /network request failed|fetch failed|failed to fetch|ConnectException/i.test(error.message || ''))) {
      throw new Error(`Cannot connect to the server at ${API_URL}. Check that the backend is running${Platform.OS === 'web' ? '.' : ' and your phone and computer are on the same Wi-Fi.'}`);
    }
    // The screen shows handled errors. console.error would open Expo's red
    // development overlay for an ordinary connection/validation failure.
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ==================== AUTH ====================

const session = (response: any) => {
  const { token, ...fields } = response;
  const user = response.user || fields;
  if (!token || user.id == null || !user.email) throw new Error('Invalid login response');
  return { token, user };
};
export const authApi = {
  forgotPassword: (email: string) => apiCall('/password/forgot', { method: 'POST', body: { email: email.trim().toLowerCase() } }),
  verifyResetCode: (email: string, code: string) => apiCall('/password/verify', { method: 'POST', body: { email: email.trim().toLowerCase(), code } }),
  resetPassword: (email: string, code: string, password: string) => apiCall('/password/reset', { method: 'POST', body: { email: email.trim().toLowerCase(), code, password } }),
  register: async (name: string, email: string, password: string, profile: { phone?: string; accepted_terms?: boolean } = {}) => {
    return apiCall('/register', {
      method: 'POST',
      body: { name: name.trim(), email: email.trim().toLowerCase(), password, ...profile },
    });
  },
  login: async (email: string, password: string) => {
    const response = await apiCall('/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
    // The shared backend returns the user fields alongside the token.
    return session(response);
  },
  verifyEmail: async (email: string, code: string) => session(await apiCall('/verify-email', { method: 'POST', body: { email: email.trim().toLowerCase(), code } })),
  resendVerification: async (email: string) => apiCall('/resend-verification', { method: 'POST', body: { email: email.trim().toLowerCase() } }),

  getMe: async (token: string) => {
    return apiCall('/me', { method: 'GET', token });
  },

  logout: async (token: string) => {
    return apiCall('/logout', { method: 'POST', token });
  },
};

// ==================== PETS ====================

export const petsApi = {
  list: async (token: string) => {
    return apiCall('/owner/pets', { method: 'GET', token });
  },

  getById: async (petId: string, token: string) => {
    return apiCall(`/owner/pets/${encodeURIComponent(petId)}`, { method: 'GET', token });
  },

  create: async (data: any, token: string) => {
    return apiCall('/owner/pets', {
      method: 'POST',
      token,
      body: data,
    });
  },

  update: async (petId: string, data: any, token: string) => {
    return apiCall(`/owner/pets/${encodeURIComponent(petId)}`, {
      method: 'PUT',
      token,
      body: data,
    });
  },

  delete: async (petId: string, token: string) => {
    return apiCall(`/clinic-records/pets/${petId}`, {
      method: 'DELETE',
      token,
    });
  },
};

// ==================== APPOINTMENTS ====================

export const ownerCareApi = {
  medicalActivity: (id: string, token: string) => apiCall(`/owner/clinic-pets/${encodeURIComponent(id)}/medical-activity`, { token }),
  archivedPets: (token: string) => apiCall('/owner/archived-pets', { token }),
  archivePet: (id: string, source: 'clinic' | 'account', archived: boolean, token: string) => apiCall('/owner/pet-archive', { method: 'POST', token, body: { pet_id: id, source, archived } }),
  uploadPhoto: (id: string, clinic: boolean, data: string, token: string) => apiCall(`/owner/${clinic ? 'clinic-pets' : 'pets'}/${encodeURIComponent(id)}/photo`, { method: 'POST', token, body: { data } }),
  updatePet: (id: string, data: any, token: string) => apiCall(`/owner/clinic-pets/${encodeURIComponent(id)}`, { method: 'PUT', token, body: data }),
  overview: (token: string) => apiCall('/owner/care', { token }),
  book: (data: { pet_id: string; clinic_id: string; start_time: string; reason: string; notes: string }, token: string) =>
    apiCall('/owner/appointments', { method: 'POST', token, body: data }),
};

export const appointmentsApi = {
  list: async (token: string, filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiCall(`/clinic-records/appointments${query}`, {
      method: 'GET',
      token,
    });
  },

  getById: async (appointmentId: string, token: string) => {
    return apiCall(`/clinic-records/appointments/${appointmentId}`, {
      method: 'GET',
      token,
    });
  },

  create: async (data: any, token: string) => {
    return apiCall('/clinic-records/appointments', {
      method: 'POST',
      token,
      body: data,
    });
  },

  update: async (appointmentId: string, data: any, token: string) => {
    return apiCall(`/clinic-records/appointments/${appointmentId}`, {
      method: 'PUT',
      token,
      body: data,
    });
  },

  cancel: async (appointmentId: string, token: string) => {
    return apiCall(`/clinic-records/appointments/${appointmentId}`, {
      method: 'DELETE',
      token,
    });
  },
};

// ==================== VACCINATIONS ====================

export const vaccinationsApi = {
  list: async (token: string, petId?: string) => {
    const query = petId ? `?pet_id=${petId}` : '';
    return apiCall(`/clinic-records/vaccinations${query}`, {
      method: 'GET',
      token,
    });
  },

  create: async (data: any, token: string) => {
    return apiCall('/clinic-records/vaccinations', {
      method: 'POST',
      token,
      body: data,
    });
  },

  update: async (vaccinationId: string, data: any, token: string) => {
    return apiCall(`/clinic-records/vaccinations/${vaccinationId}`, {
      method: 'PUT',
      token,
      body: data,
    });
  },
};

// ==================== CLINICS ====================

export const clinicsApi = {
  list: async (token?: string, filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiCall(`/clinics${query}`, {
      method: 'GET',
      token,
    });
  },

  getById: async (clinicId: string, token?: string) => {
    return apiCall(`/clinics/${clinicId}`, { method: 'GET', token });
  },

  getNearby: async (token?: string, latitude?: number, longitude?: number) => {
    const query = latitude !== undefined && longitude !== undefined
      ? `?lat=${latitude}&lon=${longitude}`
      : '';
    return apiCall(`/clinics/nearby${query}`, { method: 'GET', token });
  },
};

// ==================== HEALTH RECORDS ====================

export const healthRecordsApi = {
  getVaccinations: async (petId: string, token: string) => {
    return apiCall(`/clinic-records/vaccinations?pet_id=${petId}`, {
      method: 'GET',
      token,
    });
  },

  getTreatments: async (petId: string, token: string) => {
    return apiCall(`/clinic-records/treatments?pet_id=${petId}`, {
      method: 'GET',
      token,
    });
  },

  getReminders: async (token: string) => {
    return apiCall('/clinic-records/reminders', {
      method: 'GET',
      token,
    });
  },
};

// ==================== OWNER-SHARED CLINIC RECORDS ====================

export const ownerSharedRecordsApi = {
  list: async (token: string) => apiCall('/owner/shared-records', { method: 'GET', token }),
};

export type OwnerConversation = {
  id: string; petId: number; petName: string; clinicName: string; status: string;
  preview: string; time: string; unread: boolean;
  messages: { text: string; time: string; source: string; author: string; sharedRecord?: { shareId: string; recordId: string; title: string; type?: string; category?: string; detail?: string; date?: string } }[];
};
export const ownerInboxApi = {
  list: (token: string): Promise<OwnerConversation[]> => apiCall('/owner/inbox', { token }),
  create: (token: string, petId: number): Promise<OwnerConversation> => apiCall('/owner/inbox', { method: 'POST', token, body: { pet_id: petId } }),
  send: (token: string, id: string, text: string, sharedRecord?: { shareId: string; recordId: string }): Promise<OwnerConversation> => apiCall(`/owner/inbox/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: { text, ...(sharedRecord ? { sharedRecord } : {}) } }),
  read: (token: string, id: string): Promise<OwnerConversation> => apiCall(`/owner/inbox/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: { read: true } }),
};

// ==================== ALERTS & NOTIFICATIONS ====================

export const alertsApi = {
  list: async (token: string) => {
    return apiCall('/announcements', { method: 'GET', token });
  },

  markAsRead: async (alertId: string, token: string) => {
    return apiCall(`/announcements/${alertId}`, {
      method: 'PUT',
      token,
      body: { read: true },
    });
  },
};

// ==================== USERS ====================
export interface OwnerNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: string;
  date: string;
  read: boolean;
  received: boolean;
  petId: number | null;
  clinicName: string;
  accessRequestId?: string;
  requestStatus?: string;
  requestExpiresAt?: string;
  accessExpiresAt?: string;
}
export const petSharingApi = {
  issue: (id: string, token: string) => apiCall(`/owner/clinic-pets/${encodeURIComponent(id)}/qr`, { method: 'POST', token }),
  decide: (id: string, action: 'approve' | 'deny' | 'revoke', token: string) => apiCall(`/owner/sharing-requests/${encodeURIComponent(id)}/decision`, { method: 'POST', token, body: { action } }),
};
export const ownerNotificationsApi = {
  list: async (token: string): Promise<OwnerNotification[]> => {
    const [notifications, requests] = await Promise.all([apiCall('/owner/notifications', { token }), apiCall('/owner/sharing-requests', { token })]);
    return [...notifications, ...requests].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  acknowledge: (token: string, ids: string[]) => apiCall('/owner/notifications/acknowledge', { method: 'POST', token, body: { ids } }),
  markRead: (token: string, id: string) => apiCall(id.startsWith('share-') ? `/owner/sharing-requests/${encodeURIComponent(id.slice(6))}/read` : `/owner/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', token }),
  markAllRead: async (token: string) => {
    const rows = await Promise.all([apiCall('/owner/notifications/read-all', { method: 'PATCH', token }),apiCall('/owner/sharing-requests/read-all', { method: 'PATCH', token })]);
    return { ids: rows.flatMap(r => r.ids) };
  },
};

export const usersApi = {
  create: async (data: any) => {
    return apiCall('/users', {
      method: 'POST',
      body: data,
    });
  },

  update: async (userId: string, data: any, token: string) => {
    return apiCall(`/users/${userId}`, {
      method: 'PUT',
      token,
      body: data,
    });
  },

  getProfile: async (token: string) => {
    return apiCall('/me', { method: 'GET', token });
  },
};

export default {
  authApi,
  petsApi,
  appointmentsApi,
  vaccinationsApi,
  clinicsApi,
  healthRecordsApi,
  ownerSharedRecordsApi,
  alertsApi,
  ownerNotificationsApi,
  usersApi,
};
