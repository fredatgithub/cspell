import type { Command } from 'commander';
import { Option as CommanderOption } from 'commander';

import * as App from './application.js';
import type { LinterCliOptions } from './options.js';
import { DEFAULT_CACHE_LOCATION } from './util/cache/index.js';
import { CheckFailed } from './util/errors.js';

// interface InitOptions extends Options {}

const usage = `\
[options] [globs...] [file://<path> ...] [stdin[://<path>]]

Patterns:
 - [globs...]            Glob Patterns
 - [stdin]               Read from "stdin" assume text file.
 - [stdin://<path>]      Read from "stdin", use <path> for file type and config.
 - [file://<path>]       Check the file at <path>

Examples:
    cspell .                        Recursively check all files.
    cspell lint .                   The same as "cspell ."
    cspell "*.js"                   Check all .js files in the current directory
    cspell "**/*.js"                Check all .js files recursively
    cspell "src/**/*.js"            Only check .js under src
    cspell "**/*.txt" "**/*.js"     Check both .js and .txt files.
    cspell "**/*.{txt,js,md}"       Check .txt, .js, and .md files.
    cat LICENSE | cspell stdin      Check stdin
    cspell stdin://docs/doc.md      Check stdin as if it was "./docs/doc.md"\
`;

const advanced = `
More Examples:

    cspell "**/*.js" --reporter @cspell/cspell-json-reporter
        This will spell check all ".js" files recursively and use
        "@cspell/cspell-json-reporter".

    cspell . --reporter default
        This will force the default reporter to be used overriding
        any reporters defined in the configuration.

    cspell . --reporter ./<path>/reporter.cjs
        Use a custom reporter. See API for details.

References:
    https://cspell.org
    https://github.com/streetsidesoftware/cspell
`;

function collect(value: string, previous: string[] | undefined): string[] {
    if (!previous) {
        return [value];
    }
    return previous.concat([value]);
}

export function commandLint(prog: Command): Command {
    const spellCheckCommand = prog.command('lint', { isDefault: true });
    spellCheckCommand
        .description('Check spelling')
        .option(
            '-c, --config <cspell.json>',
            'Configuration file to use.  By default cspell looks for cspell.json in the current directory.',
        )
        .option('-v, --verbose', 'Display more information about the files being checked and the configuration.')
        .option(
            '--locale <locale>',
            'Set language locales. i.e. "en,fr" for English and French, or "en-GB" for British English.',
        )
        .option('--language-id <language>', 'Force programming language for unknown extensions. i.e. "php" or "scala"')
        .addOption(
            new CommanderOption(
                '--languageId <language>',
                'Force programming language for unknown extensions. i.e. "php" or "scala"',
            ).hideHelp(),
        )
        .option('--words-only', 'Only output the words not found in the dictionaries.')
        .addOption(
            new CommanderOption('--wordsOnly', 'Only output the words not found in the dictionaries.').hideHelp(),
        )
        .option('-u, --unique', 'Only output the first instance of a word not found in the dictionaries.')
        .option(
            '-e, --exclude <glob>',
            'Exclude files matching the glob pattern. This option can be used multiple times to add multiple globs. ',
            collect,
        )
        .option(
            '--file-list <path or stdin>',
            'Specify a list of files to be spell checked.' +
                ' The list is filtered against the glob file patterns.' +
                ' Note: the format is 1 file path per line.',
            collect,
        )
        .option('--no-issues', 'Do not show the spelling errors.')
        .option('--no-progress', 'Turn off progress messages')
        .option('--no-summary', 'Turn off summary message in console.')
        .option('-s, --silent', 'Silent mode, suppress error messages.')
        .addOption(
            new CommanderOption('--quiet', 'Only show spelling issues or errors.').implies({
                summary: false,
                progress: false,
            }),
        )
        .option('--fail-fast', 'Exit after first file with an issue or error.')
        .addOption(new CommanderOption('--no-fail-fast', 'Process all files even if there is an error.').hideHelp())
        .option('-r, --root <root folder>', 'Root directory, defaults to current directory.')
        .addOption(
            new CommanderOption('--relative', 'Issues are displayed relative to the root.').default(true).hideHelp(),
        )
        .option('--no-relative', 'Issues are displayed with absolute path instead of relative to the root.')
        .option('--show-context', 'Show the surrounding text around an issue.')
        .option('--show-suggestions', 'Show spelling suggestions.')
        .addOption(
            new CommanderOption('--no-show-suggestions', 'Do not show spelling suggestions or fixes.').default(
                undefined,
            ),
        )
        .addOption(new CommanderOption('--must-find-files', 'Error if no files are found.').default(true).hideHelp())
        .option('--no-must-find-files', 'Do not error if no files are found.')
        // The following options are planned features
        // .option('-w, --watch', 'Watch for any changes to the matching files and report any errors')
        // .option('--force', 'Force the exit value to always be 0')
        .addOption(new CommanderOption('--legacy', 'Legacy output').hideHelp())
        .addOption(new CommanderOption('--local <local>', 'Deprecated -- Use: --locale').hideHelp())
        .option('--cache', 'Use cache to only check changed files.')
        .option('--no-cache', 'Do not use cache.')
        .option('--cache-reset', 'Reset the cache file.')
        .addOption(
            new CommanderOption('--cache-strategy <strategy>', 'Strategy to use for detecting changed files.').choices([
                'metadata',
                'content',
            ]),
        )
        .option(
            '--cache-location <path>',
            `Path to the cache file or directory. (default: "${DEFAULT_CACHE_LOCATION}")`,
        )
        .option('--dot', 'Include files and directories starting with `.` (period) when matching globs.')
        .option('--gitignore', 'Ignore files matching glob patterns found in .gitignore files.')
        .option('--no-gitignore', 'Do NOT use .gitignore files.')
        .option('--gitignore-root <path>', 'Prevent searching for .gitignore files past root.', collect)
        .option('--validate-directives', 'Validate in-document CSpell directives.')
        .option('--no-validate-directives', 'Do not validate in-document CSpell directives.')
        .option('--no-color', 'Turn off color.')
        .option('--color', 'Force color.')
        .addOption(
            new CommanderOption(
                '--default-configuration',
                'Load the default configuration and dictionaries.',
            ).hideHelp(),
        )
        .addOption(
            new CommanderOption(
                '--no-default-configuration',
                'Do not load the default configuration and dictionaries.',
            ),
        )
        .option('--debug', 'Output information useful for debugging cspell.json files.')
        .option('--reporter <module|path>', 'Specify one or more reporters to use.', collect)
        .usage(usage)
        .addHelpText('after', advanced)
        .arguments('[globs...]')
        .action((fileGlobs: string[], options: LinterCliOptions) => {
            App.parseApplicationFeatureFlags(options.flag);
            const { mustFindFiles, fileList } = options;
            return App.lint(fileGlobs, options).then((result) => {
                if (!fileGlobs.length && !result.files && !result.errors && !fileList) {
                    spellCheckCommand.outputHelp();
                    throw new CheckFailed('outputHelp', 1);
                }
                if (result.issues || result.errors || (mustFindFiles && !result.files)) {
                    throw new CheckFailed('check failed', 1);
                }
                return;
            });
        });

    return spellCheckCommand;
}
