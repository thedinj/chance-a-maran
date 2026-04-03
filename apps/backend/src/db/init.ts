import { db } from "../lib/db/db";

export function initializeDatabase() {
    db.exec(`
        PRAGMA foreign_keys = ON;

        -- Invitation codes (must exist before users due to FK)
        CREATE TABLE IF NOT EXISTS invitation_codes (
            id          TEXT NOT NULL PRIMARY KEY,
            code        TEXT NOT NULL UNIQUE,
            created_by_user_id TEXT REFERENCES users(id),
            used_by_user_id    TEXT REFERENCES users(id),
            expires_at  DATETIME,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id                 TEXT NOT NULL PRIMARY KEY,
            email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
            display_name       TEXT NOT NULL,
            password_hash      TEXT NOT NULL,
            is_admin           INTEGER NOT NULL DEFAULT 0,
            invitation_code_id TEXT REFERENCES invitation_codes(id),
            created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id              TEXT NOT NULL PRIMARY KEY,
            host_player_id  TEXT,
            name            TEXT NOT NULL,
            join_code       TEXT NOT NULL UNIQUE,
            qr_token        TEXT NOT NULL,
            filter_settings TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active', 'ended', 'expired')),
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at      DATETIME
        );

        CREATE TABLE IF NOT EXISTS session_players (
            id           TEXT NOT NULL PRIMARY KEY,
            session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            user_id      TEXT REFERENCES users(id),
            display_name TEXT NOT NULL,
            player_token TEXT,
            card_sharing TEXT NOT NULL DEFAULT 'network'
                CHECK(card_sharing IN ('none', 'mine', 'network')),
            active       INTEGER NOT NULL DEFAULT 1,
            joined_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id         TEXT NOT NULL PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            revoked    INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key        TEXT NOT NULL PRIMARY KEY,
            value      TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email);
        CREATE INDEX IF NOT EXISTS idx_session_players_session_id
            ON session_players(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_players_user_id
            ON session_players(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
            ON refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_invitation_codes_code
            ON invitation_codes(code);
    `);

    console.log("Database initialized successfully");
}
