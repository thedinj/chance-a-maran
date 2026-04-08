import { randomUUID } from "crypto";
import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as gameRepo from "@/lib/repos/gameRepo";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
    try {
        const games = gameRepo.findAllIncludingInactive().map((g) => ({
            ...gameRepo.mapGame(g),
            active: g.active === 1,
            createdAt: g.created_at,
            cardCount: gameRepo.countCards(g.id),
        }));
        return ok(games);
    } catch (err) {
        return handleError(err);
    }
});

export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const { name } = body as { name?: string };
        if (!name?.trim()) return fail(new ValidationError("name is required"));

        const game = gameRepo.create({ id: randomUUID(), name: name.trim() });
        return ok(game, 201);
    } catch (err) {
        return handleError(err);
    }
});
