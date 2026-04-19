CREATE TABLE IF NOT EXISTS ipfs_upload_records (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_version INTEGER NOT NULL,
    cid TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    status TEXT NOT NULL CHECK (status IN ('uploaded', 'registered', 'cleaned', 'cleanup_failed')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    registered_at TIMESTAMPTZ,
    cleaned_at TIMESTAMPTZ,
    register_tx_hash TEXT,
    cleanup_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ipfs_upload_records_status_expires_at
    ON ipfs_upload_records (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ipfs_upload_records_cid
    ON ipfs_upload_records (cid);

CREATE INDEX IF NOT EXISTS idx_ipfs_upload_records_address_uploaded_at
    ON ipfs_upload_records (address, uploaded_at DESC);
