/**
 * Input interface for AuthCheckPassword.
 */
export interface AuthCheckPasswordInput {
  password: string;
}

/**
 * Output interface for AuthCheckPassword.
 */
export interface AuthCheckPasswordOutput {
  passwordIsCorrect: boolean;
}
