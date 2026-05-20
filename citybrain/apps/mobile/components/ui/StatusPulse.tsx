import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { colors } from '../../theme/tokens';

interface StatusPulseProps {
  label: string;
  status: 'online' | 'warn' | 'danger' | 'idle';
  size?: number;
}

const STATUS_COLORS = {
  online: colors.accent,
  warn: colors.warn,
  danger: colors.danger,
  idle: colors.textMuted,
};

export function StatusPulse({ label, status, size = 8 }: StatusPulseProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const color = STATUS_COLORS[status];

  useEffect(() => {
    if (status !== 'online') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: status === 'online' ? pulse : 1,
        }}
      />
      <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}
