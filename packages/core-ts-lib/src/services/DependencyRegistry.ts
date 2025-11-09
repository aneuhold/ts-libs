import type { ILogger } from '../interfaces/ILogger.js';
import type { ITracer } from '../interfaces/ITracer.js';
import { NoopTracer } from '../interfaces/ITracer.js';
import ConsoleLogger from '../utils/ConsoleLogger.js';

/**
 * A simple static registry for managing singleton service instances like loggers and tracers.
 * Provides a central point for accessing shared services throughout an application.
 */
export class DependencyRegistry {
  // Initialize with concrete defaults
  private static loggerInstance: ILogger = new ConsoleLogger();
  private static tracerInstance: ITracer = new NoopTracer();

  /**
   * Registers a logger implementation, overwriting the existing one.
   * Should typically be called once at application startup if a custom logger is needed.
   *
   * @param instance - The ILogger instance to register.
   */
  public static registerLogger(instance: ILogger): void {
    this.loggerInstance = instance;
  }

  /**
   * Gets the currently registered logger instance.
   * Defaults to ConsoleLogger if no other logger has been registered.
   *
   * @returns The registered ILogger instance.
   */
  public static get logger(): ILogger {
    return this.loggerInstance;
  }

  /**
   * Registers a tracer implementation, overwriting the existing one.
   * Should typically be called once at application startup if tracing is needed.
   *
   * @param instance - The ITracer instance to register.
   */
  public static registerTracer(instance: ITracer): void {
    this.tracerInstance = instance;
  }

  /**
   * Gets the currently registered tracer instance.
   * Defaults to NoopTracer if no other tracer has been registered.
   *
   * @returns The registered ITracer instance.
   */
  public static get tracer(): ITracer {
    return this.tracerInstance;
  }
}

/**
 * Alias for DependencyRegistry for more succinct usage.
 */
export const DR = DependencyRegistry;
