import ConnectError from '@endpass/class/ConnectError';
import Connect from '@/Connect';
import { INPAGE_EVENTS, METHODS } from '@/constants';
import privateFields from '@/privateFields';
import RequestProcess from '@/streams/inpageProvider/middleware/netRequest/RequestProcess';

const { ERRORS } = ConnectError;

describe('Request process middleware', () => {
  let reqProcess;
  let connect;
  let context;
  const emitter = {
    emit: jest.fn(),
  };

  beforeAll(() => {
    window.open = jest.fn();
    jest.useFakeTimers();
    connect = new Connect({
      authUrl: 'http://localhost:5000',
      oauthClientId: 'xxxxxxxxxxxxxxx',
    });
    context = connect[privateFields.context];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reqProcess = new RequestProcess({ context });
  });

  describe('processRequest', () => {
    beforeEach(() => {
      reqProcess = new RequestProcess({ context });
      reqProcess.sendResponse = jest.fn();
    });

    it('should process current request with sign if request in whitelist and send response', async () => {
      expect.assertions(2);

      const request = {
        method: 'personal_sign',
      };

      reqProcess.currentRequest = request;

      reqProcess.sign = jest.fn(() => ({
        ...request,
        signed: true,
      }));

      await reqProcess.start();

      expect(reqProcess.sign).toBeCalled();
      expect(reqProcess.sendResponse).toBeCalledWith({
        ...request,
        signed: true,
      });
    });

    it('should send current request to network and send response', async () => {
      expect.assertions(2);

      const request = {
        method: 'eth_some',
      };

      reqProcess.currentRequest = { ...request };
      reqProcess.sendToNetwork = jest.fn(() => ({
        ...request,
        signed: true,
      }));

      await reqProcess.start();

      expect(reqProcess.sendToNetwork).toBeCalled();
      expect(reqProcess.sendResponse).toBeCalledWith({
        ...request,
        signed: true,
      });
    });

    it('should handle errors and send response with empty result and error', async () => {
      expect.assertions(2);

      const request = {
        method: 'eth_some',
      };
      const error = new Error('foo');

      reqProcess.currentRequest = { ...request };
      reqProcess.sendToNetwork = jest.fn().mockRejectedValue(error);

      await reqProcess.start();

      expect(reqProcess.sendToNetwork).toBeCalled();
      expect(reqProcess.sendResponse).toBeCalledWith({
        ...request,
        result: null,
        error,
      });
    });
  });

  describe('processWhitelistedRequest', () => {
    beforeEach(() => {
      reqProcess.sign = jest.fn();
      reqProcess.recover = jest.fn();
    });

    it('should call recover private method if request method is personal_ecRecover', () => {
      const request = {
        method: 'personal_ecRecover',
      };

      reqProcess.currentRequest = request;
      reqProcess.processWhitelistedRequest();

      expect(reqProcess.recover).toBeCalled();
      expect(reqProcess.sign).not.toBeCalled();
    });

    it('should call sign private method in other cases', () => {
      const request = {
        method: 'personal_sign',
      };

      reqProcess.currentRequest = request;
      reqProcess.processWhitelistedRequest();

      expect(reqProcess.recover).not.toBeCalled();
      expect(reqProcess.sign).toBeCalled();
    });
  });

  describe('sendResponse', () => {
    it('should send response via emitter', () => {
      const payload = {
        foo: 'bar',
      };

      context.getEmitter = () => emitter;
      reqProcess.sendResponse(payload);

      expect(emitter.emit).toBeCalledWith(
        INPAGE_EVENTS.RESPONSE,
        payload,
      );
    });
  });

  // TODO: find right way to implement this test suite
  //     describe('sendToNetwork', () => {
  //       it('should send request to network with connect request provider', async () => {
  //         expect.assertions(2);
  //
  //         const request = {
  //           jsonrpc: '2.0',
  //           method: 'foo',
  //           params: [],
  //         };
  //         const requestProvider = {
  //           sendAsync: jest.fn().mockImplementation(
  //             (req,
  //             cb => {
  //               return ;
  //             }),
  //           ),
  //         };
  //
  //         connect.requestProvider = requestProvider;
  //         connect.currentRequest = request;
  //
  //         const res = await privateMethods.sendToNetwork();
  //
  //         expect(requestProvider.sendAsync).toBeCalledWith(
  //           request,
  //           expect.any(Function),
  //         );
  //         expect(res).toBe(true);
  //       });
  //     });

  describe('recover', () => {
    const request = {
      jsonrpc: '2.0',
      method: 'foo',
      params: [],
    };
    let dialog;

    beforeEach(() => {
      dialog = {
        ask: jest.fn(),
      };
      reqProcess.settings = {
        activeAccount: '0x0',
        activeNet: 1,
      };
      context.getDialog = () => dialog;
      reqProcess.currentRequest = request;
    });

    it('should recover request through bridge messaging', async () => {
      expect.assertions(1);

      dialog.ask.mockResolvedValueOnce({
        status: true,
        result: 'hello',
      });

      await reqProcess.recover();

      expect(dialog.ask).toBeCalledWith(METHODS.RECOVER, {
        address: '0x0',
        net: 1,
        request,
      });
    });

    it('should throw error is request recover status is falsy', () => {
      dialog.ask.mockResolvedValueOnce({
        status: false,
      });

      expect(reqProcess.recover()).rejects.toThrow();
    });
  });

  describe('sign', () => {
    const request = {
      jsonrpc: '2.0',
      method: 'foo',
      params: [],
    };
    let dialog;

    beforeEach(() => {
      dialog = {
        ask: jest.fn().mockResolvedValueOnce({
          status: true,
        }),
      };

      reqProcess.settings = {
        activeAccount: '0x0',
        activeNet: 1,
      };
      context.getDialog = () => dialog;
      reqProcess.currentRequest = request;
    });

    it('should requests account data, open sign dialog, await sign message and send message to dialog', async () => {
      expect.assertions(1);

      await reqProcess.sign();

      expect(dialog.ask).toBeCalledWith(METHODS.SIGN, {
        address: '0x0',
        net: 1,
        url: expect.any(String),
        request,
      });
    });

    it('should throw error is sign request status is falsy', async () => {
      expect.assertions(2);

      dialog.ask = jest.fn().mockResolvedValueOnce({
        status: false,
      });

      const err = new Error('Sign Error!');
      let check;
      try {
        await reqProcess.sign();
      } catch (e) {
        check = e;
      }

      expect(check).toEqual(err);
      expect(check.code).toEqual(ERRORS.SIGN);
    });
  });
});