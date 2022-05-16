import { get, writable } from "svelte/store";
import type { Box } from "../WebRtc/LayoutManager";
import { HtmlUtils } from "../WebRtc/HtmlUtils";
import { highlightedEmbedScreen } from "./EmbedScreensStore";

/**
 * Tries to find the biggest available box of remaining space (this is a space where we can center the character)
 */
function findBiggestAvailableArea(): Box {
    const game = HtmlUtils.querySelectorOrFail<HTMLCanvasElement>("#game canvas");
    const wholeScreenBox = {
        xStart: 0,
        yStart: 0,
        xEnd: game.offsetWidth,
        yEnd: game.offsetHeight,
    };

    const blockers: Box[] = [];

    const screenOnTop = get(highlightedEmbedScreen)?.embed;
    if (screenOnTop) {
        //@ts-ignore
        const iframe = screenOnTop.iframe;
        if (iframe) {
            blockers.push({
                xStart: iframe.offsetLeft,
                yStart: iframe.offsetTop,
                xEnd: iframe.offsetWidth,
                yEnd: iframe.offsetHeight,
            });
        } else {
            //@ts-ignore
            const remoteStream = screenOnTop.remoteStream;
            const videoElements = Array.from(document.getElementsByTagName("video"));
            if (remoteStream && videoElements.length > 0) {
                //@ts-ignore
                const video = videoElements.find((video) => video.srcObject?.id === remoteStream.id);
                if (video) {
                    const bounds = video.getBoundingClientRect();
                    blockers.push({
                        xStart: bounds.x,
                        yStart: bounds.y,
                        xEnd: bounds.right,
                        yEnd: bounds.bottom,
                    });
                }
            }
        }
    }

    if (blockers.length === 0) {
        return wholeScreenBox;
    }

    // create vertices arrays and insert game canvas edges
    const verticesX = [game.offsetLeft, game.offsetWidth];
    const verticesY = [game.offsetTop, game.offsetHeight];

    // populate with all vertices
    for (const blocker of blockers) {
        verticesX.push(blocker.xStart, blocker.xEnd);
        verticesY.push(blocker.yStart, blocker.yEnd);
    }
    verticesX.sort((a, b) => a - b);
    verticesY.sort((a, b) => a - b);

    // NOTE: cannot use fill() here, it makes references to a single array
    const occupiedGrid: boolean[][] = new Array(verticesY.length - 1);
    for (let j = 0; j < verticesY.length - 1; j += 1) {
        occupiedGrid[j] = new Array(verticesX.length - 1).fill(false);
    }

    for (const blocker of blockers) {
        const [left, top] = getGridCoordinates(blocker.xStart, blocker.yStart, verticesX, verticesY);
        const [right, bottom] = getGridCoordinates(blocker.xEnd, blocker.yEnd, verticesX, verticesY);
        for (let j = top; j < bottom; j += 1) {
            for (let i = left; i < right; i += 1) {
                occupiedGrid[j][i] = true;
            }
        }
    }

    // create an array of all free boxes
    const freeBoxes: Box[] = [];
    for (let x = 0; x < occupiedGrid.length; x += 1) {
        for (let y = 0; y < occupiedGrid[x].length; y += 1) {
            freeBoxes.push(...findAllFreeBoxes(x, y, occupiedGrid));
        }
    }

    let biggestArea = 0;
    let biggestBox = wholeScreenBox;
    for (const box of freeBoxes) {
        const area = getBoxArea(box, verticesX, verticesY);
        if (area > biggestArea) {
            biggestArea = area;
            biggestBox = box;
        }
    }

    return {
        xStart: verticesX[biggestBox.xStart],
        yStart: verticesY[biggestBox.yStart],
        xEnd: verticesX[biggestBox.xEnd + 1],
        yEnd: verticesY[biggestBox.yEnd + 1],
    };
}

export function getBoxArea(box: Box, xVertices: number[], yVertices: number[]): number {
    const width = xVertices[box.xEnd + 1] - xVertices[box.xStart];
    const height = yVertices[box.yEnd + 1] - yVertices[box.yStart];
    return width * height;
}

/**
 * A store that contains the list of (video) peers we are connected to.
 */
function createBiggestAvailableAreaStore() {
    const { subscribe, set } = writable<Box>({ xStart: 0, yStart: 0, xEnd: 1, yEnd: 1 });

    return {
        subscribe,
        recompute: () => {
            set(findBiggestAvailableArea());
        },
    };
}

export function findAllFreeBoxes(left: number, top: number, grid: boolean[][]): Box[] {
    if (grid.length === 0) {
        return [];
    }
    if (grid[0].length === 0) {
        return [];
    }
    if (grid[top][left] === true) {
        return [];
    }

    const boxes: Box[] = [];

    // we expect grid rows to be of the same length
    let xEnd = grid[0].length;

    for (let y = top; y < grid.length; y += 1) {
        for (let x = left; x < xEnd; x += 1) {
            // do not add boxes with occupied parts
            if (grid[y][x] === true) {
                // no point in trying to find free box after this column
                xEnd = x;
                break;
            }
            boxes.push({ xStart: left, yStart: top, xEnd: x, yEnd: y });
        }
    }

    return boxes;
}

export function getGridCoordinates(x: number, y: number, verticesX: number[], verticesY: number[]): [number, number] {
    return [verticesX.findIndex((vertexX) => vertexX === x), verticesY.findIndex((vertexY) => vertexY === y)];
}

export const biggestAvailableAreaStore = createBiggestAvailableAreaStore();
