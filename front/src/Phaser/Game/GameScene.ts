import {GameManager, gameManager, HasMovedEvent, MapObject, StatusGameManagerEnum} from "./GameManager";
import {
    GroupCreatedUpdatedMessageInterface,
    MessageUserJoined,
    MessageUserMovedInterface,
    MessageUserPositionInterface
} from "../../Connexion";
import {CurrentGamerInterface, GamerInterface, hasMovedEventName, Player} from "../Player/Player";
import { DEBUG_MODE, RESOLUTION, ROOM, ZOOM_LEVEL} from "../../Enum/EnvironmentVariable";
import {ITiledMap, ITiledMapLayer, ITiledTileSet} from "../Map/ITiledMap";
import {PLAYER_RESOURCES} from "../Entity/PlayableCaracter";
import Texture = Phaser.Textures.Texture;
import Sprite = Phaser.GameObjects.Sprite;
import CanvasTexture = Phaser.Textures.CanvasTexture;
import {AddPlayerInterface} from "./AddPlayerInterface";

export enum Textures {
    Player = "male1"
}

export class GameScene extends Phaser.Scene {
    GameManager : GameManager;
    Terrains : Array<Phaser.Tilemaps.Tileset>;
    CurrentPlayer: CurrentGamerInterface;
    MapPlayers : Phaser.Physics.Arcade.Group;
    MapPlayersByKey : Map<string, GamerInterface> = new Map<string, GamerInterface>();
    Map: Phaser.Tilemaps.Tilemap;
    Layers : Array<Phaser.Tilemaps.StaticTilemapLayer>;
    Objects : Array<Phaser.Physics.Arcade.Sprite>;
    map: ITiledMap;
    groups: Map<string, Sprite>;
    startX = 704;// 22 case
    startY = 32; // 1 case
    circleTexture: CanvasTexture;

    MapKey: string;
    MapUrlFile: string;

    PositionNextScene: Array<any> = new Array<any>();

    constructor(MapKey : string = "", MapUrlFile: string = "") {
        super({
            key: MapKey
        });

        this.GameManager = gameManager;
        this.Terrains = [];
        this.groups = new Map<string, Sprite>();

        this.MapKey =  MapKey;
        this.MapUrlFile = MapUrlFile;
    }

    //hook preload scene
    preload(): void {
        this.GameManager.setCurrentGameScene(this);
        this.load.on('filecomplete-tilemapJSON-'+this.MapKey, (key: string, type: string, data: any) => {
            // Triggered when the map is loaded
            // Load tiles attached to the map recursively
            this.map = data.data;
            let url = this.MapUrlFile.substr(0, this.MapUrlFile.lastIndexOf('/'));
            this.map.tilesets.forEach((tileset) => {
                if (typeof tileset.name === 'undefined' || typeof tileset.image === 'undefined') {
                    console.warn("Don't know how to handle tileset ", tileset)
                    return;
                }
                //TODO strategy to add access token
                this.load.image(tileset.name, `${url}/${tileset.image}`);
            })
        });
        //TODO strategy to add access token
        this.load.tilemapTiledJSON(this.MapKey, this.MapUrlFile);

        //add player png
        PLAYER_RESOURCES.forEach((playerResource: any) => {
            this.load.spritesheet(
                playerResource.name,
                playerResource.img,
                {frameWidth: 32, frameHeight: 32}
            );
        });

        this.load.bitmapFont('main_font', 'resources/fonts/arcade.png', 'resources/fonts/arcade.xml');
    }

    //hook initialisation
    init() {}

    //hook create scene
    create(): void {
        //initalise map
        this.Map = this.add.tilemap(this.MapKey);
        this.map.tilesets.forEach((tileset: ITiledTileSet) => {
            this.Terrains.push(this.Map.addTilesetImage(tileset.name, tileset.name));
        });

        //permit to set bound collision
        this.physics.world.setBounds(0,0, this.Map.widthInPixels, this.Map.heightInPixels);

        //add layer on map
        this.Layers = new Array<Phaser.Tilemaps.StaticTilemapLayer>();
        let depth = -2;
        this.map.layers.forEach((layer : ITiledMapLayer) => {
            if (layer.type === 'tilelayer') {
                this.addLayer(this.Map.createStaticLayer(layer.name, this.Terrains, 0, 0).setDepth(depth));
            }
            if (layer.type === 'tilelayer' && this.getExitSceneUrl(layer) !== undefined) {
                this.loadNextGame(layer, this.map.width, this.map.tilewidth, this.map.tileheight);
            }
            if (layer.type === 'tilelayer' && layer.name === "start") {
                this.startUser(layer);
            }
            if (layer.type === 'objectgroup' && layer.name === 'floorLayer') {
                depth = 10000;
            }
        });

        if (depth === -2) {
            throw new Error('Your map MUST contain a layer of type "objectgroup" whose name is "floorLayer" that represents the layer characters are drawn at.');
        }

        //add entities
        this.Objects = new Array<Phaser.Physics.Arcade.Sprite>();

        //init event click
        this.EventToClickOnTile();

        //initialise list of other player
        this.MapPlayers = this.physics.add.group({ immovable: true });

        //notify game manager can to create currentUser in map
        this.GameManager.createCurrentPlayer();

        //initialise camera
        this.initCamera();


        // Let's generate the circle for the group delimiter
        let circleElement = Object.values(this.textures.list).find((object: Texture) => object.key === 'circleSprite');
        if(circleElement) {
            this.textures.remove('circleSprite');
        }
        this.circleTexture = this.textures.createCanvas('circleSprite', 96, 96);
        let context = this.circleTexture.context;
        context.beginPath();
        context.arc(48, 48, 48, 0, 2 * Math.PI, false);
        // context.lineWidth = 5;
        context.strokeStyle = '#ffffff';
        context.stroke();
        this.circleTexture.refresh();

        // Let's alter browser history
        let url = new URL(this.MapUrlFile);
        let path = '/_/'+url.host+url.pathname;
        if (url.hash) {
            // FIXME: entry should be dictated by a property passed to init()
            path += '#'+url.hash;
        }
        window.history.pushState({}, null, path);
    }

    private getExitSceneUrl(layer: ITiledMapLayer): string|undefined {
        let properties : any = layer.properties;
        if (!properties) {
            return undefined;
        }
        let obj = properties.find((property:any) => property.name === "exitSceneUrl");
        if (obj === undefined) {
            return undefined;
        }
        return obj.value;
    }

    /**
     *
     * @param layer
     * @param mapWidth
     * @param tileWidth
     * @param tileHeight
     */
    private loadNextGame(layer: ITiledMapLayer, mapWidth: number, tileWidth: number, tileHeight: number){
        let exitSceneUrl = this.getExitSceneUrl(layer);

        // TODO: eventually compute a relative URL
        let absoluteExitSceneUrl = new URL(exitSceneUrl, this.MapUrlFile).href;
        let exitSceneKey = gameManager.loadMap(absoluteExitSceneUrl, this.scene);

        let tiles : any = layer.data;
        tiles.forEach((objectKey : number, key: number) => {
            if(objectKey === 0){
                return;
            }
            //key + 1 because the start x = 0;
            let y : number = parseInt(((key + 1) / mapWidth).toString());
            let x : number = key - (y * mapWidth);
            //push and save switching case
            // TODO: this is not efficient. We should refactor that to enable a search by key. For instance: this.PositionNextScene[y][x] = exitSceneKey
            this.PositionNextScene.push({
                xStart: (x * tileWidth),
                yStart: (y * tileWidth),
                xEnd: ((x +1) * tileHeight),
                yEnd: ((y + 1) * tileHeight),
                key: exitSceneKey
            })
        });
    }

    /**
     * @param layer
     */
    private startUser(layer: ITiledMapLayer){
        let tiles : any = layer.data;
        tiles.forEach((objectKey : number, key: number) => {
            if(objectKey === 0){
                return;
            }
            let y = Math.floor(key / layer.width);
            let x = key % layer.width;

            this.startX = (x * 32);
            this.startY = (y * 32);
        });
    }

    //todo: in a dedicated class/function?
    initCamera() {
        this.cameras.main.setBounds(0,0, this.Map.widthInPixels, this.Map.heightInPixels);
        this.cameras.main.startFollow(this.CurrentPlayer);
        this.cameras.main.setZoom(ZOOM_LEVEL);
    }

    addLayer(Layer : Phaser.Tilemaps.StaticTilemapLayer){
        this.Layers.push(Layer);
    }

    createCollisionWithPlayer() {
        //add collision layer
        this.Layers.forEach((Layer: Phaser.Tilemaps.StaticTilemapLayer) => {
            this.physics.add.collider(this.CurrentPlayer, Layer, (object1: any, object2: any) => {
                //this.CurrentPlayer.say("Collision with layer : "+ (object2 as Tile).layer.name)
            });
            Layer.setCollisionByProperty({collides: true});
            if (DEBUG_MODE) {
                //debug code to see the collision hitbox of the object in the top layer
                Layer.renderDebug(this.add.graphics(), {
                    tileColor: null, //non-colliding tiles
                    collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200), // Colliding tiles,
                    faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Colliding face edges
                });
            }
        });
    }

    addSpite(Object : Phaser.Physics.Arcade.Sprite){
        Object.setImmovable(true);
        this.Objects.push(Object);
    }

    createCollisionObject(){
        this.Objects.forEach((Object : Phaser.Physics.Arcade.Sprite) => {
            this.physics.add.collider(this.CurrentPlayer, Object, (object1: any, object2: any) => {
                //this.CurrentPlayer.say("Collision with object : " + (object2 as Phaser.Physics.Arcade.Sprite).texture.key)
            });
        })
    }

    createCurrentPlayer(){
        //initialise player
        //TODO create animation moving between exit and strat
        this.CurrentPlayer = new Player(
            null, // The current player is not has no id (because the id can change if connexion is lost and we should check that id using the GameManager.
            this,
            this.startX,
            this.startY,
            this.GameManager.getPlayerName(),
            this.GameManager.getCharacterSelected()
        );
        this.CurrentPlayer.initAnimation();

        //create collision
        this.createCollisionWithPlayer();
        this.createCollisionObject();

        //join room
        this.GameManager.joinRoom(this.scene.key);

        //listen event to share position of user
        this.CurrentPlayer.on(hasMovedEventName, this.pushPlayerPosition.bind(this))
    }

    pushPlayerPosition(event: HasMovedEvent) {
        this.GameManager.pushPlayerPosition(event);
    }

    EventToClickOnTile(){
        // debug code to get a tile properties by clicking on it
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer)=>{
            //pixel position toz tile position
            let tile = this.Map.getTileAt(this.Map.worldToTileX(pointer.worldX), this.Map.worldToTileY(pointer.worldY));
            if(tile){
                this.CurrentPlayer.say("Your touch " + tile.layer.name);
            }
        });
    }

    /**
     * @param time
     * @param delta The delta time in ms since the last frame. This is a smoothed and capped value based on the FPS rate.
     */
    update(time: number, delta: number) : void {
        this.CurrentPlayer.moveUser(delta);
        let nextSceneKey = this.checkToExit();
        if(nextSceneKey){
            this.scene.start(nextSceneKey.key);
        }
    }

    /**
     *
     */
    checkToExit(){
        if(this.PositionNextScene.length === 0){
            return null;
        }
        return this.PositionNextScene.find((position : any) => {
            return position.xStart <= this.CurrentPlayer.x && this.CurrentPlayer.x <= position.xEnd
            && position.yStart <= this.CurrentPlayer.y && this.CurrentPlayer.y <= position.yEnd
        })
    }

    /**
     * Share position in scene
     * @param UsersPosition
     * @deprecated
     */
    shareUserPosition(UsersPosition : Array<MessageUserPositionInterface>): void {
        this.updateOrCreateMapPlayer(UsersPosition);
    }

    /**
     * Create new player and clean the player on the map
     * @param UsersPosition
     */
    updateOrCreateMapPlayer(UsersPosition : Array<MessageUserPositionInterface>){
        if(!this.CurrentPlayer){
            return;
        }

        let currentPlayerId = this.GameManager.getPlayerId();

        //add or create new user
        UsersPosition.forEach((userPosition : MessageUserPositionInterface) => {
            if(userPosition.userId === currentPlayerId){
                return;
            }
            let player = this.findPlayerInMap(userPosition.userId);
            if(!player){
                this.addPlayer(userPosition);
            }else{
                player.updatePosition(userPosition.position);
            }
        });

        //clean map
        this.MapPlayers.getChildren().forEach((player: GamerInterface) => {
            if(UsersPosition.find((message : MessageUserPositionInterface) => message.userId === player.userId)){
                return;
            }
            player.destroy();
            this.MapPlayers.remove(player);
        });
    }

    public initUsersPosition(usersPosition: MessageUserPositionInterface[]): void {
        if(!this.CurrentPlayer){
            console.error('Cannot initiate users list because map is not loaded yet')
            return;
        }

        let currentPlayerId = this.GameManager.getPlayerId();

        // clean map
        this.MapPlayersByKey.forEach((player: GamerInterface) => {
            player.destroy();
            this.MapPlayers.remove(player);
        });
        this.MapPlayersByKey = new Map<string, GamerInterface>();

        // load map
        usersPosition.forEach((userPosition : MessageUserPositionInterface) => {
            if(userPosition.userId === currentPlayerId){
                return;
            }
            this.addPlayer(userPosition);
            console.log("Added player ", userPosition)
        });

        console.log("Initialized with ", usersPosition);
    }

    private findPlayerInMap(UserId : string) : GamerInterface | null{
        return this.MapPlayersByKey.get(UserId);
        /*let player = this.MapPlayers.getChildren().find((player: Player) => UserId === player.userId);
        if(!player){
            return null;
        }
        return (player as GamerInterface);*/
    }

    /**
     * Create new player
     */
    public addPlayer(addPlayerData : AddPlayerInterface) : void{
        //initialise player
        let player = new Player(
            addPlayerData.userId,
            this,
            addPlayerData.position.x,
            addPlayerData.position.y,
            addPlayerData.name,
            addPlayerData.character
        );
        player.initAnimation();
        this.MapPlayers.add(player);
        this.MapPlayersByKey.set(player.userId, player);
        player.updatePosition(addPlayerData.position);

        //init collision
        /*this.physics.add.collider(this.CurrentPlayer, player, (CurrentPlayer: CurrentGamerInterface, MapPlayer: GamerInterface) => {
            CurrentPlayer.say("Hello, how are you ? ");
        });*/
    }

    public removePlayer(userId: string) {
        let player = this.MapPlayersByKey.get(userId);
        if (player === undefined) {
            console.error('Cannot find user with id ', userId);
        }
        player.destroy();
        this.MapPlayers.remove(player);
        this.MapPlayersByKey.delete(userId);
    }

    updatePlayerPosition(message: MessageUserMovedInterface): void {
        let player : GamerInterface | undefined = this.MapPlayersByKey.get(message.userId);
        if (player === undefined) {
            throw new Error('Cannot find player with ID "' + message.userId +'"');
        }
        player.updatePosition(message.position);
    }

    shareGroupPosition(groupPositionMessage: GroupCreatedUpdatedMessageInterface) {
        let groupId = groupPositionMessage.groupId;

        if (this.groups.has(groupId)) {
            this.groups.get(groupId).setPosition(Math.round(groupPositionMessage.position.x), Math.round(groupPositionMessage.position.y));
        } else {
            // TODO: circle radius should not be hard stored
            let sprite = new Sprite(
                this,
                Math.round(groupPositionMessage.position.x),
                Math.round(groupPositionMessage.position.y),
                'circleSprite');
            sprite.setDisplayOrigin(48, 48);
            this.add.existing(sprite);
            this.groups.set(groupId, sprite);
        }
    }

    deleteGroup(groupId: string): void {
        if(!this.groups.get(groupId)){
            return;
        }
        this.groups.get(groupId).destroy();
        this.groups.delete(groupId);
    }
}
