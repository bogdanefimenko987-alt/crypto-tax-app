import apiClient from './client';

export const getPortfolioHistory = () => apiClient.get('/portfolio/history').then((res) => res.data);
export const getPortfolioPnl = () => apiClient.get('/portfolio/pnl').then((res) => res.data);
export const getCategories = () => apiClient.get('/portfolio/categories').then((res) => res.data);
export const setCategory = (currency: string, category: string) =>
  apiClient.post('/portfolio/categories', { currency, category }).then((res) => res.data);