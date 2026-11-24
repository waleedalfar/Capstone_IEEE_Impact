-- D-55: a target career the student types when theirs isn't in data/catalog.json ("Other"). Their own profile skills
-- are then tracked (docs/MODULE_OWNER_DECISIONS.md). target_career_id stays null for them.
alter table profile.profiles
  add column target_career_other text
    check (target_career_other is null or char_length(target_career_other) between 1 and 60);
