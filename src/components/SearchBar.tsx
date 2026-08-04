// 搜索栏（DESIGN-PAGES §1.2）。受控输入框 + 左搜索图标 + focus 环。
import { forwardRef } from 'react';
import { Icon } from './Icon';

export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange }, ref) => {
    return (
      <div className="searchbar">
        <Icon name="search" size={20} className="searchbar__icon" />
        <input
          ref={ref}
          className="searchbar__input"
          type="text"
          value={value}
          placeholder="搜索网址或分类…"
          aria-label="搜索网址或分类"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
