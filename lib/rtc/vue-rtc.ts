import { useCallback, useEffect, useRef, useState } from 'react';
import { newGuid } from '../util';
import { useLocalSearchParams } from 'expo-router';

interface UseVueRtcOptions {}

interface InitWebSocketProps {
  IsWebSocketConnecting: boolean;
  websock: WebSocket | null;
}

const wsuri = 'ws://webrtc.qq-kan.com/wswebclient/' + newGuid();
// const wsuri = "wss://webrtc.qq-kan.com/wswebclient/" + newGuid();

export function useVueRtc({}: UseVueRtcOptions) {
  // const [isWebSocketConnecting, setIsWebSocketConnecting] = useState<boolean>(false);
  const [startCall, setStartCall] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [meid, setMeid] = useState<string>(newGuid());
  const [peerid, setPeerid] = useState<string>('RHZL-00-IFJF-779N-00000244');

  const params = useLocalSearchParams<{ serno?: string }>();

  const websockRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sernoFromParams = params?.serno;
    // 检查 sernoFromParams 是否为有效字符串
    if (
      sernoFromParams &&
      typeof sernoFromParams === 'string' &&
      sernoFromParams.length > 0
    ) {
      setPeerid(sernoFromParams);
    }
    // 当 params.serno 变化时，此 effect 会重新运行
    // 如果只想在组件挂载时运行一次，可以将依赖项数组设置为空 []
  }, [params?.serno]);

  // 发送 ws 消息
  const websocketSend = useCallback((data: any) => {
    if (websockRef.current && websockRef.current.readyState === 1) {
      console.log('$cwebsocketSend____+++____', 'background-color: darkgreen');
      websockRef.current.send(data);
    }
  }, []);

  // 发送 ws 消息
  const sendToServer = useCallback((message: any) => {
    websocketSend(message);
  }, []);

  // 连接 ws
  const connectWebSocket = useCallback(() => {
    sendToServer({
      eventName: '__connectto',
      data: {
        sessionId: sessionId,
        sessionType: 'IE',
        messageId: newGuid(),
        from: meid,
        to: peerid,
      },
    });
  }, []);

  // 打开
  const websockOnOpen = useCallback((event: Event) => {
    console.log('$cwebsockOnOpen____+++____', 'background-color: blue');
    if (websockRef.current && websockRef.current.readyState === 1) {
      setStartCall(false);
      connectWebSocket();
    } else {
    }
  }, []);

  // 通信
  const websockOnMessage = useCallback((event: MessageEvent) => {
    console.log('$cwebsockOnMessage____+++____', 'background-color: green');
  }, []);

  // 关闭
  const websockOnClose = useCallback((event: CloseEvent) => {
    console.log('$cwebsockOnClose____+++____', 'background-color: darkred');
  }, []);

  // 错误
  const websockOnError = useCallback((event: Event) => {
    console.log('$cwebsockOnError____+++____', 'background-color: red');
  }, []);

  useEffect(() => {
    if (websockRef.current) {
      websockRef.current.close();
    }

    const websock = new WebSocket(wsuri);
    websockRef.current = websock;
    websock.onopen = websockOnOpen;
    websock.onmessage = websockOnMessage;
    websock.onclose = websockOnClose;
    websock.onerror = websockOnError;

    return () => {
      websock.close();
    };
  });
}
