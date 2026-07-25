"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CheckboxFilterOption {
  value: string;
  label: string;
}

interface CheckboxFilterDropdownProps {
  label: string;
  options: CheckboxFilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

export function CheckboxFilterDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = "Todos",
  showAllOption = false,
  allOptionLabel = "Todos",
}: CheckboxFilterDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 240;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + gap && rect.top > spaceBelow;

    setPosition({
      top: openUpward ? rect.top - menuHeight - gap : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 220),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleValue(value: string, checked: boolean) {
    if (checked) {
      onChange([...selected, value]);
      return;
    }
    onChange(selected.filter((item) => item !== value));
  }

  function selectAll() {
    onChange([]);
  }

  const isAllSelected = selected.length === 0;

  const summary = isAllSelected
    ? showAllOption
      ? allOptionLabel
      : placeholder
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? "1 selecionado")
      : `${selected.length} selecionados`;

  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-2 shadow-lg"
      style={
        position
          ? { top: position.top, left: position.left, width: position.width }
          : { top: -9999, left: -9999, visibility: "hidden" as const }
      }
    >
      {showAllOption ? (
        <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm font-medium hover:bg-muted">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => {
              if (checked === true) {
                selectAll();
              }
            }}
          />
          {allOptionLabel}
        </label>
      ) : null}
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
        >
          <Checkbox
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
          />
          {option.label}
        </label>
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className={cn("truncate", isAllSelected && !showAllOption && "text-muted-foreground")}>
          {summary}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 opacity-60", open && "rotate-180")} />
      </Button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
