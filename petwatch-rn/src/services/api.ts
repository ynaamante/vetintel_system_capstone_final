// API Service for petwatch-rn
// For a physical device, set EXPO_PUBLIC_API_URL to the backend's reachable URL.

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  token?: string;
  body?: any;
}

// Generic API call handler
export async function apiCall(
  endpoint: string,
  options: ApiOptions = {}
) {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API] ${method} ${endpoint}:`, error);
    throw error;
  }
}

// ==================== AUTH ====================

export const authApi = {
  login: async (email: string, password: string) => {
    return apiCall('/login', {
      method: 'POST',
      body: { email, password },
    });
  },

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
    return apiCall('/clinic-records/pets', { method: 'GET', token });
  },

  getById: async (petId: string, token: string) => {
    return apiCall(`/clinic-records/pets/${petId}`, { method: 'GET', token });
  },

  create: async (data: any, token: string) => {
    return apiCall('/clinic-records/pets', {
      method: 'POST',
      token,
      body: data,
    });
  },

  update: async (petId: string, data: any, token: string) => {
    return apiCall(`/clinic-records/pets/${petId}`, {
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
    const query = latitude && longitude 
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
  usersApi,
};
