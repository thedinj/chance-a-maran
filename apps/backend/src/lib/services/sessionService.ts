import { randomUUID } from "crypto";
import { ConflictError, NotFoundError } from "@chance/core";
import type {
    CreateSessionRequest,
    JoinByCodeRequest,
    Player,
    Session,
    SessionState,
    SessionSummary,
} from "@chance/core";
import { generateAccessToken, generateGuestToken } from "../auth/jwt";
import type { JwtPayload } from "../auth/types";
import * as playerRepo from "../repos/playerRepo";
import * as sessionRepo from "../repos/sessionRepo";
import * as userRepo from "../repos/userRepo";
import * as requirementElementRepo from "../repos/requirementElementRepo";
import { normalizeJoinCode } from "../utils/stringUtils";
import * as drawEventRepo from "../repos/drawEventRepo";
import * as cardTransferRepo from "../repos/cardTransferRepo";
import { filterDrawEvent } from "./cardService";
import { db } from "../db/db";

const WORDS = [
    // 3-letter
    "ACE","AMP","APE","BAD","BIG","BRO","FLY","HOT","ICY","ILL",
    "JAM","JET","LIT","MAD","MOB","NUT","ODD","PRO","RAD","RAW",
    "RIP","SIN","VIP","ZEN",
    // 4-letter
    "APEX","BEAR","BOLD","BOOM","BOSS","BUCK","BULL","CHAD","CLAW","CLUB",
    "COOL","CORE","CREW","CROW","DARE","DARK","DASH","DEEP","DRIP","DUNK",
    "DUSK","EDGE","EPIC","EVIL","FIRE","FLEX","FLOW","FREE","GALE","GLOW",
    "GOLD","GRIT","HARD","HAWK","HEAT","HELL","HYPE","ICON","IRON","JADE",
    "JAZZ","JOLT","KEEN","KICK","KING","LEAN","LION","LOCK","LOUD","LUST",
    "LYNX","MEGA","MIND","MINT","MODE","MOON","NEON","NOIR","NOVA","NUTS",
    "ONYX","PACE","PEAK","PLAY","PUMA","PUNK","PURE","PUSH","RACE","RAGE",
    "RAID","RAVE","REAL","RIOT","RISE","ROAR","ROCK","ROLL","RUDE","RULE",
    "RUSH","SAGE","SICK","SLAM","SLAP","SLAY","SOAR","SOLO","SOUL","STAG",
    "STAR","SWAG","SWAY","TANK","TIDE","TONE","TRUE","VIBE","VICE","VILE",
    "VOLT","WAVE","WILD","WOLF","WOKE","ZEAL",
    // 5-letter
    "ALPHA","BEAST","BRAVE","BRUTE","CHAOS","CHILL","COBRA","CRAFT","CROWN","CRUSH",
    "DELTA","DRIFT","EAGLE","ELITE","EMBER","FLAIR","FLAME","FLASH","FLINT","FORGE",
    "FRESH","FROST","GHOST","GLIDE","GRACE","GRIND","HYPER","LASER","LUNAR","MIGHT",
    "NIGHT","NOBLE","NORTH","OMEGA","ORBIT","POLAR","POWER","PRIME","PROWL","PULSE",
    "QUICK","RAVEN","RECON","RIVAL","ROGUE","ROUGH","ROYAL","SCOUT","SHADY","SHARP",
    "SIGMA","SLEEK","SLICK","SMASH","SOLID","SONIC","SPARK","SPEED","SPICY","SQUAD",
    "STARK","STEAM","STEEL","STOMP","STORM","STUNT","STYLE","SURGE","SWEEP","SWIFT",
    "THICK","TIGER","TITAN","TORCH","TURBO","ULTRA","VALOR","VAULT","VENOM","VIGOR",
    "VIXEN","YOUTH",
] as const;

const NUMBERS = [
    "007","13","21","42","67","69","86","99","100","101",
    "187","314","360","420","555","666","777","1337","8008",
] as const;

// Fallback: random alphanumeric (excludes confusable chars 0/O/1/I)
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_FALLBACK_LENGTH = 7;

function generateJoinCode(): string {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    const num  = NUMBERS[Math.floor(Math.random() * NUMBERS.length)]!;
    return word + num;
}

function generateFallbackCode(): string {
    let code = "";
    for (let i = 0; i < JOIN_CODE_FALLBACK_LENGTH; i++) {
        code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
    }
    return code;
}

function uniqueJoinCode(): string {
    for (let i = 0; i < 7; i++) {
        const code = generateJoinCode();
        if (!sessionRepo.findByJoinCode(normalizeJoinCode(code))) return code;
    }
    // Fall back to random alphanumeric if clashes persist
    for (let i = 0; i < 10; i++) {
        const code = generateFallbackCode();
        if (!sessionRepo.findByJoinCode(normalizeJoinCode(code))) return code;
    }
    throw new Error("Failed to generate unique join code after 17 attempts");
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

    // Resolve available elements: client selection → user's last selection → global defaults
    if (!req.filterSettings.availableElementIds) {
        const lastSelection = userRepo.getLastElementSelection(userId);
        req.filterSettings.availableElementIds =
            lastSelection ?? requirementElementRepo.listDefaultAvailableIds();
    }

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
            cardSharing: "mine",
        });

        sessionRepo.setHostPlayer(sessionId, playerId);

        // Save the host's element selection for next time
        userRepo.update(userId, {
            lastElementSelection: req.filterSettings.availableElementIds ?? null,
        });
    })();

    return sessionRepo.mapSession(sessionRepo.findById(sessionId)!);
}

export function joinByCode(
    auth: JwtPayload | null,
    req: JoinByCodeRequest
): { session: Session; player: Player; accessToken: string; playerToken: string | null } {
    const session = sessionRepo.findByJoinCode(normalizeJoinCode(req.joinCode));
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
                cardSharing: req.cardSharing ?? "mine",
            });
        } else if (player.active === 0) {
            player = playerRepo.update(player.id, { active: true });
        }

        const userRow = db
            .prepare("SELECT email, is_admin FROM users WHERE id = ?")
            .get(auth.sub) as { email: string; is_admin: number };

        const accessToken = generateAccessToken({
            userId: auth.sub,
            email: userRow.email,
            scopes: userRow.is_admin ? ["admin"] : [],
        });

        return { session: sessionRepo.mapSession(session), player: playerRepo.mapPlayer(player), accessToken, playerToken: null };
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
                if (existing.active === 0) {
                    playerRepo.update(existing.id, { active: true });
                }
                const accessToken = generateGuestToken({
                    playerId: existing.id,
                    sessionId: session.id,
                    playerToken: existing.player_token,
                });
                return {
                    session: sessionRepo.mapSession(session),
                    player: playerRepo.mapPlayer(playerRepo.findById(existing.id)!),
                    accessToken,
                    playerToken: existing.player_token,
                };
            }

            throw new ConflictError(
                "This name is already taken. Ask the host to free it up if you need to rejoin."
            );
        } else {
            // Token was reset by host or player pre-dates the token system — issue a fresh token and claim the slot
            const newToken = randomUUID();
            playerRepo.update(existing.id, { playerToken: newToken, active: true });
            const accessToken = generateGuestToken({
                playerId: existing.id,
                sessionId: session.id,
                playerToken: newToken,
            });
            return {
                session: sessionRepo.mapSession(session),
                player: playerRepo.mapPlayer(playerRepo.findById(existing.id)!),
                accessToken,
                playerToken: newToken,
            };
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

    return { session: sessionRepo.mapSession(session), player: playerRepo.mapPlayer(player), accessToken, playerToken };
}

export function getSessionHistory(userId: string): SessionSummary[] {
    return sessionRepo.findHistoryByUserId(userId).map((row) => ({
        ...sessionRepo.mapSession(row),
        playerCount: row.player_count,
        drawCount: row.draw_count,
    }));
}

export function getActiveSessions(userId: string): SessionSummary[] {
    return sessionRepo.findActiveByUserId(userId).map((row) => ({
        ...sessionRepo.mapSession(row),
        playerCount: row.player_count,
        drawCount: row.draw_count,
    }));
}

export function getSessionState(sessionId: string, requestingPlayerId: string | null): SessionState {
    const session = sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundError("Session not found");

    const players: Player[] = playerRepo
        .findBySessionId(sessionId)
        .map((p) => playerRepo.mapPlayer(p));

    const drawEvents = drawEventRepo
        .findRevealedBySessionId(sessionId, requestingPlayerId)
        .map((e) => filterDrawEvent(e, requestingPlayerId));
    const pendingTransfers = cardTransferRepo.findBySessionId(sessionId);

    return {
        session: sessionRepo.mapSession(session),
        players,
        drawEvents,
        pendingTransfers,
        serverTimestamp: new Date().toISOString(),
    };
}
