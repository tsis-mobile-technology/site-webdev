// Gulp tasks related to updating, and checking for freshness, pubspec.yaml files
'use strict';

module.exports = function (gulp, plugins, config) {

  const argv = plugins.argv;
  const ngPkgVers = config.ngPkgVers;
  const path = plugins.path;
  const srcData = config.srcData;

  const chooseRegEx = argv.filter || '.';
  const skipRegEx = argv.skip || null;

  ['get', 'upgrade'].forEach(cmd => {
    gulp.task(`pub-${cmd}-and-check`, [`pub-${cmd}`], () => plugins.gitCheckDiff());
    gulp.task(`pub-${cmd}`, [`examples-pub-${cmd}`, `ng-pkg-pub-${cmd}`]);

    gulp.task(`ng-pkg-pub-${cmd}`, () => {
      if (srcData.match(skipRegEx) || !srcData.match(chooseRegEx)) return;
      _pub(cmd);
      updateNgPkgVers();
    });
  });

  gulp.task('_ng-pkg-vers-update', updateNgPkgVers);

  function updateNgPkgVers() {
    const dataDir = path.dirname(config.ngPkgVersPath);
    const pubspecLock = plugins.yamljs.load(path.join(dataDir, 'pubspec.lock'));

    for (var pkg in ngPkgVers) {
      if (pkg === 'SDK') continue;
      const newPkgInfo = pubspecLock.packages[pkg];
      if (newPkgInfo) ngPkgVers[pkg].vers = newPkgInfo.version;
    }
    plugins.fs.writeFileSync(config.ngPkgVersPath, plugins.stringify(ngPkgVers) + '\n');
  }

  function _pub(cmd) {
    const output = plugins.execSyncAndLog(`pub ${cmd}`, { cwd: srcData });
    if (cmd !== 'upgrade') return;
    const updatesAvailable = output.match(/^..(angular\w*) (\S+) \((\S+) available\)$/gm);
    if (!updatesAvailable) return;
    // Check for updates, but don't report when an alpha/beta version is available relative to a stable version.
    const updatesAvailableToReport = [];
    updatesAvailable.forEach(u => {
      const m = u.match(/^..(angular\w*) (\S+) \((\S+) available\)$/);
      if (!m[2].match(/alpha|beta/) && m[3].match(/alpha|beta/)) return true;
      if (u.match(skipRegEx)) return true;
      updatesAvailableToReport.push(u);
    })
    if (updatesAvailableToReport.length) {
      const msg = `Angular package updates available:\n${updatesAvailable.join('\n')}.\n`
      + 'Aborting. Update pubspec(s) before proceeding.\n';
      plugins.logAndExit1(msg);
    }
  }
};
