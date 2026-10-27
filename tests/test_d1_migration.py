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
# Exercise the actual SQL expiry predicate with a realistic indexed dataset.
db.executemany(
    "INSERT INTO oauth_pending(state_hash, verifier, expires_at) VALUES (?, ?, ?)",
    [(f"expiry-fixture-{n}", "fixture-verifier", n * 100) for n in range(2000)],
)
db.execute("ANALYZE")
plan = db.execute(
    "EXPLAIN QUERY PLAN DELETE FROM oauth_pending WHERE expires_at < ?", (150,)
).fetchall()
assert any("oauth_pending_expiry" in str(row[-1]) for row in plan), plan
db.execute("DELETE FROM oauth_pending WHERE expires_at < ?", (150,))
assert db.execute("SELECT COUNT(*) FROM oauth_pending").fetchone()[0] == 1998
assert db.execute("SELECT MIN(expires_at) FROM oauth_pending").fetchone()[0] == 200


# Additive 0003 must preserve legacy rows and events without rewriting them.
db.execute("""INSERT INTO responses(owner_id, question_id, action, answer, note, updated_at)
VALUES ('999', 'music-001', 'GO', '', '', 100)""")
db.execute("""INSERT INTO response_events(owner_id, question_id, action, answer, note, created_at)
VALUES ('999', 'music-001', 'GO', '', '', 100)""")
correction_sql = Path("migrations/0003_correction_kind.sql").read_text(encoding="utf-8")
db.executescript(correction_sql)
assert db.execute("SELECT correction_kind FROM responses WHERE owner_id='999'").fetchone() == ("",)
assert db.execute("SELECT correction_kind FROM response_events WHERE owner_id='999'").fetchone() == ("",)
db.execute("""INSERT INTO responses(owner_id, question_id, action, answer, note, updated_at, correction_kind)
VALUES ('999', 'software-001', 'CORRECT', '', 'precondition', 200, 'premise')""")
assert db.execute("SELECT correction_kind FROM responses WHERE question_id='software-001' AND owner_id='999'").fetchone() == ("premise",)
try:
    db.execute("""INSERT INTO responses(owner_id, question_id, action, answer, note, updated_at, correction_kind)
    VALUES ('999', 'uiux-001', 'CORRECT', '', 'bad', 200, 'INVALID')""")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Unrecognized correction type stored")

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
