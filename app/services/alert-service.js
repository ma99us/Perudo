export class AlertService {
  constructor() {
    'ngInject';

    this.msg = null;
    this.level = null;
  }

  message(message = null) {
    this.msg = message;
    this.level = 'MESSAGE';
  }

  warning(message = null) {
    this.msg = message;
    this.level = 'WARNING';
  }

  error(message = null) {
    this.msg = message;
    this.level = 'ERROR';
  }

  get alert() {
    return{
      level: this.level,
      message: this.msg,
      isMessage() {
        return this.level === 'MESSAGE' && this.message;
      },
      isError() {
        return this.level === 'ERROR' && this.message;
      },
      isWarning() {
        return this.level === 'WARNING' && this.message;
      }
    }
  }
}