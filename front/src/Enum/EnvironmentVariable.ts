const DEBUG_MODE: boolean = !!process.env.DEBUG_MODE || false;
const API_URL = process.env.API_URL || "http://api.workadventure.localhost";
const ROOM = [process.env.ROOM || "THECODINGMACHINE"];
const RESOLUTION = 4;
const ZOOM_LEVEL = 1/*3/4*/;

export {
    DEBUG_MODE,
    API_URL,
    RESOLUTION,
    ZOOM_LEVEL,
    ROOM
}
