export class AbstractGameBoardController {
  constructor(API, HostStorageService, MessageBusService, AlertService, PlayerService, GameBotService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.playerService = PlayerService;
    this.gameBotService = GameBotService;

    this.playerData = null;   // local data of this player (it has the same 'id' as a PlayerService.player.id)
    this.playersData = [];   // data revealed by each player (all players dice)
    this.gameData = null;   // data revealed on the board for everyone (contains current game state (one of the GameState constants))
  }

  $onInit() {
    console.log(`* Initializing Game Board; game=${this.game.gameName}"; id=${this.game.id}; `+
      `Player=${this.playerService.player.name} id=${this.playerService.player.id}; `+
      `isHost=${this.playerService.isHost} ; isSpectator=${this.playerService.isSpectator}; isBot=${this.playerService.isBot}`);

    this.gameDbListener = this.messageBusService.on("db-event", (event, data) => {
      //console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'playersData') {
        this.getPlayersData().then(() => {
          this.processGameDataChange();
        });
      }
      else if (data.key === 'gameData') {
        this.getGameData().then(() => {
          this.processGameDataChange();
        });
      }
    });
    this.gameEventListener = this.messageBusService.on('game-event', (event, data) => {
      console.log("game-event: " + JSON.stringify(data));   // #DEBUG
      if (data.source === 'PlayerService' && data.isReady) {
        this.onOpened();
      }
    });

    this.alertService.warning("Synchronizing game...");
    if (this.playerService.isReady) {
      this.onOpened();
    }
  }

  $onDestroy() {
    if (this.gameDbListener) {
      this.gameDbListener();
    }
    if (this.gameEventListener) {
      this.gameEventListener();
    }
  }

  onOpened() {
    return this.getPlayersData()   // get all players public data
      .then(() => {
        return this.getPlayerData();  // restore self personal data if any
      })
      .then(() => {
        return this.getGameData();    // get global game state and data
      })
      .then(() => {
        this.processGameDataChange();
      })
      .then(() => {
        console.log("Game synchronized");  // #DEBUG
        this.alertService.message();
      })
      .catch((err) => {
        this.alertService.error(err);
      });
  }

  /**
   * Main game state machine
   * @param newState
   */
  processGameDataChange() {
    throw 'You have to implement this abstract method!';
  }

  checkForWinnerPlayer() {
    throw 'You have to implement this abstract method!';
  }

  get isSelfTurn() {
    return this.selfIndex === this.gameData.playerTurn;
  }

  get isSelfJustLost() {
    return this.selfIndex === this.gameData.lastLoserIndex;
  }

  get lastLooserStreek() {
    return this.gameData.lastLoserStreek;
  }

  get isFirstTurn() {
    return !this.gameData.lastRoundLength;
  }

  get isHost() {
    return this.playerService.player.isHost;
  }

  get selfIndex() {
    return this.playerService.selfPlayerIndex;
  }

  endRound() {
    throw 'You have to implement this abstract method!';
  }

  findPrevGoodPlayerIndex(index, isGoodPlayerFn) {
    let idx = index;
    let playerData = null;
    do {
      idx = this.playerService.getPrevPlayerIndex(idx);
      let player = this.playerService.getPlayerByIndex(idx);
      playerData = this.findPlayersData(player);
      if (!playerData) {
        return null;
      }
    } while (!isGoodPlayerFn(playerData) && idx !== index);
    return idx !== index ? idx : null;
  }

  findNextGoodPlayerIndex(index, isGoodPlayerFn) {
    let idx = index;
    let playerData = null;
    do {
      idx = this.playerService.getNextPlayerIndex(idx);
      let player = this.playerService.getPlayerByIndex(idx);
      playerData = this.findPlayersData(player);
      if (!playerData) {
        return null;
      }
    } while (!isGoodPlayerFn(playerData) && idx !== index);
    return idx !== index ? idx : null;
  }

  /** PUBLIC GAME DATA (mainly GAME STATE) **/

  getGameData(initGameData) {
    return this.hostStorageService.get("gameData").then(data => {
      this.gameData = data;
      //console.log("* getGameData; gameData{} replaced");   // #DEBUG
      if (!this.gameData) {
        this.gameData = initGameData;
        if (this.isHost) {
          return this.updateGameData(this.gameData);
        }
      }
    }).catch(err => {
      this.alertService.error(err);
      throw err;
    })
  }

  updateGameData() {
    console.log(`++ updating DB "gameData": ${JSON.stringify(this.gameData)}`);  // #DEBUG
    return this.hostStorageService.set("gameData", this.gameData).catch(err => {
      this.alertService.error(err);
      throw err;
    })
  }

  /** PERSONAL PLAYER DATA **/

  getPlayerData() {
    const promise = this.hostStorageService.get(".playerData-" + this.playerService.player.id).then(data => {
      if(data && data.botMode){
        this.playerService.player.botMode = data.botMode;
      } else if (this.playerService.isBot) {
        this.playerService.player.botMode = this.gameBotService.BotMode.Ian;
      } else if(!this.playerService.player.botMode){
        this.playerService.player.botMode = this.gameBotService.BotMode.Kevin;
      }
      return data;  // resolve next .then with the same data
    });
    promise.catch(err => {
      this.alertService.error(err);
    });
    return promise;
  }

  updatePlayerData(playerData) {
    playerData.id = playerData.id || this.playerService.player.id;
    playerData.botMode = playerData.botMode || this.playerService.player.botMode;
    const key = ".playerData-" + this.playerService.player.id;
    console.log(`++ updating DB "${key}": ${JSON.stringify(playerData)}`);  // #DEBUG
    return this.hostStorageService.update(key, playerData).catch(err => {
      this.alertService.error(err);
      throw err;
    });
  }

  /** PUBLIC PLAYERS DATA **/

  /**
   * Just returns a copy of this.playerData. Has to be overwritten in child class to mask/exclude private data
   * @returns {({} & null) | *}
   */
  makePublicPlayerData() {
    return Object.assign({}, this.playerData);
  }

  findPlayersData(player) {
    if (!player) {
      return null;
    }
    return this.playersData.find((p) => p.id === player.id);
  }

  getPlayersData(initPlayersData) {
    return this.hostStorageService.get("playersData").then(data => {
      this.playersData = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
      //console.log("* getPlayersData; playersData[] replaced");   // #DEBUG
      let selfPlayerData = this.findPlayersData(this.playerService.player);
      if(!this.playerData && selfPlayerData){
        this.playerData = selfPlayerData;
      }
      else if (this.playerData && !selfPlayerData) {
        return this.updatePlayersData(this.makePublicPlayerData());
      }
      else if(!this.playerData && !selfPlayerData) {
        // probably the first round, setup the player initial state
        this.playerData = initPlayersData;
        return this.updatePlayersData(this.makePublicPlayerData());
      }
    }).catch(err => {
      this.alertService.error(err);
      throw err;
    })
  }

  updatePlayersData(playerData) {
    playerData.id = playerData.id || this.playerService.player.id;
    console.log(`++ updating DB "playersData": ${JSON.stringify(playerData)}`);  // #DEBUG
    return this.hostStorageService.update("playersData", playerData).catch(err => {
      this.alertService.error(err);
      throw err;
    })
  }

  finishGame() {
    this.game.updateState('FINISHED');
  }

  updateBotMode(mode) {
    if (this.watchdogRD) {
      this.gameBotService.watchdogCancel(this.watchdogRD);
      this.watchdogRD = null;
    }
    if (this.watchdogMB) {
      this.gameBotService.watchdogCancel(this.watchdogMB);
      this.watchdogMB = null;
    }
    if (this.watchdogER) {
      this.gameBotService.watchdogCancel(this.watchdogER);
      this.watchdogER = null;
    }

    this.playerService.player.botMode = mode;

    this.playerData.botMode = this.playerService.player.botMode;
    this.updatePlayerData();

    this.processGameDataChange();
  }

  getRandomRange(from = 1, to = 6) {
    return Math.floor(Math.random() * (to + 1 - from) + from);
  }

  /** DEBUG ONLY! **/

  debugRestartGame() {
    this.alertService.message();
    return this.hostStorageService.delete("playerData-" + this.playerService.player.id)
      .then(() => {
        return this.hostStorageService.delete("playersData");
      })
      .then(() => {
        return this.hostStorageService.delete("gameData");
      })
      // now re-init everything
      .then(() => {
        return this.getPlayersData(); // get all players public data
      })
      .then(() => {
        return this.getPlayerData();  // restore self personal data if any
      })
      .then(() => {
        return this.getGameData();  // get global game state and adata
      })
      .then(() => {
        this.processGameDataChange();
      })
      .catch(err => {
        this.alertService.error(err);
      });
  }

  debugKickPlayerByName(name) {
    const p = this.playerService.players.find(p => p.name === name);
    if (!p) {
      throw 'No such player';
    }
    return this.playerService.removePlayers(p);
  }
}