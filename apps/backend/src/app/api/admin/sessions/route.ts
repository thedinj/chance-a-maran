import { handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as sessionRepo from "@/lib/repos/sessionRepo";
import * as playerRepo from "@/lib/repos/playerRepo";

export const dynamic = "force-dynamic";

/** GET /api/admin/sessions — all sessions with host, player list, and draw count. */
export const GET = withAdmin(async () => {
    try {
        const rows = sessionRepo.findAllAdmin();
        const result = rows.map((row) => {
            const session = sessionRepo.mapSession(row);
            const players = playerRepo.findBySessionId(row.id).map(playerRepo.mapPlayer);
            return {
                ...session,
                hostDisplayName: row.host_display_name,
                playerCount: row.player_count,
                drawCount: row.draw_count,
                players,
            };
        });
        return ok(result);
    } catch (err) {
        return handleError(err);
    }
});
