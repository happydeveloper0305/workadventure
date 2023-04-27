import type { FrontConfigurationInterface } from "../../common/FrontConfigurationInterface";
import { EnvironmentVariables } from "./EnvironmentVariableValidator";

const envChecking = EnvironmentVariables.safeParse(process.env);

// Will break the process if an error happens
if (!envChecking.success) {
    console.error("\n\n\n-----------------------------------------");
    console.error("FATAL ERRORS FOUND IN ENVIRONMENT VARIABLES!!!");
    console.error("-----------------------------------------\n");

    const formattedError = envChecking.error.format();

    for (const [name, value] of Object.entries(formattedError)) {
        if (Array.isArray(value)) {
            continue;
        }

        for (const error of value._errors) {
            console.error(`For variable "${name}": ${error}`);
        }
    }

    console.error("\n-----------------------------------------\n\n\n");

    process.exit(1);
}

const env = envChecking.data;

export const SECRET_KEY = env.SECRET_KEY;
export const API_URL = env.API_URL;
export const ADMIN_API_URL = env.ADMIN_API_URL;
export const ADMIN_API_RETRY_DELAY = parseInt(process.env.ADMIN_API_RETRY_DELAY || "500");
export const ADMIN_URL = env.ADMIN_URL;
export const ADMIN_API_TOKEN = env.ADMIN_API_TOKEN;
export const ADMIN_SOCKETS_TOKEN = env.ADMIN_SOCKETS_TOKEN;
export const CPU_OVERHEAT_THRESHOLD = env.CPU_OVERHEAT_THRESHOLD;
export const PUSHER_HTTP_PORT = env.PUSHER_HTTP_PORT;
export const SOCKET_IDLE_TIMER = env.SOCKET_IDLE_TIMER; // maximum time (in second) without activity before a socket is closed. Should be greater than 60 seconds in order to cope for Chrome intensive throttling (https://developer.chrome.com/blog/timer-throttling-in-chrome-88/#intensive-throttling)
export const VITE_URL = env.VITE_URL || "http://front.workadventure.localhost"; // Used only in development
export const ALLOWED_CORS_ORIGIN = env.ALLOWED_CORS_ORIGIN; // Use "*" to allow any domain
export const PUSHER_URL = env.PUSHER_URL || "";
export const PUBLIC_MAP_STORAGE_URL = env.PUBLIC_MAP_STORAGE_URL || "";
export const OPID_CLIENT_ID = env.OPID_CLIENT_ID || "";
export const OPID_CLIENT_SECRET = env.OPID_CLIENT_SECRET || "";
export const OPID_CLIENT_ISSUER = env.OPID_CLIENT_ISSUER || "";
if (OPID_CLIENT_ID && !PUSHER_URL) {
    throw new Error("Missing PUSHER_URL environment variable.");
}
export const OPID_CLIENT_REDIRECT_URL = PUSHER_URL + "/openid-callback";
export const OPID_PROFILE_SCREEN_PROVIDER =
    env.OPID_PROFILE_SCREEN_PROVIDER || (ADMIN_URL ? ADMIN_URL + "/profile" : undefined);
export const OPID_SCOPE = env.OPID_SCOPE || "openid email";
export const OPID_PROMPT = env.OPID_PROMPT || "login";
export const OPID_USERNAME_CLAIM = env.OPID_USERNAME_CLAIM || "username";
export const OPID_LOCALE_CLAIM = env.OPID_LOCALE_CLAIM || "locale";
export const OPID_WOKA_NAME_POLICY = env.OPID_WOKA_NAME_POLICY || "user_input";
export const DISABLE_ANONYMOUS: boolean = env.DISABLE_ANONYMOUS;
export const PROMETHEUS_AUTHORIZATION_TOKEN = env.PROMETHEUS_AUTHORIZATION_TOKEN;
export const EJABBERD_DOMAIN: string = env.EJABBERD_DOMAIN || "";
export const EJABBERD_JWT_SECRET: string = env.EJABBERD_JWT_SECRET || "";
export const ENABLE_CHAT: boolean = env.ENABLE_CHAT;
export const ENABLE_CHAT_UPLOAD: boolean = env.ENABLE_CHAT_UPLOAD;
export const ENABLE_CHAT_ONLINE_LIST: boolean = env.ENABLE_CHAT_ONLINE_LIST;
export const ENABLE_CHAT_DISCONNECTED_LIST: boolean = env.ENABLE_CHAT_DISCONNECTED_LIST;
export const DEBUG_ERROR_MESSAGES = env.DEBUG_ERROR_MESSAGES;

// If set to the string "true", the /openapi route will return the OpenAPI definition and the swagger-ui/ route will display the documentation
export const ENABLE_OPENAPI_ENDPOINT = env.ENABLE_OPENAPI_ENDPOINT;

// The URL to use if the user is visiting the first time and hitting the "/" route.
export const START_ROOM_URL: string = env.START_ROOM_URL || "/_/global/maps.workadventu.re/starter/map.json";
export const FALLBACK_LOCALE: string | undefined = env.FALLBACK_LOCALE;

// Logrocket id
export const LOGROCKET_ID: string | undefined = env.LOGROCKET_ID;

// RoomAPI
export const ROOM_API_PORT = env.ROOM_API_PORT;
export const ROOM_API_SECRET_KEY = env.ROOM_API_SECRET_KEY;

// Front container:
export const FRONT_ENVIRONMENT_VARIABLES: FrontConfigurationInterface = {
    DEBUG_MODE: env.DEBUG_MODE,
    PUSHER_URL,
    ADMIN_URL,
    UPLOADER_URL: env.UPLOADER_URL,
    ICON_URL: env.ICON_URL,
    STUN_SERVER: env.STUN_SERVER,
    TURN_SERVER: env.TURN_SERVER,
    SKIP_RENDER_OPTIMIZATIONS: env.SKIP_RENDER_OPTIMIZATIONS,
    DISABLE_NOTIFICATIONS: env.DISABLE_NOTIFICATIONS,
    TURN_USER: env.TURN_USER,
    TURN_PASSWORD: env.TURN_PASSWORD,
    JITSI_URL: env.JITSI_URL,
    JITSI_PRIVATE_MODE: env.JITSI_PRIVATE_MODE,
    ENABLE_FEATURE_MAP_EDITOR: env.ENABLE_FEATURE_MAP_EDITOR,
    ENABLE_MAP_EDITOR_AREAS_TOOL: env.ENABLE_MAP_EDITOR_AREAS_TOOL,
    MAX_USERNAME_LENGTH: env.MAX_USERNAME_LENGTH,
    MAX_PER_GROUP: env.MAX_PER_GROUP,
    NODE_ENV: env.NODE_ENV || "development",
    CONTACT_URL: env.CONTACT_URL,
    POSTHOG_API_KEY: env.POSTHOG_API_KEY,
    POSTHOG_URL: env.POSTHOG_URL,
    DISABLE_ANONYMOUS,
    ENABLE_OPENID: !!env.OPID_CLIENT_ID,
    OPID_PROFILE_SCREEN_PROVIDER: env.OPID_PROFILE_SCREEN_PROVIDER,
    OPID_LOGOUT_REDIRECT_URL: env.OPID_LOGOUT_REDIRECT_URL,
    CHAT_URL: env.CHAT_URL,
    ENABLE_CHAT_UPLOAD,
    FALLBACK_LOCALE,
    OPID_WOKA_NAME_POLICY,
    ENABLE_REPORT_ISSUES_MENU: env.ENABLE_REPORT_ISSUES_MENU,
    REPORT_ISSUES_URL: env.REPORT_ISSUES_URL,
};
