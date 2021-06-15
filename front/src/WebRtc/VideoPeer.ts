import type * as SimplePeerNamespace from "simple-peer";
import {mediaManager} from "./MediaManager";
import {STUN_SERVER, TURN_PASSWORD, TURN_SERVER, TURN_USER} from "../Enum/EnvironmentVariable";
import type {RoomConnection} from "../Connexion/RoomConnection";
import {blackListManager} from "./BlackListManager";
import type {Subscription} from "rxjs";
import type {UserSimplePeerInterface} from "./SimplePeer";
import {get, readable, Readable} from "svelte/store";
import {obtainedMediaConstraintStore} from "../Stores/MediaStore";
import {DivImportance} from "./LayoutManager";
import {discussionManager} from "./DiscussionManager";

const Peer: SimplePeerNamespace.SimplePeer = require('simple-peer');

export const MESSAGE_TYPE_CONSTRAINT = 'constraint';
export const MESSAGE_TYPE_MESSAGE = 'message';
export const MESSAGE_TYPE_BLOCKED = 'blocked';
export const MESSAGE_TYPE_UNBLOCKED = 'unblocked';
/**
 * A peer connection used to transmit video / audio signals between 2 peers.
 */
export class VideoPeer extends Peer {
    public toClose: boolean = false;
    public _connected: boolean = false;
    private remoteStream!: MediaStream;
    private blocked: boolean = false;
    public readonly userId: number;
    public readonly uniqueId: string;
    private onBlockSubscribe: Subscription;
    private onUnBlockSubscribe: Subscription;
    public readonly streamStore: Readable<MediaStream | null>;
    public readonly statusStore: Readable<"connecting" | "connected" | "error" | "closed">;
    public readonly constraintsStore: Readable<MediaStreamConstraints|null>;

    constructor(public user: UserSimplePeerInterface, initiator: boolean, public readonly userName: string, private connection: RoomConnection, localStream: MediaStream | null) {
        super({
            initiator: initiator ? initiator : false,
            //reconnectTimer: 10000,
            config: {
                iceServers: [
                    {
                        urls: STUN_SERVER.split(',')
                    },
                    TURN_SERVER !== '' ? {
                        urls: TURN_SERVER.split(','),
                        username: user.webRtcUser || TURN_USER,
                        credential: user.webRtcPassword || TURN_PASSWORD
                    } :  undefined,
                ].filter((value) => value !== undefined)
            }
        });

        this.userId = user.userId;
        this.uniqueId = 'video_'+this.userId;

        this.streamStore = readable<MediaStream|null>(null, (set) => {
            const onStream = (stream: MediaStream|null) => {
                set(stream);
            };
            const onData = (chunk: Buffer) => {
                this.on('data',  (chunk: Buffer) => {
                    const message = JSON.parse(chunk.toString('utf8'));
                    if (message.type === MESSAGE_TYPE_CONSTRAINT) {
                        if (!message.video) {
                            set(null);
                        }
                    }
                });
            }

            this.on('stream', onStream);
            this.on('data', onData);

            return () => {
                this.off('stream', onStream);
                this.off('data', onData);
            };
        });

        this.constraintsStore = readable<MediaStreamConstraints|null>(null, (set) => {
            const onData = (chunk: Buffer) => {
                const message = JSON.parse(chunk.toString('utf8'));
                if(message.type === MESSAGE_TYPE_CONSTRAINT) {
                    set(message);
                }
            }

            this.on('data', onData);

            return () => {
                this.off('data', onData);
            };
        });

        this.statusStore = readable<"connecting" | "connected" | "error" | "closed">("connecting", (set) => {
            const onConnect = () => {
                set('connected');
            };
            const onError = () => {
                set('error');
            };
            const onClose = () => {
                set('closed');
            };

            this.on('connect', onConnect);
            this.on('error', onError);
            this.on('close', onClose);

            return () => {
                this.off('connect', onConnect);
                this.off('error', onError);
                this.off('close', onClose);
            };
        });

        //start listen signal for the peer connection
        this.on('signal', (data: unknown) => {
            this.sendWebrtcSignal(data);
        });

        this.on('stream', (stream: MediaStream) => this.stream(stream));

        this.on('close', () => {
            this._connected = false;
            this.toClose = true;
            this.destroy();
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.on('error', (err: any) => {
            console.error(`error => ${this.userId} => ${err.code}`, err);
            mediaManager.isError("" + this.userId);
        });

        this.on('connect', () => {
            this._connected = true;
            mediaManager.isConnected("" + this.userId);
            console.info(`connect => ${this.userId}`);
        });

        this.on('data',  (chunk: Buffer) => {
            const message = JSON.parse(chunk.toString('utf8'));
            if(message.type === MESSAGE_TYPE_CONSTRAINT) {
                if (message.audio) {
                    mediaManager.enabledMicrophoneByUserId(this.userId);
                } else {
                    mediaManager.disabledMicrophoneByUserId(this.userId);
                }

                if (message.video || message.screen) {
                    mediaManager.enabledVideoByUserId(this.userId);
                } else {
                    mediaManager.disabledVideoByUserId(this.userId);
                }
            } else if(message.type === MESSAGE_TYPE_MESSAGE) {
                if (!blackListManager.isBlackListed(message.userId)) {
                    mediaManager.addNewMessage(message.name, message.message);
                }
            } else if(message.type === MESSAGE_TYPE_BLOCKED) {
                //FIXME when A blacklists B, the output stream from A is muted in B's js client. This is insecure since B can manipulate the code to unmute A stream.
                // Find a way to block A's output stream in A's js client
                //However, the output stream stream B is correctly blocked in A client
                this.blocked = true;
                this.toggleRemoteStream(false);
            } else if(message.type === MESSAGE_TYPE_UNBLOCKED) {
                this.blocked = false;
                this.toggleRemoteStream(true);
            }
        });

        this.once('finish', () => {
            this._onFinish();
        });

        this.pushVideoToRemoteUser(localStream);
        this.onBlockSubscribe = blackListManager.onBlockStream.subscribe((userId) => {
            if (userId === this.userId) {
                this.toggleRemoteStream(false);
                this.sendBlockMessage(true);
            }
        });
        this.onUnBlockSubscribe = blackListManager.onUnBlockStream.subscribe((userId) => {
            if (userId === this.userId) {
                this.toggleRemoteStream(true);
                this.sendBlockMessage(false);
            }
        });

        if (blackListManager.isBlackListed(this.userId)) {
            this.sendBlockMessage(true)
        }
    }

    private sendBlockMessage(blocking: boolean) {
        this.write(new Buffer(JSON.stringify({type: blocking ? MESSAGE_TYPE_BLOCKED : MESSAGE_TYPE_UNBLOCKED, name: this.userName.toUpperCase(), userId: this.userId, message: ''})));
    }

    private toggleRemoteStream(enable: boolean) {
        this.remoteStream.getTracks().forEach(track => track.enabled = enable);
        mediaManager.toggleBlockLogo(this.userId, !enable);
    }

    private sendWebrtcSignal(data: unknown) {
        try {
            this.connection.sendWebrtcSignal(data, this.userId);
        }catch (e) {
            console.error(`sendWebrtcSignal => ${this.userId}`, e);
        }
    }

    /**
     * Sends received stream to screen.
     */
    private stream(stream: MediaStream) {
        try {
            this.remoteStream = stream;
            if (blackListManager.isBlackListed(this.userId) || this.blocked) {
                this.toggleRemoteStream(false);
            }
            //mediaManager.addStreamRemoteVideo("" + this.userId, stream);
        }catch (err){
            console.error(err);
        }
    }

    /**
     * This is triggered twice. Once by the server, and once by a remote client disconnecting
     */
    public destroy(error?: Error): void {
        try {
            this._connected = false
            if(!this.toClose){
                return;
            }
            this.onBlockSubscribe.unsubscribe();
            this.onUnBlockSubscribe.unsubscribe();
            discussionManager.removeParticipant(this.userId);
            // FIXME: I don't understand why "Closing connection with" message is displayed TWICE before "Nb users in peerConnectionArray"
            // I do understand the method closeConnection is called twice, but I don't understand how they manage to run in parallel.
            super.destroy(error);
        } catch (err) {
            console.error("VideoPeer::destroy", err)
        }
    }

    _onFinish () {
        if (this.destroyed) return
        const destroySoon = () => {
            this.destroy();
        }
        if (this._connected) {
            destroySoon();
        } else {
            this.once('connect', destroySoon);
        }
    }

    private pushVideoToRemoteUser(localStream: MediaStream | null) {
        try {
            this.write(new Buffer(JSON.stringify({type: MESSAGE_TYPE_CONSTRAINT, ...get(obtainedMediaConstraintStore)})));

            if(!localStream){
                return;
            }

            for (const track of localStream.getTracks()) {
                this.addTrack(track, localStream);
            }
        }catch (e) {
            console.error(`pushVideoToRemoteUser => ${this.userId}`, e);
        }
    }
}
