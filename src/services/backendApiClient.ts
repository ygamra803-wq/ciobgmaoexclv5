/**
 * 🏛️ GMAO Enterprise Backend API Client
 * Bridges the frontend application with the Node.js + Express backend server
 * with automatic fallback to local IndexedDB/LocalStorage when offline.
 */

import axios from 'axios';
import { Logger } from '../core/logger/LoggerService';

const API_BASE = '/api/gmao';

export const backendApiClient = {
  async fetchFullState(): Promise<any | null> {
    try {
      const response = await axios.get(`${API_BASE}/state`, { timeout: 5000 });
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      Logger.warn('[BackendApiClient] Server offline or unreachable, falling back to local persistence:', err);
      return null;
    }
  },

  async syncFullState(statePayload: any): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE}/state`, statePayload, { timeout: 8000 });
      return response.data && response.data.success;
    } catch (err) {
      Logger.warn('[BackendApiClient] Failed to sync state with backend server:', err);
      return false;
    }
  },

  async fetchEntity(entityName: string): Promise<any[] | null> {
    try {
      const response = await axios.get(`${API_BASE}/${entityName}`, { timeout: 5000 });
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      Logger.warn(`[BackendApiClient] Failed to fetch entity '${entityName}':`, err);
      return null;
    }
  },

  async saveEntityItem(entityName: string, item: any): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE}/${entityName}`, item, { timeout: 5000 });
      return response.data && response.data.success;
    } catch (err) {
      Logger.warn(`[BackendApiClient] Failed to save item to '${entityName}':`, err);
      return false;
    }
  },

  async updateEntityItem(entityName: string, id: string, updates: any): Promise<boolean> {
    try {
      const response = await axios.put(`${API_BASE}/${entityName}/${id}`, updates, { timeout: 5000 });
      return response.data && response.data.success;
    } catch (err) {
      Logger.warn(`[BackendApiClient] Failed to update item '${id}' in '${entityName}':`, err);
      return false;
    }
  },

  async deleteEntityItem(entityName: string, id: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE}/${entityName}/${id}`, { timeout: 5000 });
      return response.data && response.data.success;
    } catch (err) {
      Logger.warn(`[BackendApiClient] Failed to delete item '${id}' from '${entityName}':`, err);
      return false;
    }
  },
};
