/**
 * JWT payload for both registered users and ephemeral guest players.
 * `@chance/core` does not export this type — it lives only in the backend.
 */
export interface JwtPayload {
    sub: string;           // userId for registered users; playerId for guests
    type: "user" | "guest";
    email?: string;        // registered users only
    sessionId?: string;    // guests only — used as a session scope guard
    playerToken?: string;  // guests only — compared against session_players.player_token on every request
    scopes: string[];
    iss: string;
    aud: string;
    iat?: number;
    exp?: number;
}
