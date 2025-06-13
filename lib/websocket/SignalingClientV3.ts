import type {
  BaseMessageData,
  CallOptions,
  EventPayloads, // 导入新的事件映射
  SignalPostMessage,
  SignalReceverMessage,
  CreateEventData,
  // SignalingCallbacks, // 不再需要这个
} from '@/types/signal_v3';
import { newGuid } from '@/lib/util';

const coverIceServers = (config: string): RTCConfiguration => {
  return JSON.parse(config);
};

export class SignalingClientV3 {
  private ws: WebSocket | null = null;
  private serverUrlBase: string;
  public meid: string;
  // 使用 Map 存储事件监听器，key 是事件名，value 是回调函数数组
  private listeners: Map<keyof EventPayloads, Array<(data: any) => void>> =
    new Map();
  private connected: boolean = false;
  private pingInterval: number | null = null;
  // ... 其他属性保持不变
  private source: string = 'MainStream';
  private audioEnable: string = 'recvonly';
  private videoEnable: string = 'recvonly';
  private connectmode: string = 'live';
  private datachannelEnable: boolean = false;
  public to: string = '';
  private sessionId: string = '';

  constructor(serverUrlBase: string | undefined, meid: string) {
    // ... constructor 逻辑保持不变
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

  // --- 新增的事件监听方法 ---

  /**
   * 注册一个事件监听器 (Add Event Listener)
   * @param event 事件名称
   * @param callback 回调函数
   */
  public on<E extends keyof EventPayloads>(
    event: E,
    callback: (data: EventPayloads[E]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除一个事件监听器 (Remove Event Listener)
   * @param event 事件名称
   * @param callback 要移除的回调函数
   */
  public off<E extends keyof EventPayloads>(
    event: E,
    callback: (data: EventPayloads[E]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * 移除一个事件的所有监听器
   * @param event 事件名称
   */
  public removeAllListeners(event?: keyof EventPayloads): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 私有的事件触发器
   * @param event 事件名称
   * @param data 传递给回调的数据
   */
  private _emit<E extends keyof EventPayloads>(
    event: E,
    data: EventPayloads[E]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      // 创建一个副本以防止在迭代期间修改数组
      [...eventListeners].forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `[SignalingClient] Error in listener for event ':`,
            error
          );
        }
      });
    }
  }

  // --- 修改 connect 方法 ---

  // connect 不再需要 callbacks 参数
  connect(): Promise<void> {
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

      // this.callbacks = callbacks; // 移除这行
      const fullUrl = `${this.serverUrlBase}${
        this.serverUrlBase.endsWith('/') ? '' : '/'
      }signaling`;
      console.log(`[SignalingClient] Connecting to: ${fullUrl}.........`);
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[SignalingClient] WebSocket connection established.');
        this.connected = true;
        this._emit('connected', undefined); // 使用 _emit 触发 'connected' 事件
        this._sendPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event);
      };

      this.ws.onerror = (errorEvent) => {
        console.error('[SignalingClient] WebSocket error:', errorEvent);
        this.connected = false;
        this._emit('error', errorEvent); // 使用 _emit 触发 'error' 事件
        reject(errorEvent);
      };

      this.ws.onclose = (closeEvent) => {
        console.log(
          `[SignalingClient] WebSocket connection closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`
        );
        this.connected = false;
        this._emit('disconnected', closeEvent.reason); // 使用 _emit 触发 'disconnected' 事件
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(
            new Error(
              `WebSocket closed before opening. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`
            )
          );
        }
      };
    });
  }

  // --- 修改 _handleMessage 方法 ---

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
        // ... 其他 case
        // 将 this.callbacks.onEvent?.(data) 修改为 this._emit('event', data)

        // 示例：
        case '__answer':
          // this.callbacks.onAnswer?.(message.data);
          this._emit('answer', message.data); // 修改后
          break;

        case '_create':
          console.log('______signal v2 create___');
          if (typeof message.data.iceServers !== 'string') {
            throw new Error('Invalid iceServers data type');
          }
          const iceServersData = coverIceServers(message.data.iceServers);
          const createData = {
            ...message.data,
            iceServers: JSON.stringify(iceServersData),
          };
          // this.callbacks.onCreate?.(createData);
          this._emit('create', createData); // 修改后
          break;

        case '_offer':
          // this.callbacks.onOffer?.(message.data);
          this._emit('offer', message.data); // 修改后
          break;

        case '_ice_candidate':
          // this.callbacks.onDeviceIceCandidate?.(message.data);
          this._emit('deviceIceCandidate', message.data); // 修改后
          break;

        case '__ice_candidate':
          // this.callbacks.onClientIceCandidate?.(message.data);
          this._emit('clientIceCandidate', message.data); // 修改后
          break;

        case '__code_rate':
          this._emit('changeBitrate', message.data); // 修改后
          break;

        case '_pong':
          this._emit('pong', undefined); // 修改后
          break;
        // ... 其他 case 也做类似修改

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
      this._emit('error', String(error)); // 在出错时也触发 'error' 事件
    }
  }

  // ... 其他方法 (disconnect, sendOffer, sendAnswer 等) 保持不变 ...

  public disconnect() {
    console.log('断开连接++++1.0 ___v1');
    if (this.ws) {
      console.log('断开连接++++2.0 ___v1');
      this.ws.close();
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    // 确保在断开时也清除所有监听器，防止内存泄漏
    this.removeAllListeners();
    this.ws = null;
    this.connected = false;
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
    }
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Initiates a connection/session with a peer.
   * This sends the `_connectto` message. The server is expected to respond with `_create`
   * back to this client if the peer is available.
   */
  public initiateSession(peerId: string, sessionId: string) {
    this.to = peerId;
    this.sessionId = sessionId;
    this._sendMessage({
      event: '__connectto',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
      },
    });
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
    this.to = peerId;
    this.sessionId = sessionId;
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
    this._sendMessage({
      event: '__call',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        ...callData,
      },
    });
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
  public sendAnswer(sdp: string, answerType: RTCSdpType) {
    console.log('%c______发送answer_____', 'color:red', {
      d: {
        sdp,
        answerType,
        this: this,
      },
    });
    this._sendMessage({
      event: '__answer',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        sdp,
        type: answerType,
      },
    });
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

  public clientSendIceCandidate(candidateInfo: string) {
    this._sendMessage({
      event: '__ice_candidate',
      data: {
        ...this._buildBaseMessageData(),
        messageId: this._generateMessageId(),
        candidate: candidateInfo,
      },
    });
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
