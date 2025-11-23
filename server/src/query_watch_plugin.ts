import { Config } from '@jest/types';
import { JestHookSubscriber, WatchPlugin } from 'jest-watcher';

declare type TestSuiteInfo = {
    config: Config.ProjectConfig;
    duration?: number;
    testPath: string;
};
// type PluginConfig = {
//     key?: string;
//     prompt?: string;
// };

function relativePath(info: TestSuiteInfo): string {
    return info.testPath.replace(info.config.rootDir + '/server/__tests__/', '');
}

export default class QueryWatchPlugin implements WatchPlugin {
    // isInternal = false;
    // public _prompt: Prompt = new Prompt();
    public _projects: any[] = [];
    // _usageInfo: UsageData = {
    //     key: 'p',
    //     prompt: 'this be a prompt, matey',
    // };
    // lastRan

    constructor(
        public _stdin: NodeJS.ReadStream, //
        public _stdout: NodeJS.WriteStream,
        public config = {}
    ) {}

    apply(jestHooks: JestHookSubscriber): void {
        jestHooks.onFileChange(change => {
            let message: string = '';
            for (let project of change.projects) {
                // project.config.dependencyExtractor
                let name = project.config.displayName ?? project.config.id;
                let path_ = project.config.cwd;
                message += `\nProject "${name}" @ "${path_}"`;
                // console.log(`\nProject "${name}" @ "${path_}"`);

                for (let testPath of project.testPaths) {
                    message += `\n\t "onFileChange: ${testPath.replace(project.config.rootDir, '')}"`;
                    console.log(`\t "onFileChange: ${testPath.replace(project.config.rootDir, '')}"`);
                }
            }
            console.log(message + '\n');
            this._projects = change.projects;
        });
        jestHooks.onTestRunComplete((results) => {
            results.testResults.map(result => result.testFilePath)
        })
        // jestHooks.shouldRunTestSuite(testSuiteInfo => {
        //     let path_ = console.log(`shouldRunTestSuite: "${relativePath(testSuiteInfo)}"`);
        //     // console.log(`roots: "${testSuiteInfo.config.roots}"`);
        //     return Promise.resolve(testSuiteInfo.testPath.includes('queries'));
        // });
    }

    // onKey(value: string): void {
    //     this._prompt.put(value);
    // }
    // run(globalConfig: any, updateConfigAndRun: UpdateConfigCallback): Promise<boolean | void> {
    //     return new Promise((onResolve, onReject) => {
    //         updateConfigAndRun({ mode: 'watch', testPathPatterns: ['bee-boo-boo-bop'] });
    //         onResolve();
    //     });
    // }
}
