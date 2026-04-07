/**
 * Text column length limits
 *
 * These constants define maximum character lengths for text fields across the application.
 * Used in both Zod schema validation (application layer) and SQLite CHECK constraints (database layer).
 *
 * Note: These are CHARACTER counts, not byte lengths, to properly handle Unicode/emoji.
 * Both Zod's .max() and SQLite's length() count characters, not bytes.
 */

// User-facing content limits
export const MAX_DISPLAY_NAME_LENGTH = 30; // Player/user display names
export const MAX_SESSION_NAME_LENGTH = 60; // Game session names
export const MAX_JOIN_CODE_LENGTH = 8; // Session join codes
export const MIN_PASSWORD_LENGTH = 8; // Minimum password length

// Card content limits
export const MAX_CARD_TITLE_LENGTH = 80;
export const MAX_CARD_DESCRIPTION_LENGTH = 500;

// System field limits
export const MAX_TOKEN_LENGTH = 255; // Refresh tokens, invitation tokens
export const MAX_PASSWORD_HASH_LENGTH = 255; // Bcrypt hashes (~60 chars, buffer for future algorithms)
export const MAX_SCOPES_LENGTH = 500; // JSON array of scope strings
export const MAX_SETTING_KEY_LENGTH = 100; // AppSetting keys
export const MAX_SETTING_VALUE_LENGTH = 1000; // AppSetting values (JSON config)
