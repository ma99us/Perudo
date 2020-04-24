export const BotMode = {   // <-- Perudo game player states. FIXME: Am i forgetting anything?
  None: 'None',     // no AI
  Kevin: 'Kevin',   // slow acting AI, let's human think first
  Ian: 'Ian',       // fastest AI in the West
};

export class GameBotService {
  constructor($interval) {
    'ngInject';

    this.$interval = $interval;

    this.botMode = BotMode.Kevin;    // AI mode
  }

  get BotMode() {
    return BotMode;
  }

  /**
   * Cancel a watchdog.
   * @param watchdog promise returned by watchdogCallback() method
   */
  watchdogCancel(watchdog) {
    this.$interval.cancel(watchdog);
  }

  /**
   * Schedule a call back with a watchdog.
   * @param func callback once timer expires
   * @param delay in seconds
   * @param notify callback each second (optional)
   * @returns {*}
   */
  watchdogCallback(delay, notify = null) {
    if (!this.botMode || this.botMode === BotMode.None) {
      return null;
    }
    if (typeof delay === 'string') {
      delay = parseInt(delay);
    }
    else if (this.botMode === BotMode.Ian) {
      delay = Math.ceil(delay / 10);
    }
    const ts0 = new Date().getTime() + delay * 1000;
    return this.$interval(() => {
      notify(new Date(ts0 - new Date().getTime()));
    }, 1000, delay);
  }

  getRandomRange(from = 1, to = 6) {
    return Math.floor(Math.random() * (to + 1 - from) + from);
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
      || (lastBet && lastBet.val > 1 && lastBet.num < avgNum * 0.8)
      || (lastBet && lastBet.val === 1 && lastBet.num < avgNum / 2 * 0.8)) {
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
        dNums[v - 1] += allBetsVal.reduce((total, d) => ((d === v  || (!lastBet ? d === 1 : false))? total + 0.5 : total), 0);  // others bets of the same value have some <1.0 weight
        if (dNums[v - 1] >= maxValNum) {
          maxValNum = dNums[v - 1];
          maxVal = v;
        }
      }
      let selfLastBetNum = lastBet ? selfDice.reduce((total, d) => ((d === lastBet.val || d === 1) ? total + 1 : total), 0) : 0;
      let minValNum = this.perudoFindMinLegalNumForVal(lastBet, maxVal);
      console.log("- AI; bluff=" + bluff + ", real bet candidate: " + minValNum + " of " + maxVal + "'s" +
        ", maxValNum=" + maxValNum + ", avgNum=" + avgNum);    // #DEBUG
      if(maxVal > 1 && minValNum <= avgNum){
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
      } else if (selfLastBetNum > avgNum * 0.3)  {
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
}