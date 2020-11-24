import {Room} from "../Connexion/Room";

export enum GameConnexionTypes {
    anonymous=1,
    organization,
    register,
    empty,
    unknown,
}

//this class is responsible with analysing and editing the game's url
class UrlManager {

    //todo: use that to detect if we can find a token in localstorage
    public getGameConnexionType(): GameConnexionTypes {
        const url = window.location.pathname.toString();
        if (url.includes('_/')) {
            return GameConnexionTypes.anonymous;
        } else if (url.includes('@/')) {
            return GameConnexionTypes.organization;
        } else if(url.includes('register/')) {
            return GameConnexionTypes.register;
        } else if(url === '/') {
            return GameConnexionTypes.empty;
        } else {
            return GameConnexionTypes.unknown;
        }
    }

    public getOrganizationToken(): string|null {
        const match = /\/register\/(.+)/.exec(window.location.pathname.toString());
        return match ? match [1] : null;
    }


    //todo: simply use the roomId
    //todo: test this with cypress
    public editUrlForRoom(roomSlug: string, organizationSlug: string|null, worldSlug: string |null): string {
        let  newUrl:string;
        if (organizationSlug) {
            newUrl = '/@/'+organizationSlug+'/'+worldSlug+'/'+roomSlug;
        } else {
            newUrl = '/_/global/'+roomSlug;
        }
        history.pushState({}, 'WorkAdventure', newUrl);
        return newUrl;
    }
    
    //todo: is it duplicated with editUrlForRoom() ?
    public editUrlForCurrentRoom(room: Room): void {
        let path = room.id;
        if (room.hash) {
            path += '#'+room.hash;
        }
        history.pushState({}, 'WorkAdventure', path);
    }

}

export const urlManager = new UrlManager();
