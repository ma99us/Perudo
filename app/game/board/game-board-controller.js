import {AbstractGameBoardController} from "./abstract-game-board-controller.js";

export const GameState = {   // <-- Perudo game player states. FIXME: Am i forgetting anything?
  ROLL: 'ROLL',   // start new round, all players roll their dice
  ROLLING: 'ROLLING', // temp state to let all clients confirm that they got other players data before allowing host to switch to the next game state
  ROLLED: 'ROLLED', // dice rolled, and waiting for others
  TURN: 'TURN',     // player's turn to make a decision; bet/dudo
  REVEAL: 'REVEAL', // dudo was called, reveal all dice
  REVEALING: 'REVEALING',  // temp state to let all clients confirm that they got other players data before allowing host to switch to the next game state
  REVEALED: 'REVEALED', // all dice revealed, loser loses a dice
  DONE: 'DONE'        // round ended for this player, ready for the next round
};

export class GameBoardController extends AbstractGameBoardController {
  constructor(API, HostStorageService, MessageBusService, AlertService, PlayerService, GameBotService) {
    'ngInject';

    super(API, HostStorageService, MessageBusService, AlertService, PlayerService, GameBotService);

    this.botGameBoardControllers = []   // spawn game controller for every bot (only if host!)
  }

  get GameState() {
    return GameState;
  }

  onOpened() {
    super.onOpened()
      .then(() => {
        if (this.isHost) {
          this.botGameBoardControllers = [];
          this.gameBotService.botPlayerServices.forEach(ps => {
            ps.isReady = true;
            const gameBoardController = new GameBoardController(this.API, this.hostStorageService, this.messageBusService, this.alertService, ps, this.gameBotService);
            this.botGameBoardControllers.push(gameBoardController);
            gameBoardController.game = this.game;
            gameBoardController.$onInit();
          });
        }
      });
  }

  $onDestroy() {
    this.botGameBoardControllers.forEach(gbc => {
      gbc.$onDestroy();
    });
    this.botGameBoardControllers = [];
    super.$onDestroy();
  }


  /**
   * Main game state machine
   * @param newState
   */
  processGameDataChange() {
    if (!this.gameData || !this.playerData || !this.playersData || !this.isReady) {
      return; // not fully initialized yet, or not ready to process state yet.
    }
    if (this.atomicUpdate) {
      this.pendingProcessGameDataChange = true;
      return;
    }
    //console.log("* gameState=" + this.gameData.gameState);
    this.pendingProcessGameDataChange = false;
    if (this.gameData.gameState === GameState.ROLL) {
      if (this.playerData.state !== GameState.ROLL && this.playerData.state !== GameState.ROLLING
        && this.playerData.state !== GameState.ROLLED) {
        // reset previous round player data
        this.alertService.message();
        this.atomicUpdate = true;
        this.playerData.bet = null;
        this.playerData.dice = [];
        if (this.playerData.diceNum > 0) {
          this.playerData.state = GameState.ROLL; // need to roll dice
        } else {
          this.playerData.state = GameState.ROLLING; // out of the game, just switch to next state
        }
        return this.updatePlayersData(this.makePublicPlayerData()).then(() => {
          return this.updatePlayerData();
        }).finally(() => {
          this.atomicUpdate = false;
          if (this.pendingProcessGameDataChange) {
            return this.processGameDataChange();
          }
        });
      }
      if (this.isHost && this.gameData.winner) {
        // this game is Over. Show Score screen.
        return this.finishGame();
      }
      let winner = this.checkForWinnerPlayer();
      if (this.isHost && winner && !this.gameData.winner) {
        // set the Winner
        this.gameData.winner = winner;
        this.gameData.winnerDiceLeft = this.findPlayersData(winner).diceNum;
        return this.updateGameData();
      }
      if (this.playerData.state === GameState.ROLLING && this.checkAllPlayersRolling()) {
        // switch our state to ROLLED only once we see that every player have rolled their dice
        this.playerData.state = GameState.ROLLED;
        return this.updatePlayersData(this.makePublicPlayerData());
      }
      if (this.isHost && this.checkAllPlayersRolled()) {
        this.paranoiaCheckPlayersDataConsistency();   // #DEBUG
        // switch to next game state if all players are in ROLLED state
        this.gameData.gameState = GameState.ROLLED;
        return this.updateGameData();
      }
      //each player has to call this.rollDice();
      if (this.canRoll) {
        this.watchdogRollDice();
      }
    } else if (this.gameData.gameState === GameState.ROLLED) {
      console.log("* gameState=ROLLED: this.playerData.state=" + this.playerData.state);    // #DEBUG
      if (this.isSelfTurn && this.playerData.state !== GameState.TURN) {
        this.playerData.state = GameState.TURN; // check if that is our turn to make a decision
        return this.updatePlayersData(this.makePublicPlayerData());
      }
      // wait for the player betting turns to end
      // players whos turn must call this.bet() or this.dudo()
      if (this.isSelfTurn && this.playerData.state === GameState.TURN) {
        this.watchdogMakeBet();
      }
    } else if (this.gameData.gameState === GameState.REVEAL) {
      console.log("* gameState=REVEAL: this.playerData.state=" + this.playerData.state);    // #DEBUG
      if (this.playerData.state !== GameState.REVEALING && this.playerData.state !== GameState.REVEALED) {
        this.playerData.state = GameState.REVEALING;
        return this.updatePlayersData(this.makePublicPlayerData(false)); // reveal our dice
      }
      if (this.playerData.state === GameState.REVEALING && this.checkAllPlayersRevealing()) {
        this.playerData.state = GameState.REVEALED;
        return this.updatePlayersData(this.makePublicPlayerData(false)); // all players revealed their dice
      }
      if (this.isHost && this.checkAllPlayersRevealed()) {
        this.paranoiaCheckPlayersDataConsistency();   // #DEBUG
        // switch to next game state if all players in REVEALED state
        this.gameData.gameState = GameState.REVEALED;
        return this.updateGameData();
      }
      // no player interaction, just send all rolled dice numbers as public players data
    } else if (this.gameData.gameState === GameState.REVEALED) {
      console.log("* gameState=REVEALED: this.playerData.state=" + this.playerData.state);    // #DEBUG
      if (this.playerData.state !== GameState.DONE) {
        let prevPlayerIndex = this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
        if (this.selfIndex === prevPlayerIndex) {
          // we were just dudoed against
          const isGoodDudo = this.checkDudo();
          if (isGoodDudo === true) {
            // Oh, no! dudo was good, we lost a dice
            console.log("* Oh, no! next player dudo was good");    // #DEBUG
            this.playSound('boo');
            return this.loseDice();
          } else if (isGoodDudo === false) {
            console.log("* Yea! Someone dudoed us and failed");    // #DEBUG
            this.playSound('wow');
            this.playerData.state = GameState.DONE;
            return this.updatePlayersData(this.makePublicPlayerData(false));
          }
        } else if (this.selfIndex === this.gameData.playerTurn) {
          // we just dodoed someone
          const dudoRes = this.checkDudo();
          if (dudoRes === false) {
            // Oh, no! dudo was bad, we lost a dice
            console.log("* Oh, no! our dudo was bad.");    // #DEBUG
            this.playSound('boo');
            return this.loseDice();
          } else if (dudoRes === true) {
            console.log("* Yea! We successfully dodoed someone");    // #DEBUG
            this.playSound('wow');
            this.playerData.state = GameState.DONE;
            return this.updatePlayersData(this.makePublicPlayerData(false));
          }
        } else {
          // Oof. we were out of the decision or were lucky this turn
          console.log("* We are out of the decision this turn");    // #DEBUG
          this.playerData.state = GameState.DONE;
          return this.updatePlayersData(this.makePublicPlayerData(false));
        }
      }
      // turn player (or timer) should switch to the next game state 'ROLL'
      if (this.isSelfJustLost) {
        this.watchdogEndRound();
      }
    } else {
      console.log("! gameState=" + this.gameData.gameState + ": this.playerData.state=" + this.playerData.state);    // #DEBUG
    }
  }

  checkAllPlayersRolling() {
    const rolled = this.playersData.filter((p) => p.state === GameState.ROLLING || p.state === GameState.ROLLED || p.diceNum === 0);
    console.log("checkAllPlayersRolling; " + rolled.length + " of " + this.playerService.players.length); // #DEBUG
    return rolled.length === this.playerService.players.length;
  }

  checkAllPlayersRolled() {
    const rolled = this.playersData.filter((p) => p.state === GameState.ROLLED || p.diceNum === 0);
    console.log("checkAllPlayersRolled; " + rolled.length + " of " + this.playerService.players.length); // #DEBUG
    return rolled.length === this.playerService.players.length;
  }

  checkAllPlayersRevealing() {
    const revealed = this.playersData.filter((p) => p.state === GameState.REVEALING || p.state === GameState.REVEALED || p.diceNum === 0);
    console.log("checkAllPlayersRevealing; " + revealed.length + " of " + this.playerService.players.length); // #DEBUG
    return revealed.length === this.playerService.players.length;
  }

  checkAllPlayersRevealed() {
    const revealed = this.playersData.filter((p) => p.state === GameState.REVEALED || p.diceNum === 0);
    console.log("checkAllPlayersRevealed; " + revealed.length + " of " + this.playerService.players.length); // #DEBUG
    return revealed.length === this.playerService.players.length;
  }

  checkForWinnerPlayer() {
    let data = this.playersData.filter(d => d.diceNum > 0);
    if (data.length !== 1 || this.playersData.length !== this.playerService.players.length) {
      return null;
    }
    return this.playerService.getPlayerById(data[0].id);
  }

  paranoiaCheckPlayersDataConsistency() {
    this.playersData.forEach(pd => {
      if ((pd.state === GameState.ROLLING || pd.state === GameState.ROLLED)
        && pd.dice.length !== pd.diceNum) {
        console.log("! paranoiaCheckPlayersDataConsistency; throw!"); // #DEBUG
        throw 'Dice roll info is missing for player id: ' + pd.id + '. This should not happen!';
      } else if ((pd.state === GameState.REVEALING || pd.state === GameState.REVEALED)
        && (pd.dice.length !== pd.diceNum || pd.dice.indexOf('?') >= 0)) {
        console.log("! paranoiaCheckPlayersDataConsistency; throw!"); // #DEBUG
        throw 'Dice reveal info is missing for player id: ' + pd.id + '. This should not happen!';
      }
    });
  }

  get canRoll() {
    return this.playerData && this.playerData.state === GameState.ROLL && this.playerData.diceNum > 0;
  }

  findLastBet() {
    let prevPlayerIndex = this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
    if (prevPlayerIndex == null) {
      return null;
    }
    let prevPlayer = this.playerService.getPlayerByIndex(prevPlayerIndex);
    let prevPlayerData = this.findPlayersData(prevPlayer);
    return prevPlayerData ? prevPlayerData.bet : null;
  }

  isLastBetPlayerIndex(index) {
    return this.gameData && index === this.findPrevGoodPlayerIndex(this.gameData.playerTurn);
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
    if (!num || !val) {
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

  buildPlayersUI(){
    if (!this.playerUI) {
      this.playerUI = [];
    }
    this.playerUI.length = this.playerService.players.length;
    this.playerService.players.forEach((p, pIndex) => {
      this.buildPlayerUI(p, pIndex);
    });
    return this.playerUI;
  }

  buildPlayerUI(player, pIndex) {
    const playerData = player.id === this.playerService.player.id ? this.playerData : this.findPlayersData(player);
    if (!playerData) {
      return null;
    }
    if (!this.playerUI[pIndex]) {
      this.playerUI[pIndex] = {};
    }
    this.playerUI[pIndex].playerUI = player;
    this.playerUI[pIndex].diceNumUI = playerData.diceNum;
    this.playerUI[pIndex].betUI = playerData.bet;
    this.playerUI[pIndex].stateUI = playerData.state;
    for (let dIndex = 0; dIndex < 5; dIndex++) {
      this.buildDiceUI(player, playerData, pIndex, dIndex);
    }
    return this.playerUI[pIndex];
  }

  buildDiceUI(player, playerData, pIndex, dIndex){
    // store dice UI into local temporary cache
    let val = (playerData && dIndex < playerData.dice.length) ? playerData.dice[dIndex] : null;
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

  get diceInPlay() {
    return this.playersData.reduce((total, p) => total + p.diceNum, 0);
  }

  watchdogEndRound(delay) {
    if (this.watchdogER) {
      return;
    }
    this.watchdogER = this.gameBotService.watchdogCallback(delay || 8, (ts) => {
      // update UI
      this.watchdogERts = ts;
    }, (delay || this.playerData.botMode === this.gameBotService.BotMode.Ian) ? this.gameBotService.BotMode.Kevin : this.playerData.botMode);
    if (this.watchdogER) {
      console.log("* watchdogEndRound;");    // #DEBUG
      this.watchdogER.then(() => {
        this.endRound();
      });
    }
  }

  endRoundClick(){
    if (this.gameData.lastLoserTs) {
      let secs = (new Date().getTime() - this.gameData.lastLoserTs) / 1000;
      if (secs < 8) {
        this.watchdogEndRound(8 - secs);
        return;
      }
    }
    this.endRound();
  }

  endRound() {
    console.log("endRound; selfIndex=" + this.selfIndex);  // #DEBUG
    if (this.gameData.gameState !== GameState.REVEALED || !this.isSelfJustLost) {
      this.watchdogERts = null;
      this.watchdogER = null;
      throw "endRound; called during wrong state" +
      "; gameData.gameState=" + this.gameData.gameState +
      "; isSelfJustLost=" + this.isSelfJustLost +
      "; selfIndex=" + this.selfIndex +
      ". This should not happen!" // #DEBUG
    }
    if (this.watchdogER) {
      this.gameBotService.watchdogCancel(this.watchdogER);
    }
    this.stopSound();

    // advance player turn
    const wasTurn = this.gameData.playerTurn;
    this.gameData.playerTurn = this.gameData.nextPlayerTurn;
    if (this.gameData.playerTurn == null) {
      throw "endRound; bad next player turn; null; wasTurn=" + wasTurn + ". This should not happen!";  // #DEBUG
    }
    // reset last round info
    this.gameData.nextPlayerTurn = null;
    this.gameData.prevLoserIndex = this.gameData.lastLoserIndex;
    this.gameData.lastLoserIndex = null;
    this.gameData.lastBet = null;
    this.gameData.lastRoundLength = 0;
    this.gameData.totalRounds++;
    this.gameData.prompt = null;
    this.gameData.promptSub = null;
    this.gameData.gameState = GameState.ROLL; // go back to the first state
    return this.updateGameData().finally(() => {
      this.watchdogERts = null;
      this.watchdogER = null;
    });
  }

  watchdogRollDice() {
    if (this.watchdogRD) {
      return;
    }
    this.watchdogRD = this.gameBotService.watchdogCallback(5, (ts) => {
      // update UI
      this.watchdogRDts = ts;
    }, this.playerData.botMode === this.gameBotService.BotMode.Ian ? this.gameBotService.BotMode.Ian : this.gameBotService.BotMode.Kevin);  // always auto-roll
    if (this.watchdogRD) {
      console.log("* watchdogRollDice;");    // #DEBUG
      this.watchdogRD.then(() => {
        this.rollDice();
      });
    } else {
      this.playSound('dice_roll');
    }
  }

  rollDice() {
    if (this.atomicUpdate) {
      return;
    }
    if (this.watchdogRD) {
      this.gameBotService.watchdogCancel(this.watchdogRD);
    }
    this.stopSound('dice_roll');

    this.atomicUpdate = true;
    this.playerData.bet = null;
    this.playerData.dice = [];
    for (let i = 0; i < this.playerData.diceNum; i++) {
      this.playerData.dice.push(Math.floor(Math.random() * 6 + 1))
    }
    this.playerData.state = GameState.ROLLING;
    return this.updatePlayersData(this.makePublicPlayerData()).then(() => {
      return this.updatePlayerData();
    }).finally(() => {
      this.watchdogRDts = null;
      this.watchdogRD = null;
      this.atomicUpdate = false;
      if (this.pendingProcessGameDataChange) {
        return this.processGameDataChange();
      }
    });
  }

  loseDice() {
    if (this.atomicUpdate) {
      return;
    }
    console.log("We lost a dice!; selfIndex=" + this.selfIndex);  // #DEBUG
    this.atomicUpdate = true;
    if (this.playerData.diceNum > 0) {
      this.playerData.diceNum--;
    }
    this.playerData.state = GameState.DONE;  // done with this round

    this.gameData.lastBet = {num: this.dudo.bet_num, val: this.dudo.bet_val};
    this.gameData.lastLoserIndex = this.selfIndex;
    this.gameData.lastLoserTs = new Date().getTime();
    this.gameData.lastLoserStreek = (this.gameData.prevLoserIndex === this.gameData.lastLoserIndex) ? (this.gameData.lastLoserStreek + 1) : 1;
    this.gameData.prompt = `Bet ${this.dudo.bet_num} of ${this.dudo.bet_val}'s, revealed: ${this.dudo.total}.` +
      ` \"${this.playerService.player.name}\" loses a dice <i class="far fa-sad-tear"></i>`;
    this.gameData.promptSub = this.dudo.max_num ? `But there were also ${this.dudo.max_num} of ${this.dudo.max_val}'s!` : null;
    // find next player index turn
    if (this.playerData.diceNum > 0) {
      this.gameData.nextPlayerTurn = this.selfIndex;
    } else {
      this.gameData.nextPlayerTurn = this.findNextGoodPlayerIndex(this.selfIndex);
      if (this.gameData.nextPlayerTurn == null) {
        throw "loseDice; bad next player turn; null; wasTurn=" + this.gameData.playerTurn + ". This should not happen!";  // #DEBUG
      }
    }

    return this.updatePlayersData(this.makePublicPlayerData(false))
      .then(() => {
        return this.updateGameData();
      })
      .finally(() => {
        this.atomicUpdate = false;
        if (this.pendingProcessGameDataChange) {
          return this.processGameDataChange();
        }
      });
  }

  askBotBet() {    // UI only
    let allBets = this.playersData.filter(pd => pd.bet).map(pd => pd.bet);
    let aiBet = this.perudoBetBot(this.diceInPlay, this.playerData.dice,
      this.findLastBet(), allBets);
    if (!this.bet) {
      this.bet = {};
    }
    if (aiBet) {
      this.bet.num = aiBet.num; // UI
      this.bet.val = aiBet.val; // UI
      this.bet.bot = true; // UI
      this.bet.dudo = false; // UI
    } else {
      this.bet.bot = true; // UI
      this.bet.dudo = true; // UI
    }
  }

  watchdogMakeBet() {
    if (this.watchdogMB) {
      return;
    }
    this.watchdogMB = this.gameBotService.watchdogCallback(30, (ts) => {
      // update UI
      this.watchdogBMts = ts;
    }, this.playerData.botMode);
    if (this.watchdogMB) {
      console.log("* watchdogMakeBet;");    // #DEBUG
      this.watchdogMB.then(() => {
        let allBets = this.playersData.filter(pd => pd.bet).map(pd => pd.bet);
        let aiBet = this.perudoBetBot(this.diceInPlay, this.playerData.dice,
          this.findLastBet(), allBets);
        if (aiBet) {
          this.makeBet(aiBet.num, aiBet.val, true);
        } else {
          this.callDudo(true);
        }
      });
    }
  }

  makeBet(num, val, bot = false) {
    if (this.atomicUpdate) {
      return;
    }
    console.log("makeBet; " + num + " of " + val + "s; selfIndex=" + this.selfIndex);  // #DEBUG
    if (this.gameData.gameState !== GameState.ROLLED || !this.isSelfTurn || this.playerData.state !== GameState.TURN) {
      this.watchdogBMts = null;
      this.watchdogMB = null;
      throw "makeBet; called during wrong state" +
      "; gameData.gameState=" + this.gameData.gameState +
      "; isSelfTurn=" + this.isSelfTurn +
      "; playerData.state=" + this.playerData.state +
      "; selfIndex=" + this.selfIndex +
      ". This should not happen!"; // #DEBUG
    }
    if (this.watchdogMB) {
      this.gameBotService.watchdogCancel(this.watchdogMB);
    }
    if (this.bet) {
      this.bet.bot = null; // UI
      this.bet.dudo = null; // UI
    }

    this.atomicUpdate = true;
    this.playerData.bet = {
      num: num,
      val: val,
      bot: bot,
      dudo: false
    };
    this.playerData.state = GameState.ROLLED; // our turn is done

    const wasTurn = this.gameData.playerTurn;  // #DEBUG
    this.gameData.playerTurn = this.findNextGoodPlayerIndex(this.gameData.playerTurn);
    if (this.gameData.playerTurn == null) {
      throw "makeBet; bad next player turn; null; wasTurn=" + wasTurn + ". This should not happen!";  // #DEBUG
    }
    this.gameData.lastRoundLength++;

    return this.updatePlayersData(this.makePublicPlayerData())
      .then(() => {
        return this.updateGameData();
      })
      .finally(() => {
        this.watchdogBMts = null;
        this.watchdogMB = null;
        this.atomicUpdate = false;
        if (this.pendingProcessGameDataChange) {
          return this.processGameDataChange();
        }
      });
  }

  callDudo(bot = false) {
    if (this.atomicUpdate) {
      return;
    }
    console.log("callDudo; selfIndex=" + this.selfIndex);  // #DEBUG
    if (this.gameData.gameState !== GameState.ROLLED || !this.isSelfTurn || this.playerData.state !== GameState.TURN) {
      this.watchdogBMts = null;
      this.watchdogMB = null;
      throw "callDudo; called during wrong state" +
      "; gameData.gameState=" + this.gameData.gameState +
      "; isSelfTurn=" + this.isSelfTurn +
      "; playerData.state=" + this.playerData.state +
      "; selfIndex=" + this.selfIndex +
      ". This should not happen!"; // #DEBUG
    }
    if (this.watchdogMB) {
      this.gameBotService.watchdogCancel(this.watchdogMB);
    }
    if (this.bet) {
      this.bet.bot = null; // UI
      this.bet.dudo = null; // UI
    }

    this.atomicUpdate = true;
    this.playerData.bet = {
      bot: bot,
      dudo: true
    };
    this.playerData.state = GameState.ROLLED; // our turn is done

    this.gameData.gameState = GameState.REVEAL;

    return this.updatePlayersData(this.makePublicPlayerData())
      .then(() => {
        return this.updateGameData();
      })
      .finally(() => {
        this.watchdogBMts = null;
        this.watchdogMB = null;
        this.atomicUpdate = false;
        if (this.pendingProcessGameDataChange) {
          return this.processGameDataChange();
        }
      });
  }

  /**
   * This does not change state, can be run multiple times.
   * @returns true if dudo is good (total dice is less then was bet), less otherwise, null if no previous bet to dudo.
   */
  checkDudo() {
    console.log("* checkDudo;");  // #DEBUG
    const bet = this.findLastBet();
    if (!bet) {
      throw "No bet to dudo. That should not happen!";
    }
    // calculate total number diceOfInterest = bet.val
    // let total = 0;
    // this.playersData.forEach((p) => {
    //   total += p.dice.filter(d => d === bet.val || d === 1).length;
    // });
    // find total number of last bet dice value
    const total = this.countPlayersDiceVal(bet.val);
    // find potential maximum dice value
    let maxNum = 0;
    let maxVal = 0;
    for (let d = 1; d <= 6; d++) {
      let count = this.countPlayersDiceVal(d);
      if (maxVal !== 1 && (count > maxNum || (count === maxNum && d > maxVal))) {
        maxNum = count;
        maxVal = d;
      } else if (maxVal === 1 && (count >= (maxNum * 2 + 1))) {
        maxNum = count;
        maxVal = d;
      }
    }
    if (maxVal === bet.val || !this.validateBet(maxNum, maxVal)) {  // check if max found is better then the last bet
      maxNum = null;  // do not show sub prompt
      maxVal = null;
    }

    this.dudo = {   // just a temp variable to be sent on turn end
      bet_num: bet.num,
      bet_val: bet.val,
      bet_bot: bet.bot,
      total: total,
      max_num: maxNum,
      max_val: maxVal
    };

    console.log(`* checkDudo; last bet: ${bet.num} of ${bet.val}'s; revealed total=${total}`);  // #DEBUG
    //console.log("playersData: " + JSON.stringify(this.playersData)); // #DEBUG
    return total < bet.num;
  }

  countPlayersDiceVal(val) {
    return this.playersData.reduce((total1, pd) => {
      return pd.dice.reduce((total2, d) => {
        if (d === '?') {
          throw "checkDudo; Not all dice were revealed. That should not happen!";
        }
        return (d === val || d === 1) ? total2 + 1 : total2;
      }, total1);
    }, 0);
  }

  findPrevGoodPlayerIndex(index) {
    return super.findPrevGoodPlayerIndex(index, (playerData) => {
      return playerData.diceNum > 0;
    });
  }

  findNextGoodPlayerIndex(index) {
    return super.findNextGoodPlayerIndex(index, (playerData) => {
      return playerData.diceNum > 0;
    });
  }

  /** PUBLIC GAME DATA (mainly GAME STATE) **/

  syncGameData() {
    const initGameData = {
      gameState: GameState.ROLL,  // no game state yet, assume first round ROLL
      playerTurn: 0,
      lastRoundLength: 0,
      totalRounds: 0
    };
    return super.syncGameData(initGameData);
  }

  /** PERSONAL PLAYER DATA **/

  getPlayerData() {
    return super.getPlayerData().then(data => {
      this.playerData.dice = (data && data.dice) ? data.dice : []; // restore only player dice values from private data
    });
  }

  updatePlayerData() {
    const playerData = {
      dice: [...this.playerData.dice],  // store only player dice rolled values
    };
    return super.updatePlayerData(playerData);
  }

  /** PUBLIC PLAYERS DATA **/

  makePublicPlayerData(excludeDice = true) {
    const data = super.makePublicPlayerData();
    if (excludeDice) {
      data.dice = data.dice.map((d) => {
        return '?'
      });
    }
    return data;
  }

  syncPlayersData() {
    const initPlayersData = {
      diceNum: !this.playerService.isSpectator ? 5 : 0, // no dice for spectators
      dice: [],
      state: GameState.ROLL
    };
    return super.syncPlayersData(initPlayersData);
  }

  /**
   * Perudo betting AI aka "Crazy Ian"
   * @param totalDiceNum
   * @param selfDice
   * @param lastBet
   * @param allBets
   * @returns {{num: *, val: *}} or null for dudo
   */
  perudoBetBot(totalDiceNum, selfDice, lastBet, allBets) {
    let bluff = this.getRandomRange(0, 4) === 0;  // 33% bluff
    const avgNum = totalDiceNum / 3;
    if ((!lastBet && bluff)
      || (lastBet && bluff && lastBet.val > 1 && lastBet.num < avgNum * 0.8)
      || (lastBet && bluff && lastBet.val === 1 && lastBet.num < avgNum / 2 * 0.8)) {
      // bluff
      let val = this.getRandomRange(lastBet ? 1 : 2, 6);  // can not start with aces
      let num = this.getRandomRange(this.perudoFindMinLegalNumForVal(lastBet, val), avgNum);
      console.log("- AI; bluff=" + bluff + ", random bet: " + num + " of " + val + "'s");    // #DEBUG
      return {
        num: num,
        val: val
      };
    } else {
      // real bet
      let allBetsVal = allBets ? allBets.map(b => b.val) : [];
      let dNums = new Array(6);
      let maxVal = 0;
      let maxValNum = 0;
      for (let v = 1; v <= 6; v++) {
        if (!lastBet && v === 1) {
          continue; // can not start with aces
        }
        dNums[v - 1] = selfDice.reduce((total, d) => ((d === v || (!lastBet ? d === 1 : false)) ? total + 1 : total), 0);   // count our dice of this value
        dNums[v - 1] += allBetsVal.reduce((total, d) => ((d === v || (!lastBet ? d === 1 : false)) ? total + 0.5 : total), 0);  // others bets of the same value have some <1.0 weight
        if (dNums[v - 1] >= maxValNum) {
          maxValNum = dNums[v - 1];
          maxVal = v;
        }
      }
      let selfLastBetNum = lastBet ? selfDice.reduce((total, d) => ((d === lastBet.val || d === 1) ? total + 1 : total), 0) : 0;
      let minValNum = this.perudoFindMinLegalNumForVal(lastBet, maxVal);
      const minWeight = 1.3;  // bet is less then 30% over average  //TODO: adjust the weights
      const maxWeight = selfDice.length / totalDiceNum; // 0.5;  // we "counted" around X% of dice needed   //TODO: adjust the weights
      console.log("- AI; bluff=" + bluff + ", real bet candidate: " + minValNum + " of " + maxVal + "'s" +
        ", maxValNum=" + maxValNum + ", avgNum=" + avgNum);    // #DEBUG
      if (maxVal > 1 && minValNum <= avgNum) {
        return {
          num: this.getRandomRange(minValNum, avgNum),
          val: maxVal
        };
      }
      else if (maxVal === 1 && minValNum <= avgNum / 2) {
        return {
          num: this.getRandomRange(minValNum, avgNum / 2),
          val: maxVal
        };
      }
      else if (!lastBet   // can't dudo on a first round, bet something
        || (lastBet && lastBet.num <= selfLastBetNum) // can't dudo if we have all the last bet dice, bet something
        || (maxVal > 1 && minValNum < totalDiceNum && (minValNum < avgNum * minWeight && maxValNum > avgNum * maxWeight))
        || (maxVal === 1 && minValNum < totalDiceNum && (minValNum < avgNum / 2 * minWeight && maxValNum > avgNum / 2 * maxWeight))
      ) {
        return {
          num: minValNum,
          val: maxVal
        };
      } else if (minValNum < totalDiceNum && selfLastBetNum > avgNum * 0.3) {
        // we have some dice last ditch effort: switch to aces
        return {
          num: this.perudoFindMinLegalNumForVal(lastBet, 1),
          val: 1
        };
      } else {
        return null;
      }
    }
  }

  perudoFindMinLegalNumForVal(lastBet, val) {
    if (!lastBet) {
      return 1;
    }
    else if (val === 1 && lastBet.val > 1) {
      // new aces
      return Math.ceil(lastBet.num / 2);
    } else if (val === 1 && lastBet.val === 1) {
      // continue aces
      return lastBet.num + 1;
    } else if (val > lastBet.val && lastBet.val === 1) {
      // was aces back to regular
      return lastBet.num * 2 + 1;
    } else if (val <= lastBet.val) {
      // regular and less then last
      return lastBet.num + 1;
    } else if (val > lastBet.val) {
      // regular and more then last
      return lastBet.num;
    }
  }

  /** DEBUG ONLY! **/

  debugResetToLastRound() {
    this.alertService.message();
    this.playerData.diceNum = 1;
    this.playerData.dice = [];
    this.playerData.state = GameState.ROLL;
    this.updatePlayersData(this.makePublicPlayerData());
  }

  debugResetTurn(playerTurn = 0) {
    // reset players data
    this.alertService.message();
    this.playersData.forEach(pd => {
      pd.dice = [];
      pd.state = GameState.ROLL;
      pd.bet = null;
    });
    this.hostStorageService.set("playersData", this.playersData)
      .then(data => {
        // reset game data
        this.gameData.playerTurn = playerTurn;
        this.gameData.gameState = GameState.ROLL;
        return this.updateGameData();
      }).catch(err => {
      this.alertService.error(err);
    });
  }

  debugKickPlayerByName(name) {
    this.alertService.message();
    super.debugKickPlayerByName(name).then(() => {
      this.debugResetTurn(this.gameData.playerTurn);
    });
  }

  debugChangePlayerStateByName(name, state) {
    this.alertService.message();
    const p = this.playerService.players.find(p => p.name === name);
    if (!p) {
      throw 'No such player';
    }
    const playerData = this.findPlayersData(p);
    playerData.state = state;
    this.updatePlayersData(playerData);
  }
}