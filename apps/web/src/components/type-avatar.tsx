import type { AvatarId } from '@tecleo/shared';

import { cn } from '@/lib/utils';

/** Acabados del tipo: colores fijos (no dependen del tema) con contraste AA entre letra y fondo. */
export const AVATAR_STYLES: Readonly<Record<AvatarId, { background: string; color: string }>> = {
  brass: { background: '#d9a441', color: '#1a1406' },
  ink: { background: '#2b3354', color: '#ece6d8' },
  forest: { background: '#2f5d46', color: '#eef3ea' },
  plum: { background: '#5b3466', color: '#f6ecf3' },
  graphite: { background: '#3d3f45', color: '#f0f0ee' },
  ribbon: { background: '#b3322d', color: '#ffffff' },
};

const SIZES = { sm: 'size-7 text-sm', md: 'size-10 text-lg', lg: 'size-16 text-3xl' } as const;

/** Avatar: un tipo de imprenta con la inicial del apodo. */
export function TypeAvatar({
  nickname,
  avatar,
  size = 'md',
  className,
}: {
  nickname: string;
  avatar: AvatarId | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const style = AVATAR_STYLES[avatar ?? 'brass'];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[0.3em] font-game shadow-[inset_0_-0.12em_0_rgb(0_0_0_/_0.25)]',
        SIZES[size],
        className,
      )}
      style={style}
    >
      {nickname.charAt(0).toUpperCase()}
    </span>
  );
}
