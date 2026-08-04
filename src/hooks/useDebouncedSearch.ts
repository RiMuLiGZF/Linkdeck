// 搜索防抖（spec：防抖 120ms，实时过滤）。
// 输入即更新（受控），延迟 delay 后把值交给 onChange（触发服务端检索）。
import { useEffect, useRef, useState } from 'react';

export function useDebouncedSearch(
  value: string,
  delay: number,
  onChange: (v: string) => void,
): void {
  const [debounced, setDebounced] = useState(value);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  useEffect(() => {
    latest.current(debounced);
  }, [debounced]);
}
