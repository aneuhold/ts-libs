import { exec as normalExec, ExecOptions, spawn } from 'child_process';
import * as rl from 'readline';
import util from 'util';
import sleep from '../helperFunctions/sleep';
import CurrentEnv, { OperatingSystemType } from '../utils/CurrentEnv';
import Logger from '../utils/Logger';

/**
 * The promisified version of the {@link normalExec} function.
 */
const execute = util.promisify(normalExec);

type ExecCmdReturnType = { didComplete: boolean; output: string };

/**
 * A service which can be used to interact with the command line on the current
 * system.
 */
export default class CLIService {
  private static POWERSHELL_PREFIX = `pwsh -NoProfile -Command `;

  /**
   * Executes the given command in a shell environment. Spins up a separate
   * process to execute the command and returns a promise once it is completely
   * finished.
   *
   * The shell environment chosen is determined by the `CurrentEnv` class.
   *
   * @param cmd the command to run. This is ran as a normal execution where the
   * output is all returned at once after completion. For example this could be
   * `ls -a`.
   *
   * @param logError if set to false, it will not output a log if an error
   * occurs in `stderr` when executing the function. This can be useful if
   * a command regularly outputs an error even when it succeeds. This  only
   * applies to commands ran with normal execution.
   *
   * @param cwd the current working directory to run the command in. If not
   * provided, it will use the current working directory of the process.
   *
   * @param useProfile if set to true will use the current profile or zshrc of
   * the shell environment. By default this is false.
   *
   * @returns an object that holds the output and true if the command completed
   * successfully or false if it did not.
   */
  static async execCmd(
    cmd: string,
    logError = false,
    cwd?: string,
    useProfile = false
  ): Promise<ExecCmdReturnType> {
    const execOptions: ExecOptions = {};
    if (cwd) {
      execOptions.cwd = cwd;
    }

    let commandToExecute = cmd;

    // Set the powershell prefix if the current OS is Windows so that
    // the profile is not ran before the command.
    if (CurrentEnv.os === OperatingSystemType.Windows && !useProfile) {
      commandToExecute = `${CLIService.POWERSHELL_PREFIX}${cmd}`;
    } else if (CurrentEnv.os === OperatingSystemType.Windows && useProfile) {
      execOptions.shell = 'pwsh';
    }

    Logger.verbose.info(`Executing command: ${commandToExecute}`);
    try {
      const { stdout, stderr } = await execute(commandToExecute, execOptions);
      if (stderr) {
        if (logError) {
          Logger.error(`There was an error executing ${cmd}. Details are printed below:
            ${stderr}`);
        }
        return {
          didComplete: false,
          output: stderr
        };
      }
      Logger.verbose.info(`Output from stdout is: ${stdout}`);
      return {
        didComplete: true,
        output: stdout
      };
    } catch (err) {
      Logger.verbose
        .error(`There was an error executing the "exec" function. Details are printed below:
        ${err}`);
      return {
        didComplete: false,
        output: err as string
      };
    }
  }

  /**
   * Executes the given command but fulfills the
   * promise when either the command completes, or the given number of ms have
   * passed. Whichever comes first.
   *
   * @param command the command to execute
   * @param ms the number of milliseconds to wait. This is 5 seconds by default.
   */
  static async execCmdWithTimeout(
    command: string,
    ms = 5000
  ): Promise<ExecCmdReturnType> {
    const sleepPromise: Promise<ExecCmdReturnType> = sleep(ms).then(() => {
      return {
        didComplete: false,
        output: `Command ended after ${ms} ms.`
      };
    });
    return Promise.any([sleepPromise, CLIService.execCmd(command)]);
  }

  /**
   * Spawns a new process where the command is ran as a stream where all
   *  output is streamed to the console.
   * This is helpful for long-running commands or commands
   * that output a lot of data. For example `yarn` or `npm install`.
   * All of the output from this is logged by default because of the listeners
   * involved. This could be changed in the future though.
   *
   * @param cmd the command to run. This is the the first argument passed to the
   * `spawn` function. For example this could be `npm`.
   * @param args the arguments to pass to the command. For example this could be
   * `['install', 'react']`.
   */
  static async spawnCmd(
    cmd: string,
    args?: string[],
    currentWorkingDirectory?: string
  ): Promise<ExecCmdReturnType> {
    return new Promise((resolve) => {
      let output = '';
      const execOptions: ExecOptions = {
        cwd: currentWorkingDirectory
      };
      const spawnedCmd = spawn(cmd, args, execOptions);

      spawnedCmd.on('error', (err) => {
        Logger.error(`There was an error executing the "spawn" function. Details are printed below:
      ${err}`);
        resolve({
          didComplete: false,
          output: err.toString()
        });
      });
      spawnedCmd.stdout.on('data', (data) => {
        output += data;
        Logger.info(data, true);
      });
      spawnedCmd.stderr.on('data', (data) => {
        output += data;
        Logger.info(data, true);
      });
      spawnedCmd.on('close', (exitCode) => {
        Logger.info(`Command "${cmd}" exited with code ${exitCode}`);
        resolve({
          didComplete: true,
          output
        });
      });
    });
  }

  /**
   * Gets input from the user on command line.
   *
   * @param promptToUser the prompt that should be provided to the user. Include
   * a newline at the end if you want there to be one.
   */
  static async getUserInput(promptToUser: string): Promise<string> {
    const readline = rl.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise((resolve) => {
      readline.question(promptToUser, (input: string) => {
        readline.close();
        resolve(input);
      });
    });
  }
}
