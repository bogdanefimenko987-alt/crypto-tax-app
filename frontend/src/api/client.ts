import axios from 'axios';

// Если VITE_API_URL задан, используем его с добавлением /api
// Иначе оставляем '/api' для локальной разработки
const baseURL = (import.meta.env.VITE_API_URL || '') + '/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;