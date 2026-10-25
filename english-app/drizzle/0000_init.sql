CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`kind` text NOT NULL,
	`seconds` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_user_date` ON `activity_logs` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`mode` text NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`settings_json` text NOT NULL,
	`transcript_json` text DEFAULT '[]' NOT NULL,
	`report_json` text,
	`status` text DEFAULT 'active' NOT NULL,
	`practice_of` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`user_speaking_sec` real DEFAULT 0 NOT NULL,
	`ai_speaking_sec` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversations_user_started` ON `conversations` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `grammar_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`format` text NOT NULL,
	`question_json` text NOT NULL,
	`user_answer` text NOT NULL,
	`score` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`feedback_json` text NOT NULL,
	`seconds_spent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `grammar_user_created` ON `grammar_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`category` text,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`ease` real DEFAULT 2.5 NOT NULL,
	`interval_days` real DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`due_at` integer NOT NULL,
	`last_reviewed_at` integer,
	`created_at` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_user_due` ON `review_items` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text DEFAULT 'local' NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_key` ON `settings` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `writing_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`kind` text NOT NULL,
	`level` text NOT NULL,
	`input` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `writing_user_created` ON `writing_entries` (`user_id`,`created_at`);