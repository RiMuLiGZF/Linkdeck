const { execSync } = require('child_process');
const path = require('path');

const root = 'c:\\项目\\网址板';
const installer = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis', '网址板_0.1.0_x64-setup.exe');

// 删除旧 asset
try {
  execSync('gh release delete-asset v0.1.0 "_0.1.0_x64-setup.exe" --repo RiMuLiGZF/Linkdeck --yes', {
    cwd: root, stdio: 'inherit'
  });
  console.log('Deleted old asset');
} catch (e) {
  console.log('Old asset not found or already deleted');
}

// 用英文文件名上传安装包
const renamedInstaller = path.join(root, 'Linkdeck_0.1.0_x64-setup.exe');
const fs = require('fs');
fs.copyFileSync(installer, renamedInstaller);

execSync(`gh release upload v0.1.0 "${renamedInstaller}" --repo RiMuLiGZF/Linkdeck --clobber`, {
  cwd: root, stdio: 'inherit'
});

console.log('Upload complete!');
