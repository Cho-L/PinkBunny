const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readme = read('README.md');
const post = read('POST_KO.md');
const installer = read('installer/PinkBunny.iss');
const manifest = JSON.parse(read('extension/manifest.json'));

test('public README, Windows installer and Chrome extension show matching release version', () => {
  const appVersion = installer.match(/#define MyAppVersion "(\d+\.\d+\.\d+)"/)?.[1];
  assert.ok(appVersion, 'Installer version missing');
  assert.equal(manifest.version, appVersion, 'Chrome extension version does not match installer');
  assert.match(readme, new RegExp('v' + appVersion.replace(/\./g, '\\.')));
});

test('README links point to existing repo files', () => {
  const links = [...readme.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  for (const value of links) {
    if (/^(?:https?:|#|mailto:)/i.test(value)) continue;
    const local = decodeURIComponent(value.split('#')[0]);
    assert.equal(fs.existsSync(path.join(root, local)), true, 'Missing documentation link: ' + value);
  }
});

test('community post includes verified install dimensions and clear feature limits', () => {
  assert.match(post, /http:\/\/127\.0\.0\.1:38765/);
  assert.match(post, /420/);
  assert.match(post, /130/);
  assert.match(post, /연결 설정 · 문제 해결/);
  assert.match(post, /다음 영상 미리보기/);
  assert.match(post, /광고를 차단하지 않습니다/);
  assert.match(post, /음악 소리는 OBS에서 별도로 설정/);
  assert.match(post, /베타 버전/);
  for (const futureFeature of ['음악 반응형 토끼', '시청자 신청곡 DJ', '방송 BGM 자동 기록']) {
    assert.ok(!post.includes(futureFeature), 'Unimplemented feature claimed: ' + futureFeature);
  }
});

test('installer and portable zip document packaging remain in sync', () => {
  const workflow = read('.github/workflows/build-windows.yml');
  for (const name of ['guide.html', 'guide-quickstart-1pc.svg', 'guide-quickstart-2pc.svg', 'guide-chrome-extension.svg', 'guide-obs-source.svg']) {
    assert.equal(fs.existsSync(path.join(root, 'overlay', name)), true, 'Missing illustration: ' + name);
  }
  assert.match(installer, /guide-\*\.svg/);
  assert.match(workflow, /Copy-Item overlay\/guide-\*\.svg/);
});
