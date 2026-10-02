-- Aggregate counters only. There is deliberately no per-submission table.
CREATE TABLE IF NOT EXISTS totals (
  tool  INTEGER NOT NULL,
  month TEXT    NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tool, month)
);
CREATE TABLE IF NOT EXISTS cells (
  tool   INTEGER NOT NULL,
  dim    TEXT    NOT NULL,
  bucket INTEGER NOT NULL,
  month  TEXT    NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tool, dim, bucket, month)
);
