{.section-title.accent.text-primary}
# Variables

WorkAdventure offers several options for storing data. In WorkAdventure as in many programming languages, data
is stored in variables.

There are 2 kind of variables:

- **Room variables**: they are associated with a room and shared by all the players
- **Player variables**: they are attached to a given player

In the rest of this documentation, when we speak of "variables" without specifying the type, we refer to "room variables".

## Room variables

Rooms can contain **variables**. Variables are piece of information that store some data. In computer science, we like
to say variables are storing the "state" of the room.

- Variables are shared amongst all players in a given room. When the value of a variable changes for one player, it changes
  for everyone.
- Variables are **invisible**. There are plenty of ways they can act on the room, but by default, you don't see them.

## Declaring a room variable

In order to declare allowed variables in a room, you need to add **objects** in an "object layer" of the map.

Each object will represent a variable.

<div class="row">
    <div class="col">
        <img src="images/object_variable.png" class="figure-img img-fluid rounded" alt="" />
    </div>
</div>

The name of the variable is the name of the object.
The object **class** MUST be **variable**.

You can set a default value for the object in the `default` property.

## Persisting room variables state

Use the `persist` property to save the state of the variable in database. If `persist` is false, the variable will stay
in the memory of the WorkAdventure servers but will be wiped out of the memory as soon as the room is empty (or if the
server restarts).

{.alert.alert-info}
Do not use `persist` for highly dynamic values that have a short life spawn.

## Managing access rights to room variables

With `readableBy` and `writableBy`, you control who can read of write in this variable. The property accepts a string
representing a "tag". Anyone having this "tag" can read/write in the variable.

{.alert.alert-warning}
`readableBy` and `writableBy` are specific to the "online" version of WorkAdventure because the notion of tags
is not available unless you have an "admin" server (that is not part of the self-hosted version of WorkAdventure).

In a future release, the `jsonSchema` property will contain [a complete JSON schema](https://json-schema.org/) to validate the content of the variable.
Trying to set a variable to a value that is not compatible with the schema will fail.

## Using room variables

There are plenty of ways to use variables in WorkAdventure:

- Using the [scripting API](api-state.md), you can read, edit or track the content of variables.
- Using the [Action zones](https://workadventu.re/map-building-extra/generic-action-zones.md), you can set the value of a variable when someone is entering or leaving a zone
- By [binding variable values to properties in the map](https://workadventu.re/map-building-extra/variable-to-property-binding.md)
- By [using automatically generated configuration screens](https://workadventu.re/map-building-extra/automatic-configuration.md) to create forms to edit the value of variables

In general, variables can be used by third party libraries that you can embed in your map to add extra features.
A good example of such a library is the ["Scripting API Extra" library](https://workadventu.re/map-building-extra/about.md)

## Player variables

Player variables are attached to players. Those variables are created using the scripting API.

Here are a few examples of things that could be stored as player variables:

- The score of a mini-game
- A list of inventory items (you can use the scripting API to build a custom inventory item in your map and use player
  variables to store this inventory
- A vote in a live voting system 

They can be "public" or "private".

- Public variables are visible to nearby players in the same room (using the scripting API)
- Private variables are only visible to the player itself

Use [`WA.player.state`](api-player.md#player-specific-variables) to read or write variables for the current player.
Use [`WA.players` along with `RemotePlayer.state`](api-players.md#remote-players-variables) to read the variables of nearby players.

{.alert.alert-warning}
Player variables can be read only when the player is connected. WorkAdventure does not offer a way to fetch the list
of all players, only of current players. This means player variables are not well suited for systems such as a "leader board" where the best score
should be persisted even when the best player left the game.
