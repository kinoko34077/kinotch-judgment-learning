CREATE TABLE IF NOT EXISTS oauth_pending (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  prompt TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  ai_reason TEXT NOT NULL,
  source_note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
  owner_id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  action TEXT NOT NULL CHECK(action IN ('GO','CORRECT','SKIP')),
  answer TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(owner_id, question_id)
);
CREATE TABLE IF NOT EXISTS response_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  action TEXT NOT NULL CHECK(action IN ('GO','CORRECT','SKIP','UNDO')),
  answer TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS responses_owner ON responses(owner_id,updated_at);
INSERT OR IGNORE INTO domains(id,name) VALUES
 ('uiux','UI/UX'),('software','ソフトウェア設計'),('music','音楽・創作');
-- Only illustrative seed cases, not externally validated expert knowledge.
INSERT OR IGNORE INTO questions(id,domain_id,prompt,choices_json,ai_answer,ai_reason,source_note) VALUES
 ('uiux-001','uiux','熟練者向け機能が多い編集画面を、初めて使う人にも分かりやすくするには？','["A: 初期画面からすべて表示","B: 高度な機能を削除","C: 基本操作を簡潔にし、高度な機能は必要に応じて提示"]','C','専門機能そのものと初期操作の複雑さを分離するため。','初期の説明用設問。実証済みの最適解ではない。'),
 ('software-001','software','二つの処理が現時点で似ているが、将来の変更理由が異なる場合、どう設計する？','["A: 常に共通化","B: 変更理由ごとに分離","C: 全処理をコピー"]','B','外観の類似性よりも変更理由が一致するかを重視するため。','初期の説明用設問。実証済みの最適解ではない。'),
 ('music-001','music','既存理論で説明しきれない新しい音楽表現を評価するとき、何を先に確認する？','["A: 従来ジャンルとの一致","B: 狙う表現目的と実際の知覚・効果","C: 人気の高い曲への類似性"]','B','表現目的に対して実際の結果が成立するかを検討するため。','初期の説明用設問。実証済みの最適解ではない。');