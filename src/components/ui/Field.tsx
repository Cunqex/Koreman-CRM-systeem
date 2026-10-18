import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy-800 placeholder:text-navy-300 focus:border-navy-400 disabled:bg-navy-50 disabled:text-navy-400 aria-[invalid=true]:border-accent-red';

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('block', className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-navy-700"
      >
        {label}
        {required ? <span className="ml-0.5 text-accent-red">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-status-redfg">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, className)} {...rest} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn(control, className)} {...rest} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(control, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex items-start gap-2 text-sm text-navy-700', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line text-navy-950 focus:ring-accent-blue"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}
