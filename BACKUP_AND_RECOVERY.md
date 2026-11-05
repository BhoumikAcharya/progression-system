# Backup and recovery (v1)

## User export

After signing into a connected account, open **Hub → Settings → Data & backup → Download JSON backup**. The server assembles a single owner-filtered snapshot with `schema_version: 1`, `exported_at`, `account_user_id`, and all current activity/configuration/audit tables. The browser downloads the JSON directly to your device; the app does not upload it to a public bucket. Keep the file private and copy it to storage you control. Check the timestamp and file size after downloading.

The local no-credentials preview cannot export activity. Import/restore from JSON is not implemented in v1. A download is a manual copy, **not an automatic backup**. Very large histories may need a future streamed export rather than one JSON response.

## Database recovery

Supabase PostgreSQL is the source of truth. Before using a connected project for irreplaceable data, the owner should choose and verify a database backup strategy for that project's plan in the Supabase dashboard. Record the backup schedule, retention, storage location, access controls, and a tested restore procedure outside this repository. Do not assume point-in-time recovery or automatic backups are available without verifying the selected plan.

For a manual database-level backup, use a trusted PostgreSQL client and a private connection string supplied outside this repository. Save the dump in encrypted storage; never commit it, a connection string, or a service-role key. Restore first to a separate test project, apply the same migration set, verify row counts and owner isolation, and only then plan any production recovery. A JSON user export is useful for inspection and archival but is not currently an importable database dump.

The frontend deployment on Hostinger does not hold the database backup. Deployment and production recovery setup remain separate work.
