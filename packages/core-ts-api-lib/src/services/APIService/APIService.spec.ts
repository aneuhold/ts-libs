import type { UUID } from 'crypto';
import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { APIResponse } from '../../types/APIResponse.js';
import type {
  AuthValidateUserInput,
  AuthValidateUserOutput
} from '../../types/AuthValidateUser.js';
import type {
  ProjectDashboardInput,
  ProjectDashboardOutput
} from '../../types/project/dashboard/ProjectDashboard.js';
import GCloudAPIService from '../GCloudAPIService/GCloudAPIService.js';
import APIService from './APIService.js';

describe('Unit Tests', () => {
  describe('APIService', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('validateUser', () => {
      it('should call GCloudAPIService.authValidateUser with correct input', async () => {
        const input: AuthValidateUserInput = {
          userName: 'testuser',
          password: 'password123'
        };
        const mockResponse: APIResponse<AuthValidateUserOutput> = {
          success: true,
          data: {},
          errors: []
        };

        const spy: MockInstance = vi.spyOn(GCloudAPIService, 'authValidateUser');
        spy.mockResolvedValue(mockResponse);

        const result = await APIService.validateUser(input);

        expect(spy).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('callDashboardAPI', () => {
      it('should call GCloudAPIService.projectDashboard with correct input', async () => {
        const input: ProjectDashboardInput = {
          apiKey: '123' as unknown as UUID,
          options: {}
        };
        const mockResponse: APIResponse<ProjectDashboardOutput> = {
          success: true,
          data: {},
          errors: []
        };

        const spy: MockInstance = vi.spyOn(GCloudAPIService, 'projectDashboard');
        spy.mockResolvedValue(mockResponse);

        const result = await APIService.callDashboardAPI(input);

        expect(spy).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('setAPIUrl', () => {
      it('should call GCloudAPIService.setUrl with correct url', () => {
        const spy = vi.spyOn(GCloudAPIService, 'setUrl');

        const url = 'https://api.example.com/';
        APIService.setAPIUrl(url);

        expect(spy).toHaveBeenCalledWith(url);
      });
    });
  });
});
