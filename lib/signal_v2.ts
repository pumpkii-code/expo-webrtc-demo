import type {
  BaseMessageData,
  CallOptions,
  SignalPostMessage,
  SignalReceverMessage,
  SignalingCallbacks,
} from '@/components/type/signal_v2';
import { newGuid } from './util';

// Helper for UUID generation (you might want a more robust library like `uuid`)
// function uuidv4(): string {
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
//     const r = (Math.random() * 16) | 0,
//       v = c === 'x' ? r : (r & 0x3) | 0x8;
//     return v.toString(16);
//   });
// }

// interface SignalingMessage {

//   event: string;
//   data: BaseMessageData & Record<string, any>;
// }

const coverIceServers = (config: string): RTCConfiguration => {
  return JSON.parse(config);
};

// let that: SignalingClientV2;

export class SignalingClientV2 {
  private ws: WebSocket | null = null;
  private serverUrlBase: string;
  public meid: string; // ID of this client
  private callbacks: SignalingCallbacks = {};
  private connected: boolean = false;
  private pingInterval: number | null = null;
  private source: string = 'MainStream';
  private audioEnable: string = 'recvonly';
  private videoEnable: string = 'recvonly';
  private connectmode: string = 'live';
  private datachannelEnable: boolean = false;
  public to: string = '';
  private sessionId: string = '';

  constructor(serverUrlBase: string | undefined, meid: string) {
    if (!serverUrlBase) {
      throw new Error('WebSocket URL base is required');
    } else {
      console.log(
        `%c____当前连接的 ws 是: __${serverUrlBase}`,
        'background-color:green;color:aqua'
      );
    }
    if (
      !serverUrlBase.startsWith('wss://') &&
      !serverUrlBase.startsWith('ws://')
    ) {
      console.warn(
        'WebSocket URL base does not start with ws:// or wss://. Prepending wss://'
      );
      this.serverUrlBase = `wss://${serverUrlBase}`;
    } else {
      this.serverUrlBase = serverUrlBase;
    }

    this.meid = meid;
    console.log('_____this.meid_____', this.meid);
  }

  private _generateMessageId(): string {
    return newGuid();
  }

  private _buildBaseMessageData(): // peerId: string,
  // sessionId: string
  Omit<BaseMessageData, 'messageId'> {
    return {
      sessionId: this.sessionId,
      sessionType: 'IE',
      from: this.meid,
      to: this.to,
    };
  }

  private _sendPing() {
    this.pingInterval = setInterval(() => {
      this._sendMessage({
        event: '__ping',
        data: {
          timestamp: new Date().getTime(),
        },
      });
    }, 20000);
  }

  private _sendMessage(payload: SignalPostMessage | SignalReceverMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(
        '%c______sendmessage......... XD...:  ' + payload.event,
        'background-color:green;color:aqua',

        payload
      );
      const messageStr = JSON.stringify(payload);
      this.ws.send(messageStr);
    } else {
      console.error(
        '[SignalingClient] WebSocket not open. Cannot send message:',
        payload
      );
      this.callbacks.onError?.('WebSocket not open');
    }
  }

  connect(callbacks: SignalingCallbacks = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING)
      ) {
        console.warn('[SignalingClient] Already connected or connecting.');
        if (this.ws.readyState === WebSocket.OPEN) resolve();
        return;
      }

      this.callbacks = callbacks;
      const fullUrl = `${this.serverUrlBase}${
        this.serverUrlBase.endsWith('/') ? '' : '/'
      }signaling`; // ${this.meid}
      console.log(`[SignalingClient] Connecting to: ${fullUrl}.........`);
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[SignalingClient] WebSocket connection established.');
        this.connected = true;
        this.callbacks.onConnected?.();
        this._sendPing();
        resolve();
      };
      this.ws.onmessage = (event) => {
        this._handleMessage(event);
      };

      this.ws.onerror = (errorEvent) => {
        console.error('[SignalingClient] WebSocket error:', errorEvent);
        this.connected = false;
        this.callbacks.onError?.(errorEvent);
        reject(errorEvent); // Reject promise on initial connection error
      };

      this.ws.onclose = (closeEvent) => {
        console.log(
          `[SignalingClient] WebSocket connection closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`
        );
        this.connected = false;
        this.callbacks.onDisconnected?.(closeEvent.reason);
        // If the promise hasn't resolved yet (e.g. immediate close after trying to open)
        if (this.ws?.readyState !== WebSocket.OPEN) {
          // Check if it didn't resolve via onopen
          reject(
            new Error(
              `WebSocket closed before opening. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`
            )
          );
        }
      };
    });
  }

  private _handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data as string) as
        | SignalReceverMessage
        | SignalPostMessage;
      console.log(
        `%c__收到websocket 事件_____ :` + message.event,
        'background-color:aqua;',
        message
      );
      switch (message.event) {
        // 下面这些全是 设备端 接收到的消息
        case '__call':
          this.callbacks.onCall?.(message.data);
          break;

        case '__answer':
          this.callbacks.onAnswer?.(message.data);
          break;
        // 下面这些全是 客户端 接收到的消息
        case '_create':
          console.log('______signal v2 create___');
          if (typeof message.data.iceServers !== 'string') {
            throw new Error('Invalid iceServers data type');
          }
          const iceServersData = coverIceServers(message.data.iceServers);

          this.callbacks.onCreate?.({
            ...message.data,
            iceServers: JSON.stringify(iceServersData),
          });
          break;

        case '_offer':
          this.callbacks.onOffer?.(message.data);
          break;

        case '_ice_candidate':
          const data = message.data;
          this.callbacks.onDeviceIceCandidate?.(data);
          break;

        case '__ice_candidate':
          this.callbacks.onClientIceCandidate?.(message.data);
          break;

        case '__code_rate':
          this.callbacks.onChangeBitrate?.(message.data);
          break;

        case '_pong':
          // console.log('____心肺复苏___');
          break;

        // 设备端断开连接
        case '_offline':
          break;

        case '_connectinfo':
          break;

        case '_disconnected':
          break;

        default:
          console.warn(
            '[SignalingClient] Received unknown message event:',
            message
          );
      }
    } catch (error) {
      console.error(
        '[SignalingClient] Error parsing message or in callback:',
        error
      );
      this.callbacks.onError?.(String(error));
    }
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  public disconnect() {
    console.log('断开连接++++1.0 ___v1');
    if (this.ws) {
      console.log('断开连接++++2.0 ___v1');
      this.ws.close();
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.ws = null;
    this.connected = false;
  }

  /**
   * Initiates a connection/session with a peer.
   * This sends the `_connectto` message. The server is expected to respond with `_create`
   * back to this client if the peer is available.
   */
  public initiateSession(peerId: string, sessionId: string) {
    this.to = peerId;
    this.sessionId = sessionId;
    const message: SignalPostMessage = {
      event: '__connectto',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    };
    this._sendMessage(message);
  }

  public registerViewerId(viewerId: string) {
    const message: SignalPostMessage = {
      event: '__registerViewerId',
      data: {
        viewerId: viewerId,
      },
    };
    this._sendMessage(message);
  }

  public registerDevice() {
    const message: SignalReceverMessage = {
      event: '_register',
      data: { peerId: this.meid },
    };

    this._sendMessage(message);
  }

  /**
   * Sends a `_call` command, typically after receiving `_create`.
   * (Used in Device-Initiates-Offer flow, where Browser calls Device)
   */
  public sendCall(
    peerId: string,
    sessionId: string,
    options: CallOptions = {}
  ) {
    const datachannel = options.datachannelEnable ? 'true' : 'false';
    const callData = {
      mode: this.connectmode,
      source: this.source,
      datachannel: this.datachannelEnable ? 'true' : 'false',
      audio: this.audioEnable,
      video: this.videoEnable,
      ...{
        user: options.user ?? '',
        pwd: options.pwd ?? '',
        iceservers: options.iceServers ?? '',
      }, // Usually true for video calls
    } as const;
    // if (options.user) callData.user = options.user;
    // if (options.pwd) callData.pwd = options.pwd;
    // if (options.iceServers) {
    //   // The PDF states: "iceservers": JSON.stringify(configuration)
    //   // Assuming `configuration` means the ICE servers array.
    //   callData.iceservers = options.iceServers;
    // }

    const message: SignalPostMessage = {
      event: '__call',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        ...callData,
      },
    };
    this._sendMessage(message);
  }

  /**
   * Sends an SDP offer.
   * (Used in Browser-Initiates-Offer flow)
   */
  public sendOffer(
    {
      sdp,
      peerId,
      sessionId,
      state,
    }: {
      sdp: string;
      peerId: string;
      sessionId: string;
      state?: string;
    } /* for Alexa compatibility */
  ) {
    this.sessionId = sessionId;
    this.to = peerId;
    const message: SignalReceverMessage = {
      event: '_offer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp: sdp,
        type: 'offer', // Type is explicitly "offer"
        state: 'successed',
        iceservers: '',
      },
    };

    this._sendMessage(message);
  }

  /**
   * Sends an SDP answer.
   */
  public sendAnswer(
    sdp: string,
    answerType: RTCSdpType
    // peerId: string,
    // sessionId: string
  ) {
    console.log('_____sendAnswer_____', this);
    const message: SignalPostMessage = {
      event: '__answer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp: sdp,
        type: answerType, // e.g., "answer"
      },
    };
    this._sendMessage(message);
  }

  public sendChangeBitrate(bitrate: number, peerId: string, sessionId: string) {
    const message: SignalPostMessage = {
      event: '__code_rate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        bitrate: bitrate,
      },
    };
    this._sendMessage(message);
  }

  /**
   * Sends an ICE candidate.
   * @param candidate The RTCIceCandidate object or its JSON representation.
   * @param sdpMLineIndex The sdpMLineIndex from the candidate.
   * @param peerId The ID of the peer.
   * @param sessionId The current session ID.
   */
  public clientSendIceCandidate(candidateInfo: string) {
    const message: SignalPostMessage = {
      event: '__ice_candidate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        candidate: candidateInfo,
      },
    };
    this._sendMessage(message);
  }

  public deviceSendIceCandidate(
    candidateInfo: string,
    peerId: string,
    sessionId: string
  ) {
    const message: SignalReceverMessage = {
      event: '_ice_candidate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        candidate: candidateInfo,
      },
    };
    this._sendMessage(message);
  }

  /**
   * Sends a generic message to the device (as per PDF pg 8, `_post_message`).
   */
  // public postMessage(messageContent: any, peerId: string, sessionId: string) {
  //   const message = {
  //     event: '_post_message',
  //     data: {
  //       ...this._buildBaseMessageData(peerId, sessionId),
  //       messageId: this._generateMessageId(),
  //       message: messageContent,
  //     },
  //   };
  //   this._sendMessage(message);
  // }

  /**
   * Initiates a session disconnection from this client's side (Browser initiated, PDF pg 11).
   * Sends `_disconnected`. The server should then inform the other party.
   */
  public disconnectSession(peerId: string, sessionId: string) {
    const message: SignalPostMessage = {
      event: '__disconnected', // As per PDF pg 11 for browser-initiated disconnect
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    };
    this._sendMessage(message);
  }
}

// Example Usage (Conceptual - you'll integrate this with your WebRTC logic)
/*
const myId = "browser123";
const targetDeviceId = "device789";
const signalingClient = new SignalingClient("wss://your-server.com/signal", myId);

const currentSessionId = uuidv4(); // Application manages session IDs

signalingClient.connect({
  onConnected: () => {
    console.log("Signaling connected!");
    // Example: Browser initiates offer flow
    signalingClient.initiateSession(targetDeviceId, currentSessionId);
  },
  onCreate: (iceServers, state, from, sessionId) => {
    console.log("Received _create:", { iceServers, state, from, sessionId });
    if (sessionId === currentSessionId && from === targetDeviceId) {
      // Now we have ICE servers, we can prepare and send an offer
      // pc.setConfiguration({ iceServers });
      // const offer = await pc.createOffer();
      // await pc.setLocalDescription(offer);
      // signalingClient.sendOffer(offer.sdp, targetDeviceId, currentSessionId);
    }
  },
  onAnswer: (sdp, type, from, sessionId) => {
    console.log("Received answer:", { sdp, type, from, sessionId });
    if (sessionId === currentSessionId && from === targetDeviceId) {
      // await pc.setRemoteDescription({ type: 'answer', sdp });
    }
  },
  onCandidate: (candidate, sdpMLineIndex, from, sessionId) => {
    console.log("Received ICE candidate:", { candidate, sdpMLineIndex, from, sessionId });
    if (sessionId === currentSessionId && from === targetDeviceId) {
      // const rtcCandidate = new RTCIceCandidate({ candidate: candidate, sdpMLineIndex: sdpMLineIndex });
      // await pc.addIceCandidate(rtcCandidate);
    }
  },
  onOffer: async (sdp, type, from, sessionId, state) => {
    console.log("Received offer:", { sdp, type, from, sessionId, state });
    if (sessionId === currentSessionId && from === targetDeviceId) {
        // This is for Device-Initiates-Offer flow, browser receives offer
        // await pc.setRemoteDescription({ type: 'offer', sdp });
        // const answer = await pc.createAnswer();
        // await pc.setLocalDescription(answer);
        // signalingClient.sendAnswer(answer.sdp, answer.type, targetDeviceId, currentSessionId);
    }
  },
  onDisconnected: (reason) => {
    console.log("Signaling disconnected:", reason);
  },
  onError: (error) => {
    console.error("Signaling error:", error);
  }
});

// WebRTC PeerConnection event for ICE candidates
// pc.onicecandidate = (event) => {
//   if (event.candidate) {
//     signalingClient.sendCandidate(event.candidate.toJSON(), event.candidate.sdpMLineIndex, targetDeviceId, currentSessionId);
//   }
// };
*/
