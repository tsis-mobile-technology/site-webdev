'use strict';

module.exports = function (gulp, plugins, config) {

  const fs = plugins.fs;
  const _projs = config.dartdocProj;
  const path = plugins.path;

  const tmpPubPkgsPath = config.tmpPubPkgsPath;
  if (!fs.existsSync(tmpPubPkgsPath)) plugins.execSyncAndLog(`mkdir -p ${tmpPubPkgsPath}`);

  const libsToDoc = {
    acx: 'angular_components',
    forms: 'angular_forms',
    ng: 'angular,angular.security',
    router: 'angular_router',
    test: 'angular_test',
  };
  const pkgsFilePath = path.join(config.srcData, '.packages');

  gulp.task('dartdoc-info', () => {
    const msg = 'Dartdoc for packages:';
    if (_projs.length) {
      plugins.gutil.log(`${msg} ${_projs}.`);
      if (_projs.length) plugins.execSyncAndLog(`${config.dartdoc} --version`);
    } else {
      plugins.gutil.log(`${msg} no projects (all exist or are being skipped).`);
    }
  });

  // Task: dartdoc
  // --[no-]dartdoc='all|none|acx|ng|...', default is 'all'.
  gulp.task('dartdoc', done => {
    const dartdocTargets = _projs.map(p => `dartdoc-${p}`);
    plugins.runSequence('dartdoc-info', ...dartdocTargets, done)
  });

  config._dartdocProj.forEach(p => {
    if (_projs.includes(p)) {
      gulp.task(`dartdoc-${p}`, ['ng-pkg-pub-get'], () => _dartdoc(p));
    } else {
      gulp.task(`dartdoc-${p}`, () => true);
    }
  });

  function _dartdoc(proj) {
    if (!proj) throw `_dartdoc(): no project specified`;
    const projPath = _prep(proj);
    return _dartdoc1(proj, libsToDoc[proj], projPath);
  }

  let packages; // initialized lazily in _prep.
  function _prep(proj) {
    if (!packages) packages = fs.readFileSync(pkgsFilePath, { encoding: 'utf-8' });
    const pubPkgName = plugins.pkgAliasToPkgName(proj);
    const re = new RegExp(`^${pubPkgName}:(.*)$`, 'm');
    let match = packages.match(re);
    if (!match) _throw(proj, `can't find ${pubPkgName} in ${pkgsFilePath}`);
    // Sample entries:
    //   angular:../angular/lib/
    //   foo:file:///Users/chalin/.pub-cache/hosted/pub.dartlang.org/foo-1.0.0/lib/
    const pathToPkgSrcPath = match[1]
      .replace(/^\w+:\/\//, '') // Drop leading protocol, if any. E.g. 'file://'
      .replace(/^\.\.\/\.\.\//, '')   // Drop leading '../../' for relative paths
      .replace(/\/lib\/$/, ''); // Drop trailing '/lib'
    if (!fs.existsSync(pathToPkgSrcPath))
      _throw(proj, `package source directory not found: ${pathToPkgSrcPath} (${path.resolve(pathToPkgSrcPath)})`);
    plugins.gutil.log(`${pubPkgName} found at ${path.resolve(pathToPkgSrcPath)}.`);
    const pubPkgAndVersName = path.basename(pathToPkgSrcPath);
    if (!pubPkgAndVersName.match(new RegExp(`${pubPkgName}(\\b|-)`)))
      _throw(proj, `package source directory name should match /${pubPkgName}(\b|-*)/, but is ${pubPkgAndVersName}`);

    const tmpPubPkgPath = path.join(tmpPubPkgsPath, pubPkgAndVersName);
    const apiDir = path.resolve(tmpPubPkgPath, config.relDartDocApiDir);
    if (fs.existsSync(tmpPubPkgPath)) {
      if (fs.existsSync(apiDir)) plugins.execSyncAndLog(`rm -Rf ${apiDir}`);
      // plugins.del.sync(apiDir);
    } else {
      plugins.execSyncAndLog(`cp -R ${pathToPkgSrcPath} ${tmpPubPkgPath}`);
      const pubspecFile = `${tmpPubPkgPath}/pubspec.yaml`;
      // pub hangs on the following dependency: "args: '>=x.y.z <2.0.0'". Patch the pubspec:
      plugins.execSyncAndLog(`perl -i -pe "s/^(\\s+args):\\s*'>=\\s*([\\d\\.]+)\\s+<2.0.0'/\\1: ^\\2/gm" ${pubspecFile}`);
      // As of angular 5.0.0-alpha+1, an analyzer dependency overrides is necessary
      const dep_ovr = '\ndependency_overrides:\n  analyzer: ^0.31.0-alpha.1\n';
      plugins.gutil.log(`\nWARNING: appending to ${pubspecFile}: ${dep_ovr}\n`);
      fs.appendFileSync(pubspecFile, dep_ovr);
    }
    return tmpPubPkgPath;
  }

  function _dartdoc1(proj, libs, projPath) {
    const args = [];
    if (libs || libs === '') args.push(`--include=${libs}`);
    if (config.relDartDocApiDir !== 'doc/api') args.push(`--output ${config.relDartDocApiDir}`);
    return plugins.execp(`${config.dartdoc} ${args.join(' ')}`, { cwd: projPath });
  }

  function _throw(proj, msg) {
    throw `Dartdoc prep for ${proj}: ${msg}`;
  }
};
