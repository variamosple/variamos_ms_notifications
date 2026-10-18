-- Structure of the notifications tables in production, read on 2026-10-18
-- (pg_dump --schema-only, no data). The schema name is replaced by the tests.
CREATE TABLE variamos.notification_templates (
    key character varying(100) NOT NULL,
    title_template text NOT NULL,
    body_template text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE variamos.notifications (
    id uuid NOT NULL,
    recipient_id character varying(100) NOT NULL,
    actor_id character varying(100),
    template_key character varying(100) NOT NULL,
    variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);
CREATE TABLE variamos.user_preferences (
    user_id character varying(100) NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    muted_event_types text[] DEFAULT '{}'::text[] NOT NULL
);
ALTER TABLE ONLY variamos.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (key);
ALTER TABLE ONLY variamos.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY variamos.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);
CREATE INDEX idx_notifications_deleted_at ON variamos.notifications USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX idx_notifications_is_read ON variamos.notifications USING btree (is_read) WHERE (is_read = false);
CREATE INDEX idx_notifications_recipient ON variamos.notifications USING btree (recipient_id);
CREATE INDEX idx_notifications_template_key ON variamos.notifications USING btree (template_key);
