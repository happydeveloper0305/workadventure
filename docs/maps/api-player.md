{.section-title.accent.text-primary}
# API Player functions Reference

### Get the player name

```
WA.player.name: string;
```

The player name is available from the `WA.player.name` property.

{.alert.alert-info}
You need to wait for the end of the initialization before accessing `WA.player.name`

```typescript
WA.onInit().then(() => {
    console.log('Player name: ', WA.player.name);
})
```

### Get the player ID

```
WA.player.id: string|undefined;
```

The player ID is available from the `WA.player.id` property.
This is a unique identifier for a given player. Anonymous player might not have an id.

{.alert.alert-info}
You need to wait for the end of the initialization before accessing `WA.player.id`

```typescript
WA.onInit().then(() => {
    console.log('Player ID: ', WA.player.id);
})
```

### Get the tags of the player

```
WA.player.tags: string[];
```

The player tags are available from the `WA.player.tags` property.
They represent a set of rights the player acquires after login in.

{.alert.alert-warn}
Tags attributed to a user depend on the authentication system you are using. For the hosted version
of WorkAdventure, you can define tags related to the user in the [administration panel](https://workadventu.re/admin-guide/manage-members).

{.alert.alert-info}
You need to wait for the end of the initialization before accessing `WA.player.tags`

```typescript
WA.onInit().then(() => {
    console.log('Tags: ', WA.player.tags);
})
```

### Get the position of the player
```
WA.player.getPosition(): Promise<Position>
```
The player's current position is available using the `WA.player.getPosition()` function.

`Position` has the following attributes :
* **x (number) :** The coordinate x of the current player's position.
* **y (number) :** The coordinate y of the current player's position.


{.alert.alert-info}
You need to wait for the end of the initialization before calling `WA.player.getPosition()`

```typescript
WA.onInit().then(() => {
    console.log('Position: ', WA.player.getPosition());
})
```


### Listen to player movement
```
WA.player.onPlayerMove(callback: HasPlayerMovedEventCallback): void;
```
Listens to the movement of the current user and calls the callback. Sends an event when the user stops moving, changes direction and every 200ms when moving in the same direction.

The event has the following attributes :
*   **moving (boolean):**  **true** when the current player is moving, **false** otherwise.
*   **direction (string):** **"right"** | **"left"** | **"down"** | **"top"** the direction where the current player is moving.
*   **x (number):** coordinate X of the current player.
*   **y (number):** coordinate Y of the current player.
*   **oldX (number):** old coordinate X of the current player.
*   **oldY (number):** old coordinate Y of the current player.

**callback:** the function that will be called when the current player is moving. It contains the event.

Example :
```javascript
WA.player.onPlayerMove(console.log);
```

## Player specific variables
Similarly to maps (see [API state related functions](api-state.md)), it is possible to store data **related to a specific player** in a "state". Such data will be stored using the local storage from the user's browser. Any value that is serializable in JSON can be stored.

{.alert.alert-info}
In the future, player-related variables will be stored on the WorkAdventure server if the current player is logged.

Any value that is serializable in JSON can be stored.

### Setting a property
A player property can be set simply by assigning a value.

Example:
```javascript
WA.player.state.toto = "value" //will set the "toto" key to "value"
```

### Reading a variable 
A player variable can be read by calling its key from the player's state. 

Example:
```javascript
WA.player.state.toto //will retrieve the variable
```
