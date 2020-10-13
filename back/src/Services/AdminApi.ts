import {ADMIN_API_TOKEN, ADMIN_API_URL} from "../Enum/EnvironmentVariable";
import Axios from "axios";
import {RoomIdentifier} from "../Model/RoomIdentifier";

export interface AdminApiData {
    organizationSlug: string
    worldSlug: string
    roomSlug: string
    mapUrlStart: string
    userUuid: string
}

class AdminApi {

    async fetchMapDetails(organizationSlug: string, worldSlug: string, roomSlug: string|undefined): Promise<AdminApiData> {
        if (!ADMIN_API_URL) {
            return Promise.reject('No admin backoffice set!');
        }

        const params: { organizationSlug: string, worldSlug: string, mapSlug?: string } = {
            organizationSlug,
            worldSlug
        };

        if (roomSlug) {
            params.mapSlug = roomSlug;
        }

        const res = await Axios.get(ADMIN_API_URL+'/api/map',
            {
                headers: {"Authorization" : `${ADMIN_API_TOKEN}`},
                params
            }
        )
        return res.data;
    }

    async fetchMemberDataByToken(organizationMemberToken: string): Promise<AdminApiData> {
        if (!ADMIN_API_URL) {
            return Promise.reject('No admin backoffice set!');
        }
        //todo: this call can fail if the corresponding world is not activated or if the token is invalid. Handle that case.
        const res = await Axios.get(ADMIN_API_URL+'/api/login-url/'+organizationMemberToken,
            { headers: {"Authorization" : `${ADMIN_API_TOKEN}`} }
        )
        return res.data;
    }

    async memberIsGrantedAccessToRoom(memberId: string, roomIdentifier: RoomIdentifier): Promise<boolean> {
        if (!ADMIN_API_URL) {
            return Promise.reject('No admin backoffice set!');
        }
        try {
            //todo: send more specialized data instead of the whole id
            const res = await Axios.get(ADMIN_API_URL+'/api/member/is-granted-access',
                { headers: {"Authorization" : `${ADMIN_API_TOKEN}`}, params: {memberId, roomIdentifier: roomIdentifier.id} }
            )
            return !!res.data;
        } catch (e) {
            console.log(e.message)
            return false;
        }
    }
}

export const adminApi = new AdminApi();
