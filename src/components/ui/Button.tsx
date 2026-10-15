import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ink';
  size?: 'sm' | 'md' | 'lg';
}

const Button = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  ...props
}: ButtonProps) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-full border-ink font-black uppercase tracking-wide whitespace-nowrap transition-all duration-150';

  const variantStyles = {
    primary: 'bg-sun text-ink',
    secondary: 'bg-cobalt text-white',
    outline: 'bg-white text-ink',
    danger: 'bg-coral text-ink',
    ink: 'bg-ink text-white',
  };

  const sizeStyles = {
    sm: 'text-xs px-4 py-2 border-2 shadow-pop-sm',
    md: 'text-sm px-5 py-3 border-[3px] shadow-pop',
    lg: 'text-base px-7 py-4 border-[3px] shadow-pop',
  };

  const stateStyles = disabled
    ? 'opacity-50 cursor-not-allowed shadow-none'
    : 'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pop-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-pop-sm';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${stateStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
