import { ClearStoreCommand } from '../commands/ClearStoreCommand.js';
import { PublishCommand } from '../commands/PublishCommand.js';
import { SubscribeCommand } from '../commands/SubscribeCommand.js';
import { UnpublishCommand } from '../commands/UnpublishCommand.js';
import { UnsubscribeCommand } from '../commands/UnsubscribeCommand.js';

/**
 * Service that acts as a facade for the main CLI commands for local-npm-registry.
 * Delegates to individual command classes for implementation.
 */
export class CommandService {
  /**
   * Implements the 'local-npm publish' command.
   *
   * @param additionalArgs - Additional arguments to pass to the npm publish command
   */
  static async publish(additionalArgs: string[] = []): Promise<void> {
    return PublishCommand.execute(additionalArgs);
  }

  /**
   * Implements the 'local-npm subscribe <package-name>' command.
   *
   * @param packageName - Name of the package to subscribe to
   */
  static async subscribe(packageName: string): Promise<void> {
    return SubscribeCommand.execute(packageName);
  }

  /**
   * Implements the 'local-npm unpublish <package-name>' command.
   *
   * @param packageName - Optional package name to unpublish. If not provided, uses current directory's package.json
   */
  static async unpublish(packageName?: string): Promise<void> {
    return UnpublishCommand.execute(packageName);
  }

  /**
   * Implements the 'local-npm unsubscribe [<package-name>]' command.
   *
   * @param packageName - Optional package name to unsubscribe from. If not provided, unsubscribes from all packages
   */
  static async unsubscribe(packageName?: string): Promise<void> {
    return UnsubscribeCommand.execute(packageName);
  }

  /**
   * Implements the 'local-npm clear-store' command.
   * Unpublishes all packages and unsubscribes all subscribers.
   */
  static async clearStore(): Promise<void> {
    return ClearStoreCommand.execute();
  }
}
