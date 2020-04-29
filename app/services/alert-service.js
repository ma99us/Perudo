export class AlertService {
  constructor() {
    'ngInject';

    this.msg = null;
    this.level = null;

    // intercept all unhandled errors
    window.onerror = (errorMsg, url, lineNumber) => {
      const msg = `Error: ${errorMsg}; ${url}:${lineNumber}`;
      console.log(msg); // #DEBUG
      this.error(msg);
      return false;
    }
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