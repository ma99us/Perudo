import {GameBoardController} from '/game/board/game-board-controller.js';

export const GameBoardComponent = {
  templateUrl: '/game/board/game-board-component.html',
  require: {
    game: '^^game'
  },
  controller: GameBoardController
};