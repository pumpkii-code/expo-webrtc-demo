import type {
  BaseMessageData,
  SignalPostMessage,
  SignalReceverMessage,
  IceServer,
  CreateReceverData,
  OfferReceverData,
  IceCandidateReceverData,
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

//   eventName: string;
//   data: BaseMessageData & Record<string, any>;
// }

const coverIceServers = (config: string): RTCConfiguration => {
  return JSON.parse(config);
};

export interface SignalingCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onError?: (error: Event | string) => void;

  // Called when the server acknowledges _connectto and provides ICE servers
  // This happens in both "Device Initiates Offer" and "Browser Initiates Offer" flows,
  // sent to the party that initiated the _connectto.
  onCreate?: (data: BaseMessageData & CreateReceverData) => void;
  onOffer?: (data: BaseMessageData & OfferReceverData) => void;
  onAnswer?: (data: BaseMessageData) => void;
  onCandidate?: (data: BaseMessageData & IceCandidateReceverData) => void;

  // Browser to Device message (as per PDF pg 8)
  onPostMessage?: (message: any, from: string, sessionId: string) => void;
  // Response to a _post_message sent by this client
  onPostMessageResponse?: (
    message: any,
    result: any,
    from: string,
    sessionId: string
  ) => void;

  // When the peer actively disconnects the session (PDF pg 10, device initiated _session_disconnected)
  onSessionDisconnected?: (
    message: string | undefined,
    from: string,
    sessionId: string
  ) => void;
  // When the peer actively disconnects using _disconnected (PDF pg 11, browser initiated)
  // This is likely received by the *other* party after one party sends _disconnected
  onPeerDisconnected?: (
    from: string,
    sessionId: string,
    message?: string
  ) => void;
}

export interface CallOptions {
  datachannelEnable?: boolean;
  audioEnable?: 'recvonly';
  videoEnable?: 'recvonly';
  user?: string;
  pwd?: string;
  iceServers?: string;
}

export class SignalingClientV2 {
  private ws: WebSocket | null = null;
  private serverUrlBase: string;
  private meid: string; // ID of this client
  private callbacks: SignalingCallbacks = {};
  private connected: boolean = false;

  constructor(serverUrlBase: string, meid: string) {
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
  }

  private _generateMessageId(): string {
    return newGuid();
  }

  private _buildBaseMessageData(
    peerId: string,
    sessionId: string
  ): Omit<BaseMessageData, 'messageId'> {
    return {
      sessionId,
      sessionType: 'IE',
      from: this.meid,
      to: peerId,
    };
  }

  private _sendMessage(payload: SignalPostMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(
        '%c______sendmessage......... XD...:  ' + payload.eventName,
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
      }wswebclient/${this.meid}`;
      console.log(`[SignalingClient] Connecting to: ${fullUrl}.........`);
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[SignalingClient] WebSocket connection established.');
        this.connected = true;
        this.callbacks.onConnected?.();
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
      const message = JSON.parse(event.data as string) as SignalReceverMessage;
      console.log(
        `%c__收到websocket 事件_____ :` + message.eventName,
        'background-color:aqua;',
        message
      );
      switch (message.eventName) {
        case '_create':
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
          this.callbacks.onCandidate?.(data);
          break;

        case '_ping':
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
    if (this.ws) {
      this.ws.close();
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
    const message: SignalPostMessage = {
      eventName: '__connectto',
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
        messageId: this._generateMessageId(),
      },
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
    mode: 'live' | 'play',
    source: 'MainStream', // MainStream, SubStream, or filename
    options: CallOptions = {}
  ) {
    const datachannel = options.datachannelEnable ? 'true' : 'false';
    const callData = {
      mode: mode,
      source: source,
      datachannel: datachannel,
      audio: options.audioEnable ?? 'recvonly',
      video: options.videoEnable ?? 'recvonly',
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
      eventName: '__call',
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
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
    sdp: string,
    peerId: string,
    sessionId: string,
    state?: string /* for Alexa compatibility */
  ) {
    const offerData: any = {
      sdp: sdp,
      type: 'offer', // Type is explicitly "offer"
    };
    if (state) offerData.state = state;

    const message: SignalPostMessage = {
      eventName: '__offer',
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
        messageId: this._generateMessageId(),
        ...offerData,
      },
    };
    this._sendMessage(message);
  }

  /**
   * Sends an SDP answer.
   */
  public sendAnswer(
    sdp: string,
    answerType: string,
    peerId: string,
    sessionId: string
  ) {
    const message: SignalPostMessage = {
      eventName: '__answer',
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
        messageId: this._generateMessageId(),
        sdp: sdp,
        type: answerType, // e.g., "answer"
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
  public sendIceCandidate(
    candidateInfo: string,
    peerId: string,
    sessionId: string
  ) {
    const message: SignalPostMessage = {
      eventName: '__ice_candidate',
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
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
  //     eventName: '_post_message',
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
      eventName: '__disconnected', // As per PDF pg 11 for browser-initiated disconnect
      data: {
        ...this._buildBaseMessageData(peerId, sessionId),
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
