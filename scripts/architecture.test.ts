import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

async function filesIn(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes(`${path.sep}generated${path.sep}`));
}

async function dependencies(file: string): Promise<string[]> {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  return source.statements.flatMap((node) => {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return [];
    return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? [node.moduleSpecifier.text] : [];
  });
}

const fsdLayers = ['shared', 'entities', 'features', 'widgets', '_pages', '_app'];
const backendLayers = ['domain', 'application', 'infrastructure', 'presentation'];

function parts(root: string, file: string): string[] {
  return path.relative(root, file).split(path.sep);
}

test('frontend imports lower layers through slice entry points', async () => {
  const root = 'apps/web/src';
  for (const file of await filesIn(root)) {
    const [fromLayer, fromSlice] = parts(root, file);
    assert.ok(fromLayer, file);
    const from = fsdLayers.indexOf(fromLayer);
    assert.ok(from >= 0, file);

    for (const dependency of await dependencies(file)) {
      const target = dependency.startsWith('@/') ? path.join(root, dependency.slice(2))
        : dependency.startsWith('.') ? path.join(path.dirname(file), dependency) : null;
      if (!target) continue;
      const [toLayer, toSlice, entry, ...rest] = parts(root, target);
      assert.ok(toLayer, dependency);
      const to = fsdLayers.indexOf(toLayer);
      assert.ok(to >= 0 && to <= from, `${file} -> ${dependency}`);
      if (from === to && !['_app', 'shared'].includes(fromLayer)) {
        assert.equal(toSlice, fromSlice, `${file} imports another slice via ${dependency}`);
      }
      if (from !== to && toLayer !== 'shared') {
        assert.ok(!rest.length && (!entry || entry === 'index.server'), `${file} bypasses the public API via ${dependency}`);
      }
    }
  }
});

test('backend domain and application do not depend on NestJS, Prisma or outer layers', async () => {
  const root = 'apps/api/src';
  for (const file of await filesIn(root)) {
    const [from] = parts(root, file);
    if (!from || !backendLayers.includes(from)) continue;

    for (const dependency of await dependencies(file)) {
      const [to] = parts(root, path.join(path.dirname(file), dependency));
      if (from === 'domain' || from === 'application') {
        const allowed = from === 'domain' ? ['domain'] : ['domain', 'application'];
        assert.ok(dependency.startsWith('.') && to !== undefined && allowed.includes(to), `${file} -> ${dependency}`);
      }
      if (from === 'presentation' || from === 'infrastructure') {
        const forbidden = from === 'presentation' ? 'infrastructure' : 'presentation';
        assert.ok(!dependency.startsWith('.') || to !== forbidden, `${file} -> ${dependency}`);
      }
    }
  }
});
