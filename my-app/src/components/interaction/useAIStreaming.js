import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
 

export function useAIStreaming(onStreamEnd) {
  const [streamingText, setStreamingText] = useState("");
  const [currentStreamingId, setCurrentStreamingId] = useState(null);
  const isStreamingRef = useRef(false);
 
  useEffect(() => {
    socket.on("ai-start", () => {
      isStreamingRef.current = true;
      const newId = Date.now();
      setCurrentStreamingId(newId);
      setStreamingText("");
    });
 
    socket.on("ai-token", (token) => {
      setStreamingText(prev => prev + token);
    });
 
    socket.on("ai-end", () => {
      isStreamingRef.current = false;
      setCurrentStreamingId(null);
      setStreamingText("");
      if (onStreamEnd) {
        onStreamEnd();
      }
    });
 
    return () => {
      socket.off("ai-start");
      socket.off("ai-token");
      socket.off("ai-end");
    };
  }, [onStreamEnd]);
 
  return {
    streamingText,
    currentStreamingId,
    isStreamingRef
  };
}
 