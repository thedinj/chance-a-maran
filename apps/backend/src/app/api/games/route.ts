import { ok } from "@/lib/auth/response";
import * as gameRepo from "@/lib/repos/gameRepo";

export const dynamic = "force-dynamic";

export function GET() {
    return ok(gameRepo.findAll());
}
