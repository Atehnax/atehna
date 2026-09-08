import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Isolate server boundaries from persistence while executing their real source.
export function loadBoundServerModule<T>(
  file: string,
  bindings: Record<string, unknown>
): T {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const body = source.statements
    .filter(statement => !ts.isImportDeclaration(statement) && !(ts.isExportDeclaration(statement) && statement.moduleSpecifier))
    .map(statement => statement.getText(source)).join('\n');
  const exports = {};
  runInNewContext(
    ts.transpileModule(body, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }
    }).outputText,
    { exports, Response, Request, Headers, URL, URLSearchParams, Buffer, console, process, ...bindings }
  );
  return exports as T;
}

