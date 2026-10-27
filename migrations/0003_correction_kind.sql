-- Additive correction semantics. Existing answers/events remain valid;
-- non-correction actions use '' and old corrections can use 'unspecified'.
ALTER TABLE responses
  ADD COLUMN correction_kind TEXT NOT NULL DEFAULT ''
  CHECK(correction_kind IN ('', 'alternative', 'partial', 'premise', 'exception', 'supplement', 'unspecified'));
ALTER TABLE response_events
  ADD COLUMN correction_kind TEXT NOT NULL DEFAULT ''
  CHECK(correction_kind IN ('', 'alternative', 'partial', 'premise', 'exception', 'supplement', 'unspecified'));
