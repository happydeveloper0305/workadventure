import * as tg from "generic-type-guard";

/*
 * WARNING! The original file is in /messages/JsonMessages.
 * All other files are automatically copied from this file on container startup / build
 */

export const isAdminApiData = new tg.IsInterface()
    .withProperties({
        userUuid: tg.isString,
        email: tg.isNullable(tg.isString),
        roomUrl: tg.isString,
        mapUrlStart: tg.isString,
    })
    .withOptionalProperties({
        messages: tg.isArray(tg.isUnknown),
    })
    .get();
export type AdminApiData = tg.GuardedType<typeof isAdminApiData>;
