import { useState } from "react";
import { Button } from "react-native";

export default function RecordButton({
  // ws,
  // rtcConfig, 
  // sdp, 
  // candidate
}) {
  const [recordState, setRecordState] = useState<boolean>(false);

  const handleWebviewMessage = async (event: { nativeEvent: { data: string; }; }) => {
    const message = JSON.parse(event.nativeEvent.data);

    switch (message.type) {
      case 'answer':
        break;

      case 'candidate':
        break;
      case 'offer':
        break;
      default:
        break;
    }
  }

  return (
    <>
      <Button title="开始录制" />
    </>
  )
}
