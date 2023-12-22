import AuthCheckPassword from './functions/authCheckPassword';
import AuthValidateUser from './functions/authValidateUser';
import ProjectDashboard from './functions/projectDashboard';

/**
 * A service to provide some utility related to Digital Ocean functions.
 */
export default class DOFunctionService {
  static auchCheckPassword = AuthCheckPassword.getFunction();

  static authValidateUser = AuthValidateUser.getFunction();

  static projectDashboard = ProjectDashboard.getFunction();
}
