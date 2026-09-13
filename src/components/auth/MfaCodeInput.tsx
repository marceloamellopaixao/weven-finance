"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type MfaCodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
};

export function MfaCodeInput({ id, value, onChange, disabled, autoFocus, invalid, className }: MfaCodeInputProps) {
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || "");

  const renderDigit = (digit: string, index: number) => {
    const isActive = !disabled && index === Math.min(value.length, 5);
    return (
      <span
        key={index}
        aria-hidden="true"
        className={cn(
          "flex h-11 w-8 items-center justify-center rounded-xl border bg-background/80 font-mono text-lg font-semibold tabular-nums shadow-sm transition-all sm:h-14 sm:w-11 sm:text-2xl",
          digit ? "border-primary/45 text-foreground" : "border-border text-muted-foreground",
          focused && isActive && "border-primary ring-2 ring-primary/20",
          invalid && "border-destructive/70 ring-1 ring-destructive/20",
        )}
      >
        {digit}
      </span>
    );
  };

  return (
    <div className={cn("relative mx-auto w-fit max-w-full", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-label="Código de verificação de 6 dígitos"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-center gap-2.5 sm:gap-3" aria-hidden="true">
        <div className="flex gap-1.5 sm:gap-2">{digits.slice(0, 3).map(renderDigit)}</div>
        <span className="h-px w-2 rounded-full bg-border sm:w-4" />
        <div className="flex gap-1.5 sm:gap-2">{digits.slice(3).map((digit, index) => renderDigit(digit, index + 3))}</div>
      </div>
    </div>
  );
}
