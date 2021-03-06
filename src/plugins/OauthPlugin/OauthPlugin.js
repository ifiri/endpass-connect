// @ts-check

import CrossWindowMessenger from '@endpass/class/CrossWindowMessenger';
import OauthPkceStrategy from '@/plugins/OauthPlugin/Oauth/OauthPkceStrategy';
import Oauth from '@/plugins/OauthPlugin/Oauth';
import PluginBase from '../PluginBase';
import { DialogPlugin } from '@/plugins/DialogPlugin';
import { MessengerGroupPlugin } from '@/plugins/MessengerGroupPlugin';
import { DocumentPlugin } from '@/plugins/DocumentPlugin';
import OauthApi from '@/plugins/OauthPlugin/OauthPublicApi';
import { DIRECTION, PLUGIN_METHODS, PLUGIN_NAMES } from '@/constants';
import oauthHandlers from '@/plugins/OauthPlugin/oauthHandlers';
import FrameStrategy from '@/plugins/OauthPlugin/FrameStrategy';

const documentsCheckReg = /\/documents$/gi;

export default class OauthPlugin extends PluginBase {
  /**
   * @returns {string}
   */
  static get pluginName() {
    return PLUGIN_NAMES.OAUTH;
  }

  /**
   * @returns {OauthHandlers}
   */
  static get handlers() {
    return oauthHandlers;
  }

  /**
   * @returns {[typeof DialogPlugin, typeof MessengerGroupPlugin, typeof DocumentPlugin]}
   */
  static get dependencyPlugins() {
    return [DialogPlugin, MessengerGroupPlugin, DocumentPlugin];
  }

  /**
   * @returns {typeof OauthApi}
   */
  static get publicApi() {
    return OauthApi;
  }

  /**
   * @returns {CrossWindowMessenger}
   */
  get messenger() {
    if (!this.oauthMessenger) {
      this.oauthMessenger = new CrossWindowMessenger({
        // showLogs: !ENV.isProduction,
        name: 'connect-oauth-iframe[]',
        to: DIRECTION.AUTH,
        from: DIRECTION.CONNECT,
      });
    }

    return this.oauthMessenger;
  }

  /**
   * @param {OauthPluginOptions} options
   * @param {Context} context
   */
  constructor(options, context) {
    super(options, context);

    const { clientId, oauthServer, scopes, isPopup } = options;

    this.frameStrategy = new FrameStrategy({
      isPopup,
    });

    this.frameStrategy.on(
      FrameStrategy.EVENT_UPDATE_TARGET,
      /** @param {ContextWindow} target */ target => {
        this.messenger.setTarget(target);
      },
    );

    const oauthStrategy = new OauthPkceStrategy({
      context,
    });

    this.oauthRequestProvider = new Oauth({
      clientId,
      oauthServer,
      scopes,
      oauthStrategy,
      frameStrategy: this.frameStrategy,
    });
  }

  /**
   * @param {ContextWindow} [source]
   * @returns {boolean}
   */
  isSourceEqualTarget(source) {
    return source === this.frameStrategy.target;
  }

  /**
   * @returns {void}
   */
  handleReadyFrame() {
    this.frameStrategy.handleReady();
  }

  /**
   * @returns {void}
   */
  connectionOpen() {
    this.frameStrategy.connectionOpen();
  }

  /**
   * @returns {void}
   */
  connectionError() {
    this.frameStrategy.connectionError();
  }

  /**
   * @param {OauthResizeFrameEventPayload} payload
   * @returns {void}
   */
  resizeFrame(payload) {
    this.frameStrategy.handleResize(payload);
  }

  /**
   * @returns {void}
   */
  handleCloseFrame() {
    this.frameStrategy.close();
  }

  /**
   * @param {object} params
   * @param {number} params.code
   * @param {string} params.hash
   */
  changeAuthStatus({ code, hash }) {
    this.oauthRequestProvider.changeAuthStatus({ code, hash });
  }

  /**
   * @returns {void}
   */
  logout() {
    this.oauthRequestProvider.dropToken();
  }

  /**
   * @param {OauthRequestOptions} options
   * @returns {Promise<any>}
   */
  async request(options) {
    let result = await this.oauthRequestProvider.request(options);
    const { data } = result || {};

    if (
      data &&
      !data.length &&
      options.url &&
      options.url.search(documentsCheckReg) !== -1
    ) {
      try {
        await this.context.executeMethod(
          PLUGIN_METHODS.CONTEXT_CREATE_DOCUMENT,
        );
        result = await this.oauthRequestProvider.request(options);
      } catch (e) {}
    }

    return result;
  }
}
