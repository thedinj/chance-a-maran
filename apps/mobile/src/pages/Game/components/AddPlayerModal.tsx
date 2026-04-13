import { JoinByCodeRequestSchema, MAX_DISPLAY_NAME_LENGTH } from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "../../../lib/api";
import { playerTokenStore } from "../../../lib/playerTokenStore";
import { useGamePageContext } from "../useGamePageContext";
import { styles } from "../styles";

const AddPlayerSchema = JoinByCodeRequestSchema.pick({ displayName: true }).extend({
    displayName: z
        .string()
        .trim()
        .min(1, "Please enter a display name.")
        .max(MAX_DISPLAY_NAME_LENGTH, `Name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`),
});

type AddPlayerValues = z.infer<typeof AddPlayerSchema>;

export function AddPlayerModal() {
    const { session, addDevicePlayer, setActivePlayer, setShowAddPlayer } = useGamePageContext();
    const [pending, startTransition] = useTransition();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<AddPlayerValues>({
        resolver: zodResolver(AddPlayerSchema),
        defaultValues: { displayName: "" },
    });

    async function onSubmit(values: AddPlayerValues) {
        startTransition(async () => {
            const joinCode = session!.joinCode;
            const savedToken = await playerTokenStore.get(joinCode, values.displayName);
            const result = await apiClient.joinByCodeAsGuest({
                joinCode,
                displayName: values.displayName,
                playerToken: savedToken,
            });
            if (!result.ok) {
                const code = result.error.code;
                if (code === "CONFLICT_ERROR") {
                    setError("root", { message: "That name is in use on another device." });
                } else if (code === "AUTHENTICATION_ERROR") {
                    setError("root", {
                        message:
                            "This name belongs to a registered player. Ask them to join from their own device.",
                    });
                } else {
                    setError("root", { message: result.error.message });
                }
                return;
            }
            const { player, playerToken } = result.data;
            if (playerToken) {
                await playerTokenStore.set(joinCode, values.displayName, playerToken);
            }
            addDevicePlayer(player.id);
            setActivePlayer(player.id);
            setShowAddPlayer(false);
        });
    }

    return (
        <div style={styles.overlayBackdrop as React.CSSProperties} onClick={() => setShowAddPlayer(false)}>
            <div style={styles.addPlayerSheet as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                <p style={styles.addPlayerTitle as React.CSSProperties}>Add player to this device</p>
                <p style={styles.addPlayerHint as React.CSSProperties}>
                    Enter a display name. They'll take turns on this device.
                </p>
                <form onSubmit={handleSubmit(onSubmit)} style={styles.addPlayerForm as React.CSSProperties}>
                    <input
                        style={styles.addPlayerInput as React.CSSProperties}
                        type="text"
                        placeholder="Display name"
                        autoFocus
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        {...register("displayName")}
                    />
                    {errors.displayName && (
                        <p style={styles.addPlayerError as React.CSSProperties}>{errors.displayName.message}</p>
                    )}
                    {errors.root && <p style={styles.addPlayerError as React.CSSProperties}>{errors.root.message}</p>}
                    <div style={styles.addPlayerActions as React.CSSProperties}>
                        <button type="button" style={styles.addPlayerCancel as React.CSSProperties} onClick={() => setShowAddPlayer(false)}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                ...(styles.addPlayerJoin as React.CSSProperties),
                                opacity: !pending ? 1 : 0.45,
                            }}
                            disabled={pending}
                        >
                            {pending ? "Joining…" : "Join"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
