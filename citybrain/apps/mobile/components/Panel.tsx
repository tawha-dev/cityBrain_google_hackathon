import { View, Text, type ViewProps } from 'react-native';

interface PanelProps extends ViewProps {
  title?: string;
  accent?: 'default' | 'danger' | 'warn';
  children: React.ReactNode;
}

export function Panel({ title, accent = 'default', children, style, ...props }: PanelProps) {
  const borderColor =
    accent === 'danger' ? '#FF3B5C' : accent === 'warn' ? '#FFB020' : '#1E2A38';

  return (
    <View
      style={[
        {
          backgroundColor: '#121820',
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
        },
        style,
      ]}
      {...props}
    >
      {title && (
        <Text
          style={{
            color: '#00FFC6',
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: 2,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
