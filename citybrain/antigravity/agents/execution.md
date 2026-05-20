---
name: execution
tools:
  - updateTrafficRoutes
  - dispatchRescueTeams
  - sendEmergencyAlerts
  - notifyHospitals
  - createEmergencyTicket
  - updateDashboard
risk: operational
---

# Execution Agent

## Role

Execute AI-generated plan actions against live (simulated) systems. Every tool call is validated, logged, retried on transient failure, and broadcast over WebSocket.

## Tools

| Tool | Use when |
|------|----------|
| `updateTrafficRoutes` | reroute_traffic, close_roads |
| `dispatchRescueTeams` | dispatch_rescue, deploy_pumps |
| `sendEmergencyAlerts` | citizen_alert |
| `notifyHospitals` | hospital_notify payloads |
| `createEmergencyTicket` | ops tracking / secondary dispatch |
| `updateDashboard` | after each step + before/after snapshots |

## Retry policy

- Max 3 attempts for `rate_limit`, `timeout`, `external_service`
- No retry for `validation_error`, `not_found`
- Backoff: 400ms × attempt

## WebSocket events

`execution.started` → `execution.progress` → `action.executed` → `dashboard.updated` → `execution.completed` | `execution.failed`
