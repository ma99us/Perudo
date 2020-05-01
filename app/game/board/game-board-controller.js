import {AbstractGameBoardController} from "./abstract-game-board-controller.js";

export const GameState = {   // <-- Perudo game player states. FIXME: Am i forgetting anything?
  ROLL: 'ROLL',   // start new round, all players roll their dice
  ROLLED: 'ROLLED', // dice rolled, and waiting for others
  TURN: 'TURN',     // player's turn to make a decision; bet/dudo
  REVEAL: 'REVEAL', // dudo was called, reveal all dice
  REVEALED: 'REVEALED', // all dice revealed, loser loses a dice
  DONE: 'DONE'        // round ended for this player, ready for the next round
};

export class GameBoardController extends AbstractGameBoardController {
  constructor(API, HostStorageService, MessageBusService, AlertService, PlayerService, GameBotService) {
    'ngInject';

    super(API, HostStorageService, MessageBusService, AlertService, PlayerService, GameBotService);
  }

  get GameState() {
    return GameState;
  }

  /**
   * Main game state machine
   * @param newState
   */
  processGameDataChange() {
    if (!this.gameData || !this.playerData || !this.playersData || this.atomicUpdate) {
      return; // not fully initialized yet, or not ready to process state yet.
    }
    //console.log("* gameState=" + this.gameData.gameState);

    if (this.gameData.gameState === GameState.ROLL) {
      if (this.playerData.state !== GameState.ROLL && this.playerData.state !== GameState.ROLLED) {
        // reset previous round player data
        this.playerData.dice = [];
        return this.updatePlayerData().then(() => {
          this.playerData.bet = null;
          this.playerData.dice = [];
          if (this.playerData.diceNum > 0) {
            this.playerData.state = GameState.ROLL; // need to roll dice
          } else {
            this.playerData.state = GameState.ROLLED; // out of the game, just switch to next state
          }
          return this.updatePlayersData(this.makePublicPlayerData());
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
      if (this.isHost && this.checkAllPlayersRolled()) {
        // switch to next game state
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
      if (this.playerData.state === GameState.TURN) {
        this.watchdogMakeBet();
      }
    } else if (this.gameData.gameState === GameState.REVEAL) {
      console.log("* gameState=REVEAL: this.playerData.state=" + this.playerData.state);    // #DEBUG
      if (this.playerData.state !== GameState.REVEALED) {
        this.playerData.state = GameState.REVEALED;
        return this.updatePlayersData(this.makePublicPlayerData(false)); // reveal each player dice
      } else if (this.isHost && this.checkAllPlayersRevealed()) {
        // switch to next game state
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
          const dudoRes = this.checkDudo();
          if (dudoRes === true) {
            // Oh, no! dudo was good, we lost a dice
            return this.loseDice();
          } else if (dudoRes === false) {
            console.log("* Oof! We are lucky this turn");    // #DEBUG
            this.playerData.state = GameState.DONE;
            return this.updatePlayersData(this.makePublicPlayerData(false));
          }
        } else if (this.selfIndex === this.gameData.playerTurn) {
          // we just dodoed someone
          const dudoRes = this.checkDudo();
          if (dudoRes === false) {
            // Oh, no! dudo was bad, we lost a dice
            return this.loseDice();
          } else if (dudoRes === true) {
            console.log("* Oof! We are lucky this turn");    // #DEBUG
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
      console.log("* gameState=" + this.gameData.gameState + ": this.playerData.state=" + this.playerData.state);    // #DEBUG
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
    if (data.length !== 1 || this.playersData.length !== this.playerService.players.length) {
      return null;
    }
    return this.playerService.getPlayerById(data[0].id);
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

  getDice(player, pIndex, dIndex) {
    const playerData = player.id === this.playerService.player.id ? this.playerData : this.findPlayersData(player);
    if (!playerData) {
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

  get diceInPlay() {
    return this.playersData.reduce((total, p) => total + p.diceNum, 0);
  }

  watchdogEndRound() {
    if (this.watchdogER) {
      return;
    }
    this.watchdogER = this.gameBotService.watchdogCallback('8', (ts) => {  // hack to prevent AI to change the value
      // update UI
      this.watchdogERts = ts;
    });
    if (this.watchdogER) {
      console.log("* watchdogEndRound;");    // #DEBUG
      this.watchdogER.then(() => {
        this.watchdogERts = null;
        this.watchdogER = null;
        this.endRound();
      }).catch((err) => {
        this.watchdogERts = null;
        this.watchdogER = null;
      });
    }
  }

  endRound() {
    if (this.watchdogER) {
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

  watchdogRollDice() {
    if (this.watchdogRD) {
      return;
    }
    this.watchdogRD = this.gameBotService.watchdogCallback(5, (ts) => {
      // update UI
      this.watchdogRDts = ts;
    });
    if (this.watchdogRD) {
      console.log("* watchdogRollDice;");    // #DEBUG
      this.watchdogRD.then(() => {
        this.watchdogRDts = null;
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
    if (this.watchdogRD) {
      this.gameBotService.watchdogCancel(this.watchdogRD);
    }
    this.atomicUpdate = true;
    this.playerData.dice = [];
    for (let i = 0; i < this.playerData.diceNum; i++) {
      this.playerData.dice.push(Math.floor(Math.random() * 6 + 1))
    }
    this.updatePlayerData().then(() => {
      this.playerData.state = GameState.ROLLED;
      this.playerData.bet = null;
      this.updatePlayersData(this.makePublicPlayerData());
    }).finally(() => {
      this.atomicUpdate = false;
    });
  }

  loseDice() {
    console.log("Oh no! We lost a dice!");  // #DEBUG
    this.atomicUpdate = true;
    if (this.playerData.diceNum > 0) {
      this.playerData.diceNum--;
    }
    this.playerData.state = GameState.DONE;  // done with this round
    return this.updatePlayersData(this.makePublicPlayerData(false))
      .then(() => {
        this.gameData.lastBet = {num: this.dudo.bet_num, val: this.dudo.bet_val};
        this.gameData.lastLoserIndex = this.selfIndex;
        this.gameData.lastLoserStreek = (this.gameData.prevLoserIndex === this.gameData.lastLoserIndex) ? (this.gameData.lastLoserStreek + 1) : 1;
        this.gameData.prompt = `Bet ${this.dudo.bet_num} of ${this.dudo.bet_val}'s, revealed: ${this.dudo.total}.` +
          ` \"${this.playerService.player.name}\" loses a dice :-(`;
        // find next player index turn
        if (this.playerData.diceNum > 0) {
          this.gameData.nextPlayerTurn = this.selfIndex;
        } else {
          this.gameData.nextPlayerTurn = this.findNextGoodPlayerIndex(this.selfIndex);
        }
        this.updateGameData();
      })
      .finally(() => {
        this.atomicUpdate = false;
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
    this.watchdogMB = this.gameBotService.watchdogCallback(20, (ts) => {
      // update UI
      this.watchdogBMts = ts;
    });
    if (this.watchdogMB) {
      console.log("* watchdogMakeBet;");    // #DEBUG
      this.watchdogMB.then(() => {
        this.watchdogBMts = null;
        this.watchdogMB = null;
        let allBets = this.playersData.filter(pd => pd.bet).map(pd => pd.bet);
        let aiBet = this.perudoBetBot(this.diceInPlay, this.playerData.dice,
          this.findLastBet(), allBets);
        if (aiBet) {
          this.makeBet(aiBet.num, aiBet.val, true);
        } else {
          this.callDudo(true);
        }
      }).catch((err) => {
        this.watchdogBMts = null;
        this.watchdogMB = null;
      });
    }
  }

  makeBet(num, val, bot = false) {
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
    return this.updatePlayersData(this.makePublicPlayerData())
      .then(() => {
        console.log("was turn=" + this.gameData.playerTurn);  // #DEBUG
        this.gameData.playerTurn = this.findNextGoodPlayerIndex(this.gameData.playerTurn);
        console.log("now turn=" + this.gameData.playerTurn);  // #DEBUG
        this.gameData.lastRoundLength++;
        this.updateGameData();
      })
      .finally(() => {
        this.atomicUpdate = false;
      });
  }

  callDudo(bot = false) {
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
    return this.updatePlayersData(this.makePublicPlayerData())
      .then(() => {
        this.gameData.gameState = GameState.REVEAL;
        this.updateGameData();
      })
      .finally(() => {
        this.atomicUpdate = false;
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
      this.alertService.error("No bet to dudo. That should not happen!");
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
      bet_bot: bet.bot,
      total: total
    };
    //this.gameData.prompt = `Bet ${bet.num} of ${bet.val}'s, revealed: ${total}.`;
    return total < bet.num;
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

  getGameData() {
    const initGameData = {
      gameState: GameState.ROLL,  // no game state yet, assume first round ROLL
      playerTurn: 0,
      lastRoundLength: 0,
      totalRounds: 0
    };
    return super.getGameData(initGameData);
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

  getPlayersData() {
    const initPlayersData = {
      diceNum: !this.playerService.isSpectator ? 5 : 0, // no dice for spectators
      dice: [],
      state: GameState.ROLL
    };
    return super.getPlayersData(initPlayersData);
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
        || (maxVal > 1 && minValNum < totalDiceNum && (minValNum < avgNum * 1.3 && maxValNum > avgNum * 0.5))  //TODO: adjust the weights
        || (maxVal === 1 && minValNum < totalDiceNum && (minValNum < avgNum / 2 * 1.3 && maxValNum > avgNum / 2 * 0.5))
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
}