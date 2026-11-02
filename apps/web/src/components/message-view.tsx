import { type DisplayMessage, ROLE_COLOR, ROLE_LABEL } from '@totvibe/view';

type MessageViewProps = {
  message: DisplayMessage;
};

export const MessageView = ({ message }: MessageViewProps) => (
  <div className="message">
    <div style={{ color: ROLE_COLOR[message.role] }}>{ROLE_LABEL[message.role]}</div>
    <div className="message-text">{message.text}</div>
  </div>
);
