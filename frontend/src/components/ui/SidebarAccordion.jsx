import { useState, useEffect, useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';
import { cn } from '../../lib/utils';

/**
 * 侧边栏 Accordion 容器组件
 * 将多个可折叠区块放在同一个 Accordion 容器中
 */
export default function SidebarAccordion({ 
  items, // [{ id, title, icon, count, children, storageKey, defaultCollapsed, onToggle }]
  className,
  type = "multiple", // "single" 或 "multiple"
}) {
  // 从localStorage读取所有项的折叠状态
  const getInitialValues = () => {
    const values = [];
    items.forEach(item => {
      if (item.storageKey) {
        try {
          const stored = localStorage.getItem(`accordion_${item.storageKey}`);
          const isCollapsed = stored !== null ? JSON.parse(stored) : (item.defaultCollapsed ?? false);
          if (!isCollapsed) {
            values.push(item.id);
          }
        } catch {
          if (!item.defaultCollapsed) {
            values.push(item.id);
          }
        }
      } else if (!item.defaultCollapsed) {
        values.push(item.id);
      }
    });
    return type === "multiple" ? values : (values[0] || '');
  };

  const [value, setValue] = useState(getInitialValues);
  const hasInitialized = useRef(false);

  // 初始化时通知父组件展开状态（只执行一次）
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const initialValues = getInitialValues();
    const valuesArray = Array.isArray(initialValues) ? initialValues : (initialValues ? [initialValues] : []);
    items.forEach(item => {
      if (item.onToggle) {
        const isExpanded = valuesArray.includes(item.id);
        item.onToggle(isExpanded);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 保存折叠状态到localStorage，并通知父组件
  useEffect(() => {
    // 跳过初始化时的调用（已经在上面处理了）
    if (!hasInitialized.current) return;
    
    const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
    items.forEach(item => {
      if (item.storageKey) {
        try {
          const isCollapsed = !currentValues.includes(item.id);
          localStorage.setItem(`accordion_${item.storageKey}`, JSON.stringify(isCollapsed));
          // 调用 onToggle 回调
          if (item.onToggle) {
            item.onToggle(!isCollapsed); // 传入展开状态（true=展开，false=折叠）
          }
        } catch (error) {
          console.warn(`保存折叠状态失败 (${item.storageKey}):`, error);
        }
      }
    });
  }, [value, items]);

  return (
    <Accordion
      type={type}
      collapsible={type === "single"}
      value={value}
      onValueChange={setValue}
      className={cn("w-full bg-[rgba(42,42,58,0.6)] rounded-lg", className)}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} className="border-none">
          <AccordionTrigger className="py-2 px-3 hover:no-underline hover:bg-white/5 transition-colors flex items-center gap-2 flex-1 text-left">
            <div className="flex items-center gap-2 flex-1 text-left">
              {item.icon && <span className="text-base leading-none">{item.icon}</span>}
              <span className="font-semibold text-[13px] text-white leading-none">{item.title}</span>
              {item.count !== undefined && (
                <span className="text-[11px] text-gray-500 font-normal">({item.count})</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-2 pt-0">
            {item.children}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

