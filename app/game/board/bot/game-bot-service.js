import {BotIds} from "./bot-player-service.js";
import {BotPlayerService} from "./bot-player-service.js";

export const BotMode = {   // <-- Perudo game player states. FIXME: Am i forgetting anything?
  None: 'None',     // no AI
  Kevin: 'Kevin',   // slow acting AI, let's human think first
  Ian: 'Ian',       // fastest AI in the West
};

export class GameBotService {
  constructor($interval, PlayerService, LocalStorageService, API, HostStorageService, AlertService) {
    'ngInject';

    this.$interval = $interval;
    this.playerService = PlayerService;

    this.localStorageService = LocalStorageService;
    this.API = API;
    this.hostStorageService = HostStorageService;
    this.alertService = AlertService;

    this.botPlayerServices = [];   // headless bot players
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
  watchdogCallback(delay, notify, botMode) {
    if (!botMode || botMode === BotMode.None) {
      return null;
    }
    if (typeof delay === 'string') {
      delay = parseInt(delay);
    }
    else if (botMode === BotMode.Ian) {
      delay = Math.ceil(delay / 10);
    }
    const ts0 = new Date().getTime() + delay * 1000;
    return this.$interval(() => {
      if (notify) {
        notify(new Date(ts0 - new Date().getTime()));
      }
    }, 1000, delay);
  }

  checkBots(){
    const botPlayerIds = this.playerService.players.filter(p => p.bot).map(p => p.id);
    const botIds = this.botPlayerServices.map(ps => ps.player.id);
    botPlayerIds.forEach(botId => {
      if (botIds.indexOf(botId) < 0) {
        this.initBotPlayer(botId);
      }
    });
    // since bots do not call getPlayers, we need to update players lists manually in each bot player service
    this.botPlayerServices.forEach(ps => {
      ps.players = this.playerService.players;
    });
  }

  initBotPlayer(botId) {
    const botPlayerService = new BotPlayerService(this.localStorageService, this.API, this.hostStorageService, this.alertService);
    const botPlayer = botPlayerService.loadPlayer(botId);
    this.botPlayerServices.push(botPlayerService);
    console.log("Init BOT player: " + botPlayer.name);  // #DEBUG
    return botPlayer;
  }

  addBotPlayer() {
    const playerIds = this.playerService.players.map(p => p.id);
    const botId = BotIds.find(id => playerIds.indexOf(id) < 0);
    const botPlayer = this.initBotPlayer(botId);
    return this.playerService.updatePlayers(botPlayer);
  }

  removeBotPlayer(player) {
    const idx = this.botPlayerServices.findIndex(ps => ps.player.id === player.id);
    if (idx >= 0) {
      const delPs = this.botPlayerServices.splice(idx, 1);
      delPs[0].unloadPlayer();
    }
    return this.playerService.removePlayers(player);
  }
}