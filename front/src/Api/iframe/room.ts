import { Subject } from "rxjs";
import { EnterLeaveEvent, isEnterLeaveEvent } from '../Events/EnterLeaveEvent';
import { IframeApiContribution } from './IframeApiContribution';
import { apiCallback } from "./registeredCallbacks";

const enterStreams: Map<string, Subject<EnterLeaveEvent>> = new Map<string, Subject<EnterLeaveEvent>>();
const leaveStreams: Map<string, Subject<EnterLeaveEvent>> = new Map<string, Subject<EnterLeaveEvent>>();

class WorkadventureRoomCommands extends IframeApiContribution<WorkadventureRoomCommands> {
    callbacks = [
        apiCallback({
            callback: (payloadData: EnterLeaveEvent) => {
                enterStreams.get(payloadData.name)?.next();
            },
            type: "enterEvent",
            typeChecker: isEnterLeaveEvent
        }),
        apiCallback({
            type: "leaveEvent",
            typeChecker: isEnterLeaveEvent,
            callback: (payloadData) => {
                leaveStreams.get(payloadData.name)?.next();
            }
        })

    ]


    onEnterZone(name: string, callback: () => void): void {
        let subject = enterStreams.get(name);
        if (subject === undefined) {
            subject = new Subject<EnterLeaveEvent>();
            enterStreams.set(name, subject);
        }
        subject.subscribe(callback);

    }
    onLeaveZone(name: string, callback: () => void): void {
        let subject = leaveStreams.get(name);
        if (subject === undefined) {
            subject = new Subject<EnterLeaveEvent>();
            leaveStreams.set(name, subject);
        }
        subject.subscribe(callback);
    }

}


export default new WorkadventureRoomCommands();
