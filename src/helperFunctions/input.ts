import * as rl from 'readline';

const readline = rl.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(promptToUser: string): Promise<string> {
  return new Promise((resolve) => {
    readline.question(promptToUser, (input: string) => {
      readline.close();
      resolve(input);
    });
  });
}

/**
 * Gets input from the user on command line.
 *
 * @param promptToUser the prompt that should be provided to the user. Include
 * a newline at the end if you want there to be one.
 */
export default async function getUserInput(
  promptToUser: string
): Promise<string> {
  return ask(promptToUser);
}
