-- Migration 057: Add attachment_url and voice_note_duration_s to messages table
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN ... IF NOT EXISTS

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url         varchar(512),
  ADD COLUMN IF NOT EXISTS voice_note_duration_s  integer;
