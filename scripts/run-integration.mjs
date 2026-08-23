import { homedir } from 'node:os';
import path from 'node:path';
import { runTests } from '@vscode/test-electron';

const projectRoot = path.resolve('.');

await runTests({
  version: '1.133.0',
  extensionDevelopmentPath: projectRoot,
  extensionTestsPath: path.join(projectRoot, 'dist', 'test', 'integration.cjs'),
  launchArgs: [
    path.join(projectRoot, 'fixtures', 'rust-demo'),
    `--extensions-dir=${path.join(homedir(), '.vscode', 'extensions')}`,
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes'
  ],
  extensionTestsEnv: {
    RUST_CALL_GRAPH_FIXTURE: path.join(projectRoot, 'fixtures', 'rust-demo')
  }
});
