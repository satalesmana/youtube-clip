import * as React from 'react';
import {
  Eye,
  OctagonAlert,
  Hourglass,
  TriangleAlert,
  Siren,
  Bomb,
  Lightbulb,
  KeyRound,
  Lock,
  CircleHelp,
  Flame,
  Zap,
  TrendingUp,
  Target,
  MessageSquare,
  Flag,
  HeartCrack,
  Rocket,
  Gem,
  Wrench,
  Sparkles,
  Star,
  Trophy,
  Compass,
} from 'lucide-react';

export type HookIconName =
  | 'eye'
  | 'octagon-alert'
  | 'hourglass'
  | 'alert-triangle'
  | 'siren'
  | 'bomb'
  | 'lightbulb'
  | 'key'
  | 'lock'
  | 'help-circle'
  | 'flame'
  | 'zap'
  | 'trending-up'
  | 'target'
  | 'message-circle'
  | 'flag'
  | 'heart-crack'
  | 'rocket'
  | 'gem'
  | 'wrench'
  | 'sparkles'
  | 'star'
  | 'trophy'
  | 'compass';

const ICON_MAP: Record<
  HookIconName,
  React.ComponentType<{
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    style?: React.CSSProperties;
    className?: string;
  }>
> = {
  eye: Eye,
  'octagon-alert': OctagonAlert,
  hourglass: Hourglass,
  'alert-triangle': TriangleAlert,
  siren: Siren,
  bomb: Bomb,
  lightbulb: Lightbulb,
  key: KeyRound,
  lock: Lock,
  'help-circle': CircleHelp,
  flame: Flame,
  zap: Zap,
  'trending-up': TrendingUp,
  target: Target,
  'message-circle': MessageSquare,
  flag: Flag,
  'heart-crack': HeartCrack,
  rocket: Rocket,
  gem: Gem,
  wrench: Wrench,
  sparkles: Sparkles,
  star: Star,
  trophy: Trophy,
  compass: Compass,
};

export const EMOJI_TO_ICON_MAP: Record<string, HookIconName> = {
  '👀': 'eye',
  '🛑': 'octagon-alert',
  '⏳': 'hourglass',
  '⚠️': 'alert-triangle',
  '🚨': 'siren',
  '💣': 'bomb',
  '💡': 'lightbulb',
  '🤫': 'key',
  '🔒': 'lock',
  '❓': 'help-circle',
  '🔥': 'flame',
  '⚡': 'zap',
  '📊': 'trending-up',
  '📈': 'trending-up',
  '🎯': 'target',
  '🤔': 'message-circle',
  '🚩': 'flag',
  '💔': 'heart-crack',
  '🚀': 'rocket',
  '💎': 'gem',
  '🛠️': 'wrench',
  '🛠': 'wrench',
  '✨': 'sparkles',
  '⭐': 'star',
  '🏆': 'trophy',
  '🧭': 'compass',
  '😲': 'message-circle',
};

/**
 * Parses any tag string, extracting leading emoji or resolving keyword to a Lucide icon.
 * Guarantees backward compatibility with existing legacy emoji tags.
 */
export function parseHookTag(tag?: string): {
  iconName: HookIconName;
  cleanText: string;
  rawTag: string;
} {
  if (!tag || !tag.trim()) {
    return { iconName: 'sparkles', cleanText: '', rawTag: '' };
  }
  const rawTag = tag.trim();
  const emojiMatch = rawTag.match(/^(\p{Extended_Pictographic}+|\p{Emoji}+)\s*(.*)$/u);
  if (emojiMatch) {
    const emoji = emojiMatch[1];
    const cleanText = emojiMatch[2] || rawTag;
    const mappedIcon = EMOJI_TO_ICON_MAP[emoji];
    if (mappedIcon) {
      return { iconName: mappedIcon, cleanText, rawTag };
    }
    const upper = cleanText.toUpperCase();
    if (upper.includes('VIRAL') || upper.includes('MOMEN')) return { iconName: 'flame', cleanText, rawTag };
    if (upper.includes('KRUSIAL') || upper.includes('KILAT') || upper.includes('FAKTA')) return { iconName: 'zap', cleanText, rawTag };
    if (upper.includes('SALAH') || upper.includes('AWAS') || upper.includes('FATAL')) return { iconName: 'alert-triangle', cleanText, rawTag };
    if (upper.includes('PERINGATAN') || upper.includes('BAHAYA')) return { iconName: 'siren', cleanText, rawTag };
    if (upper.includes('SKIP') || upper.includes('STOP') || upper.includes('LIHAT')) return { iconName: 'eye', cleanText, rawTag };
    if (upper.includes('TIPS') || upper.includes('RAHASIA') || upper.includes('TRIK')) return { iconName: 'lightbulb', cleanText, rawTag };
    if (upper.includes('DATA') || upper.includes('BUKTI') || upper.includes('STATISTIK') || upper.includes('%')) return { iconName: 'trending-up', cleanText, rawTag };
    return { iconName: 'sparkles', cleanText, rawTag };
  }

  const upper = rawTag.toUpperCase();
  if (upper.includes('VIRAL') || upper.includes('MOMEN') || upper.includes('HOT')) return { iconName: 'flame', cleanText: rawTag, rawTag };
  if (upper.includes('KRUSIAL') || upper.includes('KILAT') || upper.includes('FAKTA') || upper.includes('MENARIK')) return { iconName: 'zap', cleanText: rawTag, rawTag };
  if (upper.includes('SALAH') || upper.includes('AWAS') || upper.includes('FATAL') || upper.includes('BAHAYA')) return { iconName: 'alert-triangle', cleanText: rawTag, rawTag };
  if (upper.includes('PERINGATAN') || upper.includes('DARURAT')) return { iconName: 'siren', cleanText: rawTag, rawTag };
  if (upper.includes('SKIP') || upper.includes('STOP') || upper.includes('LIHAT') || upper.includes('TUNGGU')) return { iconName: 'eye', cleanText: rawTag, rawTag };
  if (upper.includes('TIPS') || upper.includes('RAHASIA') || upper.includes('TRIK') || upper.includes('HACK')) return { iconName: 'lightbulb', cleanText: rawTag, rawTag };
  if (upper.includes('DATA') || upper.includes('BUKTI') || upper.includes('STATISTIK') || upper.includes('%')) return { iconName: 'trending-up', cleanText: rawTag, rawTag };
  if (upper.includes('TARGET') || upper.includes('FOKUS')) return { iconName: 'target', cleanText: rawTag, rawTag };
  if (upper.includes('POV') || upper.includes('KATA') || upper.includes('TANYA') || upper.includes('PERNAH')) return { iconName: 'message-circle', cleanText: rawTag, rawTag };
  if (upper.includes('CEPAT') || upper.includes('SOLUSI')) return { iconName: 'rocket', cleanText: rawTag, rawTag };

  return { iconName: 'sparkles', cleanText: rawTag, rawTag };
}

export interface HookIconProps {
  name?: HookIconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  glow?: boolean;
  glowColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const HookIcon: React.FC<HookIconProps> = ({
  name = 'sparkles',
  size = 14,
  color = 'currentColor',
  strokeWidth = 2.4,
  glow = false,
  glowColor,
  className = '',
  style = {},
}) => {
  const normalizedKey = (name in ICON_MAP ? name : 'sparkles') as HookIconName;
  const Component = ICON_MAP[normalizedKey] || Sparkles;

  const resolvedGlow = glow
    ? {
        filter: `drop-shadow(0 0 6px ${glowColor || (color !== 'currentColor' ? color : 'rgba(255,255,255,0.75)')})`,
      }
    : {};

  return (
    <span
      className={`hook-icon-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        verticalAlign: 'middle',
        lineHeight: 0,
        ...resolvedGlow,
        ...style,
      }}
    >
      <Component size={size} color={color} strokeWidth={strokeWidth} />
    </span>
  );
};
