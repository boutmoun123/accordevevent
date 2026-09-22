# Weekly contact availability

The matchmaker edits `/matchmaker/availability`. Sunday is weekday `0`, Saturday `6`.
Times use `Asia/Damascus` through IANA tzdata. Defaults: 30 minutes and 14 calendar
days (today through today + 13), excluding appointment starts at or before now.
Only complete appointments fit inside a range; adjacent ranges are allowed,
overlapping or overnight ranges are rejected. Disabled days retain saved ranges.

## API

- `GET /api/v1/matchmaker/availability`: settings, revision, timezone and all seven days.
- `PATCH /api/v1/matchmaker/availability`: replace the complete weekly schedule.
  Submit `revision`, `slot_duration_minutes`, `booking_horizon_days`, and `days`.
  Each day has `weekday`, `is_active`, and `ranges` of `start_time` / `end_time`.
  A stale revision returns 409 without overwriting a newer edit.
- `GET /api/v1/contact-availability?matchmaker_id=...`: generate future AVAILABLE
  choices without inserting database rows. Owner filtering is optional.
- `POST /api/v1/female-leads`: `phone`, `governorate`, `consent: true`, optional
  `notes`, plus the selected slot's `matchmaker_id` and aware `scheduled_at`.
  The server recomputes eligibility; client-supplied duration/end times are not trusted.
- `GET /api/v1/matchmaker/appointments`: own bookings with contact details.
- `PATCH /api/v1/matchmaker/appointments/{id}`: move BOOKED to COMPLETED,
  CANCELLED or NO_SHOW. Cancellation frees the time if still allowed by the rules.

## Persistence and concurrency

`matchmaker_availability` stores weekly ranges, `matchmakers` stores settings and
revision, and `contact_appointments` stores bookings linked to `female_leads`.
There is no persisted table of generated free slots.

Booking, schedule editing and appointment changes acquire the same matchmaker
database write lock using an UPDATE before reading the relevant state. This
serializes competing writes on PostgreSQL and SQLite. Booking then checks all
overlapping non-cancelled appointments and inserts the lead and booking in one
transaction. A partial unique index additionally prevents two non-cancelled
appointments at the same start. Existing appointments retain their original date,
start and end after schedule or duration changes; overlap checks account for this.

## Migration

Install dependencies and run `python -m alembic upgrade head` from `backend`.
Revision `c83b042a1002` removes the old single-slot system and preserves each linked
booking, including completed/cancelled bookings. Old slots had no end time, so
their migrated duration is 30 minutes, capped at the end of the local day.
Unused old slots are removed; weekly rules start empty rather than inferring
recurring availability from isolated dates. Keep a database backup before migrating.
Downgrading cannot represent cancelled/rebooked history at identical start times
and refuses that case before making changes.

## Verification

Run `python -m pytest app/tests/test_availability.py app/tests/test_weekly_migration.py`.
With the frontend running on localhost:3000, run
`python -m scripts.browser_weekly_availability` for the full Chrome UI/API scenario.
That script uses a separate database and a temporary local API process, preserves
local accounts, and writes screenshots under `test-results/weekly-*`.
