import { IframeResponseEvent } from "../../Api/Events/IframeEvent";

export const registeredCallbacks: {
    [K in IframeResponseEvent["type"]]?: (event: Extract<IframeResponseEvent, { type: K }>["data"]) => void;
} = {};

export function apiCallback<T extends IframeResponseEvent["type"]>(callbackData: {
    type: T;
    callback: (event: Extract<IframeResponseEvent, { type: T }>["data"]) => void;
}): {
    type: T;
    callback: (event: Extract<IframeResponseEvent, { type: T }>["data"]) => void;
} {
    // TODO: we probably need to reverse the way this works, like in IframeListener, with a class exposing streams of observers
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    registeredCallbacks[callbackData.type] = callbackData.callback;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return callbackData;
}
