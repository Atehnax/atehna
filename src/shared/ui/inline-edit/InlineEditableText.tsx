import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent } from 'react';

type InlineEditableTextProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onInput'> & {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  autoFocus?: boolean;
  placeCaretAtEndOnFocus?: boolean;
};

export default function InlineEditableText({
  value,
  onChange,
  onKeyDown,
  autoFocus = false,
  placeCaretAtEndOnFocus = false,
  className,
  ...props
}: InlineEditableTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.textContent !== value) {
      element.textContent = value;
    }
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const element = ref.current;
    if (!element) return;
    element.focus();
    if (!placeCaretAtEndOnFocus) return;
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [autoFocus, placeCaretAtEndOnFocus]);

  return (
    <div
      {...props}
      ref={ref}
      role="textbox"
      contentEditable
      suppressContentEditableWarning
      data-inline-edit-field="true"
      className={`outline-none focus:outline-none ${className ?? ''}`.trim()}
      onInput={(event) => {
        onChange(event.currentTarget.textContent ?? '');
      }}
      onKeyDown={onKeyDown}
    />
  );
}
