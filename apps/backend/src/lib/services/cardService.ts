import { randomUUID } from "crypto";
import {
    AuthorizationError,
    NotFoundError,
    ConflictError,
    ValidationError,
    REVEAL_DELAY_MS,
} from "@chance/core";
import type { Card, CardTransfer, CardVersion, DrawEvent, SubmitCardRequest } from "@chance/core";
import { db } from "../db/db";
import * as cardRepo from "../repos/cardRepo";
import * as drawEventRepo from "../repos/drawEventRepo";
import * as cardTransferRepo from "../repos/cardTransferRepo";
import * as cardVoteRepo from "../repos/cardVoteRepo";
import * as sessionRepo from "../repos/sessionRepo";
import * as playerRepo from "../repos/playerRepo";
import * as cardPicker from "../card-picker";

// ─── Card submission ──────────────────────────────────────────────────────────

export function submitCard(
    userId: string,
    sessionId: string | null,
    req: SubmitCardRequest
): Card {
    return cardRepo.create({
        authorUserId: userId,
        cardType: req.cardType,
        createdInSessionId: sessionId,
        title: req.title,
        description: req.description,
        hiddenDescription: req.hiddenDescription,
        imageUrl: req.imageUrl ?? null,
        drinkingLevel: req.drinkingLevel,
        spiceLevel: req.spiceLevel,
        isGameChanger: req.cardType === "reparations" ? false : req.isGameChanger,
        gameTags: req.gameTags,
    });
}

// ─── Card editing ─────────────────────────────────────────────────────────────

export function updateCard(
    userId: string,
    cardId: string,
    req: SubmitCardRequest,
    isAdmin: boolean
): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.authorUserId !== userId) {
        throw new AuthorizationError("You can only edit your own cards");
    }

    return cardRepo.createVersion(cardId, {
        authoredByUserId: userId,
        title: req.title,
        description: req.description,
        hiddenDescription: req.hiddenDescription,
        imageUrl: req.imageUrl ?? null,
        drinkingLevel: req.drinkingLevel,
        spiceLevel: req.spiceLevel,
        isGameChanger: card.cardType === "reparations" ? false : req.isGameChanger,
        gameTags: req.gameTags,
    });
}

export function deactivateCard(userId: string, cardId: string, isAdmin: boolean): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.authorUserId !== userId) {
        throw new AuthorizationError("You can only deactivate your own cards");
    }
    cardRepo.setActive(cardId, false);
    return cardRepo.findById(cardId)!;
}

export function reactivateCard(userId: string, cardId: string, isAdmin: boolean): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.authorUserId !== userId) {
        throw new AuthorizationError("You can only reactivate your own cards");
    }
    cardRepo.setActive(cardId, true);
    return cardRepo.findById(cardId)!;
}

// ─── Votes ────────────────────────────────────────────────────────────────────

export function voteCard(
    userId: string,
    cardId: string,
    direction: "up" | "down"
): void {
    if (!cardRepo.findById(cardId)) throw new NotFoundError("Card not found");
    cardVoteRepo.upsert(cardId, userId, direction);
}

export function clearVote(userId: string, cardId: string): void {
    cardVoteRepo.remove(cardId, userId);
}

// ─── Admin operations ─────────────────────────────────────────────────────────

export function promoteToGlobal(cardId: string): Card {
    if (!cardRepo.findById(cardId)) throw new NotFoundError("Card not found");
    cardRepo.setGlobal(cardId, true);
    return cardRepo.findById(cardId)!;
}

export function demoteFromGlobal(cardId: string): Card {
    if (!cardRepo.findById(cardId)) throw new NotFoundError("Card not found");
    cardRepo.setGlobal(cardId, false);
    return cardRepo.findById(cardId)!;
}

export function getVersions(cardId: string): CardVersion[] {
    if (!cardRepo.findById(cardId)) throw new NotFoundError("Card not found");
    return cardRepo.findVersionsByCardId(cardId);
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function drawFromPool(
    sessionId: string,
    playerId: string,
    cardType: "standard" | "reparations"
): DrawEvent {
    const session = sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundError("Session not found");
    if (session.status !== "active") throw new ConflictError("Session is not active");

    const player = playerRepo.findById(playerId);
    if (!player || player.session_id !== sessionId) {
        throw new NotFoundError("Player not found in this session");
    }

    const filterSettings = JSON.parse(session.filter_settings) as {
        maxDrinkingLevel: number;
        maxSpiceLevel: number;
        gameTags: string[];
    };

    const selected = cardPicker.pick(sessionId, filterSettings, cardType);
    if (!selected) {
        throw new ValidationError(
            cardType === "reparations"
                ? "No reparations cards available for this session's filters"
                : "No cards available for this session's filters"
        );
    }

    const now = new Date();
    const revealedAt = new Date(now.getTime() + REVEAL_DELAY_MS).toISOString();

    return drawEventRepo.create({
        id: randomUUID(),
        sessionId,
        playerId,
        cardVersionId: selected.cardVersionId,
        drawnAt: now.toISOString(),
        revealedToAllAt: revealedAt,
    });
}

export function drawCard(sessionId: string, playerId: string): DrawEvent {
    return drawFromPool(sessionId, playerId, "standard");
}

export function drawReparationsCard(sessionId: string, playerId: string): DrawEvent {
    return drawFromPool(sessionId, playerId, "reparations");
}

// ─── Draw event mutations ─────────────────────────────────────────────────────

export function shareDescription(drawEventId: string): DrawEvent {
    const event = drawEventRepo.findById(drawEventId);
    if (!event) throw new NotFoundError("Draw event not found");
    if (!event.cardVersion.hiddenDescription) {
        throw new ConflictError("Card description is not hidden");
    }
    return drawEventRepo.update(drawEventId, { descriptionShared: true });
}

export function resolveDrawEvent(drawEventId: string, resolved: boolean): DrawEvent {
    const event = drawEventRepo.findById(drawEventId);
    if (!event) throw new NotFoundError("Draw event not found");
    return drawEventRepo.update(drawEventId, { resolved });
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export function createTransfer(
    drawEventId: string,
    fromPlayerId: string,
    toPlayerId: string
): CardTransfer {
    const event = drawEventRepo.findById(drawEventId);
    if (!event) throw new NotFoundError("Draw event not found");
    if (event.playerId !== fromPlayerId) {
        throw new AuthorizationError("You can only transfer your own draw events");
    }

    const toPlayer = playerRepo.findById(toPlayerId);
    if (!toPlayer || toPlayer.session_id !== event.sessionId) {
        throw new NotFoundError("Target player not found in this session");
    }

    // Cancel any existing pending transfer for this draw event
    const existing = cardTransferRepo.findByDrawEventId(drawEventId);
    if (existing) cardTransferRepo.remove(existing.id);

    return cardTransferRepo.create({
        id: randomUUID(),
        drawEventId,
        fromPlayerId,
        toPlayerId,
    });
}

export function acceptTransfer(transferId: string, acceptingPlayerId: string): DrawEvent {
    const transfer = cardTransferRepo.findRawById(transferId);
    if (!transfer) throw new NotFoundError("Transfer not found");
    if (transfer.to_player_id !== acceptingPlayerId) {
        throw new AuthorizationError("You can only accept transfers sent to you");
    }

    const originalEvent = drawEventRepo.findById(transfer.draw_event_id);
    if (!originalEvent) throw new NotFoundError("Original draw event not found");

    const now = new Date().toISOString();

    // Create new draw event for the recipient; the original is implicitly superseded
    const newEvent = db.transaction(() => {
        const newDrawEvent = drawEventRepo.create({
            id: randomUUID(),
            sessionId: originalEvent.sessionId,
            playerId: acceptingPlayerId,
            cardVersionId: originalEvent.cardVersionId,
            drawnAt: now,
            revealedToAllAt: now, // already revealed — no delay on transfer
        });

        // Delete the draw event for the original holder and the transfer record
        db.prepare("DELETE FROM draw_events WHERE id = ?").run(originalEvent.id);
        cardTransferRepo.remove(transferId);

        return newDrawEvent;
    })();

    return newEvent;
}

export function cancelTransfer(transferId: string, requestingPlayerId: string): void {
    const transfer = cardTransferRepo.findRawById(transferId);
    if (!transfer) throw new NotFoundError("Transfer not found");

    const isOfferer = transfer.from_player_id === requestingPlayerId;
    const isRecipient = transfer.to_player_id === requestingPlayerId;
    if (!isOfferer && !isRecipient) {
        throw new AuthorizationError("You are not a party to this transfer");
    }

    cardTransferRepo.remove(transferId);
}
