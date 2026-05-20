import type { EmergencyResource, EmergencyResourceCategory } from '../../lib/api';

const CATEGORY_META: Record<EmergencyResourceCategory, { icon: string; label: string }> = {
  hospital: { icon: '🏥', label: 'Hospital' },
  fire_station: { icon: '🚒', label: 'Fire / Rescue' },
  police: { icon: '🚔', label: 'Police' },
  ambulance: { icon: '🚑', label: 'Ambulance / EMS' },
  shelter: { icon: '🏕', label: 'Shelter / Relief' },
  evacuation: { icon: '🚨', label: 'Evacuation point' },
  rescue: { icon: '⛑', label: 'Rescue / NDMA' },
  civil_defense: { icon: '🛡', label: 'Civil defence' },
  pharmacy: { icon: '💊', label: 'Pharmacy' },
  blood_bank: { icon: '🩸', label: 'Blood bank' },
  coast_guard: { icon: '⚓', label: 'Coast / Maritime' },
};

interface NearbyResourcesPanelProps {
  resources: EmergencyResource[];
  selectedIds: Set<string>;
  onToggle: (resource: EmergencyResource) => void;
  loading?: boolean;
  incidentLabel?: string;
}

export function NearbyResourcesPanel({
  resources,
  selectedIds,
  onToggle,
  loading,
  incidentLabel,
}: NearbyResourcesPanelProps) {
  if (loading) {
    return <p className="muted-copy nearby-resources__loading">Scanning emergency assets near incident…</p>;
  }

  if (resources.length === 0) {
    return (
      <p className="muted-copy">
        No facilities found — ensure Places API is enabled on your Google Maps key.
      </p>
    );
  }

  const grouped = resources.reduce<Record<string, EmergencyResource[]>>((acc, r) => {
    const key = r.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="nearby-resources-wrap">
      {incidentLabel && (
        <p className="nearby-resources__incident-type">
          Resources for <strong>{incidentLabel}</strong> — select facilities, then dispatch
        </p>
      )}
      {Object.entries(grouped).map(([cat, items]) => {
        const meta = CATEGORY_META[cat as EmergencyResourceCategory] ?? CATEGORY_META.hospital;
        return (
          <div key={cat} className="nearby-resources__group">
            <h4 className="nearby-resources__group-title">
              {meta.icon} {meta.label}
            </h4>
            <ul className="nearby-resources">
              {items.map((r) => {
                const selected = selectedIds.has(r.placeId);
                const distKm = (r.distanceMeters / 1000).toFixed(1);
                return (
                  <li key={r.placeId}>
                    <button
                      type="button"
                      className={`nearby-resources__item ${selected ? 'nearby-resources__item--selected' : ''}`}
                      onClick={() => onToggle(r)}
                      aria-pressed={selected}
                    >
                      <span className="nearby-resources__body">
                        <span className="nearby-resources__name">{r.name}</span>
                        <span className="nearby-resources__meta">
                          {distKm} km
                          {r.etaMinutes != null ? ` · ETA ~${r.etaMinutes} min` : ''}
                        </span>
                      </span>
                      <span className="nearby-resources__check" aria-hidden>
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
