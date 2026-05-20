import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import { MetricTile } from '../ui/MetricTile';
import { useCrisisStore } from '../../lib/store';

export function SimulationViewport() {
  const frame = useCrisisStore((s) => s.simulationFrame);
  const phase = useCrisisStore((s) => s.simulationPhase);
  const timelineEvents = useCrisisStore((s) => s.timelineEvents);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== 'running') return;
    const loop = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  return (
    <View>
      <View
        style={{
          height: 100,
          backgroundColor: colors.void,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.borderActive,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 12 }}>
            SIM {phase.toUpperCase()}
            {frame ? ` · TICK ${frame.tick}` : ''}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
            {frame?.overlayCount ?? 0} map overlays active
          </Text>
        </View>
        {phase === 'running' && (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: colors.accent,
              opacity: 0.6,
              transform: [{ translateY }],
            }}
          />
        )}
      </View>

      {frame ? (
        <View style={{ flexDirection: 'row' }}>
          <MetricTile
            label="CONGESTION"
            value={`${(frame.metrics.congestionIndex * 100).toFixed(0)}%`}
            invertDelta
          />
          <MetricTile
            label="FLOOD km²"
            value={frame.metrics.floodCoverageKm2?.toFixed(2) ?? '0'}
          />
          <MetricTile label="STRANDED" value={frame.metrics.strandedVehicles} invertDelta />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
          Awaiting simulation frames via WebSocket...
        </Text>
      )}

      {timelineEvents.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginBottom: 6 }}>
            SIM TIMELINE
          </Text>
          {timelineEvents.slice(-5).map((e) => (
            <Text
              key={e.id}
              style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginBottom: 4 }}
            >
              T{e.tick} [{e.category}] {e.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
