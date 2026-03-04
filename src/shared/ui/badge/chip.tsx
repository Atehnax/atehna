import Badge, { type BadgeProps } from './badge';

export type ChipProps = BadgeProps;

export default function Chip(props: ChipProps) {
  return <Badge {...props} />;
}
