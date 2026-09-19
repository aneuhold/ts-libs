import { ProjectName } from '@aneuhold/core-ts-db-lib';
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
import GCloudAPIService from '../GCloudAPIService/GCloudAPI.service.js';
import APIService from './API.service.js';
import type { IAPIBackend } from './IAPIBackend.js';

describe('Unit Tests', () => {
  describe('APIService', () => {
    const validateUserInput: AuthValidateUserInput = {
      userName: 'testuser',
      password: 'password123',
      project: ProjectName.Dashboard
    };

    const validateUserResponse: APIResponse<AuthValidateUserOutput> = {
      success: true,
      data: {},
      errors: []
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('setBackend', () => {
      afterEach(() => {
        APIService.setBackend(GCloudAPIService);
      });

      it('should delegate to GCloudAPIService by default', async () => {
        const spy: MockInstance = vi.spyOn(GCloudAPIService, 'authValidateUser');
        spy.mockResolvedValue(validateUserResponse);

        await APIService.validateUser(validateUserInput);

        expect(spy).toHaveBeenCalledWith(validateUserInput);
      });

      it('should route calls to the injected backend', async () => {
        /**
         * Creates a backend whose methods are all `vi.fn()` stubs.
         *
         * @param overrides - Members to replace on the stub backend.
         */
        const createStubBackend = (overrides: Partial<IAPIBackend> = {}): IAPIBackend => ({
          defaultUrl: 'https://stub.example.com/',
          authValidateUser: vi.fn(),
          authLogout: vi.fn(),
          authDeleteAccount: vi.fn(),
          projectDashboard: vi.fn(),
          admin: vi.fn(),
          projectWorkout: vi.fn(),
          setAccessToken: vi.fn(),
          setRefreshTokenString: vi.fn(),
          setOnTokensRefreshed: vi.fn(),
          setOnAuthExpired: vi.fn(),
          getUrl: vi.fn(),
          setUrl: vi.fn(),
          ...overrides
        });
        const gcloudSpy = vi.spyOn(GCloudAPIService, 'authValidateUser');
        const authValidateUser = vi
          .fn<IAPIBackend['authValidateUser']>()
          .mockResolvedValue(validateUserResponse);
        const backend = createStubBackend({ authValidateUser });

        APIService.setBackend(backend);
        const result = await APIService.validateUser(validateUserInput);

        expect(authValidateUser).toHaveBeenCalledWith(validateUserInput);
        expect(gcloudSpy).not.toHaveBeenCalled();
        expect(result).toEqual(validateUserResponse);
        expect(APIService.getDefaultAPIUrl()).toBe(backend.defaultUrl);
      });
    });

    describe('validateUser', () => {
      it('should call GCloudAPIService.authValidateUser with correct input', async () => {
        const spy: MockInstance = vi.spyOn(GCloudAPIService, 'authValidateUser');
        spy.mockResolvedValue(validateUserResponse);

        const result = await APIService.validateUser(validateUserInput);

        expect(spy).toHaveBeenCalledWith(validateUserInput);
        expect(result).toEqual(validateUserResponse);
      });
    });

    describe('callDashboardAPI', () => {
      it('should call GCloudAPIService.projectDashboard with correct input', async () => {
        const input: ProjectDashboardInput = {
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

    describe('setOnAuthExpired', () => {
      it('should call GCloudAPIService.setOnAuthExpired with the callback', () => {
        const spy = vi.spyOn(GCloudAPIService, 'setOnAuthExpired');
        const callback = vi.fn();

        APIService.setOnAuthExpired(callback);

        expect(spy).toHaveBeenCalledWith(callback);
      });
    });
  });
});
