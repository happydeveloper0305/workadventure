import { parse } from "query-string";
import { openIDClient } from "../Services/OpenIDClient";
import { OPID_CLIENT_ISSUER } from "../Enum/EnvironmentVariable";
import { BaseHttpController } from "./BaseHttpController";

export class OpenIdProfileController extends BaseHttpController {
    routes() {
        //eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.app.get("/profile", async (req, res) => {
            const { accessToken } = parse(req.path_query);
            if (!accessToken) {
                throw Error("Access token expected cannot to be check on Hydra");
            }
            try {
                const resCheckTokenAuth = await openIDClient.checkTokenAuth(accessToken as string);
                if (!resCheckTokenAuth.email) {
                    throw new Error("Email was not found");
                }
                res.send(
                    this.buildHtml(
                        OPID_CLIENT_ISSUER,
                        resCheckTokenAuth.email as string,
                        resCheckTokenAuth.picture as string | undefined
                    )
                );
                return;
            } catch (error) {
                console.error("profileCallback => ERROR", error);
                this.castErrorToResponse(error, res);
            }
        });
    }

    buildHtml(domain: string, email: string, pictureUrl?: string) {
        return `
                <!DOCTYPE>
                <html>
                    <head>
                        <style>
                            *{
                                font-family: PixelFont-7, monospace;
                            }
                            body{
                                text-align: center;
                                color: white;
                            }
                            section{
                                margin: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <section>
                                <img src="${pictureUrl ? pictureUrl : "/images/profile"}">
                            </section>
                            <section>
                                Profile validated by domain: <span style="font-weight: bold">${domain}</span>
                            </section>
                            <section>
                                Your email: <span style="font-weight: bold">${email}</span>
                            </section>
                        </div>
                    </body>
                </html>
            `;
    }
}
