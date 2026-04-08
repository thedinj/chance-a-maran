import { ok } from "@/lib/auth/response";
import * as requirementElementRepo from "@/lib/repos/requirementElementRepo";

export const dynamic = "force-dynamic";

export function GET() {
    return ok(requirementElementRepo.listActive());
}
