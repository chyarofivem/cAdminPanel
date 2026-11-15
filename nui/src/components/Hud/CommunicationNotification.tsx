import React from "react";

interface CommunicationNotificationProps {
  title: string;
  message: string;
}

/**
 * The body of an announcement, DM or restart toast: a 14px/500 white title and the
 * message as the 13px muted line. The localized title comes from the HUD event
 * pipeline; the card and its status icon are drawn by Toast.
 */
export const CommunicationNotification: React.FC<CommunicationNotificationProps> = ({
  title,
  message,
}) => (
  <div>
    <p className="toast-title">{title}</p>
    <p className="toast-message">{message}</p>
  </div>
);
