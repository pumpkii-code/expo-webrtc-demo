import {
  RTCPeerConnection,
  RTCView,
  MediaStream,
  RTCSessionDescription,
  MediaStreamTrack,
} from 'react-native-webrtc';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel.d.ts';
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent.d.ts';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent.d.ts';
import type RTCDataChannelEvent from 'react-native-webrtc/lib/typescript/RTCDataChannelEvent.d.ts';
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent.d.ts';

type CallState = 'idle' | 'creating' | 'active' | 'ending';
export type State = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: CallState;
};

// 定义一个回调函数的类型，用于通知状态更新
type StateChangeCallback = (state: State) => void;

export class WebRTCManagerInstance {
  private static instance: WebRTCManagerInstance | null = null;
  public  rtcManager = new WebRTCManager();
  private constructor() {}
  public static getInstance() {
    if (!WebRTCManagerInstance.instance) {
      WebRTCManagerInstance.instance = new WebRTCManagerInstance();
    }
    return WebRTCManagerInstance.instance;
  }


  public static replaceWebRtc(manager: WebRTCManager) {
    // 做释放
    if (WebRTCManagerInstance.instance?.rtcManager) {
      WebRTCManagerInstance.instance.rtcManager.hangUp();
    }
    
    if (WebRTCManagerInstance.instance) {
      WebRTCManagerInstance.instance.rtcManager = manager;
    }
  }
}


export class WebRTCManager {
  private webrtcClient: RTCPeerConnection | null = null;
  public videoStream: MediaStream | null = null;
  private deviceVideoTrack: MediaStreamTrack[] | null = null;
  private rtcDataChannel: RTCDataChannel | null = null;

  private state: State = {
    localStream: null,
    remoteStream: null,
    callState: 'idle',
  };

  // 观察者模式：存储所有订阅者（我们的 Hook）
  private subscribers = new Set<StateChangeCallback>();

  constructor() {
    // 私有化构造函数
  }

  // 订阅状态变化
  public subscribe(callback: StateChangeCallback): void {
    this.subscribers.add(callback);
    callback(this.state); // 立即发送当前状态
  }

  // 取消订阅
  public unsubscribe(callback: StateChangeCallback): void {
    this.subscribers.delete(callback);
  }

  // 通知所有订阅者状态已更新
  private notify(): void {
    this.subscribers.forEach((callback) => callback(this.state));
  }

  private setState(newState: Partial<State>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  // public static getInstance() {
  //   if (!WebRTCManager.instance) {
  //     WebRTCManager.instance = new WebRTCManager();
  //   }
  //   return WebRTCManager.instance;
  // }

  private onIcecandidate: ((message: string) => void) | null = null;
  public registerOnIcecandidate(sender: (message: string) => void) {
    this.onIcecandidate = sender;
  }

  private onCreateAnswer:
    | ((sdp: string, answerType: RTCSdpType) => void)
    | null = null;
  public registerOnCreateAnswer(
    sender: (sdp: string, answerType: RTCSdpType) => void
  ) {
    this.onCreateAnswer = sender;
  }

  private handleRtcDataChannelMessage = (event: MessageEvent<'message'>) => {
    // const message = JSON.parse(event.data as string);
    // const data = JSON.parse(message.data);
    // switch (message.type) {
    //   case 'changeBitrate':
    //     if (data.state === 'successed' && data.bitrate !== undefined) {
    //     }
    //     break;
    //   case 'webrtcInfo':
    //     setConnectedNumber(data.connectedNumber);
    //     break;
    //   default:
    //     console.log(
    //       '%c_____8.4____ 收到 未知的 事件',
    //       'background-color: chartreuse;',
    //       message
    //     );
    //     break;
    // }
  };

  private handleOnTrack = (event: RTCTrackEvent<'track'>) => {
    this.videoStream = event.streams[0];
    this.deviceVideoTrack = this.videoStream.getAudioTracks();
    this.deviceVideoTrack.forEach((track) => {
      track.enabled = false;
    });

    console.log(this.setState, this);

    this.setState({
      remoteStream: this.videoStream,
      callState: 'active',
    });
  };

  private handelDataChannel = (
    dataChannel: RTCDataChannelEvent<'datachannel'>
  ) => {
    this.rtcDataChannel = dataChannel.channel;
    this.rtcDataChannel?.addEventListener(
      'message',
      this.handleRtcDataChannelMessage
    );
  };

  private handleIceCandidate = (
    event: RTCIceCandidateEvent<'icecandidate'>
  ) => {
    if (event.candidate) {
      const candidate = JSON.stringify(event.candidate);
      if (this.onIcecandidate) {
        this.onIcecandidate(candidate);
      }
    }
  };

  private handleSignalingstatechange() {
    console.log(
      '%c_____7.3___ 收到 signalingstatechange 事件',
      'background-color: black; color: white'
    );
  }

  private handleConnectionStateChange() {
    const newState = this.webrtcClient?.connectionState;
    // setConnectionState(newState);
    if (newState === 'connected') {
      console.log(`____WebRTC connection established.`);
    } else if (newState === 'failed') {
      // setError(`WebRTC connection failed.`);
      // 可以在这里触发重连逻辑，或者让使用方处理
      // cleanupWebRTC(); // 如果连接失败，清理资源    } else if (newState === 'disconnected') {
      console.warn(
        `WebRTC connection disconnected. May recover or may need reconnection.`
      );
      // 'disconnected' 状态有时可以自动恢复，但如果长时间停留，也视为失败
    } else if (newState === 'closed') {
      console.log(`WebRTC connection closed.`);
      // cleanupWebRTC(); // 确保资源在关闭时被清理
    } else {
      // setError(null); // 清除旧的错误
    }
  }

  private handleIcegatheringstatechange() {
    console.log(
      '%c_____7.2___ 收到 icegatheringstatechange 事件',
      'background-color: black; color: white'
    );
  }
  private handleIceconnectionstatechange() {
    console.log(
      '%c_____7.3___ 收到 signalingstatechange 事件',
      'background-color: black; color: white'
    );
  }

  private addEventListenerToRTC() {
    this.webrtcClient?.addEventListener('track', this.handleOnTrack);
    this.webrtcClient?.addEventListener('datachannel', this.handelDataChannel);
    this.webrtcClient?.addEventListener(
      'icecandidate',
      this.handleIceCandidate
    );
    this.webrtcClient?.addEventListener(
      'signalingstatechange',
      this.handleSignalingstatechange
    );
    this.webrtcClient?.addEventListener(
      'connectionstatechange',
      this.handleConnectionStateChange
    );
    this.webrtcClient?.addEventListener(
      'icegatheringstatechange',
      this.handleIcegatheringstatechange
    );
    this.webrtcClient?.addEventListener(
      'iceconnectionstatechange',
      this.handleIceconnectionstatechange
    );
  }

  private removeEventListenerToRTC() {
    this.webrtcClient?.removeEventListener('track', this.handleOnTrack);
    this.webrtcClient?.removeEventListener(
      'datachannel',
      this.handelDataChannel
    );
    this.webrtcClient?.removeEventListener(
      'icecandidate',
      this.handleIceCandidate
    );
    this.webrtcClient?.removeEventListener(
      'signalingstatechange',
      this.handleSignalingstatechange
    );
    this.webrtcClient?.removeEventListener(
      'connectionstatechange',
      this.handleConnectionStateChange
    );
    this.webrtcClient?.removeEventListener(
      'icegatheringstatechange',
      this.handleIcegatheringstatechange
    );
    this.webrtcClient?.removeEventListener(
      'iceconnectionstatechange',
      this.handleIceconnectionstatechange
    );
  }

  private async initWebrtcClient(iceservers: RTCConfiguration) {
    if (this.webrtcClient) {
      this.hangUp();
    }
    console.log('___initWebrtcClient___');
    this.webrtcClient = new RTCPeerConnection({
      iceServers: iceservers.iceServers,
    });

    this.addEventListenerToRTC();
  }

  private async initAsyncWebrtcClient(sdp: string) {
    console.log('______step11______setRemoteDescription_____', { sdp });
    await this.webrtcClient?.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: sdp })
    );
    console.log('______step12______setRemoteDescription_____', { sdp });

    await this.webrtcClient?.createAnswer().then((answer) => {
      console.log('___5______client__:D 创建 answer', { answer });
      this.webrtcClient?.setLocalDescription(answer);
      if (this.onCreateAnswer) {
        this.
        (answer.sdp, answer.type);
      }
    });
  }

  public startCall(iceservers: RTCConfiguration, sdp: string) {
    console.log('____startCall_____');
    this.initWebrtcClient(iceservers);
    this.initAsyncWebrtcClient(sdp);
  }

  // 挂断
  public hangUp(): void {
    this.removeEventListenerToRTC();
    this.webrtcClient?.close();
    this.webrtcClient = null;
    this.state.localStream?.getTracks().forEach((track) => track.stop());
    this.setState({
      localStream: null,
      remoteStream: null,
      callState: 'idle',
    });
  }
}

