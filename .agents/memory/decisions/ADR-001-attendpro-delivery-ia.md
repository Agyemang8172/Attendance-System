# ADR-001: AttendPro approved delivery and feature placement

## Metadata
- Status: Accepted owner decisions; implementation remains not started.
- Date: 2026-10-31
- Authors: Godfred (decision authority), Orchestrator (record)
- Triage Level: STANDARD planning; future DB/security work retains its own gates.
- Superseded By: None.

## Context and drivers
The owner reviewed the brownfield investigation, Master Plan and final IA. Earlier open proposals and duplicated navigation must not be treated as current execution authority.

## Considered options
The reviewed plan compared separate versus grouped Schedule/Requests, primary versus contextual Exceptions, duplicate versus shared operational routes and drawer versus dedicated employee detail. The owner's final choices are binding; they are not reopened here.

## Decision outcome
Use docs/attendpro/DECISION-REGISTER.md section G, MASTER-GAP-REQUIREMENTS.md and INFORMATION-ARCHITECTURE.md. Root DESIGN.md remains visual authority. Staff uses Attendance; Schedule owns Off-days; Requests keeps distinct workflows; Audit is secondary; business settings is Configuration; employee detail is dedicated. Kiosk is a standalone paired-camera QR/four-digit-PIN flow with automatic permitted punch and no confirmation. Running sessions keep starting policy. PIN reset reveals once to the authorized operator. No fake dismiss, map provider or permission expansion.

## Consequences
Contextual navigation reduces duplication while shared routes preserve compatibility. Numeric Node runtime selection and bounded engineering specifications still require evidence. All P01-P32 units in PHASED-IMPLEMENTATION-PLAN.md remain NOT_STARTED. This ADR accepts owner decisions, not the new phase plan or any code, data, deployment or commit action.

## Verification gate
Review the documentation diff and humanizer result. Future execution uses scoped QA/Tester/Security gates, DBA/human approval before DB changes, the three-loop stop and commit wrapper. Preserve accepted REC-01 through REC-05; unknown deployment evidence remains unknown.
