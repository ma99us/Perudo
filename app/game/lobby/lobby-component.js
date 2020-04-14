import {LobbyController} from '/game/lobby/lobby-controller.js';

export const LobbyComponent = {
  templateUrl: '/game/lobby/lobby-component.html',
  require: {
    game: '^^game'
  },
  controller: LobbyController
};