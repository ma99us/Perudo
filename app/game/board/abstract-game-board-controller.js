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
    this.isReady = false;   // set to true once this.onOpened() finishes
  }

  $onInit() {
    console.log(`* Initializing Game Board; game=${this.game.gameName}"; id=${this.game.id}... `);

    this.gameDbListener = this.messageBusService.on("db-event", (event, data) => {
      console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'players') {
        this.cleanPlayersData();
        this.processGameDataChange();
      }
      else if (data.key === 'playersData') {
        console.log("on \"playersData\" db-event; " + JSON.stringify(data.value));   // #DEBUG
        this.mergePlayersData(data.value);
        this.processGameDataChange();
      }
      else if (data.key === 'gameData') {
        console.log("on \"gameData\" db-event; " + JSON.stringify(data.value));   // #DEBUG
        this.gameData = data.value;
        this.processGameDataChange();
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

    if (this.playerService.isSpectator) {
      this.leaveGame();
    }
  }

  onOpened() {
    return this.syncPlayersData()   // get all players public data
      .then(() => {
        return this.getPlayerData();  // restore self personal data if any
      })
      .then(() => {
        return this.syncGameData();    // get global game state and data
      })
      .then(() => {
        this.isReady = true;
        console.log("Game synchronized");  // #DEBUG
        this.alertService.message();
        console.log(`* Initialized Game Board; game=${this.game.gameName}"; id=${this.game.id}; ` +
          `Player=${this.playerService.player.name} id=${this.playerService.player.id}; ` +
          `isHost=${this.playerService.isHost} ; isSpectator=${this.playerService.isSpectator}; isBot=${this.playerService.isBot}`);
        this.processGameDataChange();
      })
      .catch((err) => {
        this.alertService.error(err);
      });
  }

  leaveGame() {
    this.playerData = null;
    this.playersData = [];
    this.gameData = null;
    this.isReady = false;
    this.removeGamePlayer(this.playerService.player);
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
    return this.playerService.isHost;
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

  syncGameData(initGameData) {
    return this.hostStorageService.get("gameData").then(data => {
      this.gameData = data;
      //console.log("* syncGameData; gameData{} replaced");   // #DEBUG
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
      if (data && data.botMode) {
        this.playerData.botMode = data.botMode;
      } else if (this.playerService.isBot) {
        this.playerData.botMode = this.gameBotService.BotMode.Ian;
      } else if (!this.playerData.botMode) {
        this.playerData.botMode = this.gameBotService.BotMode.Kevin;
      }
      if (data && data.soundMute != null) {
        this.game.isSoundMuted = data.soundMute;
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
    playerData.botMode = playerData.botMode || this.playerData.botMode;
    playerData.soundMute = playerData.soundMute != null ? playerData.soundMute : this.game.isSoundMute;
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

  mergePlayersData(playersData) {
    if (!playersData.id || !this.playerService.getPlayerById(playersData.id)) {
      console.log("! mergePlayersData; unexpected players data: " + JSON.stringify(playersData)); // #DEBUG
      // return
      // get fresh players data
       return this.getPlayersData().then(() => {
         this.cleanPlayersData();
      });
    }
    let idx = this.playersData.findIndex(pd => pd.id === playersData.id);
    if (idx >= 0) {
      this.playersData[idx] = playersData;
    } else if (playersData.id) {
      this.playersData.push(playersData);
    }
    this.cleanPlayersData();
  }

  cleanPlayersData() {
    // const pIds = this.playerService.players.map(p => p.id);
    // this.playersData = this.playersData.filter(pd => pIds.indexOf(pd.id) >= 0);
  }

  getPlayersData() {
    return this.hostStorageService.get("playersData").then(data => {
      this.playersData = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
    }).catch(err => {
      this.alertService.error(err);
      throw err;
    });
  }

  syncPlayersData(initPlayersData) {
    return this.getPlayersData().then(() => {
      //console.log("* getPlayersData; playersData[] replaced");   // #DEBUG
      let selfPlayerData = this.findPlayersData(this.playerService.player);
      if (!this.playerData && selfPlayerData) {
        this.playerData = selfPlayerData;
      }
      else if (this.playerData && !selfPlayerData) {
        return this.updatePlayersData(this.makePublicPlayerData());
      }
      else if (!this.playerData && !selfPlayerData && initPlayersData) {
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

  soundMuteToggle() {
    this.game.soundMuteToggle();
    this.updatePlayerData();
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

    this.playerData.botMode = mode;
    this.updatePlayerData();

    this.processGameDataChange();
  }

  getRandomRange(from = 1, to = 6) {
    return Math.floor(Math.random() * (to + 1 - from) + from);
  }

  playSound(soundName) {
    if (this.playerService.isBot) {
      return;
    }
    this.game.playSound(soundName);
  }

  stopSound(soundName = null) {
    if (this.playerService.isBot) {
      return;
    }
    this.game.stopSound(soundName);
  }

  removeGamePlayer(player) {
    return this.hostStorageService.delete("playersData", player.id).then(data => {
      return this.playerService.removePlayers(player);
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  /** DEBUG ONLY! **/

  debugDumpAllGameData() {
    let dumpStr = "*** gameData:\n" + JSON.stringify(this.gameData, null, '  ');
    dumpStr += "\n*** all playersData:\n" + JSON.stringify(this.playersData, null, '  ');
    dumpStr += "\n*** self playerData:\n" + JSON.stringify(this.playerData, null, '  ');
    dumpStr += "\n*** all players:\n" + JSON.stringify(this.playerService.players, null, '  ');
    dumpStr += "\n*** self player:\n" + JSON.stringify(this.playerService.player, null, '  ');
    console.log(dumpStr);
    this.alertService.showPopup('! DEBUG GAME STATE !', dumpStr);
  }

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
        return this.syncPlayersData(); // get all players public data
      })
      .then(() => {
        return this.getPlayerData();  // restore self personal data if any
      })
      .then(() => {
        return this.syncGameData();  // get global game state and adata
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
    return this.removeGamePlayer(p);
  }
}