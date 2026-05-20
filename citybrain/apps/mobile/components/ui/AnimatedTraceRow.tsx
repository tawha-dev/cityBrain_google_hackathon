import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { colors } from '../../theme/tokens';

interface AnimatedTraceRowProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  isNew?: boolean;
}

export function AnimatedTraceRow({
  title,
  subtitle,
  accentColor = colors.accent,
  isNew,
}: AnimatedTraceRowProps) {
  const opacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const translateX = useRef(new Animated.Value(isNew ? -12 : 0)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [isNew, opacity, translateX]);

  return (
    <Animated.View
      style={{
        marginBottom: 10,
        borderLeftWidth: 2,
        borderLeftColor: accentColor,
        paddingLeft: 10,
        opacity,
        transform: [{ translateX }],
      }}
    >
      <Text style={{ color: accentColor, fontFamily: 'monospace', fontSize: 11 }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16 }}>
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}
