"""Offline smoke tests for the Phase 1 D1 migration; never opens production D1."""
from pathlib import Path
import sqlite3

sql = Path("migrations/0001_init.sql").read_text(encoding="utf-8")
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(sql)
expected_tables = {"oauth_pending", "auth_sessions", "domains", "questions", "responses", "response_events"}
actual = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert expected_tables <= actual, expected_tables - actual
assert db.execute("SELECT COUNT(*) FROM domains").fetchone()[0] == 3
assert db.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == 3
# Existing seed remains idempotent when the SQL is reapplied.
db.executescript(sql)
assert db.execute("SELECT COUNT(*) FROM domains").fetchone()[0] == 3
assert db.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == 3
# Apply and re-apply the additive expiry index without touching app data.
expiry_sql = Path("migrations/0002_oauth_pending_expiry.sql").read_text(encoding="utf-8")
db.executescript(expiry_sql)
db.executescript(expiry_sql)
assert db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='oauth_pending_expiry'").fetchone() == ("oauth_pending_expiry",)

# Owner responses are keyed to a distinct GitHub numeric identity.
db.execute("""INSERT INTO responses(owner_id, question_id, action, answer, note, updated_at)
VALUES ('111', 'uiux-001', 'GO', '', '', 100)""")
db.execute("""INSERT INTO responses(owner_id, question_id, action, answer, note, updated_at)
VALUES ('222', 'uiux-001', 'SKIP', '', '', 100)""")
assert db.execute("SELECT COUNT(*) FROM responses WHERE question_id='uiux-001'").fetchone()[0] == 2
# FK integrity must reject nonexistent questions.
try:
    db.execute("""INSERT INTO responses(owner_id, question_id, action, updated_at)
    VALUES ('111', 'missing', 'GO', 100)""")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Invalid foreign key accepted")
print("Phase 1 D1 migration: schema, seeds, idempotence, owner separation and FK OK")
