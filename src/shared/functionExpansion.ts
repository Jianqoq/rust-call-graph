export function isOpenableSourceScheme(scheme: string): boolean {
  return scheme === 'file' || scheme === 'vscode-remote' || scheme === 'vscode-vfs';
}
