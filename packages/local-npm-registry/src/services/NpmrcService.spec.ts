import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { NpmrcService } from './NpmrcService.js';

vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        setVerboseLogging: vi.fn(),
        isVerboseLoggingEnabled: vi.fn(() => false)
      }
    }
  };
});

describe('Unit Tests', () => {
  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
  });

  beforeEach(async () => {
    await TestProjectUtils.setupTestInstance();
  });

  afterEach(async () => {
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('getAllNpmrcConfigs', () => {
    beforeEach(() => {
      // Clear npmrc cache before each test to ensure isolation
      NpmrcService.clearNpmrcCache();
    });

    afterEach(() => {
      // Clear npmrc cache after each test to ensure isolation
      NpmrcService.clearNpmrcCache();
    });

    it('should parse a single .npmrc file correctly', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();
      const uniqueRegistry = `https://single-registry-${timestamp}.example.com`;

      const npmrcContent = `# Single .npmrc file test
@test-org:registry=${uniqueRegistry}
//${uniqueRegistry.replace('https://', '')}/:_authToken=test-token-${timestamp}
test-setting=test-value
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);

      expect(configs.size).toBeGreaterThanOrEqual(3);
      expect(configs.get('@test-org:registry')).toBe(uniqueRegistry);
      expect(
        configs.get(`//${uniqueRegistry.replace('https://', '')}/:_authToken`)
      ).toBe(`test-token-${timestamp}`);
      expect(configs.get('test-setting')).toBe('test-value');
    });

    it('should handle multi-layer .npmrc files with correct precedence', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();

      const scenario =
        await TestProjectUtils.createTestNpmrcScenario(testInstanceDir);

      // Change to the deepest directory to test parsing up the tree
      const configs = await NpmrcService.getAllNpmrcConfigs(
        scenario.structure.deepestDir
      );

      // Should contain at least our expected configs (may have more from local machine)
      expect(configs.size).toBeGreaterThanOrEqual(
        scenario.expectedConfigs.size
      );

      // Verify all expected configurations are present with correct values
      for (const [key, expectedValue] of scenario.expectedConfigs) {
        expect(configs.get(key)).toBe(expectedValue);
      }

      // Verify precedence: project-level should override root/middle for shared keys
      expect(configs.get('some-global-setting')).toBe('project-value');
    });

    it('should ignore comments and empty lines in .npmrc files', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      const npmrcContent = `# This is a comment
# Another comment

@test-org:registry=https://test-${timestamp}.example.com

; This is also a comment
valid-setting=valid-value

# Final comment
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);

      // Should only have the valid key-value pairs, not comments
      expect(configs.get('@test-org:registry')).toBe(
        `https://test-${timestamp}.example.com`
      );
      expect(configs.get('valid-setting')).toBe('valid-value');

      // Should not contain comment keys
      expect(configs.has('# This is a comment')).toBe(false);
      expect(configs.has('; This is also a comment')).toBe(false);
    });

    it('should cache results on subsequent calls', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        `test-cached-setting=cached-value-${timestamp}`
      );

      // First call should read from files
      const configs1 = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs1.get('test-cached-setting')).toBe(
        `cached-value-${timestamp}`
      );

      // Modify the .npmrc file after first call
      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        `test-cached-setting=modified-value-${timestamp}`
      );

      // Second call should return cached result (not the modified value)
      const configs2 = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs2.get('test-cached-setting')).toBe(
        `cached-value-${timestamp}`
      );
      expect(configs1).toBe(configs2); // Should be the same Map instance

      // Clear cache and call again should read the modified file
      NpmrcService.clearNpmrcCache();
      const configs3 = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);
      expect(configs3.get('test-cached-setting')).toBe(
        `modified-value-${timestamp}`
      );
    });

    it('should handle malformed .npmrc files gracefully', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();

      const malformedNpmrcContent = `# Valid comment
valid-key=valid-value
malformed-line-without-equals
=value-without-key
key-without-value=
@test-org:registry=https://test-${timestamp}.example.com
another=valid-entry
`;

      await TestProjectUtils.createNpmrcFile(
        testInstanceDir,
        malformedNpmrcContent
      );

      const configs = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);

      // Should successfully parse valid entries
      expect(configs.get('valid-key')).toBe('valid-value');
      expect(configs.get('@test-org:registry')).toBe(
        `https://test-${timestamp}.example.com`
      );
      expect(configs.get('another')).toBe('valid-entry');
      expect(configs.get('key-without-value')).toBe('');

      // Should not contain malformed entries
      expect(configs.has('malformed-line-without-equals')).toBe(false);
      expect(configs.has('')).toBe(false); // Empty key from "=value-without-key"
    });

    it('should handle organization registries and auth tokens for VerdaccioService integration', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();
      const timestamp = Date.now();
      const testRegistries = [
        `https://org1-registry-${timestamp}.example.com`,
        `https://org2-registry-${timestamp}.example.com`
      ];

      const npmrcContent = `# Organization-specific registries
@test-org1:registry=${testRegistries[0]}
@test-org2:registry=${testRegistries[1]}

# Auth tokens for the registries
//${testRegistries[0].replace('https://', '')}/:_authToken=token1-${timestamp}
//${testRegistries[1].replace('https://', '')}/:_authToken=token2-${timestamp}

# Other settings
registry=https://registry.npmjs.org/
save-exact=true
`;

      await TestProjectUtils.createNpmrcFile(testInstanceDir, npmrcContent);

      const configs = await NpmrcService.getAllNpmrcConfigs(testInstanceDir);

      // Verify organization registries
      expect(configs.get('@test-org1:registry')).toBe(testRegistries[0]);
      expect(configs.get('@test-org2:registry')).toBe(testRegistries[1]);

      // Verify auth tokens
      expect(
        configs.get(
          `//${testRegistries[0].replace('https://', '')}/:_authToken`
        )
      ).toBe(`token1-${timestamp}`);
      expect(
        configs.get(
          `//${testRegistries[1].replace('https://', '')}/:_authToken`
        )
      ).toBe(`token2-${timestamp}`);

      // Verify other settings
      expect(configs.get('registry')).toBe('https://registry.npmjs.org/');
      expect(configs.get('save-exact')).toBe('true');
    });

    it('should work correctly when called from different directories', async () => {
      const testInstanceDir = TestProjectUtils.getTestInstanceDir();

      // Create nested directory structure with .npmrc files
      const scenario =
        await TestProjectUtils.createTestNpmrcScenario(testInstanceDir);

      // Test from root level directory
      const configsFromRoot = await NpmrcService.getAllNpmrcConfigs(
        scenario.structure.directories[0]
      );

      // Test from deepest directory
      const configsFromDeep = await NpmrcService.getAllNpmrcConfigs(
        scenario.structure.deepestDir
      );

      // Root level should only see its own .npmrc
      expect(configsFromRoot.get('some-global-setting')).toBe('root-value');
      expect(configsFromRoot.has('middle-specific-setting')).toBe(false);
      expect(configsFromRoot.has('project-specific-setting')).toBe(false);

      // Deep level should see all .npmrc files with correct precedence
      expect(configsFromDeep.get('some-global-setting')).toBe('project-value');
      expect(configsFromDeep.get('middle-specific-setting')).toBe(
        'middle-specific-value'
      );
      expect(configsFromDeep.get('project-specific-setting')).toBe(
        'project-specific-value'
      );
    });
  });
});
