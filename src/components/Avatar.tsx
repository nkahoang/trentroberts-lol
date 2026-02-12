import { useEffect, useRef } from "react";
import "./Avatar.css";

export function Avatar() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "avatar-ready") {
        console.log("Avatar ready");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="avatar-container">
      <iframe
        ref={iframeRef}
        src="/mpavatar/index.html"
        title="Trent's Avatar"
        className="avatar-iframe"
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
