const { spawnSync } = require('child_process');
const { mkdtempSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const root = process.cwd();
const libDir = join(root, 'lib');
const out = mkdtempSync(join(tmpdir(), 'vw-p4-dbg-'));
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const dm = join(libDir, 'destination-media');
const include = readdirSync(dm).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(dm,f));
writeFileSync(join(out,'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2020',module:'commonjs',moduleResolution:'node',esModuleInterop:true,strict:true,skipLibCheck:true,rootDir:libDir,outDir:out,types:['node'],typeRoots:[join(root,'node_modules','@types')]},include}));
const r = spawnSync(process.execPath, [tsc, '-p', join(out,'tsconfig.json')], {encoding:'utf8', cwd:root});
if (r.status!==0) { console.log(r.stdout); console.log(r.stderr); process.exit(1); }
const { selectDiscoverTeaserAsset } = require(join(out,'destination-media','select-discover-teaser-asset.js'));
const { resolveDiscoverImageSrc } = require(join(out,'destination-media','resolve-discover-image-src.js'));
for (const id of ['albania','crete','sicily','sardinia']) {
  const a = selectDiscoverTeaserAsset(id, {root});
  const src = resolveDiscoverImageSrc(id, '/images/wow-ssot/discover-'+id+'.jpg', {root});
  console.log(id, a && a.assetId, src);
}
