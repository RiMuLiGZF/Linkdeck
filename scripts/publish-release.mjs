import { execSync } from 'child_process';
import path from 'path';

const root = 'c:\\项目\\网址板';
const installer = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis', '网址板_0.1.0_x64-setup.exe');

try {
  const cmd = `gh release create v0.1.0 "${installer}" --title "网址板 v0.1.0" --notes "首个正式版本 - Windows 桌面网址启动器"`;
  const out = execSync(cmd, { encoding: 'utf8', cwd: root, stdio: 'inherit' });
  console.log(out || 'Release created!');
} catch (e) {
  console.error('Error:', e.stderr || e.message);
}
