"use client";

import { Input } from "@/components/ui/input";
import { TELEFONE_PLACEHOLDER } from "@/lib/constants/input-placeholders";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { cn } from "@/lib/utils";

interface TelefoneInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> {
  value: string;
  onChange: (value: string) => void;
}

export function TelefoneInput({
  value,
  onChange,
  placeholder = TELEFONE_PLACEHOLDER,
  className,
  ...props
}: TelefoneInputProps) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(formatTelefoneBr(event.target.value))}
      className={cn(className)}
      {...props}
    />
  );
}

/** Formata telefone em inputs não controlados (form action nativo). */
export function formatTelefoneInputElement(event: React.FormEvent<HTMLInputElement>): void {
  event.currentTarget.value = formatTelefoneBr(event.currentTarget.value);
}
