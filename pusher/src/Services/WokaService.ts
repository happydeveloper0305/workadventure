import { ADMIN_API_URL } from "../Enum/EnvironmentVariable";
import { adminWokaService } from "./AdminWokaService";
import { localWokaService } from "./LocalWokaService";

export const wokaService = ADMIN_API_URL ? adminWokaService : localWokaService;
