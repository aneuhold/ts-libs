/**
 * A `tell` block that can be executed in an OSA script.
 */
export type OsaScriptTellBlock = {
  /**
   * The command that goes after the `tell` keyword in the first line of the
   * block.
   */
  tellCommand: string;
  sections: OsaScriptSection[];
};

/**
 * A plain command that can be executed in an OSA script.
 */
export type OsaScriptCommand = string;

export type OsaScriptSection = OsaScriptTellBlock | OsaScriptCommand;

export default class OsaScriptBuilder {
  private currentScript: OsaScriptSection[] = [];

  /**
   * There's no need to escape single quotes with this. That is already done
   * in the class.
   */
  public addCommand(command: string): void {
    this.currentScript.push(command);
  }

  /**
   * There's no need to escape single quotes with this. That is already done
   * in the class.
   */
  public addTellBlock(tellBlock: OsaScriptTellBlock): void {
    this.currentScript.push(tellBlock);
  }

  /**
   * Generates the full command that should be pasted as-is into a terminal.
   *
   * This will automatically escape any single quotes appropriately that were
   * provided.
   */
  getFullCommand(): string {
    let stringifiedScript = `osascript`;
    this.currentScript.forEach((section) => {
      stringifiedScript += this.stringifySection(section);
    });
    return stringifiedScript;
  }

  private stringifySection(section: OsaScriptSection): string {
    if (typeof section === 'string') {
      return ` -e '${OsaScriptBuilder.escapeSingleQuotes(section)}'`;
    }
    let stringifiedSection = ` -e 'tell ${OsaScriptBuilder.escapeSingleQuotes(
      section.tellCommand
    )}'`;
    section.sections.forEach((subSection) => {
      stringifiedSection += this.stringifySection(subSection);
    });
    stringifiedSection += ` -e 'end tell'`;
    return stringifiedSection;
  }

  /**
   * Single quotes are escaped by splitting the string in two, then adding a
   * single quote to the end of the first half, and combining the two halves.
   *
   * By putting no space inbetween the two halves, the two halves are combined.
   */
  private static escapeSingleQuotes(stringToEscape: string): string {
    return stringToEscape.replace(/'/g, `'\\''`);
  }
}
