'use client';

type ToggleSwitchColor = 'green' | 'blue' | 'purple' | 'red' | 'indigo';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  color?: ToggleSwitchColor;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

const activeColorClasses: Record<ToggleSwitchColor, string> = {
  green: 'bg-green-600 dark:bg-green-600',
  blue: 'bg-blue-600 dark:bg-blue-600',
  purple: 'bg-purple-600 dark:bg-purple-600',
  red: 'bg-linear-to-r from-red-600 to-pink-600',
  indigo: 'bg-indigo-600 dark:bg-indigo-600',
};

const focusColorClasses: Record<ToggleSwitchColor, string> = {
  green: 'focus:ring-green-500',
  blue: 'focus:ring-blue-500',
  purple: 'focus:ring-purple-500',
  red: 'focus:ring-red-500',
  indigo: 'focus:ring-indigo-500',
};

export default function ToggleSwitch({
  checked,
  onChange,
  color = 'green',
  disabled = false,
  className = '',
  ariaLabel,
  title,
}: ToggleSwitchProps) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          void onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
        focusColorClasses[color]
      } ${
        checked
          ? activeColorClasses[color]
          : 'bg-gray-200 dark:bg-gray-700'
      } ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
