import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface StatusBadgeProps {
  label: string;
  status?: 'active' | 'inactive' | 'warning' | 'error' | 'neutral';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'neutral',
  style,
}) => {
  const getBadgeColors = () => {
    switch (status) {
      case 'active':
        return { bg: colors.tealMuted, text: colors.tealDark, dot: colors.teal };
      case 'inactive':
        return { bg: colors.backgroundSecondary, text: colors.textSecondary, dot: colors.textMuted };
      case 'warning':
        return { bg: colors.warningMuted, text: '#92400E', dot: colors.warning };
      case 'error':
        return { bg: colors.emergencyMuted, text: colors.emergencyDark, dot: colors.emergency };
      case 'neutral':
      default:
        return { bg: colors.backgroundSecondary, text: colors.textSecondary, dot: colors.textMuted };
    }
  };

  const scheme = getBadgeColors();

  return (
    <View style={[styles.badge, { backgroundColor: scheme.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: scheme.dot }]} />
      <Text style={[typography.captionBold, { color: scheme.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});
