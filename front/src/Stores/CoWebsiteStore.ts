import { derived, writable } from "svelte/store";
import type { CoWebsite } from "../WebRtc/CoWebsite/CoWesbite";

function createCoWebsiteStore() {
    const { subscribe, set, update } = writable(Array<CoWebsite>());

    set(Array<CoWebsite>());

    return {
        subscribe,
        add: (coWebsite: CoWebsite, position?: number) => {
            coWebsite.getStateSubscriber().subscribe((value) => {
                update((currentArray) => currentArray);
            });

            if (position || position === 0) {
                update((currentArray) => {
                    if (position === 0) {
                        return [coWebsite, ...currentArray];
                    } else if (currentArray.length > position) {
                        const test = [...currentArray.splice(position, 0, coWebsite)];
                        return [...currentArray.splice(position, 0, coWebsite)];
                    }

                    return [...currentArray, coWebsite];
                });
                return;
            }

            update((currentArray) => [...currentArray, coWebsite]);
        },
        remove: (coWebsite: CoWebsite) => {
            update((currentArray) => [
                ...currentArray.filter((currentCoWebsite) => currentCoWebsite.getId() !== coWebsite.getId()),
            ]);
        },
        empty: () => {
            set(Array<CoWebsite>());
        },
    };
}

export const coWebsites = createCoWebsiteStore();

export const coWebsitesNotAsleep = derived([coWebsites], ([$coWebsites]) =>
    $coWebsites.filter((coWebsite) => coWebsite.getState() !== "asleep")
);

export const mainCoWebsite = derived([coWebsites], ([$coWebsites]) =>
    $coWebsites.find((coWebsite) => coWebsite.getState() !== "asleep")
);
