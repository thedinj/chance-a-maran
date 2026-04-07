import { useSession } from "../session/useSession";

/** Returns the canonical "back" destination for all secondary pages. */
export function useHomeBase(): string {
    const { session } = useSession();
    return session ? `/game/${session.id}` : "/";
}
