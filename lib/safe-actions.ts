import { createSafeActionClient } from "next-safe-action";
import { getSession } from "./auth";

export const action = createSafeActionClient();

export const authenticatedAction = createSafeActionClient({
    async middleware() {
        const session = await getSession();

        if (!session?.user.id) {
            throw new Error("Not authenticated")
        }

        return {
            userId: session.user.id
        }
    }
});
