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
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-extension.svg')),true,'Missing feature guide: extension');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-tabs.svg')),true,'Missing feature guide: tabs');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-controls.svg')),true,'Missing feature guide: controls');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-design.svg')),true,'Missing feature guide: design');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-remote.svg')),true,'Missing feature guide: remote');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-filters.svg')),true,'Missing feature guide: filters');
  assert.equal(fs.existsSync(path.join(root,'overlay','guide-feature-troubleshoot.svg')),true,'Missing feature guide: troubleshoot');
});


test('feature tutorial links are embedded in offline guide and available from popup and setup',()=>{
 const guide=read('overlay/guide.html');
 const popup=read('extension/popup.html');
 const setup=read('overlay/setup.html');
 const manual=read('FEATURE_GUIDE_KO.md');
 const api=read('main.go');
 assert.match(guide,/id="features"/);
 assert.match(popup,/id="openFeatureGuide"/);
 assert.match(setup,/\/guide#features/);
 for(const name of ['extension','tabs','controls','design','remote','filters','troubleshoot']){
  const svg='guide-feature-'+name+'.svg';
  assert.ok(guide.includes(svg),'Offline guide misses '+svg);
  assert.ok(manual.includes(svg),'Markdown manual misses '+svg);
  assert.ok(api.includes(svg),'Embedded HTTP server misses '+svg);
 }
});

test('GitHub public guide links open rendered Markdown gallery rather than raw HTML source', () => {
  const guide = read('GUIDE.md');
  const featureManual = read('FEATURE_GUIDE_KO.md');
  assert.match(guide, /^## Install$/m);
  assert.match(guide, /^## Features$/m);
  assert.match(readme, /\[📘 설치 그림 안내\]\(GUIDE\.md#install\)/);
  assert.match(readme, /\[✨ 기능 사용 그림 7장\]\(GUIDE\.md#features\)/);
  assert.ok(!readme.includes('overlay/guide.html#'), 'README must not link to HTML source on GitHub');
  assert.ok(!featureManual.includes('overlay/guide.html#'), 'Feature manual must not link to HTML source on GitHub');
  const illustrations = [
    'guide-quickstart-1pc.svg', 'guide-quickstart-2pc.svg',
    'guide-chrome-extension.svg', 'guide-obs-source.svg',
    ...['extension','tabs','controls','design','remote','filters','troubleshoot'].map(n=>'guide-feature-'+n+'.svg')
  ];
  for(const file of illustrations){
    const path='overlay/'+file;
    assert.ok(guide.includes(']('+path+')'), 'Markdown does not embed guide image '+path);
    assert.ok(fs.existsSync(path), 'Missing illustration '+path);
  }
});

test('extension default HTTP permission is loopback-only; 2-PC host access is opt-in',()=>{
 const manifest=JSON.parse(read('extension/manifest.json'));
 assert.ok(!manifest.host_permissions.includes('http://*/*'), 'must not request all HTTP hosts at installation');
 assert.ok(manifest.host_permissions.includes('http://127.0.0.1/*'));
 assert.ok(manifest.optional_host_permissions.includes('http://*/*'));
 const popup=read('extension/popup.js');
 assert.match(popup,/chrome\.permissions\.request/);
 assert.match(popup,/A-F0-9\]\{32\}/);
});

test('all Markdown guide links and images are local files that actually exist',()=>{
 const manuals=['README.md','GUIDE.md','FEATURE_GUIDE_KO.md','CHANGELOG.md','QA_REPORT.md','POST_KO.md'];
 for(const name of manuals){
  const body=read(name);
  for(const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
   const value=match[1].split('#')[0];
   if(!value||/^(?:https?:|mailto:)/i.test(value))continue;
   const location=path.resolve(root,path.dirname(name),decodeURIComponent(value));
   assert.ok(location.startsWith(root+path.sep),'Documentation link escaped repository: '+value);
   assert.ok(fs.existsSync(location),'Broken local link in '+name+': '+value);
  }
 }
});
test('current QA report clearly labels archival issues and does not claim real OBS E2E passed',()=>{
 const qa=read('QA_REPORT.md');
 assert.match(qa,/v12\.0\.0/);
 assert.match(qa,/이전 검증 기록: v11\.0\.1/);
 assert.match(qa,/실제 Windows Chrome \+ YouTube/);
 assert.match(qa,/Chrome 명령 처리 결과를 회신/);
 assert.ok(!qa.includes('That acknowledgement remains future work.'));
 assert.ok(!qa.includes('does not erase browser history or secure the LAN status endpoint'));
});
test('setup diagnosis and command ACK are rendered, but OBS audio verification is manual',()=>{
 const setup=read('overlay/setup-extra.js');
 const diag=read('diagnostics.go');
 const controls=read('control_endpoints.go');
 assert.match(setup,/\/api\/diagnostics/);
 assert.match(setup,/\/api\/control\/result/);
 assert.match(diag,/State:"manual"/);
 assert.match(diag,/OBS 브라우저 소스/);
 assert.match(diag,/방송 음악 오디오/);
 assert.match(controls,/\/api\/command-result/);
});

test('Chrome content-script recovery has permission, bounded retry and duplicate-install guard',()=>{
 const manifest=JSON.parse(read('extension/manifest.json'));
 assert.ok(manifest.permissions.includes('scripting'),'Dynamic recovery requires scripting permission');
 for(const file of ['extension/popup.js','extension/background.js']){
  const js=read(file);
  assert.match(js,/chrome\.scripting\.executeScript/);
  assert.match(js,/Receiving end does not exist/);
  assert.match(js,/files:\['content\.js'\]/);
 }
 assert.match(read('extension/content.js'),/__pinkBunnyContentAttached/);
});
