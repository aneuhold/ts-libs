import { User, validateUser } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import { ObjectId } from 'bson';
import UserRepository from '../../repositories/common/UserRepository.js';
import { TEST_USER_NAME_PREFIX } from '../../tests/globalTestVariables.js';
import IValidator from '../BaseValidator.js';

/**
 * Validator for the User class.
 */
export default class UserValidator extends IValidator<User> {
  async validateNewObject(newUser: User): Promise<void> {
    // Check if the username already exists
    const userRepo = UserRepository.getRepo();
    await this.checkIfUserNameExists(userRepo, newUser.userName);
  }

  /**
   * Validates the object to be updated.
   *
   * @param userToUpdate - The user to be updated.
   * @returns A promise that resolves when the validation is complete.
   */
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
        `${
          User.name
        } with ID: ${userToUpdate._id?.toString()} does not exist in the database.`,
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

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const userRepo = UserRepository.getRepo();
    const allUsers = await userRepo.getAll();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'User',
      allDocs: allUsers,
      shouldDelete: (user: User) => {
        if (user.userName.startsWith(TEST_USER_NAME_PREFIX)) {
          DR.logger.error(
            `User with ID: ${user._id.toString()} is a test user and should be deleted`
          );
          return true;
        }
        return false;
      },
      documentValidator: validateUser,
      deletionFunction: async (docIdsToDelete: ObjectId[]) => {
        await userRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: User[]) => {
        await userRepo.updateMany(docsToUpdate);
      }
    });
  }

  /**
   * Checks if the username exists already and throws an error if it does.
   *
   * @param userRepo - The user repository
   * @param userName - The username to check
   * @throws An error if the username already exists
   */
  private async checkIfUserNameExists(
    userRepo: UserRepository,
    userName: string
  ) {
    const userNameSearchResult = await userRepo.get({
      userName
    });
    if (userNameSearchResult) {
      DR.logger.error('Username already exists');
      ErrorUtils.throwError('Username already exists', { userName });
    }
  }
}
