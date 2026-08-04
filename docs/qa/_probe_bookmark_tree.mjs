// 静态核对辅助探针：用 HTML5 规范树构造算法（parse5，与 Rust 侧 html5ever 同规范）
// 复现 Chrome/Edge/Firefox 导出的 Netscape 书签文件的 DOM 形状，
// 判定 src-tauri/src/bookmarks/parse.rs::process_dt 中
// "h3 之后用 dt.next_siblings() 找同级 <dl>" 的假设是否成立。
import { parse } from 'parse5';

const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" LAST_MODIFIED="2">开发</H3>
    <DL><p>
        <DT><A HREF="https://github.com" ADD_DATE="3">GitHub</A>
        <DT><A HREF="https://stackoverflow.com" ADD_DATE="4">Stack Overflow</A>
    </DL><p>
    <DT><A HREF="https://example.com" ADD_DATE="5">顶层链接</A>
</DL><p>
`;

const doc = parse(html);

function findFirst(node, name) {
  if (node.nodeName === name) return node;
  for (const c of node.childNodes ?? []) {
    const r = findFirst(c, name);
    if (r) return r;
  }
  return null;
}

const rootDl = findFirst(doc, 'dl');
console.log('== 第一个 <dl> 的元素子节点 ==');
for (const c of rootDl.childNodes) {
  if (!c.tagName) continue;
  const kids = (c.childNodes ?? []).filter((k) => k.tagName).map((k) => k.tagName);
  console.log(`  <${c.tagName}> -> 元素子节点: [${kids.join(', ')}]`);
}

// 定位 folder 的 <dt>（其首个元素子节点为 h3）
const folderDt = rootDl.childNodes.find(
  (c) => c.tagName === 'dt' && (c.childNodes ?? []).some((k) => k.tagName === 'h3'),
);
const childDl = (folderDt.childNodes ?? []).find((k) => k.tagName === 'dl');

// 复现 process_dt 的 next_siblings 搜索
const sibs = rootDl.childNodes.slice(rootDl.childNodes.indexOf(folderDt) + 1);
const siblingDl = sibs.find((k) => k.tagName === 'dl');

console.log('\n== 判定 ==');
console.log('文件夹 <dl> 是 <dt> 的子节点? ', !!childDl);
console.log('文件夹 <dl> 是 <dt> 的后继同级节点? ', !!siblingDl);
console.log(
  '\nparse.rs 的 dt.next_siblings() 搜索结果: ',
  siblingDl ? '找到（folder 内容会被解析）' : '未找到（folder 内所有书签会被丢弃）',
);
