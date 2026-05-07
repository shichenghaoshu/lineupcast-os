"use client";

import { useState, useCallback, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

// ============================================================
// Types
// ============================================================

interface BaseFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

interface InputProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  icon?: ReactNode;
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends BaseFieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  options: SelectOption[];
  placeholder?: string;
}

interface TextareaProps extends BaseFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  maxLength?: number;
  showCount?: boolean;
}

interface CheckboxProps extends Omit<BaseFieldProps, "error" | "hint">, Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  description?: string;
}

// ============================================================
// Input
// ============================================================

export function Input({
  label,
  error,
  hint,
  required,
  className = "",
  icon,
  id,
  ...props
}: InputProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const hasError = !!error;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--accent-red)]">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <input
          id={fieldId}
          className={`w-full rounded-lg border bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-card)] ${
            icon ? "pl-10" : ""
          } ${
            hasError
              ? "border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:ring-[var(--accent-red)]/30"
              : "border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:ring-[var(--accent-blue)]/30"
          }`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...props}
        />
      </div>
      {hasError && (
        <div
          id={`${fieldId}-error`}
          className="flex items-center gap-1.5 text-xs text-[var(--accent-red)]"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!hasError && hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Select
// ============================================================

export function Select({
  label,
  error,
  hint,
  required,
  className = "",
  options,
  placeholder,
  id,
  ...props
}: SelectProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const hasError = !!error;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--accent-red)]">*</span>}
      </label>
      <select
        id={fieldId}
        className={`w-full appearance-none rounded-lg border bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-card)] ${
          hasError
            ? "border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:ring-[var(--accent-red)]/30"
            : "border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:ring-[var(--accent-blue)]/30"
        }`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <div
          id={`${fieldId}-error`}
          className="flex items-center gap-1.5 text-xs text-[var(--accent-red)]"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!hasError && hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Textarea
// ============================================================

export function Textarea({
  label,
  error,
  hint,
  required,
  className = "",
  maxLength,
  showCount = false,
  id,
  value,
  onChange,
  ...props
}: TextareaProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const hasError = !!error;
  const currentLength = typeof value === "string" ? value.length : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
          {required && <span className="ml-1 text-[var(--accent-red)]">*</span>}
        </label>
        {showCount && maxLength && (
          <span
            className={`text-xs ${
              currentLength > maxLength
                ? "text-[var(--accent-red)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={fieldId}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        className={`w-full resize-y rounded-lg border bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-card)] ${
          hasError
            ? "border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:ring-[var(--accent-red)]/30"
            : "border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:ring-[var(--accent-blue)]/30"
        }`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {hasError && (
        <div
          id={`${fieldId}-error`}
          className="flex items-center gap-1.5 text-xs text-[var(--accent-red)]"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!hasError && hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Checkbox
// ============================================================

export function Checkbox({
  label,
  required,
  className = "",
  description,
  id,
  ...props
}: CheckboxProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label
      htmlFor={fieldId}
      className={`flex cursor-pointer items-start gap-3 ${className}`}
    >
      <input
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--accent-blue)] transition-colors focus:ring-2 focus:ring-[var(--accent-blue)]/30 focus:ring-offset-1 focus:ring-offset-[var(--bg-card)]"
        {...props}
      />
      <div className="flex-1">
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
          {required && <span className="ml-1 text-[var(--accent-red)]">*</span>}
        </span>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

// ============================================================
// useValidation Hook
// ============================================================

type ValidationRule<T> = {
  test: (value: T) => boolean;
  message: string;
};

type FieldRules<T> = Record<string, ValidationRule<T>[]>;

type FieldValues = Record<string, unknown>;

export function useValidation<T extends FieldValues>(rules: FieldRules<T[string]>) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = useCallback(
    (values: T): boolean => {
      const newErrors: Partial<Record<keyof T, string>> = {};
      let isValid = true;

      for (const [field, fieldRules] of Object.entries(rules)) {
        const value = values[field];
        for (const rule of fieldRules) {
          if (!rule.test(value)) {
            newErrors[field as keyof T] = rule.message;
            isValid = false;
            break; // Stop at first error for this field
          }
        }
      }

      setErrors(newErrors);
      return isValid;
    },
    [rules]
  );

  const validateField = useCallback(
    (field: keyof T, value: T[keyof T]): string | undefined => {
      const fieldRules = rules[field as string];
      if (!fieldRules) return undefined;

      for (const rule of fieldRules) {
        if (!rule.test(value)) {
          setErrors((prev) => ({ ...prev, [field]: rule.message }));
          return rule.message;
        }
      }

      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return undefined;
    },
    [rules]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return {
    errors,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
  };
}

// ============================================================
// Common Validation Rules (convenience helpers)
// ============================================================

export const rules = {
  required: (message = "此字段为必填项"): ValidationRule<unknown> => ({
    test: (value) => {
      if (typeof value === "string") return value.trim().length > 0;
      return value !== null && value !== undefined;
    },
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    test: (value) => typeof value === "string" && value.length >= min,
    message: message || `至少需要 ${min} 个字符`,
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    test: (value) => typeof value === "string" && value.length <= max,
    message: message || `不能超过 ${max} 个字符`,
  }),

  email: (message = "请输入有效的邮箱地址"): ValidationRule<string> => ({
    test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  url: (message = "请输入有效的 URL"): ValidationRule<string> => ({
    test: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    test: (value) => regex.test(value),
    message,
  }),

  numeric: (message = "请输入有效的数字"): ValidationRule<string> => ({
    test: (value) => !isNaN(Number(value)),
    message,
  }),

  min: (min: number, message?: string): ValidationRule<string> => ({
    test: (value) => Number(value) >= min,
    message: message || `不能小于 ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule<string> => ({
    test: (value) => Number(value) <= max,
    message: message || `不能大于 ${max}`,
  }),
};
