import type { Observable } from "rxjs";
import { Subject } from "rxjs";
import type { AddPlayerEvent } from "../Events/AddPlayerEvent";
import { IframeApiContribution, queryWorkadventure } from "./IframeApiContribution";
import { apiCallback } from "./registeredCallbacks";
import type { RemotePlayerInterface, RemotePlayerMoved } from "./Players/RemotePlayer";
import { RemotePlayer, remotePlayers } from "./Players/RemotePlayer";

export interface PlayerVariableChanged {
    player: RemotePlayer;
    value: unknown;
}

const sharedPlayersVariableStream = new Map<string, Subject<PlayerVariableChanged>>();
const _newRemotePlayersStream = new Subject<RemotePlayer>();
const newRemotePlayersStream = _newRemotePlayersStream.asObservable();
const _removeRemotePlayersStream = new Subject<RemotePlayer>();
const removeRemotePlayersStream = _removeRemotePlayersStream.asObservable();
const _playersMovedStream = new Subject<RemotePlayerMoved>();
const playersMovedStream = _playersMovedStream.asObservable();

export class WorkadventurePlayersCommands extends IframeApiContribution<WorkadventurePlayersCommands> {
    private trackingPlayers = false;
    private trackingMovement = false;

    callbacks = [
        apiCallback({
            type: "setSharedPlayerVariable",
            callback: (payloadData) => {
                const remotePlayer = remotePlayers.get(payloadData.playerId);
                if (remotePlayer === undefined) {
                    console.warn(
                        "Received a variable message for a player that isn't connected. Ignoring.",
                        payloadData
                    );
                    return;
                }

                remotePlayer.setVariable(payloadData.key, payloadData.value);
                const stream = sharedPlayersVariableStream.get(payloadData.key);
                if (stream) {
                    stream.next({
                        player: remotePlayer,
                        value: payloadData.value,
                    });
                }
            },
        }),
        apiCallback({
            type: "addRemotePlayer",
            callback: (payloadData) => {
                this.registerRemotePlayer(payloadData);
            },
        }),
        apiCallback({
            type: "removeRemotePlayer",
            callback: (userId) => {
                const remotePlayer = remotePlayers.get(userId);
                if (remotePlayer === undefined) {
                    console.warn("Could not find remote player to delete: ", userId);
                } else {
                    remotePlayers.delete(userId);
                    _removeRemotePlayersStream.next(remotePlayer);
                    remotePlayer.destroy();
                }
            },
        }),
        apiCallback({
            type: "remotePlayerChanged",
            callback: (event) => {
                const remotePlayer = remotePlayers.get(event.playerId);
                if (remotePlayer === undefined) {
                    console.warn("Could not find remote player with ID : ", event.playerId);
                    return;
                }

                if (event.position) {
                    const oldPosition = remotePlayer.position;
                    remotePlayer.position = event.position;

                    _playersMovedStream.next({
                        player: remotePlayer,
                        newPosition: event.position,
                        oldPosition,
                    });
                }
                // TODO: listen to other status changes (like outlineColor, availability, etc...)
            },
        }),
    ];

    private registerRemotePlayer(event: AddPlayerEvent): void {
        const remotePlayer = new RemotePlayer(event);
        remotePlayers.set(event.playerId, remotePlayer);
        _newRemotePlayersStream.next(remotePlayer);
    }

    /**
     * Start the tracking players. You need to call this method before being able to listen to players positions.
     * {@link https://workadventu.re/map-building/api-players.md#enabling-players-tracking | Website documentation}
     *
     * ```ts
     * await WA.players.configureTracking({
     *     players: true, // Required to use "onPlayerEnters", "onPlayerLeaves", "list" and "get"
     *     movement: true, // Required to get the player position and use "onPlayerMoves"
     * })
     * ```
     *
     * @param options
     */
    public async configureTracking(options?: { players?: boolean; movement?: boolean }): Promise<void> {
        const trackingPlayers = options?.players ?? true;
        const trackingMovement = options?.movement ?? true;
        if (trackingPlayers === this.trackingPlayers && trackingMovement === this.trackingMovement) {
            return;
        }
        this.trackingPlayers = trackingPlayers;
        this.trackingMovement = trackingMovement;
        const remotePlayersData = await queryWorkadventure({
            type: "enablePlayersTracking",
            data: {
                players: this.trackingPlayers,
                movement: this.trackingMovement,
            },
        });

        if (trackingPlayers) {
            for (const remotePlayerEvent of remotePlayersData) {
                this.registerRemotePlayer(remotePlayerEvent);
            }
        }
    }

    /**
     * Listens to a given variable change on all available players.
     * {@link https://workadventu.re/map-building/api-players.md#listen-to-a-remote-player-variable-changes | Website documentation}
     *
     * ```ts
     * WA.players.onVariableChange("score").subscribe({ player, value } => {
     *     console.info("Score for player", player.name, "has been updated to", value);
     * });
     * ```
     *
     * If you are looking to listen for variable changes of only one player, look at `RemotePlayer.onVariableChange` instead.
     */
    public onVariableChange(variableName: string): Observable<PlayerVariableChanged> {
        let stream = sharedPlayersVariableStream.get(variableName);
        if (!stream) {
            stream = new Subject<PlayerVariableChanged>();
            sharedPlayersVariableStream.set(variableName, stream);
        }
        return stream.asObservable();
    }

    /**
     * Listens to new remote players.
     * These will be triggered when a remote player is entering our "zone" (zone ~= viewport)
     * This means this will NOT be triggered when a remote player enters the map, but when the remote player is
     * getting visible.
     * {@link https://workadventu.re/map-building/api-players.md#tracking-players-in-real-time | Website documentation}
     *
     * Usage:
     *
     * ```
     * WA.players.onPlayerEnters.subscribe((remotePlayer) => { doStuff(); });
     * ```
     */
    public get onPlayerEnters(): Observable<RemotePlayerInterface> {
        if (!this.trackingPlayers) {
            throw new Error(
                "Cannot call WA.players.onPlayerEnters. You forgot to call WA.players.configureTracking() first."
            );
        }
        return newRemotePlayersStream;
    }

    /**
     * Listens to remote players leaving.
     * These will be triggered when a remote player is leaving our "zone" (zone ~= viewport)
     * This means this will be triggered when a remote player leaves the map, but ALSO when the remote player is
     * walking away and is no longer visible.
     * {@link https://workadventu.re/map-building/api-players.md#tracking-players-in-real-time | Website documentation}
     *
     * Usage:
     *
     * ```
     * WA.players.onPlayerLeaves.subscribe((remotePlayer) => { doCleanupStuff(); });
     * ```
     */
    public get onPlayerLeaves(): Observable<RemotePlayerInterface> {
        if (!this.trackingPlayers) {
            throw new Error(
                "Cannot call WA.players.onPlayerLeaves. You forgot to call WA.players.configureTracking() first."
            );
        }
        return removeRemotePlayersStream;
    }

    /**
     * Listens to movement from all players who are in our zone (zone ~= viewport)
     * This means this may NOT be triggered when a remote player moves but is far away from us.
     * {@link https://workadventu.re/map-building/api-players.md#tracking-players-movement | Website documentation}
     *
     * Usage:
     *
     * ```
     * WA.players.onPlayerMoves.subscribe(({ player, newPosition, oldPosition }) => { doStuff(); });
     * ```
     */
    public get onPlayerMoves(): Observable<RemotePlayerMoved> {
        if (!this.trackingMovement) {
            throw new Error(
                "Cannot call WA.players.onPlayerMoves(). You forgot to call WA.players.configureTracking() first."
            );
        }
        return playersMovedStream;
    }

    /**
     * Returns a RemotePlayer by its id.
     * {@link https://workadventu.re/map-building/api-players.md#getting-a-remote-player-by-id | Website documentation}
     *
     * Note: if the same user is connected twice, it will be considered as 2 different players with 2 different IDs.
     */
    public get(id: number): RemotePlayerInterface | undefined {
        return remotePlayers.get(id);
    }

    /**
     * Returns the list of all nearby remote players.
     * The list only contains the players in the same zone as the current player (where zone ~= viewport).
     * {@link https://workadventu.re/map-building/api-players.md#getting-a-list-of-players-around-me | Website documentation}
     */
    public list(): IterableIterator<RemotePlayerInterface> {
        return remotePlayers.values();
    }
}

export default new WorkadventurePlayersCommands();
