import { writable } from "svelte/store";
import debug from "debug";
import { slugify } from "@workadventure/shared-utils/src/Jitsi/slugify";
import { SpaceFilterMessage } from "@workadventure/messages";
import { ConcatenateMapStore } from "@workadventure/store-utils";
import { RoomConnection } from "../Connection/RoomConnection";
import { screenWakeLock } from "../Utils/ScreenWakeLock";
import { BroadcastSpace } from "./Common/BroadcastSpace";
import { BroadcastConnection } from "./Common/BroadcastConnection";
import { TrackWrapper } from "./Common/TrackWrapper";

export const jitsiLoadingStore = writable<boolean>(false);

const broadcastServiceLogger = debug("BroadcastService");

export type BroadcastSpaceFactory = (
    connection: RoomConnection,
    spaceName: string,
    spaceFilter: SpaceFilterMessage,
    broadcastService: BroadcastService,
    playSound: boolean
) => BroadcastSpace;

export class BroadcastService {
    private broadcastConnections: Map<string, BroadcastConnection> = new Map<string, BroadcastConnection>();
    private broadcastSpaces: BroadcastSpace[] = [];
    private tracks = new ConcatenateMapStore<string, TrackWrapper>();
    private screenWakeRelease: (() => Promise<void>) | undefined;

    constructor(private roomConnection: RoomConnection, private defaultBroadcastSpaceFactory: BroadcastSpaceFactory) {}

    /**
     * Join a broadcast space
     * @param spaceName The name of the space to join
     * @param playSound Whether to play a sound when joining the space
     * @param broadcastSpaceFactory A factory to create the broadcast space. If not provided, the default one will be used.
     * @returns The broadcast space
     */
    public joinSpace(
        spaceName: string,
        playSound = true,
        broadcastSpaceFactory?: BroadcastSpaceFactory
    ): BroadcastSpace {
        const spaceNameSlugify = slugify(spaceName);
        const spaceFilter = this.roomConnection.emitWatchSpaceLiveStreaming(spaceNameSlugify);
        const broadcastSpace = broadcastSpaceFactory
            ? broadcastSpaceFactory(this.roomConnection, spaceNameSlugify, spaceFilter, this, playSound)
            : this.defaultBroadcastSpaceFactory(this.roomConnection, spaceNameSlugify, spaceFilter, this, playSound);
        this.broadcastSpaces.push(broadcastSpace);
        this.tracks.addStore(broadcastSpace.tracks);
        broadcastServiceLogger("joinSpace", spaceNameSlugify);
        screenWakeLock
            .requestWakeLock()
            .then((release) => (this.screenWakeRelease = release))
            .catch((error) => console.error(error));
        return broadcastSpace;
    }

    /**
     * Leave a broadcast space
     * @param spaceName The name of the space to leave
     */
    public leaveSpace(spaceName: string) {
        const spaceNameSlugify = slugify(spaceName);
        const space = this.broadcastSpaces.find((space) => space.space.name === spaceNameSlugify);
        if (space) {
            this.roomConnection.emitUnwatchSpaceLiveStreaming(spaceNameSlugify);
            space.destroy();
            this.broadcastSpaces = this.broadcastSpaces.filter((space) => space.space.name !== spaceNameSlugify);
            broadcastServiceLogger("leaveSpace", spaceNameSlugify);
        }
        jitsiLoadingStore.set(false);
        if (this.screenWakeRelease) {
            this.screenWakeRelease()
                .then(() => {
                    this.screenWakeRelease = undefined;
                })
                .catch((error) => console.error(error));
        }
    }

    /**
     * Get the list of tracks from all broadcast spaces
     * @returns The list of tracks from all broadcast spaces
     */
    public getTracks(): ConcatenateMapStore<string, TrackWrapper> {
        return this.tracks;
    }

    /**
     * Get the broadcast connection for a given provider
     * @param provider Provider name
     * @returns The broadcast connection or undefined if not found
     */
    public getBroadcastConnection(provider: string): BroadcastConnection | undefined {
        return this.broadcastConnections.get(provider);
    }

    /**
     * Set the broadcast connection for a given provider
     * @param provider Provider name
     * @param connection The broadcast connection
     */
    public setBroadcastConnection(provider: string, connection: BroadcastConnection) {
        this.broadcastConnections.set(provider, connection);
    }

    /**
     * Leave all broadcast spaces for a given provider
     * @param provider Provider name
     * @returns The broadcast connection or undefined if not found
     */
    private canDisconnectProvider(provider: string): boolean {
        return this.broadcastSpaces
            .filter((space) => space.provider === provider)
            .every((space) => space.space.isEmpty);
    }

    /**
     * Destroy the broadcast service
     */
    public destroy(): void {
        this.broadcastSpaces.forEach((space) => space.destroy());
    }

    /**
     * Check if the broadcast service can disconnect
     * @param provider Provider name
     */
    public checkIfCanDisconnect(provider: string) {
        const providerConnection = this.broadcastConnections.get(provider);
        if (this.canDisconnectProvider(provider) && providerConnection !== undefined) {
            broadcastServiceLogger("Disconnecting from broadcast connection");
            providerConnection
                .disconnect()
                .then(() => {
                    this.broadcastConnections.delete(provider);
                })
                .catch((e) => {
                    console.error(e);
                });
        }
    }
}
