import { randomUUID } from "crypto";
import {
    AuthorizationError,
    NotFoundError,
    ConflictError,
    ValidationError,
    REVEAL_DELAY_MS,
    applyContentFloors,
} from "@chance/core";
import type { Card, CardTransfer, CardVersion, DrawEvent, SubmitCardRequest } from "@chance/core";
import { db } from "../db/db";
import * as cardRepo from "../repos/cardRepo";
import * as mediaRepo from "../repos/mediaRepo";
import { findTempFile } from "../media/tempMedia";
import * as requirementElementRepo from "../repos/requirementElementRepo";
import * as drawEventRepo from "../repos/drawEventRepo";
import * as cardTransferRepo from "../repos/cardTransferRepo";
import * as cardVoteRepo from "../repos/cardVoteRepo";
import * as sessionRepo from "../repos/sessionRepo";
import * as playerRepo from "../repos/playerRepo";
import * as cardPicker from "../card-picker";
import * as userRepo from "../repos/userRepo";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip hiddenInstructions from a DrawEvent for clients that aren't the drawer.
 * The drawer always receives the text. Everyone receives it once descriptionShared=true.
 */
export function filterDrawEvent(event: DrawEvent, requestingPlayerId: string | null): DrawEvent {
    if (event.descriptionShared) return event;
    if (requestingPlayerId && event.playerId === requestingPlayerId) return event;
    return {
        ...event,
        cardVersion: { ...event.cardVersion, hiddenInstructions: null },
    };
}

/**
 * Validate that a soundId refers to a legitimate audio file — either an already-promoted
 * media record (audio/mpeg, correct ownership) or a temp file awaiting promotion (.mp3).
 * No-op when soundId is null/undefined.
 */
function validateSoundId(
    soundId: string | null | undefined,
    requestingUserId: string,
    isAdmin: boolean
): void {
    if (!soundId) return;

    // Check permanent DB record first.
    const mimeType = mediaRepo.findMimeById(soundId);
    if (mimeType !== null) {
        if (mimeType !== "audio/mpeg") {
            throw new ValidationError("Sound media must be an MP3 file.");
        }
        if (!isAdmin) {
            const meta = mediaRepo.findMetaById(soundId);
            if (!meta || meta.uploaded_by_user_id !== requestingUserId) {
                throw new AuthorizationError("You can only use your own uploaded sounds.");
            }
        }
        return;
    }

    // Check temp file.
    const tmp = findTempFile(soundId);
    if (!tmp) {
        throw new ValidationError("Sound media not found.");
    }
    if (tmp.mimeType !== "audio/mpeg") {
        throw new ValidationError("Sound media must be an MP3 file.");
    }
    // Temp file ownership is implied: only the submitter's request reaches this point.
}

function validateRequirementIds(ids: string[]): void {
    if (ids.length === 0) return;
    const found = requirementElementRepo.findByIds(ids);
    if (found.length !== ids.length) {
        throw new ValidationError("One or more requirement IDs are invalid or inactive");
    }
}

// ─── Card submission ──────────────────────────────────────────────────────────

export function submitCard(userId: string, sessionId: string | null, req: SubmitCardRequest): Card {
    validateRequirementIds(req.requirementIds);
    validateSoundId(req.soundId, userId, false);
    const levels = applyContentFloors(
        { title: req.title, description: req.description, hiddenInstructions: req.hiddenInstructions },
        { drinkingLevel: req.drinkingLevel, spiceLevel: req.spiceLevel },
    );
    const card = cardRepo.create({
        authorUserId: userId,
        cardType: req.cardType,
        createdInSessionId: sessionId,
        title: req.title,
        description: req.description,
        hiddenInstructions: req.hiddenInstructions,
        imageId: req.imageId,
        soundId: req.soundId ?? null,
        drinkingLevel: levels.drinkingLevel,
        spiceLevel: levels.spiceLevel,
        isGameChanger: req.cardType === "reparations" ? false : req.isGameChanger,
        gameTags: req.gameTags,
        requirementIds: req.requirementIds,
    });
    // Store the initial crop offset on the media row (outside the version snapshot).
    if (req.imageId && req.imageYOffset !== undefined) {
        mediaRepo.updateYOffset(req.imageId, req.imageYOffset);
    }
    // Re-fetch so the returned card reflects the updated media y_offset via JOIN.
    return cardRepo.findById(card.id)!;
}

// ─── Card editing ─────────────────────────────────────────────────────────────

/** Returns true if two string arrays contain the same elements (order-insensitive). */
function sortedEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
}

export function updateCard(
    userId: string,
    cardId: string,
    req: SubmitCardRequest,
    isAdmin: boolean
): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.ownerUserId !== userId) {
        throw new AuthorizationError("You can only edit your own cards");
    }
    if (card.isGlobal && !isAdmin) {
        throw new AuthorizationError("Global cards can only be edited by admins");
    }

    validateRequirementIds(req.requirementIds);
    validateSoundId(req.soundId, userId, isAdmin);
    const levels = applyContentFloors(
        { title: req.title, description: req.description, hiddenInstructions: req.hiddenInstructions },
        { drinkingLevel: req.drinkingLevel, spiceLevel: req.spiceLevel },
    );

    const cv = card.currentVersion;
    const isGameChanger = card.cardType === "reparations" ? false : req.isGameChanger;

    // Determine whether any card content actually changed.
    // imageYOffset is intentionally excluded — it lives on the media row, not the version.
    const sameContent =
        req.title === cv.title &&
        req.description === cv.description &&
        req.hiddenInstructions === cv.hiddenInstructions &&
        (req.imageId ?? null) === cv.imageId &&
        (req.soundId ?? null) === (cv.soundId ?? null) &&
        levels.drinkingLevel === cv.drinkingLevel &&
        levels.spiceLevel === cv.spiceLevel &&
        isGameChanger === cv.isGameChanger &&
        sortedEqual(req.gameTags, cv.gameTags.map((t) => t.id)) &&
        sortedEqual(req.requirementIds, cv.requirements.map((r) => r.id));

    if (!sameContent) {
        cardRepo.createVersion(cardId, {
            authoredByUserId: userId,
            title: req.title,
            description: req.description,
            hiddenInstructions: req.hiddenInstructions,
            imageId: req.imageId,
            soundId: req.soundId ?? null,
            drinkingLevel: levels.drinkingLevel,
            spiceLevel: levels.spiceLevel,
            isGameChanger,
            gameTags: req.gameTags,
            requirementIds: req.requirementIds,
        });
    }

    // Update the crop offset on whichever image will be active after this save.
    // When content changed, the imageId may have changed too; use the requested one.
    const effectiveImageId = sameContent ? cv.imageId : (req.imageId ?? null);
    if (effectiveImageId && req.imageYOffset !== undefined) {
        mediaRepo.updateYOffset(effectiveImageId, req.imageYOffset);
    }

    return cardRepo.findById(cardId)!;
}

export function deactivateCard(userId: string, cardId: string, isAdmin: boolean): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.ownerUserId !== userId) {
        throw new AuthorizationError("You can only deactivate your own cards");
    }
    if (card.isGlobal && !isAdmin) {
        throw new AuthorizationError("Global cards can only be deactivated by admins");
    }
    cardRepo.setActive(cardId, false);
    return cardRepo.findById(cardId)!;
}

export function reactivateCard(userId: string, cardId: string, isAdmin: boolean): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.ownerUserId !== userId) {
        throw new AuthorizationError("You can only reactivate your own cards");
    }
    if (card.isGlobal && !isAdmin) {
        throw new AuthorizationError("Global cards can only be reactivated by admins");
    }
    cardRepo.setActive(cardId, true);
    return cardRepo.findById(cardId)!;
}

// ─── Votes ────────────────────────────────────────────────────────────────────

export function voteCard(userId: string, cardId: string, direction: "up" | "down"): void {
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

export function nominateForGlobal(userId: string, cardId: string): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (card.ownerUserId !== userId) {
        throw new AuthorizationError("You can only nominate your own cards");
    }
    if (card.isGlobal) {
        throw new ConflictError("Card is already in the global pool");
    }
    if (card.pendingGlobal) {
        throw new ConflictError("Card is already nominated for global promotion");
    }
    if (!card.active) {
        throw new ConflictError("Cannot nominate an inactive card");
    }
    cardRepo.setGlobalNomination(cardId, true);
    return cardRepo.findById(cardId)!;
}

export function withdrawNomination(userId: string, cardId: string, isAdmin: boolean): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    if (!isAdmin && card.ownerUserId !== userId) {
        throw new AuthorizationError("You can only withdraw nominations for your own cards");
    }
    cardRepo.setGlobalNomination(cardId, false);
    return cardRepo.findById(cardId)!;
}

export function transferOwnership(cardId: string, newOwnerUserId: string): Card {
    const card = cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("Card not found");
    const newOwner = userRepo.findById(newOwnerUserId);
    if (!newOwner) throw new NotFoundError("User not found");
    cardRepo.setOwnerUserId(cardId, newOwnerUserId);
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
        includeGlobalCards: boolean;
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

    const event = drawEventRepo.create({
        id: randomUUID(),
        sessionId,
        playerId,
        cardId: selected.cardId,
        cardVersionId: selected.cardVersionId,
        drawnAt: now.toISOString(),
        revealedToAllAt: revealedAt,
    });
    // Drawer receives their own event unfiltered; everyone else (pollers) will be filtered in getSessionState.
    return filterDrawEvent(event, playerId);
}

export function drawCard(sessionId: string, playerId: string): DrawEvent {
    return drawFromPool(sessionId, playerId, "standard");
}

export function drawReparationsCard(sessionId: string, playerId: string): DrawEvent {
    return drawFromPool(sessionId, playerId, "reparations");
}

// ─── Draw event mutations ─────────────────────────────────────────────────────

export function shareDescription(drawEventId: string, requestingPlayerId: string): DrawEvent {
    const event = drawEventRepo.findById(drawEventId);
    if (!event) throw new NotFoundError("Draw event not found");
    if (event.playerId !== requestingPlayerId) {
        throw new AuthorizationError("Only the drawer can share hidden instructions");
    }
    if (!event.cardVersion.hasHiddenInstructions) {
        throw new ConflictError("Card has no hidden instructions");
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
            cardId: originalEvent.card.id,
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
