# Database test gate

`npm run test:db` starts an in-memory embedded PostgreSQL using PGlite, applies the migrations, and checks RLS, owner isolation, forbidden direct XP writes, transaction idempotency, correction replay, monotonic levels, missed-day reconciliation, historical backfill, dependent streak bonus withdrawal, and To-Do depth. The test creates a small local `auth.uid()` shim and roles. It omits `create extension pgcrypto` because the embedded runtime provides `gen_random_uuid()` without that extension.

This is a meaningful local integration test, but it uses one connection. Before the frontend sends real activity, validate the same migrations against a local or isolated Supabase/PostgreSQL instance with two independent authenticated sessions. Add a race test for two devices submitting the same quest occurrence and sleep night, and verify stale corrections, uniqueness, RLS and RPC `EXECUTE` privileges there. Supabase Auth must have public signup disabled and an owner account provisioned privately. Do not put a service-role key in the frontend.

The quest RPC currently handles Standard and Volatile completions; Routine step completion, Hobby awards, finish awards, full outcome/date correction, and profile-backed theme synchronization are still for their feature milestones. Database rows and RPCs are not connected to the preview UI yet.
