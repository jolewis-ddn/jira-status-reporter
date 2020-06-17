CREATE TABLE IF NOT EXISTS "jira-stats" (
        "status"        TEXT NOT NULL,
        "year"  INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "day"   INTEGER NOT NULL,
        "count" INTEGER NOT NULL,
        PRIMARY KEY("status","year","month","day","count")
);
