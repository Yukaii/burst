import * as LucideIcons from 'lucide-react';
import type { ComponentType } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { getCommandIconUrl } from '@/src/lib/commands';
import { cn } from '../lib/utils';

type CommandIconProps = {
  icon?: BurstCommand['icon'];
  website?: string;
  matchPatterns?: string[];
  fallbackLabel?: string;
  className?: string;
  imageClassName?: string;
};

export function CommandIcon({
  icon,
  website = 'all sites',
  matchPatterns = [],
  fallbackLabel,
  className,
  imageClassName,
}: CommandIconProps) {
  if (!icon) {
    return <span className={cn('inline-flex items-center justify-center overflow-hidden', className)}>{fallbackLabel ?? 'LI'}</span>;
  }

  if (icon.type === 'lucide') {
    const IconComponent = (LucideIcons as Record<string, ComponentType<{ size?: number; className?: string }>>)[icon.name];

    return (
      <span className={cn('inline-flex items-center justify-center overflow-hidden', className)}>
        {IconComponent ? <IconComponent size={16} className="size-4" /> : <LucideIcons.Code className="size-4" />}
      </span>
    );
  }

  const iconUrl = getCommandIconUrl({ icon, website, matchPatterns });
  if (iconUrl) {
    return (
      <span className={cn('inline-flex items-center justify-center overflow-hidden', className)}>
        <img src={iconUrl} alt="" className={cn('size-full object-cover', imageClassName)} />
      </span>
    );
  }

  if (icon.type === 'emoji' || icon.type === 'initials') {
    return <span className={cn('inline-flex items-center justify-center overflow-hidden', className)}>{icon.value}</span>;
  }

  return <span className={cn('inline-flex items-center justify-center overflow-hidden', className)}>{fallbackLabel ?? 'LI'}</span>;
}
