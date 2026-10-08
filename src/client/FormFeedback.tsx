import { useState } from 'react';
import { UiIcon } from './Ui';

export type Feedback = {
  message: string;
  error: boolean;
  fields?: Record<string, string[]>;
} | null;

export function FeedbackMessage({ value }: { value: Feedback }) {
  if (!value) return null;

  return (
    <div
      className={`feedback ${value.error ? "error" : "success"}`}
      role={value.error ? "alert" : "status"}
    >
      {value.message}
    </div>
  );
}

export function Field({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  icon,
  revealPassword = false,
  ...props
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  error?: string[];
  icon?: string;
  revealPassword?: boolean;
  autoComplete?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  step?: string;
  placeholder?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <label className="field" htmlFor={name}>
      <span>{label}</span>
      <span className={`field-input ${icon ? 'has-icon' : ''} ${revealPassword ? 'has-reveal' : ''}`}>
      {icon && <UiIcon name={icon} size={18} />}
      <input
        id={name}
        name={name}
        type={type === 'password' && revealed ? 'text' : type}
        aria-label={label}
        defaultValue={defaultValue}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {type === 'password' && revealPassword && <button type="button" className="field-reveal" aria-label={`${revealed ? 'ซ่อน' : 'แสดง'}${label}`} aria-pressed={revealed} onClick={() => setRevealed(value => !value)}><UiIcon name="eye" size={18} /></button>}
      </span>
      {error && (
        <small id={`${name}-error`} className="field-error">
          {error[0]}
        </small>
      )}
    </label>
  );
}
