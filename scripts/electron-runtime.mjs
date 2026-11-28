import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function packagerRequire(webRequire) {
  const builderRequire = createRequire(webRequire.resolve('electron-builder'));
  return createRequire(builderRequire.resolve('app-builder-lib'));
}

export function projectServerDeployment(manifest, lock, packageManager) {
  const pkg = structuredClone(manifest);
  const importer = structuredClone(lock.importers['packages/server']);
  // Optional agent SDKs are installed on demand. Retain optional dependencies of
  // the remaining packages: --no-optional breaks Sharp and pnpm's hoisted graph.
  delete pkg.devDependencies;
  delete pkg.optionalDependencies;
  delete pkg.scripts;
  delete pkg.dependencies['@flow-spaces/shared'];
  pkg.packageManager = packageManager;
  delete importer.devDependencies;
  delete importer.optionalDependencies;
  delete importer.dependencies['@flow-spaces/shared'];
  return { pkg, lock: { ...lock, importers: { '.': importer } } };
}

export function deployElectronServer({ root, webRequire, run }) {
  const yaml = packagerRequire(webRequire)('js-yaml');
  const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const projected = projectServerDeployment(read('packages/server/package.json'),
    yaml.load(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')), read('package.json').packageManager);
  const stage = path.join(root, 'apps/web/electron-build/server-node');
  fs.mkdirSync(stage, { recursive: true });
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(projected.pkg, null, 2) + '\n');
  fs.writeFileSync(path.join(stage, 'pnpm-lock.yaml'), yaml.dump(projected.lock, { lineWidth: -1, noRefs: true }));
  run('pnpm', ['--ignore-workspace', 'install', '--prod', '--ignore-scripts', '--frozen-lockfile',
    '--config.node-linker=hoisted'], { cwd: stage });
}

export async function prepareElectronRuntime({ root, webRequire, args }) {
  const platform = args.includes('--win') ? 'win32' : args.includes('--mac') ? 'darwin' : args.includes('--linux') ? 'linux' : process.platform;
  const arch = args.includes('--arm64') ? 'arm64' : args.includes('--x64') ? 'x64' : process.arch;
  if (platform !== process.platform || arch !== process.arch || args.includes('--universal')) {
    throw new Error('Native dependencies must be packaged on the target platform and architecture.');
  }
  const stage = path.join(root, 'apps/web/electron-build/server-node');
  const modulesConfig = fs.readFileSync(path.join(stage, 'node_modules/.modules.yaml'), 'utf8');
  if (!/^nodeLinker: hoisted\s*$/m.test(modulesConfig)) {
    throw new Error('Staged dependencies must use the hoisted layout; run a full build without --skip-build.');
  }
  // Shared has no production dependencies. Copy its built package rather than
  // introducing a workspace junction into the standalone deployment.
  const sharedDir = path.join(stage, 'node_modules/@flow-spaces/shared');
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.copyFileSync(path.join(root, 'packages/shared/package.json'), path.join(sharedDir, 'package.json'));
  fs.cpSync(path.join(root, 'packages/shared/dist'), path.join(sharedDir, 'dist'), { recursive: true });
  const manifestPath = path.join(stage, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.dependencies['@flow-spaces/shared'] = JSON.parse(fs.readFileSync(path.join(sharedDir, 'package.json'), 'utf8')).version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  // electron-builder only rebuilds app dependencies, not extraResources.
  const { rebuild } = await import(pathToFileURL(packagerRequire(webRequire).resolve('@electron/rebuild')).href);
  const electronVersion = webRequire('electron/package.json').version;
  console.log(`[electron-build] rebuild better-sqlite3 for Electron ${electronVersion}`);
  await rebuild({ buildPath: stage, electronVersion, arch,
    onlyModules: platform === 'linux' ? ['better-sqlite3', 'node-pty'] : ['better-sqlite3'], force: true });
}
