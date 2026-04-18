import { useHistory } from "react-router-dom";
import { useSession } from "../session/useSession";
import { useCallback } from "react";

/** Returns the canonical "back" destination for all secondary pages. */
export function useHomeBase(): string {
    const { session } = useSession();
    return session ? "/game" : "/";
}

export function useGoToHomeBase() {
    const history = useHistory();
    const homeBase = useHomeBase();
    return useCallback(() => {
        history.push(homeBase);
    }, [history, homeBase]);
}
