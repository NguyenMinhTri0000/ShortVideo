import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const activeUserId = localStorage.getItem('active_user_id');
    if (activeUserId) {
      config.headers['x-user-id'] = activeUserId;
    }
  }
  return config;
});

export default api;
