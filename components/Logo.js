import Image from 'next/image';
import Link from 'next/link';
import { BRAND, LOGO } from '@/data/site';
import { cn } from '@/lib/utils';

/**
 * The brand lockup.
 *
 * The artwork is never recoloured, filtered or distorted here — it is rendered
 * at its natural aspect ratio and only scaled. To change the logo, edit `LOGO`
 * in data/site.js; nothing else references the file path.
 */
export default function Logo({
  variant = 'full',
  className = '',
  height = 40,
  href = '/',
  priority = false,
}) {
  const isMark = variant === 'mark';
  const src = isMark ? LOGO.mark : LOGO.full;
  // Both variants keep their own intrinsic ratio — the artwork is only ever
  // scaled, never stretched to fit a box.
  const ratio = isMark
    ? LOGO.markWidth / LOGO.markHeight
    : LOGO.fullWidth / LOGO.fullHeight;
  const width = Math.round(height * ratio);

  const image = (
    <Image
      src={src}
      alt={href ? LOGO.alt : ''}
      width={width}
      height={height}
      priority={priority}
      className="h-full w-auto object-contain"
    />
  );

  const content = (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      style={{ height }}
    >
      {image}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      aria-label={`${BRAND.name} — home`}
      className="inline-flex items-center rounded-sm transition-opacity duration-300 hover:opacity-85"
    >
      {content}
    </Link>
  );
}
