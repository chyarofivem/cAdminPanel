import React from "react";
import { Box, Typography } from "@mui/material";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import MarkChatUnreadRoundedIcon from "@mui/icons-material/MarkChatUnreadRounded";

type CommunicationKind = "announcement" | "direct-message";

interface CommunicationNotificationProps {
  kind: CommunicationKind;
  title: string;
  message: string;
}

const notificationCopy = {
  announcement: {
    Icon: CampaignRoundedIcon,
  },
  "direct-message": {
    Icon: MarkChatUnreadRoundedIcon,
  },
} as const;

/**
 * The localized title and body are supplied by the existing HUD event pipeline.
 * It deliberately renders no hard-coded labels: the existing localized title
 * remains the single source of truth for both visual and assistive-technology users.
 */
export const CommunicationNotification: React.FC<
  CommunicationNotificationProps
> = ({ kind, title, message }) => {
  const { Icon } = notificationCopy[kind];

  return (
    <Box className="tx-communication-card" role="status" aria-live="polite">
      <Box className="tx-communication-card__accent" aria-hidden="true" />
      <Box className="tx-communication-card__icon" aria-hidden="true">
        <Icon />
      </Box>
      <Box className="tx-communication-card__content">
        <Typography component="h2" className="tx-communication-card__title">
          {title}
        </Typography>
        <Typography component="p" className="tx-communication-card__message">
          {message}
        </Typography>
      </Box>
    </Box>
  );
};
