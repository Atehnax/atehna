import assert from 'node:assert/strict';
import ts from 'typescript';

// Assert the intended implementation stays connected through the authenticated
// boundary, rather than accepting an unguarded re-export as equivalent.
export function assertProtectedAdminRouteBinding(
  text: string,
  method: string,
  implementation: string
) {
  const source = ts.createSourceFile('route.ts', text, ts.ScriptTarget.Latest, true);
  let binding: string | undefined;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== implementation) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    const imported = named.elements.find(element => (element.propertyName?.text ?? element.name.text) === method);
    if (imported) binding = imported.name.text;
  }
  assert.ok(binding, method + ' must import the expected implementation ' + implementation);
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .filter(statement => statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(value => value.name.getText(source) === method);
  assert.ok(declaration?.initializer && ts.isCallExpression(declaration.initializer), method + ' must export a guarded handler');
  assert.equal(declaration.initializer.expression.getText(source), 'withAdminRoute');
  assert.equal(declaration.initializer.arguments[0]?.getText(source), binding);
  assert.match(text, /import \{ withAdminRoute \} from '@\/shared\/auth\/adminRoute'/u);
}

