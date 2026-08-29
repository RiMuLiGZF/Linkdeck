import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

const root = 'c:\\项目\\网址板';
const releaseDir = path.join(root, 'src-tauri', 'target', 'release');
const installer = path.join(releaseDir, 'bundle', 'nsis', '网址板_0.1.0_x64-setup.exe');
const standaloneExe = path.join(releaseDir, 'url-launcher.exe');

// 1. 创建 zip（便携版：只含 exe）
const zipPath = path.join(root, 'Linkdeck_0.1.0_x64_portable.zip');
const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.file(standaloneExe, { name: '网址板.exe' });
await archive.finalize();
await new Promise(resolve => output.on('close', resolve));

console.log('Zip created:', zipPath);

// 2. 删除旧的 release asset（文件名丢失中文）
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
