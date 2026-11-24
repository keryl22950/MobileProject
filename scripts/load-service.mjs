import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';

export async function loadService(file, dependencies) {
  const source = await readFile(new URL(`../src/services/${file}`, import.meta.url), 'utf8');
  const module = new SourceTextModule(source);
  await module.link((name) => {
    const values = dependencies[name];
    assert.ok(values, `Missing dependency: ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}
