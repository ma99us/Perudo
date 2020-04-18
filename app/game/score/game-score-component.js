import {GameScoreController} from './game-score-controller.js';

export const GameScoreComponent = {
  templateUrl: './game/score/game-score-component.html',
  require: {
    game: '^^game'
  },
  controller: GameScoreController
};