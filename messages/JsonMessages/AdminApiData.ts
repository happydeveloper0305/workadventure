import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";

/*
 * WARNING! The original file is in /messages/JsonMessages.
 * All other files are automatically copied from this file on container startup / build
 */

export const isAdminApiData = z.object({
    // @ts-ignore
    userUuid: extendApi(z.string(), { example: "998ce839-3dea-4698-8b41-ebbdf7688ad9" }),
    email: extendApi(z.nullable(z.string()), {
        description: "The email of the current user.",
        example: "example@workadventu.re",
    }),
    roomUrl: extendApi(z.string(), { example: "/@/teamSlug/worldSlug/roomSlug" }),
    mapUrlStart: extendApi(z.string(), {
        description: "The full URL to the JSON map file",
        example: "https://myuser.github.io/myrepo/map.json",
    }),
    messages: z.optional(z.array(z.unknown())),
});

export type AdminApiData = z.infer<typeof isAdminApiData>;
