export const API_BASE_URL = '/api';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
  },
  TASKS: {
    BASE: `${API_BASE_URL}/tasks`,
    ENHANCED: `${API_BASE_URL}/enhanced-tasks`,
    BY_ID: (id: string) => `${API_BASE_URL}/tasks/${id}`,
  },
  USERS: {
    BASE: `${API_BASE_URL}/users`,
    PROFILE: `${API_BASE_URL}/profile`,
  },
  PROJECTS: {
    BASE: `${API_BASE_URL}/projects`,
  },
  CLIENTS: {
    BASE: `${API_BASE_URL}/clients`,
  },
  NOTIFICATIONS: {
    BASE: `${API_BASE_URL}/notifications`,
    READ: (id: string) => `${API_BASE_URL}/notifications/read/${id}`,
  },
}; 