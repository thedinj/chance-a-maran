import { randomUUID } from "crypto";
import { ConflictError, NotFoundError } from "@chance/core";
import type {
    CreateSessionRequest,
    JoinByCodeRequest,
    Player,
    Session,
    SessionState,
} from "@chance/core";
import { generateAccessToken, generateGuestToken } from "../auth/jwt";
import type { JwtPayload } from "../auth/types";
import * as playerRepo from "../repos/playerRepo";
import * as sessionRepo from "../repos/sessionRepo";
import * as drawEventRepo from "../repos/drawEventRepo";
import * as cardTransferRepo from "../repos/cardTransferRepo";
import { db } from "../db/db";

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes confusable chars (0/O/1/I)
const JOIN_CODE_LENGTH = 6;

function generateJoinCode(): string {
    let code = "";
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
        code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
    }
    return code;
}

function uniqueJoinCode(): string {
    for (let i = 0; i < 10; i++) {
        const code = generateJoinCode();
        if (!sessionRepo.findByJoinCode(code)) return code;
    }
    throw new Error("Failed to generate unique join code after 10 attempts");
}

function getUserDisplayName(userId: string): string {
    const row = db
        .prepare("SELECT display_name FROM users WHERE id = ?")
        .get(userId) as { display_name: string } | undefined;
    return row?.display_name ?? "";
}

export function createSession(userId: string, req: CreateSessionRequest): Session {
    const hostDisplayName = getUserDisplayName(userId);
    const sessionId = randomUUID();
    const playerId = randomUUID();
    const joinCode = uniqueJoinCode();
    const qrToken = randomUUID();

    db.transaction(() => {
        sessionRepo.create({
            id: sessionId,
            name: req.name,
            joinCode,
            qrToken,
            filterSettings: req.filterSettings,
        });

        playerRepo.create({
            id: playerId,
            sessionId,
            userId,
            displayName: hostDisplayName,
            cardSharing: "network",
        });

        sessionRepo.setHostPlayer(sessionId, playerId);
    })();

    return sessionRepo.mapSession(sessionRepo.findById(sessionId)!);
}

export function joinByCode(
    auth: JwtPayload | null,
    req: JoinByCodeRequest
): { session: Session; player: playerRepo.DbPlayer; accessToken: string; playerToken: string | null } {
    const session = sessionRepo.findByJoinCode(req.joinCode.toUpperCase());
    if (!session) throw new NotFoundError("Session not found for that join code");
    if (session.status !== "active") throw new ConflictError("Session is no longer active");

    // ── Registered user join ──────────────────────────────────────────────
    if (auth?.type === "user") {
        let player = playerRepo.findBySessionAndUserId(session.id, auth.sub);

        if (!player) {
            const displayName = req.displayName || getUserDisplayName(auth.sub);

            // Guard: display name must not be held by a guest
            const nameTaken = playerRepo.findBySessionAndDisplayName(session.id, displayName);
            if (nameTaken && nameTaken.user_id === null) {
                throw new ConflictError(
                    "This display name is taken by a guest. Choose a different name or ask the host to free it up."
                );
            }

            player = playerRepo.create({
                id: randomUUID(),
                sessionId: session.id,
                userId: auth.sub,
                displayName,
                cardSharing: req.cardSharing ?? "network",
            });
        }

        const userRow = db
            .prepare("SELECT email, is_admin FROM users WHERE id = ?")
            .get(auth.sub) as { email: string; is_admin: number };

        const accessToken = generateAccessToken({
            userId: auth.sub,
            email: userRow.email,
            scopes: userRow.is_admin ? ["admin"] : [],
        });

        return { session: sessionRepo.mapSession(session), player, accessToken, playerToken: null };
    }

    // ── Guest join / rejoin ───────────────────────────────────────────────
    const existing = playerRepo.findBySessionAndDisplayName(session.id, req.displayName);

    if (existing) {
        if (existing.user_id !== null) {
            throw new ConflictError(
                "This name is taken by a registered player. Please choose a different display name."
            );
        }

        if (existing.player_token !== null) {
            // Name is owned by a guest — check for valid rejoin token
            if (req.playerToken && req.playerToken === existing.player_token) {
                const accessToken = generateGuestToken({
                    playerId: existing.id,
                    sessionId: session.id,
                    playerToken: existing.player_token,
                });
                return {
                    session: sessionRepo.mapSession(session),
                    player: existing,
                    accessToken,
                    playerToken: existing.player_token,
                };
            }

            throw new ConflictError(
                "This name is already taken. Ask the host to free it up if you need to rejoin."
            );
        }
    }

    // Brand-new guest
    const playerToken = randomUUID();
    const player = playerRepo.create({
        id: randomUUID(),
        sessionId: session.id,
        displayName: req.displayName,
        playerToken,
    });

    const accessToken = generateGuestToken({
        playerId: player.id,
        sessionId: session.id,
        playerToken,
    });

    return { session: sessionRepo.mapSession(session), player, accessToken, playerToken };
}

export function getSessionState(sessionId: string): SessionState {
    const session = sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundError("Session not found");

    const players: Player[] = playerRepo
        .findBySessionId(sessionId)
        .map((p) => playerRepo.mapPlayer(p));

    const drawEvents = drawEventRepo.findBySessionId(sessionId);
    const pendingTransfers = cardTransferRepo.findBySessionId(sessionId);

    return {
        session: sessionRepo.mapSession(session),
        players,
        drawEvents,
        pendingTransfers,
        serverTimestamp: new Date().toISOString(),
    };
}
