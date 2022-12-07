import * as grpc from "@grpc/grpc-js";
import express from "express";
import cors from "cors";
import { mapStorageServer } from "./MapStorageServer";
import { mapsManager } from "./MapsManager";
import { MapStorageService } from "@workadventure/messages/src/ts-proto-generated/services";

const server = new grpc.Server();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
server.addService(MapStorageService, mapStorageServer);

server.bindAsync(`0.0.0.0:50053`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        throw err;
    }
    console.log("Application is running");
    console.log("gRPC port is 50053");
    server.start();
});

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.get("/maps/*.json", async (req, res) => {
    res.send(await mapsManager.getMap(req.url));
});

app.get("/entityCollections/*", async (req, res) => {
    const url = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
    const collectionName = decodeURI(url.pathname).split("/").pop() ?? "";
    const collection = mapsManager.getEntityCollection(collectionName);
    if (collection) {
        res.send(collection);
    } else {
        res.send(`COULD NOT FIND COLLECTION: ${collectionName}`);
    }
});

app.get("/entityCollections", async (req, res) => {
    res.send({
        collections: mapsManager.getEntityCollectionsNames(),
    });
});

app.use(express.static("public"));

app.listen(3000, () => {
    console.log("Application is running on port 3000");
});
