const { execSync } = require('child_process');
const path = require('path');

const root = 'c:\\项目\\网址板';
const releaseDir = path.join(root, 'src-tauri', 'target', 'release');
const installer = path.join(releaseDir, 'bundle', 'nsis', '网址板_0.1.0_x64-setup.exe');
const standaloneExe = path.join(releaseDir, 'url-launcher.exe');
const zipPath = path.join(root, 'Linkdeck_0.1.0_x64_portable.zip');

// 1. 用 PowerShell 创建 zip
const psCmd = `Compress-Archive -Path "${standaloneExe}" -DestinationPath "${zipPath}" -Force`;
execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
console.log('Zip created:', zipPath);

// 2. 删除旧的 release asset
try {
  execSync('gh release delete-asset v0.1.0 "_0.1.0_x64-setup.exe" -R RiMuLiGZF/Linkdeck -y', {
    cwd: root, stdio: 'inherit'
  });
} catch (e) {
  console.log('Note: old asset may not exist');
}

// 3. 上传修正后的安装包 + zip
execSync(`gh release upload v0.1.0 "${installer}#网址板_0.1.0_x64-setup.exe" "${zipPath}" -R RiMuLiGZF/Linkdeck --clobber`, {
  cwd: root, stdio: 'inherit'
});

console.log('Upload complete!');
