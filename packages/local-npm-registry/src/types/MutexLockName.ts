/**
 * The locks that can be held system-wide, each backed by its own lock file.
 */
export enum MutexLockName {
  /** Serializes whole commands that need the Verdaccio registry */
  Verdaccio = 'verdaccio-lock',
  /** Guards a single read-modify-write of the local package store */
  Store = 'local-package-store-lock'
}
