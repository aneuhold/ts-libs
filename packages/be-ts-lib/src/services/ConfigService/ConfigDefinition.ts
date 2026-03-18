/**
 * The environment configuration that is pulled in for the current environment
 * from the GitHub repository.
 */
export default interface Config {
  someKey: string;
  mongoRootUsername: string;
  mongoRootPassword: string;
  mongoUrl: string;
  /** Secret used to sign JWT access tokens. */
  jwtAccessSecret: string;
  /** Test user credentials for e2e tests. */
  testUserInfo: {
    userName: string;
    password: string;
  };
}
