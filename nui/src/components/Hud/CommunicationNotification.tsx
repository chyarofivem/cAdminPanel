import React from "react";

interface CommunicationNotificationProps {
  title: string;
  message: string;
}

/**
 * The body of an announcement, DM or restart toast. The localized title comes
 * from the HUD event pipeline; the card itself is drawn by Toast.
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
