import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'emergency' | 'outline' | 'ghost';
  size?: 'normal' | 'small' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const getButtonStyles = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];

    if (size === 'small') list.push(styles.sizeSmall);
    else if (size === 'large') list.push(styles.sizeLarge);
    else list.push(styles.sizeNormal);

    switch (variant) {
      case 'accent':
        list.push(styles.accent);
        break;
      case 'emergency':
        list.push(styles.emergency);
        break;
      case 'outline':
        list.push(styles.outline);
        break;
      case 'ghost':
        list.push(styles.ghost);
        break;
      case 'primary':
      default:
        list.push(styles.primary);
        break;
    }

    if (disabled || loading) {
      list.push(styles.disabled);
    }

    if (style) list.push(style);
    return list;
  };

  const getTextStyles = (): TextStyle[] => {
    const list: TextStyle[] = [
      size === 'small' ? typography.buttonSmall : typography.button,
    ];

    switch (variant) {
      case 'outline':
        list.push({ color: colors.teal });
        break;
      case 'ghost':
        list.push({ color: colors.textSecondary });
        break;
      case 'emergency':
      case 'accent':
      case 'primary':
      default:
        list.push({ color: colors.textOnPrimary });
        break;
    }

    if (disabled) {
      list.push({ color: colors.textMuted });
    }

    if (textStyle) list.push(textStyle);
    return list;
  };

  return (
    <TouchableOpacity
      style={getButtonStyles()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.teal : '#FFFFFF'}
        />
      ) : (
        <Text style={getTextStyles()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: spacing.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sizeSmall: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  sizeNormal: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    minHeight: spacing.touchTarget,
  },
  sizeLarge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  accent: {
    backgroundColor: colors.teal,
  },
  emergency: {
    backgroundColor: colors.emergency,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
});
