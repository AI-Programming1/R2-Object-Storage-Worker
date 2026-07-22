PRAGMA foreign_keys = ON;

-------------------------------------------------------
-- Videos
-------------------------------------------------------

CREATE TABLE videos (

    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,

    description TEXT NOT NULL,

    filename TEXT NOT NULL,

    mime_type TEXT NOT NULL,

    file_size INTEGER NOT NULL,

    width INTEGER NOT NULL,

    height INTEGER NOT NULL,

    duration_seconds INTEGER NOT NULL,

    thumbnail_key TEXT,

    webm_key TEXT,

    mp4_key TEXT,

    upload_date INTEGER NOT NULL,

    expiration_date INTEGER NOT NULL,

    extension_count INTEGER NOT NULL DEFAULT 0,

    views INTEGER NOT NULL DEFAULT 0,

    moderation_status TEXT NOT NULL DEFAULT 'approved',

    never_expires INTEGER NOT NULL DEFAULT 0,

    last_extension_hash TEXT,

    status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX idx_views
ON videos(views DESC);

CREATE INDEX idx_expiration
ON videos(expiration_date);

CREATE INDEX idx_status
ON videos(status);

-------------------------------------------------------
-- Upload Sessions
-------------------------------------------------------

CREATE TABLE upload_sessions (
    upload_id TEXT PRIMARY KEY,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    expected_chunks INTEGER NOT NULL,
    received_chunks INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0
);

------------------------------------------------------------
-- ACTIVE MULTIPART UPLOADS
------------------------------------------------------------
CREATE TABLE multipart_parts (

    upload_id TEXT NOT NULL,

    part_number INTEGER NOT NULL,

    etag TEXT NOT NULL,

    size INTEGER NOT NULL,

    PRIMARY KEY (
        upload_id,
        part_number
    ),

    FOREIGN KEY(upload_id)
        REFERENCES multipart_uploads(upload_id)
        ON DELETE CASCADE

);

CREATE INDEX idx_multipart_parts
ON multipart_parts(upload_id);


CREATE TABLE multipart_uploads (
    upload_id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);


CREATE INDEX idx_multipart_completed
ON multipart_uploads(completed);

-------------------------------------------------------
-- Upload Chunks
-------------------------------------------------------

CREATE TABLE upload_chunks (

    upload_id TEXT NOT NULL,

    chunk_number INTEGER NOT NULL,

    r2_key TEXT NOT NULL,

    PRIMARY KEY(upload_id, chunk_number)
);

-------------------------------------------------------
-- Video Extensions
-------------------------------------------------------

CREATE TABLE extensions (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    video_id TEXT NOT NULL,

    extension_time INTEGER NOT NULL,

    hashed_ip TEXT NOT NULL
);

CREATE INDEX idx_video_extension
ON extensions(video_id);

-------------------------------------------------------
-- Video Reports
-------------------------------------------------------

CREATE TABLE video_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    video_id TEXT NOT NULL,

    reason TEXT NOT NULL,

    details TEXT NOT NULL DEFAULT '',

    viewer_id TEXT,

    created_at INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'open',

    reviewed_at INTEGER,

    admin_note TEXT NOT NULL DEFAULT '',

    FOREIGN KEY(video_id)
        REFERENCES videos(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_video_reports_status
ON video_reports(status, created_at DESC);

CREATE INDEX idx_video_reports_video
ON video_reports(video_id);

-------------------------------------------------------
-- Daily Views
-------------------------------------------------------

CREATE TABLE daily_views (

    video_id TEXT NOT NULL,

    day INTEGER NOT NULL,

    views INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY(video_id, day)
);

-------------------------------------------------------
-- Views counter on videos
-------------------------------------------------------

CREATE TABLE video_viewers (
    video_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    last_view_at INTEGER NOT NULL,

    PRIMARY KEY (
        video_id,
        viewer_id
    ),

    FOREIGN KEY(video_id)
        REFERENCES videos(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_viewers_last_view
ON video_viewers(last_view_at);

-------------------------------------------------------
-- Upload Logs
-------------------------------------------------------

CREATE TABLE upload_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    video_id TEXT,

    ip_hash TEXT,

    uploaded INTEGER
);