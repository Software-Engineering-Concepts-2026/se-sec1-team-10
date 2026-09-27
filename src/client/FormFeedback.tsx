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
  ...props
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  error?: string[];
  autoComplete?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="field" htmlFor={name}>
      <span>{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <small id={`${name}-error`} className="field-error">
          {error[0]}
        </small>
      )}
    </label>
  );
}
