// @/lib/rtc/hook.ts (示例修改)
import { useRef, useState, useCallback } from 'react';
import { RTCPeerConnection, MediaStream, mediaDevices } from 'react-native-webrtc';

interface UseWebRTCOptions {
    role: 'master' | 'viewer';
    iceServers?: RTCIceServer[];
}

export function useWebRTC({ role, iceServers = [{ urls: 'stun:stun.l.google.com:19302' }] }: UseWebRTCOptions) {
    const pc = useRef<RTCPeerConnection | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | undefined>('new');

    const cleanupWebRTC = useCallback(() => {
        if (pc.current) {
            console.log(`[${role.toUpperCase()}] Cleaning up WebRTC. Closing PeerConnection.`);

            // 不需要手动移除通过 addEventListener 添加的监听器，
            // 因为 pc.current.close() 会处理资源的释放，并且我们即将丢弃这个 pc.current 实例。
            // 如果你确实想手动移除，你需要保存对每个处理函数的引用，并在 removeEventListener 中使用它们。
            // 但对于这里的场景，close() 通常足够。

            // 停止并释放所有收发器中的轨道 - 这是一个好习惯，在 close() 之前或作为 close() 的一部分
            pc.current.getTransceivers().forEach(transceiver => {
                if (transceiver.stop) { // 检查方法是否存在
                    transceiver.stop();
                }
                // 进一步清理，例如移除轨道等，但 close() 应该会处理这些
            });

            pc.current.close(); // 这是关键的清理步骤
        }
        pc.current = null; // 丢弃对旧实例的引用
        setStream(null);
        setError(null);
        setConnectionState('closed'); // 更新状态
        console.log(`[${role.toUpperCase()}] WebRTC cleanup complete.`);
    }, [role]);


    const setupWebRTC = useCallback(async () => {
        console.log(`[${role.toUpperCase()}] setupWebRTC called. Current PC state: ${pc.current?.connectionState}`);

        // 1. 清理旧的连接
        if (pc.current) {
            // 如果连接不是 new, closed, failed，则先关闭
            const currentState = pc.current.connectionState;
            if (currentState !== 'new' && currentState !== 'closed' && currentState !== 'failed') {
                console.log(`[${role.toUpperCase()}] Closing existing PeerConnection before creating new one. State: ${currentState}`);
                cleanupWebRTC(); // 使用集中的清理函数
            } else if (currentState === 'closed' || currentState === 'failed') {
                // 如果已经是 closed 或 failed，确保引用清空
                pc.current = null;
            }
        }
        setStream(null); // 重置流状态，很重要！

        try {
            console.log(`[${role.toUpperCase()}] Creating new RTCPeerConnection.`);
            pc.current = new RTCPeerConnection({ iceServers });
            setConnectionState(pc.current.connectionState); // 初始化状态

            pc.current.addEventListener('track', (event: any) => { // 使用 any 避免类型体操，实际项目中应定义正确类型
                console.log(`[${role.toUpperCase()}] Remote track received. Streams:`, event.streams);
                if (event.streams && event.streams[0]) {
                    console.log(`[${role.toUpperCase()}] Setting remote stream:`, event.streams[0].id);
                    // 日志详细轨道信息
                    event.streams[0].getTracks().forEach((track: MediaStreamTrack) => {
                        console.log(`[${role.toUpperCase()}] Track kind: ${track.kind}, id: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
                    });
                    setStream(event.streams[0]);
                } else if (event.track) {
                    // 如果streams数组为空，但有event.track，尝试用它创建一个新的流
                    console.log(`[${role.toUpperCase()}] Remote track received (event.track). Track ID: ${event.track.id}`);
                    const newStream = new MediaStream();
                    newStream.addTrack(event.track);
                    setStream(newStream);
                }
            });

            pc.current.addEventListener('connectionstatechange', () => {
                const newState = pc.current?.connectionState;
                console.log(`[${role.toUpperCase()}] Connection state changed: ${newState}`);
                setConnectionState(newState);
                if (newState === 'failed') {
                    setError(`[${role.toUpperCase()}] WebRTC connection failed.`);
                    // 可以在这里触发重连逻辑，或者让使用方处理
                    // cleanupWebRTC(); // 如果连接失败，清理资源
                } else if (newState === 'disconnected') {
                    console.warn(`[${role.toUpperCase()}] WebRTC connection disconnected. May recover or may need reconnection.`);
                    // 'disconnected' 状态有时可以自动恢复，但如果长时间停留，也视为失败
                } else if (newState === 'closed') {
                    console.log(`[${role.toUpperCase()}] WebRTC connection closed.`);
                    // cleanupWebRTC(); // 确保资源在关闭时被清理
                } else {
                    setError(null); // 清除旧的错误
                }
            });

            // ICE candidate listener 会在 Viewer.tsx 中单独添加，因为需要 signalingClient

            return true; // 表示设置成功
        } catch (e: any) {
            console.error(`[${role.toUpperCase()}] Error setting up WebRTC:`, e);
            setError(`[${role.toUpperCase()}] Failed to initialize WebRTC: ${e.message}`);
            cleanupWebRTC();
            return false;
        }
    }, [role, iceServers, cleanupWebRTC]);

    // useEffect(() => {
    //   // 返回一个清理函数，当 hook 卸载时执行
    //   return () => {
    //     console.log(`[${role.toUpperCase()}] useWebRTC hook cleanup on unmount.`);
    //     cleanupWebRTC();
    //   };
    // }, [role, cleanupWebRTC]); // 确保 cleanupWebRTC 是稳定的

    return { pc, stream, error, state: connectionState, setupWebRTC, cleanupWebRTC };
}