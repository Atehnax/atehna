import type { InputHTMLAttributes } from 'react';
import { adminFilterInputTokenClasses } from '@/shared/ui/theme/tokens';

type AdminFilterInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function AdminFilterInput({ className = '', ...props }: AdminFilterInputProps) {
  const mergedClassName = `${adminFilterInputTokenClasses} ${className}`.trim();
  return <input {...props} className={mergedClassName} />;
}
