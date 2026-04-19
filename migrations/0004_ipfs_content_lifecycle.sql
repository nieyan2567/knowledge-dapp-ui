ALTER TABLE ipfs_upload_records
    ADD COLUMN IF NOT EXISTS content_id BIGINT,
    ADD COLUMN IF NOT EXISTS version_number BIGINT,
    ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ipfs_upload_records_content_id
    ON ipfs_upload_records (content_id);

CREATE INDEX IF NOT EXISTS idx_ipfs_upload_records_deletion_scheduled_at
    ON ipfs_upload_records (deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL;
