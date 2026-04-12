import { db } from "../lib/db/db";
import { cleanupStaleTempFiles } from "../lib/media/tempMedia";

export function initializeDatabase() {
    db.exec(`
        PRAGMA foreign_keys = ON;

        -- Invitation codes (must exist before users due to FK)
        CREATE TABLE IF NOT EXISTS invitation_codes (
            id                 TEXT NOT NULL PRIMARY KEY,
            code               TEXT NOT NULL UNIQUE,
            created_by_user_id TEXT REFERENCES users(id),
            expires_at         DATETIME,
            is_active          INTEGER NOT NULL DEFAULT 1,
            max_uses           INTEGER,
            created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id                 TEXT NOT NULL PRIMARY KEY,
            email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
            display_name       TEXT NOT NULL,
            password_hash      TEXT NOT NULL,
            is_admin               INTEGER NOT NULL DEFAULT 0,
            invitation_code_id     TEXT REFERENCES invitation_codes(id),
            last_element_selection TEXT,
            created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
            ended_at        DATETIME
        );

        CREATE TABLE IF NOT EXISTS session_players (
            id           TEXT NOT NULL PRIMARY KEY,
            session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            user_id      TEXT REFERENCES users(id),
            display_name TEXT NOT NULL,
            player_token TEXT,
            card_sharing TEXT NOT NULL DEFAULT 'mine'
                CHECK(card_sharing IN ('none', 'mine')),
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

        CREATE TABLE IF NOT EXISTS media (
            id                  TEXT NOT NULL PRIMARY KEY,
            mime_type           TEXT NOT NULL,
            size                INTEGER NOT NULL,
            uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
            y_offset            REAL NOT NULL DEFAULT 0.5,
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

        -- Games (named game modes / expansions)
        CREATE TABLE IF NOT EXISTS games (
            id         TEXT NOT NULL PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            active     INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Cards and versioned content
        CREATE TABLE IF NOT EXISTS cards (
            id                    TEXT NOT NULL PRIMARY KEY,
            author_user_id        TEXT NOT NULL REFERENCES users(id),
            owner_user_id         TEXT NOT NULL REFERENCES users(id),
            card_type             TEXT NOT NULL DEFAULT 'standard'
                CHECK(card_type IN ('standard', 'reparations')),
            active                INTEGER NOT NULL DEFAULT 1,
            is_global             INTEGER NOT NULL DEFAULT 0,
            pending_global        INTEGER NOT NULL DEFAULT 0,
            created_in_session_id TEXT REFERENCES sessions(id),
            current_version_id    TEXT NOT NULL,
            net_votes             INTEGER NOT NULL DEFAULT 0,
            created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS card_versions (
            id                   TEXT NOT NULL PRIMARY KEY,
            card_id              TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            version_number       INTEGER NOT NULL,
            title                TEXT NOT NULL,
            description          TEXT NOT NULL,
            hidden_instructions  TEXT,
            image_id             TEXT REFERENCES media(id),
            sound_id             TEXT REFERENCES media(id),
            drinking_level       INTEGER NOT NULL DEFAULT 1,
            spice_level          INTEGER NOT NULL DEFAULT 1,
            is_game_changer      INTEGER NOT NULL DEFAULT 0,
            authored_by_user_id  TEXT NOT NULL REFERENCES users(id),
            created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Groupings for requirement elements (system groups are locked; future admin groups are not)
        CREATE TABLE IF NOT EXISTS requirement_element_groups (
            id         TEXT    NOT NULL PRIMARY KEY,
            name       TEXT    NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            locked     INTEGER NOT NULL DEFAULT 0
        );

        -- Physical/game prop requirements for card versions
        CREATE TABLE IF NOT EXISTS requirement_elements (
            id                TEXT NOT NULL PRIMARY KEY,
            title             TEXT NOT NULL,
            active            INTEGER NOT NULL DEFAULT 1,
            default_available INTEGER NOT NULL DEFAULT 0,
            group_id          TEXT REFERENCES requirement_element_groups(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS card_version_requirements (
            card_version_id TEXT NOT NULL REFERENCES card_versions(id) ON DELETE CASCADE,
            element_id      TEXT NOT NULL REFERENCES requirement_elements(id),
            PRIMARY KEY (card_version_id, element_id)
        );

        -- Tags linking card versions to game modes
        CREATE TABLE IF NOT EXISTS card_game_tags (
            card_version_id TEXT NOT NULL REFERENCES card_versions(id) ON DELETE CASCADE,
            game_id         TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            PRIMARY KEY (card_version_id, game_id)
        );

        -- Per-card votes by registered users
        CREATE TABLE IF NOT EXISTS card_votes (
            id         TEXT NOT NULL PRIMARY KEY,
            card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            direction  TEXT NOT NULL CHECK(direction IN ('up', 'down')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(card_id, user_id)
        );

        -- Draw events (one row per card drawn in a session)
        CREATE TABLE IF NOT EXISTS draw_events (
            id                  TEXT NOT NULL PRIMARY KEY,
            session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            player_id           TEXT NOT NULL REFERENCES session_players(id),
            card_id             TEXT NOT NULL REFERENCES cards(id),
            card_version_id     TEXT NOT NULL REFERENCES card_versions(id),
            drawn_at            DATETIME NOT NULL,
            revealed_to_all_at  DATETIME,
            description_shared  INTEGER NOT NULL DEFAULT 0,
            resolved            INTEGER NOT NULL DEFAULT 0
        );

        -- Card transfers between players within a session
        CREATE TABLE IF NOT EXISTS card_transfers (
            id             TEXT NOT NULL PRIMARY KEY,
            draw_event_id  TEXT NOT NULL REFERENCES draw_events(id) ON DELETE CASCADE,
            from_player_id TEXT NOT NULL REFERENCES session_players(id),
            to_player_id   TEXT NOT NULL REFERENCES session_players(id),
            created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Idempotency cache for POST/PATCH/DELETE endpoints
        CREATE TABLE IF NOT EXISTS idempotency_cache (
            key           TEXT NOT NULL PRIMARY KEY,
            response_body TEXT NOT NULL,
            status_code   INTEGER NOT NULL,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at    DATETIME NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cards_author_user_id
            ON cards(author_user_id);
        CREATE INDEX IF NOT EXISTS idx_cards_owner_user_id
            ON cards(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_card_versions_card_id
            ON card_versions(card_id);
        CREATE INDEX IF NOT EXISTS idx_draw_events_session_id
            ON draw_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_card_votes_card_id
            ON card_votes(card_id);
        CREATE INDEX IF NOT EXISTS idx_idempotency_cache_expires_at
            ON idempotency_cache(expires_at);
    `);

    console.log("Database initialized successfully");

    // Clean up abandoned temp media uploads from any prior run.
    cleanupStaleTempFiles();
}
