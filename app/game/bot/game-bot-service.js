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
}