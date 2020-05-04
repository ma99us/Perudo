import {PlayerService} from "../../player-service.js";

export const BotNames = ['BOT Ian', 'BOT Kevin', 'BOT Stephan', 'BOT Alain', 'BOT Pascal'];
export const BotIds = [666661, 666662, 666663, 666664, 666665];

export class BotPlayerService extends PlayerService{
  constructor(LocalStorageService, API, HostStorageService, AlertService) {
    'ngInject';

    super(LocalStorageService, API, HostStorageService, AlertService)
  }

  /**
   * botId - one of special BOT ids: 666661, 666662, 666663, 666664, 666665
   * @param botNum
   */
  loadPlayer(botId) {
    //super.loadPlayer(gameName);
    const id = parseInt(botId);
    if (!id) {
      throw 'bad Bot id: ' + id;
    }
    const idx = BotIds.findIndex(i => i === id);
    const name = (idx >= 0 && idx < BotNames.length) ? BotNames[idx] : "BOT #" + id;
    this.player = {
      id: id,
      name: name,
      color: 'black',
      bot: true
    };
    return this.player;
  }
}