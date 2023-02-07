//import { getEnvConfig } from "@geprog/vite-plugin-env-config/getEnvConfig";
import type { FrontConfigurationInterface } from "../../common/FrontConfigurationInterface";

declare global {
    interface Window {
        env: FrontConfigurationInterface;
    }
}

const env = window.env;
export const DEBUG_MODE = env.DEBUG_MODE;
export const PUSHER_URL = env.PUSHER_URL;
export const ADMIN_URL = env.ADMIN_URL;
export const UPLOADER_URL = env.UPLOADER_URL;
export const ICON_URL = env.ICON_URL;
export const STUN_SERVER = env.STUN_SERVER;
export const TURN_SERVER = env.TURN_SERVER;
export const SKIP_RENDER_OPTIMIZATIONS = env.SKIP_RENDER_OPTIMIZATIONS;
export const DISABLE_NOTIFICATIONS = env.DISABLE_NOTIFICATIONS;
export const TURN_USER = env.TURN_USER;
export const TURN_PASSWORD = env.TURN_PASSWORD;
export const JITSI_URL = env.JITSI_URL;
export const JITSI_PRIVATE_MODE = env.JITSI_PRIVATE_MODE;
export const ENABLE_FEATURE_MAP_EDITOR = env.ENABLE_FEATURE_MAP_EDITOR;
export const ENABLE_MAP_EDITOR_AREAS_TOOL = env.ENABLE_MAP_EDITOR_AREAS_TOOL;
export const MAX_USERNAME_LENGTH = env.MAX_USERNAME_LENGTH;
export const MAX_PER_GROUP = env.MAX_PER_GROUP;
export const NODE_ENV = env.NODE_ENV;
export const CONTACT_URL = env.CONTACT_URL;
export const POSTHOG_API_KEY = env.POSTHOG_API_KEY;
export const POSTHOG_URL = env.POSTHOG_URL;
export const DISABLE_ANONYMOUS = env.DISABLE_ANONYMOUS;
export const ENABLE_OPENID = env.ENABLE_OPENID;
export const OPID_PROFILE_SCREEN_PROVIDER = env.OPID_PROFILE_SCREEN_PROVIDER;
export const OPID_LOGOUT_REDIRECT_URL = env.OPID_LOGOUT_REDIRECT_URL;
export const CHAT_URL = env.CHAT_URL;
export const ENABLE_CHAT_UPLOAD = env.ENABLE_CHAT_UPLOAD;
export const FALLBACK_LOCALE = env.FALLBACK_LOCALE;
export const OPID_WOKA_NAME_POLICY = env.OPID_WOKA_NAME_POLICY;
export const ENABLE_REPORT_ISSUES_MENU = env.ENABLE_REPORT_ISSUES_MENU;
export const REPORT_ISSUES_URL = env.REPORT_ISSUES_URL;

export const POSITION_DELAY = 200; // Wait 200ms between sending position events
export const MAX_EXTRAPOLATION_TIME = 100; // Extrapolate a maximum of 250ms if no new movement is sent by the player
