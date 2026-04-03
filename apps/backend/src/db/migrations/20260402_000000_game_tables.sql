-- ─── Game tables ──────────────────────────────────────────────────────────────
-- drinkingLevel: 0=none 1=light(🍺) 2=moderate(🍺🍺) 3=heavy(🍺🍺🍺)
-- spiceLevel:    0=G    1=PG        2=PG-13           3=R
-- card_type:     'standard' drawn normally | 'reparations' drawn as penalty

CREATE TABLE IF NOT EXISTS games (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,          -- display name, e.g. "Catan"
    slug       TEXT UNIQUE NOT NULL,   -- lowercase url-safe, e.g. "catan"
    active     INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cards (
    id                    TEXT PRIMARY KEY,
    author_user_id        TEXT NOT NULL REFERENCES users(id),
    card_type             TEXT NOT NULL DEFAULT 'standard'
                              CHECK(card_type IN ('standard','reparations')),
    active                INTEGER NOT NULL DEFAULT 1,
    is_global             INTEGER NOT NULL DEFAULT 0,
    created_in_session_id TEXT REFERENCES sessions(id),
    current_version_id    TEXT,   -- NULL until first version is inserted; then FK to card_versions
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS card_versions (
    id                   TEXT PRIMARY KEY,
    card_id              TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    version_number       INTEGER NOT NULL,
    title                TEXT NOT NULL,
    description          TEXT NOT NULL,
    hidden_description   INTEGER NOT NULL DEFAULT 0,
    image_url            TEXT,
    drinking_level       INTEGER NOT NULL DEFAULT 0 CHECK(drinking_level BETWEEN 0 AND 3),
    spice_level          INTEGER NOT NULL DEFAULT 0 CHECK(spice_level BETWEEN 0 AND 3),
    is_game_changer      INTEGER NOT NULL DEFAULT 0,
    authored_by_user_id  TEXT NOT NULL REFERENCES users(id),
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, version_number)
);

-- Zero rows = universal card (eligible for all sessions).
-- One or more rows = eligible only for sessions filtered to one of those games.
CREATE TABLE IF NOT EXISTS card_game_tags (
    card_version_id TEXT NOT NULL REFERENCES card_versions(id) ON DELETE CASCADE,
    game_id         TEXT NOT NULL REFERENCES games(id),
    PRIMARY KEY (card_version_id, game_id)
);

CREATE TABLE IF NOT EXISTS draw_events (
    id                 TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_id          TEXT NOT NULL REFERENCES session_players(id),
    card_version_id    TEXT NOT NULL REFERENCES card_versions(id),
    drawn_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revealed_to_all_at DATETIME,
    description_shared INTEGER NOT NULL DEFAULT 0,
    resolved           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS card_votes (
    id         TEXT PRIMARY KEY,
    card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction  TEXT NOT NULL CHECK(direction IN ('up','down')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(card_id, user_id)
);

-- No status column: a row = pending transfer. Deletion = completed/retracted/declined.
CREATE TABLE IF NOT EXISTS card_transfers (
    id             TEXT PRIMARY KEY,
    draw_event_id  TEXT NOT NULL REFERENCES draw_events(id) ON DELETE CASCADE,
    from_player_id TEXT NOT NULL REFERENCES session_players(id),
    to_player_id   TEXT NOT NULL REFERENCES session_players(id),
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_games_slug             ON games(slug);
CREATE INDEX IF NOT EXISTS idx_cards_author_user_id   ON cards(author_user_id);
CREATE INDEX IF NOT EXISTS idx_cards_card_type        ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_card_versions_card_id  ON card_versions(card_id);
CREATE INDEX IF NOT EXISTS idx_draw_events_session_id ON draw_events(session_id);
CREATE INDEX IF NOT EXISTS idx_draw_events_player_id  ON draw_events(player_id);
CREATE INDEX IF NOT EXISTS idx_card_votes_card_id     ON card_votes(card_id);
