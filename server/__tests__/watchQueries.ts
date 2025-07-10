import { Config } from '@jest/types';
import { JestHookSubscriber, WatchPlugin } from 'jest-watcher';
import { ReadStream, WriteStream } from 'tty';

type Project = {
    config: Config.ProjectConfig;
    testPaths: Array<string>;
};

export default class WatchQueries implements WatchPlugin {
    constructor(options: { config: Record<string, unknown>; stdin: ReadStream; stdout: WriteStream }) {}
    apply(jestHooks: JestHookSubscriber): void {
        // jestHooks.shouldRunTestSuite(suite => {
        //     // suite.config.
        //     return Promise.resolve(suite.testPath.includes('queries'));
        // });
        jestHooks.onFileChange(arg => {
            let paths = arg.projects.flatMap((project: Project) => project.testPaths);
            if (paths.every(p => p.includes('queries'))) {
                jestHooks.shouldRunTestSuite(suite => Promise.resolve(suite.testPath.includes('queries')));
            } else {
                jestHooks.shouldRunTestSuite(suite => Promise.resolve(true));
            }
        });
    }
}
