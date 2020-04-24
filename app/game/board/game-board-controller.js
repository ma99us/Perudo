export const GameState = {   // <-- Perudo game player states. FIXME: Am i forgetting anything?
  ROLL: 'ROLL',   // start new round, all players roll their dice
  ROLLED: 'ROLLED', // dice rolled, and waiting for others
  TURN: 'TURN',     // player's turn to make a decision; bet/dudo
  REVEAL: 'REVEAL', // dudo was called, reveal all dice
  REVEALED: 'REVEALED', // all dice revealed, loser loses a dice
  DONE: 'DONE'        // round ended for this player, ready for the next round
};

export class GameBoardController {
  constructor(API, HostStorageService, MessageBusService, AlertService,
              LobbyService, PlayerService, GameBotService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;
    this.alertService = AlertService;
    this.lobbyService = LobbyService;
    this.playerService = PlayerService;
    this.gameBotService = GameBotService;

    this.playerData = null;   // local data of this player (it has the same 'id' as a PlayerService.player.id)
    this.playersData = [];   // data revealed by each player (all players dice)
    this.gameData = null;   // data revealed on the board for everyone (contains current game state (one of the GameState constants))
  }

  $onInit() {
    console.log("* Game Board; game=" + this.game);

    this.gameDbListener = this.messageBusService.on("db-event", (event, data) => {
      //console.log("db-event: " + JSON.stringify(data));
      if (data.key === 'playersData') {
        this.getPlayersData().finally(() => {
          this.processGameDataChange();
        });
      }
      else if (data.key === 'gameData') {
        this.getGameData().finally(() => {
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
    this.getPlayerData()  // restore self personal data if any
      .then(() => {
        return this.getGameData();  // get global game state and adata
      })
      .then(() => {
        return this.getPlayersData(); // get all players public data
      })
      .then(() =>{
        this.processGameDataChange();
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
    const selfPlayersData = this.findSelfPlayersData();
    if(!this.gameData || !this.playerData || !this.playersData || !selfPlayersData){
      return; // not fully initialized yet, do not process state yet.
    }
    console.log("* gameState=" + this.gameData.gameState);

    if(this.gameData.gameState === GameState.ROLL){
      if(selfPlayersData.state !== GameState.ROLL && selfPlayersData.state !== GameState.ROLLED){
        // reset previous round player data
        this.playerData.dice = [];
        return this.updatePlayerData().then(() => {
          selfPlayersData.bet = null;
          selfPlayersData.dice = [];
          selfPlayersData.state = GameState.ROLL;
          if (selfPlayersData.diceNum > 0) {
            return this.updatePlayersData(this.makePublicPlayerData());
          } else {
            return this.rollDice(); // just continue to the next state
          }
        });
      }
      if(this.isHost && this.gameData.winner){
        // this game is Over. Show Score screen.
        return this.finishGame();
      }
      let winner = this.checkForWinnerPlayer();
      if(this.isHost && winner && !this.gameData.winner){
        // set the Winner and and switch to END state
        this.gameData.winner = winner;
        this.gameData.winnerDiceLeft = this.findPlayersData(winner).diceNum;
        //this.gameData.gameState = GameState.END;
        return this.updateGameData();
      }
      if(this.isHost && this.checkAllPlayersRolled()){
        // switch to next game state
        this.gameData.gameState = GameState.ROLLED;
        return this.updateGameData();
      }
      //each player has to call this.rollDice();
      if(this.canRoll){
        this.watchdogRollDice();
      }
    } else if(this.gameData.gameState === GameState.ROLLED) {
      if (this.isSelfTurn && selfPlayersData.state !== GameState.TURN) {
        selfPlayersData.state = GameState.TURN; // check if that is our turn to make a decision
        this.updatePlayersData(this.makePublicPlayerData());
      }
      // wait for the player betting turns to end
      // players whos turn must call this.bet() or this.dudo()
      if (this.isSelfTurn) {
        this.watchdogMakeBet();
      }
    } else if (this.gameData.gameState === GameState.REVEAL) {
      if (selfPlayersData.state !== GameState.REVEALED) {
        selfPlayersData.state = GameState.REVEALED;
        this.updatePlayersData(this.makePublicPlayerData(false)); // reveal each player dice
      } else if (this.isHost && this.checkAllPlayersRevealed()) {
        // switch to next game state
        this.gameData.gameState = GameState.REVEALED;
        this.updateGameData();
      }
      // no player interaction, just send all rolled dice numbers as public players data
    } else if (this.gameData.gameState === GameState.REVEALED) {
      if (selfPlayersData.state !== GameState.DONE) {
        let prevPlayerIndex = this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
        if (this.selfIndex === prevPlayerIndex) {
          // we were just dudoed against
          if(this.checkDudo() === true){
            // Oh, no! dudo was good, we lost a dice
            return this.loseDice();
          }
        } else if(this.selfIndex === this.gameData.playerTurn) {
          // we just dodoed someone
          if(this.checkDudo() === false){
            // Oh, no! dudo was bad, we lost a dice
            return this.loseDice();
          }
        }
        // Oof. we were out of the decision or were lucky this turn
        selfPlayersData.state = GameState.DONE;
        return this.updatePlayersData(this.makePublicPlayerData(false));
      }
      // turn player (or timer) should switch to the next game state 'ROLL'
      if (this.isSelfJustLost) {
        this.watchdogEndRound();
      }
    }
  }

  checkAllPlayersRolled() {
    let rolled = this.playersData.filter((p) => p.state === GameState.ROLLED || p.diceNum === 0);
    return rolled.length === this.playerService.players.length;
    //return rolled.length === this.playersData.length;
  }

  checkAllPlayersRevealed() {
    let revealed = this.playersData.filter((p) => p.state === GameState.REVEALED || p.diceNum === 0);
    return revealed.length === this.playerService.players.length;
    //return revealed.length === this.playersData.length;
  }

  checkForWinnerPlayer() {
    let data = this.playersData.filter(d => d.diceNum > 0);
    if(data.length !== 1 || this.playersData.length !== this.playerService.players.length){
      return null;
    }
    return this.playerService.getPlayerById(data[0].id);
  }

  get canRoll() {
    const selfPlayersData = this.findSelfPlayersData();
    return selfPlayersData && selfPlayersData.state !== GameState.ROLLED && selfPlayersData.diceNum > 0;
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

  findLastBet() {
    let prevPlayerIndex = this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
    if(prevPlayerIndex == null){
      return null;
    }
    let prevPlayer = this.playerService.getPlayerByIndex(prevPlayerIndex);
    let prevPlayerData = this.findPlayersData(prevPlayer);
    return prevPlayerData ? prevPlayerData.bet : null;
  }

  isLastBetPlayerIndex(index){
    return this.gameData && index === this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
  }

  get isFirstTurn() {
    return !this.gameData.lastRoundLength;
  }

  validateNum(num) {
    if (num < 1) {
      return 1;
    } else {
      return num;
    }
  }

  validateVal(val) {
    if (val < 1) {
      return 1;
    } else if (val > 6) {
      return 6;
    } else {
      return val;
    }
  }

  validateBet(num, val) {
    if(!num || !val){
      return false;
    }
    const bet = this.findLastBet(); // first turn of the round
    if (!bet) {
      return val > 1;
    }
    if (val === 1) {
      // aces are special
      if (bet.val === 1) {
        // was aces before
        return num > bet.num;
      } else {
        // was not ace before
        return num >= Math.ceil(bet.num / 2);
      }
    } else {
      // not aces
      if (bet.val === 1) {
        // was aces before
        return num >= bet.num * 2 + 1;
      } else if (val > bet.val) {
        // not aces and dice val is greater
        return num >= bet.num;
      } else {
        // not aces and dice value is less or same
        return num > bet.num;
      }
    }
  }

  getDice(player, pIndex, dIndex) {
    const playerData = player.id === this.playerService.player.id ? this.playerData : this.findPlayersData(player);
    if(!playerData){
      return null;
    }
    let val = (playerData && dIndex < playerData.dice.length) ? playerData.dice[dIndex] : null;
    // store dice UI into local temporary cache
    if (!this.playerUI) {
      this.playerUI = {};
    }
    if (!this.playerUI[pIndex]) {
      this.playerUI[pIndex] = {};
    }
    if (!this.playerUI[pIndex].diceUI) {
      this.playerUI[pIndex].diceUI = [];
    }
    if (!this.playerUI[pIndex].diceUI[dIndex]) {
      this.playerUI[pIndex].diceUI[dIndex] = {};
    }
    this.playerUI[pIndex].diceUI[dIndex].color = player.color;
    this.playerUI[pIndex].diceUI[dIndex].value = val;
    const isDiceMatch = (this.gameData && this.gameData.lastBet) ? (val === this.gameData.lastBet.val || val === 1) : false;
    this.playerUI[pIndex].diceUI[dIndex].mark = val && this.gameData && this.gameData.gameState === GameState.REVEALED && isDiceMatch;
    this.playerUI[pIndex].diceUI[dIndex].mute = val == null;
    return this.playerUI[pIndex].diceUI[dIndex];
  }

  // isDiceMatch(val){
  //   const bet = this.findLastBet();
  //   if (!bet) {
  //     return false;
  //   }
  //   return val === bet.val || val === 1;
  // }

  get diceInPlay() {
    return this.playersData.reduce((total, p) => total + p.diceNum, 0);
  }

  get isHost() {
    return this.playerService.player.isHost;
  }

  get selfIndex() {
    return this.playerService.findSelfPlayerIndex();
  }

  watchdogEndRound(){
    if (this.watchdogER) {
      return;
    }
    this.watchdogER = this.gameBotService.watchdogCallback(10, (ts) => {
      // update UI
      this.watchdogERts = ts;
    });
    if(this.watchdogER){
      this.watchdogER.then(() => {
        this.watchdogER = null;
        this.endRound();
      }).catch((err) => {
        this.watchdogERts = null;
        this.watchdogER = null;
      });
    }
  }

  endRound() {
    if(this.watchdogER){
      this.gameBotService.watchdogCancel(this.watchdogER);
    }
    // advance player turn
    this.gameData.playerTurn = this.gameData.nextPlayerTurn;
    // reset last round info
    this.gameData.nextPlayerTurn = null;
    this.gameData.prevLoserIndex = this.gameData.lastLoserIndex;
    this.gameData.lastLoserIndex = null;
    this.gameData.lastBet = null;
    this.gameData.lastRoundLength = 0;
    this.gameData.totalRounds++;
    this.gameData.prompt = null;
    this.gameData.gameState = GameState.ROLL;
    this.updateGameData();
  }

  watchdogRollDice(){
    if (this.watchdogRD) {
      return;
    }
    this.watchdogRD = this.gameBotService.watchdogCallback(5, (ts) => {
      // update UI
      this.watchdogRDts = ts;
    });
    if (this.watchdogRD) {
      this.watchdogRD.then(() => {
        this.watchdogRD = null;
        this.rollDice();
      }).catch((err) => {
        // cancelled
        this.watchdogRDts = null;
        this.watchdogRD = null;
      });
    }
  }

  rollDice() {
    if(this.watchdogRD){
      this.gameBotService.watchdogCancel(this.watchdogRD);
    }
    this.playerData.dice = [];
    for (let i = 0; i < this.findSelfPlayersData().diceNum; i++) {
      this.playerData.dice.push(Math.floor(Math.random() * 6 + 1))
    }
    this.updatePlayerData().finally(() => {
      this.findSelfPlayersData().state = GameState.ROLLED;
      this.updatePlayersData(this.makePublicPlayerData());
    });
  }

  loseDice() {
    console.log("Oh no! We lost a dice!");
    const selfPlayersData = this.findSelfPlayersData();
    if (selfPlayersData.diceNum > 0) {
      selfPlayersData.diceNum--;
    }
    selfPlayersData.state = GameState.DONE;  // done with this round
    return this.updatePlayersData(this.makePublicPlayerData(false))
      .then(() => {
        this.gameData.lastBet = {num: this.dudo.bet_num, val: this.dudo.bet_val};
        this.gameData.lastLoserIndex = this.selfIndex;
        this.gameData.lastLoserStreek = (this.gameData.prevLoserIndex === this.gameData.lastLoserIndex) ? (this.gameData.lastLoserStreek + 1) : 1;
        this.gameData.prompt = `Bet ${this.dudo.bet_num} of ${this.dudo.bet_val}'s, revealed: ${this.dudo.total}.` +
          ` \"${this.playerService.player.name}\" loses a dice :-(`;
        // find next player index turn
        if(selfPlayersData.diceNum > 0){
          this.gameData.nextPlayerTurn = this.selfIndex;
        } else {
          this.gameData.nextPlayerTurn = this.findNextGoodPlayerIndex(this.selfIndex);
        }
        this.updateGameData();
      });
  }

  watchdogMakeBet(){
    if (this.watchdogMB) {
      return;
    }
    this.watchdogMB = this.gameBotService.watchdogCallback(20, (ts) => {
      // update UI
      this.watchdogBMts = ts;
    });
    if(this.watchdogMB){
      this.watchdogMB.then(() => {
        this.watchdogMB = null;
        let allBets = this.playersData.filter(pd => pd.bet).map(pd => pd.bet);
        let aiBet = this.gameBotService.perudoBetBot(this.diceInPlay, this.playerData.dice,
          this.findLastBet(), allBets);
        if (aiBet) {
          this.makeBet(aiBet.num, aiBet.val);
        } else {
          this.callDudo();
        }
      }).catch((err) => {
        this.watchdogBMts = null;
        this.watchdogMB = null;
      });
    }
  }

  makeBet(num, val) {
    if(this.watchdogMB){
      this.gameBotService.watchdogCancel(this.watchdogMB);
    }
    this.findSelfPlayersData().bet = {
      num: num,
      val: val
    };
    return this.updatePlayersData(this.makePublicPlayerData())
      .then(() => {
        console.log("was turn=" + this.gameData.playerTurn);  // #DEBUG
        this.gameData.playerTurn = this.findNextGoodPlayerIndex(this.gameData.playerTurn);
        console.log("now turn=" + this.gameData.playerTurn);  // #DEBUG
        this.gameData.lastRoundLength++;
        this.updateGameData();
      });
  }

  callDudo() {
    this.gameData.gameState = GameState.REVEAL;
    this.updateGameData();
  }

  checkDudo(){
    const bet = this.findLastBet();
    if (!bet) {
      return null;
    }
    // calculate total number diceOfInterest = bet.val
    let total = 0;
    this.playersData.forEach((p) => {
      total += p.dice.filter(d => d === bet.val || d === 1).length;
    });
    this.dudo = {   // just a temp variable
      bet_num: bet.num,
      bet_val: bet.val,
      total: total
    };
    //this.gameData.prompt = `Bet ${bet.num} of ${bet.val}'s, revealed: ${total}.`;
    return total < bet.num;
  }

  findPrevGoodPlayerIndex(index){
    let idx = index;
    let playerData = null;
    do{
      idx = this.playerService.getPrevPlayerIndex(idx);
      let player = this.playerService.getPlayerByIndex(idx);
      playerData = this.findPlayersData(player);
      if (!playerData) {
        return null;
      }
    }while(playerData.diceNum === 0 && idx !== index);
    return idx !== index ? idx : null;
  }

  findNextGoodPlayerIndex(index){
    let idx = index;
    let playerData = null;
    do{
      idx = this.playerService.getNextPlayerIndex(idx);
      let player = this.playerService.getPlayerByIndex(idx);
      playerData = this.findPlayersData(player);
      if (!playerData) {
        return null;
      }
    }while(playerData.diceNum === 0 && idx !== index);
    return idx !== index ? idx : null;
  }

  /** PUBLIC GAME DATA (mainly GAME STATE) **/

  getGameData() {
    return this.hostStorageService.get("gameData").then(data => {
        this.alertService.message();
        this.gameData = data;
        if(!this.gameData){
          this.gameData = {
            gameState: GameState.ROLL,  // no game state yet, assume first round ROLL
            playerTurn: 0,
            lastRoundLength: 0,
            totalRounds: 0
          };
          if(this.isHost){
            return this.updateGameData(this.gameData);
          }
        }
      })
      .catch(err => {
        this.alertService.error(err);
      })
  }

  updateGameData() {
    return this.hostStorageService.update("gameData", this.gameData).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  /** PERSONAL PLAYER DATA **/

  getPlayerData() {
    return this.hostStorageService.get(".playerData-" + this.playerService.player.id).then(data => {
      this.alertService.message();
      this.playerData = data;
      if(!this.playerData){
        this.playerData = {
          dice: [], // only actual dice rolls are storred in personal player data, no states!
        };
        return this.updatePlayerData();
      } else {
        this.gameBotService.botMode = this.playerData.botMode || this.gameBotService.botMode;
        this.bet = this.playerData.bet || {};  // temp values for UI controls //FIXME: is that still needed?
      }
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  updatePlayerData() {
    this.playerData.id = this.playerService.player.id;
    return this.hostStorageService.update(".playerData-" + this.playerService.player.id, this.playerData).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  /** PUBLIC PLAYERS DATA **/

  makePublicPlayerData(excludeDice = true) {
    const data = Object.assign({}, this.findSelfPlayersData());
    data.dice = [...this.playerData.dice];
    if (excludeDice) {
      data.dice = data.dice.map((d) => {
        return '?'
      });
    }
    return data;
  }

  findPlayersData(player){
    if(!player){
      return null;
    }
    return this.playersData.find((p) => p.id === player.id);
  }

  findSelfPlayersData(){
    return this.findPlayersData(this.playerService.player);
  }

  getPlayersData() {
    return this.hostStorageService.get("playersData").then(data => {
      this.alertService.message();
      this.playersData = ((!Array.isArray(data) && data !== null) ? [data] : data) || []; // should always be an array
      let selfPlayer = this.findPlayersData(this.playerService.player);
      if(!selfPlayer){
        // probably the first round, setup the player initial state
        console.log("-- init self player data; isSpectator=" + this.playerService.isSpectator());
        const player = {
          diceNum: !this.playerService.isSpectator() ? 5 : 0, // no dice for spectators
          dice: [],
          state: GameState.ROLL
        };
        return this.updatePlayersData(player);
      }
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  updatePlayersData(playerData) {
    playerData.id = playerData.id || this.playerService.player.id;
    return this.hostStorageService.update("playersData", playerData).then(data => {
      this.alertService.message();
    }).catch(err => {
      this.alertService.error(err);
    })
  }

  finishGame() {
    this.game.updateState('FINISHED');
  }

  get GameState() {
    return GameState;
  }

  updateBotMode(mode){
    if(this.watchdogRD){
      this.gameBotService.watchdogCancel(this.watchdogRD);
      this.watchdogRD = null;
    }
    if(this.watchdogMB){
      this.gameBotService.watchdogCancel(this.watchdogMB);
      this.watchdogMB = null;
    }
    if(this.watchdogER){
      this.gameBotService.watchdogCancel(this.watchdogER);
      this.watchdogER = null;
    }

    this.gameBotService.botMode = mode;

    this.playerData.botMode = this.gameBotService.botMode;
    this.updatePlayerData();

    this.processGameDataChange();
  }

  debugRestGame() {
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
        return this.getPlayerData();  // restore self personal data if any
      })
      .then(() => {
        return this.getGameData();  // get global game state and adata
      })
      .then(() => {
        return this.getPlayersData(); // get all players public data
      })
      .catch(err => {
        this.alertService.error(err);
      })
      .finally(() => {
        this.processGameDataChange();
      });
  }

  debugEndGame() {
    const selfPlayersData = this.findSelfPlayersData();
    selfPlayersData.diceNum = 1;
    selfPlayersData.dice = [];
    selfPlayersData.state = GameState.DONE;
    this.updatePlayersData(this.makePublicPlayerData());
  }

  // debugRollPlayer(id) {
  //   let player = {
  //     id: id
  //   };
  //   let pd = this.findPlayersData(player);
  //   this.updatePlayerData(pd)
  //
  // }
}