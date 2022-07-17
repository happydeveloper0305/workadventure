/// <reference path="../../node_modules/@workadventure/iframe-api-typings/iframe_api.d.ts" />

import {Frame, Page} from "@playwright/test";
import {ElementHandle, JSHandle} from "playwright-core";

// Types copied from "playwright-core" because they are not exposed.
type NoHandles<Arg> = Arg extends JSHandle ? never : (Arg extends object ? { [Key in keyof Arg]: NoHandles<Arg[Key]> } : Arg);
type Unboxed<Arg> =
    Arg extends ElementHandle<infer T> ? T :
        Arg extends JSHandle<infer T> ? T :
            Arg extends NoHandles<Arg> ? Arg :
                Arg extends [infer A0] ? [Unboxed<A0>] :
                    Arg extends [infer A0, infer A1] ? [Unboxed<A0>, Unboxed<A1>] :
                        Arg extends [infer A0, infer A1, infer A2] ? [Unboxed<A0>, Unboxed<A1>, Unboxed<A2>] :
                            Arg extends [infer A0, infer A1, infer A2, infer A3] ? [Unboxed<A0>, Unboxed<A1>, Unboxed<A2>, Unboxed<A3>] :
                                Arg extends Array<infer T> ? Array<Unboxed<T>> :
                                    Arg extends object ? { [Key in keyof Arg]: Unboxed<Arg[Key]> } :
                                        Arg;

export type PageFunction<Arg, R> = ((arg: Unboxed<Arg>) => R | Promise<R>);


/**
 * Evaluate the function in the context of a scripting iframe.
 *
 * Usage is similar to the evaluate method in Playwright. See: https://playwright.dev/docs/evaluating
 */
export async function evaluateScript<R, Arg>(page: Page, pageFunction: PageFunction<Arg, R>, arg?: Arg, title?: string): Promise<R> {
    const frame = await getScriptFrame(page, title ?? "");

    // Let's wait for WA object to be available.
    /*await frame.evaluate(async () => {
        function later(delay) {
            return new Promise(function(resolve) {
                setTimeout(resolve, delay);
            });
        }

        for (let i = 0; i < 50; i++) {
            if (WA) {
                break;
            }
            await later(100);
        }
        if (WA === undefined) {
            throw new Error("Could not find WA object");
        }
    });*/

    return (await getScriptFrame(page, title ?? "")).evaluate<R, Arg>(pageFunction, arg);
}

export async function getScriptFrame(page: Page, title: string) : Promise<Frame> {
    let frame: Frame | undefined;
    let i = 0;
    do {
        frame = await getFrameWithTitle(page, title);
        if (frame) {
            break;
        }
        i++;
        await page.waitForTimeout(100);
    } while (i < 50);

    if (!frame) {
        throw new Error("Unable to find the script frame. Is there one defined on the map?");
    }

    return frame;
}

async function getFrameWithTitle(page: Page, searchedTitle: string) : Promise<Frame | undefined> {
    for (const frame of page.frames()) {
        const title = await frame.title();
        if (title === searchedTitle) {
            return frame;
        }
    }
    return undefined;
}
