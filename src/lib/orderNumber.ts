export const toDisplayOrderNumber = (value: string) => {
  if (!value) return value;
  if (value.toUpperCase().startsWith('ORD-')) return `N-${value.slice(4)}`;
  return value;
};
