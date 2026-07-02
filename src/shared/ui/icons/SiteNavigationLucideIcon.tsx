'use client';

import { DynamicIcon, dynamicIconImports, type IconName } from 'lucide-react/dynamic.mjs';
import type { ComponentProps } from 'react';
import { toLucideIconName, type SiteNavigationItemIcon } from '@/shared/domain/navigation/siteNavigation';

export const siteNavigationLucideIconNames = Object.keys(dynamicIconImports).sort((a, b) => a.localeCompare(b)) as IconName[];

export function isSiteNavigationLucideIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(dynamicIconImports, name);
}

export function toSiteNavigationLucideIconName(icon: SiteNavigationItemIcon): IconName {
  const normalizedIcon = toLucideIconName(icon);
  return isSiteNavigationLucideIconName(normalizedIcon) ? normalizedIcon : 'box';
}

type SiteNavigationLucideIconProps = Omit<ComponentProps<typeof DynamicIcon>, 'fallback' | 'name'> & {
  icon: SiteNavigationItemIcon;
};

export function SiteNavigationLucideIcon({ icon, className, strokeWidth = 1.75, ...props }: SiteNavigationLucideIconProps) {
  const name = toSiteNavigationLucideIconName(icon);

  return (
    <DynamicIcon
      {...props}
      name={name}
      className={className}
      strokeWidth={strokeWidth}
      fallback={() => <svg viewBox="0 0 24 24" className={className} aria-hidden="true" />}
    />
  );
}
