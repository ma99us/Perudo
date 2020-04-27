export class ChatController {
  constructor(API, HostStorageService, MessageBusService) {
    'ngInject';

    this.API = API;
    this.hostStorageService = HostStorageService;
    this.messageBusService = MessageBusService;

    this.messages = []; // chat messages
    this.players = [];
  }

  $onInit() {
    this.mbsEventsListener = this.messageBusService.on("session-event", (event, data) => {
      if (data.event === 'OPENED' && data.sessionId === this.hostStorageService.sessionId) {
        this.sendMessage(":HI:");
      } else if (data.event === 'ERROR') {
        this.onMessage("!! error: " + data.message);
      } else if (data.event === 'CLOSED') {
        let player = this.findPlayerBySessionId(data.sessionId);
        if (player) {
          this.onMessage({
            sessionId: player.sessionId,
            name: player.name,
            color: player.color,
            message: "-- left " + this.chatName + " chat --"
          });
          this.removePlayer(player);
        }
      }
    });
    this.mbsMessagesListener = this.messageBusService.on("session-message", (event, data) => {
      //console.log("session-message: " + data);
      let player = this.findPlayerBySessionId(data.sessionId);
      if (!player) {
        this.addPlayer(data.sessionId, data.name, data.color);
      }
      if (data.message === ":HI:") {
        data.message = "-- joined " + this.chatName + " chat --";
        this.onMessage(data);
      } else {
        if(!data.message.startsWith(': ')){
          data.message = ': ' + data.message;
        }
        this.onMessage(data);
      }
    });
  }

  $onDestroy() {
    if (this.mbsEventsListener) {
      this.mbsEventsListener();
    }
    if (this.mbsMessagesListener) {
      this.mbsMessagesListener();
    }
  }

  sendOnEnterKey($event, value) {
    const keyCode = $event.which || $event.keyCode;
    if (keyCode === 13) {
      this.sendMessage(value);
      $event.preventDefault();
    }
  }

  sendMessage(value) {
    if (!this.hostStorageService.sessionId || !value) {
      return;
    }
    const msg = {
      name: this.player.name || 'Anonymous',
      color: this.player.color || '',
      sessionId: this.hostStorageService.sessionId,
      message: value,
    };
    this.hostStorageService.sendMessage(msg);  // JSON.stringify({action: value})
    this.txt = null;
  }

  onMessage(message) {
    this.messages.push(message);

    window.setTimeout(function () {
      let elem = document.getElementById('messages');
      if (elem) {
        elem.scrollTop = elem.scrollHeight;
      }
    }, 500);
  }

  findPlayerByName(name) {
    return this.players.find((p) => p.name === name);
  }

  findPlayerBySessionId(sessionId) {
    return this.players.find((p) => p.sessionId === sessionId);
  }

  addPlayer(sessionId, name, color) {
    let player = {sessionId: sessionId, name: name, color: color};
    this.players.push(player);
    return player;
  }

  removePlayer(player) {
    let idx = this.players.findIndex((p) => p.sessionId === player.sessionId);
    if (idx < 0) {
      idx = this.players.findIndex((p) => p.name === player.name);
    }
    if (idx >= 0) {
      this.players = this.players.splice(idx, 1);
    }
  }

}