import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';
import { cn } from '../../lib/utils';

/**
 * 可折叠区块组件（基于Accordion）
 * 支持localStorage持久化折叠状态
 */
export default function AccordionSection({
  title,
  icon,
  count,
  children,
  storageKey,
  defaultCollapsed = false,
  value, // 用于Accordion的value
  className,
}) {
  // 从localStorage读取折叠状态
  const getInitialCollapsed = () => {
    if (!storageKey) return defaultCollapsed;
    try {
      const stored = localStorage.getItem(`accordion_${storageKey}`);
      return stored !== null ? JSON.parse(stored) : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  // 保存折叠状态到localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`accordion_${storageKey}`, JSON.stringify(isCollapsed));
      } catch (error) {
        console.warn(`保存折叠状态失败 (${storageKey}):`, error);
      }
    }
  }, [isCollapsed, storageKey]);

  // 处理折叠状态变化
  const handleValueChange = (newValue) => {
    const collapsed = newValue === undefined || newValue === '';
    setIsCollapsed(collapsed);
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={isCollapsed ? '' : value}
      onValueChange={handleValueChange}
      className={cn("w-full", className)}
    >
      <AccordionItem value={value || 'item'} className="border-none">
        <AccordionTrigger className="py-3 px-3 hover:no-underline hover:bg-white/5 transition-colors flex items-center gap-2 flex-1 text-left">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <span className="font-semibold text-[13px] text-white leading-none">{title}</span>
          {count !== undefined && (
            <span className="text-[11px] text-gray-500 font-normal">({count})</span>
          )}
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-0">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

