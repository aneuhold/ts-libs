import Logger from '../../utils/Logger';
import OsaScriptBuilder, {
  OsaScriptTellBlock
} from '../../utils/OsaScriptBuilder';
import CLIService from '../CLIService';

export default class ITermService {
  /**
   * Splits the iTerm terminal horzontally and runs each command in a separate
   * pane.
   */
  static async splitHorizontallyAndRunCommands(commands: string[], cwd = '') {
    const terminalWindowTellBlock: OsaScriptTellBlock = {
      tellCommand: `W's current session`,
      sections: []
    };
    // Do the number of splits needed
    commands.forEach(() => {
      terminalWindowTellBlock.sections.push(
        `split horizontally with default profile`
      );
    });

    const iTermApplicationTellBlock: OsaScriptTellBlock = {
      tellCommand: 'application "iTerm"',
      sections: [
        'activate',
        'set W to current window',
        'if W = missing value then set W to create window with default profile',
        terminalWindowTellBlock,
        `set T to W's current tab`
      ]
    };
    // Add in the commands, adding 2 to the session number because the first
    // session is 1, and the second is 2.
    commands.forEach((command, i) => {
      iTermApplicationTellBlock.sections.push(
        `write T's session ${i + 2} text "cd ${cwd} && ${command}"`
      );
    });
    const osaScriptBuilder = new OsaScriptBuilder();
    osaScriptBuilder.addTellBlock(iTermApplicationTellBlock);
    const osaScript = osaScriptBuilder.getFullCommand();
    Logger.verbose.info(`OsaScript: ${osaScript}`);
    await CLIService.execCmd(osaScript);
  }
}
