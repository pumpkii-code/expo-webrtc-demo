import {
  OfferReceverData,
  SignalingMessage,
  SignalingCallbacks,
} from '@/components/type/signal';
import { RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';

export class SignalingClient {
  private ws: WebSocket | null = null;
  private callbacks: SignalingCallbacks = {};

  constructor(private serverUrl: string) {}

  connect(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('已连接到信令服务器');
        this.callbacks.onConnected?.();
      };

      this.ws.onmessage = this.handleMessage.bind(this);

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        this.callbacks.onError?.('连接服务器失败');
      };

      this.ws.onclose = () => {
        console.log('与信令服务器断开连接');
        this.callbacks.onDisconnected?.();
      };
    } catch (err) {
      console.error('创建 WebSocket 连接错误:', err);
      this.callbacks.onError?.('无法连接到服务器');
    }
  }

  private async handleMessage(e: MessageEvent) {
    try {
      const { eventName, data } = JSON.parse(e.data) as SignalingMessage;
      console.log('收到消息:', eventName, { data });

      switch (eventName) {
        case '__registered':
          console.log('注册成功:', data);
          this.callbacks.onRegistered?.(); // 调用注册成功回调
          break;

        case '__incoming_connection':
          this.callbacks.onIncomingConnection?.(data);
          break;

        case '__offer':
          if (data.sdp) {
            console.log('%c____00010000___offer', data);
            this.callbacks.onOffer?.({
              type: 'offer',
              sdp: data.sdp,
              iceservers: data.iceservers, // 服务器端
              iceservers2: data.iceservers2, // 设备端
            });
          }
          break;

        case '__answer':
          if (data.sdp) {
            this.callbacks.onAnswer?.(
              new RTCSessionDescription({
                type: 'answer',
                sdp: data.sdp,
              }),
              data.from
            );
          }
          break;

        case '__candidate':
          if (data.candidate) {
            console.log('收到候选者______:', data);
            this.callbacks.onCandidate?.(
              new RTCIceCandidate(data.candidate),
              data.from
            );
          }
          break;
      }
    } catch (err) {
      console.error('处理消息错误:', err);
      this.callbacks.onError?.('处理消息时出错');
    }
  }

  register(peerId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          eventName: '__register',
          data: { peerId },
        })
      );
    }
  }

  connectTo(to: string, from: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('发送连接请求', to, from);
      this.ws.send(
        JSON.stringify({
          eventName: '__connectto',
          data: { from, to },
        })
      );
    }
  }

  sendOffer(sdp: string, to: string, iceservers: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('_____sendoffer______', {
        data: { sdp, to, iceservers2: iceservers },
      });
      this.ws.send(
        JSON.stringify({
          eventName: '__offer',
          data: { sdp, to, iceservers2: iceservers },
        })
      );
    }
  }

  sendAnswer(sdp: string, to: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          eventName: '__answer',
          data: { sdp, to },
        })
      );
    }
  }

  sendCandidate(candidate: RTCIceCandidate, to: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          eventName: '__candidate',
          data: { candidate, to },
        })
      );
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
