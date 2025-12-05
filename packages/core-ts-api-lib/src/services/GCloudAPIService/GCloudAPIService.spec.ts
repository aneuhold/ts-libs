import type { UUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthValidateUserInput } from '../../types/AuthValidateUser.js';
import type { ProjectDashboardInput } from '../../types/ProjectDashboard.js';
import GCloudAPIService from './GCloudAPIService.js';

describe('Unit Tests', () => {
  describe('GCloudAPIService', () => {
    /**
     * Can be used to work with the global fetch mock
     */
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      GCloudAPIService.setUrl('https://test-url.com/');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    describe('setUrl', () => {
      it('should set the base URL', async () => {
        GCloudAPIService.setUrl('https://new-url.com/');

        const mockResponse = { success: true, data: {}, errors: [] };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = { apiKey: '123' as unknown as UUID, options: {} };
        await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/^https:\/\/new-url\.com\//),
          expect.any(Object)
        );
      });
    });

    describe('authValidateUser', () => {
      it('should call the correct endpoint with correct input', async () => {
        const mockResponse = {
          success: true,
          data: { token: 'test-token' },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: AuthValidateUserInput = {
          userName: 'testuser',
          password: 'password123'
        };
        const result = await GCloudAPIService.authValidateUser(input);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://test-url.com/auth/validateUser',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input)
          })
        );

        const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(callArgs[1].headers).toEqual(
          expect.objectContaining({
            'Content-Type': 'application/json'
          })
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('projectDashboard', () => {
      it('should call the correct endpoint with correct input', async () => {
        const mockResponse = {
          success: true,
          data: { projects: [] },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = {
          apiKey: '123' as unknown as UUID,
          options: { get: { translations: true } }
        };
        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://test-url.com/project/dashboard',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input)
          })
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Date Parsing', () => {
      it('should use DateService.dateReviver to parse dates', async () => {
        const dateStr = '2023-10-27T10:00:00.000Z';
        const mockResponse = {
          success: true,
          data: {
            createdAt: dateStr,
            name: 'Test Project'
          },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = {
          apiKey: '123' as unknown as UUID,
          options: {}
        };
        const result = await GCloudAPIService.projectDashboard(input);
        const data = result.data as unknown as { createdAt: Date; name: string };

        expect(data).toBeDefined();
        expect(data.createdAt).toBeInstanceOf(Date);
        expect(data.createdAt.toISOString()).toBe(dateStr);
        expect(data.name).toBe('Test Project');
      });
    });

    describe('Error Handling', () => {
      it('should handle JSON parse errors gracefully', async () => {
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve('Invalid JSON')
        });

        const input: ProjectDashboardInput = {
          apiKey: '123' as unknown as UUID,
          options: {}
        };
        const result = await GCloudAPIService.projectDashboard(input);

        expect(result.success).toBe(false);
        expect(result.errors[0]).toBe('Failed to parse response');
      });

      it('should handle fetch errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const input: ProjectDashboardInput = {
          apiKey: '123' as unknown as UUID,
          options: {}
        };
        await expect(GCloudAPIService.projectDashboard(input)).rejects.toThrow('Network error');
      });
    });
  });
});
