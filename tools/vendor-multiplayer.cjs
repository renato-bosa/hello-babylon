const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = path.dirname(require.resolve('@colyseus/sdk/package.json'));
fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(pkg, 'dist/colyseus.js'), path.join(root, 'vendor/colyseus.js'));
fs.copyFileSync(path.join(pkg, 'LICENSE'), path.join(root, 'vendor/colyseus.LICENSE'));
console.log('Vendored @colyseus/sdk browser bundle (MIT notice included).');
