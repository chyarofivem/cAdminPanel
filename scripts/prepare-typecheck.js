import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');

const run = (args) => {
    const result = spawnSync(process.execPath, [tsc, ...args], {
        cwd: root,
        stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
};

// UI projects reference shared and core declaration outputs. Generate those
// outputs without type checking first, then let each workspace typecheck its
// own source against a complete dependency graph.
run(['-p', 'shared/tsconfig.declarations.json', '--noCheck', '--emitDeclarationOnly']);
run(['-p', 'core/tsconfig.json', '--noCheck', '--emitDeclarationOnly', '--declaration', '--noEmit', 'false']);
fs.cpSync(
    path.join(root, '.tsc', 'shared', 'shared'),
    path.join(root, '.tsc', 'core', 'shared'),
    { recursive: true },
);
