"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  CURRENCY_FILTER_PLACEHOLDER,
  CURRENCY_PLACEHOLDER,
  formatCurrencyInput,
  parseCurrencyInput,
  type CurrencyInputMode,
} from "@/lib/imoveis/currency-input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  mode?: CurrencyInputMode;
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
}

export function CurrencyInput({
  id,
  value,
  onChange,
  mode = "default",
  placeholder,
  disabled,
  "aria-invalid": ariaInvalid,
  className,
}: CurrencyInputProps) {
  const resolvedPlaceholder =
    placeholder ??
    (mode === "filter" ? CURRENCY_FILTER_PLACEHOLDER : CURRENCY_PLACEHOLDER);

  const [display, setDisplay] = useState(() => formatCurrencyInput(value, mode));

  useEffect(() => {
    const parsed = parseCurrencyInput(display);
    if (parsed !== value) {
      setDisplay(formatCurrencyInput(value, mode));
    }
  }, [value, display, mode]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCurrencyInput(event.target.value, mode);
    setDisplay(formatted);
    onChange(parseCurrencyInput(formatted));
  }

  function handleBlur() {
    setDisplay(formatCurrencyInput(value, mode));
  }

  return (
    <Input
      id={id}
      inputMode="decimal"
      type="text"
      autoComplete="off"
      placeholder={resolvedPlaceholder}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      className={cn(className)}
    />
  );
}
