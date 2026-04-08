import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as gameRepo from "@/lib/repos/gameRepo";

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { gameId } = await params;
        const game = gameRepo.findById(gameId);
        if (!game) return fail(new NotFoundError("Game not found"));

        const body = await req.json();
        const { active, name } = body as { active?: boolean; name?: string };

        if (active !== undefined) gameRepo.setActive(gameId, active);
        if (name !== undefined) gameRepo.update(gameId, { name });

        const updated = gameRepo.findById(gameId)!;
        return ok({
            ...gameRepo.mapGame(updated),
            active: updated.active === 1,
            createdAt: updated.created_at,
            cardCount: gameRepo.countCards(gameId),
        });
    } catch (err) {
        return handleError(err);
    }
});
