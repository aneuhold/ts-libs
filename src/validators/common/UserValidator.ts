import { User } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import IValidator from '../BaseValidator';
import UserRepository from '../../repositories/common/UserRepository';

export default class UserValidator extends IValidator<User> {
  async validateNewObject(newUser: User): Promise<void> {
    // Check if the username already exists
    const userRepo = UserRepository.getRepo();
    await this.checkIfUserNameExists(userRepo, newUser.userName);
  }

  async validateUpdateObject(userToUpdate: Partial<User>): Promise<void> {
    // Check if an id is defined
    if (!userToUpdate._id) {
      ErrorUtils.throwError(
        `No _id defined for ${User.name} to update.`,
        userToUpdate
      );
    }

    // Check to see if the user exists
    const userRepo = UserRepository.getRepo();
    const userInDb = await userRepo.get({ _id: userToUpdate._id });
    if (!userInDb) {
      ErrorUtils.throwError(
        `${User.name} with ID: ${userToUpdate._id} does not exist in the database.`,
        userToUpdate
      );
      return;
    }

    // Check if the username is being updated and, if it is, if it already
    // exists
    if (userToUpdate.userName && userInDb.userName !== userToUpdate.userName) {
      await this.checkIfUserNameExists(userRepo, userToUpdate.userName);
    }
  }

  validateRepositoryInDb(dryRun: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Checks if the username exists already and throws an error if it does.
   */
  private async checkIfUserNameExists(
    userRepo: UserRepository,
    userName: string
  ) {
    const userNameSearchResult = await userRepo.get({
      userName
    });
    if (userNameSearchResult) {
      ErrorUtils.throwError('Username already exists', { userName });
    }
  }
}
