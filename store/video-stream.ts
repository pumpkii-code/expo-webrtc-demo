import { create } from 'zustand';

const useVideoStream = create((set) => ({
  videoStream: 0,
  setVideoStream: (videoStream: string) => set({ videoStream }),
}));

export default useVideoStream;
