import { View, Text, type ViewProps } from 'react-native';
import { colors, typography } from '../../theme/tokens';

interface TacticalPanelProps extends ViewProps {
  title?: string;
  accent?: 'default' | 'danger' | 'warn' | 'info';
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function TacticalPanel({
  title,
  accent = 'default',
  headerRight,
  children,
  style,
  ...props
}: TacticalPanelProps) {
  const borderColor =
    accent === 'danger'
      ? colors.danger
      : accent === 'warn'
        ? colors.warn
        : accent === 'info'
          ? colors.info
          : colors.border;

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
          borderLeftWidth: accent !== 'default' ? 3 : 1,
        },
        style,
      ]}
      {...props}
    >
      {(title || headerRight) && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          {title && <Text style={{ ...typography.label, color: colors.accent }}>{title}</Text>}
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );
}
