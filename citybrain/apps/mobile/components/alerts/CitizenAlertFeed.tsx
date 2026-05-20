import { View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import type { AlertItem } from '../../lib/store';

interface CitizenAlertFeedProps {
  alerts: AlertItem[];
  crisisTitle?: string;
}

export function CitizenAlertFeed({ alerts, crisisTitle }: CitizenAlertFeedProps) {
  if (alerts.length === 0) {
    return (
      <View>
        <View
          style={{
            backgroundColor: colors.dangerDim,
            borderWidth: 1,
            borderColor: colors.warn,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.warn, fontFamily: 'monospace', fontSize: 11, marginBottom: 6 }}>
            STANDBY — ALERT TEMPLATE
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>
            CITYBRAIN ALERT: {crisisTitle ?? 'Crisis'} — avoid affected zone. Follow official
            routes.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'right' }}>
            انتباہ: متاثرہ علاقے سے گریز کریں۔
          </Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 8 }}>
          Alerts broadcast on execution
        </Text>
      </View>
    );
  }

  return (
    <View>
      {alerts.map((a) => (
        <View
          key={a.id}
          style={{
            marginBottom: 10,
            backgroundColor: colors.surfaceRaised,
            borderLeftWidth: 3,
            borderLeftColor: colors.warn,
            padding: 12,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: colors.warn, fontSize: 10, fontFamily: 'monospace' }}>
            ZONE {a.zoneLabel} · REACH ~{a.reachEstimate.toLocaleString()}
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
            {a.preview ?? 'Multilingual emergency alert dispatched'}
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
            {new Date(a.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      ))}
    </View>
  );
}
