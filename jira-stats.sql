CREATE TABLE IF NOT EXISTS "jira-stats" (
        "status"        TEXT NOT NULL,
        "year"  INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "day"   INTEGER NOT NULL,
        "count" INTEGER NOT NULL,
        PRIMARY KEY("status","year","month","day","count")
);

CREATE TABLE IF NOT EXISTS "story-stats" (
        "key"   TEXT NOT NULL,
        "date"  TEXT NOT NULL,
        "status"        TEXT NOT NULL,
        "fixVersion"    TEXT NOT NULL DEFAULT 'NONE',
        "component"     TEXT,
        "progress"      INTEGER NOT NULL DEFAULT 0,
        "total" INTEGER NOT NULL DEFAULT 0
);