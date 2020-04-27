import {ChatController} from './chat-controller.js';

export const ChatComponent = {
  templateUrl: './chat/chat-component.html',
  controller: ChatController,
  bindings: {
    player: '<',
    chatName: '@'
  }
};