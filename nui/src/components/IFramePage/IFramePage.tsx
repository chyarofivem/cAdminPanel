import React, { useEffect } from "react";
import { IFramePostData, useIFrameCtx } from "../../provider/IFrameProvider";
import { debugLog } from "../../utils/debugLog";
import { usePermissionsValue } from "../../state/permissions.state";

/**
 * The web panel, embedded through WebPipe, in the same page window as Players.
 */
export const IFramePage: React.FC<{ visible: boolean }> = ({ visible }) => {
  const { fullFrameSrc, handleChildPost } = useIFrameCtx();
  const userPerms = usePermissionsValue();

  // Only use the provider's src once the permissions have been fetched
  const trueFrameSource = Boolean(userPerms) ? fullFrameSrc : "about:blank";

  // Handles listening for postMessage requests from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data: IFramePostData =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (!data?.__isFromChild) return;
      debugLog("Post from iFrame", data);
      handleChildPost(data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleChildPost]);

  if (!visible) return null;
  return (
    <section className="page-window">
      <iframe src={trueFrameSource} title="Panel" />
    </section>
  );
};
