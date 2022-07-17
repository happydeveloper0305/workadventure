import { queryWorkadventure } from "./IframeApiContribution";
import { apiCallback } from "./registeredCallbacks";
import { AbstractWorkadventureStateCommands } from "./AbstractState";

export class WorkadventurePlayerStateCommands extends AbstractWorkadventureStateCommands {
    public constructor() {
        super();
    }

    callbacks = [
        apiCallback({
            type: "setPlayerVariable",
            callback: (payloadData) => {
                this.setVariableResolvers.next(payloadData);
            },
        }),
    ];

    saveVariable(
        key: string,
        value: unknown,
        options?: {
            public?: boolean;
            persist?: boolean;
            ttl?: number;
            scope?: "world" | "room";
        }
    ): Promise<void> {
        this.variables.set(key, value);
        return queryWorkadventure({
            type: "setPlayerVariable",
            data: {
                key,
                value,
                public: options?.public ?? true,
                ttl: options?.ttl ?? undefined,
                persist: options?.persist ?? false,
                scope: options?.scope ?? "room",
            },
        });
    }
}

export const playerState = new Proxy(new WorkadventurePlayerStateCommands(), {
    get(target: WorkadventurePlayerStateCommands, p: PropertyKey, receiver: unknown): unknown {
        if (p in target) {
            return Reflect.get(target, p, receiver);
        }
        return target.loadVariable(p.toString());
    },
    set(target: WorkadventurePlayerStateCommands, p: PropertyKey, value: unknown, receiver: unknown): boolean {
        // Note: when using "set", there is no way to wait, so we ignore the return of the promise.
        // User must use WA.state.saveVariable to have error message.
        target.saveVariable(p.toString(), value).catch((e) => console.error(e));
        return true;
    },
    has(target: WorkadventurePlayerStateCommands, p: PropertyKey): boolean {
        if (p in target) {
            return true;
        }
        return target.hasVariable(p.toString());
    },
}) as WorkadventurePlayerStateCommands & { [key: string]: unknown };
