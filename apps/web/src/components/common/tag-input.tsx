'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/base/badges/chip';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  className?: string;
}

export function TagInput({ value, onChange, placeholder, addLabel, className }: TagInputProps) {
  const t = useTranslations('common');
  const [input, setInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);

  const submit = () => {
    const tag = input.trim();
    if (editingTag) {
      // 编辑已有 badge：先移除原 tag，再添加新值（值未变则仅退出编辑态）
      const rest = value.filter(t => t !== editingTag);
      if (tag && tag !== editingTag && !rest.includes(tag)) {
        onChange([...rest, tag]);
      } else {
        onChange(rest);
      }
      setEditingTag(null);
    } else if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput('');
  };

  const edit = (tag: string) => {
    setEditingTag(tag);
    setInput(tag);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setInput('');
  };

  const remove = (tag: string) => {
    if (editingTag === tag) cancelEdit();
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape' && editingTag) {
              e.preventDefault();
              cancelEdit();
            }
          }}
          placeholder={placeholder}
          className={cn('h-8 flex-1 text-sm', className)}
        />
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8', className)}
          onClick={submit}
          disabled={!input.trim()}
        >
          {editingTag ? t('replace') : addLabel}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {value.map(tag => (
            <Chip
              key={tag}
              variant="caption"
              color="neutral"
              className={cn(
                'gap-1 pr-1 cursor-pointer',
                editingTag === tag && 'ring-2 ring-primary'
              )}
              onClick={() => edit(tag)}
            >
              {tag}
              <button
                className="hover:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(tag);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
