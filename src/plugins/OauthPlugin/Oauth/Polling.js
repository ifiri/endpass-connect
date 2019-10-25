// @ts-check
import ConnectError from '@endpass/class/ConnectError';
import queryStringToMap from '@endpass/utils/queryStringToMap';

const { ERRORS } = ConnectError;
const replaceReg = /^#\/?/;
const CHECK_TIMEOUT = 500;

export default class Polling {
  /**
   * @param {import('@/plugins/OauthPlugin/FrameStrategy').default} frame Frame Strategy for show frame
   */
  constructor(frame) {
    this.frame = frame;
    this.intervalId = null;
  }

  /**
   *
   * @param {string} url
   * @return {Promise<object>}
   */
  getResult(url) {
    return new Promise((resolve, reject) => {
      this.intervalId = window.setInterval(() => {
        const { target } = this.frame;
        try {
          if (!target || target.closed !== false) {
            this.close();

            reject(ConnectError.create(ERRORS.POPUP_CLOSED));

            return;
          }

          if (
            target.location.href === url ||
            target.location.pathname === 'blank'
          ) {
            return;
          }

          const targetHash = target.location.hash.replace(replaceReg, '');
          const targetSearch = target.location.search.replace(replaceReg, '');

          const params = queryStringToMap(targetHash || targetSearch);

          if (Object.keys(params).length === 0) {
            return;
          }

          resolve(params);
          this.close();
        } catch (error) {}
      }, CHECK_TIMEOUT);
    });
  }

  close() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.frame.close();
  }
}